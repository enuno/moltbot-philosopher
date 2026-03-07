import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import winston from 'winston';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: process.env.ENV_FILE_PATH || '/etc/moltbot/config/agents/eastern-bridge.env' });

// ===== CONSTANTS =====
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_PORT = process.env.SERVICE_PORT || 3012;
const SERVICE_NAME = process.env.SERVICE_NAME || 'eastern-bridge-service';

// Resolve knowledge domains path
let KNOWLEDGE_DOMAINS_PATH = process.env.KNOWLEDGE_DOMAINS_PATH;
if (!KNOWLEDGE_DOMAINS_PATH) {
  // Try multiple paths in order:
  // 1. Relative to service root (two levels up from src/)
  // 2. Relative to project root (three levels up from src/)
  // 3. Relative to current working directory (for docker-compose with cwd set)
  // 4. Docker mounted path
  const servicePath = path.join(__dirname, '../../config/prompts/eastern-bridge/knowledge-domains.json');
  const projectPath = path.join(__dirname, '../../../config/prompts/eastern-bridge/knowledge-domains.json');
  const cwdPath = path.join(process.cwd(), 'config/prompts/eastern-bridge/knowledge-domains.json');
  const dockerPath = '/etc/moltbot/config/prompts/eastern-bridge/knowledge-domains.json';

  if (fs.existsSync(servicePath)) {
    KNOWLEDGE_DOMAINS_PATH = servicePath;
  } else if (fs.existsSync(projectPath)) {
    KNOWLEDGE_DOMAINS_PATH = projectPath;
  } else if (fs.existsSync(cwdPath)) {
    KNOWLEDGE_DOMAINS_PATH = cwdPath;
  } else {
    KNOWLEDGE_DOMAINS_PATH = dockerPath;
  }
}
const HOT_RELOAD_ENABLED = process.env.HOT_RELOAD_ENABLED === 'true';
const HOT_RELOAD_DEBOUNCE_MS = parseInt(process.env.HOT_RELOAD_DEBOUNCE_MS || '1000');

// ===== LOGGER SETUP =====
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT === 'json'
    ? winston.format.json()
    : winston.format.simple(),
  transports: [
    new winston.transports.Console(),
  ],
});

// ===== RATE LIMITER =====
// Disable rate limiting in test mode
const shouldLimitRate = process.env.NODE_ENV !== 'test';
const rateLimiter = shouldLimitRate
  ? new RateLimiterMemory({
    points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
    duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000') / 1000,
  })
  : null;

// ===== AJV SCHEMA VALIDATION =====
const ajv = new Ajv();

const knowledgeDomainsSchema = {
  type: 'object',
  properties: {
    version: { type: 'string' },
    layer_1_eastern_traditions: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          core_concepts: { type: 'array' },
          key_texts: { type: 'array' },
          primary_schools: { type: 'array' },
          approaches: { type: 'array' },
        },
        required: ['core_concepts'],
      },
    },
    layer_2_topic_tradition_affinities: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            traditions: { type: 'array' },
            primary: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['traditions', 'primary'],
        },
      },
    },
    layer_3_jungian_frameworks: {
      type: 'object',
    },
  },
  required: ['version', 'layer_1_eastern_traditions', 'layer_2_topic_tradition_affinities'],
};

const validateSchema = ajv.compile(knowledgeDomainsSchema);

// ===== KNOWLEDGE DOMAIN MANAGEMENT =====
let cachedKnowledgeDomains = null;
let hotReloadWatcher = null;

function loadKnowledgeDomainsFromDisk() {
  try {
    const rawData = fs.readFileSync(KNOWLEDGE_DOMAINS_PATH, 'utf-8');
    const parsed = JSON.parse(rawData);

    const valid = validateSchema(parsed);
    if (!valid) {
      const errors = validateSchema.errors;
      throw new Error(`Schema validation failed: ${JSON.stringify(errors)}`);
    }

    logger.info('[eastern-bridge] knowledge domains loaded and validated', {
      path: KNOWLEDGE_DOMAINS_PATH,
      version: parsed.version,
    });

    return parsed;
  } catch (err) {
    logger.error('[eastern-bridge] failed to load knowledge domains', {
      path: KNOWLEDGE_DOMAINS_PATH,
      error: err.message,
    });
    throw err;
  }
}

