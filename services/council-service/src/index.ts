/**
 * Council Service
 * Automated ethics-convergence governance
 */

import express, { type Request, type Response } from "express";
import * as path from "path";
import { Codex } from "./governance/Codex.js";
import { VotingSystem } from "./consensus/VotingSystem.js";
import { IterationScheduler } from "./scheduler/IterationScheduler.js";

const app = express();
app.use(express.json());

// Environment configuration
const PORT = parseInt(process.env.COUNCIL_SERVICE_PORT || "3010", 10);
const WORKSPACE_BASE = process.env.WORKSPACE_BASE || "/workspace";
const CODEX_PATH = path.join(WORKSPACE_BASE, "classical", "codex-state.json");

// Initialize components
const codex = new Codex(CODEX_PATH);
const voting = new VotingSystem();
const scheduler = new IterationScheduler({
  iterationDays: 5,
  autoStart: false, // Manual trigger for now
});

// Wire up scheduler events
scheduler.on("iteration:start", async (iteration) => {
  console.log(`[CouncilService] Iteration ${iteration.iterationNumber} started`);

  // Record in codex
  await codex.recordIteration();

  // Emit event to Agent Orchestrator (TODO)
  console.log("[CouncilService] TODO: Notify agents of new iteration");
});

scheduler.on("iteration:complete", (iteration) => {
  console.log(`[CouncilService] Iteration ${iteration.iterationNumber} completed`);
});

// Routes

/**
 * Health check
 */
app.get("/health", async (req: Request, res: Response) => {
  const codexState = await codex.load();
  const votingStats = voting.getStats();
  const currentIteration = scheduler.getCurrentIteration();

  res.json({
    status: "healthy",
    service: "council-service",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    governance: {
      codexVersion: codexState.version,
      activeGuardrails: codexState.guardrails.filter((g) => g.status === "active").length,
      proposedGuardrails: codexState.guardrails.filter((g) => g.status === "proposed").length,
      iterationCount: codexState.iterationCount,
      lastIteration: codexState.lastIterationDate,
    },
    voting: votingStats,
    scheduler: {
      running: scheduler.isRunning(),
      currentIteration,
      daysRemaining: scheduler.getDaysRemaining(),
    },
  });
});

/**
 * Get codex state
 */
app.get("/codex", async (req: Request, res: Response) => {
  try {
    const state = await codex.load();
    res.json({ success: true, data: state });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Propose new guardrail
 */
app.post("/codex/guardrails", async (req: Request, res: Response) => {
  try {
    const { id, title, description, rationale } = req.body;

    const guardrail = await codex.proposeGuardrail(id, title, description, rationale);

    res.json({ success: true, data: guardrail });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Vote on guardrail
 */
app.post("/codex/guardrails/:id/vote", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agent, vote, reason } = req.body;

    await codex.vote(id, agent, vote, reason);

    // Check for consensus
    const hasConsensus = codex.hasConsensus(id);
    if (hasConsensus) {
      await codex.activateGuardrail(id);
      console.log(`[CouncilService] Guardrail ${id} activated via consensus`);
    }

    res.json({ success: true, consensus: hasConsensus });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Start voting session
 */
app.post("/voting/sessions", (req: Request, res: Response) => {
  try {
    const { id, topic, description } = req.body;

    const session = voting.startSession(id, topic, description);

    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Cast vote
 */
app.post("/voting/sessions/:id/vote", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agent, vote, reason } = req.body;

    voting.castVote(id, agent, vote, reason);

    const hasConsensus = voting.hasConsensus(id);

    res.json({ success: true, consensus: hasConsensus });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Start new iteration manually
 */
app.post("/iterations/start", (req: Request, res: Response) => {
  try {
    scheduler.triggerIteration();
    const iteration = scheduler.getCurrentIteration();

    res.json({ success: true, data: iteration });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Get current iteration
 */
app.get("/iterations/current", (req: Request, res: Response) => {
  const iteration = scheduler.getCurrentIteration();

  if (!iteration) {
    res.status(404).json({ success: false, error: "No active iteration" });
    return;
  }

  res.json({ success: true, data: iteration });
});

// Start service
async function start() {
  try {
    console.log("Starting Council Service...");
    console.log(`Workspace: ${WORKSPACE_BASE}`);
    console.log(`Codex path: ${CODEX_PATH}`);

    // Load codex
    await codex.load();
    console.log("Codex loaded");

    // Start scheduler (manual trigger mode)
    scheduler.start();

    app.listen(PORT, () => {
      console.log(`Council Service listening on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Codex: http://localhost:${PORT}/codex`);
    });
  } catch (error) {
    console.error("Failed to start Council Service:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  scheduler.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down...");
  scheduler.stop();
  process.exit(0);
});

// Start service
start();
