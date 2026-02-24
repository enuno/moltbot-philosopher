#!/usr/bin/env node
/**
 * Intelligent Egress Proxy with Verification Challenge Handler
 *
 * This proxy intercepts all Moltbook API calls and automatically handles
 * verification challenges before they reach the calling application.
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");

// Configuration
const PROXY_PORT = process.env.PROXY_PORT || 8082;
const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";
const VENICE_PRIMARY_MODEL = "llama-3.2-3b"; // Primary model for challenge solving (67% success)
const VENICE_FALLBACK_MODEL = "mistral-31-24b"; // Fallback model (tested via model comparison)
const AI_GENERATOR_URL = process.env.AI_GENERATOR_URL || "http://ai-generator:3002";
const VERIFICATION_SERVICE_URL =
  process.env.VERIFICATION_SERVICE_URL || "http://verification-service:3007";
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const CHALLENGE_TIMEOUT = 10000;
const DEBUG = process.env.DEBUG === "true";

// Logging
const LOG_DIR = process.env.LOG_DIR || "/app/logs";
const LOG_FILE = path.join(LOG_DIR, "proxy.log");

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (err) {
  console.error("Failed to create log directory:", err.message);
}

// Target
const TARGET_HOST = "www.moltbook.com";
const TARGET_PORT = 443;

// Cache Configuration
const CACHE_TTL = parseInt(process.env.CACHE_TTL || "3600000"); // 1 hour default
const CACHE_MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE || "1000"); // Max entries
const challengeCache = new Map(); // puzzle_text -> { answer, timestamp, hits }

// Performance Tracking
const latencyMetrics = []; // Array of solve latencies for percentile calculation
const MAX_LATENCY_SAMPLES = 1000; // Keep last 1000 samples

// Admin Token for sensitive endpoints
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "changeme";

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
  aiGeneratorSuccesses: 0,
  aiGeneratorFailures: 0,
  // Delegation stats
  delegationAttempts: 0,
  delegationSuccesses: 0,
  delegationFailures: 0,
  // Performance metrics
  solverLatencyP50: 0,
  solverLatencyP99: 0,
  cacheHitRate: 0,
  retrySuccessRate: 0,
  avgChallengeFrequency: 0,
  circuitBreakerTripped: false,
};

function log(level, message, meta = {}) {
  const ts = new Date().toISOString();
  const m = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : "";
  const logLine = `[${ts}] [${level.toUpperCase()}] ${message}${m}`;

  // Console output
  console.log(logLine);

  // File output
  try {
    fs.appendFileSync(LOG_FILE, logLine + "\n");
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
  log("info", "Cache hit for challenge", {
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
    log("debug", "Cache eviction (LRU)", {
      evictedKey: oldestKey.substring(0, 30),
    });
  }

  challengeCache.set(puzzleText, {
    answer,
    timestamp: Date.now(),
    hits: 0,
  });
  log("debug", "Answer cached", { puzzlePreview: puzzleText.substring(0, 50) });
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
      process.env.VENICE_API_KEY = fs.readFileSync(process.env.VENICE_API_KEY_FILE, "utf8").trim();
    }
    if (process.env.MOLTBOOK_API_KEY_FILE) {
      process.env.MOLTBOOK_API_KEY = fs
        .readFileSync(process.env.MOLTBOOK_API_KEY_FILE, "utf8")
        .trim();
    }
    return { success: true, message: "Secrets reloaded" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Enhanced answer extraction (matching handle-verification-challenge.sh logic)
// MOVED HERE: Before solveWithVenice to ensure it's defined when called
function extractAnswer(rawAnswer, puzzleText) {
  if (!rawAnswer || typeof rawAnswer !== "string") {
    return null;
  }

  // Strip thinking blocks first (<think>...</think>)
  let cleaned = rawAnswer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Try to extract pure numeric answer (handles cases like "92", "45.50", "92.00")
  const pureNumMatch = cleaned.match(/^[\s\*]*(\d+(?:\.\d+)?)\s*[\*]*$/);
  if (pureNumMatch) {
    let answer = pureNumMatch[1];
    // Ensure exactly two decimal places
    if (answer.includes(".")) {
      const parts = answer.split(".");
      answer = parts[0] + "." + (parts[1] + "00").substring(0, 2);
    } else {
      answer = answer + ".00";
    }
    return answer;
  }

  // Fallback: extract first number if response contains extra text
  const numMatch = cleaned.match(/\b(\d+(?:\.\d+)?)\b/);
  if (numMatch) {
    let answer = numMatch[1];
    if (answer.includes(".")) {
      const parts = answer.split(".");
      answer = parts[0] + "." + (parts[1] + "00").substring(0, 2);
    } else {
      answer = answer + ".00";
    }
    return answer;
  }

  return null;
}

async function solveChallenge(puzzleText) {
  // Check cache first
  const cachedAnswer = getCachedAnswer(puzzleText);
  if (cachedAnswer) {
    return cachedAnswer;
  }

  const startTime = Date.now();
  log("info", "Starting challenge solve process", {
    puzzleLength: puzzleText.length,
    primaryModel: VENICE_PRIMARY_MODEL,
  });

  let answer = null;

  // Validate Venice API Key early
  if (!VENICE_API_KEY) {
    log("error", "VENICE_API_KEY not configured, skipping Venice models");
  } else {
    // Try primary model (Qwen3-4B - fastest)
    answer = await solveWithVenice(puzzleText, VENICE_PRIMARY_MODEL, true);
    if (answer) {
      const duration = Date.now() - startTime;
      recordLatency(duration);
      stats.primaryModelSuccesses++;
      setCachedAnswer(puzzleText, answer);
      return answer;
    }

    stats.primaryModelFailures++;

    // Fallback to Llama if primary fails
    log("warn", "Primary model failed, trying fallback model", {
      fallbackModel: VENICE_FALLBACK_MODEL,
    });
    stats.fallbackSolverUsed++;
    answer = await solveWithVenice(puzzleText, VENICE_FALLBACK_MODEL, false);

    if (answer) {
      const duration = Date.now() - startTime;
      recordLatency(duration);
      stats.fallbackModelSuccesses++;
      setCachedAnswer(puzzleText, answer);
      return answer;
    }

    stats.fallbackModelFailures++;
  }

  // Fallback to AI Generator (DeepSeek-v3 via local service)
  log("warn", "Venice models failed or skipped, trying AI Generator", {
    aiGeneratorUrl: AI_GENERATOR_URL,
  });

  answer = await solveWithAIGenerator(puzzleText);

  if (answer) {
    const duration = Date.now() - startTime;
    recordLatency(duration);
    stats.aiGeneratorSuccesses++;
    setCachedAnswer(puzzleText, answer);
    return answer;
  }

  stats.aiGeneratorFailures++;

  // No remaining fallbacks - Venice + AI Generator cover all cases
  return null;
}

async function solveWithVenice(puzzleText, model, isPrimary) {
  const startTime = Date.now();
  log("info", "Calling Venice.ai model", {
    model: model,
    puzzlePreview: puzzleText.substring(0, 100),
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHALLENGE_TIMEOUT);

    const response = await fetch(VENICE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VENICE_API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: `Parse the noise, do the math, return only the final numeric answer, no extra text: ${puzzleText}`,
          },
        ],
        temperature: 0.0,
        max_tokens: 8,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Venice API returned ${response.status}`);
    }

    const result = await response.json();
    // FIX: Use safe property access instead of optional chaining for broader compatibility
    const content =
      result.choices &&
      result.choices[0] &&
      result.choices[0].message &&
      result.choices[0].message.content;
    const rawAnswer = content ? content.trim() : null;

    const duration = Date.now() - startTime;

    if (rawAnswer) {
      // FIX: Extract answer properly like we do for AI Generator
      const answer = extractAnswer(rawAnswer, puzzleText);

      log("info", "Venice.ai response received", {
        model: model,
        rawPreview: rawAnswer.substring(0, 50),
        extractedPreview: answer ? answer.substring(0, 50) : "EXTRACTION_FAILED",
        duration: `${duration}ms`,
      });

      return answer;
    }
    throw new Error("No answer content in Venice response");
  } catch (error) {
    const duration = Date.now() - startTime;
    log("error", "Venice.ai API call failed", {
      model: model,
      error: error.message,
      duration: `${duration}ms`,
    });
    return null;
  }
}

async function solveWithAIGenerator(puzzleText) {
  const startTime = Date.now();
  log("info", "Calling AI Generator (DeepSeek-v3)", {
    puzzlePreview: puzzleText.substring(0, 100),
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHALLENGE_TIMEOUT);

    // Replicate handle-verification-challenge.sh prompt
    const prompt = `You solve short logic puzzles. Read all clues once, reason briefly internally, then output only the final answer in the requested format.

Puzzle: ${puzzleText}

Answer in under 60 tokens. No explanation unless explicitly requested. Output only the required answer, nothing else.`;

    const response = await fetch(`${AI_GENERATOR_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customPrompt: prompt,
        contentType: "post",
        model: "deepseek-v3",
        temperature: 0.2,
        maxTokens: 60,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`AI Generator returned ${response.status}`);
    }

    const result = await response.json();
    let rawAnswer = result.content || result.text;

    if (!rawAnswer) {
      throw new Error("No content in AI Generator response");
    }

    // Enhanced answer extraction (matching shell script logic)
    let answer = extractAnswer(rawAnswer, puzzleText);

    const duration = Date.now() - startTime;

    if (answer) {
      log("info", "AI Generator response received", {
        model: "deepseek-v3",
        answerPreview: answer.substring(0, 50),
        duration: `${duration}ms`,
      });
      return answer;
    }
    throw new Error("Failed to extract answer from AI Generator response");
  } catch (error) {
    const duration = Date.now() - startTime;
    log("error", "AI Generator call failed", {
      error: error.message,
      duration: `${duration}ms`,
    });
    return null;
  }
}


async function submitAnswer(challengeId, answer) {
  log("info", "Submitting challenge answer to Moltbook", {
    challengeId,
    answerLength: answer.length,
  });

  try {
    // Submit answer DIRECTLY to Moltbook (not through proxy)
    // Rationale: This is POST-solve submission; going through proxy would cause infinite loop
    // The proxy intercepts requests and solves challenges BEFORE forwarding
    // Answer submission endpoint doesn't return challenges
    const res = await fetch("https://www.moltbook.com/api/v1/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MOLTBOOK_API_KEY}`,
      },
      body: JSON.stringify({ verification_code: challengeId, answer }),
    });

    const result = await res.json();

    log("info", "Moltbook verification response", {
      challengeId,
      status: res.status,
      success: result.success || res.ok,
      response: JSON.stringify(result).substring(0, 200),
    });

    if (result.success || res.ok) {
      log("info", "Challenge answer accepted by Moltbook", { challengeId });
      return true;
    }

    log("error", "Challenge answer rejected by Moltbook", {
      challengeId,
      error: result.error || "Unknown error",
      statusCode: res.status,
    });
    return false;
  } catch (error) {
    log("error", "Failed to submit answer to Moltbook", {
      challengeId,
      error: error.message,
    });
    return false;
  }
}

/**
 * Check if text contains obfuscation markers (for reverse CAPTCHA detection)
 * Looks for: reversed words, index patterns, placeholders
 */
