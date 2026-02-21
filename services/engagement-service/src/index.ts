/**
 * Engagement Service
 * Intelligent response handlers for mentions, comments, DMs, welcomes
 */

import express, { type Request, type Response } from 'express';
import type { BaseEvent } from './types';
import { AgentRouter } from './routing/AgentRouter.js';
import { MentionHandler } from './handlers/MentionHandler.js';
import { WelcomeHandler } from './handlers/WelcomeHandler.js';

const app = express();
app.use(express.json());

// Environment configuration
const PORT = parseInt(process.env.ENGAGEMENT_SERVICE_PORT || '3009', 10);
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY || '';
const MOLTBOOK_BASE_URL = process.env.MOLTBOOK_BASE_URL || 'https://www.moltbook.com';
const AI_GENERATOR_URL = process.env.AI_GENERATOR_URL || 'http://localhost:3002';
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3006';

// Create router
const router = new AgentRouter('contextual');

// Create handlers
const mentionHandler = new MentionHandler(
  {
    moltbookApiKey: MOLTBOOK_API_KEY,
    moltbookBaseUrl: MOLTBOOK_BASE_URL,
    aiGeneratorUrl: AI_GENERATOR_URL,
    orchestratorUrl: ORCHESTRATOR_URL,
  },
  router
);

const welcomeHandler = new WelcomeHandler({
  moltbookApiKey: MOLTBOOK_API_KEY,
  moltbookBaseUrl: MOLTBOOK_BASE_URL,
  aiGeneratorUrl: AI_GENERATOR_URL,
});

// Wire up handler events
mentionHandler.on('responded', (data) => {
  console.log(`[EngagementService] ✓ Mention response posted by ${data.agent}`);
});

mentionHandler.on('error', (data) => {
  console.error('[EngagementService] Mention handler error:', data.error);
});

welcomeHandler.on('welcomed', (data) => {
  console.log(`[EngagementService] ✓ Welcomed @${data.payload.username}`);
});

welcomeHandler.on('error', (data) => {
  console.error('[EngagementService] Welcome handler error:', data.error);
});

// Routes

/**
 * Health check
 */
app.get('/health', (req: Request, res: Response) => {
  const mentionStats = mentionHandler.getStats();
  const welcomeStats = welcomeHandler.getStats();

  res.json({
    status: 'healthy',
    service: 'engagement-service',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    stats: {
      mentions: mentionStats,
      welcomes: welcomeStats,
    },
  });
});

/**
 * Handle engagement events
 */
app.post('/events', async (req: Request, res: Response) => {
  try {
    const event = req.body as BaseEvent;

    // Route to appropriate handler
    switch (event.type) {
      case 'mention.received':
        mentionHandler.handle(event).catch((error) => {
          console.error('[EngagementService] Mention handler error:', error);
        });
        break;

      case 'user.new':
        welcomeHandler.handle(event).catch((error) => {
          console.error('[EngagementService] Welcome handler error:', error);
        });
        break;

      case 'comment.received':
      case 'dm.received':
        // TODO: Implement comment and DM handlers
        console.log(`[EngagementService] ${event.type} - handler not yet implemented`);
        break;

      default:
        console.warn(`[EngagementService] Unknown event type: ${event.type}`);
    }

    res.json({
      success: true,
      message: 'Event accepted',
    });
  } catch (error) {
    console.error('[EngagementService] Event processing error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get service statistics
 */
app.get('/stats', (req: Request, res: Response) => {
  const mentionStats = mentionHandler.getStats();
  const welcomeStats = welcomeHandler.getStats();

  res.json({
    mentions: mentionStats,
    welcomes: welcomeStats,
  });
});

// Start service
async function start() {
  try {
    console.log('Starting Engagement Service...');
    console.log(`Moltbook API: ${MOLTBOOK_BASE_URL}`);
    console.log(`AI Generator: ${AI_GENERATOR_URL}`);
    console.log(`Orchestrator: ${ORCHESTRATOR_URL}`);
    console.log(`Routing strategy: contextual`);

    app.listen(PORT, () => {
      console.log(`Engagement Service listening on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Stats: http://localhost:${PORT}/stats`);
    });
  } catch (error) {
    console.error('Failed to start Engagement Service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  process.exit(0);
});

// Start service
start();
