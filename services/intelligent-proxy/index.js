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

// Configuration
const PROXY_PORT = process.env.PROXY_PORT || 8082;
const AI_GENERATOR_URL = process.env.AI_GENERATOR_URL || 'http://ai-generator:3000';
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const CHALLENGE_TIMEOUT = 10000;
const DEBUG = process.env.DEBUG === 'true';

// Target
const TARGET_HOST = 'www.moltbook.com';
const TARGET_PORT = 443;

// Stats
const stats = {
  totalRequests: 0,
  challengesDetected: 0,
  challengesSolved: 0,
  challengesFailed: 0,
  lastChallengeTime: null,
};

function log(level, message, meta = {}) {
  const ts = new Date().toISOString();
  const m = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
  console.log(`[${ts}] [${level.toUpperCase()}] ${message}${m}`);
}

async function solveChallenge(puzzleText) {
  log('info', 'Solving challenge', { puzzle: puzzleText.substring(0, 100) });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHALLENGE_TIMEOUT);

    const response = await fetch(`${AI_GENERATOR_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customPrompt: `Solve this puzzle. Provide ONLY the answer:\n\n${puzzleText}`,
        contentType: 'post',
        persona: 'socratic',
        provider: 'auto',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`AI generator ${response.status}`);

    const result = await response.json();
    const answer = result.content?.trim();

    if (answer) {
      log('success', 'Solved', { answer: answer.substring(0, 50) });
      return answer;
    }
    throw new Error('No answer');
  } catch (error) {
    log('error', 'Solve failed', { error: error.message });
    return null;
  }
}

async function submitAnswer(challengeId, answer) {
  log('info', 'Submitting answer', { challengeId });

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
    if (result.success || res.ok) {
      log('success', 'Answer accepted');
      return true;
    }

    log('error', 'Answer rejected', { error: result.error });
    return false;
  } catch (error) {
    log('error', 'Submit failed', { error: error.message });
    return false;
  }
}

async function handleChallenge(challenge) {
  stats.challengesDetected++;
  stats.lastChallengeTime = new Date();

  const id = challenge.id || challenge.challenge_id;
  const puzzle = challenge.puzzle || challenge.question || challenge.text;

  if (!id || !puzzle) {
    log('error', 'Invalid challenge', { challenge });
    stats.challengesFailed++;
    return false;
  }

  log('warn', '🔐 Challenge detected', { id });

  const answer = await solveChallenge(puzzle);
  if (!answer) {
    stats.challengesFailed++;
    return false;
  }

  const success = await submitAnswer(id, answer);
  if (success) {
    stats.challengesSolved++;
  } else {
    stats.challengesFailed++;
  }

  return success;
}

function proxyRequest(clientReq, clientRes) {
  stats.totalRequests++;

  const reqUrl = new URL(clientReq.url, `http://${clientReq.headers.host || 'localhost'}`);

  if (DEBUG) {
    log('debug', 'Proxy', { method: clientReq.method, path: reqUrl.pathname });
  }

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
              log('warn', '🔐 Challenge intercepted');

              const solved = await handleChallenge(challenge);

              if (solved) {
                log('success', '✅ Retrying request');

                const retryReq = https.request(options, (retryRes) => {
                  let retryBody = [];
                  retryRes.on('data', (chunk) => retryBody.push(chunk));
                  retryRes.on('end', () => {
                    retryBody = Buffer.concat(retryBody);
                    clientRes.writeHead(retryRes.statusCode, retryRes.headers);
                    clientRes.end(retryBody);
                    log('success', 'Retry done', { status: retryRes.statusCode });
                  });
                });

                retryReq.on('error', (err) => {
                  log('error', 'Retry failed', { error: err.message });
                  clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
                  clientRes.end('Retry failed');
                });

                retryReq.write(requestBody);
                retryReq.end();
                return;
              } else {
                log('error', '❌ Challenge failed');
              }
            }
          } catch (err) {
            // Not JSON - pass through
          }
        }

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
  if (req.url === '/health' || req.url === '/_health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime(), stats }));
  } else {
    proxyRequest(req, res);
  }
});

server.listen(PROXY_PORT, () => {
  log('info', `🔐 Intelligent proxy on port ${PROXY_PORT}`, { target: TARGET_HOST });
});

process.on('SIGTERM', () => {
  log('info', 'Shutting down');
  server.close(() => process.exit(0));
});

setInterval(() => {
  if (stats.totalRequests > 0) log('info', 'Stats', stats);
}, 300000);
