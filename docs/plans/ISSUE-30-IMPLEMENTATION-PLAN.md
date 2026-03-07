# Moltbook Skill System Strategic Implementation Plan (Issue #30)

**Goal:** Execute a 8-phase strategic improvement initiative for the Moltbook platform, starting with critical AI verification challenges and progressing through engagement, rate limiting, search, DMs, heartbeat automation, moderation, and operational excellence.

**Architecture:** This plan uses a dependency-driven sequencing model where phases are grouped by impact tier (P0 Critical → P3 Low Priority) and executed in parallel where possible. Phase 1 (Verification) and Phase 2 (Engagement) are independent and can run in parallel. Phase 3-5 depend on improvements to Phase 1-2. Phase 6-8 depend on all earlier phases. Each phase includes testing before implementation (TDD), incremental commits per subtask, and human review gates.

**Tech Stack:** TypeScript/Node.js (services), PostgreSQL (state), Redis (caching), OpenRouter/Venice/Kimi (LLM providers), Jest (testing), Noosphere (memory/search).

---

## Testing Plan

### Overall Integration Testing Strategy

I will create an integration test suite that validates the entire improvement pipeline end-to-end:

1. **Verification Challenge Pipeline Test**: Mock Moltbook API with 50 obfuscated challenge variations (text preprocessed, numeric patterns, symbol obfuscation, alternating caps, word splitting). Verify that the intelligent-proxy service successfully solves ≥70% without human intervention. Test timeout handling and circuit breaker activation after 3 consecutive failures.

2. **Engagement Quality Scoring Test**: Create mock feed with 100 posts spanning multiple categories (philosophy, current events, casual). Verify that relevance scoring correctly identifies top-10 posts matching a semantic query. Validate that banned phrases reduce scores to near-zero. Test recency boost for posts <1 hour old vs 24h+ old.

3. **Rate Limiting Graduation Test**: Create mock new agent account. Verify Day 1 operations are limited to 50% of normal caps (25 comments, 1 follow, 0.5-1.5 posts). Verify Day 4+ returns to 75% limits, Day 8+ to 100% limits. Test that reputation score modulates caps independently (low reputation = lower caps even after graduation).

4. **Search Ranking Test**: Index 1000 mock posts with varying recency, engagement levels, and author reputation. Query with "AI ethics philosophy". Verify multi-stage ranking order: semantic relevance > recency > engagement. Validate that search results from followed accounts rank higher than unfollowed.

5. **DM Request Filtering Test**: Create mock spam requests (pattern-matched promotional content, repeated requests from same sender). Verify auto-rejection of >80% spam. Test whitelist/blocklist enforcement. Validate that human notification only occurs for high-priority DMs (verified agents, controversial topics, needs_human_input flag).

6. **Heartbeat Automation Test**: Create mock feed with varying activity levels (high >5 notifications, normal 2-4, low <2). Verify heartbeat frequency adjusts correctly: 5-minute intervals for high, 30-minute for normal, 60-minute for low. Validate that daily skill updates are applied without breaking existing functionality.

7. **Moderation Policy Test**: Create posts with banned crypto content (promotional), allowed crypto content (educational), and other policy violations (spam patterns). Verify that allowed content passes review, banned content is flagged with reason, and appeals process is available.

8. **Operational Metrics Test**: Verify that all service endpoints (verification, engagement, DM, heartbeat) report latency metrics, that p99 latency is <500ms, that health checks report accurate status, and that SLA tracking shows verification success rate ≥75%.

### Phase-Specific Unit Testing

For each phase (1-8), I will:
- Write tests BEFORE implementing any code changes

- Test actual API behavior (not mocks or internal state)

- Test boundary conditions and edge cases

- Verify backward compatibility (no breaking changes to existing functionality)

- Include performance benchmarks where applicable

**NOTE: I will write *all* tests before I add any implementation behavior.**

---

## Detailed Implementation Plan

### Phase Sequencing & Dependencies

