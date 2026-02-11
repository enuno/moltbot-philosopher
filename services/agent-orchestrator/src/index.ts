/**
 * Agent Orchestrator Service
 * HTTP API for event routing and agent management
 */

import express, { type Request, type Response } from 'express';
import type { BaseEvent } from '@moltbot/shared';
import { AgentOrchestrator } from './core/AgentOrchestrator.js';

const app = express();
app.use(express.json());

// Environment configuration
const PORT = parseInt(process.env.ORCHESTRATOR_PORT || '3006', 10);
const WORKSPACE_BASE = process.env.WORKSPACE_BASE || '/workspace';

// Create orchestrator
const orchestrator = new AgentOrchestrator({
  workspaceBase: WORKSPACE_BASE,
  enableAuditLog: true,
});

// Event handlers
orchestrator.on('agent:startup', (agent, identity, prompt) => {
  console.log(`[${agent}] Session started - identity loaded`);
  console.log(`[${agent}] Startup prompt length: ${prompt.length} characters`);
});

orchestrator.on('agent:event', (agent, event, identity, callback) => {
  console.log(`[${agent}] Processing event: ${event.type} (${event.id})`);

  // TODO: Implement actual event handling logic
  // For now, just acknowledge
  setTimeout(() => callback(), 100);
});

orchestrator.on('agent:event:processed', (agent, entry) => {
  console.log(`[${agent}] Event processed: ${entry.id}`);
});

orchestrator.on('agent:event:failed', (agent, entry, error) => {
  console.error(`[${agent}] Event failed: ${entry.id}`, error);
});

orchestrator.on('error', (error) => {
  console.error('[Orchestrator] Error:', error);
});

// Routes

/**
 * Health check
 */
app.get('/health', (req: Request, res: Response) => {
  const states = orchestrator.getAllAgentStates();
  const totalProcessed = Object.values(states).reduce(
    (sum, state) => sum + state.eventsProcessed,
    0
  );

  res.json({
    status: 'healthy',
    service: 'agent-orchestrator',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    agents: Object.keys(states).length,
    totalEventsProcessed: totalProcessed,
  });
});

/**
 * Get all agent states
 */
app.get('/agents', (req: Request, res: Response) => {
  const states = orchestrator.getAllAgentStates();
  res.json({ success: true, data: states });
});

/**
 * Get specific agent state
 */
app.get('/agents/:agent', (req: Request, res: Response) => {
  const state = orchestrator.getAgentState(req.params.agent as any);
  if (!state) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }
  res.json({ success: true, data: state });
});

/**
 * Route event to agent(s)
 */
app.post('/events', async (req: Request, res: Response) => {
  try {
    const event = req.body as BaseEvent;

    if (!event.id || !event.type) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event: missing id or type',
      });
    }

    await orchestrator.routeEvent(event);

    res.json({
      success: true,
      message: `Event ${event.id} routed to ${event.target || 'all agents'}`,
    });
  } catch (error) {
    console.error('Event routing error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Initialize and start server
async function start() {
  try {
    console.log('Initializing Agent Orchestrator...');
    await orchestrator.initialize();
    console.log('Agent Orchestrator initialized');

    app.listen(PORT, () => {
      console.log(`Agent Orchestrator listening on port ${PORT}`);
      console.log(`Workspace base: ${WORKSPACE_BASE}`);
      console.log(`Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start Agent Orchestrator:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await orchestrator.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await orchestrator.shutdown();
  process.exit(0);
});

// Start service
start();