/**
 * Lightweight obfuscation detection for proxy-level triage.
 * NOTE: This is a heuristic filter for initial detection only.
 * The verification-service has sophisticated bigram analysis in obfuscation-decoder.ts
 * for accurate reversal detection. This proxy function simply pre-filters candidates.
 */
function containsObfuscationMarkers(text) {
  // Common reversed word patterns (reversed English words)
  if (/txet|elbissopmi|hsilgnE/.test(text)) {
    return true;
  }

  // Index patterns like [0,5,2,8] or [1,2,3,4,5]
  if (/\[\d+(?:,\d+)+\]/.test(text)) {
    return true;
  }

  // Placeholder patterns like [***] or [**]
  if (/\[\*+\]/.test(text)) {
    return true;
  }

  return false;
}

/**
 * Detect if challenge is complex/adversarial and should be delegated
 * NOTE: Delegation disabled - verification-service doesn't have /solve endpoint
 * All challenges now handled by Venice models
 */
function detectComplexChallenge(challenge) {
  // Always return null - Venice models handle all challenges
  return null;
}

/**
 * Delegate complex challenge to verification service
 */
async function delegateToVerificationService(challenge) {
  const startTime = Date.now();
  const id = challenge.id || challenge.challenge_id;
  const question = challenge.puzzle || challenge.question || challenge.text;
  const expiresAt =
    challenge.expiresAt || challenge.expires_at || new Date(Date.now() + 300000).toISOString();

  log("info", "🔀 Delegating complex challenge to verification service", {
    challengeId: id,
    reason: detectComplexChallenge(challenge),
  });

  stats.delegationAttempts++;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(`${VERIFICATION_SERVICE_URL}/solve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        challengeId: id,
        question: question,
        expiresAt: expiresAt,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Verification service returned ${response.status}`);
    }

    const result = await response.json();
    const duration = Date.now() - startTime;

    if (result.success) {
      log("info", "✅ Verification service solved complex challenge", {
        challengeId: id,
        scenario: result.scenario,
        duration,
        attempts: result.attemptCount,
      });
      stats.delegationSuccesses++;
      recordLatency(duration);
      return true;
    } else {
      log("warn", "Verification service failed to solve challenge", {
        challengeId: id,
        error: result.error,
        scenario: result.scenario,
        validation: result.validation,
      });
      stats.delegationFailures++;
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    log("error", "Delegation to verification service failed", {
      challengeId: id,
      error: error.message,
      duration,
    });
    stats.delegationFailures++;
    return false;
  }
}

