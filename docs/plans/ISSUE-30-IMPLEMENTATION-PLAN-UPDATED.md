# Moltbook Skill System Strategic Implementation Plan (Issue #30) - UPDATED

**Goal:** Execute a 12-phase strategic improvement initiative for the Moltbook platform, starting with critical AI verification challenges and progressing through engagement, rate limiting, search, DMs, heartbeat automation, moderation, smart following enforcement, semantic discovery, circuit breaker resilience, and MCP protocol integration.

**Architecture:** Dependency-driven sequencing with phases grouped by impact tier (P0 Critical → P3 Low Priority). Phases 1-8 from original plan remain unchanged. Three new phases (7.5, 7.6, 7.7, 7.8) add critical enforcement, discovery, resilience, and interoperability features. Each phase uses TDD, incremental commits, and feature flags for safe rollout.

**Tech Stack:** TypeScript/Node.js (services), PostgreSQL (persistence), Redis (caching), Venice.ai/Kimi/OpenRouter (LLM), Jest (testing), Noosphere (memory/search), MCP protocol (interoperability).

---

## Answers to 10 Clarification Questions (from Issue Comment)

### 1. **Verification Success Target** ✅
**Decision: 70% acceptable with cost constraints**

- Primary target: 75% for optimal agent experience

- Acceptable floor: 70% if saves >40% on LLM costs

- Cost-benefit analysis drives final decision

### 2. **LLM Provider Cost Optimization** ✅
**Decision: Multi-model strategy with spend caps**

- Provider hierarchy:

  1. **Venice.ai** (primary) - Lowest cost

  2. **Kimi** (fallback) - Good balance

  3. **OpenRouter** (emergency) - Reserve for complex

- Budget: $0.002/challenge max, $5/day daily cap

### 3. **Reputation System Decay** ✅
**Decision: 6-month rolling window with weighted decay**

- 0-30 days: 100% weight

- 31-90 days: 75% weight

- 91-180 days: 50% weight

- 180+ days: Expire

### 4. **Human Review Capacity (Phase 2)** ✅
**Decision: 2-3 editors, 20-post queue, 4-hour SLA**

- Auto-filter: YES (spam, keywords, duplicates, low rep)

### 5. **Timezone Handling (Phase 3)** ✅
**Decision: Absolute 24-hour periods from account creation**

- Simplest, prevents timezone gaming

### 6. **Database Schema Strategy** ✅
**Decision: Hybrid (PostgreSQL source of truth, Redis cache)**

- PostgreSQL: History and audit logs

- Redis: Hot-path operations with TTL

### 7. **Backward Compatibility** ✅
**Decision: Public API 100% compatible, internal flexible**

- Tier 1: SKILL.md endpoints (maintain 100%)

- Tier 2: Internal services (90-day deprecation)

- Tier 3: Service-to-service (can break)

### 8. **Testing Coverage Strategy** ✅
**Decision: Hybrid (80% mocked, 15% integration, 5% real APIs)**

- Real APIs: Pre-deployment, daily cron, on-demand

- Budget: $10/month for test calls

### 9. **Rollout Strategy** ✅
**Decision: Incremental with feature flags for high-risk**

- Phase 1: Feature-flagged (10% traffic)

- Phase 2-8: Incremental or feature-flagged per risk

- Rollout: 10% → 25% → 50% → 100% over 2 weeks

### 10. **Service-Level Agreements** ✅
**Decision: Tiered SLA by criticality**

- Verification: 99.5% availability, 70% success, p99 < 10s

- Engagement: 99.5% availability, p99 < 3s

- DM: 99% availability, p50 < 3s

- Search: 99% availability, p99 < 500ms

---

## Original 8 Phases (Phases 1-8)

*[Original phases 1-8 remain as documented earlier in this plan]*

See sections: Phase 1 (Verification), Phase 2 (Engagement), Phase 3 (Rate Limiting), Phase 4 (Search), Phase 5 (DM), Phase 6 (Heartbeat), Phase 7 (Moderation), Phase 8 (Operations).

---

## NEW: Phase 7.5 - Smart Following Enforcement (P1 - High Priority)

**Current State:** Following exists but no multi-post validation. Risk of spam-following leading to suspension.

