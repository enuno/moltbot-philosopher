# Verification Architecture Troubleshooting Runbook

## Quick Reference

**Services**:
- Proxy: `<http://localhost:8082`> (egress-proxy)

- Verification Service: `<http://localhost:3007`> (verification-service)

- AI Generator: `<http://localhost:3002`> (moltbot-ai-generator, internal port 3000)

**Logs**:

```bash
docker logs moltbot-egress-proxy --tail 50
docker logs verification-service --tail 50
docker logs moltbot-ai-generator --tail 50

```

**Quick Health Check**:

```bash
curl -s <http://localhost:8082/health> | jq '.status'
curl -s <http://localhost:3007/health> | jq '.status'
curl -s <http://localhost:3002/health> | jq '.status'

```

---

## Issue 1: Verification Service Shows "fetch failed"

**Symptoms**:
- Logs show: `"error": "fetch failed"`

- Verification service cannot reach AI Generator

- Challenges fail with 3 retry attempts

**Root Causes**:

### 1A: Wrong AI Generator URL

**Check**:

```bash
docker exec verification-service env | grep AI_GENERATOR_URL

```

**Expected**: `AI_GENERATOR_URL=<http://moltbot-ai-generator:3000`>

**Fix**:

```bash

# Edit docker-compose.yml

# Change AI_GENERATOR_URL to: <http://moltbot-ai-generator:3000>
docker compose up -d verification-service

```

### 1B: AI Generator Not Running

**Check**:

```bash
docker compose ps moltbot-ai-generator

```

**Fix**:

```bash
docker compose start moltbot-ai-generator

```

### 1C: Network Issue

**Test Connectivity**:

```bash
docker exec verification-service wget -qO- <http://moltbot-ai-generator:3000/health>

```

**If fails**: Check Docker network

```bash
docker network inspect moltbot-network | jq '.[0].Containers'

```

**Fix**: Recreate network

```bash
docker compose down
docker compose up -d

```

---

## Issue 2: Proxy Not Delegating Complex Challenges

**Symptoms**:
- Complex challenges handled by standard pipeline

- `delegationAttempts` stays at 0

- Stack challenges fail validation

**Root Causes**:

### 2A: Detection Patterns Not Matching

**Check Logs**:

```bash
docker logs moltbot-egress-proxy --tail 100 | grep "Complex challenge detected"

```

**Test Pattern Matching**:

```javascript
// In proxy index.js, check detectComplexChallenge() function
// Add debug logging:
log('debug', 'Pattern check', {
  hasStackMarker: /stack_challenge_v\d/i.test(question),
  hasToolsMemory: question.includes('tools') && question.includes('memory'),
  complexityScore: complexityScore
});

```

**Fix**: Update patterns in `detectComplexChallenge()` function

### 2B: Verification Service Unavailable

**Check**:

```bash
docker compose ps verification-service
curl <http://localhost:3007/health>

```

**Fix**:

```bash
docker compose up -d verification-service

```

### 2C: VERIFICATION_SERVICE_URL Not Set

**Check**:

```bash
docker exec moltbot-egress-proxy env | grep VERIFICATION_SERVICE_URL

```

**Expected**: `VERIFICATION_SERVICE_URL=<http://verification-service:3007`>

**Fix**:

```bash

# Edit docker-compose.yml egress-proxy environment
docker compose up -d egress-proxy

```

---

## Issue 3: Challenge Validation Failures

**Symptoms**:
- `validation.valid: false` in response

- Challenges marked as solved but not submitted

- Stats show high failure rate for specific scenario

**Root Causes**:

### 3A: AI Response Format Issues

**Check Validation Reasons**:

```bash
curl -s <http://localhost:3007/solve> \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"test","question":"stack_challenge_v1 test","expiresAt":"2026-12-31T00:00:00Z"}' | \
  jq '.validation.reasons'

```

**Common Issues**:
- Too many/few sentences → Adjust AI prompt

- Markdown formatting → AI adds `*` or `` ` ``

- Tool leakage → AI mentions specific tools

- Hedging → AI says "I think", "maybe", "sorry"

**Fix**: Adjust AI Generator prompt in `VerificationSolverEnhanced.ts`:

```typescript
prompt: `Answer this verification question concisely and accurately.
Follow ALL constraints strictly. Use plain text only, no markdown.
Be direct and confident, no apologies or hedging.\n\n${question}\n\nAnswer:`

```

### 3B: Validation Rules Too Strict

**Review Failed Attempts**:

```bash
docker logs verification-service | grep "Validation failed" | jq

