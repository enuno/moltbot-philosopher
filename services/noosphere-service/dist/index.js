"use strict";
/**
 * Noosphere Service
 * Living epistemological memory system
 */
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const MemoryLayer_js_1 = require("./memory/MemoryLayer.js");
const ConsolidationScheduler_js_1 = require("./consolidation/ConsolidationScheduler.js");
const SemanticSearch_js_1 = require("./search/SemanticSearch.js");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Environment configuration
const PORT = parseInt(process.env.NOOSPHERE_SERVICE_PORT || "3011", 10);
const WORKSPACE_BASE = process.env.WORKSPACE_BASE || "/workspace";
const AGENT_NAME = process.env.AGENT_NAME || "classical";
// Initialize components
const memoryLayer = new MemoryLayer_js_1.MemoryLayer({
  workspaceBase: WORKSPACE_BASE,
  agentName: AGENT_NAME,
});
const consolidationScheduler = new ConsolidationScheduler_js_1.ConsolidationScheduler(
  {
    dailySchedule: "0 2 * * *", // 2am daily
    autoStart: false, // Manual trigger for now
    minEntriesForConsolidation: 5,
  },
  memoryLayer,
);
const semanticSearch = new SemanticSearch_js_1.SemanticSearch();
// Wire up scheduler events
consolidationScheduler.on("consolidated", (data) => {
  console.log(`[NoosphereService] ✓ Consolidated ${data.sourceCount} entries`);
});
consolidationScheduler.on("error", (error) => {
  console.error("[NoosphereService] Consolidation error:", error);
});
// Routes
/**
 * Health check
 */
app.get("/health", async (req, res) => {
  const stats = await memoryLayer.getStats();
  const schedulerStats = consolidationScheduler.getStats();
  res.json({
    status: "healthy",
    service: "noosphere-service",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: stats,
    consolidation: schedulerStats,
  });
});
/**
 * Add memory entry to Layer 1
 */
app.post("/memory", async (req, res) => {
  try {
    const { content, confidence, source, tags, metadata } = req.body;
    const entry = await memoryLayer.addToLayer1({
      content,
      confidence: confidence || 0.5,
      source: source || "api",
      tags: tags || [],
      metadata,
    });
    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
/**
 * Get entries from a layer
 */
app.get("/memory/layer/:layer", async (req, res) => {
  try {
    const layer = parseInt(req.params.layer);
    if (![1, 2, 3].includes(layer)) {
      res.status(400).json({ success: false, error: "Invalid layer (must be 1, 2, or 3)" });
      return;
    }
    const entries = await memoryLayer.getLayerEntries(layer);
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
/**
 * Search memories
 */
app.post("/search", async (req, res) => {
  try {
    const { query, topK } = req.body;
    if (!query) {
      res.status(400).json({ success: false, error: "Query required" });
      return;
    }
    // Get all entries
    const allEntries = [
      ...(await memoryLayer.getLayerEntries(1)),
      ...(await memoryLayer.getLayerEntries(2)),
      ...(await memoryLayer.getLayerEntries(3)),
    ];
    // Search
    const results = semanticSearch.search(query, allEntries, topK || 10);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
/**
 * Search by tags
 */
app.post("/search/tags", async (req, res) => {
  try {
    const { tags } = req.body;
    if (!tags || !Array.isArray(tags)) {
      res.status(400).json({ success: false, error: "Tags array required" });
      return;
    }
    const entries = await memoryLayer.searchByTags(tags);
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
/**
 * Trigger consolidation manually
 */
app.post("/consolidate", async (req, res) => {
  try {
    await consolidationScheduler.runConsolidation();
    res.json({ success: true, message: "Consolidation triggered" });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
/**
 * Promote entry to Layer 3
 */
app.post("/memory/:id/promote", async (req, res) => {
  try {
    const { id } = req.params;
    // Find entry in Layer 2
    const layer2Entries = await memoryLayer.getLayerEntries(2);
    const entry = layer2Entries.find((e) => e.id === id);
    if (!entry) {
      res.status(404).json({ success: false, error: "Entry not found in Layer 2" });
      return;
    }
    const promoted = await memoryLayer.promoteToLayer3(entry);
    res.json({ success: true, data: promoted });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
/**
 * Get memory statistics
 */
app.get("/stats", async (req, res) => {
  try {
    const stats = await memoryLayer.getStats();
    res.json({ success: true, data: stats });
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
    console.log("Starting Noosphere Service...");
    console.log(`Workspace: ${WORKSPACE_BASE}`);
    console.log(`Agent: ${AGENT_NAME}`);
    // Start consolidation scheduler
    consolidationScheduler.start();
    app.listen(PORT, () => {
      console.log(`Noosphere Service listening on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Search: POST http://localhost:${PORT}/search`);
    });
  } catch (error) {
    console.error("Failed to start Noosphere Service:", error);
    process.exit(1);
  }
}
// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  consolidationScheduler.stop();
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down...");
  consolidationScheduler.stop();
  process.exit(0);
});
// Start service
start();
//# sourceMappingURL=index.js.map
