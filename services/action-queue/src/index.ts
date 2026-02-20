import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from './database';
import { QueueProcessor } from './queue-processor';
import { RateLimiter } from './rate-limiter';
import {
  SubmitConditionalActionSchema,
  ActionStatus,
  Priority,
  QueuedAction,
  ConditionalAction,
} from './types';
import { QUEUE_CONFIG } from './config';

const app = express();
app.use(express.json());

// Initialize components
const db = new DatabaseManager();
const processor = new QueueProcessor(db);
const rateLimiter = new RateLimiter(db);

/**
 * Health check endpoint
 */
app.get('/queue/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

/**
 * Queue statistics endpoint
 */
app.get('/queue/stats', (req: Request, res: Response) => {
  try {
    const stats = processor.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Submit new action to queue
 */
app.post('/actions', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const parsed = SubmitConditionalActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
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
      scheduledFor: data.scheduledFor
        ? new Date(data.scheduledFor)
        : undefined,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      metadata: data.metadata,
      conditions: data.conditions,
      conditionCheckInterval: data.conditionCheckInterval || 60,
      conditionTimeout: data.conditionTimeout
        ? new Date(data.conditionTimeout)
        : undefined,
    };

    // Insert into database
    db.insertAction(action);

    console.log(
      `📥 Action submitted: ${action.id} (${action.actionType}) by ${action.agentName}`,
    );

    res.status(201).json({
      success: true,
      action: {
        id: action.id,
        status: action.status,
        createdAt: action.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error submitting action:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get action by ID
 */
app.get('/actions/:id', (req: Request, res: Response) => {
  try {
    const action = db.getAction(req.params.id);

    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Action not found',
      });
    }

    // Get condition evaluations if applicable
    const conditionalAction = action as ConditionalAction;
    let conditionEvaluations;
    if (conditionalAction.conditions) {
      conditionEvaluations = db.getConditionEvaluations(action.id);
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
 * Cancel action
 */
app.delete('/actions/:id', (req: Request, res: Response) => {
  try {
    const action = db.getAction(req.params.id);

    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Action not found',
      });
    }

    if (
      action.status !== ActionStatus.PENDING &&
      action.status !== ActionStatus.SCHEDULED
    ) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel action in status: ${action.status}`,
      });
    }

    db.cancelAction(action.id, 'Cancelled by user');

    res.json({
      success: true,
      message: 'Action cancelled',
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
app.get('/actions', (req: Request, res: Response) => {
  try {
    const status = req.query.status as ActionStatus | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    let actions: QueuedAction[];
    if (status) {
      actions = db.getActionsByStatus(status, limit);
    } else {
      // Get all recent actions
      actions = [
        ...db.getActionsByStatus(ActionStatus.PENDING, limit / 4),
        ...db.getActionsByStatus(ActionStatus.SCHEDULED, limit / 4),
        ...db.getActionsByStatus(ActionStatus.PROCESSING, limit / 4),
        ...db.getActionsByStatus(ActionStatus.COMPLETED, limit / 4),
      ];
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
app.get('/rate-limits/:agent', (req: Request, res: Response) => {
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
 * Manually trigger queue processing (for testing)
 */
app.post('/queue/process', async (req: Request, res: Response) => {
  try {
    await processor.processSingle();
    res.json({
      success: true,
      message: 'Processing triggered',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Manually trigger condition check (for testing)
 */
app.post('/queue/check-conditions', async (req: Request, res: Response) => {
  try {
    await processor.checkConditionsSingle();
    res.json({
      success: true,
      message: 'Condition check triggered',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get job history for a specific job ID
 */
app.get('/queue/jobs/:id/history', (req: Request, res: Response) => {
  try {
    const history = db.getJobHistory(req.params.id);

    if (history === null) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    res.json({
      success: true,
      data: history,
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
 * Get metrics for a specific agent
 */
app.get('/queue/agents/:name/metrics', (req: Request, res: Response) => {
  try {
    const agentName = req.params.name?.trim();
    if (!agentName) {
      return res.status(400).json({
        success: false,
        error: 'Agent name is required and must not be empty',
      });
    }

    const metrics = db.getAgentMetrics(agentName);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error(`Error fetching metrics for agent ${req.params.name}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Error handling middleware
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

/**
 * Start server
 */
const port = QUEUE_CONFIG.port;

function startServer() {
  // Start processor
  processor.start();

  // Start HTTP server
  app.listen(port, () => {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Action Queue Service Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 HTTP API: http://localhost:${port}`);
    console.log(`📊 Health: http://localhost:${port}/queue/health`);
    console.log(`📈 Stats: http://localhost:${port}/queue/stats`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await processor.stop();
  db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await processor.stop();
  db.close();
  process.exit(0);
});

// Start if running directly
if (require.main === module) {
  startServer();
}

export { app, db, processor, rateLimiter };