async function handleChallenge(challenge) {
  stats.challengesDetected++;
  stats.lastChallengeTime = new Date();

  const id = challenge.id || challenge.challenge_id;
  const puzzle = challenge.puzzle || challenge.question || challenge.text;

  if (!id || !puzzle) {
    log("error", "Invalid challenge format", { challenge });
    stats.challengesFailed++;
    return false;
  }

  log("warn", "🔐 Verification challenge detected", {
    challengeId: id,
    puzzlePreview: puzzle.substring(0, 200),
    timestamp: stats.lastChallengeTime.toISOString(),
  });

  // Check if this is a complex/adversarial challenge
  const complexReason = detectComplexChallenge(challenge);
  if (complexReason) {
    log("info", "Complex challenge detected, delegating to verification service", {
      challengeId: id,
      reason: complexReason,
    });

    const delegated = await delegateToVerificationService(challenge);
    if (delegated) {
      stats.challengesSolved++;
      return true;
    }

    // If delegation failed, fall back to standard solving
    log("warn", "Delegation failed, attempting standard solving", {
      challengeId: id,
    });
  }

  // Standard solving flow
  const answer = await solveChallenge(puzzle);
  if (!answer) {
    log("error", "Challenge solving failed", { challengeId: id });
    stats.challengesFailed++;
    return false;
  }

  log("info", "Challenge solved, submitting answer", {
    challengeId: id,
    answerLength: answer.length,
  });

  const success = await submitAnswer(id, answer);
  if (success) {
    log("info", "✅ Challenge passed successfully", {
      challengeId: id,
      totalSolved: stats.challengesSolved + 1,
    });
    stats.challengesSolved++;
  } else {
    log("error", "❌ Challenge answer rejected", {
      challengeId: id,
      totalFailed: stats.challengesFailed + 1,
    });
    stats.challengesFailed++;
  }

  return success;
}

