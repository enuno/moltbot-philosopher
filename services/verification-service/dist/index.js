"use strict";
/**
 * Verification Service
 * Instant AI-powered verification challenge solving
 */
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const VerificationSolver_js_1 = require("./solver/VerificationSolver.js");
const ChallengeHandler_js_1 = require("./handlers/ChallengeHandler.js");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Environment configuration
const PORT = parseInt(process.env.VERIFICATION_SERVICE_PORT || "3008", 10);
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY || "";
const MOLTBOOK_BASE_URL = process.env.MOLTBOOK_BASE_URL || "https://www.moltbook.com";
const AI_GENERATOR_URL = process.env.AI_GENERATOR_URL || "http://localhost:3002";
// Create solver
const solver = new VerificationSolver_js_1.VerificationSolver({
  moltbookApiKey: MOLTBOOK_API_KEY,
  moltbookBaseUrl: MOLTBOOK_BASE_URL,
  aiGeneratorUrl: AI_GENERATOR_URL,
  maxRetries: 3,
  timeoutMs: 5000, // 5 second timeout for AI
});
// Create handler
const handler = new ChallengeHandler_js_1.ChallengeHandler(solver);
// Routes
/**
 * Health check
 */
app.get("/health", (req, res) => {
  const stats = handler.getStats();
  res.json({
    status: "healthy",
    service: "verification-service",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    stats,
  });
});
/**
 * Handle verification challenge event
 */
app.post("/events", async (req, res) => {
  try {
    const event = req.body;
    if (event.type !== "verification.challenge.received") {
      res.status(400).json({
        success: false,
        error: "Invalid event type",
      });
      return;
    }
    // Handle asynchronously (don't block response)
    handler.handle(event).catch((error) => {
      console.error("[VerificationService] Handler error:", error);
    });
    res.json({
      success: true,
      message: "Challenge accepted",
    });
  } catch (error) {
    console.error("[VerificationService] Event processing error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
/**
 * Get service statistics
 */
app.get("/stats", (req, res) => {
  const stats = handler.getStats();
  res.json(stats);
});
// Start service
async function start() {
  try {
    console.log("Starting Verification Service...");
    console.log(`Moltbook API: ${MOLTBOOK_BASE_URL}`);
    console.log(`AI Generator: ${AI_GENERATOR_URL}`);
    app.listen(PORT, () => {
      console.log(`Verification Service listening on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Stats: http://localhost:${PORT}/stats`);
    });
  } catch (error) {
    console.error("Failed to start Verification Service:", error);
    process.exit(1);
  }
}
// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down...");
  process.exit(0);
});
// Start service
start();
//# sourceMappingURL=index.js.map
