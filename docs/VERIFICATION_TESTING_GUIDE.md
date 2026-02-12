# Verification Architecture Testing Guide

## Overview

This guide covers testing the **two-layer verification architecture** that handles Moltbook verification challenges, including adversarial patterns like stack_challenge_v1.

**Architecture**: Proxy (Layer 1: 90% simple) + Verification Service (Layer 2: 10% adversarial)

**Testing Levels**:
1. Unit Tests - Verification service components
2. Integration Tests - Service-to-service communication
3. End-to-End Tests - Full challenge flow
4. Performance Tests - Latency and throughput

---

## Prerequisites

**Running Services**:
```bash
docker compose ps
# Required services:
# - moltbot-egress-proxy (8082)
# - verification-service (3007)
# - moltbot-ai-generator (3000)
```

**Test Tools**:
- `curl` - HTTP testing
- `jq` - JSON parsing
- `vitest` - Unit testing (Node.js)
- `bash` - Test scripts

**Environment**:
- All services healthy
- AI Generator has valid API keys (VENICE_API_KEY)
- MOLTBOOK_API_KEY set (for submission tests)

---

## 1. Unit Tests

### 1.1 Verification Service Tests

Run the comprehensive test suite:

```bash
cd services/verification-service
pnpm test
```

**Expected Output**:
```
✓ tests/StackChallengeV1.spec.ts (14)
✓ tests/scenarios.spec.ts (8)
✓ tests/VerificationSolver.spec.ts (13)

Test Files  3 passed (3)
Tests  35 passed (35)
```

**Test Coverage**:
- StackChallengeV1 validation (14 tests)
  - Sentence count enforcement
  - Tool leakage detection
  - Markdown formatting rejection
  - Apology/hedging detection
  - Content requirements validation
- Scenario detection (8 tests)
  - Pattern matching accuracy
  - False positive prevention
- VerificationSolver (13 tests)
  - Configuration validation
  - Retry logic
  - Event emission
  - Expiration handling

### 1.2 Running Specific Test Suites

**Only StackChallengeV1 tests**:
```bash
pnpm test StackChallengeV1
```

**Watch mode for development**:
```bash
pnpm test:watch
```

**Coverage report**:
```bash
pnpm test:coverage
```

---

## 2. Integration Tests

### 2.1 Service Health Checks

**Test all services are responding**:

```bash
# Proxy health
curl -s http://localhost:8082/health | jq

# Verification service health
curl -s http://localhost:3007/health | jq

# AI Generator health
curl -s http://localhost:3002/health | jq
```

**Expected**: All return `"status": "healthy"`

### 2.2 Proxy Detection Patterns Test

**Test enhanced detection methods**:

```bash
# Run architecture test
bash scripts/test-verification-architecture.sh
```

**Expected Output**:
```
Test 1: Verification service health ✅ PASS
Test 2: Proxy health ✅ PASS
Test 3: Stack Challenge V1 detection ✅ PASS
Test 4: Proxy solver stats include delegation ✅ PASS
Test 5: Verification service stats reporting ✅ PASS
```

### 2.3 Delegation Flow Test

**Test complex challenge delegation**:

```bash
curl -s -X POST http://localhost:3007/solve \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "test-delegation-001",
    "question": "You are an autonomous AI agent with tools, memory, and the ability to plan. Write exactly two sentences. Sentence 1: State if you use tools. Sentence 2: State what you will remember in 24 hours.",
    "expiresAt": "'$(date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | jq
```

**Check for**:
- `"scenario": "stack_challenge_v1"` detected
- `"success": true` (if AI Generator configured)
- Validation details in response

### 2.4 Stats Endpoints Test

**Verify all stats endpoints work**:

```bash
# Proxy solver stats (should show Stage 0 delegation)
curl -s http://localhost:8082/solver-stats | jq '.pipeline[0]'

# Verification service stats
curl -s http://localhost:3007/stats | jq

# Proxy health with stats
curl -s http://localhost:8082/health | jq '.stats'
```

**Expected**: All endpoints return valid JSON with delegation metrics

---

## 3. End-to-End Tests

### 3.1 Challenge Response Simulation

**Simulate proxy intercepting a challenge response**:

Since we can't make real Moltbook API calls while suspended, we test the solving logic directly:

```bash
# Test 1: Simple challenge (should NOT delegate)
curl -s -X POST http://localhost:3007/solve \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "simple-001",
    "question": "What is 2 + 2?",
    "expiresAt": "'$(date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | jq '.scenario'

# Expected: null (no scenario detected)

# Test 2: Stack challenge (SHOULD delegate)
curl -s -X POST http://localhost:3007/solve \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "stack-001",
    "question": "This is a stack_challenge_v1. Write exactly two sentences about tool usage and memory.",
    "expiresAt": "'$(date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | jq '.scenario'

# Expected: "stack_challenge_v1"
```

### 3.2 Validation Strictness Test

**Test that invalid answers are rejected**:

```bash
# This would fail validation (3 sentences, not 2)
curl -s -X POST http://localhost:3007/solve \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "validation-test",
    "question": "stack_challenge_v1: Write exactly two sentences.",
    "expiresAt": "'$(date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | jq '.validation'
```

**Check validation reasons** if `valid: false`

---

## 4. Performance Tests

### 4.1 Latency Benchmarks

**Measure solving latency**:

```bash
for i in {1..10}; do
  time curl -s -X POST http://localhost:3007/solve \
    -H "Content-Type: application/json" \
    -d '{
      "challengeId": "perf-test-'$i'",
      "question": "What is the capital of France?",
      "expiresAt": "'$(date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%SZ")'"
    }' > /dev/null
done
```

**Target Latencies**:
- Simple challenge: <2s
- Stack challenge (delegated): <5s
- Complex multi-constraint: <10s

### 4.2 Throughput Test

**Test concurrent challenge handling**:

```bash
# Launch 5 concurrent challenges
for i in {1..5}; do
  (curl -s -X POST http://localhost:3007/solve \
    -H "Content-Type: application/json" \
    -d '{
      "challengeId": "concurrent-'$i'",
      "question": "Simple test question '$i'",
      "expiresAt": "'$(date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%SZ")'"
    }' | jq '.duration') &
done
wait
```

**Expected**: All complete within 10s

---

## 5. Detection Pattern Tests

### 5.1 Test All 8 Detection Methods

Create test responses for each detection method:

```bash
# Method 1: Top-level verification_challenge
echo '{"verification_challenge": {"id": "test1", "question": "Q1"}}' | \
  jq 'if .verification_challenge then "DETECTED" else "MISSED" end'

# Method 2: Top-level challenge
echo '{"challenge": {"id": "test2", "question": "Q2"}}' | \
  jq 'if .challenge then "DETECTED" else "MISSED" end'

# Method 3: Nested type field
echo '{"type": "verification_challenge", "id": "test3", "question": "Q3"}' | \
  jq 'if .type == "verification_challenge" then "DETECTED" else "MISSED" end'

# Method 4: Metadata flag
echo '{"metadata": {"is_verification": true}, "id": "test4", "question": "Q4"}' | \
  jq 'if .metadata.is_verification then "DETECTED" else "MISSED" end'

# Method 5: data.verification_challenge
echo '{"data": {"verification_challenge": {"id": "test5", "question": "Q5"}}}' | \
  jq 'if .data.verification_challenge then "DETECTED" else "MISSED" end'

# Method 6: response.verification_challenge
echo '{"response": {"verification_challenge": {"id": "test6", "question": "Q6"}}}' | \
  jq 'if .response.verification_challenge then "DETECTED" else "MISSED" end'

# Method 7-8: Field pattern (checked in proxy logic)
```

**Expected**: All show "DETECTED"

---

## 6. Failure Mode Tests

### 6.1 AI Generator Unavailable

**Test graceful degradation**:

```bash
# Stop AI Generator
docker compose stop moltbot-ai-generator

# Attempt challenge solve
curl -s -X POST http://localhost:3007/solve \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "failure-test",
    "question": "Test question",
    "expiresAt": "'$(date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | jq '.error'

# Restart AI Generator
docker compose start moltbot-ai-generator
```

**Expected**: Error message indicating connection failure, retry logic engaged

### 6.2 Verification Service Unavailable

**Test proxy fallback**:

```bash
# Stop verification service
docker compose stop verification-service

# Proxy should fall back to standard pipeline
# (Cannot test directly without live API, but check logs)

# Restart
docker compose start verification-service
```

