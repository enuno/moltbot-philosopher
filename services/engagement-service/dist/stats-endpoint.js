"use strict";
/**
 * Stats Endpoint Implementation
 * GET /stats - Returns comprehensive engagement metrics and trends
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStatsRouter = createStatsRouter;
exports.updateLastCycleTime = updateLastCycleTime;
exports.setCycleInterval = setCycleInterval;
exports.getServiceState = getServiceState;
const express_1 = require("express");
const stats_builder_1 = require("./stats-builder");
let serviceState = {
    startTime: Date.now(),
    lastCycleTime: Date.now(),
    cycleInterval: 60000, // 60 seconds default
    isStaleness: false,
};
/**
 * Create stats router
 */
function createStatsRouter() {
    const router = (0, express_1.Router)();
    /**
     * GET /stats - Comprehensive engagement metrics
     */
    router.get("/stats", async (req, res) => {
        try {
            // Get agents and state from app context
            const agents = (req.app.locals.agents || []);
            const stateMap = (req.app.locals.stateMap || new Map());
            // Check data freshness (stale if no update for 2x cycle interval)
            const timeSinceLastCycle = Date.now() - serviceState.lastCycleTime;
            const isStale = timeSinceLastCycle > serviceState.cycleInterval * 2;
            // Build service info
            const serviceInfo = {
                status: isStale ? "degraded" : "healthy",
                uptime_seconds: Math.floor((Date.now() - serviceState.startTime) / 1000),
                data_freshness: {
                    last_cycle_at: new Date(serviceState.lastCycleTime).toISOString(),
                    cycle_interval_seconds: Math.floor(serviceState.cycleInterval / 1000),
                    is_stale: isStale,
                },
            };
            // Build stats sections
            const summary = (0, stats_builder_1.buildSummary)(agents, stateMap);
            const trends = (0, stats_builder_1.buildTrends)(stateMap);
            const agentsSection = (0, stats_builder_1.buildAgentsSection)(agents, stateMap);
            const quality = (0, stats_builder_1.buildQualitySection)(stateMap);
            const response = {
                service: serviceInfo,
                summary,
                trends,
                agents: agentsSection,
                quality,
            };
            res.status(200).json(response);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error("Error building stats:", errorMsg);
            res.status(500).json({
                error: "Failed to build stats",
                message: errorMsg,
            });
        }
    });
    /**
     * POST /stats/cycle-complete - Update last cycle time
     * Called by engagement service after each engagement cycle
     */
    router.post("/stats/cycle-complete", (req, res) => {
        serviceState.lastCycleTime = Date.now();
        res.status(200).json({ ok: true });
    });
    /**
     * POST /stats/config - Update cycle interval
     */
    router.post("/stats/config", (req, res) => {
        const { cycleInterval } = req.body;
        if (typeof cycleInterval === "number" && cycleInterval > 0) {
            serviceState.cycleInterval = cycleInterval;
            res.status(200).json({ cycleInterval: serviceState.cycleInterval });
        }
        else {
            res.status(400).json({ error: "Invalid cycleInterval" });
        }
    });
    return router;
}
/**
 * Update service cycle time
 * Call this from the engagement service main loop
 */
function updateLastCycleTime() {
    serviceState.lastCycleTime = Date.now();
}
/**
 * Set cycle interval
 */
function setCycleInterval(ms) {
    if (ms > 0) {
        serviceState.cycleInterval = ms;
    }
}
/**
 * Get current service state
 */
function getServiceState() {
    return { ...serviceState };
}
//# sourceMappingURL=stats-endpoint.js.map