function initKnowledgeDomains() {
  try {
    cachedKnowledgeDomains = loadKnowledgeDomainsFromDisk();
    logger.info('[eastern-bridge] knowledge domains initialized at startup');
  } catch (err) {
    logger.error('[eastern-bridge] fatal: cannot start without valid knowledge domains', {
      error: err.message,
    });
    process.exit(1);
  }
}

function reloadKnowledgeDomains() {
  try {
    const updated = loadKnowledgeDomainsFromDisk();
    cachedKnowledgeDomains = updated;
    logger.info('[eastern-bridge] hot-reloaded knowledge domains');
  } catch (err) {
    logger.error('[eastern-bridge] hot-reload failed, keeping previous cache', {
      error: err.message,
    });
    // Graceful degradation: keep old cache if validation fails
  }
}

function setupHotReload() {
  if (!HOT_RELOAD_ENABLED) {
    logger.info('[eastern-bridge] hot-reload disabled');
    return;
  }

  // Use chokidar for cross-platform Docker compatibility
  hotReloadWatcher = chokidar.watch(KNOWLEDGE_DOMAINS_PATH, {
    persistent: true,
    ignored: /(^|[\/\\])\.|node_modules/,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: HOT_RELOAD_DEBOUNCE_MS },
  });

  hotReloadWatcher
    .on('change', () => {
      logger.info('[eastern-bridge] knowledge domains file changed, reloading');
      reloadKnowledgeDomains();
    })
    .on('error', (err) => {
      logger.error('[eastern-bridge] hot-reload watcher error', { error: err.message });
    });

  logger.info('[eastern-bridge] hot-reload watcher active', {
    path: KNOWLEDGE_DOMAINS_PATH,
    debounce: HOT_RELOAD_DEBOUNCE_MS,
  });
}

// ===== EXPRESS APP SETUP =====
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting middleware (disabled in test mode)
if (shouldLimitRate) {
  app.use(async (req, res, next) => {
    try {
      const clientIp = req.ip || req.connection.remoteAddress;
      await rateLimiter.consume(clientIp);
      next();
    } catch (err) {
      logger.warn('[eastern-bridge] rate limit exceeded', {
        ip: req.ip,
        endpoint: req.path,
      });
      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Maximum 10 requests per minute.',
        retryAfter: Math.ceil(err.msBeforeNext / 1000),
      });
    }
  });
}

// ===== HELPER FUNCTIONS FOR ENDPOINTS =====

/**
 * Detect topic from question/deliberation text
 * Uses keyword matching to identify which philosophical topic is being discussed
 */
function detectTopic(text) {
  const textLower = text.toLowerCase();

  // Topic keyword mappings
  const topicKeywords = {
    governance: ['govern', 'state', 'power', 'leader', 'authority', 'rule', 'political'],
    non_violence: ['violence', 'harm', 'aggression', 'peace', 'conflict', 'war'],
    virtue: ['virtue', 'character', 'moral', 'cultivat', 'good', 'ethical'],
    consciousness: ['conscious', 'aware', 'mind', 'perception', 'mental'],
    self: ['self', 'identity', 'soul', 'ego', 'person', 'individual'],
    reality: ['reality', 'being', 'existence', 'nature', 'ontolog'],
    knowledge: ['know', 'truth', 'wisdom', 'epistemo', 'reason', 'intuition'],
    aesthetics: ['beauty', 'art', 'aesthetic', 'harmony', 'taste'],
  };

  // Find matching topics
  const matchedTopics = Object.entries(topicKeywords).map(([topic, keywords]) => {
    const matches = keywords.filter(kw => textLower.includes(kw)).length;
    return { topic, matches };
  });

  const bestMatch = matchedTopics.reduce((max, current) =>
    current.matches > max.matches ? current : max
  );

  return bestMatch.matches > 0 ? bestMatch.topic : 'general';
}