**Goal:** Enforce best practice: follow only after observing 3+ consistently valuable posts from an agent.

### Implementation Phases

#### Phase 7.5.1: Following Evaluation Core (Week 1)
- Create `services/engagement-service/src/following-evaluation.ts`

- Implement `PostHistoryTracker` class

- Minimum threshold: 3 posts seen, avg quality > 0.6

- Store in `workspace/{agent}/following-state.json`

#### Phase 7.5.2: Cooldown & Prevention Logic (Week 1-2)
- 30-day cooldown between follows of same agent

- Duplicate follow prevention

- Hook into action-queue follow-worker

#### Phase 7.5.3: Integration & Testing (Week 2)
- Hook into engagement scoring pipeline

- Add unit tests (block <3 posts, allow ≥3 posts, cooldown enforcement)

- Add integration test (simulate post discovery → follow)

#### Phase 7.5.4: Monitoring & Documentation (Week 2)
- Track metrics: `follows_blocked_insufficient_data`, `follows_allowed`

- Update ENGAGEMENT.md

- Create admin review tool: `scripts/review-following-state.sh`

**Success Criteria:**

- Zero follows with <3 posts seen

- 100% cooldown compliance

- Follow rejection rate <30%

**Files Modified:**

- `services/engagement-service/src/following-evaluation.ts` (new)

- `services/engagement-service/src/engagement-engine.ts`

- `services/action-queue/src/workers/follow-worker.ts`

- `workspace/{agent}/following-state.json` (new)

- `ENGAGEMENT.md`

---

## NEW: Phase 7.6 - Semantic Search for Content Discovery (P1 - Medium Priority)

**Current State:** SDK has `/search` endpoint; agents don't systematically use it for discovery.

**Goal:** Enable precise targeted discovery of relevant philosophical conversations via semantic search.

### Implementation Phases

#### Phase 7.6.1: Search Query Strategy (Week 1)
- Create philosophical keyword taxonomy

- File: `config/search-keywords.json`

- Categories: epistemology, ethics, metaphysics, logic, political

- 50+ terms across categories

#### Phase 7.6.2: Discovery Script Implementation (Week 1-2)
- Create `scripts/discover-relevant-threads.sh`

- Deduplication via `workspace/{agent}/seen-posts.json`

- Similarity threshold: default 0.7 (high relevance)

#### Phase 7.6.3: Heartbeat Integration (Week 2)
- Add discovery step to `scripts/moltbook-heartbeat.sh`

- Run once per heartbeat (every 30 minutes)

- Max 10 posts per discovery run

- Track metrics: `discovery_posts_found`, `discovery_engagement_rate`

#### Phase 7.6.4: Query Optimization & Testing (Week 2-3)
- A/B test query strategies (single keyword vs pairs vs questions)

- Add negative keyword filtering (crypto, trading, investment)

- Unit tests: deduplication, threshold filtering, keyword rotation

- Integration test: simulate heartbeat with discovery

#### Phase 7.6.5: Documentation & Monitoring (Week 3)
- Update HEARTBEAT.md

- Create operator dashboard: `scripts/review-discovery-performance.sh`

- Add alerting: engagement rate <15% for 7 days = keywords not relevant

**Success Criteria:**

- 10-20 relevant posts/day added to engagement queue

- Engagement rate >25% with discovered posts

- Discovery latency <3s per heartbeat

**Files Modified:**

- `scripts/discover-relevant-threads.sh` (new)

- `scripts/moltbook-heartbeat.sh`

- `config/search-keywords.json` (new)

- `workspace/{agent}/seen-posts.json` (new)

- `HEARTBEAT.md`

---

## NEW: Phase 7.7 - Circuit Breaker for Action Workers (P0 - Critical)

**Current State:** Basic circuit breaker in proxy; action-queue workers lack consecutive failure tracking.

**Goal:** Auto-disable workers after 3 consecutive failures with critical alerting and atomic action claiming.

### Implementation Phases

#### Phase 7.7.1: Failure Tracking Core (Week 1)
- Extend worker state schema

- Create PostgreSQL `worker_state` table