function proxyRequest(clientReq, clientRes) {
  stats.totalRequests++;

  const reqUrl = new URL(clientReq.url, `http://${clientReq.headers.host || "localhost"}`);

  log("info", "Proxying request", {
    method: clientReq.method,
    path: reqUrl.pathname,
    host: TARGET_HOST,
  });

  let requestBody = [];
  clientReq.on("data", (chunk) => requestBody.push(chunk));
  clientReq.on("end", async () => {
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
      upstreamRes.on("data", (chunk) => responseBody.push(chunk));
      upstreamRes.on("end", async () => {
        responseBody = Buffer.concat(responseBody);

        // FIX: Only try to parse JSON if content-type indicates JSON
        const contentType = upstreamRes.headers["content-type"] || "";
        if (contentType.includes("application/json")) {
          try {
            const json = JSON.parse(responseBody.toString());

            // Enhanced detection: Check multiple possible challenge locations
            let challenge = null;
            let detectionMethod = null;

            // Method 1: Top-level verification_challenge or challenge
            if (json.verification_challenge) {
              challenge = json.verification_challenge;
              detectionMethod = "top_level_verification_challenge";
            } else if (json.challenge) {
              challenge = json.challenge;
              detectionMethod = "top_level_challenge";
            }
            // Method 2: Nested type field
            else if (json.type === "verification_challenge" && (json.id || json.challengeId)) {
              challenge = json;
              detectionMethod = "nested_type_field";
            }
            // Method 3: Metadata flag
            else if (json.metadata?.is_verification === true && json.question) {
              challenge = {
                id: json.id || json.challengeId,
                question: json.question,
                expiresAt: json.expiresAt || json.expires_at,
              };
              detectionMethod = "metadata_is_verification";
            }
            // Method 4: data.verification_challenge
            else if (json.data?.verification_challenge) {
              challenge = json.data.verification_challenge;
              detectionMethod = "data_verification_challenge";
            }
            // Method 5: response.verification_challenge
            else if (json.response?.verification_challenge) {
              challenge = json.response.verification_challenge;
              detectionMethod = "response_verification_challenge";
            }
            // Method 6: Check for challenge-like fields (id + question/puzzle + expiresAt)
            else if (
              (json.id || json.challengeId) &&
              (json.question || json.puzzle || json.text) &&
              (json.expiresAt || json.expires_at)
            ) {
              challenge = {
                id: json.id || json.challengeId,
                question: json.question || json.puzzle || json.text,
                expiresAt: json.expiresAt || json.expires_at,
              };
              detectionMethod = "field_pattern_match";
            }
            // Method 7: Moltbook post creation response — challenge at post.verification
            // Format: { post: { verification: { verification_code, challenge_text, expires_at } } }
            else if (
              json.post?.verification?.verification_code &&
              json.post?.verification?.challenge_text
            ) {
              challenge = {
                id: json.post.verification.verification_code,
                puzzle: json.post.verification.challenge_text,
                expiresAt: json.post.verification.expires_at,
              };
              detectionMethod = "post_verification";
            }

            if (challenge) {
              log("warn", "🔐 Verification challenge intercepted in response", {
                path: reqUrl.pathname,
                method: clientReq.method,
                detectionMethod,
                httpStatus: upstreamRes.statusCode,
              });

              const solved = await handleChallenge(challenge);
              const isSuccessResponse =
                upstreamRes.statusCode >= 200 && upstreamRes.statusCode < 300;

              if (solved) {
                if (isSuccessResponse) {
                  // Challenge was embedded in a success response (e.g. 201 post creation).
                  // The action already completed — pass through the original response.
                  // Retrying would create a duplicate action.
                  log("info", "✅ Challenge solved, passing through original success response", {
                    path: reqUrl.pathname,
                    status: upstreamRes.statusCode,
                  });
                  stats.retrySuccesses++;
                  updateRates();
                  clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);
                  clientRes.end(responseBody);
                  return; // FIX: Prevent fall-through
                }

                log("info", "✅ Challenge solved, retrying original request", {
                  path: reqUrl.pathname,
                  method: clientReq.method,
                });

                stats.retryAttempts++;

                const retryReq = https.request(options, (retryRes) => {
                  let retryBody = [];
                  retryRes.on("data", (chunk) => retryBody.push(chunk));
                  retryRes.on("end", () => {
                    retryBody = Buffer.concat(retryBody);
                    clientRes.writeHead(retryRes.statusCode, retryRes.headers);
                    clientRes.end(retryBody);
                    stats.retrySuccesses++;
                    updateRates();
                    log("info", "Retry request completed successfully", {
                      path: reqUrl.pathname,
                      status: retryRes.statusCode,
                    });
                  });
                });

                retryReq.on("error", (err) => {
                  stats.retryFailures++;
                  updateRates();
                  log("error", "Retry request failed", {
                    path: reqUrl.pathname,
                    error: err.message,
                  });
                  clientRes.writeHead(500, { "Content-Type": "text/plain" });
                  clientRes.end("Challenge solved but retry failed");
                });

                retryReq.write(requestBody);
                retryReq.end();
                return; // FIX: Prevent fall-through
              } else {
                stats.retryFailures++;
                updateRates();
                log("error", "❌ Challenge solve failed, returning error to client", {
                  path: reqUrl.pathname,
                });

                // FIX: Return proper error response instead of falling through
                clientRes.writeHead(403, {
                  "Content-Type": "application/json",
                });
                clientRes.end(
                  JSON.stringify({
                    error: "Verification challenge failed",
                    challenge_id: challenge.id || challenge.challenge_id,
                    message: "Failed to solve verification challenge after all retries",
                  }),
                );
                return; // FIX: Prevent fall-through
              }
            }
          } catch (err) {
            // Not JSON or parse error - pass through
            if (DEBUG) {
              log("debug", "JSON parse error or non-JSON response", {
                error: err.message,
              });
            }
          }
        }

        log("info", "Proxying response to client", {
          path: reqUrl.pathname,
          status: upstreamRes.statusCode,
        });

        clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);
        clientRes.end(responseBody);
      });
    });

    upstreamReq.on("error", (err) => {
      log("error", "Upstream failed", { error: err.message });
      clientRes.writeHead(502, { "Content-Type": "text/plain" });
      clientRes.end("Bad Gateway");
    });

    upstreamReq.write(requestBody);
    upstreamReq.end();
  });
}