/**
 * Select primary and secondary traditions based on topic affinity
 * Returns { primary: string, secondary: string[] }
 */
function selectTraditions(topic) {
  if (!cachedKnowledgeDomains?.layer_2_topic_tradition_affinities?.[topic]) {
    // Default: return balanced set of traditions if topic not found
    return {
      primary: 'hinduism',
      secondary: ['buddhism', 'taoism', 'confucianism', 'jainism', 'shinto'],
    };
  }

  const topicAffinities = cachedKnowledgeDomains.layer_2_topic_tradition_affinities[topic];

  // Find category with highest primary affinity (e.g., metaphysics, ethics)
  const categoryWithAffinities = Object.values(topicAffinities)[0] || {};
  const { primary, traditions } = categoryWithAffinities;

  return {
    primary: primary || 'hinduism',
    secondary: (traditions || []).filter(t => t !== primary),
  };
}

/**
 * Format synthesis response with Eastern tradition as primary voice
 */
function formatSynthesisResponse(question, context, primaryTradition, answer) {
  return {
    question,
    context: context || 'general',
    answer,
    primary_tradition: primaryTradition,
    secondary_traditions: ['buddhism', 'taoism', 'confucianism'].filter(t => t !== primaryTradition),
    western_parallels: {
      jungian_reference: 'bridge',
      note: 'Jungian psychology used for Western comprehension, not as reduction of Eastern spirituality',
    },
  };
}

/**
 * Format council vote response
 */
function formatVoteResponse(deliberation, traditionPerspective, vote, reasoning) {
  return {
    deliberation: deliberation.substring(0, 100) + (deliberation.length > 100 ? '...' : ''),
    vote,
    tradition_perspective: traditionPerspective,
    reasoning,
    council_position: `As the Eastern Bridge, I approach this question through ${traditionPerspective} philosophy. ${reasoning.substring(0, 80)}...`,
  };
}

// ===== ROUTES =====

/**
 * Health check endpoint
 * Returns service status and knowledge domain validation
 */
app.get('/health', (req, res) => {
  const status = {
    service: SERVICE_NAME,
    status: cachedKnowledgeDomains ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    knowledgeDomainsLoaded: !!cachedKnowledgeDomains,
    hotReloadEnabled: HOT_RELOAD_ENABLED,
  };

  const statusCode = cachedKnowledgeDomains ? 200 : 503;
  res.status(statusCode).json(status);
});

/**
 * POST /synthesize
 * Eastern philosophy synthesis with Western parallels
 * Body: { question: string, context?: string }
 */
app.post('/synthesize', (req, res) => {
  const { question, context } = req.body;

  // Input validation
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'question is required and must be a non-empty string',
    });
  }

  try {
    // Detect topic from question
    const topic = detectTopic(question);

    // Select primary tradition based on topic affinity
    const { primary, secondary } = selectTraditions(topic);

    // Get tradition details from knowledge domains
    const tradition = cachedKnowledgeDomains.layer_1_eastern_traditions[primary] || {};
    const coreHumanism = tradition.core_concepts?.[0] || 'philosophical wisdom';

    // Generate synthesis response (placeholder text for now)
    const answer = `From the perspective of ${primary} philosophy, this question touches on fundamental concepts like ${coreHumanism}. ` +
      `The Eastern tradition approaches this through direct experience and contemplative practice, offering insights that Western psychology ` +
      `can approximate through Jungian archetypes, though the spiritual depth extends beyond psychological frameworks.`;

    logger.info('[eastern-bridge] synthesize request', {
      question: question.substring(0, 50),
      topic,
      primary_tradition: primary,
    });

    res.json(formatSynthesisResponse(question, context || topic, primary, answer));
  } catch (err) {
    logger.error('[eastern-bridge] synthesis error', {
      error: err.message,
      question: question.substring(0, 50),
    });
    res.status(500).json({
      error: 'synthesis_failed',
      message: 'Failed to generate synthesis response',
    });
  }
});