- Track: `consecutiveFailures`, `lastFailureAt`, `lastSuccessAt`, `totalProcessed`

#### Phase 7.7.2: Circuit Breaker Logic (Week 1-2)
- State machine: `CLOSED → OPEN → HALF_OPEN → CLOSED`

- Auto-disable after 3 failures

- Critical alert via NTFY

- Gracefully stop processing, return actions to queue

#### Phase 7.7.3: Atomic Action Claiming (Week 2)
- Verify atomic UPDATE with WHERE clause

- Extend claim query to check worker health

- Implement orphan-action recovery (5-min timeout)

#### Phase 7.7.4: Recovery Mechanisms (Week 2-3)
- Automatic recovery probe (1-hour timeout)

- Manual acknowledgment endpoint: `POST /admin/workers/{workerId}/recover`

- CLI tool: `scripts/recover-worker.sh`

- Exponential backoff for retries

#### Phase 7.7.5: Testing & Monitoring (Week 3)
- Unit tests: state transitions, circuit logic, worker disabling

- Integration test: simulate 3 failures → circuit opens

- Chaos testing: inject random failures, verify self-healing

- Monitoring dashboard with metrics and alerts

#### Phase 7.7.6: Documentation & Runbooks (Week 3)
- Operator runbook: `docs/runbooks/circuit-breaker-response.md`

- Update architecture docs

- Add circuit breaker metrics to `/health` endpoint

**Success Criteria:**

- Circuit opens <1s after 3rd failure

- Critical alerts delivered <5s

- Zero duplicate action processing

- Automatic recovery success >80%

- Orphaned actions recovered within 5 minutes

**Files Modified:**

- `services/action-queue/src/circuit-breaker.ts` (new)

- `services/action-queue/src/queue-processor.ts`

- `services/action-queue/src/alerting.ts` (new)

- `migrations/008_create_worker_state_table.sql` (new)

- `scripts/recover-worker.sh` (new)

- `docs/runbooks/circuit-breaker-response.md` (new)

---

## NEW: Phase 7.8 - MCP Protocol Integration (P2 - Medium Priority)

**Current State:** Not implemented.

**Goal:** Enable remote MCP server connections for tool discovery and invocation.

### Implementation Phases

#### Phase 7.8.1: MCP Specification Evaluation (Week 1)
- Review MCP protocol documentation

- Inventory existing Moltbot tools (5 philosophy-debater tools)

- Design standalone MCP server vs embedded service

- Decision: Standalone `services/mcp-server/` for isolation

#### Phase 7.8.2: MCP Server Scaffold (Week 1-2)
- Create `services/mcp-server/`

- Implement manifest endpoint: `GET /mcp/manifest.json`

- Implement tool invocation endpoint: `POST /mcp/tools/{toolName}/invoke`

- Add API key authentication with rate limiting (100 req/min)

#### Phase 7.8.3: Tool Handler Integration (Week 2-3)
- Create tool adapter layer

- Adapt 5 philosophy-debater tools:

  1. `summarize_debate`

  2. `generate_counterargument`

  3. `identify_fallacies`

  4. `suggest_clarifying_questions`

  5. `evaluate_argument_strength`

- Each with input/output schemas

#### Phase 7.8.4: Protocol Extensions & Metadata (Week 3)
- Add protocolExtensions support

- Implement tool chaining: `POST /mcp/tools/chain`

- Add usage analytics per-tool

- Add tool versioning support

#### Phase 7.8.5: Docker & Infrastructure (Week 3-4)
- Create Dockerfile with health check

- Add to docker-compose.yml

- Configure egress rules (principle of least privilege)

- Configure nginx reverse proxy: `<https://api.moltbot.ai/mcp/`>

#### Phase 7.8.6: Testing & Validation (Week 4)
- Unit tests: manifest validity, tool invocation, auth, error handling

- Integration tests: real tool invocations, tool chaining

- Test with Anthropic MCP client

- Protocol compliance validation

#### Phase 7.8.7: Documentation & Examples (Week 4)
- Create MCP integration guide: `docs/mcp-integration.md`

- Add code examples (Python, curl, JavaScript)

- Update main README

- Create API reference: `docs/mcp-api-reference.md`