```

**Adjust Rules**: Edit `src/solver/scenarios/StackChallengeV1.ts`

**Example - Allow Looser Sentence Count**:

```typescript
// Current: Exactly 2 sentences
if (sentences.length !== 2) {
  reasons.push(`Expected exactly 2 sentences, got ${sentences.length}`);
}

// Adjusted: 2-3 sentences OK
if (sentences.length < 2 || sentences.length > 3) {
  reasons.push(`Expected 2-3 sentences, got ${sentences.length}`);
}

```

**Rebuild**:

```bash
cd services/verification-service
pnpm build
docker compose build verification-service
docker compose up -d verification-service

```

---

## Issue 4: High Latency (>10s)

**Symptoms**:
- Challenges take >10s to resolve

- Stats show high p99 latency

- Timeouts occurring

**Root Causes**:

### 4A: AI Generator Slow/Unavailable

**Check AI Generator Health**:

```bash
time curl -s -X POST <http://localhost:3002/generate> \
  -H "Content-Type: application/json" \
  -d '{"topic":"Test","provider":"venice"}' | jq

```

**Expected**: <2s response

**Fix**: Check Venice API key is valid

```bash
docker exec moltbot-ai-generator env | grep VENICE_API_KEY

```

### 4B: Retry Loops

**Check Retry Stats**:

```bash
curl -s <http://localhost:3007/stats> | jq

# Look for high failed count with many attempts

```

**Adjust Retries**:

```bash

# In docker-compose.yml:
MAX_RETRIES=2  # Reduce from 3
TIMEOUT_MS=5000  # Reduce from 10000

```

### 4C: Network Latency

**Test Internal Network**:

```bash
docker exec verification-service time wget -qO- <http://moltbot-ai-generator:3000/health>

```

**Expected**: <100ms

**Fix**: Check Docker resource limits

```bash
docker stats moltbot-egress-proxy verification-service moltbot-ai-generator

```

---

## Issue 5: Detection Methods Not Working

**Symptoms**:
- Known challenge formats not detected

- Challenges passed through without handling

- Stats show 0 challenges detected

**Diagnosis**:

### 5A: Test Detection Manually

**Simulate Challenge Response**:

```bash

# Test top-level detection
echo '{"verification_challenge":{"id":"test","question":"Q"}}' | jq

# Test nested type
echo '{"type":"verification_challenge","id":"test","question":"Q"}' | jq

# Test metadata
echo '{"metadata":{"is_verification":true},"id":"test","question":"Q"}' | jq

```

### 5B: Check Proxy Detection Logic

**View Detection Code**:

```bash
docker exec moltbot-egress-proxy cat /app/index.js | grep -A 50 "Enhanced detection"

```

**Test Pattern**:

```javascript
// Add logging to proxy
log('debug', 'Detection attempt', {
  hasTopLevel: json.verification_challenge || json.challenge,
  hasNestedType: json.type === 'verification_challenge',
  hasMetadata: json.metadata?.is_verification,
  // ... etc
});

```

### 5C: Update Detection Patterns

**Add New Pattern**:

```javascript
// In proxy index.js, after existing patterns:
// Method 9: New pattern
else if (json.custom_verification_field) {
  challenge = json.custom_verification_field;
  detectionMethod = 'custom_verification_field';
}

```

**Rebuild**:

```bash
docker compose build egress-proxy
docker compose up -d egress-proxy

```

---

## Issue 6: Stats Endpoints Not Responding

**Symptoms**:
- `/stats` or `/solver-stats` return errors

- 404 or 500 errors

- Stats show NaN or null values

**Fixes**:

### 6A: Service Not Running

```bash
docker compose ps

# Ensure all services show "Up" status

```

### 6B: Port Mapping Issues

**Check Ports**:

```bash
docker compose ps | grep -E "8082|3007"

```

**Expected**:
- `0.0.0.0:8082->8082/tcp` (proxy)

- `0.0.0.0:3007->3007/tcp` (verification)

### 6C: Stats Not Initialized

**Reset Stats**:

```bash

# Restart services to reset
docker compose restart moltbot-egress-proxy verification-service

```

---

## Issue 7: Account Suspended Despite Architecture

**Symptoms**:
- Account suspended again

- Challenges appear to be failing

- Verification logs show successes but suspension anyway

**Investigation**:

### 7A: Check What Challenges Failed

**Review Logs**:

```bash

# Last 24 hours of challenges
docker logs moltbot-egress-proxy --since 24h | grep "Challenge"
docker logs verification-service --since 24h | grep "scenario"

```

**Look For**:
- Challenges that bypassed proxy

- Validation failures

- Timeout errors

### 7B: Verify All Traffic Through Proxy

**Check Services Using Proxy**:

```bash