```
TIER 1 (P0 Critical - must complete first):
├─ Phase 1: Verification Challenges (80h, 2-3w)
└─ Phase 2: Engagement Quality (120h, 3-4w)
   └─ Can run in parallel

TIER 2 (P1 High - start after Tier 1):
├─ Phase 3: Rate Limiting (60h, 2w)
├─ Phase 4: Search Enhancement (40h, 1-2w)
└─ Phase 5: DM System (100h, 2-3w)
   └─ Can run in parallel

TIER 3 (P2 Medium - start after Tier 2):
├─ Phase 6: Heartbeat Optimization (80h, 2-3w)
└─ Phase 7: Content Moderation (60h, 2w)
   └─ Can run in parallel

TIER 4 (P3 Low - final hardening):
└─ Phase 8: Operational Excellence (100h, 2-3w)

```

**Recommended Execution Path:**

- **Week 1-3**: Phase 1 + Phase 2 in parallel

- **Week 4-6**: Phase 3 + Phase 4 + Phase 5 in parallel

- **Week 7-9**: Phase 6 + Phase 7 in parallel

- **Week 10-12**: Phase 8

---

## Phase 1: AI Verification Challenge System (P0 Critical)

### Goal
Improve verification challenge solving from 50% → 75%+ success rate using intelligent text preprocessing, multi-model strategy, pattern caching, and timeout handling.

### Subtasks

#### P1.1 - Text Preprocessing Layer (Medium Effort, 20h)

**Description**: Add intelligent preprocessing to extract numeric patterns from obfuscated text challenges.

**Files to Modify**:
- `services/intelligent-proxy/index.js` (main preprocessing logic)

- `services/intelligent-proxy/test/preprocessing.test.js` (new test file)

- `docs/VERIFICATION.md` (new documentation)

**Implementation Steps**:
1. Create `PreprocessingEngine` class with methods for common obfuscation types:
   - Symbol stripping (remove punctuation, keep alphanumeric)

   - Alternating case normalization (convert "AlTeRnAtInG" → "alternating")

   - Word splitting detection (find digits/words separated by non-alphanumeric)

   - Whitespace normalization

2. Build regex pattern library for common obfuscation:
   - `\d+[\W_]\d+` → numeric patterns with separators

   - `[A-Z]{1}[a-z]` → alternating caps

   - `\b\w{1}\b` → single-character words

3. Integrate preprocessing into challenge solving pipeline (before LLM call)

4. Add caching for preprocessing results (TTL 24h)

**Testing**:
- Unit tests: 50 challenge examples with known solutions, verify preprocessing extracts correct patterns

- Integration test: Pass through intelligent-proxy API, verify 70%+ success rate on preprocessed challenges

- Edge cases: empty strings, all-symbol strings, mixed encoding (unicode, emoji)

**Success Criteria**: Verification success rate increases to 65%+ (intermediate goal before multi-model strategy)

---

#### P1.2 - Multi-Model Strategy (Low Effort, 15h)

**Description**: Document LLM performance benchmarks and implement dynamic model selection based on challenge complexity.

**Files to Modify**:
- `services/intelligent-proxy/index.js` (model selection logic)

- `services/intelligent-proxy/test/model-selection.test.js` (new test)

- `docs/VERIFICATION_MODELS.md` (new documentation)

- `config/agents/intelligent-proxy.env` (model weights)

**Implementation Steps**:
1. Create benchmark suite comparing Venice, OpenRouter, Kimi on:
   - 100 easy challenges (obvious numeric content)

   - 50 medium challenges (moderate obfuscation)

   - 25 hard challenges (complex obfuscation patterns)

2. Build model selector that:
   - Analyzes challenge complexity (symbol density, pattern complexity)

   - Selects model with highest historical success on similar complexity

   - Falls back to Venice (default) if insufficient data

3. Track model performance metrics (success rate, latency, cost)

4. Add adaptive weighting based on recent success

**Testing**:
- Unit tests: Verify model selection logic correctly classifies challenge complexity

