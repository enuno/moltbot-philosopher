/**
 * Engagement Service - Express Server with Cron Jobs
 * Orchestrates proactive platform engagement for all agents
 * Endpoints: /health, /engage, /stats
 * Cron jobs: 5-min cycle, 30-min posting check, 2am maintenance
 */

import express, { type Request, type Response } from "express";
import cron from "node-cron";
import path from "path";
import { EngagementEngine } from "./engagement-engine";
import { StateManager } from "./state-manager";
import type { Agent, EngagementState } from "./types";
import { buildSummary, buildTrends, buildAgentsSection, buildQualitySection } from "./stats-builder";
import winston from "winston";

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "engagement-service" },
  transports: [
    new winston.transports.File({ filename: "logs/engagement-error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/engagement.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  );
}

const app: ReturnType<typeof express> = express();
app.use(express.json());

// Environment configuration
const PORT = parseInt(process.env.ENGAGEMENT_SERVICE_PORT || "3010", 10);
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || "/workspace";
const AGENTS_CONFIG = process.env.AGENTS_CONFIG || path.join(WORKSPACE_ROOT, "AGENTS.json");

// Load agent roster
function loadAgentRoster(): Agent[] {
  const agentIds = [
    "classical",
    "existentialist",
    "transcendentalist",
    "joyce",
    "enlightenment",
    "beat",
    "cyberpunk-posthumanist",
    "satirist-absurdist",
    "scientist-empiricist",
  ];

  return agentIds.map((id) => ({
    id,
    name: id
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    tradition: id,
    statePath: path.join(WORKSPACE_ROOT, id, "engagement-state.json"),
  }));
}

let engine: EngagementEngine;
let agentRoster: Agent[] = [];

// Initialize service
async function initialize() {
  try {
    agentRoster = loadAgentRoster();
    logger.info("Loaded agent roster", { agents: agentRoster.length });

    // Create state paths map
    const statePaths: Record<string, string> = {};
    agentRoster.forEach((agent) => {
      statePaths[agent.id] = agent.statePath;
    });

    engine = new EngagementEngine({ statePaths, agentRoster });
    logger.info("EngagementEngine initialized");
  } catch (error) {
    logger.error("Failed to initialize EngagementEngine", { error });
    throw error;
  }
}

// Routes

/**
 * Health check endpoint
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "engagement-service",
    version: "2.8.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    agents: agentRoster.length,
  });
});

/**
 * Engage endpoint - manually trigger engagement cycle
 * POST /engage - starts a new engagement cycle
 * Returns: { success, message, duration, agentsVisited, actionsExecuted }
 */
app.post("/engage", async (req: Request, res: Response) => {
  if (!engine) {
    return res.status(503).json({
      success: false,
      error: "Service not initialized",
    });
  }

  try {
    const startTime = Date.now();
    await engine.runEngagementCycle();
    const duration = Date.now() - startTime;

    logger.info("Engagement cycle completed", { duration });

    res.json({
      success: true,
      message: "Engagement cycle completed",
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Engagement cycle failed", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Stats endpoint - P2.4 comprehensive metrics
 * GET /stats - returns production-grade engagement statistics
 */
app.get("/stats", async (req: Request, res: Response) => {
  try {
    // Build state map from all agents
    const stateMap = new Map<string, EngagementState>();
    for (const agent of agentRoster) {
      const stateManager = new StateManager(agent.statePath);
      const state = await stateManager.loadState();
      stateMap.set(agent.id, state);
    }

    // Check data freshness
    const lastCycleTime = app.locals.lastCycleTime || Date.now();
    const timeSinceLastCycle = Date.now() - lastCycleTime;
    const isStale = timeSinceLastCycle > 120000; // 2 minutes

    // Build P2.4 stats response
    const serviceInfo = {
      status: isStale ? "degraded" : "healthy",
      uptime_seconds: Math.floor(process.uptime()),
      data_freshness: {
        last_cycle_at: new Date(lastCycleTime).toISOString(),
        cycle_interval_seconds: 60,
        is_stale: isStale,
      },
    };

    const summary = buildSummary(agentRoster, stateMap);
    const trends = buildTrends(stateMap);
    const agentsSection = buildAgentsSection(agentRoster, stateMap);
    const quality = buildQualitySection(stateMap);

    const response = {
      service: serviceInfo,
      summary,
      trends,
      agents: agentsSection,
      quality,
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to build stats", { error });
    res.status(500).json({
      error: "Failed to build stats",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Ready endpoint - check if service is ready
 * GET /ready - returns { ready: true } or { ready: false }
 */
app.get("/ready", (req: Request, res: Response) => {
  const ready = !!engine && agentRoster.length > 0;
  res.json({ ready, agents: agentRoster.length });
});

// Cron Jobs

/**
 * 15-minute discovery cycle
 * Discovers relevant threads via semantic search and enqueues opportunities
 * Runs every 15 minutes
 */
function scheduleDiscoveryCycle() {
  if (process.env.NODE_ENV === "test") {
    logger.info("Skipping 15-minute discovery cycle in test mode");
    return;
  }

  cron.schedule("*/15 * * * *", async () => {
    try {
      logger.info("Starting 15-minute discovery cycle");
      const startTime = Date.now();

      // Run discovery for all agents
      for (const agent of agentRoster) {
        try {
          // Call TypeScript discovery service via child process
          const { spawn } = require("child_process");
          const discovery = spawn("npx", [
            "ts-node",
            "services/engagement-service/src/discover-relevant-threads.ts",
            agent.id,
            process.env.WORKSPACE_ROOT || "/workspace",
          ]);

          await new Promise<void>((resolve, reject) => {
            discovery.on("close", (code: number) => {
              if (code === 0) {
                logger.info(`Discovery completed for ${agent.id}`);
                resolve();
              } else {
                logger.warn(`Discovery failed for ${agent.id} with code ${code}`);
                resolve(); // Don't reject - continue with other agents
              }
            });
            discovery.on("error", (err: Error) => {
              logger.error(`Discovery process error for ${agent.id}`, { error: err });
              resolve(); // Continue with other agents
            });
          });
        } catch (error) {
          logger.error(`Failed to start discovery for ${agent.id}`, { error });
          // Continue with next agent
        }
      }

      const duration = Date.now() - startTime;
      logger.info("15-minute discovery cycle completed", { duration });
    } catch (error) {
      logger.error("15-minute discovery cycle failed", { error });
    }
  });

  logger.info("15-minute discovery cycle scheduled");
}

/**
 * 5-minute engagement cycle
 * Monitors feeds, queues opportunities, executes actions for all agents
 * Runs every 5 minutes
 */
function scheduleFiveMinuteCycle() {
  if (process.env.NODE_ENV === "test") {
    logger.info("Skipping 5-minute cycle in test mode");
    return;
  }

  cron.schedule("*/5 * * * *", async () => {
    try {
      logger.info("Starting 5-minute engagement cycle");
      const startTime = Date.now();

      await engine.runEngagementCycle();

      const duration = Date.now() - startTime;
      // Update last cycle time for stats endpoint
      app.locals.lastCycleTime = Date.now();
      logger.info("5-minute engagement cycle completed", { duration });
    } catch (error) {
      logger.error("5-minute cycle failed", { error });
    }
  });

  logger.info("5-minute engagement cycle scheduled");
}

/**
 * 30-minute posting check
 * Evaluates each agent for proactive posting opportunities
 * Runs every 30 minutes
 */
function schedulePostingCheck() {
  if (process.env.NODE_ENV === "test") {
    logger.info("Skipping 30-minute posting check in test mode");
    return;
  }

  cron.schedule("*/30 * * * *", async () => {
    try {
      logger.info("Starting 30-minute posting check");

      for (const agent of agentRoster) {
        try {
          await engine.considerPosting(agent);
        } catch (error) {
          logger.error(`Posting check failed for ${agent.id}`, { error });
        }
      }

      logger.info("30-minute posting check completed");
    } catch (error) {
      logger.error("Posting check cycle failed", { error });
    }
  });

  logger.info("30-minute posting check scheduled");
}

/**
 * 2am daily maintenance
 * Resets daily stats, unfollows inactive accounts
 * Runs at 2:00 AM every day
 */
function scheduleDailyMaintenance() {
  if (process.env.NODE_ENV === "test") {
    logger.info("Skipping daily maintenance in test mode");
    return;
  }

  cron.schedule("0 2 * * *", async () => {
    try {
      logger.info("Starting daily maintenance");
      const startTime = Date.now();

      await engine.dailyMaintenance();

      const duration = Date.now() - startTime;
      logger.info("Daily maintenance completed", { duration });
    } catch (error) {
      logger.error("Daily maintenance failed", { error });
    }
  });

  logger.info("Daily maintenance scheduled for 2:00 AM");
}

// Start service
async function start() {
  try {
    logger.info("Starting Engagement Service v2.8.0");
    logger.info("Environment", {
      port: PORT,
      workspace: WORKSPACE_ROOT,
      nodeEnv: process.env.NODE_ENV,
    });

    // Initialize engine
    await initialize();

    // Schedule cron jobs
    scheduleDiscoveryCycle();
    scheduleFiveMinuteCycle();
    schedulePostingCheck();
    scheduleDailyMaintenance();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`Engagement Service listening on port ${PORT}`);
      logger.info(`Health: http://localhost:${PORT}/health`);
      logger.info(`Engage: POST http://localhost:${PORT}/engage`);
      logger.info(`Stats: http://localhost:${PORT}/stats`);
    });

    // Graceful shutdown
    const gracefulShutdown = () => {
      logger.info("Shutting down gracefully...");
      server.close(() => {
        logger.info("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    logger.error("Failed to start Engagement Service", { error });
    process.exit(1);
  }
}

// Export for testing
export { app, engine, agentRoster, initialize };

// Start if not imported as module
if (process.env.NODE_ENV !== "test") {
  start();
}
