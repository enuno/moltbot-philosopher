# P4.1 Hybrid Search Refinement - Design Document

**Date**: 2026-02-27
**Phase**: P4.1 (Hybrid Search Refinement)
**Issue**: GitHub #38 Phase 4 Semantic Search Enhancement
**Status**: Design Approved

## Overview

Extend Moltbot's semantic search with multi-factor scoring to improve relevance ranking by combining:
- Semantic similarity (existing TF-IDF)
- Post recency (exponential decay)
- Author reputation (hybrid historical + recent engagement)
- Follow relationship boost

All factors are independently configurable via feature flags and tunable exponents, enabling safe A/B testing without code changes.

## Design Goals

1. **Improve ranking quality** - Posts ranked by relevance + freshness + author credibility
2. **Preserve observability** - All intermediate scores visible via debug output
3. **Enable tuning** - Runtime feature flags and exponent tweaks for experimentation
4. **Maintain backward compatibility** - Existing semantic search unchanged; scoring is additive
5. **Support safe rollout** - Per-factor feature flags for gradual deployment

## Architecture

### Scoring Pipeline

```
POST (id, content, author, age, upvotes, comments)
    ↓
Semantic Score [0, 1] (existing TF-IDF)
    ↓
Recency Multiplier: M_r = (0.5 ^ (age_days / 7)) ^ RECENCY_EXPONENT
    ↓
Reputation Multiplier: M_rep = clamp(1.0 + H×hist + R×recent, 0.5, 1.5) ^ REPUTATION_EXPONENT
    ↓
Follow Boost: F = 1.25 (if agent follows author) or 1.0 (else)
    ↓
Combined Score: semantic × M_r × M_rep × F
    ↓
Per-Query Normalization: (score - min) / (max - min) → [0, 1]
    ↓
Ranked Output [Post[], sorted by score desc]
```

### Data Requirements

**Per-Post** (from Moltbook API):
- `id`, `title`, `content`, `authorName`
- `createdAt` (for age calculation)
- `score` (upvotes - downvotes)
- `commentCount`

**Per-Agent** (from engagement-service):
- Follow graph: `agent.following: Set<authorName>`

**Per-Author** (from P2.2 + engagement service):
- Historical quality score (0-1 scale)
- Recent engagement metrics (normalized upvotes + comments)

### Formulas

#### Recency Multiplier

Exponential decay with 7-day half-life:

```
M_recency = (0.5 ^ (age_days / 7)) ^ RECENCY_EXPONENT

where:
  age_days = (now - createdAt) / (24 * 3600 * 1000)
  RECENCY_EXPONENT ∈ [0.5, 2.0] (default: 1.0)
```

**Behavior**:
- RECENCY_EXPONENT = 1.0: Standard half-life (1-day old post = 0.89x, 7-day old = 0.5x, 14-day old = 0.25x)
- RECENCY_EXPONENT = 0.5: Less penalty for age
- RECENCY_EXPONENT = 2.0: More penalty for age

#### Reputation Multiplier

Hybrid of historical quality (long-term) + recent engagement (short-term):

```
M_reputation = clamp(1.0 + (HISTORICAL_WEIGHT × historical) + (RECENT_WEIGHT × recent), 0.5, 1.5) ^ REPUTATION_EXPONENT

where:
  historical = author's P2.2 quality score (0-1 scale)
  recent = normalized recent engagement (0-1 scale)
  HISTORICAL_WEIGHT = 0.5 (default)
  RECENT_WEIGHT = 0.25 (default)
  REPUTATION_EXPONENT ∈ [0.5, 2.0] (default: 1.0)
  clamp() = max(0.5, min(1.5, x))
```

**Behavior**:
- Author with historical score 0.8 + recent score 0.6: M_rep = clamp(1.0 + 0.5×0.8 + 0.25×0.6, 0.5, 1.5) = clamp(1.55, 0.5, 1.5) = 1.5
- Author with historical score 0.2 + recent score 0.1: M_rep = clamp(1.0 + 0.5×0.2 + 0.25×0.1, 0.5, 1.5) = clamp(1.075, 0.5, 1.5) = 1.075
- Clamping prevents outliers from dominating (floor 0.5x, ceiling 1.5x)

#### Follow Boost

Simple binary multiplier:

```
F = 1.25 if (agent follows post author) else 1.0
```

Checked via agent's in-memory follow graph.

#### Final Score

Multiplicative combination:

```
final_score = semantic_score × M_recency × M_reputation × F
```

All factors normalized to [0, 1] using per-query min-max:

```
normalized_score = (final_score - min_in_query) / (max_in_query - min_in_query)
```

### Configuration

**Single source of truth**: `services/noosphere-service/src/config.ts`

All flags and exponents are environment variables with sensible defaults:

```typescript
export const SEARCH_CONFIG = {
  // Feature flags
  enableRecency: env.SEARCH_ENABLE_RECENCY !== "false",      // default: true
  enableReputation: env.SEARCH_ENABLE_REPUTATION !== "false", // default: true
  enableFollowBoost: env.SEARCH_ENABLE_FOLLOW_BOOST !== "false", // default: true
  debugScoring: env.SEARCH_DEBUG_SCORING === "true",         // default: false

  // Exponents
  recencyExponent: parseFloat(env.SEARCH_RECENCY_EXPONENT || "1.0"),     // default: 1.0
  reputationExponent: parseFloat(env.SEARCH_REPUTATION_EXPONENT || "1.0"), // default: 1.0

  // Weights
  historicalWeight: parseFloat(env.SEARCH_HISTORICAL_WEIGHT || "0.5"),  // default: 0.5
  recentWeight: parseFloat(env.SEARCH_RECENT_WEIGHT || "0.25"),        // default: 0.25

  // Recency half-life (days)
  recencyHalfLife: parseFloat(env.SEARCH_RECENCY_HALF_LIFE || "7"),    // default: 7
};
```

## Implementation Phases

### P4.1: SDK Scoring Foundation

**Objective**: Add core scoring logic to Moltbook SDK

**Files**:
- `services/moltbook-sdk/src/resources/search.ts` - Add `scorePost()` function
- `services/moltbook-sdk/src/types.ts` - Add scoring input/output types

**Deliverables**:
- `scorePost(input: PostScoringInputs, weights: ScoringWeights): ScoringResult` function
- Supporting functions: `calculateRecency()`, `calculateReputation()`, `normalizeScores()`
- TypeScript types for all scoring inputs and outputs
- Unit tests for each multiplier

### P4.2: Noosphere Integration

**Objective**: Wire scoring into semantic search pipeline

**Files**:
- `services/noosphere-service/src/search/SemanticSearch.ts` - Call `scorePost()` on results
- `services/noosphere-service/src/engine.ts` - Pass follow graph to Search instance

**Deliverables**:
- Integration of scoring into `search()` method
- Follow graph passed from agent context
- Debug output when enabled
- Integration tests validating ranked order

### P4.3: Runtime Controls & Testing

**Objective**: Add feature flags, config management, and comprehensive tests

**Files**:
- `services/noosphere-service/src/config.ts` - Centralized config (NEW)
- `services/noosphere-service/src/search/SemanticSearch.ts` - Respect feature flags
- Tests for all scoring scenarios

**Deliverables**:
- Feature flag-controlled scoring (each factor independently disable-able)
- Debug JSON output showing all intermediate calculations
- E2E tests validating ranking quality
- A/B tuning test suite for exponent experimentation

## Testing Strategy

### Unit Tests

- `calculateRecency()` with various ages and exponents
- `calculateReputation()` with various historical/recent scores and weights
- `normalizeScores()` with min-max edge cases
- Feature flag enable/disable logic

### Integration Tests

- Full pipeline with mock posts
- Ranking order validation (higher quality posts rank first)
- Normalization correctness
- Debug output structure

### E2E Tests

- Real semantic search results + scoring
- Verify posts by followed authors rank higher
- Verify fresh posts rank higher than old posts
- Verify high-reputation authors rank higher

### A/B Tuning Tests

- Verify `RECENCY_EXPONENT=2.0` produces steeper decay than `1.0`
- Verify `REPUTATION_EXPONENT=0.5` produces smaller differences than `1.0`
- Verify weight adjustments produce predictable ranking shifts

## Debug Output

When `SEARCH_DEBUG_SCORING=true`, include intermediate scores in response:

```json
{
  "posts": [
    {
      "id": "post-123",
      "title": "...",
      "score": 0.92,
      "debug": {
        "semanticScore": 0.85,
        "recencyMultiplier": 0.95,
        "reputationMultiplier": 1.2,
        "followBoost": 1.25,
        "combinedScore": 0.92,
        "normalizedScore": 0.92
      }
    }
  ]
}
```

## Success Criteria

- [ ] All unit tests pass (multipliers, normalization)
- [ ] Integration tests pass (pipeline, ranking order)
- [ ] Feature flags work independently (enable/disable each factor)
- [ ] Debug output matches calculated values
- [ ] A/B tuning tests demonstrate exponent effects
- [ ] No regressions in existing semantic search behavior
- [ ] Documentation updated (SDK, service, config)

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Scoring breaks semantic search | Feature flags allow disable (SEARCH_ENABLE_*=false) |
| Exponents cause poor rankings | Debug output enables quick diagnosis; A/B tests validate tuning |
| Performance regression | Scoring is O(n) per query; caching can be added later |
| Missing author data | Fallback to reputation multiplier = 1.0 if data unavailable |
| Follow graph stale | Refresh on agent startup; TTL-based cache invalidation |

## Timeline

- **P4.1**: 6-8 hours (SDK scoring foundation + unit tests)
- **P4.2**: 4-6 hours (Noosphere integration + integration tests)
- **P4.3**: 4-6 hours (Config, feature flags, E2E tests + tuning suite)
- **Total**: ~14-20 hours

---

*Design approved 2026-02-27. Ready for implementation planning.*
