#!/usr/bin/env node

/**
 * Compare performance of different Venice API models
 * on challenge solving
 */

const fs = require('fs');
const path = require('path');

let VENICE_API_KEY = process.env.VENICE_API_KEY;
if (!VENICE_API_KEY) {
  try {
    const envPath = path.join(__dirname, '../.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^VENICE_API_KEY=(.+)$/m);
    if (match) {
      VENICE_API_KEY = match[1].trim();
    }
  } catch (err) {}
}

if (!VENICE_API_KEY) {
  console.error('❌ VENICE_API_KEY not found');
  process.exit(1);
}

const VENICE_API_URL = 'https://api.venice.ai/api/v1/chat/completions';
const TIMEOUT = 15000;

// Models to test
const MODELS = [
  'mistral-31-24b',      // Current
  'llama-3.2-3b',        // Current fallback
  'qwen3-235b-a22b-thinking-2507', // Previously tested
  'qwen3-4b',            // Previously tested
];

// Focused test cases (most representative)
const TEST_CASES = [
  { text: '25 + 12', answer: '37', type: 'simple' },
  { text: '25 + 12 - 8', answer: '29', type: 'multi' },
  { text: '*25* + *12*', answer: '37', type: 'symbols' },
];

async function testModel(model, testCase) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(VENICE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VENICE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: `Parse the noise, do the math, return only the final numeric answer, no extra text: ${testCase.text}`,
          },
        ],
        temperature: 0.0,
        max_tokens: 8,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `${response.status}` };
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content?.trim();

    return {
      success: !!answer,
      answer: answer || 'null',
      correct: answer === testCase.answer,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function compareModels() {
  console.log('\n🧪 VENICE API MODEL COMPARISON');
  console.log('═'.repeat(70));
  console.log('\nTesting models on challenge solving\n');

  const results = {};

  for (const model of MODELS) {
    console.log(`\n📊 Testing: ${model}`);
    console.log('─'.repeat(70));

    const modelResults = [];

    for (const testCase of TEST_CASES) {
      process.stdout.write(`  ${testCase.type.padEnd(10)}: "${testCase.text.substring(0,20).padEnd(20)}" → `);

      const result = await testModel(model, testCase);

      if (result.success) {
        if (result.correct) {
          console.log(`✅ ${result.answer}`);
          modelResults.push(true);
        } else {
          console.log(`⚠️  ${result.answer} (expected ${testCase.answer})`);
          modelResults.push(false);
        }
      } else {
        console.log(`❌ ${result.error || 'No response'}`);
        modelResults.push(false);
      }

      await new Promise(r => setTimeout(r, 300)); // Rate limit
    }

    const passed = modelResults.filter(r => r).length;
    results[model] = { passed, total: modelResults.length };
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('\n📊 COMPARISON SUMMARY\n');

  const sorted = Object.entries(results)
    .sort((a, b) => (b[1].passed / b[1].total) - (a[1].passed / a[1].total));

  for (const [model, stats] of sorted) {
    const pct = Math.round(stats.passed / stats.total * 100);
    const status = stats.passed === stats.total ? '🏆' : '⚠️';
    console.log(`${status} ${model.padEnd(35)} ${stats.passed}/${stats.total} (${pct}%)`);
  }

  const best = sorted[0];
  console.log('\n💡 Recommendation:');
  if (best[1].passed === best[1].total) {
    console.log(`   Use: ${best[0]}`);
    console.log(`   ✅ 100% success rate on test cases`);
  } else {
    console.log(`   Current best: ${best[0]}`);
    console.log(`   Success rate: ${best[1].passed}/${best[1].total}`);
  }

  console.log('\n');
}

compareModels().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