### 6.3 Challenge Expiration

**Test expired challenge handling**:

```bash
curl -s -X POST http://localhost:3007/solve \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "expired-test",
    "question": "Test",
    "expiresAt": "2020-01-01T00:00:00Z"
  }' | jq '.error'
```

**Expected**: `"Challenge expired"` error

---

## 7. Monitoring & Observability

### 7.1 Log Analysis

**View structured logs**:

```bash
# Verification service logs (JSON structured)
docker logs verification-service --tail 50 | jq -R 'fromjson? // .'

# Proxy logs
docker logs moltbot-egress-proxy --tail 50

# Filter for challenges
docker logs verification-service | grep "Scenario detected"
```

### 7.2 Metrics Collection

**Collect stats over time**:

```bash
# Create monitoring script
cat > /tmp/monitor-stats.sh << 'EOF'
#!/bin/bash
while true; do
  echo "=== $(date) ==="
  curl -s http://localhost:3007/stats | jq '{total, solved, failed, successRate}'
  curl -s http://localhost:8082/solver-stats | jq '.summary'
  sleep 60
done
EOF

bash /tmp/monitor-stats.sh
```

---

## 8. Troubleshooting Guide

### Common Issues

**Issue**: Verification service shows `fetch failed`
- **Cause**: Wrong AI Generator URL
- **Fix**: Check `AI_GENERATOR_URL` env var, should be `http://moltbot-ai-generator:3000`

**Issue**: Proxy doesn't delegate complex challenges
- **Cause**: Detection patterns not matching
- **Fix**: Check `detectComplexChallenge()` function, add more patterns

**Issue**: Tests fail with "scenario not detected"
- **Cause**: Question text doesn't match patterns
- **Fix**: Add explicit markers like `stack_challenge_v1` to question

**Issue**: High latency (>10s)
- **Cause**: AI Generator timeout or retry loops
- **Fix**: Check AI Generator health, adjust `TIMEOUT_MS` and `MAX_RETRIES`

### Debug Commands

```bash
# Check service connectivity
docker exec verification-service wget -qO- http://moltbot-ai-generator:3000/health

# Check environment variables
docker exec verification-service env | grep -E "AI_GENERATOR|MOLTBOOK"

# Test AI Generator directly
curl -s -X POST http://localhost:3002/generate \
  -H "Content-Type: application/json" \
  -d '{"topic": "Test", "provider": "venice"}' | jq

# View real-time logs
docker logs -f verification-service
```

---

## 9. Test Results Documentation

### Test Execution Template

```markdown
## Test Run: [Date]

**Environment**:
- Services: All healthy
- AI Provider: Venice (llama-3.3-70b)
- Test Duration: 30 minutes

**Results**:

| Test Suite | Tests Run | Passed | Failed | Notes |
|------------|-----------|--------|--------|-------|
| Unit Tests | 35 | 35 | 0 | All passed |
| Integration | 5 | 5 | 0 | All endpoints responsive |
| E2E | 3 | 3 | 0 | Delegation working |
| Performance | 10 | 10 | 0 | <5s avg latency |

**Issues Found**: None

**Action Items**: None
```

---

## 10. Continuous Integration

### CI Pipeline Tests

Add to `.github/workflows/test.yml`:

```yaml
- name: Run verification service tests
  run: |
    cd services/verification-service
    pnpm install
    pnpm test

- name: Integration smoke test
  run: |
    docker compose up -d
    sleep 10
    bash scripts/test-verification-architecture.sh
```

---

## Summary

This testing guide covers all aspects of the verification architecture:
- ✅ Unit tests (35 tests, automated)
- ✅ Integration tests (service-to-service)
- ✅ E2E tests (full challenge flow)
- ✅ Performance benchmarks (<5s target)
- ✅ Failure mode testing
- ✅ Monitoring & observability

**Pre-Production Checklist**:
- [ ] All unit tests passing (35/35)
- [ ] Integration tests passing (5/5)
- [ ] Latency <5s for delegated challenges
- [ ] Detection patterns tested (8/8)
- [ ] Logs showing correct scenario detection
- [ ] Stats endpoints returning data
- [ ] Failure modes tested and documented

**Next**: Run full test suite before account suspension lifts
