/**
 * Event Listener Service
 * Polls Moltbook API and dispatches events to Agent Orchestrator
 */

import express, { type Request, type Response } from 'express';
import type { BaseEvent } from '@moltbot/shared';
import { VerificationPoller } from './polling/VerificationPoller.js';
import { EngagementPoller } from './polling/EngagementPoller.js';
import { EventDispatcher } from './dispatch/EventDispatcher.js';

const app = express();
app.use(express.json());

// Environment configuration
const PORT = parseInt(process.env.EVENT_LISTENER_PORT || '3007', 10);
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY || '';
const MOLTBOOK_BASE_URL = process.env.MOLTBOOK_BASE_URL || 'https://www.moltbook.com';
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3006';

// Polling intervals
const VERIFICATION_INTERVAL_MS = 60 * 1000; // 60 seconds
const ENGAGEMENT_INTERVAL_MS = 30 * 1000;   // 30 seconds

// Create pollers
const verificationPoller = new VerificationPoller({
  apiKey: MOLTBOOK_API_KEY,
  baseUrl: MOLTBOOK_BASE_URL,
  pollIntervalMs: VERIFICATION_INTERVAL_MS,
});

const engagementPoller = new EngagementPoller({
  apiKey: MOLTBOOK_API_KEY,
  baseUrl: MOLTBOOK_BASE_URL,
  pollIntervalMs: ENGAGEMENT_INTERVAL_MS,
});

// Create dispatcher
const dispatcher = new EventDispatcher({
  orchestratorUrl: ORCHESTRATOR_URL,
  retryAttempts: 3,
  retryDelayMs: 1000,
});

// Wire up pollers to dispatcher
verificationPoller.on('challenge', async (event) => {
  try {
    await dispatcher.dispatch(event);
  } catch (error) {
    console.error('[EventListener] Failed to dispatch verification challenge:', error);
  }
});

engagementPoller.on('mention', async (event: BaseEvent) => {
  try {
    await dispatcher.dispatch(event);
  } catch (error) {
    console.error('[EventListener] Failed to dispatch mention:', error);
  }
});

engagementPoller.on('comment', async (event: BaseEvent) => {
  try {
    await dispatcher.dispatch(event);
  } catch (error) {
    console.error('[EventListener] Failed to dispatch comment:', error);
  }
});

engagementPoller.on('dm', async (event: BaseEvent) => {
  try {
    await dispatcher.dispatch(event);
  } catch (error) {
    console.error('[EventListener] Failed to dispatch DM:', error);
  }
});

engagementPoller.on('newUser', async (event: BaseEvent) => {
  try {
    await dispatcher.dispatch(event);
  } catch (error) {
    console.error('[EventListener] Failed to dispatch new user:', error);
  }
});

// Dispatcher events
dispatcher.on('dispatched', (event) => {
  console.log(`[EventListener] ✓ Dispatched ${event.type}`);
});

dispatcher.on('failed', (event, error) => {
  console.error(`[EventListener] ✗ Failed to dispatch ${event.type}:`, error);
});

// Routes

/**
 * Health check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'event-listener',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    pollers: {
      verification: {
        active: verificationPoller.isActive(),
        lastCheck: verificationPoller.getLastCheckTime(),
        intervalMs: VERIFICATION_INTERVAL_MS,
      },
      engagement: {
        active: engagementPoller.isActive(),
        lastCheck: engagementPoller.getLastCheckTime(),
        intervalMs: ENGAGEMENT_INTERVAL_MS,
      },
    },
  });
});

/**
 * Start pollers manually (for testing)
 */
app.post('/pollers/start', (req: Request, res: Response) => {
  verificationPoller.start();
  engagementPoller.start();
  res.json({ success: true, message: 'Pollers started' });
});

/**
 * Stop pollers manually (for testing)
 */
app.post('/pollers/stop', (req: Request, res: Response) => {
  verificationPoller.stop();
  engagementPoller.stop();
  res.json({ success: true, message: 'Pollers stopped' });
});

// Start service
async function start() {
  try {
    console.log('Starting Event Listener Service...');
    console.log(`Moltbook API: ${MOLTBOOK_BASE_URL}`);
    console.log(`Orchestrator: ${ORCHESTRATOR_URL}`);

    // Start pollers
    verificationPoller.start();
    engagementPoller.start();

    app.listen(PORT, () => {
      console.log(`Event Listener listening on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Verification polling: ${VERIFICATION_INTERVAL_MS}ms`);
      console.log(`Engagement polling: ${ENGAGEMENT_INTERVAL_MS}ms`);
    });
  } catch (error) {
    console.error('Failed to start Event Listener:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  verificationPoller.stop();
  engagementPoller.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  verificationPoller.stop();
  engagementPoller.stop();
  process.exit(0);
});

// Start service
start();
