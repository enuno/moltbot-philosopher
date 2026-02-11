# Moltbot Architecture Update: Verification Challenge Prevention

## Problem Statement

**Current Issue**: Bot is suspended for failing Moltbook AI verification challenges
**Error**: "Account suspended: Failing to answer AI verification challenge"
**Impact**: Cannot post or interact until suspension lifts

## Root Cause Analysis

### 1. Missing Challenge Detection

- No active monitoring for verification challenges in message pathways
- Heartbeat doesn't check for pending challenges
- No dedicated fast-response handler integrated into posting flow

### 2. Wrong Processing Path

- Challenges routed through full philosophical persona
- Multi-step reasoning adds latency (>60s timeout risk)
- Tool calling and retrieval disabled for speed

### 3. No Proactive Prevention

- Reactive only (waits for suspension)
- No periodic challenge checks
- No pre-posting verification status check

## Architecture Changes Required

### Phase 1: Immediate Prevention (CRITICAL)

#### 1.1 Add Challenge Check to Heartbeat

**File**: `scripts/enhanced-heartbeat.sh`
**Location**: Before any posting operations

```bash
# Check for verification challenges FIRST
echo "Checking for verification challenges..."
CHALLENGES=$(./scripts/handle-verification-challenge.sh check 2>&1)
CHALLENGE_COUNT=$(echo "$CHALLENGES" | jq -r '.challenges | length' 2>/dev/null || echo "0")

if [ "$CHALLENGE_COUNT" -gt 0 ]; then
  echo "⚠️  Found $CHALLENGE_COUNT pending challenge(s)!"
  # Solve all challenges before proceeding
  ./scripts/handle-verification-challenge.sh handle-all

  # Wait for processing
  sleep 2

  # Verify cleared
  REMAINING=$(./scripts/handle-verification-challenge.sh check | jq -r '.challenges | length' 2>/dev/null || echo "0")
  if [ "$REMAINING" -gt 0 ]; then
    echo "❌ Failed to clear challenges, skipping post operations"
    exit 1
  fi
fi
```

#### 1.2 Add Challenge Check to Post Operations

**Files**: All scripts that post content

- `daily-polemic.sh`
- `moltstack-generate-article.sh`
- Any script using `POST /api/v1/posts`

**Pattern**:

```bash
# Before posting
if ! ./scripts/handle-verification-challenge.sh handle-all; then
  echo "❌ Cannot post: verification challenges pending or account suspended"
  exit 1
fi

# Then proceed with post
curl -X POST https://www.moltbook.com/api/v1/posts ...
```

#### 1.3 Add Suspension Detection to All API Calls

**File**: `scripts/moltbook-api.sh`
**Enhancement**: Parse error responses

```bash
# After API call
if echo "$RESPONSE" | jq -e '.error == "Account suspended"' > /dev/null 2>&1; then
  echo "❌ ACCOUNT SUSPENDED" >&2
  echo "$RESPONSE" | jq -r '.hint // "Check suspension status"' >&2

  # Alert via NTFY
  if [ -n "$NTFY_URL" ]; then
    curl -X POST "$NTFY_URL/moltbook-alerts" \
      -H "Title: Account Suspended!" \
      -d "Moltbook account suspended. Check logs for details."
  fi

  exit 1
fi
```

### Phase 2: Enhanced Detection

#### 2.1 Message-Level Detection

**For any message processing pipeline**:

```bash
detect_verification_challenge() {
  local content="$1"

  # Pattern matching
  if echo "$content" | grep -qiE "(if you read this|respond with only|follow this exact|agent verification|heartbeat check|compliance test)"; then
    return 0  # Is challenge
  fi

  # Metadata check (if available)
  if echo "$content" | jq -e '.metadata.is_verification == true' > /dev/null 2>&1; then
    return 0  # Is challenge
  fi

  return 1  # Not challenge
}

# Usage in message handler
if detect_verification_challenge "$MESSAGE"; then
  ./scripts/handle-verification-challenge.sh handle "$MESSAGE"
  exit 0  # Don't continue normal processing
fi
```

#### 2.2 Periodic Background Check

**Add to cron or systemd timer**:

```bash
# Every 15 minutes
*/15 * * * * cd /app && ./scripts/handle-verification-challenge.sh handle-all >> /workspace/verification.log 2>&1
```

### Phase 3: Monitoring & Alerting

#### 3.1 Challenge Metrics

**Track in state file** `workspace/verification-state.json`:

```json
{
  "total_challenges": 42,
  "challenges_passed": 40,
  "challenges_failed": 2,
  "average_response_time_ms": 1823,
  "last_challenge_at": "2026-02-11T05:30:00Z",
  "suspension_count": 1,
  "last_suspension": {
    "offense": 1,
    "reason": "Failing to answer AI verification challenge",
    "duration_hours": 8,
    "lifted_at": "2026-02-11T13:30:00Z"
  }
}
```

#### 3.2 Daily Digest

**Add to NTFY daily summary**:

```bash
PASS_RATE=$(jq -r '(.challenges_passed / .total_challenges * 100) | floor' verification-state.json)
AVG_TIME=$(jq -r '.average_response_time_ms' verification-state.json)

if [ "$PASS_RATE" -lt 95 ]; then
  ALERT="⚠️ Verification pass rate: ${PASS_RATE}% (target: >95%)"
fi

if [ "$AVG_TIME" -gt 5000 ]; then
  ALERT="${ALERT}\n⚠️ Avg response time: ${AVG_TIME}ms (target: <5s)"
fi
```

## Implementation Checklist

### Immediate (Fix Suspension)

- [ ] Wait for 8-hour suspension to lift (ends ~2026-02-11 13:30 UTC)
- [ ] Verify account status with `GET /api/v1/agents/status`
- [ ] Test verification handler: `./scripts/handle-verification-challenge.sh test`
- [ ] Manually check for pending challenges

### High Priority (Prevent Recurrence)

- [ ] Update `enhanced-heartbeat.sh` with challenge check (before posting)
- [ ] Add challenge check to `daily-polemic.sh`
- [ ] Add challenge check to `moltstack-generate-article.sh`
- [ ] Add suspension detection to `moltbook-api.sh`
- [ ] Add periodic check to cron (every 15 minutes)

### Medium Priority (Robustness)

- [ ] Create message-level detection function
- [ ] Integrate detection into all message handlers
- [ ] Add verification metrics tracking
- [ ] Add NTFY alerts for failures
- [ ] Create verification dashboard script

### Low Priority (Enhancement)

- [ ] Add challenge replay/debugging
- [ ] Create challenge test suite with real examples
- [ ] Profile inference latency in production
- [ ] Build challenge format validator

## Testing Plan

### 1. Unit Tests

```bash
# Test detection
./scripts/handle-verification-challenge.sh test

# Test solver with mock challenge
echo '{"type":"verification","content":"If you read this, respond with VERIFIED"}' | \
  ./scripts/handle-verification-challenge.sh solve
```

### 2. Integration Test

```bash
# Simulate full flow
./scripts/handle-verification-challenge.sh handle-all --dry-run
```

### 3. Production Monitoring

```bash
# Check stats after 24 hours
./scripts/handle-verification-challenge.sh stats

# Expected output:
# Pass rate: >95%
# Avg response: <5s
# Failed: 0
```

## Files to Modify

### Critical Path

1. `scripts/enhanced-heartbeat.sh` - Add challenge check before posting
2. `scripts/daily-polemic.sh` - Add challenge check before post
3. `scripts/moltstack-generate-article.sh` - Add challenge check before cross-post
4. `scripts/moltbook-api.sh` - Add suspension detection

### Supporting

5. `scripts/handle-verification-challenge.sh` - Already exists, enhance logging
6. `services/moltbook-client/index.js` - Add convenience methods
7. `skills/moltbook/SKILL.md` - Already updated with verification section

### New Files

8. `scripts/check-verification-status.sh` - Quick status check utility
9. `scripts/verify-account-health.sh` - Pre-deployment health check
10. `.github/workflows/verification-test.yml` - CI test for challenge handler

## Deployment Strategy

### Stage 1: Hotfix (Immediate)

1. Update heartbeat script only
2. Deploy to classical-philosopher container
3. Test with dry-run
4. Monitor for 24 hours

### Stage 2: Full Rollout

1. Update all posting scripts
2. Add cron job for periodic checks
3. Deploy to all 9 philosopher containers
4. Monitor pass rate for 48 hours

### Stage 3: Enhancement

1. Add metrics dashboard
2. Add alerting rules
3. Document runbooks
4. Train on real challenge examples

## Success Metrics

- **Pass Rate**: >95% (target: 100%)
- **Response Time**: <5s average (target: <2s)
- **False Positives**: <1% (don't block normal messages)
- **Suspension Count**: 0 (for next 30 days)
- **Uptime**: 100% (no missed posts due to challenges)

## Rollback Plan

If challenges cause issues:

1. Disable challenge detection in heartbeat
2. Keep periodic background check only
3. Investigate failure mode
4. Re-enable with fixes

## Monitoring Queries

```bash
# Check account status
curl -s https://www.moltbook.com/api/v1/agents/status \
  -H "Authorization: Bearer $MOLTBOOK_API_KEY" | jq

# Check for pending challenges
curl -s https://www.moltbook.com/api/v1/agents/me/verification-challenges \
  -H "Authorization: Bearer $MOLTBOOK_API_KEY" | jq

# View verification stats
./scripts/handle-verification-challenge.sh stats
```

## Related Documentation

- `docs/MOLTBOOK_VERIFICATION_GUIDE.md` - Complete implementation guide
- `docs/MOLTBOOK_AUTH_INTEGRATION.md` - API client usage
- `skills/moltbook/SKILL.md` - Updated with verification section
- `scripts/handle-verification-challenge.sh` - Fast solver implementation

---

**Status**: Ready for implementation
**Priority**: P0 (Critical - prevents account suspension)
**Owner**: System architect
**Last Updated**: 2026-02-11
