/**
 * Moltbot Model Router Service
 * 
 * Routes AI requests between Venice and Kimi backends based on
 * configuration rules, context length, and tool requirements.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const yaml = require('yamljs');
const path = require('path');
const winston = require('winston');
const expressWinston = require('express-winston');
const NodeCache = require('node-cache');
const client = require('prom-client');

const ModelRouter = require('./router');
const { moltbookAuthMiddleware, optionalMoltbookAuth, getAuthInstructionsUrl } = require('./middleware/moltbook-auth');

// Check required environment variables
if (!process.env.MOLTBOOK_APP_KEY) {
  logger.warn('MOLTBOOK_APP_KEY not set. Moltbook authentication will not work.');
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/app/logs/router-error.log', level: 'error' }),
    new winston.transports.File({ filename: '/app/logs/router-combined.log' })
  ]
});

// Load routing configuration
const configPath = process.env.ROUTER_CONFIG_PATH || path.join(__dirname, '../config/model-routing.yml');
let routingConfig;

try {
  routingConfig = yaml.load(configPath);
  logger.info('Model routing configuration loaded', { configPath });
} catch (error) {
  logger.error('Failed to load routing configuration', { error: error.message, configPath });
  process.exit(1);
}

// Initialize cache
const cache = new NodeCache({ 
  stdTTL: routingConfig.cost_optimization?.cache_ttl?.map_thinkers || 3600,
  checkperiod: 120
});

// Initialize Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const requestCounter = new client.Counter({
  name: 'moltbot_router_requests_total',
  help: 'Total number of routing requests',
  labelNames: ['tool', 'model', 'status'],
  registers: [register]
});

const latencyHistogram = new client.Histogram({
  name: 'moltbot_router_request_duration_seconds',
  help: 'Request latency in seconds',
  labelNames: ['tool', 'model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

// Initialize router
const router = new ModelRouter(routingConfig, cache, logger);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: 'HTTP {{req.method}} {{req.url}}',
  expressFormat: true,
  colorize: NODE_ENV === 'development'
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
    cacheStats: cache.getStats()
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Authentication instructions for bots
app.get('/auth', (req, res) => {
  const endpoint = `${req.protocol}://${req.get('host')}/complete`;
  res.json({
    instructions_url: getAuthInstructionsUrl(endpoint),
    header_name: 'X-Moltbook-Identity',
    description: 'Send your Moltbook identity token in the X-Moltbook-Identity header'
  });
});

// Protected route example - requires Moltbook authentication
app.get('/profile', optionalMoltbookAuth({ logger }), (req, res) => {
  if (req.moltbookAgent) {
    res.json({
      authenticated: true,
      agent: req.moltbookAgent
    });
  } else {
    res.json({
      authenticated: false,
      message: 'No identity provided',
      auth_url: getAuthInstructionsUrl(`${req.protocol}://${req.get('host')}/profile`)
    });
  }
});

// Routing endpoint (protected - requires authentication)
app.post('/route', moltbookAuthMiddleware({ logger }), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { tool, params, context, persona } = req.body;
    
    if (!tool) {
      return res.status(400).json({
        error: 'Missing required field: tool',
        status: 'error'
      });
    }
    
    logger.debug('Routing request', { tool, persona, contextLength: context?.length });
    
    // Determine which model to use
    const routingDecision = await router.determineModel(tool, params, context, persona);
    
    // Update metrics
    requestCounter.inc({ tool, model: routingDecision.model, status: 'success' });
    latencyHistogram.observe({ tool, model: routingDecision.model }, (Date.now() - startTime) / 1000);
    
    res.json({
      status: 'success',
      routing: routingDecision,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Routing error', { error: error.message, stack: error.stack });
    
    requestCounter.inc({ 
      tool: req.body.tool || 'unknown', 
      model: 'error', 
      status: 'error' 
    });
    
    res.status(500).json({
      error: 'Routing failed',
      message: error.message,
      status: 'error'
    });
  }
});

// Direct completion endpoint (protected - requires authentication)
app.post('/complete', moltbookAuthMiddleware({ logger }), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { tool, params, context, persona, messages } = req.body;
    
    if (!tool || !messages) {
      return res.status(400).json({
        error: 'Missing required fields: tool, messages',
        status: 'error'
      });
    }
    
    // Check cache for cacheable tools
    const cacheKey = router.generateCacheKey(tool, params, messages);
    if (router.isCacheable(tool) && cache.has(cacheKey)) {
      logger.debug('Cache hit', { tool, cacheKey });
      return res.json({
        status: 'success',
        cached: true,
        result: cache.get(cacheKey)
      });
    }
    
    // Route and execute
    const routingDecision = await router.determineModel(tool, params, context, persona);
    const result = await router.executeCompletion(routingDecision, messages);
    
    // Cache result if applicable
    if (router.isCacheable(tool)) {
      cache.set(cacheKey, result);
    }
    
    // Update metrics
    requestCounter.inc({ tool, model: routingDecision.model, status: 'success' });
    latencyHistogram.observe({ tool, model: routingDecision.model }, (Date.now() - startTime) / 1000);
    
    res.json({
      status: 'success',
      model: routingDecision.model,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Completion error', { error: error.message, stack: error.stack });
    
    requestCounter.inc({ 
      tool: req.body.tool || 'unknown', 
      model: 'error', 
      status: 'error' 
    });
    
    res.status(500).json({
      error: 'Completion failed',
      message: error.message,
      status: 'error'
    });
  }
});

// List available models endpoint
app.get('/models', (req, res) => {
  res.json({
    venice: {
      default: routingConfig.backends.venice.default,
      premium: routingConfig.backends.venice.premium,
      utility: routingConfig.backends.venice.utility
    },
    kimi: {
      reasoning: routingConfig.backends.kimi.reasoning,
      fast: routingConfig.backends.kimi.fast
    },
    routing_rules: Object.keys(routingConfig.tools)
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal server error',
    status: 'error'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Model Router Service running on port ${PORT}`, {
    environment: NODE_ENV,
    configPath,
    defaultModel: routingConfig.global?.default_model
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