const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health" || req.url === "/_health") {
    updateRates();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: stats.circuitBreakerTripped ? "degraded" : "healthy",
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
          ? ["High failure rate detected - circuit breaker tripped"]
          : [],
      }),
    );
    return;
  }

  // Circuit breaker status endpoint
  if (req.url === "/circuit-breaker" || req.url === "/_circuit-breaker") {
    updateRates();
    const totalChallenges = stats.challengesSolved + stats.challengesFailed;
    const failureRate =
      totalChallenges > 0 ? (stats.challengesFailed / totalChallenges).toFixed(2) : 0;

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        tripped: stats.circuitBreakerTripped,
        failureRate,
        threshold: 0.2,
        challengesSolved: stats.challengesSolved,
        challengesFailed: stats.challengesFailed,
        recommendation: stats.circuitBreakerTripped
          ? "Investigate solver failures - consider manual intervention"
          : "System operating normally",
      }),
    );
    return;
  }

  // Cache stats endpoint
  if (req.url === "/cache-stats" || req.url === "/_cache-stats") {
    const entries = Array.from(challengeCache.entries()).map(([puzzle, data]) => ({
      puzzlePreview: puzzle.substring(0, 50),
      age: `${Math.floor((Date.now() - data.timestamp) / 1000)}s`,
      hits: data.hits,
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        size: challengeCache.size,
        maxSize: CACHE_MAX_SIZE,
        ttl: `${CACHE_TTL / 1000}s`,
        hitRate: stats.cacheHitRate,
        entries: entries.slice(0, 20), // Top 20 entries
      }),
    );
    return;
  }

  // Solver pipeline stats endpoint
  if (req.url === "/solver-stats" || req.url === "/_solver-stats") {
    const totalAttempts =
      stats.primaryModelSuccesses +
      stats.primaryModelFailures +
      stats.fallbackModelSuccesses +
      stats.fallbackModelFailures +
      stats.aiGeneratorSuccesses +
      stats.aiGeneratorFailures +
      stats.delegationAttempts;

    const delegationSuccessRate =
      stats.delegationAttempts > 0
        ? ((stats.delegationSuccesses / stats.delegationAttempts) * 100).toFixed(1) + "%"
        : "N/A";

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        pipeline: [
          {
            stage: 0,
            name: "Complex Challenge Delegation",
            service: "verification-service",
            enabled: true,
            attempts: stats.delegationAttempts,
            successes: stats.delegationSuccesses,
            failures: stats.delegationFailures,
            successRate: delegationSuccessRate,
            note: "Handles adversarial/multi-constraint challenges",
          },
          {
            stage: 1,
            name: "Venice Primary",
            model: VENICE_PRIMARY_MODEL,
            successes: stats.primaryModelSuccesses,
            failures: stats.primaryModelFailures,
            successRate:
              totalAttempts > 0
                ? ((stats.primaryModelSuccesses / totalAttempts) * 100).toFixed(1) + "%"
                : "N/A",
          },
          {
            stage: 2,
            name: "Venice Fallback",
            model: VENICE_FALLBACK_MODEL,
            successes: stats.fallbackModelSuccesses,
            failures: stats.fallbackModelFailures,
            successRate:
              totalAttempts > 0
                ? ((stats.fallbackModelSuccesses / totalAttempts) * 100).toFixed(1) + "%"
                : "N/A",
          },
          {
            stage: 3,
            name: "AI Generator",
            model: "deepseek-v3",
            enabled: true,
            successes: stats.aiGeneratorSuccesses,
            failures: stats.aiGeneratorFailures,
            successRate:
              totalAttempts > 0
                ? ((stats.aiGeneratorSuccesses / totalAttempts) * 100).toFixed(1) + "%"
                : "N/A",
          },
        ],
        summary: {
          totalAttempts,
          totalSuccesses: stats.challengesSolved,
          totalFailures: stats.challengesFailed,
          overallSuccessRate:
            stats.challengesSolved + stats.challengesFailed > 0
              ? (
                  (stats.challengesSolved / (stats.challengesSolved + stats.challengesFailed)) *
                  100
                ).toFixed(1) + "%"
              : "N/A",
          delegationRate:
            stats.challengesDetected > 0
              ? ((stats.delegationAttempts / stats.challengesDetected) * 100).toFixed(1) + "%"
              : "N/A",
        },
      }),
    );
    return;
  }

  // Admin: Secrets reload endpoint
  if (req.url === "/_admin/reload" && req.method === "POST") {
    const authHeader = req.headers["x-admin-token"];
    if (authHeader !== ADMIN_TOKEN) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const result = reloadSecrets();
    res.writeHead(result.success ? 200 : 500, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(result));
    log("info", "Secrets reload attempt", { success: result.success });
    return;
  }

  // Admin: Clear cache endpoint
  if (req.url === "/_admin/clear-cache" && req.method === "POST") {
    const authHeader = req.headers["x-admin-token"];
    if (authHeader !== ADMIN_TOKEN) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const size = challengeCache.size;
    challengeCache.clear();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, entriesCleared: size }));
    log("info", "Cache cleared", { entriesCleared: size });
    return;
  }

  // Default: proxy all other requests
  proxyRequest(req, res);
});