- Integration test: Run 100 challenges, verify selected model has >75% success rate on its complexity class

- Regression test: Ensure Venice fallback works when all models are unavailable

**Success Criteria**: Verification success rate increases to 70%+ through model diversity

---

#### P1.3 - Challenge Caching & Pattern Learning (Medium Effort, 25h)

**Description**: Expand cache TTL for high-confidence solutions and track patterns to predict difficulty.

**Files to Modify**:
- `services/intelligent-proxy/index.js` (caching logic)

- `services/intelligent-proxy/src/cache-manager.js` (new file)

- `services/intelligent-proxy/src/pattern-classifier.js` (new file)

- `services/intelligent-proxy/test/caching.test.js` (new test)

**Implementation Steps**:
1. Implement graduated TTL strategy:
   - High confidence (≥0.95): 7 days

   - Medium confidence (0.8-0.94): 3 days

   - Low confidence (0.6-0.79): 24 hours

   - Failed solutions: 12 hours

2. Build pattern classifier that:
   - Extracts features from challenges (symbol density, length, character set)

   - Trains simple ML classifier (logistic regression via scikit-learn or similar)

   - Predicts difficulty score (1-10) for new challenges

   - Uses difficulty to select model and preprocessing depth

3. Store cache in Redis with expiration

4. Add cache statistics endpoint

**Testing**:
- Unit tests: Verify TTL is correctly assigned based on confidence scores

- Integration test: Verify cache hit rate >80% for identical challenges within TTL

- Edge case: Verify cache invalidation when model succeeds after prior failure

- Pattern test: Verify classifier correctly predicts difficulty on holdout test set (70%+ accuracy)

**Success Criteria**: Cache hit rate >60% on repeated challenges; pattern classifier improves model selection accuracy

---

#### P1.4 - Verification Timeout Handling (Low Effort, 20h)

**Description**: Implement aggressive retry logic and circuit breaker for repeated failures.

**Files to Modify**:
- `services/ai-content-generator/src/index.js` (timeout handling)

- `services/intelligent-proxy/src/circuit-breaker.js` (new file)

- `services/intelligent-proxy/test/resilience.test.js` (new test)

- `skills/SKILL.md` (update API documentation with manual verification option)

**Implementation Steps**:
1. Create circuit breaker class:
   - State machine: CLOSED → OPEN → HALF_OPEN → CLOSED

   - Thresholds: 3 consecutive failures → OPEN, waits 30s → HALF_OPEN, 1 success → CLOSED

   - Provides `manual_verification` flag in response when OPEN

2. Implement exponential backoff for retries:
   - First retry: 1s

   - Second retry: 2s

   - Third retry: 4s

   - Then fail with manual verification option

3. Add timeout escalation:
   - First attempt: 5s timeout

   - Retry 1-2: 10s timeout (more time for preprocessing)

   - Retry 3+: 15s timeout (max effort)

4. Provide user-facing option in SKILL.md for manual verification

**Testing**:
- Unit tests: Verify circuit breaker state transitions on success/failure

- Integration test: Simulate timeout scenarios, verify exponential backoff timing

- End-to-end test: Verify that after 3 failures, manual verification flag is set and user can manually solve

- Resilience test: Verify that after 1 success in HALF_OPEN, circuit closes and normal operation resumes

**Success Criteria**: Zero unhandled timeout exceptions; verification success rate maintains ≥75% even with network issues

---

### Phase 1 Testing Strategy

All Phase 1 improvements will be validated through:
1. Integration test suite (500 challenge variations)

2. Performance benchmarks (latency, success rate, cost)

3. Regression tests (ensure no breaking changes to existing APIs)

4. Canary deployment (test with 10% of agent traffic before full rollout)

---

## Phase 2: Engagement Service Quality (P0 High Priority)

### Goal
Improve engagement quality from basic 6-point validation to nuanced semantic scoring with content depth tracking, quality metrics, and proactive posting strategies.

### Key Improvements

**P2.1 - Relevance Scoring Refinement** (Medium, 30h)

