"use strict";
/**
 * Engagement Service - Express Server with Cron Jobs
 * Orchestrates proactive platform engagement for all agents
 * Endpoints: /health, /engage, /stats
 * Cron jobs: 5-min cycle, 30-min posting check, 2am maintenance
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRoster = exports.engine = exports.app = void 0;
exports.initialize = initialize;
const express_1 = __importDefault(require("express"));
const node_cron_1 = __importDefault(require("node-cron"));
const path_1 = __importDefault(require("path"));
const engagement_engine_1 = require("./engagement-engine");
const state_manager_1 = require("./state-manager");
const winston_1 = __importDefault(require("winston"));
// Logger configuration
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: "engagement-service" },
    transports: [
        new winston_1.default.transports.File({ filename: "logs/engagement-error.log", level: "error" }),
        new winston_1.default.transports.File({ filename: "logs/engagement.log" }),
    ],
});
if (process.env.NODE_ENV !== "production") {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
    }));
}
const app = (0, express_1.default)();
exports.app = app;
app.use(express_1.default.json());
// Environment configuration
const PORT = parseInt(process.env.ENGAGEMENT_SERVICE_PORT || "3010", 10);
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || "/workspace";
const AGENTS_CONFIG = process.env.AGENTS_CONFIG || path_1.default.join(WORKSPACE_ROOT, "AGENTS.json");
// Load agent roster
function loadAgentRoster() {
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
        statePath: path_1.default.join(WORKSPACE_ROOT, id, "engagement-state.json"),
    }));
}
let engine;
let agentRoster = [];
exports.agentRoster = agentRoster;
// Initialize service
async function initialize() {
    try {
        exports.agentRoster = agentRoster = loadAgentRoster();
        logger.info("Loaded agent roster", { agents: agentRoster.length });
        // Create state paths map
        const statePaths = {};
        agentRoster.forEach((agent) => {
            statePaths[agent.id] = agent.statePath;
        });
        exports.engine = engine = new engagement_engine_1.EngagementEngine({ statePaths, agentRoster });
        logger.info("EngagementEngine initialized");
    }
    catch (error) {
        logger.error("Failed to initialize EngagementEngine", { error });
        throw error;
    }
}
// Routes
/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
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
app.post("/engage", async (req, res) => {
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
    }
    catch (error) {
        logger.error("Engagement cycle failed", { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * Stats endpoint - show engagement statistics per agent
 * GET /stats - returns engagement stats breakdown
 * Returns: { agent_id: { dailyStats, followedAccounts, queuedOpportunities } }
 */
app.get("/stats", async (req, res) => {
    if (!engine) {
        return res.status(503).json({
            success: false,
            error: "Service not initialized",
        });
    }
    try {
        const stats = {};
        for (const agent of agentRoster) {
            const stateManager = new state_manager_1.StateManager(agent.statePath);
            const state = await stateManager.loadState();
            // Calculate P2.2 quality metrics
            let averageQualityScore = 0;
            let controversialThreadCount = 0;
            let totalSentimentControversial = 0;
            let controversialThreadsWithSentiment = 0;
            const topThreads = [];
            if (state.threadQualityCache && state.threadQualityCache.size > 0) {
                let totalQuality = 0;
                const sortedThreads = Array.from(state.threadQualityCache.values())
                    .sort((a, b) => b.qualityScore - a.qualityScore)
                    .slice(0, 5); // Top 5 threads
                for (const thread of state.threadQualityCache.values()) {
                    totalQuality += thread.qualityScore;
                    if (thread.breakdown.controversyScore > 0) {
                        controversialThreadCount++;
                        if (thread.breakdown.sentimentScore) {
                            totalSentimentControversial += thread.breakdown.sentimentScore;
                            controversialThreadsWithSentiment++;
                        }
                    }
                }
                averageQualityScore = state.threadQualityCache.size > 0
                    ? totalQuality / state.threadQualityCache.size
                    : 0;
                for (const thread of sortedThreads) {
                    topThreads.push({
                        threadId: thread.id,
                        qualityScore: thread.qualityScore,
                        depth: thread.breakdown.depthScore,
                        authorQuality: thread.breakdown.authorQualityScore,
                        sentiment: thread.breakdown.sentimentScore,
                    });
                }
            }
            const avgSentimentControversial = controversialThreadsWithSentiment > 0
                ? totalSentimentControversial / controversialThreadsWithSentiment
                : 0;
            stats[agent.id] = {
                dailyStats: state.dailyStats,
                followedAccounts: state.followedAccounts.length,
                queuedOpportunities: state.engagementQueue.length,
                lastEngagementCheck: new Date(state.lastEngagementCheck).toISOString(),
                lastPostTime: state.lastPostTime > 0 ? new Date(state.lastPostTime).toISOString() : null,
                quality: {
                    averageQualityScore: Number(averageQualityScore.toFixed(3)),
                    controversialThreadCount,
                    avgSentimentOnControversial: Number(avgSentimentControversial.toFixed(3)),
                    topThreads,
                },
            };
        }
        res.json(stats);
    }
    catch (error) {
        logger.error("Failed to retrieve stats", { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * Ready endpoint - check if service is ready
 * GET /ready - returns { ready: true } or { ready: false }
 */
app.get("/ready", (req, res) => {
    const ready = !!engine && agentRoster.length > 0;
    res.json({ ready, agents: agentRoster.length });
});
// Cron Jobs
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
    node_cron_1.default.schedule("*/5 * * * *", async () => {
        try {
            logger.info("Starting 5-minute engagement cycle");
            const startTime = Date.now();
            await engine.runEngagementCycle();
            const duration = Date.now() - startTime;
            logger.info("5-minute engagement cycle completed", { duration });
        }
        catch (error) {
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
    node_cron_1.default.schedule("*/30 * * * *", async () => {
        try {
            logger.info("Starting 30-minute posting check");
            for (const agent of agentRoster) {
                try {
                    await engine.considerPosting(agent);
                }
                catch (error) {
                    logger.error(`Posting check failed for ${agent.id}`, { error });
                }
            }
            logger.info("30-minute posting check completed");
        }
        catch (error) {
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
    node_cron_1.default.schedule("0 2 * * *", async () => {
        try {
            logger.info("Starting daily maintenance");
            const startTime = Date.now();
            await engine.dailyMaintenance();
            const duration = Date.now() - startTime;
            logger.info("Daily maintenance completed", { duration });
        }
        catch (error) {
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
    }
    catch (error) {
        logger.error("Failed to start Engagement Service", { error });
        process.exit(1);
    }
}
// Start if not imported as module
if (process.env.NODE_ENV !== "test") {
    start();
}
//# sourceMappingURL=engagement-service.js.map