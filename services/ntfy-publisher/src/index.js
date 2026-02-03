import fs from 'fs/promises';
import https from 'https';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration from environment
const NTFY_URL = process.env.NTFY_URL || 'https://ntfy.hashgrid.net';
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'moltbot-philosopher';
const NTFY_API = process.env.NTFY_API;
const ENABLED = process.env.NTFY_ENABLED === 'true';
const PORT = process.env.PORT || 3005;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Priority mapping (ntfy valid values: min, low, default, high, urgent/max)
const PRIORITIES = {
  error: process.env.NTFY_PRIORITY_ERRORS || 'urgent',
  action: process.env.NTFY_PRIORITY_ACTIONS || 'default',
  heartbeat: 'low',
  security: 'urgent'
};

// Emoji mappings for notification types
const TYPE_EMOJIS = {
  error: '❌',
  action: '✅',
  heartbeat: '💓',
  security: '🚨'
};

/**
 * Logger utility
 */
function log(level, message, meta = {}) {
  const levels = { error: 0, warn: 1, info: 2, debug: 3 };
  const currentLevel = levels[LOG_LEVEL] ?? 2;
  
  if (levels[level] <= currentLevel) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    }));
  }
}

/**
 * Send notification to ntfy using direct HTTP request
 * @param {string} type - notification type (error, action, heartbeat, security)
 * @param {string} title - Short title (max 100 chars)
 * @param {string} message - Full message body
 * @param {object} metadata - Optional tags, actions, clickUrl, etc.
 */
export async function notify(type, title, message, metadata = {}) {
  if (!ENABLED) {
    log('info', `[NTFY-DISABLED] ${type}: ${title}`);
    return { skipped: true, reason: 'disabled' };
  }
  
  if (!NTFY_API) {
    log('error', '[NTFY-ERROR] NTFY_API not configured');
    return { error: 'missing_api_key' };
  }
  
  // Validate type
  const validTypes = ['error', 'action', 'heartbeat', 'security'];
  if (!validTypes.includes(type)) {
    log('warn', `[NTFY-WARN] Invalid notification type: ${type}`);
    type = 'action';
  }
  
  const priority = metadata.priority || PRIORITIES[type] || 'default';
  const emoji = TYPE_EMOJIS[type] || '🔔';
  
  // Build the full URL
  const url = new URL(`${NTFY_URL}/${NTFY_TOPIC}`);
  
  // Build headers - Title header must be ASCII only (no emoji)
  const headers = {
    'Title': `[${type.toUpperCase()}] ${title}`,
    'Priority': priority,
    'Authorization': `Bearer ${NTFY_API}`,
    'Content-Type': 'text/plain'
  };
  
  // Add optional headers
  if (metadata.tags) {
    headers['Tags'] = [...new Set([type, 'moltbot', ...metadata.tags])].join(',');
  } else {
    headers['Tags'] = `${type},moltbot`;
  }
  
  if (metadata.clickUrl) {
    headers['Click'] = metadata.clickUrl;
  }
  
  if (metadata.actions) {
    headers['Actions'] = JSON.stringify(metadata.actions);
  }
  
  // Add source script info if available
  const sourceScript = metadata.source_script || 'unknown';
  // Include emoji at start of message body instead of header
  const fullMessage = `${emoji} ${message}\n\nSource: ${sourceScript}`;
  
  return new Promise((resolve) => {
    const options = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      headers: headers,
      timeout: 10000
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          log('info', `[NTFY-SUCCESS] ${type}: ${title}`, { statusCode: res.statusCode });
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          log('error', `[NTFY-FAILED] ${type}: HTTP ${res.statusCode}`, { response: data });
          logToFallback(type, title, message, new Error(`HTTP ${res.statusCode}: ${data}`));
          resolve({ error: `HTTP ${res.statusCode}`, fallback: true });
        }
      });
    });
    
    req.on('error', (error) => {
      log('error', `[NTFY-FAILED] ${type}: ${error.message}`);
      logToFallback(type, title, message, error);
      resolve({ error: error.message, fallback: true });
    });
    
    req.on('timeout', () => {
      req.destroy();
      log('error', `[NTFY-FAILED] ${type}: Request timeout`);
      logToFallback(type, title, message, new Error('Request timeout'));
      resolve({ error: 'timeout', fallback: true });
    });
    
    req.write(fullMessage);
    req.end();
  });
}

/**
 * Log to local file if ntfy is unreachable
 */
async function logToFallback(type, title, message, error) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      title,
      message,
      error: error.message
    };
    
    const logPath = '/logs/ntfy-fallback.jsonl';
    await fs.appendFile(logPath, JSON.stringify(logEntry) + '\n');
  } catch (fsError) {
    log('error', `[NTFY-FALLBACK-FAILED] Could not write fallback log: ${fsError.message}`);
  }
}

/**
 * Specific notification helpers
 */
export const notifyAction = (title, message, meta) => notify('action', title, message, meta);
export const notifyError = (title, message, meta) => notify('error', title, message, meta);
export const notifyHeartbeat = (title, message, meta) => notify('heartbeat', title, message, meta);
export const notifySecurity = (title, message, meta) => notify('security', title, message, meta);

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow internal network requests
}));
app.use(cors({
  origin: '*', // Internal network only
  methods: ['GET', 'POST']
}));
app.use(express.json({ limit: '1mb' }));

// Request logging middleware
app.use((req, res, next) => {
  log('debug', `${req.method} ${req.path}`, { ip: req.ip });
  next();
});

/**
 * POST /notify - Send a notification
 * Body: { type, title, message, metadata? }
 */
app.post('/notify', async (req, res) => {
  try {
    const { type, title, message, metadata = {} } = req.body;
    
    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({
        error: 'Missing required fields: title, message'
      });
    }
    
    // Validate title length (ntfy limit)
    if (title.length > 100) {
      return res.status(400).json({
        error: 'Title exceeds 100 character limit'
      });
    }
    
    const result = await notify(type || 'action', title, message, metadata);
    res.json(result);
  } catch (error) {
    log('error', 'Error processing notification request', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    enabled: ENABLED,
    topic: NTFY_TOPIC,
    url: NTFY_URL,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /fallback-logs - View fallback logs (for debugging)
 */
app.get('/fallback-logs', async (req, res) => {
  try {
    const logPath = '/logs/ntfy-fallback.jsonl';
    const logs = await fs.readFile(logPath, 'utf-8');
    const entries = logs.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    res.json(entries);
  } catch (error) {
    res.json([]);
  }
});

// Error handler
app.use((err, req, res, next) => {
  log('error', 'Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  log('info', `NTFY Publisher service listening on port ${PORT}`);
  log('info', `Configuration: enabled=${ENABLED}, topic=${NTFY_TOPIC}, url=${NTFY_URL}`);
  
  // Send startup notification if enabled
  if (ENABLED && NTFY_API) {
    notify('heartbeat', 'NTFY Service Started', 'Moltbot-Philosopher notification service is now active and ready.');
  }
});

export default app;
