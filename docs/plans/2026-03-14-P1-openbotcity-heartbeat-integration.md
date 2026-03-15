# P1: OpenBotCity Heartbeat Integration - Implementation Plan

**Goal:** Implement the heartbeat read loop that polls OpenBotCity for activity, parses responses, and logs city state without blocking Moltbot core.

**Architecture:** Three-module isolation pattern with soft-fail error handling. OBC client handles HTTP + JWT auth. OBC types define API contract. OBC engagement module runs the 3-phase heartbeat pattern (Read → Check Attention → Log). Wired into engagement-service via try/catch that logs but doesn't escalate errors. No marketplace or escrow operations (v1 social-only).

**Tech Stack:** TypeScript, Express (existing), Axios (HTTP client), Winston (logging, existing), Jest (testing, existing)

---

## Testing Plan

### Unit Tests: OBC Client HTTP Handling

I will add unit tests that verify the OBC client correctly:
1. **Builds proper Authorization headers** - Client constructs `Authorization: Bearer <JWT>` from environment variable. Test passes valid JWT, verifies header format, never logs full token.
2. **Handles 401 (JWT expired)** - Client receives 401 response, logs warning with token preview (first 20 chars), returns error object (not throwing). Test mocks axios response with 401 status.
3. **Handles network timeout** - Client times out after 5 seconds. Logs timeout with context. Returns error with timeout flag set. Test uses axios mock with timeout error.
4. **Handles 500 server error** - Client receives 500, logs error with status code and message preview. Returns error object. Test mocks 500 response.
5. **Parses valid heartbeat response** - Client receives valid `/world/heartbeat` JSON response with city_status, agents_nearby, needs_attention. Verifies response has expected fields. Does NOT test exact field values (that's behavior, tested in integration test). Test passes mock response matching OBC API schema.

### Unit Tests: OBC Types

I will add unit tests that verify TypeScript interfaces compile and can be instantiated:
1. **HeartbeatData interface** - Valid heartbeat response from OBC API matches structure. Test creates instance with sample data.
2. **NeedsAttention union types** - owner_message, dm_conversation, proposal, research_task variants can be created. Test instantiates each variant.
3. **RateLimitState interface** - Tracks last_speak_time, last_post_time as timestamps. Test creates state object with sample times.

### Integration Test: Heartbeat Loop Runs Without Blocking

I will add integration test that verifies the complete heartbeat cycle works:
1. **Dry-run mode**: Initialize OBC engagement module with `OBC_ENABLE=true` and mock axios to return sample heartbeat data. Call `obcHeartbeat.run()`.
2. **Verify no errors thrown** - Heartbeat completes without throwing. Moltbot's engagement service continues (not blocked).
3. **Verify logging** - Winston logger received appropriate info/warn logs for: "Starting OBC heartbeat", "City status: <bulletin>", "Agents nearby: <count>", "Attention items: <count>". No error logs (success case).
4. **Verify parsing** - Parsed heartbeat data matches expected structure: city_status object, agents_nearby array, needs_attention array with 0+ items.
5. **Verify isolation** - Even if axios mock throws error, engagement service continues running (try/catch boundary verified).

### Integration Test: Soft-Fail Isolation

I will add integration test that verifies OBC failures don't crash Moltbot:
1. **Mock axios to throw network error** - Simulates OBC API being down.
2. **Call obcHeartbeat.run()** - Should NOT throw, should log warning, should return gracefully.
3. **Verify Moltbot core unaffected** - Moltbot's other engagement operations (posting check, daily maintenance) still function. Test mocks these and verifies they weren't interrupted.

### Integration Test: Rate Limit State Tracking

I will add integration test that verifies rate limiting:
1. **Initialize with past speak time** - Create rate limit state with `last_speak_time` set to 1 minute ago.
2. **Check if can speak** - Helper function returns true (enough time passed, speak allowed).
3. **Mock a speak operation** - Update last_speak_time to now.
4. **Check if can speak again** - Helper returns false (too soon, within 2-minute limit).
5. **Wait and check again** - After advancing time by 2+ minutes, returns true again.

### Edge Cases & Validation

1. **Empty needs_attention array** - Heartbeat has 0 items needing attention. Should log "No attention needed" and continue (no error).
2. **Missing optional fields** - Heartbeat response missing agents_nearby. Client should not crash, should log warning about missing field, continue.
3. **Invalid JWT in env** - OBC_ENABLE is true, JWT is malformed/empty. Client should log error, return gracefully (not throw).
4. **OBC down for 30+ seconds** - Multiple heartbeat cycles run while OBC is unreachable. Each cycle logs failure, continues. No cascade/retry amplification.
5. **Concurrent heartbeat calls** - If two heartbeat cycles somehow run simultaneously, should handle gracefully (no race conditions in rate limit state).

NOTE: I will write *all* tests before I add any implementation behavior.

---

## Implementation Tasks

### Task 1: Create OBC Types File (interfaces only)

**Files:**
- Create: `services/engagement-service/src/obc_types.ts`
- Test: `services/engagement-service/src/__tests__/obc_types.test.ts`

**Step 1: Write failing tests**

Create test file that instantiates types:
- `HeartbeatData` with sample city_status, agents_nearby, needs_attention
- `HeartbeatAttentionItem` union with owner_message, dm_conversation, proposal, research_task variants
- `CityStatus`, `AgentInfo`, `NeedsAttentionItem` sub-interfaces
- `RateLimitState` interface
- `ObcResponse<T>` generic wrapper

Run tests, verify they fail (file doesn't exist).

**Step 2: Write minimal interfaces**

Create `obc_types.ts` with all required interfaces. No implementation logic, just type definitions.

**Step 3: Run tests to verify they pass**

All tests should instantiate successfully. Run: `npm test -- services/engagement-service/src/__tests__/obc_types.test.ts`

**Step 4: Commit**

```bash
git add services/engagement-service/src/obc_types.ts services/engagement-service/src/__tests__/obc_types.test.ts
git commit -m "feat(obc): Add OpenBotCity API type definitions"
```

---

### Task 2: Create OBC Client (HTTP wrapper with JWT auth)

**Files:**
- Create: `services/engagement-service/src/obc_client.ts`
- Test: `services/engagement-service/src/__tests__/obc_client.test.ts`

**Step 1: Write failing unit tests**

Tests should verify client behavior WITHOUT mocking internals:
- **Test: GET request with auth header** - Client.get() adds `Authorization: Bearer <JWT>` header. Mock axios, verify headers on outgoing request.
- **Test: 401 response handling** - Axios mock returns 401. Client.get() returns `{ success: false, error: "Unauthorized", preview: "eyJ...8k" }`. No throw.
- **Test: Network timeout** - Axios mock throws timeout error. Client returns `{ success: false, error: "Timeout after 5s", retryable: true }`.
- **Test: Successful response parsing** - Axios returns 200 with JSON body. Client returns `{ success: true, data: {...} }`.
- **Test: Error logging** - Verify winston.logger.warn/error called with context (statusCode, message, preview). Token never logged in full.

Run tests, verify they fail.

**Step 2: Write OBC client**

Implement `ObcClient` class:
- Constructor: Load JWT from `process.env.OPENBOTCITY_JWT`
- Method `get(path, options?)`: Axios GET with auth header, error handling, logging
- Method `post(path, data, options?)`: Axios POST with auth header (for future phases)
- Error handling: Return `{ success, error, data?, retryable? }` shape (never throw)
- Logging: Winston with timestamp, action, success/failure, duration

**Step 3: Run tests to verify pass**

`npm test -- services/engagement-service/src/__tests__/obc_client.test.ts`

**Step 4: Commit**

```bash
git add services/engagement-service/src/obc_client.ts services/engagement-service/src/__tests__/obc_client.test.ts
git commit -m "feat(obc): Add HTTP client with JWT authentication and error handling"
```

---

### Task 3: Create OBC Engagement Module (3-phase heartbeat)

**Files:**
- Create: `services/engagement-service/src/obc_engagement.ts`
- Test: `services/engagement-service/src/__tests__/obc_engagement.test.ts`

**Step 1: Write failing integration tests**

Tests verify complete heartbeat behavior:
- **Test: Dry-run mode with mock data** - Mock axios to return sample heartbeat. Call `run()`. Should return `{ success: true, cityStatus, agentsNearby, attentionCount }` (not throw).
- **Test: Parse city_status** - Mock returns city_status with bulletin, weather, events. Verify parsed correctly into log.
- **Test: Parse agents_nearby** - Mock returns array of agents. Verify array length matches.
- **Test: Parse needs_attention array** - Mock returns 3 attention items. Verify count matches.
- **Test: Handle empty needs_attention** - Mock returns empty array. Should log "No attention items" (not error).
- **Test: Soft-fail on OBC down** - Mock axios throws. `run()` should NOT throw, should log warning, should return `{ success: false, error: "..." }`.
- **Test: Rate limit state tracking** - Initialize module, simulate speak, check last_speak_time was updated.

Run tests, verify they fail.

**Step 2: Write OBC engagement module**

Implement `ObcEngagement` class:
- Constructor: Initialize OBC client, rate limit state, logger
- Method `run()`: 3-phase pattern:
  - **Phase 1 (Read)**: Call client.get('/world/heartbeat'). If error, log and return (don't throw).
  - **Phase 2 (Check Attention)**: Parse needs_attention array. For each item, log type (owner_message, dm, proposal, task). Phase 1 is read-only, so no action taken.
  - **Phase 3 (Observe)**: Log summary of what was observed. No posting in Phase 1.
- Return shape: `{ success: boolean, cityStatus?, agentsNearby?: AgentInfo[], attentionCount?: number, error?: string }`
- Logging: Winston with timestamp, phase, counts, success/failure

**Step 3: Run tests to verify pass**

`npm test -- services/engagement-service/src/__tests__/obc_engagement.test.ts`

**Step 4: Commit**

```bash
git add services/engagement-service/src/obc_engagement.ts services/engagement-service/src/__tests__/obc_engagement.test.ts
git commit -m "feat(obc): Add heartbeat engagement module with 3-phase read loop"
```

---

### Task 4: Wire OBC Engagement into Engagement Service

**Files:**
- Modify: `services/engagement-service/src/engagement-service.ts`
- Test: Update existing engagement service tests to verify OBC isolation

**Step 1: Write failing test**

Test verifies OBC heartbeat runs within main heartbeat without blocking:
- Mock OBC module to track if `run()` was called
- Call main `runHeartbeat()` (or equivalent)
- Verify OBC `run()` was called
- Verify OBC errors don't propagate (try/catch boundary)

Run test, verify it fails (OBC integration not yet added).

**Step 2: Add OBC integration to engagement-service.ts**

In the main heartbeat loop (where `runEngagementCycle()` is called):
- Import `ObcEngagement` from `obc_engagement.ts`
- Initialize: `const obcHeartbeat = new ObcEngagement(...)`
- Add to heartbeat loop (after existing Moltbook logic):
  ```typescript
  try {
    await obcHeartbeat.run();
  } catch (err) {
    logger.warn("OBC heartbeat failed (isolated)", { error: err.message });
    // Continue - OBC errors never block Moltbot
  }
  ```
- Load OBC_ENABLE from env, skip initialization if false

**Step 3: Run tests to verify pass**

`npm test -- services/engagement-service/src/__tests__/engagement-service.test.ts` (existing test suite)

**Step 4: Commit**

```bash
git add services/engagement-service/src/engagement-service.ts
git commit -m "feat(engagement): Wire OBC heartbeat into main engagement loop with soft-fail isolation"
```

---

### Task 5: Manual Testing & Verification

**Files:**
- Reference: `docs/OPENBOTCITY-INTEGRATION.md` (already exists with testing checklist)

**Step 1: Verify heartbeat endpoint responds**

```bash
curl -H "Authorization: Bearer $OPENBOTCITY_JWT" \
  https://api.openbotcity.com/world/heartbeat | jq '{city_status, agents_nearby}'
```

Expected: Valid JSON with city state.

**Step 2: Run engagement service locally**

```bash
cd /home/elvis/.moltbot
docker compose up -d engagement-service
```

**Step 3: Check logs for OBC heartbeat**

```bash
docker compose logs engagement-service | grep -i "obc\|openbotcity" | head -20
```

Expected: "Starting OBC heartbeat", city status, agents count, attention count, success message.

**Step 4: Verify isolation - stop OBC API (simulate down)**

Add temporary invalid URL to env: `OPENBOTCITY_API_URL=http://localhost:9999/invalid`

Restart engagement service, verify logs show OBC failure but engagement service continues.

**Step 5: Commit & note completion**

```bash
git add -A && git commit -m "test(obc): Verify heartbeat integration works end-to-end"
```

---

## Testing Details

All tests follow TDD pattern: write failing tests first, implement minimal code to pass, verify no new failures. Tests are organized in `__tests__` subdirectory matching source structure.

**Test Categories:**
1. **Unit Tests (obc_client.test.ts)** - HTTP client behavior: auth headers, error handling, logging. No internals tested, only boundary.
2. **Unit Tests (obc_types.test.ts)** - Type instantiation and schema validation.
3. **Integration Tests (obc_engagement.test.ts)** - Full heartbeat cycle: parsing, state tracking, error isolation.
4. **Integration Tests (engagement-service.test.ts)** - Moltbot core unaffected by OBC errors.

Tests use mocked axios (via jest.mock) to avoid hitting real OpenBotCity API. Winston logger mocked to verify log calls.

---

## Implementation Details

- **Async/await throughout** - No promise chains, consistent with Moltbot patterns
- **Soft-fail isolation** - Try/catch at engagement-service boundary only. Errors logged but never thrown to caller.
- **Rate limit state** - Tracks `last_speak_time` and `last_post_time` in memory. Phase 1 read-only (no actual posts), so state initialized but not updated.
- **JWT in env only** - Never hardcoded, never full token logged. Preview (first 20 chars) used in logs.
- **Feature flag** - `OBC_ENABLE=true/false` gates initialization. If false, OBC module not instantiated.
- **3-phase pattern** - Phase 1 (Read /world/heartbeat), Phase 2 (Check needs_attention), Phase 3 (Observe/log). Only Phase 1 implemented. Phase 2 (invoke synthesis) and Phase 3 (take action) come in Phase 2 implementation.
- **Winston logging** - Structured logs with timestamp, service context, operation, success/failure, duration.
- **No persistence in Phase 1** - Heartbeat data parsed and logged but not persisted. Engagement-service safeguards (Fix 1-2) handle persistence separately.
- **No marketplace/escrow** - Feature flags in config disable all financial operations. Least-privilege (social-only).

---

## Questions & Clarifications

1. **JWT Refresh Cron** - Plan mentions 29-day JWT refresh cycle. Should this be implemented in Phase 1 or deferred to Phase 2+? (Currently: deferred, will add as separate cron task)
2. **Heartbeat Frequency Scheduling** - Currently disabled all cycles. Should Phase 1 implementation re-enable the heartbeat cycle for OBC, or keep disabled until Phase 2 (synthesis) ready? (Current approach: Keep disabled until safety fixes 1-2 deployed, then re-enable with circuit breaker in Phase 2)
3. **Multi-voice Synthesis** - Phase 1 is read-only. Phase 2 will invoke Venice.AI roundtable. Any prep/stubbing in Phase 1 helpful? (Current: Not needed, clean separation is cleaner)
4. **OBC Zone Preferences** - Architecture mentions preferred zones (library, observatory, central-plaza). Phase 1 only reads. Should Phase 2 include navigation/movement? (Current: Yes, Phase 3 task)
5. **Dry-run Environment Variable** - Should there be an `OBC_DRY_RUN=true` env var that bypasses axios and returns mock data? (Current: Yes, useful for testing. Recommend adding `OBC_DRY_RUN` env var for local development)

---

**Status:** Ready for implementation
**Estimated Duration:** 4-5 hours for all 5 tasks (1 hour per task, plus manual testing)
**Success Criteria:** All unit + integration tests pass, engagement service healthy check confirms OBC module loaded, logs show successful heartbeat cycle (dry-run or with valid JWT)

---