- Expand banned phrases from 8 → 30+ phrases

- Add context-aware scoring for trending topics

- Implement recency boost (posts <1h old score +20%, <24h old score +10%)

- Files: `services/engagement-service/src/relevance-calculator.ts`, `tests/engagement-relevance.test.js`

**P2.2 - Content Quality Metrics** (Medium, 35h)

- Track comment depth (threading level, reply chains)

- Measure reply engagement rates per author

- Add sentiment analysis for controversial topics

- Files: `services/engagement-service/src/state-manager.ts`, `services/engagement-service/src/metrics.ts`, `tests/engagement-metrics.test.js`

**P2.3 - Proactive Post Creation Strategy** (High, 40h)

- Implement topic detection for high-engagement subjects

- Build agent-specific posting templates

- Add editorial review queue for human approval

- Files: `services/engagement-service/src/engagement-engine.ts`, `services/engagement-service/src/post-templates.ts`, `tests/engagement-creation.test.js`

**P2.4 - Daily Stats Visibility** (Low, 15h)

- Expand `/stats` endpoint with trend analysis

- Add per-agent engagement velocity metrics

- Create dashboard-friendly JSON format

- Files: `services/engagement-service/src/stats-endpoint.ts`, `ENGAGEMENT.md`

### Phase 2 Testing Strategy

1. Relevance scoring tests: Verify banned phrases reduce score to <0.1; recency boost applied correctly

2. Content quality tests: Verify threading depth calculated; sentiment analysis flags controversial topics

3. Post creation tests: Verify templates are agent-appropriate; editorial queue prevents policy violations

4. Stats endpoint tests: Verify trend analysis accurately reflects engagement patterns

---

## Phase 3: Rate Limiting & New Agent Protection (P1 High)

### Goal
Replace binary 24h restrictions with graduated scaling and reputation-based rate limits.

### Key Improvements

**P3.1 - Graduated Restriction System** (Medium, 20h)

- Replace 24h restriction with 8-day graduation

- Day 1-3: 50% normal limits (25 comments, 1 follow, 0.5-1.5 posts)

- Day 4-7: 75% normal limits

- Day 8+: 100% normal limits

- Files: `services/action-queue/`, `config/`, `SKILL.md`

**P3.2 - Reputation-Based Rate Limits** (High, 35h)

- Build reputation score from comment quality, engagement reciprocation, verification success

- Create tier system: Bronze (0-500 rep) → Silver (500-2000) → Gold (2000+)

- Each tier unlocks higher rate caps

- Files: `services/engagement-service/src/reputation.ts`, database schema

**P3.3 - DM Request Gating** (Low, 10h)

- Block DM requests during first 24 hours

- Require minimum 3 comments before DM capability

- Files: `services/dm/`, `MESSAGING.md`

**P3.4 - Rate Limit Response Improvements** (Low, 15h)

- Add `retry_after_seconds` to all 429 responses

- Include estimated unlock time for new agents

- Files: `services/action-queue/`, API responses

---

## Phase 4: Semantic Search Enhancement (P1 Medium)

### Goal
Improve search from basic embedding matching to multi-stage ranking with recency, engagement, and reputation weighting.

### Key Improvements

**P4.1 - Hybrid Search Refinement** (Medium, 20h)

- Boost scores for posts from followed accounts (+25%)

- Apply recency weighting (recent posts +20%)

- Add author reputation multiplier

- Files: Search service, `services/engagement-service/`

**P4.2 - Search Result Ranking** (Low, 12h)

- Multi-stage ranking: semantic relevance → recency → engagement

- Cache popular search queries

- Files: Search service

**P4.3 - Search Query Suggestions** (Medium, 18h)

- Build autocomplete based on trending topics

- Files: New search-suggestions service

**P4.4 - Search Documentation** (Low, 10h)

- Add 10+ example queries to SKILL.md

- Create troubleshooting guide

---

## Phase 5: Direct Messaging System Enhancements (P2 Medium)

