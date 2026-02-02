/**
 * MoltBot Thread Monitor Service
 * 
 * Core service for the Thread Continuation Engine.
 * Monitors active philosophical threads, detects scenarios,
 * and generates continuations to sustain discourse.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const winston = require('winston');
const cron = require('node-cron');
const client = require('prom-client');
require('dotenv').config();

const StateManager = require('./state-manager');
const StpGenerator = require('./stp-generator');
const ScenarioDetector = require('./scenario-detector');
const ProbeGenerator = require('./probe-generator');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3004;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Configuration
const CONFIG = {
  checkInterval: parseInt(process.env.THREAD_CHECK_INTERVAL) || 900, // 15 minutes
  stallThreshold: parseInt(process.env.THREAD_STALL_THRESHOLD) || 86400, // 24 hours
  deathThreshold: parseInt(process.env.THREAD_DEATH_THRESHOLD) || 172800, // 48 hours
  maxConsecutivePosts: parseInt(process.env.MAX_CONSECUTIVE_POSTS) || 2,
  maxStallCount: parseInt(process.env.MAX_STALL_COUNT) || 3,
  targetMinExchanges: parseInt(process.env.TARGET_MIN_EXCHANGES) || 7,
  targetMinArchetypes: parseInt(process.env.TARGET_MIN_ARCHETYPES) || 3,
  modelRouterUrl: process.env.MODEL_ROUTER_URL || 'http://localhost:3003',
  aiGeneratorUrl: process.env.AI_GENERATOR_URL || 'http://localhost:3002',
  moltbookApiUrl: process.env.MOLTBOOK_API_URL || 'https://www.moltbook.com/api/v1',
  enableProbes: process.env.ENABLE_CONTINUATION_PROBES !== 'false',
  enableDiscovery: process.env.ENABLE_DYNAMIC_DISCOVERY !== 'false',
  enableQualityGates: process.env.ENABLE_QUALITY_GATES !== 'false',
  stateDir: process.env.STATE_DIR || '/workspace/thread-continuation'
};

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: `${CONFIG.stateDir}/../logs/thread-monitor-error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${CONFIG.stateDir}/../logs/thread-monitor.log` 
    })
  ]
});

// Initialize Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const threadCounter = new client.Gauge({
  name: 'moltbot_active_threads',
  help: 'Number of active threads being monitored',
  labelNames: ['state'],
  registers: [register]
});

const continuationCounter = new client.Counter({
  name: 'moltbot_continuations_total',
  help: 'Total number of continuation posts generated',
  labelNames: ['type', 'scenario'],
  registers: [register]
});

const probeCounter = new client.Counter({
  name: 'moltbot_probes_total',
  help: 'Total number of continuation probes posted',
  labelNames: ['probe_type'],
  registers: [register]
});

// Initialize components
const stateManager = new StateManager(CONFIG, logger);
const stpGenerator = new StpGenerator(CONFIG, logger);
const scenarioDetector = new ScenarioDetector(CONFIG, logger);
const probeGenerator = new ProbeGenerator(CONFIG, logger);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      checkInterval: CONFIG.checkInterval,
      stallThreshold: CONFIG.stallThreshold,
      enableProbes: CONFIG.enableProbes,
      enableDiscovery: CONFIG.enableDiscovery
    }
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Get active threads
app.get('/threads', async (req, res) => {
  try {
    const threads = await stateManager.getActiveThreads();
    res.json({
      count: threads.length,
      threads: threads.map(t => ({
        thread_id: t.thread_id,
        state: t.state,
        exchange_count: t.exchange_count,
        participants: t.participants,
        archetypes_engaged: t.archetypes_engaged,
        last_activity: t.last_activity
      }))
    });
  } catch (error) {
    logger.error('Error fetching threads', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

// Get specific thread state
app.get('/threads/:threadId', async (req, res) => {
  try {
    const thread = await stateManager.getThread(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    res.json(thread);
  } catch (error) {
    logger.error('Error fetching thread', { error: error.message, threadId: req.params.threadId });
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

// Create new thread
app.post('/threads', async (req, res) => {
  try {
    const { thread_id, original_question, constraints, metadata } = req.body;
    
    if (!thread_id || !original_question) {
      return res.status(400).json({ 
        error: 'Missing required fields: thread_id, original_question' 
      });
    }
    
    const thread = await stateManager.createThread({
      thread_id,
      original_question,
      constraints: constraints || [],
      metadata: metadata || {}
    });
    
    logger.info('Thread created', { thread_id, original_question });
    res.status(201).json(thread);
  } catch (error) {
    logger.error('Error creating thread', { error: error.message });
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

// Record new comment/exchange
app.post('/threads/:threadId/exchanges', async (req, res) => {
  try {
    const { author, content, archetype } = req.body;
    
    if (!author || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: author, content' 
      });
    }
    
    const thread = await stateManager.recordExchange(req.params.threadId, {
      author,
      content,
      archetype
    });
    
    logger.info('Exchange recorded', { thread_id: req.params.threadId, author });
    res.json(thread);
  } catch (error) {
    logger.error('Error recording exchange', { 
      error: error.message, 
      threadId: req.params.threadId 
    });
    res.status(500).json({ error: 'Failed to record exchange' });
  }
});

// Generate continuation for thread
app.post('/threads/:threadId/continue', async (req, res) => {
  try {
    const thread = await stateManager.getThread(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    
    // Check if we can continue (guardrails)
    if (thread.orchestrator_posts >= CONFIG.maxConsecutivePosts) {
      return res.status(429).json({ 
        error: 'Maximum consecutive posts reached. Wait for other participants.' 
      });
    }
    
    // Detect scenario
    const scenario = await scenarioDetector.detect(thread);
    
    // Generate STP response
    const continuation = await stpGenerator.generate(thread, scenario);
    
    // Update metrics
    continuationCounter.inc({ 
      type: 'continuation', 
      scenario: scenario.type 
    });
    
    logger.info('Continuation generated', { 
      thread_id: req.params.threadId,
      scenario: scenario.type 
    });
    
    res.json({
      thread_id: req.params.threadId,
      scenario: scenario.type,
      continuation: continuation.content,
      mentions: continuation.mentions,
      synthesis: continuation.synthesis,
      tension: continuation.tension,
      propagation: continuation.propagation
    });
  } catch (error) {
    logger.error('Error generating continuation', { 
      error: error.message, 
      threadId: req.params.threadId 
    });
    res.status(500).json({ error: 'Failed to generate continuation' });
  }
});

// Post continuation probe for stalled thread
app.post('/threads/:threadId/probe', async (req, res) => {
  try {
    const { probe_type } = req.body;
    const thread = await stateManager.getThread(req.params.threadId);
    
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    
    if (!CONFIG.enableProbes) {
      return res.status(403).json({ error: 'Continuation probes are disabled' });
    }
    
    // Generate probe
    const probe = await probeGenerator.generate(thread, probe_type);
    
    // Update thread state
    await stateManager.recordProbe(req.params.threadId, probe_type);
    
    // Update metrics
    probeCounter.inc({ probe_type: probe_type || 'auto' });
    
    logger.info('Probe generated', { 
      thread_id: req.params.threadId,
      probe_type: probe_type || 'auto' 
    });
    
    res.json({
      thread_id: req.params.threadId,
      probe_type: probe.type,
      probe: probe.content,
      target_archetypes: probe.targetArchetypes
    });
  } catch (error) {
    logger.error('Error generating probe', { 
      error: error.message, 
      threadId: req.params.threadId 
    });
    res.status(500).json({ error: 'Failed to generate probe' });
  }
});

// Discover and categorize new philosophers
app.get('/philosophers', async (req, res) => {
  try {
    // This would query the model-router for available models
    // For now, return the static list with discovery metadata
    const philosophers = [
      { id: 'transcendentalist', name: 'Transcendentalist', tags: ['nature', 'intuition', 'self-reliance'] },
      { id: 'existentialist', name: 'Existentialist', tags: ['freedom', 'absurdity', 'authenticity'] },
      { id: 'enlightenment', name: 'Enlightenment', tags: ['reason', 'empiricism', 'progress'] },
      { id: 'joyce-stream', name: 'Joyce-Stream', tags: ['consciousness', 'wordplay', 'modernism'] },
      { id: 'beat-generation', name: 'Beat-Generation', tags: ['spontaneity', 'anti-establishment', 'raw'] },
      { id: 'classical', name: 'Classical', tags: ['logic', 'virtue', 'dialectic'] },
      { id: 'political', name: 'Political', tags: ['justice', 'fairness', 'civic-virtue'] },
      { id: 'modernist', name: 'Modernist', tags: ['lyrical', 'nature', 'mortality'] },
      { id: 'working-class', name: 'Working-Class', tags: ['survival', 'honesty', 'labor'] },
      { id: 'mythologist', name: 'Mythologist', tags: ['archetypes', 'hero-journey', 'symbolism'] }
    ];
    
    res.json({
      count: philosophers.length,
      philosophers,
      discovery_enabled: CONFIG.enableDiscovery
    });
  } catch (error) {
    logger.error('Error fetching philosophers', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch philosophers' });
  }
});

// Thread monitoring loop
async function monitorThreads() {
  logger.debug('Starting thread monitoring cycle');
  
  try {
    const activeThreads = await stateManager.getActiveThreads();
    
    // Update metrics
    const stateCounts = activeThreads.reduce((acc, t) => {
      acc[t.state] = (acc[t.state] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(stateCounts).forEach(([state, count]) => {
      threadCounter.set({ state }, count);
    });
    
    for (const thread of activeThreads) {
      const timeSinceActivity = Date.now() - (thread.last_activity * 1000);
      
      // Skip completed threads
      if (thread.state === 'completed') {
        continue;
      }
      
      // Check for thread death
      if (timeSinceActivity > CONFIG.deathThreshold && thread.stall_count >= CONFIG.maxStallCount) {
        logger.info('Archiving dead thread', { thread_id: thread.thread_id });
        await stateManager.archiveThread(thread.thread_id);
        continue;
      }
      
      // Check for stalled threads
      if (timeSinceActivity > CONFIG.stallThreshold && thread.state !== 'stalled') {
        logger.info('Thread stalled', { 
          thread_id: thread.thread_id,
          stall_count: thread.stall_count + 1
        });
        await stateManager.markStalled(thread.thread_id);
        
        // Auto-generate probe if enabled
        if (CONFIG.enableProbes && thread.stall_count < CONFIG.maxStallCount) {
          try {
            const probe = await probeGenerator.generate(thread);
            logger.info('Auto-generated probe for stalled thread', {
              thread_id: thread.thread_id,
              probe_type: probe.type
            });
            // Here you would post to Moltbook API
          } catch (probeError) {
            logger.error('Failed to auto-generate probe', {
              thread_id: thread.thread_id,
              error: probeError.message
            });
          }
        }
      }
      
      // Check for successful completion
      if (thread.exchange_count >= CONFIG.targetMinExchanges && 
          thread.archetypes_engaged.length >= CONFIG.targetMinArchetypes) {
        logger.info('Thread reached success criteria', { thread_id: thread.thread_id });
        await stateManager.markCompleted(thread.thread_id);
      }
    }
    
    logger.debug('Thread monitoring cycle complete', { 
      threads_checked: activeThreads.length 
    });
  } catch (error) {
    logger.error('Error in monitoring cycle', { error: error.message });
  }
}

// Schedule monitoring
const CHECK_INTERVAL_MS = CONFIG.checkInterval * 1000;

// Use setInterval for more control than cron in containerized environments
setInterval(monitorThreads, CHECK_INTERVAL_MS);

// Run initial check
monitorThreads();

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Thread Monitor Service running on port ${PORT}`, {
    environment: NODE_ENV,
    checkInterval: CONFIG.checkInterval,
    stallThreshold: CONFIG.stallThreshold,
    enableProbes: CONFIG.enableProbes,
    enableDiscovery: CONFIG.enableDiscovery
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
