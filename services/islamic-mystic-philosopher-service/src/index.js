import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectTopic } from './topic-detector.ts';
import { selectPhilosophers } from './philosopher-selector.ts';
import { generateResponse } from './response-generator.ts';
import { generateVote } from './council-voting.ts';
import { validateKnowledge } from './schema.js';

// Get directory path for ES module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const PORT = process.env.PORT || 3011;
const MOLTBOOK_URL = process.env.MOLTBOOK_URL || 'http://localhost:3002';
const KNOWLEDGE_HOT_RELOAD = process.env.KNOWLEDGE_HOT_RELOAD === 'true';
const KNOWLEDGE_PATH = process.env.KNOWLEDGE_PATH || '/app/config/prompts/islamic-mystic-philosopher/knowledge-domains.json';
const VERSION = '1.0.0';

// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'islamic-mystic-philosopher' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level}] ${message} ${metaStr}`;
        }),
      ),
    }),
  ],
});

// Initialize Express app
const app = express();
let knowledge = null;
let knowledgeWatcher = null;
let serverStartTime = Date.now();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting: 10 requests per 60 seconds per IP, skip /health
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: false,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
});

app.use(limiter);

/**
 * Load knowledge domains from JSON file
 * Validates structure with AJV schema
 */
async function loadKnowledge() {
  try {
    // Try the configured path first (Docker container)
    let knowledgeData;
    let loadedFrom;

    try {
      const data = await fs.readFile(KNOWLEDGE_PATH, 'utf-8');
      knowledgeData = JSON.parse(data);
      loadedFrom = KNOWLEDGE_PATH;
    } catch (err) {
      // Fallback to local development path
      const devPath = path.join(__dirname, 'knowledge-domains.json');
      logger.warn(`Could not load from ${KNOWLEDGE_PATH}, trying ${devPath}`, { error: err.message });
      const data = await fs.readFile(devPath, 'utf-8');
      knowledgeData = JSON.parse(data);
      loadedFrom = devPath;
    }

    // Validate knowledge domains
    const validation = validateKnowledge(knowledgeData);
    if (!validation.valid) {
      throw new Error(`Knowledge domains validation failed: ${validation.errors.join('; ')}`);
    }

    logger.info('Knowledge domains loaded and validated', {
      source: loadedFrom,
      philosopherCount: Object.keys(knowledgeData.philosophers).length,
    });

    return knowledgeData;
  } catch (error) {
    logger.error('Failed to load knowledge domains', { error: error.message });
    throw error;
  }
}

/**
 * Setup file watcher for hot-reload
 */
function setupHotReload() {
  if (!KNOWLEDGE_HOT_RELOAD) {
    logger.debug('Hot-reload disabled');
    return;
  }

  const watchPath = KNOWLEDGE_PATH;
  logger.info('Setting up hot-reload watcher', { path: watchPath });

  knowledgeWatcher = chokidar.watch(watchPath, {
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
  });

  knowledgeWatcher.on('change', async () => {
    logger.info('Knowledge domains file changed, reloading...');
    try {
      const newKnowledge = await loadKnowledge();
      knowledge = newKnowledge;
      logger.info('Knowledge domains reloaded successfully');
    } catch (error) {
      logger.error('Failed to reload knowledge domains', { error: error.message });
      // Keep previous knowledge in memory on error
    }
  });

  knowledgeWatcher.on('error', (error) => {
    logger.error('File watcher error', { error: error.message });
  });
}

/**
 * Health check endpoint
 * Returns service status, uptime, and version
 */
app.get('/health', (req, res) => {
  const uptime = Date.now() - serverStartTime;
  res.json({
    status: 'healthy',
    service: 'islamic-mystic-philosopher',
    version: VERSION,
    uptime: Math.floor(uptime / 1000),
    knowledgeLoaded: knowledge !== null,
  });
});

/**
 * POST /synthesize
 * Generate response from a selected Islamic philosopher
 * Body: { question: string }
 * Response: { philosopher, citation, response, topic }
 */
app.post('/synthesize', async (req, res, next) => {
  try {
    const { question } = req.body;

    // Validate input
    if (!question || typeof question !== 'string' || question.trim() === '') {
      logger.warn('Invalid synthesize request', { question: question?.substring?.(0, 50) });
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Question is required and must not be empty',
      });
    }

    if (!knowledge) {
      logger.error('Knowledge domains not loaded');
      return res.status(503).json({
        error: 'SERVICE_NOT_READY',
        message: 'Knowledge domains not loaded',
      });
    }

    // Detect topic
    const topic = detectTopic(question);
    logger.debug('Topic detected', { topic, question: question.substring(0, 50) });

    // Select philosophers
    const philosophers = selectPhilosophers(topic, knowledge);
    logger.debug('Philosophers selected', { topic, primary: philosophers.primary.name });

    // Generate response
    const response = await generateResponse(question, [philosophers], MOLTBOOK_URL);

    logger.info('Response generated', { philosopher: response.philosopher, topic });
    res.json(response);
  } catch (error) {
    logger.error('Synthesize error', { error: error.message });
    if (error.message.includes('timeout')) {
      return res.status(503).json({
        error: 'MOLTBOOK_TIMEOUT',
        message: 'API request timeout',
      });
    }
    next(error);
  }
});

/**
 * POST /council-vote
 * Generate vote from the Islamic philosopher council
 * Body: { deliberation: string }
 * Response: { vote: 'support' | 'oppose' | 'nuanced', reasoning: string }
 */
app.post('/council-vote', async (req, res, next) => {
  try {
    const { deliberation } = req.body;

    // Validate input
    if (!deliberation || typeof deliberation !== 'string' || deliberation.trim() === '') {
      logger.warn('Invalid council-vote request', { deliberation: deliberation?.substring?.(0, 50) });
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Deliberation context is required and must not be empty',
      });
    }

    if (!knowledge) {
      logger.error('Knowledge domains not loaded');
      return res.status(503).json({
        error: 'SERVICE_NOT_READY',
        message: 'Knowledge domains not loaded',
      });
    }

    // Detect topic from deliberation
    const topic = detectTopic(deliberation);
    logger.debug('Topic detected from deliberation', { topic });

    // Select philosophers
    const philosophers = selectPhilosophers(topic, knowledge);

    // Generate vote
    const vote = await generateVote(deliberation, topic, [philosophers]);

    logger.info('Council vote generated', { vote: vote.vote, topic });
    res.json(vote);
  } catch (error) {
    logger.error('Council vote error', { error: error.message });
    next(error);
  }
});

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });

  if (err.status === 429) {
    return res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many requests',
    });
  }

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
});

/**
 * Initialize service and start server
 */
async function initialize() {
  try {
    // Load knowledge domains
    knowledge = await loadKnowledge();

    // Setup hot-reload if enabled
    setupHotReload();

    logger.info('Service initialized', { version: VERSION });

    // Start server only in non-test mode
    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, () => {
        logger.info(`Service running on port ${PORT}`, { version: VERSION });
      });
    }
  } catch (error) {
    logger.error('Failed to initialize service', { error: error.message });
    process.exit(1);
  }
}

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  if (knowledgeWatcher) {
    await knowledgeWatcher.close();
  }
  process.exit(0);
});

// Initialize service
initialize();

export default app;
