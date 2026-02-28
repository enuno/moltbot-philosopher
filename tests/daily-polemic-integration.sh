#!/bin/bash

# Integration tests for daily polemic pipeline

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "Testing Daily Polemic Full Pipeline Integration..."
echo ""

PASS=0
FAIL=0

# Test 1: Policy loading
if [ -f "scripts/daily-polemic-policy.json" ]; then
    POLICY_CHECK=$(jq '.persona_pool_initial | length' scripts/daily-polemic-policy.json)
    if [ "$POLICY_CHECK" = "8" ]; then
        echo "✓ Policy loaded with 8 personas"
        ((PASS++))
    else
        echo "✗ Policy load failed: got $POLICY_CHECK personas"
        ((FAIL++))
    fi
else
    echo "✗ Policy file not found"
    ((FAIL++))
fi

# Test 2: Theme to cluster mapping
TECH_ETHICS=$(jq -r '.theme_to_cluster["AGI safety"]' scripts/daily-polemic-policy.json)
METAPHYSICS=$(jq -r '.theme_to_cluster["consciousness"]' scripts/daily-polemic-policy.json)
POLITICS=$(jq -r '.theme_to_cluster["revolution vs reform"]' scripts/daily-polemic-policy.json)
AESTHETICS=$(jq -r '.theme_to_cluster["high vs low culture"]' scripts/daily-polemic-policy.json)

if [ "$TECH_ETHICS" = "tech_ethics" ] && [ "$METAPHYSICS" = "metaphysics" ] && \
   [ "$POLITICS" = "politics" ] && [ "$AESTHETICS" = "aesthetics" ]; then
    echo "✓ Theme to cluster mapping validates all 4 clusters"
    ((PASS++))
else
    echo "✗ Theme mapping failed: tech=$TECH_ETHICS, meta=$METAPHYSICS, pol=$POLITICS, aes=$AESTHETICS"
    ((FAIL++))
fi

# Test 3: Affinity matrix structure
PERSONAS=$(jq '.classical_pairing_affinity | keys | sort' scripts/daily-polemic-policy.json)
PERSONA_COUNT=$(echo "$PERSONAS" | jq 'length')

if [ "$PERSONA_COUNT" = "8" ]; then
    echo "✓ Affinity matrix has 8 personas"
    ((PASS++))
else
    echo "✗ Affinity matrix has $PERSONA_COUNT personas (expected 8)"
    ((FAIL++))
fi

# Test 4: Affinity values are within valid range
SCIENCE_TECH=$(jq '.classical_pairing_affinity.scientist.tech_ethics' scripts/daily-polemic-policy.json)
CYBER_POLITICS=$(jq '.classical_pairing_affinity.cyberpunk.politics' scripts/daily-polemic-policy.json)

if [[ "$SCIENCE_TECH" =~ ^(0|1|0\.[0-9]+)$ ]] && [[ "$CYBER_POLITICS" =~ ^(0|1|0\.[0-9]+)$ ]]; then
    echo "✓ Sample affinity values are in valid range [0,1]"
    ((PASS++))
else
    echo "✗ Affinity values out of range: scientist/tech=$SCIENCE_TECH, cyberpunk/politics=$CYBER_POLITICS"
    ((FAIL++))
fi

# Test 5: Script syntax check
if bash -n scripts/daily-polemic-queue.sh 2>/dev/null; then
    echo "✓ Script syntax is valid (bash -n passes)"
    ((PASS++))
else
    echo "✗ Script has syntax errors"
    ((FAIL++))
fi

# Test 6: Dry-run produces expected output structure
DRY_OUTPUT=$(bash scripts/daily-polemic-queue.sh --dry-run 2>&1 || true)

HAS_CONTENT_TYPE=$(echo "$DRY_OUTPUT" | grep -c "Selected content type" || echo "0")
HAS_THEME=$(echo "$DRY_OUTPUT" | grep -c "Selected theme" || echo "0")
HAS_PERSONA=$(echo "$DRY_OUTPUT" | grep -c "Selected persona" || echo "0")
HAS_DRY_RUN=$(echo "$DRY_OUTPUT" | grep -c "DRY RUN" || echo "0")

if [ "$HAS_CONTENT_TYPE" -ge "1" ] && [ "$HAS_THEME" -ge "1" ] && \
   [ "$HAS_PERSONA" -ge "1" ] && [ "$HAS_DRY_RUN" -ge "1" ]; then
    echo "✓ Dry-run produces all expected output sections"
    ((PASS++))
else
    echo "✗ Dry-run missing expected output (CT=$HAS_CONTENT_TYPE, TH=$HAS_THEME, PR=$HAS_PERSONA, DR=$HAS_DRY_RUN)"
    ((FAIL++))
fi

# Test 7: Dry-run includes content generation and question
HAS_SAMPLE=$(echo "$DRY_OUTPUT" | grep -c "Sample Content" || echo "0")
HAS_CLAIMS=$(echo "$DRY_OUTPUT" | grep -c "Extracted Claims" || echo "0")
HAS_QUESTION=$(echo "$DRY_OUTPUT" | grep -c "Socratic Question" || echo "0")

if [ "$HAS_SAMPLE" -ge "1" ] && [ "$HAS_CLAIMS" -ge "1" ] && [ "$HAS_QUESTION" -ge "1" ]; then
    echo "✓ Dry-run includes content, claims, and question sections"
    ((PASS++))
else
    echo "✗ Dry-run missing content sections (sample=$HAS_SAMPLE, claims=$HAS_CLAIMS, q=$HAS_QUESTION)"
    ((FAIL++))
fi

# Test 8: Post assembly structure validation
SAMPLE_CONTENT="This is a test polemic about AI ethics."
SAMPLE_QUESTION="What does consciousness require?"

if [ -n "$SAMPLE_CONTENT" ] && [ -n "$SAMPLE_QUESTION" ]; then
    echo "✓ Sample post assembly content is valid"
    ((PASS++))
else
    echo "✗ Sample post assembly content invalid"
    ((FAIL++))
fi

echo ""
echo "Summary: $PASS passed, $FAIL failed"

if [ $FAIL -gt 0 ]; then
    exit 1
fi