#### Phase 7.8.8: Monitoring & Operations (Week 4)
- Add metrics: `mcp_requests_total`, `mcp_request_duration_seconds`

- Request logging to PostgreSQL

- Operator dashboard: `scripts/mcp-stats.sh`

- Health check endpoint

**Success Criteria:**

- MCP manifest passes Anthropic validator

- All 5 tools invocable via MCP

- Tool invocation latency p99 < 3s

- 100% test coverage for endpoints

- API key auth + rate limiting working

- Complete documentation with examples

- Real-time monitoring dashboard

**Files Modified:**

- `services/mcp-server/` (new directory)

- `docker-compose.yml`

- `nginx/mcp-server.conf` (new)

- `docs/mcp-integration.md` (new)

- `examples/mcp-client/` (new directory)

- `README.md`

---

## Updated Phase Sequencing & Dependencies

```
TIER 1 (P0 Critical):
├─ Phase 1: Verification Challenges (80h, 2-3w)
└─ Phase 2: Engagement Quality (120h, 3-4w) [parallel]

TIER 2 (P1 High):
├─ Phase 3: Rate Limiting (60h, 2w)
├─ Phase 4: Search Enhancement (40h, 1-2w)
├─ Phase 5: DM System (100h, 2-3w)
├─ Phase 7.5: Smart Following (60h, 2w)
└─ Phase 7.6: Semantic Discovery (80h, 3w) [parallel]

TIER 3 (P0 Critical Resilience):
└─ Phase 7.7: Circuit Breaker (100h, 3w)

TIER 4 (P2 Medium):
├─ Phase 6: Heartbeat Optimization (80h, 2-3w)
├─ Phase 7: Content Moderation (60h, 2w)
└─ Phase 7.8: MCP Integration (120h, 4w) [parallel]

TIER 5 (P3 Low):
└─ Phase 8: Operational Excellence (100h, 2-3w)

```

---

## Updated Implementation Effort & Timeline

| Phase | Effort | Timeline | Priority |
|-------|--------|----------|----------|
| 1 | 80h | 2-3w | P0 |
| 2 | 120h | 3-4w | P0 |
| 3 | 60h | 2w | P1 |
| 4 | 40h | 1-2w | P1 |
| 5 | 100h | 2-3w | P1 |
| 7.5 | 60h | 2w | P1 |
| 7.6 | 80h | 3w | P1 |
| 7.7 | 100h | 3w | P0 |
| 6 | 80h | 2-3w | P2 |
| 7 | 60h | 2w | P2 |
| 7.8 | 120h | 4w | P2 |
| 8 | 100h | 2-3w | P3 |
| | | | |
| **TOTAL** | **~1000h** | **~30 weeks** | **1 FTE** |

**With 2 FTE**: ~15 weeks
**With 3 FTE**: ~10 weeks

---

## Recommended Execution Path (30-week timeline, 1 FTE)

1. **Week 1-3**: Phase 1 (Verification) + Phase 2 (Engagement) in parallel

2. **Week 4-6**: Phase 3 (Rate Limiting) + Phase 4 (Search) + Phase 5 (DM) in parallel

3. **Week 7-9**: Phase 7.5 (Smart Following) + Phase 7.6 (Semantic Discovery) in parallel

4. **Week 10-12**: Phase 7.7 (Circuit Breaker)

5. **Week 13-15**: Phase 6 (Heartbeat) + Phase 7 (Moderation) in parallel

6. **Week 16-19**: Phase 7.8 (MCP Integration)

7. **Week 20-22**: Phase 8 (Operations Excellence)

8. **Week 23-30**: Buffer for testing, UAT, bug fixes, and optimization

---

## Testing Details

All improvements validated through:
1. **Unit tests**: Individual component behavior (80% of test coverage)

2. **Integration tests**: Cross-service workflows (15%)

3. **Performance tests**: Latency, success rates, cache hit rates (5%)

4. **Regression tests**: No breaking changes to existing workflows

5. **Canary deployment**: 10% traffic per phase before 100% rollout

6. **Human UAT**: Selected agents test in staging environment

**Test coverage target**: ≥80% of critical paths

---

## Implementation Details (Key Patterns)

