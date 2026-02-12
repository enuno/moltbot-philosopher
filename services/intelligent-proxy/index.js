#!/usr/bin/env node
/**
 * Intelligent Egress Proxy with Verification Challenge Handler
 *
 * This proxy intercepts all Moltbook API calls and automatically handles
 * verification challenges before they reach the calling application.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Configuration
const PROXY_PORT = process.env.PROXY_PORT || 8082;
const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_API_URL = 'https://api.venice.ai/api/v1/chat/completions';
const VENICE_PRIMARY_MODEL = 'venice/qwen3-4b'; // Fastest model for reasoning
const VENICE_FALLBACK_MODEL = 'venice/llama-3.2-3b'; // Backup model
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const CHALLENGE_TIMEOUT = 10000;
const DEBUG = process.env.DEBUG === 'true';

// Logging
const LOG_DIR = process.env.LOG_DIR || '/app/logs';
const LOG_FILE = path.join(LOG_DIR, 'proxy.log');

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create log directory:', err.message);
}

// Target
const TARGET_HOST = 'www.moltbook.com';
const TARGET_PORT = 443;

// Cache Configuration
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600000'); // 1 hour default
const CACHE_MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE || '1000'); // Max entries
const challengeCache = new Map(); // puzzle_text -> { answer, timestamp, hits }

// Performance Tracking
const latencyMetrics = []; // Array of solve latencies for percentile calculation
const MAX_LATENCY_SAMPLES = 1000; // Keep last 1000 samples

// Admin Token for sensitive endpoints
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';

// Stats (Extended)
const stats = {
  totalRequests: 0,
  challengesDetected: 0,
  challengesSolved: 0,
  challengesFailed: 0,
  lastChallengeTime: null,
  cacheHits: 0,
  cacheMisses: 0,
  fallbackSolverUsed: 0,
  retryAttempts: 0,
  retrySuccesses: 0,
  retryFailures: 0,
  primaryModelSuccesses: 0,
  primaryModelFailures: 0,
  fallbackModelSuccesses: 0,
  fallbackModelFailures: 0,
  solverLatencyP50: 0,
  solverLatencyP99: 0,
  cacheHitRate: 0,
  retrySuccessRate: 0,
  avgChallengeFrequency: 0,
  circuitBreakerTripped: false,
};

function log(level, message, meta = {}) {
  const ts = new Date().toISOString();
  const m = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
  const logLine = `[${ts}] [${level.toUpperCase()}] ${message}${m}`;

  // Console output
  console.log(logLine);

  // File output
  try {
    fs.appendFileSync(LOG_FILE, logLine + '\n');
  } catch (err) {
    // Don't fail on logging errors
  }
}

// Cache Management
function getCachedAnswer(puzzleText) {
  const cached = challengeCache.get(puzzleText);
  if (!cached) {
    stats.cacheMisses++;
    return null;
  }

  // Check TTL
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    challengeCache.delete(puzzleText);
    stats.cacheMisses++;
    return null;
  }

  stats.cacheHits++;
  cached.hits++;
  log('info', 'Cache hit for challenge', {
    puzzlePreview: puzzleText.substring(0, 50),
    age: `${Math.floor((Date.now() - cached.timestamp) / 1000)}s`,
    hits: cached.hits,
  });
  return cached.answer;
}

function setCachedAnswer(puzzleText, answer) {
  // Enforce max cache size (LRU eviction)
  if (challengeCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = challengeCache.keys().next().value;
    challengeCache.delete(oldestKey);
    log('debug', 'Cache eviction (LRU)', { evictedKey: oldestKey.substring(0, 30) });
  }

  challengeCache.set(puzzleText, {
    answer,
    timestamp: Date.now(),
    hits: 0,
  });
  log('debug', 'Answer cached', { puzzlePreview: puzzleText.substring(0, 50) });
}

// Metrics Calculation
function recordLatency(latencyMs) {
  latencyMetrics.push(latencyMs);
  if (latencyMetrics.length > MAX_LATENCY_SAMPLES) {
    latencyMetrics.shift(); // Remove oldest
  }
  updatePercentiles();
}

function updatePercentiles() {
  if (latencyMetrics.length === 0) return;

  const sorted = [...latencyMetrics].sort((a, b) => a - b);
  const p50Index = Math.floor(sorted.length * 0.5);
  const p99Index = Math.floor(sorted.length * 0.99);

  stats.solverLatencyP50 = sorted[p50Index];
  stats.solverLatencyP99 = sorted[p99Index];
}

function updateRates() {
  const totalCache = stats.cacheHits + stats.cacheMisses;
  stats.cacheHitRate = totalCache > 0 ? (stats.cacheHits / totalCache).toFixed(2) : 0;

  const totalRetries = stats.retrySuccesses + stats.retryFailures;
  stats.retrySuccessRate = totalRetries > 0 ? (stats.retrySuccesses / totalRetries).toFixed(2) : 0;

  // Circuit breaker: trip if failure rate > 20%
  const totalChallenges = stats.challengesSolved + stats.challengesFailed;
  if (totalChallenges > 5) {
    const failureRate = stats.challengesFailed / totalChallenges;
    stats.circuitBreakerTripped = failureRate > 0.2;
  }
}

// Secrets Reload (Admin Endpoint)
function reloadSecrets() {
  try {
    // In production, read from Docker secrets or env reload
    if (process.env.VENICE_API_KEY_FILE) {
      process.env.VENICE_API_KEY = fs.readFileSync(process.env.VENICE_API_KEY_FILE, 'utf8').trim();
    }
    if (process.env.MOLTBOOK_API_KEY_FILE) {
      process.env.MOLTBOOK_API_KEY = fs.readFileSync(process.env.MOLTBOOK_API_KEY_FILE, 'utf8').trim();
    }
    return { success: true, message: 'Secrets reloaded' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function solveChallenge(puzzleText) {
  // Check cache first
  const cachedAnswer = getCachedAnswer(puzzleText);
  if (cachedAnswer) {
    return cachedAnswer;
  }

  const startTime = Date.now();
  log('info', 'Starting challenge solve process', {
    puzzleLength: puzzleText.length,
    primaryModel: VENICE_PRIMARY_MODEL,
  });

  // Try primary model (Qwen3-4B - fastest)
  let answer = await solveWithVenice(puzzleText, VENICE_PRIMARY_MODEL, true);
  if (answer) {
    const duration = Date.now() - startTime;
    recordLatency(duration);
    stats.primaryModelSuccesses++;
    setCachedAnswer(puzzleText, answer); // Cache successful answer
    return answer;
  }

  stats.primaryModelFailures++;

  // Fallback to Llama if primary fails
  log('warn', 'Primary model failed, trying fallback model', {
    fallbackModel: VENICE_FALLBACK_MODEL,
  });
  stats.fallbackSolverUsed++;
  answer = await solveWithVenice(puzzleText, VENICE_FALLBACK_MODEL, false);
  
  if (answer) {
    const duration = Date.now() - startTime;
    recordLatency(duration);
    stats.fallbackModelSuccesses++;
    setCachedAnswer(puzzleText, answer); // Cache successful answer
    return answer;
  }

  stats.fallbackModelFailures++;
  return null;
}

async function solveWithVenice(puzzleText, model, isPrimary) {
  const startTime = Date.now();
  log('info', 'Calling Venice.ai model', { model, puzzlePreview: puzzleText.substring(0, 100) });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHALLENGE_TIMEOUT);

    const response = await fetch(VENICE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VENICE_API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content:
              'You solve verification puzzles quickly and accurately. Provide ONLY the direct answer with no explanation.',
          },
          {
            role: 'user',
            content: `Solve this verification puzzle:\n\n${puzzleText}\n\nAnswer:`,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Venice API returned ${response.status}`);
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content?.trim();

    const duration = Date.now() - startTime;

    if (answer) {
      log('info', 'Venice.ai response received', {
        model,
        answerPreview: answer.substring(0, 50),
        duration: `${duration}ms`,
      });
      return answer;
    }
    throw new Error('No answer content in Venice response');
  } catch (error) {
    const duration = Date.now() - startTime;
    log('error', 'Venice.ai API call failed', {
      model,
      error: error.message,
      duration: `${duration}ms`,
    });
    return null;
  }
}

async function submitAnswer(challengeId, answer) {
  log('info', 'Submitting challenge answer to Moltbook', {
    challengeId,
    answerLength: answer.length,
  });

  try {
    const res = await fetch('https://www.moltbook.com/api/v1/agents/verification/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MOLTBOOK_API_KEY}`,
      },
      body: JSON.stringify({ challenge_id: challengeId, answer }),
    });

    const result = await res.json();

    log('info', 'Moltbook verification response', {
      challengeId,
      status: res.status,
      success: result.success || res.ok,
      response: JSON.stringify(result).substring(0, 200),
    });

    if (result.success || res.ok) {
      log('info', 'Challenge answer accepted by Moltbook', { challengeId });
      return true;
    }

    log('error', 'Challenge answer rejected by Moltbook', {
      challengeId,
      error: result.error || 'Unknown error',
      statusCode: res.status,
    });
    return false;
  } catch (error) {
    log('error', 'Failed to submit answer to Moltbook', {
      challengeId,
      error: error.message,
    });
    return false;
  }
}

async function handleChallenge(challenge) {
  stats.challengesDetected++;
  stats.lastChallengeTime = new Date();

  const id = challenge.id || challenge.challenge_id;
  const puzzle = challenge.puzzle || challenge.question || challenge.text;

  if (!id || !puzzle) {
    log('error', 'Invalid challenge format', { challenge });
    stats.challengesFailed++;
    return false;
  }

  log('warn', '🔐 Verification challenge detected', {
    challengeId: id,
    puzzlePreview: puzzle.substring(0, 200),
    timestamp: stats.lastChallengeTime.toISOString(),
  });

  const answer = await solveChallenge(puzzle);
  if (!answer) {
    log('error', 'Challenge solving failed', { challengeId: id });
    stats.challengesFailed++;
    return false;
  }

  log('info', 'Challenge solved, submitting answer', {
    challengeId: id,
    answerLength: answer.length,
  });

  const success = await submitAnswer(id, answer);
  if (success) {
    log('info', '✅ Challenge passed successfully', {
      challengeId: id,
      totalSolved: stats.challengesSolved + 1,
    });
    stats.challengesSolved++;
  } else {
    log('error', '❌ Challenge answer rejected', {
      challengeId: id,
      totalFailed: stats.challengesFailed + 1,
    });
    stats.challengesFailed++;
  }

  return success;
}

function proxyRequest(clientReq, clientRes) {
  stats.totalRequests++;

  const reqUrl = new URL(clientReq.url, `http://${clientReq.headers.host || 'localhost'}`);

  log('info', 'Proxying request', {
    method: clientReq.method,
    path: reqUrl.pathname,
    host: TARGET_HOST,
  });

  let requestBody = [];
  clientReq.on('data', (chunk) => requestBody.push(chunk));
  clientReq.on('end', async () => {
    requestBody = Buffer.concat(requestBody);

    const options = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: reqUrl.pathname + reqUrl.search,
      method: clientReq.method,
      headers: { ...clientReq.headers, host: TARGET_HOST },
    };

    const upstreamReq = https.request(options, async (upstreamRes) => {
      let responseBody = [];
      upstreamRes.on('data', (chunk) => responseBody.push(chunk));
      upstreamRes.on('end', async () => {
        responseBody = Buffer.concat(responseBody);

        if (upstreamRes.headers['content-type']?.includes('application/json')) {
          try {
            const json = JSON.parse(responseBody.toString());

            if (json.verification_challenge || json.challenge) {
              const challenge = json.verification_challenge || json.challenge;
              log('warn', '🔐 Verification challenge intercepted in response', {
                path: reqUrl.pathname,
                method: clientReq.method,
                challengeType: json.verification_challenge ? 'verification_challenge' : 'challenge',
              });

              const solved = await handleChallenge(challenge);

              if (solved) {
                log('info', '✅ Challenge solved, retrying original request', {
                  path: reqUrl.pathname,
                  method: clientReq.method,
                });

                stats.retryAttempts++;

                const retryReq = https.request(options, (retryRes) => {
                  let retryBody = [];
                  retryRes.on('data', (chunk) => retryBody.push(chunk));
                  retryRes.on('end', () => {
                    retryBody = Buffer.concat(retryBody);
                    clientRes.writeHead(retryRes.statusCode, retryRes.headers);
                    clientRes.end(retryBody);
                    stats.retrySuccesses++;
                    updateRates();
                    log('info', 'Retry request completed successfully', {
                      path: reqUrl.pathname,
                      status: retryRes.statusCode,
                    });
                  });
                });

                retryReq.on('error', (err) => {
                  stats.retryFailures++;
                  updateRates();
                  log('error', 'Retry request failed', {
                    path: reqUrl.pathname,
                    error: err.message,
                  });
                  clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
                  clientRes.end('Challenge solved but retry failed');
                });

                retryReq.write(requestBody);
                retryReq.end();
                return;
              } else {
                stats.retryFailures++;
                updateRates();
                log('error', '❌ Challenge solve failed, returning error to client', {
                  path: reqUrl.pathname,
                });
              }
            }
          } catch (err) {
            // Not JSON or parse error - pass through
          }
        }

        log('info', 'Proxying response to client', {
          path: reqUrl.pathname,
          status: upstreamRes.statusCode,
        });

        clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);
        clientRes.end(responseBody);
      });
    });

    upstreamReq.on('error', (err) => {
      log('error', 'Upstream failed', { error: err.message });
      clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
      clientRes.end('Bad Gateway');
    });

    upstreamReq.write(requestBody);
    upstreamReq.end();
  });
}

const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' || req.url === '/_health') {
    updateRates();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: stats.circuitBreakerTripped ? 'degraded' : 'healthy',
        uptime: process.uptime(),
        stats,
        cache: {
          size: challengeCache.size,
          maxSize: CACHE_MAX_SIZE,
          ttl: CACHE_TTL,
        },
        latency: {
          p50: `${stats.solverLatencyP50}ms`,
          p99: `${stats.solverLatencyP99}ms`,
          samples: latencyMetrics.length,
        },
        alerts: stats.circuitBreakerTripped
          ? ['High failure rate detected - circuit breaker tripped']
          : [],
      })
    );
    return;
  }

  // Circuit breaker status endpoint
  if (req.url === '/circuit-breaker' || req.url === '/_circuit-breaker') {
    updateRates();
    const totalChallenges = stats.challengesSolved + stats.challengesFailed;
    const failureRate = totalChallenges > 0 ? (stats.challengesFailed / totalChallenges).toFixed(2) : 0;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        tripped: stats.circuitBreakerTripped,
        failureRate,
        threshold: 0.2,
        challengesSolved: stats.challengesSolved,
        challengesFailed: stats.challengesFailed,
        recommendation:
          stats.circuitBreakerTripped
            ? 'Investigate solver failures - consider manual intervention'
            : 'System operating normally',
      })
    );
    return;
  }

  // Cache stats endpoint
  if (req.url === '/cache-stats' || req.url === '/_cache-stats') {
    const entries = Array.from(challengeCache.entries()).map(([puzzle, data]) => ({
      puzzlePreview: puzzle.substring(0, 50),
      age: `${Math.floor((Date.now() - data.timestamp) / 1000)}s`,
      hits: data.hits,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        size: challengeCache.size,
        maxSize: CACHE_MAX_SIZE,
        hitRate: stats.cacheHitRate,
        entries: entries.slice(0, 20), // Top 20 entries
      })
    );
    return;
  }

  // Admin: Secrets reload endpoint
  if (req.url === '/_admin/reload' && req.method === 'POST') {
    const authHeader = req.headers['x-admin-token'];
    if (authHeader !== ADMIN_TOKEN) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const result = reloadSecrets();
    res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    log('info', 'Secrets reload attempt', { success: result.success });
    return;
  }

  // Admin: Clear cache endpoint
  if (req.url === '/_admin/clear-cache' && req.method === 'POST') {
    const authHeader = req.headers['x-admin-token'];
    if (authHeader !== ADMIN_TOKEN) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const size = challengeCache.size;
    challengeCache.clear();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, entriesCleared: size }));
    log('info', 'Cache cleared', { entriesCleared: size });
    return;
  }

  // Default: proxy all other requests
  proxyRequest(req, res);
});

server.listen(PROXY_PORT, () => {
  log('info', `🔐 Intelligent proxy on port ${PROXY_PORT}`, {
    target: TARGET_HOST,
    models: `${VENICE_PRIMARY_MODEL} (primary), ${VENICE_FALLBACK_MODEL} (fallback)`,
  });
});

process.on('SIGTERM', () => {
  log('info', 'Shutting down gracefully', {
    totalRequests: stats.totalRequests,
    challengesSolved: stats.challengesSolved,
    cacheSize: challengeCache.size,
  });
  server.close(() => process.exit(0));
});

// Periodic stats and cache cleanup
setInterval(() => {
  if (stats.totalRequests > 0) {
    updateRates();
    log('info', 'Periodic stats', stats);

    // Alert on circuit breaker
    if (stats.circuitBreakerTripped) {
      log('error', '⚠️ ALERT: Circuit breaker tripped - high failure rate', {
        failureRate: (stats.challengesFailed / (stats.challengesSolved + stats.challengesFailed)).toFixed(2),
        threshold: 0.2,
      });
    }

    // Warn on high P99 latency
    if (stats.solverLatencyP99 > 9000) {
      log('warn', '⚠️ High P99 latency approaching timeout', {
        p99: `${stats.solverLatencyP99}ms`,
        threshold: '9000ms',
      });
    }

    // Log cache efficiency
    log('debug', 'Cache stats', {
      size: challengeCache.size,
      hitRate: stats.cacheHitRate,
      hits: stats.cacheHits,
      misses: stats.cacheMisses,
    });
  }
}, 300000); // Every 5 minutes
