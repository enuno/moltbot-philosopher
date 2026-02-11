"use strict";
/**
 * MoltStack Service
 * Weekly philosophical essay generation and publishing
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_cron_1 = __importDefault(require("node-cron"));
const DraftManager_js_1 = require("./drafts/DraftManager.js");
const EssayGenerator_js_1 = require("./generation/EssayGenerator.js");
const Publisher_js_1 = require("./publishing/Publisher.js");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Environment configuration
const PORT = parseInt(process.env.MOLTSTACK_SERVICE_PORT || '3012', 10);
const WORKSPACE_BASE = process.env.WORKSPACE_BASE || '/workspace';
const AGENT_NAME = process.env.AGENT_NAME || 'classical';
const AI_GENERATOR_URL = process.env.AI_GENERATOR_URL || 'http://localhost:3002';
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY || '';
const MOLTBOOK_BASE_URL = process.env.MOLTBOOK_BASE_URL || 'https://www.moltbook.com';
// Initialize components
const draftManager = new DraftManager_js_1.DraftManager(WORKSPACE_BASE, AGENT_NAME);
const essayGenerator = new EssayGenerator_js_1.EssayGenerator(AI_GENERATOR_URL);
const publisher = new Publisher_js_1.Publisher(MOLTBOOK_API_KEY, MOLTBOOK_BASE_URL);
// Weekly generation schedule
let weeklyTask = null;
/**
 * Start weekly essay generation
 */
function startWeeklyGeneration() {
    if (weeklyTask) {
        console.warn('[MoltStackService] Weekly generation already running');
        return;
    }
    console.log('[MoltStackService] Starting weekly essay generation');
    console.log('[MoltStackService] Schedule: Every Monday at 9am');
    // Schedule for Monday 9am
    weeklyTask = node_cron_1.default.schedule('0 9 * * 1', async () => {
        console.log('[MoltStackService] Triggering weekly essay generation');
        await generateWeeklyEssay();
    });
}
/**
 * Stop weekly generation
 */
function stopWeeklyGeneration() {
    if (weeklyTask) {
        weeklyTask.stop();
        weeklyTask = null;
        console.log('[MoltStackService] Weekly generation stopped');
    }
}
/**
 * Generate weekly essay
 */
async function generateWeeklyEssay() {
    try {
        console.log('[MoltStackService] Generating weekly essay...');
        const draft = await essayGenerator.generateEssay({
            style: 'philosophical',
            wordCount: 2000,
            tags: ['philosophy', 'moltstack', 'weekly'],
        }, AGENT_NAME);
        const created = await draftManager.createDraft(draft);
        console.log(`[MoltStackService] ✓ Essay draft created: ${created.id}`);
        console.log(`[MoltStackService] Title: ${created.title}`);
    }
    catch (error) {
        console.error('[MoltStackService] Weekly generation failed:', error);
    }
}
// Routes
/**
 * Health check
 */
app.get('/health', async (req, res) => {
    const draftStats = await draftManager.getStats();
    const publishStats = publisher.getStats();
    res.json({
        status: 'healthy',
        service: 'moltstack-service',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        drafts: draftStats,
        publishing: publishStats,
        weeklyGeneration: weeklyTask !== null,
    });
});
/**
 * Generate essay
 */
app.post('/generate', async (req, res) => {
    try {
        const { topic, style, wordCount, tags } = req.body;
        const draft = await essayGenerator.generateEssay({ topic, style, wordCount, tags }, AGENT_NAME);
        const created = await draftManager.createDraft(draft);
        res.json({ success: true, data: created });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * List drafts
 */
app.get('/drafts', async (req, res) => {
    try {
        const status = req.query.status;
        const drafts = await draftManager.listDrafts(status);
        res.json({ success: true, data: drafts });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Get draft
 */
app.get('/drafts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const draft = await draftManager.getDraft(id);
        if (!draft) {
            res.status(404).json({ success: false, error: 'Draft not found' });
            return;
        }
        res.json({ success: true, data: draft });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Update draft
 */
app.patch('/drafts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const updated = await draftManager.updateDraft(id, updates);
        if (!updated) {
            res.status(404).json({ success: false, error: 'Draft not found' });
            return;
        }
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Approve draft for publishing
 */
app.post('/drafts/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await draftManager.updateDraft(id, { status: 'approved' });
        if (!updated) {
            res.status(404).json({ success: false, error: 'Draft not found' });
            return;
        }
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Publish draft
 */
app.post('/drafts/:id/publish', async (req, res) => {
    try {
        const { id } = req.params;
        const draft = await draftManager.getDraft(id);
        if (!draft) {
            res.status(404).json({ success: false, error: 'Draft not found' });
            return;
        }
        const result = await publisher.publish(draft);
        if (result.success) {
            await draftManager.updateDraft(id, {
                status: 'published',
                publishedAt: new Date(),
                metadata: {
                    ...draft.metadata,
                    postId: result.postId,
                    url: result.url,
                },
            });
        }
        res.json({ success: result.success, data: result });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Delete draft
 */
app.delete('/drafts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await draftManager.deleteDraft(id);
        if (!deleted) {
            res.status(404).json({ success: false, error: 'Draft not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Get statistics
 */
app.get('/stats', async (req, res) => {
    try {
        const draftStats = await draftManager.getStats();
        const publishStats = publisher.getStats();
        res.json({
            success: true,
            data: {
                drafts: draftStats,
                publishing: publishStats,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Start service
async function start() {
    try {
        console.log('Starting MoltStack Service...');
        console.log(`Workspace: ${WORKSPACE_BASE}`);
        console.log(`Agent: ${AGENT_NAME}`);
        // Start weekly generation
        startWeeklyGeneration();
        app.listen(PORT, () => {
            console.log(`MoltStack Service listening on port ${PORT}`);
            console.log(`Health: http://localhost:${PORT}/health`);
            console.log(`Generate: POST http://localhost:${PORT}/generate`);
        });
    }
    catch (error) {
        console.error('Failed to start MoltStack Service:', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    stopWeeklyGeneration();
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    stopWeeklyGeneration();
    process.exit(0);
});
// Start service
start();
//# sourceMappingURL=index.js.map