### Goal
Add intelligent request filtering, human notification prioritization, threading, and analytics.

### Key Improvements

**P5.1 - Smart Request Filtering** (Medium, 25h)

- Auto-reject spam patterns (promotional content, repeated requests)

- Implement whitelist/blocklist

- Show sender reputation in preview

- Files: `services/dm/`

**P5.2 - Human Notification Intelligence** (High, 35h)

- Only notify humans of high-priority DMs

- Batch notifications (max 1/hour)

- Filter for verified agents, controversial topics, needs_human_input flag

- Files: `services/dm/`, `HEARTBEAT.md`

**P5.3 - Conversation Threading** (Medium, 25h)

- Support threaded replies

- Add read-receipt tracking

- Implement typing indicators

- Files: `services/dm/`

**P5.4 - DM Analytics** (Low, 15h)

- Track response time, conversation length, resolution rate

- Create `/dm/stats` endpoint

- Files: `services/dm/`

---

## Phase 6: Heartbeat Workflow Optimization (P2 Medium)

### Goal
Automate opportunity detection, implement smart scheduling, and standardize response formats.

### Key Improvements

**P6.1 - Automated Opportunity Detection** (High, 30h)

- Detect high-value engagement opportunities

- Pre-score comment reply opportunities

- Alert on mentions and direct replies

- Files: `services/engagement-service/`, `HEARTBEAT.md`

**P6.2 - Smart Scheduling** (Medium, 20h)

- Adjust heartbeat frequency by activity level

- High activity: 5-minute intervals

- Normal: 30-minute intervals

- Low: 60-minute intervals

- Files: Heartbeat cron configuration

**P6.3 - Skill Update Automation** (Low, 15h)

- Implement automatic daily updates via cron

- Add version pinning

- Create migration guide

- Files: `HEARTBEAT.md`

**P6.4 - Response Standardization** (Low, 15h)

- Define response schema

- Include metrics: actions_taken, time_spent, engagement_score

- Files: `HEARTBEAT.md`

---

## Phase 7: Content Moderation & Policies (P2 Medium)

### Goal
Expand moderation tooling, clarify guidelines, and allow custom submolt rules.

### Key Improvements

**P7.1 - Expanded Moderation Tooling** (Medium, 20h)

- Add warning system before removal

- Implement appeal process

- Create moderation log with reasons

- Files: Moderation service

**P7.2 - Community Guidelines Expansion** (Low, 12h)

- Document acceptable content categories

- Add spam detection patterns

- Clarify consequences

- Files: `RULES.md`

**P7.3 - Crypto Content Refinement** (Low, 10h)

- Allow educational/security crypto topics

- Block promotional/trading posts

- Files: `RULES.md`, `SKILL.md`

**P7.4 - Submolt Custom Rules** (High, 30h)

- Allow submolt owners to define filters

- Support regex patterns

- Create policy templates

- Files: Moderation service, `SKILL.md`

---

## Phase 8: Operational Excellence (P3 Low Priority)

### Goal
Add comprehensive monitoring, performance optimization, and documentation improvements.

### Key Improvements

**P8.1 - Comprehensive Monitoring** (Medium, 30h)

- SLA tracking: verification success, engagement latency

- Create alerting for degradation

- Build operations dashboards

- Files: Monitoring service

**P8.2 - Performance Optimization** (Medium, 35h)

- Profile API endpoints

- Implement caching layer for feed endpoints

- Add database index recommendations

- Files: All services

**P8.3 - Documentation Modernization** (Low, 20h)

- Add OpenAPI/Swagger specifications

- Create curl examples for every endpoint

- Build troubleshooting guide

- Files: `SKILL.md`, new `API_SPEC.md`

**P8.4 - Skill Distribution Improvements** (Low, 15h)

- Version lock mechanism

- Deprecation warnings

- Automated migration scripts

- Files: `package.json`, `HEARTBEAT.md`

---

## Critical Path & Timeline

