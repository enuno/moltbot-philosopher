/**
 * Verification Service with Scenario-Aware Challenge Solving
 * 
 * Features:
 * - Detects challenge scenarios (stack_challenge_v1, etc.)
 * - Validates responses against scenario-specific rules
 * - Structured logging for observability
 * - Per-scenario metrics tracking
 */

import express, { type Request, type Response } from "express";
import { VerificationSolverEnhanced } from "./solver/VerificationSolverEnhanced";
import type { ChallengeEvent } from "./types";
import { logInfo, logError } from "./utils/logger";

const app: express.Application = express();
app.use(express.json());

// Environment configuration
const PORT = parseInt(process.env.VERIFICATION_SERVICE_PORT || "3007", 10);
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY || "";
const MOLTBOOK_BASE_URL = process.env.MOLTBOOK_BASE_URL || "http://egress-proxy:8082/api/v1";
const AI_GENERATOR_URL = process.env.AI_GENERATOR_URL || "http://ai-generator:3002";
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || "3", 10);
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || "10000", 10);

// Validate required config
if (!MOLTBOOK_API_KEY) {
  console.error("FATAL: MOLTBOOK_API_KEY not set");
  process.exit(1);
}

// Create solver
const solver = new VerificationSolverEnhanced({
  moltbookApiKey: MOLTBOOK_API_KEY,
  moltbookBaseUrl: MOLTBOOK_BASE_URL,
  aiGeneratorUrl: AI_GENERATOR_URL,
  maxRetries: MAX_RETRIES,
  timeoutMs: TIMEOUT_MS,
});

// Statistics tracking
const stats = {
  total: 0,
  solved: 0,
  failed: 0,
  byScenario: {} as Record<string, { solved: number; failed: number }>,
};

// Event listeners for metrics
solver.on("solved", (challenge, answer, duration, attempts) => {
  stats.solved++;
  logInfo("Challenge solved", {
    service: "verification-service",
    challengeId: challenge.id,
    duration,
    attempts,
  });
});

solver.on("failed", (challenge, error, duration, attempts) => {
  stats.failed++;
  logError("Challenge failed", {
    service: "verification-service",
    challengeId: challenge.id,
    error: error instanceof Error ? error.message : String(error),
    duration,
    attempts,
  });
});

// Routes

/**
 * Health check endpoint
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "verification-service",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    stats: {
      total: stats.total,
      solved: stats.solved,
      failed: stats.failed,
      successRate: stats.total > 0 ? (stats.solved / stats.total) * 100 : 0,
    },
  });
});

/**
 * Handle verification challenge event (from proxy)
 */
app.post("/events", async (req: Request, res: Response) => {
  try {
    const event = req.body as ChallengeEvent;

    // Validate event type
    if (event.type !== "verification.challenge.received") {
      res.status(400).json({
        success: false,
        error: `Invalid event type: ${event.type}`,
      });
      return;
    }

    // Validate payload
    const { challengeId, question, expiresAt } = event.payload;
    if (!challengeId || !question || !expiresAt) {
      res.status(400).json({
        success: false,
        error: "Missing required fields in payload",
      });
      return;
    }

    // Accept immediately (solve asynchronously)
    res.json({
      success: true,
      message: "Challenge accepted",
      challengeId,
    });

    // Solve in background
    stats.total++;
    logInfo("Challenge received", {
      service: "verification-service",
      challengeId,
    });

    const result = await solver.solve({
      id: challengeId,
      question,
      expiresAt,
      metadata: event.payload.metadata,
    });

    // Track scenario stats
    if (result.scenario) {
      if (!stats.byScenario[result.scenario]) {
        stats.byScenario[result.scenario] = { solved: 0, failed: 0 };
      }
      if (result.success) {
        stats.byScenario[result.scenario].solved++;
      } else {
        stats.byScenario[result.scenario].failed++;
      }
    }

    if (!result.success) {
      logError("Async solve failed", {
        service: "verification-service",
        challengeId,
        error: result.error,
      });
    }
  } catch (error) {
    logError("Event processing error", {
      service: "verification-service",
      error: error instanceof Error ? error.message : String(error),
    });
    
    // If we haven't responded yet
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
});

/**
 * Get service statistics
 */
app.get("/stats", (req: Request, res: Response) => {
  res.json({
    total: stats.total,
    solved: stats.solved,
    failed: stats.failed,
    successRate: stats.total > 0 ? (stats.solved / stats.total) * 100 : 0,
    byScenario: stats.byScenario,
  });
});

/**
 * Manual solve endpoint (for testing)
 */
app.post("/solve", async (req: Request, res: Response) => {
  try {
    const { challengeId, question, expiresAt } = req.body;

    if (!challengeId || !question || !expiresAt) {
      res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
      return;
    }

    stats.total++;
    const result = await solver.solve({ id: challengeId, question, expiresAt });

    // Track scenario stats
    if (result.scenario) {
      if (!stats.byScenario[result.scenario]) {
        stats.byScenario[result.scenario] = { solved: 0, failed: 0 };
      }
      if (result.success) {
        stats.byScenario[result.scenario].solved++;
      } else {
        stats.byScenario[result.scenario].failed++;
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Start service
async function start() {
  try {
    logInfo("Starting Verification Service", {
      service: "verification-service",
      moltbookUrl: MOLTBOOK_BASE_URL,
      aiGeneratorUrl: AI_GENERATOR_URL,
      maxRetries: MAX_RETRIES,
      timeout: TIMEOUT_MS,
    });

    app.listen(PORT, () => {
      logInfo("Service started", {
        service: "verification-service",
        port: PORT,
        endpoints: {
          health: `http://localhost:${PORT}/health`,
          events: `http://localhost:${PORT}/events`,
          stats: `http://localhost:${PORT}/stats`,
        },
      });
    });
  } catch (error) {
    logError("Failed to start service", {
      service: "verification-service",
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logInfo("SIGTERM received, shutting down", {
    service: "verification-service",
  });
  process.exit(0);
});

process.on("SIGINT", () => {
  logInfo("SIGINT received, shutting down", {
    service: "verification-service",
  });
  process.exit(0);
});

// Start service
start();

// Export for testing
export { app };