# All these should use egress-proxy:8082
docker exec classical-philosopher env | grep MOLTBOOK_API_URL
docker exec existentialist-philosopher env | grep MOLTBOOK_API_URL

# ... etc for all agents

```

**Expected**: All show `<http://egress-proxy:8082/api/v1`>

### 7C: Check for Direct API Calls

**Audit Scripts**:

```bash
grep -r "www.moltbook.com" scripts/ --exclude="*.log"
grep -r "api.moltbook.com" services/ --exclude-dir=node_modules

```

**Expected**: 0 results (all should use env vars)

---

## Issue 8: Memory Leaks / Performance Degradation

**Symptoms**:
- Services slowing down over time

- High memory usage

- Container restarts

**Diagnosis**:

### 8A: Check Memory Usage

```bash
docker stats --no-stream moltbot-egress-proxy verification-service

```

**Limits**:
- Proxy: 512MB limit

- Verification: 512MB limit

### 8B: Check for Memory Leaks

**Restart Services**:

```bash
docker compose restart moltbot-egress-proxy verification-service

```

**Monitor**:

```bash
watch -n 5 'docker stats --no-stream moltbot-egress-proxy verification-service'

```

### 8C: Clear Cache

**Proxy Cache**:

```bash

# Check cache size
curl -s <http://localhost:8082/cache-stats> | jq '.size'

# Cache clears automatically based on TTL

# Or restart proxy to force clear
docker compose restart moltbot-egress-proxy

```

---

## Issue 9: Test Suite Failures

**Symptoms**:
- Unit tests failing

- Integration tests timing out

- Validation tests not passing

**Fixes**:

### 9A: Unit Test Failures

```bash
cd services/verification-service
pnpm test -- --reporter=verbose

```

**Common Issues**:
- Mocked fetch not matching actual behavior

- Timeout values too low

- Validation rules changed

**Fix**: Update tests to match implementation

### 9B: Integration Test Timeouts

```bash

# Increase timeout in test
curl -s --max-time 30 <http://localhost:3007/solve> ...

```

### 9C: Re-run Tests Clean

```bash

# Clean install
cd services/verification-service
rm -rf node_modules
pnpm install
pnpm test

```

---

## Monitoring Best Practices

### 1. Daily Health Check

```bash
#!/bin/bash

# daily-health-check.sh

echo "=== $(date) ==="
echo "Proxy Health:"
curl -s <http://localhost:8082/health> | jq '.status'

echo "Verification Health:"
curl -s <http://localhost:3007/health> | jq '.status'

echo "Stats Summary:"
curl -s <http://localhost:8082/solver-stats> | jq '.summary'
curl -s <http://localhost:3007/stats> | jq '{total, solved, failed, successRate}'

```

### 2. Alert Thresholds

**Set up monitoring for**:
- Success rate <95%

- Delegation failures >10%

- Latency p99 >10s

- Any service unhealthy

- Memory usage >90%

### 3. Log Rotation

```bash

# docker-compose.yml already has:
logging:
  options:
    max-size: "10m"
    max-file: "3"

```

---

## Emergency Procedures

### Full System Restart

```bash

# Stop all services
docker compose down

# Clear logs if needed
rm -rf logs/*

# Restart
docker compose up -d

# Wait for health
sleep 30

# Check health
curl <http://localhost:8082/health>
curl <http://localhost:3007/health>

```

### Rollback to Previous Version

```bash

# View git history
git log --oneline | head -10

# Rollback to previous commit
git checkout <commit-hash>

# Rebuild
docker compose build
docker compose up -d

```

### Bypass Verification Service (Emergency)

```bash

# If verification service is broken, temporarily disable delegation

# Edit proxy index.js:
const complexReason = null;  // Force to always return null

# Rebuild
docker compose build egress-proxy
docker compose up -d egress-proxy

```

---

## Support Contacts

**Documentation**:
- [Testing Guide](/docs/VERIFICATION_TESTING_GUIDE.md)

- [Challenge Test Suite](/docs/CHALLENGE_TEST_SUITE.md)

- [Architecture (AGENTS.md)](/AGENTS.md#two-layer-verification-architecture-v27-)

**Logs Location**:
- Proxy: `docker logs moltbot-egress-proxy`

- Verification: `docker logs verification-service`

- AI Generator: `docker logs moltbot-ai-generator`

**Stats Endpoints**:
- `<http://localhost:8082/solver-stats`> - Proxy pipeline stats

- `<http://localhost:3007/stats`> - Verification service stats

- `<http://localhost:8082/health`> - Proxy health + metrics

- `<http://localhost:3007/health`> - Verification health + success rate
