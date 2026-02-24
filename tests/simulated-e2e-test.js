#!/usr/bin/env node

/**
 * Realistic Simulated End-to-End Test
 *
 * Tests the REAL challenge solving flow using actual Venice API
 * WITHOUT posting to Moltbook
 *
 * Stages:
 * 1. Generate test challenges (mimicking Moltbook verification)
 * 2. Call real Venice API through proxy for challenge solving
 * 3. Mock the final post submission to Moltbook
 * 4. Report results without creating actual posts
 *
 * Usage: VENICE_API_KEY=... node tests/simulated-e2e-test.js
 */

const assert = require('assert');

// Configuration
let VENICE_API_KEY = process.env.VENICE_API_KEY;

// Fallback: read from .env file if not in environment
if (!VENICE_API_KEY) {
  try {
    const fs = require('fs');
    const envPath = require('path').join(__dirname, '../.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^VENICE_API_KEY=(.+)$/m);
    if (match) {
      VENICE_API_KEY = match[1].trim();
    }
  } catch (err) {
    // Ignore file read errors
  }
}

const VENICE_API_URL = 'https://api.venice.ai/api/v1/chat/completions';
const CHALLENGE_TIMEOUT = 15000;

if (!VENICE_API_KEY) {
  console.error('❌ VENICE_API_KEY not found in environment or .env file');
  process.exit(1);
}

// =============================================================================
// Test Challenges (Real Moltbook challenge patterns)
// =============================================================================

const TEST_CHALLENGES = [
  {
    name: 'Simple arithmetic',
    text: '25 + 12',
    expectedAnswer: '37',
    difficulty: 'easy',
  },
  {
    name: 'Basic subtraction',
    text: '50 - 8',
    expectedAnswer: '42',
    difficulty: 'easy',
  },
  {
    name: 'Multi-step calculation',
    text: '25 + 12 - 8',
    expectedAnswer: '29',
    difficulty: 'medium',
  },
  {
    name: 'Obfuscated: alternating caps',
    text: 'TwEnTy FiVe PlUs TwElVe',
    expectedAnswer: '37',
    difficulty: 'hard',
  },
  {
    name: 'Obfuscated: with symbols',
    text: '*25* + *12*',
    expectedAnswer: '37',
    difficulty: 'hard',
  },
  {
    name: 'Obfuscated: mixed symbols and caps',
    text: 't#WeNt$Y f%IvE + t@WeL#vE',
    expectedAnswer: '37',
    difficulty: 'very_hard',
  },
];

// =============================================================================
// Challenge Solver (Uses real Venice API)
// =============================================================================

async function solveChallenge(challengeText, model = 'mistral-31-24b') {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHALLENGE_TIMEOUT);

    const response = await fetch(VENICE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VENICE_API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: `Parse the noise, do the math, return only the final numeric answer, no extra text: ${challengeText}`,
          },
        ],
        temperature: 0.0,
        max_tokens: 8,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    const answer = content ? content.trim() : null;

    return {
      success: !!answer,
      answer,
      duration,
      model,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error.message,
      duration,
      model,
    };
  }
}

// =============================================================================
// Test Runner
// =============================================================================

async function runChallengeTest(challenge, model = 'llama-3.2-3b') {
  console.log(`\n  📝 ${challenge.name}`);
  console.log(`     Challenge: "${challenge.text}"`);
  console.log(`     Expected: ${challenge.expectedAnswer}`);

  process.stdout.write(`     Solving...`);

  const result = await solveChallenge(challenge.text, model);

  if (result.success) {
    const matches = result.answer === challenge.expectedAnswer;
    if (matches) {
      console.log(` ✅ Got: ${result.answer} (${result.duration}ms)`);
      return true;
    } else {
      console.log(` ⚠️  Got: ${result.answer} [WRONG] (expected ${challenge.expectedAnswer})`);
      return false;
    }
  } else {
    console.log(` ❌ Error: ${result.error}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n🧪 SIMULATED END-TO-END TEST SUITE');
  console.log('═'.repeat(70));
  console.log('\nUsing: Venice API (llama-3.2-3b - primary model)');
  console.log('Goal: Validate challenge solving without posting to Moltbook\n');

  // Group by difficulty
  const byDifficulty = {};
  for (const challenge of TEST_CHALLENGES) {
    if (!byDifficulty[challenge.difficulty]) {
      byDifficulty[challenge.difficulty] = [];
    }
    byDifficulty[challenge.difficulty].push(challenge);
  }

  const difficultyOrder = ['easy', 'medium', 'hard', 'very_hard'];
  const allResults = [];

  for (const difficulty of difficultyOrder) {
    if (!byDifficulty[difficulty]) continue;

    console.log(`📊 ${difficulty.toUpperCase()} Challenges:`);
    console.log('─'.repeat(70));

    for (const challenge of byDifficulty[difficulty]) {
      const passed = await runChallengeTest(challenge);
      allResults.push({ challenge: challenge.name, passed, difficulty });
      await new Promise(r => setTimeout(r, 300)); // Rate limit
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RESULTS SUMMARY\n');

  const passed = allResults.filter(r => r.passed).length;
  const total = allResults.length;

  // By difficulty
  for (const difficulty of difficultyOrder) {
    const diffResults = allResults.filter(r => r.difficulty === difficulty);
    if (diffResults.length === 0) continue;

    const diffPassed = diffResults.filter(r => r.passed).length;
    const status = diffPassed === diffResults.length ? '✅' : '⚠️';
    console.log(`${status} ${difficulty.toUpperCase()}: ${diffPassed}/${diffResults.length} passed`);
  }

  console.log(`\n📈 OVERALL: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);

  if (passed === total) {
    console.log('\n✅ All challenges solved successfully!');
  } else {
    console.log(`\n⚠️  ${total - passed} challenge(s) failed to solve correctly`);
    console.log('\nFailed challenges:');
    for (const result of allResults.filter(r => !r.passed)) {
      console.log(`  ❌ ${result.challenge}`);
    }
  }

  console.log('\n💡 NOTE: This is a simulated test that does NOT post to Moltbook');
  console.log('   Once satisfied with results, real end-to-end test can be run.\n');

  return passed === total ? 0 : 1;
}

runAllTests().then(exitCode => process.exit(exitCode)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