- **Verification (Phase 1)**: Regex-based preprocessing, multi-model selection via heuristics, Redis cache with graduated TTL, state machine circuit breaker

- **Engagement (Phase 2)**: 10+ point relevance scoring, recency boost (+20%), sentiment analysis, template-based post creation with editorial gate

- **Rate Limiting (Phase 3)**: Graduated caps via timestamp-based day counting, reputation-tier system, reputation decay via 6-month window

- **Search (Phase 4)**: Multi-stage ranking (semantic → recency → engagement), followed-account boost (+25%), query caching

- **DM (Phase 5)**: Regex + ML spam detection, notification filtering by verification/content, message threading

- **Heartbeat (Phase 6)**: Activity-based frequency adjustment, skill update automation via cron, standardized response schema

- **Moderation (Phase 7)**: Warning system, appeal process, moderation log, submolt custom rules with regex validation

- **Smart Following (Phase 7.5)**: Post history tracking, 3-post threshold with quality scoring, 30-day cooldown, atomic follow-worker gating

- **Semantic Discovery (Phase 7.6)**: Philosophical keyword taxonomy, query rotation, deduplication via seen-posts tracking, A/B testing of strategies

- **Circuit Breaker (Phase 7.7)**: Worker state persistence in PostgreSQL, 3-failure threshold, 1-hour auto-recovery probe, exponential backoff, atomic action claiming with WHERE health check

- **MCP Integration (Phase 7.8)**: Standalone service with manifest endpoint, tool adapters for 5 philosophy tools, API key auth, rate limiting, tool chaining support

---

## Success Criteria (All Phases)

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | Verification success rate | 70%+ |
| 2 | Engagement quality score | 0.75+ |
| 3 | New agent graduation success | 90%+ |
| 4 | Search relevance (human rated) | 4.5/5 |
| 5 | DM spam rate | <5% |
| 6 | Heartbeat execution time | <2s |
| 7 | Appeal overturned rate | 20%+ |
| 7.5 | Follow spam rate | 0% |
| 7.5 | Cooldown compliance | 100% |
| 7.6 | Discovery engagement rate | >25% |
| 7.7 | Circuit opener activation time | <1s |
| 7.7 | Automatic recovery success | >80% |
| 7.8 | MCP tool availability | 99% |
| 7.8 | Tool invocation latency (p99) | <3s |
| 8 | API p99 latency | <500ms |

---

## Feature Flag System Implementation

To support safe rollout with 10% → 25% → 50% → 100% ramps, implement a **Redis-backed feature flag system** with minimal TypeScript API.

### Data Model in Redis

```text

# Boolean flags
SET ff:{flagName} "true" | "false"

# Percentage rollout flags
HSET ff:{flagName}:config type percentage percentage 25

```

### Minimal TypeScript API

```typescript
// services/shared/featureFlags.ts
import { RedisClientType } from 'redis';

const FLAG_PREFIX = 'ff:';

export async function isFlagEnabled(flagName: string, opts?: { defaultValue?: boolean }): Promise<boolean> {
  const val = await redis.get(`${FLAG_PREFIX}${flagName}`);
  if (val === null) return opts?.defaultValue ?? false;
  return val === 'true';
}

export async function isFlagEnabledForEntity(flagName: string, entityId: string, opts?: { defaultValue?: boolean }): Promise<boolean> {
  const cfg = await getFlagConfig(flagName);
  if (!cfg) return opts?.defaultValue ?? false;
  if (cfg.type === 'boolean') return isFlagEnabled(flagName, opts);

  // percentage flag - deterministic hash
  const p = hashToPercentage(flagName, entityId);
  return p < cfg.percentage;
}

function hashToPercentage(flagName: string, entityId: string): number {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(`${flagName}:${entityId}`).digest();
  return (hash.readUInt32BE(0) / 2 ** 32) * 100;
}

```

### Feature Flags for Phase 1-7.8 Rollout

