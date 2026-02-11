#!/usr/bin/env node
/**
 * check-verification-challenges.js
 *
 * Active polling script for Moltbook verification challenges.
 * This is the CRITICAL component that was missing - without active polling,
 * challenges are issued but never detected, causing automatic suspension.
 *
 * Usage:
 *   node scripts/check-verification-challenges.js
 *
 * Exit codes:
 *   0 - No challenges or all challenges passed
 *   1 - Challenge(s) failed or error occurred
 */

const { MoltbookClient } = require('../services/moltbook-client');

// Configuration
const AI_GENERATOR_URL = process.env.AI_GENERATOR_URL || 'http://localhost:3002';
const SOLVER_TIMEOUT_MS = 5000; // 5 second timeout for AI solver
const MAX_RETRIES = 2;

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    success: `${colors.green}[SUCCESS]${colors.reset}`,
    warning: `${colors.yellow}[WARNING]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
  }[level] || '[LOG]';

  console.log(`${timestamp} ${prefix} ${message}`);
}

/**
 * Solve a verification challenge using the AI generator
 */
async function solveChallenge(puzzleText) {
  log('info', `Solving puzzle: "${puzzleText}"`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOLVER_TIMEOUT_MS);

    const response = await fetch(`${AI_GENERATOR_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customPrompt: `You are solving a verification puzzle. Read it carefully and provide ONLY the answer, nothing else. No explanation, no reasoning, just the answer.\n\nPuzzle: ${puzzleText}`,
        model: 'deepseek-v3',
        temperature: 0.1, // Very low for deterministic answers
        maxTokens: 60,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`AI generator returned ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.content) {
      const answer = result.content.trim();
      log('success', `Solved: "${answer}"`);
      return answer;
    } else {
      throw new Error('AI generator did not return valid content');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      log('error', 'Solver timed out after 5 seconds');
    } else {
      log('error', `Solver error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Main function - check for and handle verification challenges
 */
async function main() {
  const client = new MoltbookClient();
  let allPassed = true;

  try {
    log('info', 'Polling for verification challenges...');

    // Fetch pending challenges
    const response = await client.getPendingChallenges();

    // Handle different response formats
    let challenges = [];
    if (Array.isArray(response)) {
      challenges = response;
    } else if (response && Array.isArray(response.challenges)) {
      challenges = response.challenges;
    } else if (response && response.challenge) {
      // Single challenge format
      challenges = [response.challenge];
    }

    if (challenges.length === 0) {
      log('info', 'No pending challenges');
      return 0;
    }

    log('warning', `⚡ URGENT: ${challenges.length} verification challenge(s) detected!`);

    // Process each challenge
    for (const challenge of challenges) {
      const challengeId = challenge.id || challenge.challenge_id;
      const puzzleText = challenge.puzzle || challenge.text || challenge.question;

      if (!challengeId || !puzzleText) {
        log('error', `Invalid challenge format: ${JSON.stringify(challenge)}`);
        allPassed = false;
        continue;
      }

      log('info', `Handling challenge ${challengeId}...`);

      // Solve with retries
      let answer = null;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        answer = await solveChallenge(puzzleText);
        if (answer) break;

        if (attempt < MAX_RETRIES) {
          log('warning', `Retry ${attempt}/${MAX_RETRIES}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!answer) {
        log('error', `Failed to solve challenge ${challengeId} after ${MAX_RETRIES} attempts`);
        allPassed = false;
        continue;
      }

      // Submit answer
      try {
        log('info', `Submitting answer for challenge ${challengeId}...`);
        const submitResponse = await client.submitVerificationAnswer(challengeId, answer);

        if (submitResponse && (submitResponse.success === true || submitResponse.status === 'accepted')) {
          log('success', `✅ Challenge ${challengeId} PASSED`);
        } else {
          log('error', `❌ Challenge ${challengeId} submission rejected: ${JSON.stringify(submitResponse)}`);
          allPassed = false;
        }
      } catch (error) {
        log('error', `❌ Challenge ${challengeId} submission failed: ${error.message}`);
        allPassed = false;
      }
    }

    return allPassed ? 0 : 1;
  } catch (error) {
    log('error', `Fatal error: ${error.message}`);
    console.error(error.stack);
    return 1;
  }
}

// Run and exit with appropriate code
main()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    log('error', `Unhandled error: ${error.message}`);
    process.exit(1);
  });