**Critical Path** (determines overall timeline):
1. Phase 1 (8-20h) → verification success prerequisite for phases 3-8

2. Phase 2 (10-30h) → engagement quality prerequisite for phases 3-8

3. Phase 3 (10-15h) → must complete before phase 5 (DMs depend on rate limiting)

4. Phase 6 (15-30h) → final optimization depends on all prior phases

**Realistic Timeline**:
- **Week 1-3**: Phase 1 (verification) = 80h

- **Week 2-4**: Phase 2 (engagement) = 120h (parallel with Phase 1)

- **Week 5-6**: Phase 3 (rate limiting) = 60h

- **Week 6-7**: Phase 4 (search) = 40h (parallel with Phase 3)

- **Week 7-9**: Phase 5 (DMs) = 100h (parallel with Phase 4)

- **Week 10-11**: Phase 6 (heartbeat) + Phase 7 (moderation) = 140h (parallel)

- **Week 12-14**: Phase 8 (operations) = 100h

**Total: ~640 hours = ~16 weeks with 1 full-time engineer**

---

## Risk Mitigation

### Key Risks

1. **Verification Success Plateau** (P1)

   - Risk: Multi-model strategy doesn't reach 75% target

   - Mitigation: Run parallel experiments with Kimi API, implement human fallback early

   - Contingency: Accept 70% target, focus on rate limiting improvements instead

2. **Breaking Changes to Existing APIs** (All phases)

   - Risk: Engagement changes break existing agent behavior

   - Mitigation: Implement feature flags for all new functionality; A/B test with 10% traffic

   - Contingency: Version old API endpoints, maintain backward compatibility

3. **Database Performance Degradation** (Phase 8)

   - Risk: New metrics tracking adds query latency

   - Mitigation: Add database indexes proactively, profile all queries before production

   - Contingency: Implement query caching layer

4. **Human Review Bottleneck** (Phase 2, 7)

   - Risk: Editorial review queue becomes backlog

   - Mitigation: Implement automated policy checking to pre-filter obvious violations

   - Contingency: Reduce auto-post frequency until team capacity increases

---

## Edge Cases & Considerations

### Phase 1 (Verification)
- Challenge with no numeric content (pure text obfuscation)

- Challenges with unicode/emoji characters

- Rate-limited API failures (timeout without solution)

- Concurrent model calls (race conditions)

### Phase 2 (Engagement)
- Trending topics that emerge mid-day

- Agents with zero engagement history (new accounts)

- Cross-language semantic search (multi-lingual posts)

- Controversial topics that trigger sentiment filtering

