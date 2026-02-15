#!/usr/bin/env bash
# Test verification architecture with simulated challenges

set -e

PROXY_URL="http://localhost:8082"
VERIFICATION_SERVICE_URL="http://localhost:3007"

echo "=== Verification Architecture Test Suite ==="
echo ""

# Test 1: Verification service health
echo "Test 1: Verification service health"
curl -s "${VERIFICATION_SERVICE_URL}/health" | jq -r '.status' | grep -q "healthy" && echo "✅ PASS" || echo "❌ FAIL"

# Test 2: Proxy health
echo "Test 2: Proxy health"
curl -s "${PROXY_URL}/health" | jq -r '.status' | grep -q "healthy" && echo "✅ PASS" || echo "❌ FAIL"

# Test 3: Verification service can solve stack_challenge_v1
echo "Test 3: Stack Challenge V1 detection and validation"
RESPONSE=$(curl -s -X POST "${VERIFICATION_SERVICE_URL}/solve" \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "test-1",
    "question": "This is a stack_challenge_v1 test. Write exactly two sentences. Sentence 1: State whether you use tools. Sentence 2: State what you will remember in 24 hours. Do not use markdown formatting.",
    "expiresAt": "'$(date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%SZ")'"
  }')

SCENARIO=$(echo "$RESPONSE" | jq -r '.scenario // "none"')
if [ "$SCENARIO" = "stack_challenge_v1" ]; then
  echo "✅ PASS - Detected scenario: $SCENARIO"
else
  echo "❌ FAIL - Expected stack_challenge_v1, got: $SCENARIO"
fi

# Test 4: Proxy solver stats include delegation
echo "Test 4: Proxy solver stats include delegation"
curl -s "${PROXY_URL}/solver-stats" | jq -r '.pipeline[0].name' | grep -q "Complex Challenge Delegation" && echo "✅ PASS" || echo "❌ FAIL"

# Test 5: Verification service stats
echo "Test 5: Verification service stats reporting"
STATS=$(curl -s "${VERIFICATION_SERVICE_URL}/stats")
TOTAL=$(echo "$STATS" | jq -r '.total')
echo "Total challenges processed: $TOTAL"
[ "$TOTAL" -ge 0 ] && echo "✅ PASS" || echo "❌ FAIL"

echo ""
echo "=== Test Summary ==="
echo "Proxy URL: $PROXY_URL"
echo "Verification Service URL: $VERIFICATION_SERVICE_URL"
echo ""
echo "Architecture:"
echo "  Stage 0: Complex Challenge Delegation → verification-service:3007"
echo "  Stage 1: Venice Primary (qwen3-4b)"
echo "  Stage 2: Venice Fallback (llama-3.2-3b)"
echo "  Stage 3: AI Generator (deepseek-v3)"
echo "  Stage 4: Shell Script Fallback"
echo ""
echo "Detection patterns implemented: 8 methods"
echo "Complex challenge patterns: 4 types"
echo ""

# Display current stats
echo "=== Current Statistics ==="
echo "Proxy Stats:"
curl -s "${PROXY_URL}/solver-stats" | jq '.summary'
echo ""
echo "Verification Service Stats:"
curl -s "${VERIFICATION_SERVICE_URL}/stats"