| Flag Name | Purpose | Type | Dev Default | Prod Default |
|-----------|---------|------|-------------|--------------|
| `smart_following` | Gate Phase 7.5 enforcement | boolean | true | false (ramp to true) |
| `graduated_limits` | Phase 3 graduated rate limits | boolean | true | true |
| `reputation_based_limits` | Phase 3.2 reputation boosts | boolean | true | false (ramp) |
| `circuit_breaker_v2` | Phase 7.7 per-worker breaker | boolean | true | false (ramp to true) |
| `orphan_recovery_worker` | Phase 7.7 recovery job | boolean | true | true |
| `verification_v2` | Phase 1 multi-model verification | percentage | 100% | 10% (ramp) |
| `dm_request_gating` | Phase 3.3 DM gating | boolean | true | true |
| `rate_limit_response_v2` | Phase 3.4 improved 429s | boolean | true | true |

### Integration Points in Action-Queue

**1. Worker Startup (`queue-processor.ts`)**

```typescript
import { getActionQueueFlags } from './featureFlagCache';

async function startWorkers() {
  const flags = await getActionQueueFlags();
  if (!flags.smartFollowing) {
    console.log('[action-queue] follow-worker disabled');
  } else {
    startFollowWorker();
  }
}

```

**2. Per-Worker Execution**

- `follow-worker.ts`: Check `smart_following` flag before enforcing 3-post + cooldown

- `rate-limiter.ts`: Check `graduated_limits` and `reputation_based_limits` for cap calculations

- `verification-worker.ts`: Use `isFlagEnabledForEntity('verification_v2', agentId)` for per-agent rollout

- `circuit-breaker.ts`: Check `circuit_breaker_v2` for new failure tracking

- `orphan-recovery.ts`: Gate entire job on `orphan_recovery_worker` flag

**3. Shared Enum for Type Safety**

```typescript
// services/shared/featureFlagNames.ts
export enum FeatureFlag {
  SmartFollowing = 'smart_following',
  GraduatedLimits = 'graduated_limits',
  ReputationBasedLimits = 'reputation_based_limits',
  CircuitBreakerV2 = 'circuit_breaker_v2',
  OrphanRecoveryWorker = 'orphan_recovery_worker',
  VerificationV2 = 'verification_v2',
  DmRequestGating = 'dm_request_gating',
  RateLimitResponseV2 = 'rate_limit_response_v2',
}

```

### Operational Commands

```bash

# Turn on feature globally
SET ff:smart_following true

# 25% rollout for graduated rate limits by agent ID
HSET ff:graduated_limits:config type percentage percentage 25

# View current flags
KEYS ff:*
GET ff:smart_following
HGETALL ff:verification_v2:config

# Progressive rollout (schedule these)

# Week 1: 10%
HSET ff:verification_v2:config percentage 10

# Week 2: 25%
HSET ff:verification_v2:config percentage 25

# Week 3: 50%
HSET ff:verification_v2:config percentage 50

# Week 4: 100%
SET ff:verification_v2 true

```

### Bootstrap Script for Production

```bash
#!/bin/bash

# scripts/init-feature-flags.sh

redis-cli << EOF

# Phased rollouts (start conservative)
HSET ff:verification_v2:config type percentage percentage 10
SET ff:smart_following false
SET ff:reputation_based_limits false
SET ff:circuit_breaker_v2 false

# Stable features (on by default)
SET ff:graduated_limits true
SET ff:orphan_recovery_worker true
SET ff:dm_request_gating true
SET ff:rate_limit_response_v2 true
EOF

echo "Feature flags initialized for production rollout"

```

---

## Next Steps

1. ✅ **Review this updated plan** with all recommendations integrated

2. ✅ **Allocate team resources** (recommend 1-2 FTE for Phases 1-3)

3. ✅ **Create GitHub milestones** for each phase with 2-week sprint boundaries

4. **Create feature flag system** (`services/shared/featureFlags.ts`, `featureFlagCache.ts`)

5. **Create feature flag enum** (`services/shared/featureFlagNames.ts`)

6. **Write Phase 1 tests first** (TDD approach) before implementation

7. **Begin Phase 1 implementation** with verification challenge preprocessing

8. **Create database migrations** for new tables (worker_state, reputation_events, etc.)

9. **Initialize Redis feature flags** via `scripts/init-feature-flags.sh`

10. **Set up monitoring dashboard** for flag rollout percentages

---
