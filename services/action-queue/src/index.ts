import express, { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { DatabaseManager } from "./database";
import { QueueProcessor } from "./queue-processor";
import { RateLimiter } from "./rate-limiter";
import { RecoveryEngine } from "./recovery-engine";
import { AlertingService } from "./alerting";
import { CircuitBreaker } from "./circuit-breaker";
import { metricsCollector } from "./metrics";
import {
  SubmitConditionalActionSchema,
  ActionStatus,
  Priority,
  QueuedAction,
  ConditionalAction,
} from "./types";
import { QUEUE_CONFIG } from "./config";

const app = express();
app.use(express.json());

// Initialize components
const db = new DatabaseManager();
const processor = new QueueProcessor(db);
const rateLimiter = new RateLimiter(db);
const alerting = new AlertingService();
const circuitBreaker = new CircuitBreaker(db);
const recoveryEngine = new RecoveryEngine(db, alerting, circuitBreaker);

/**
 * Health check endpoint with circuit breaker state
 */
app.get("/queue/health", async (req: Request, res: Response) => {
  try {
    // Get all worker states from database
    const allWorkerStates = await db.query(
      `SELECT agent_name, state, consecutive_failures, last_failure_time, opened_at
       FROM worker_state ORDER BY agent_name`
    );

    // Build circuits object from worker states
    const circuits: Record<
      string,
      {
        state: string;
        consecutive_failures: number;
        last_failure_time: string | null;
        opened_at: string | null;
      }
    > = {};

    for (const row of allWorkerStates.rows) {
      circuits[row.agent_name] = {
        state: row.state,
        consecutive_failures: row.consecutive_failures,
        last_failure_time: row.last_failure_time ? row.last_failure_time.toISOString() : null,
        opened_at: row.opened_at ? row.opened_at.toISOString() : null,
      };
    }

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      circuits,
      metrics: metricsCollector.getMetrics(),
    });
  } catch (error: any) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * Queue statistics endpoint with detailed breakdown
 */
app.get("/queue/stats", async (req: Request, res: Response) => {
  try {
    const stats = await processor.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Metrics endpoint for monitoring (public, no auth required)
 * Returns circuit breaker lifecycle metrics only
 */
app.get("/metrics", (req: Request, res: Response) => {
  res.json(metricsCollector.getMetrics());
});

/**
 * Submit new action to queue
 */
app.post("/actions", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const parsed = SubmitConditionalActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: parsed.error.errors,
      });
    }

    const data = parsed.data;

    // Create action
    const action: ConditionalAction = {
      id: uuidv4(),
      agentName: data.agentName,
      actionType: data.actionType,
      priority: data.priority || Priority.NORMAL,
      payload: data.payload,
      status: data.conditions
        ? ActionStatus.SCHEDULED
        : data.scheduledFor
          ? ActionStatus.SCHEDULED
          : ActionStatus.PENDING,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      metadata: data.metadata,
      conditions: data.conditions,
      conditionCheckInterval: data.conditionCheckInterval || 60,
      conditionTimeout: data.conditionTimeout ? new Date(data.conditionTimeout) : undefined,
    };

    // Insert into database
    await db.insertAction(action);

    console.log(`📥 Action submitted: ${action.id} (${action.actionType}) by ${action.agentName}`);

    res.status(201).json({
      success: true,
      action: {
        id: action.id,
        status: action.status,
        createdAt: action.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Error submitting action:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get action by ID
 */
app.get("/actions/:id", async (req: Request, res: Response) => {
  try {
    const action = await db.getAction(req.params.id);

    if (!action) {
      return res.status(404).json({
        success: false,
        error: "Action not found",
      });
    }

    // Get condition evaluations if applicable
    const conditionalAction = action as ConditionalAction;
    let conditionEvaluations;
    if (conditionalAction.conditions) {
      conditionEvaluations = await db.getConditionEvaluations(action.id);
    }

    res.json({
      success: true,
      action: {
        ...action,
        conditionEvaluations,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get job execution history by ID
 */
app.get("/queue/jobs/:id/history", async (req: Request, res: Response) => {
  try {
    const history = await db.getJobHistory(req.params.id);

    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get per-agent metrics and statistics
 */
app.get("/queue/agents/:name/metrics", async (req: Request, res: Response) => {
  try {
    const metrics = await db.getAgentMetrics(req.params.name);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Cancel action
 */
app.delete("/actions/:id", async (req: Request, res: Response) => {
  try {
    const action = await db.getAction(req.params.id);

    if (!action) {
      return res.status(404).json({
        success: false,
        error: "Action not found",
      });
    }

    if (action.status !== ActionStatus.PENDING && action.status !== ActionStatus.SCHEDULED) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel action in status: ${action.status}`,
      });
    }

    await db.cancelAction(action.id, "Cancelled by user");

    res.json({
      success: true,
      message: "Action cancelled",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * List actions (with filters)
 */
app.get("/actions", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as ActionStatus | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    let actions: QueuedAction[];
    if (status) {
      actions = await db.getActionsByStatus(status, limit);
    } else {
      // Get all recent actions
      const [pending, scheduled, processing, completed] = await Promise.all([
        db.getActionsByStatus(ActionStatus.PENDING, Math.floor(limit / 4)),
        db.getActionsByStatus(ActionStatus.SCHEDULED, Math.floor(limit / 4)),
        db.getActionsByStatus(ActionStatus.PROCESSING, Math.floor(limit / 4)),
        db.getActionsByStatus(ActionStatus.COMPLETED, Math.floor(limit / 4)),
      ]);
      actions = [...pending, ...scheduled, ...processing, ...completed];
    }

    res.json({
      success: true,
      actions,
      count: actions.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get rate limit status for agent
 */
app.get("/rate-limits/:agent", (req: Request, res: Response) => {
  try {
    const agentName = req.params.agent;
    const status = rateLimiter.getStatus(agentName);

    res.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Health check for manual processing (pg-boss handles this automatically)
 */
app.post("/queue/process", async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: "Queue processing is handled automatically by pg-boss",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Recovery endpoints (P7.7.4 - Circuit Breaker Recovery Mechanisms)
 */

/**
 * Manually reset circuit to CLOSED (admin operation)
 */
app.post("/recovery/reset/:agentName", async (req: Request, res: Response) => {
  const { agentName } = req.params;
  const adminToken = req.headers.authorization?.replace("Bearer ", "");

  // Validate admin token
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await recoveryEngine.manualReset(agentName, adminToken);
    res.json({
      success: true,
      message: `Circuit for ${agentName} reset to CLOSED`,
      agent_name: agentName,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `Failed to reset circuit for ${agentName}`,
      details: errorMsg,
    });
  }
});

/**
 * Trigger recovery probe (manual or automatic)
 */
app.post("/recovery/probe", async (req: Request, res: Response) => {
  const adminToken = req.headers.authorization?.replace("Bearer ", "");

  // Validate admin token
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await recoveryEngine.startAutoRecoveryProbe(1); // Immediate probe
    res.json({
      success: true,
      message: "Recovery probe triggered",
      probesRun: 1,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: "Failed to run recovery probe",
      details: errorMsg,
    });
  }
});

/**
 * Get circuit status for agent (public endpoint, no auth required)
 */
app.get("/recovery/status/:agentName", async (req: Request, res: Response) => {
  const { agentName } = req.params;

  try {
    const state = await db.getWorkerState(agentName);

    if (!state) {
      return res.status(404).json({
        error: `No state found for agent ${agentName}`,
      });
    }

    res.json({
      agent_name: state.agent_name,
      state: state.state,
      consecutive_failures: state.consecutive_failures,
      last_failure_time: state.last_failure_time,
      opened_at: state.opened_at,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `Failed to fetch status for ${agentName}`,
      details: errorMsg,
    });
  }
});

/**
 * Recover all orphaned actions
 */
app.post("/recovery/orphaned/reclaim", async (req: Request, res: Response) => {
  const adminToken = req.headers.authorization?.replace("Bearer ", "");

  // Validate admin token
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const recovered = await recoveryEngine.recoverOrphanedActions();
    const orphans = await db.findOrphanedActions();

    res.json({
      success: true,
      recovered,
      action_ids: orphans,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: "Failed to recover orphaned actions",
      details: errorMsg,
    });
  }
});

/**
 * Error handling middleware
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

/**
 * Start server
 */
const port = QUEUE_CONFIG.port;

async function startServer() {
  // Start HTTP server immediately (do not block on DB initialization)
  const server = app.listen(port, () => {
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚀 Action Queue Service Started");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📡 HTTP API: http://localhost:${port}`);
    console.log(`📊 Health: http://localhost:${port}/queue/health`);
    console.log(`📈 Stats: http://localhost:${port}/queue/stats`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
  });

  // Initialize database and processor in background (non-blocking)
  db.initialize()
    .then(() => processor.start())
    .then(() => {
      // Start auto-recovery probe (1 hour interval by default)
      const probeInterval = parseInt(process.env.RECOVERY_PROBE_INTERVAL_MS || "3600000", 10) / 1000;
      return recoveryEngine.startAutoRecoveryProbe(probeInterval);
    })
    .then(() => {
      console.log("✅ Database, processor, and recovery engine fully initialized");
    })
    .catch((error) => {
      console.error("❌ Background initialization failed:", error);
      // Gracefully degrade: server is still running for health checks
      // but queue processing will fail until DB initializes
    });

  return server;
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  recoveryEngine.stopAutoRecoveryProbe();
  await processor.stop();
  db.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  recoveryEngine.stopAutoRecoveryProbe();
  await processor.stop();
  db.close();
  process.exit(0);
});

// Start if running directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

export { app, db, processor, rateLimiter };