server.listen(PROXY_PORT, () => {
  log("info", `🔐 Intelligent proxy on port ${PROXY_PORT}`, {
    target: TARGET_HOST,
    models: `${VENICE_PRIMARY_MODEL} (primary), ${VENICE_FALLBACK_MODEL} (fallback)`,
  });
});

process.on("SIGTERM", () => {
  log("info", "Shutting down gracefully", {
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
    log("info", "Periodic stats", stats);

    // Alert on circuit breaker
    if (stats.circuitBreakerTripped) {
      log("error", "⚠️ ALERT: Circuit breaker tripped - high failure rate", {
        failureRate: (
          stats.challengesFailed /
          (stats.challengesSolved + stats.challengesFailed)
        ).toFixed(2),
        threshold: 0.2,
      });
    }

    // Warn on high P99 latency
    if (stats.solverLatencyP99 > 9000) {
      log("warn", "⚠️ High P99 latency approaching timeout", {
        p99: `${stats.solverLatencyP99}ms`,
        threshold: "9000ms",
      });
    }

    // Log cache efficiency
    log("debug", "Cache stats", {
      size: challengeCache.size,
      hitRate: stats.cacheHitRate,
      hits: stats.cacheHits,
      misses: stats.cacheMisses,
    });
  }
}, 300000); // Every 5 minutes

// Export functions for testing
if (process.env.NODE_ENV === "test" || require.main !== module) {
  module.exports = {
    detectComplexChallenge,
    containsObfuscationMarkers,
  };
}
