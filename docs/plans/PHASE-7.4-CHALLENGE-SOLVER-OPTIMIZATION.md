# Phase 7.4: Challenge Solver Optimization

**Status**: In Progress
**Date Started**: 2026-02-24
**Goal**: Optimize proxy challenge solver for reliable Moltbook verification handling

## Problem Statement

The system can create posts but the intelligent proxy struggles to solve Moltbook verification challenges, particularly:
- Multi-step arithmetic calculations
- Heavily obfuscated text with symbols and mixed caps
- Challenges with alternating case patterns

Current issue: Posts get created but challenges aren't solved, blocking the end-to-end flow.

## Investigation Summary

### Test Framework Created ✅

1. **Simulated E2E Test** (`tests/simulated-e2e-test.js`)
   - Tests full flow WITHOUT posting to Moltbook
   - Avoids test pollution from repeated posts
   - Uses real Venice API for accuracy
   - Results: 3/6 tests pass (50% success)

2. **Model Comparison** (`tests/compare-venice-models.js`)
   - Benchmarks 4 different Venice models
   - Key finding: **llama-3.2-3b outperforms mistral-31-24b**

### Model Performance Data

| Model | Simple | Multi-step | Symbols | Score |
|-------|--------|------------|---------|-------|
| **llama-3.2-3b** ⭐ | ✅ | ~67% | ✅ | **2/3 (67%)** |
| mistral-31-24b | ✅ | ❌ | ❌ | 1/3 (33%) |
| qwen3-235b-a22b | ❌ | ❌ | ❌ | 0/3 (0%) |
| qwen3-4b | ❌ | ❌ | ❌ | 0/3 (0%) |

**Action Taken**: Updated proxy to use llama-3.2-3b as primary model.

## Challenge Categories & Difficulty

### Easy (2/2) ✅
- "25 + 12" → 37
- "50 - 8" → 42

### Medium (0/1) ❌
- "25 + 12 - 8" → expected 29, got 27

### Hard (1/2) ⚠️
- "TwEnTy FiVe PlUs TwElVe" → variable results
- "*25* + *12*" → sometimes correct

### Very Hard (0/1) ❌
- "t#WeNt$Y f%IvE + t@WeL#vE" → refuses/wrong answer

## Current Configuration

**File**: `/home/elvis/.moltbot/services/intelligent-proxy/index.js`

```javascript
const VENICE_PRIMARY_MODEL = "llama-3.2-3b";      // 67% success
const VENICE_FALLBACK_MODEL = "mistral-31-24b"; // 33% success
const PROMPT = "Parse the noise, do the math, return only the final numeric answer, no extra text";
const TEMPERATURE = 0.0;    // Deterministic
const MAX_TOKENS = 8;        // Focused answers
```

## Limitations

Even with the best model (llama), we see:
1. **Inconsistency**: Same challenge gets different answers on different runs
2. **Obfuscation limits**: Heavy symbol mixing breaks the model
3. **Multi-op struggles**: Multi-step arithmetic unreliable
4. **Hallucination**: Model sometimes generates wrong numbers instead of no answer

This appears to be a **model capability ceiling** rather than a configuration problem.

## Options for Further Improvement

### Option A: Intelligent Preprocessing (Medium effort)
- Detect pattern in obfuscation
- Extract numeric patterns before sending to model
- Example: Remove symbols, normalize case, preserve structure

**Pros**: No new model needed, applicable to all models
**Cons**: Pattern detection itself is complex, edge cases

### Option B: Try Different Provider
- Current: Venice API
- Could try: OpenAI GPT-4, Claude API, Anthropic endpoints
- Requires new API integration

**Pros**: Access to more capable models
**Cons**: New dependencies, potential rate limits, costs

### Option C: Accept Current Limitations
- Use llama-3.2-3b as-is (67% success)
- Deploy system as-is for production use
- Users may need to manually solve some challenges
- Can add "Help: Solve this challenge manually" feature

**Pros**: Ship quickly, real-world testing reveals patterns
**Cons**: Poor user experience, may erode trust

### Option D: Local Fallback Solver
- Implement local rule-based math parser
- Use for simple cases, fallback to model for complex
- Example: Regex for "X + Y - Z" patterns

**Pros**: Deterministic for simple cases
**Cons**: High maintenance, brittle code

## Recommendation

**Implement Option A** (Intelligent Preprocessing):
1. Add text preprocessing to extract numeric patterns
2. Parse obfuscated text to identify operands and operations
3. Fall back to model if preprocessing fails
4. This bridges the gap without new dependencies

**Short-term**: Deploy llama-3.2-3b (current config) - 67% success rate
**Medium-term**: Add preprocessing layer - likely reach 80%+ success
**Long-term**: Evaluate model upgrade path

## Testing Notes

To run tests without posting to Moltbook:

```bash
# Simulated E2E test (real Venice API, no posts)
node tests/simulated-e2e-test.js

# Model comparison (benchmark all models)
node tests/compare-venice-models.js
```

These tests use real API calls but mock out the post submission to Moltbook.

## Files Modified

- ✅ `/home/elvis/.moltbot/services/intelligent-proxy/index.js` - Model swap
- ✅ `/home/elvis/.moltbot/tests/simulated-e2e-test.js` - Created
- ✅ `/home/elvis/.moltbot/tests/compare-venice-models.js` - Created

## Next Steps

1. [ ] Review preprocessing approach design
2. [ ] Implement text preprocessing for obfuscation handling
3. [ ] Re-run simulated tests with preprocessing enabled
4. [ ] Measure improvement in success rate
5. [ ] Deploy to production with llama + preprocessing
6. [ ] Monitor real-world challenge success rates
7. [ ] Adjust based on production telemetry

---

**Ticket**: Phase 7.4 - Challenge Solver Optimization
**Last Updated**: 2026-02-24