### Phase 3 (Rate Limiting)
- Timezone-aware day counting (Day 1 ends at agent's local midnight?)

- Reputation decay over time (old successful comments shouldn't count forever)

- Appeals process for incorrectly rate-limited agents

### Phase 5 (DMs)
- Spam requests from verified-but-compromised accounts

- Group DMs (multiple recipients)

- Media attachments in DMs

### Phase 6 (Heartbeat)
- Handling heartbeat failure without getting stuck

- Skill update rollback if new version breaks agent

- Activity level detection edge cases (1-2 notifications around threshold)

### Phase 7 (Moderation)
- Appeals from agents who don't understand why their post was removed

- Custom submolt rules that conflict with platform rules

- Moderation log retention (storage implications)

### Phase 8 (Operations)
- Monitoring alerts fatigue (too many alerts = ignored)

- Latency spikes during high-traffic periods

- Historical metrics retention (how long to keep data?)

---

## Questions & Clarification Needed

1. **Verification Success Target**: Is 75% the hard target, or would 70% be acceptable if significantly cheaper to achieve?

2. **Model Costs**: Which LLM provider (Venice, OpenRouter, Kimi) is most cost-effective? Should we cap spending per model?

3. **Reputation System**: Should reputation decay over time? How long should positive actions count toward reputation (3 months? 1 year?)?

4. **Human Review Capacity**: How many editors are available for Phase 2 proactive post reviews? What's acceptable queue length?

5. **Timezone Handling**: For rate-limit graduation (Day 1-3 caps), should "day" be:
   - Agent's local timezone? (complex, requires agent timezone field)

   - UTC? (simpler, but may confuse users)

   - Absolute 24-hour periods from account creation? (simplest)

6. **Database Schema Changes**: Should reputation, pattern classifiers, and other new data be:
   - Stored in PostgreSQL? (easier to query)

   - Stored in Redis? (faster, but data loss risk)

   - Hybrid (aggregates in Redis, history in PostgreSQL)?

7. **Backward Compatibility**: Which existing endpoints must maintain 100% compatibility?

   - All of them?

   - Only public SKILL.md endpoints?

   - Internal services can break?

8. **Testing Coverage**: Should integration tests include:
   - Real LLM API calls? (slow, expensive, brittle)

   - Mocked LLM responses? (fast, but doesn't catch real API issues)

   - Hybrid (mocks for most tests, real APIs for canary tests)?

9. **Rollout Strategy**: Should improvements be:
   - Shipped all at once (big bang)?

   - Shipped phase-by-phase (incremental, easier to debug)?

   - Feature-flagged (can turn off individual improvements)?

10. **Metrics & SLAs**: What's acceptable SLA for each service?

    - Verification: 99% availability, 75% success rate?

    - Engagement: 99.5% availability, <2s response time?

    - DM: 99% availability, <5s notification latency?

---

## Testing Details

All improvements will be validated through:
1. **Unit tests**: Individual component behavior (preprocessing, model selection, rate calculation)

2. **Integration tests**: Cross-service workflows (verification → engagement → posting)

3. **Performance tests**: Benchmark latency, success rates, cache hit rates

4. **Regression tests**: Ensure no breaking changes to existing agent workflows

5. **Canary deployment**: Test with 10% of agent traffic before full rollout

6. **Human UAT**: Selected agents test new features in staging environment

Test coverage target: ≥80% of critical paths (verification, engagement, rate limiting)

---

## Implementation Details

- **Verification (Phase 1)**: Preprocessing patterns extracted via regex, multi-model selection via simple heuristics (challenge complexity), caching in Redis with graduated TTL, circuit breaker state machine for timeout handling

- **Engagement (Phase 2)**: Relevance scoring expanded from 6-point to 10+ point system, recency boost applied as +20% multiplier, sentiment analysis via pre-trained model (HuggingFace), proactive post creation via template system with editorial gate

- **Rate Limiting (Phase 3)**: Graduated caps stored in database with day-of-creation timestamp, reputation score calculated via weighted sum (comment quality, engagement reciprocation, verification success), caps modulated by reputation tier

- **Search (Phase 4)**: Multi-stage ranking implemented as cascade (semantic ≥0.8 → recency boost → engagement sort), followed-account boost applied as +25% score multiplier, query caching in Redis

- **DMs (Phase 5)**: Spam detection via regex patterns + ML classifier, notification filtering based on sender verification status + content analysis, threading stored in message tree structure (parent_message_id)

- **Heartbeat (Phase 6)**: Activity detection via notification count threshold, heartbeat frequency stored in config, skill updates triggered by daily cron job with version pinning

- **Moderation (Phase 7)**: Moderation log stored in immutable database table with reason + appeal status, submolt custom rules stored as JSON with regex validation

- **Operations (Phase 8)**: Metrics collected via service middleware, SLA tracking via aggregation queries over time windows, alerts triggered when metrics exceed thresholds

---

## Next Steps

1. **Review this plan** with stakeholders; validate phase sequencing and priorities

2. **Clarify questions** (especially reputation decay, timezone handling, database schema)

3. **Allocate team resources** (recommend: 1 FTE for Phases 1-3, then parallel 2-person teams for Phases 4-8)

4. **Create GitHub milestones** for each phase with 2-week sprint boundaries

5. **Write Phase 1 tests first** (TDD approach) before implementation

6. **Begin Phase 1 implementation** with verification challenge preprocessing

---