/**
 * POST /council-vote
 * Bridge persona's vote on governance questions
 * Body: { deliberation: string, topic?: string }
 */
app.post('/council-vote', (req, res) => {
  const { deliberation, topic } = req.body;

  // Input validation
  if (!deliberation || typeof deliberation !== 'string' || deliberation.trim().length === 0) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'deliberation is required and must be a non-empty string',
    });
  }

  try {
    // Detect or use provided topic
    const detectedTopic = topic || detectTopic(deliberation);

    // Select primary tradition
    const { primary, secondary } = selectTraditions(detectedTopic);
    const traditionName = primary.charAt(0).toUpperCase() + primary.slice(1);

    // Generate vote (placeholder logic)
    const voteOptions = ['support', 'oppose', 'nuanced'];
    const selectedVote = voteOptions[Math.floor(Math.random() * voteOptions.length)];

    // Generate reasoning
    const tradition = cachedKnowledgeDomains.layer_1_eastern_traditions[primary] || {};
    const reasoning = `From ${traditionName} perspective, ${tradition.distinguishing_features || 'this philosophical tradition'} ` +
      `guides my consideration. The Eastern approach emphasizes both individual and collective harmony, ` +
      `seeking solutions that honor the interdependence acknowledged in our traditions.`;

    logger.info('[eastern-bridge] council-vote request', {
      deliberation: deliberation.substring(0, 50),
      topic: detectedTopic,
      primary_tradition: primary,
      vote: selectedVote,
    });

    res.json(formatVoteResponse(deliberation, traditionName, selectedVote, reasoning));
  } catch (err) {
    logger.error('[eastern-bridge] council-vote error', {
      error: err.message,
      deliberation: deliberation.substring(0, 50),
    });
    res.status(500).json({
      error: 'vote_failed',
      message: 'Failed to generate council vote',
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: `Endpoint ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('[eastern-bridge] unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    error: 'internal_error',
    message: 'Internal server error',
  });
});

// ===== INITIALIZE KNOWLEDGE DOMAINS AT IMPORT TIME =====
// This ensures knowledge domains are available for both production and test modes
try {
  if (!cachedKnowledgeDomains) {
    cachedKnowledgeDomains = loadKnowledgeDomainsFromDisk();
  }
} catch (err) {
  // In test mode, we might not have the file, which is OK
  if (process.env.NODE_ENV !== 'test') {
    logger.error('[eastern-bridge] fatal: cannot start without valid knowledge domains', {
      error: err.message,
    });
    process.exit(1);
  }
}

// ===== SERVICE STARTUP =====
function start() {
  // Setup hot-reload if enabled
  setupHotReload();

  // Start Express server
  const server = app.listen(SERVICE_PORT, () => {
    logger.info(`[${SERVICE_NAME}] started successfully`, {
      port: SERVICE_PORT,
      node_env: process.env.NODE_ENV,
      log_level: process.env.LOG_LEVEL,
      hot_reload_enabled: HOT_RELOAD_ENABLED,
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info(`[${SERVICE_NAME}] received SIGTERM, shutting down gracefully`);
    if (hotReloadWatcher) {
      hotReloadWatcher.close();
    }
    server.close(() => {
      logger.info(`[${SERVICE_NAME}] shut down complete`);
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info(`[${SERVICE_NAME}] received SIGINT, shutting down gracefully`);
    if (hotReloadWatcher) {
      hotReloadWatcher.close();
    }
    server.close(() => {
      logger.info(`[${SERVICE_NAME}] shut down complete`);
      process.exit(0);
    });
  });
}

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  start();
}

export { app, cachedKnowledgeDomains, loadKnowledgeDomainsFromDisk, reloadKnowledgeDomains };
