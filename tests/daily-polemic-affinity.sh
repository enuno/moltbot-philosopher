#!/bin/bash

# Unit tests for daily polemic affinity weighting and persona selection

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "Running Affinity Unit Tests..."
echo ""

PASS=0
FAIL=0

# Test 1: Policy file is valid JSON
if jq empty scripts/daily-polemic-policy.json 2>/dev/null; then
    echo "✓ Policy file is valid JSON"
    ((PASS++))
else
    echo "✗ Policy file is invalid JSON"
    ((FAIL++))
fi

# Test 2: Persona pool has 8 members
POOL_SIZE=$(jq '.persona_pool_initial | length' scripts/daily-polemic-policy.json 2>/dev/null || echo "")
if [ "$POOL_SIZE" = "8" ]; then
    echo "✓ Persona pool has exactly 8 members"
    ((PASS++))
else
    echo "✗ Persona pool has $POOL_SIZE members (expected 8)"
    ((FAIL++))
fi

# Test 3: All 8 personas in affinity matrix
AFFINITY_PERSONAS=$(jq '.classical_pairing_affinity | keys | length' scripts/daily-polemic-policy.json 2>/dev/null || echo "")
if [ "$AFFINITY_PERSONAS" = "8" ]; then
    echo "✓ Affinity matrix has entries for all 8 personas"
    ((PASS++))
else
    echo "✗ Affinity matrix has $AFFINITY_PERSONAS personas (expected 8)"
    ((FAIL++))
fi

# Test 4: Theme clusters count
CLUSTER_COUNT=$(jq '.theme_clusters | length' scripts/daily-polemic-policy.json 2>/dev/null || echo "")
if [ "$CLUSTER_COUNT" = "4" ]; then
    echo "✓ Theme clusters has exactly 4 clusters"
    ((PASS++))
else
    echo "✗ Theme clusters has $CLUSTER_COUNT (expected 4)"
    ((FAIL++))
fi

# Test 5: Affinity selection is enabled
ENABLED=$(jq '.affinity_selection.enabled' scripts/daily-polemic-policy.json 2>/dev/null || echo "")
if [ "$ENABLED" = "true" ]; then
    echo "✓ Affinity selection is enabled"
    ((PASS++))
else
    echo "✗ Affinity selection is disabled"
    ((FAIL++))
fi

# Test 6: Base weight is valid
BASE_WEIGHT=$(jq '.affinity_selection.base_weight' scripts/daily-polemic-policy.json 2>/dev/null || echo "")
if [[ "$BASE_WEIGHT" =~ ^[0-9]+\.?[0-9]*$ ]]; then
    echo "✓ Base weight is a positive number: $BASE_WEIGHT"
    ((PASS++))
else
    echo "✗ Base weight not valid: $BASE_WEIGHT"
    ((FAIL++))
fi

# Test 7: Jitter skip probability is valid
JITTER=$(jq '.affinity_selection.jitter_skip_probability' scripts/daily-polemic-policy.json 2>/dev/null || echo "")
if [[ "$JITTER" =~ ^(0|1|0\.[0-9]+)$ ]]; then
    echo "✓ Jitter skip probability is between 0 and 1: $JITTER"
    ((PASS++))
else
    echo "✗ Jitter skip probability out of range: $JITTER"
    ((FAIL++))
fi

# Test 8: Theme to cluster mapping exists
THEME_MAPPING_COUNT=$(jq '.theme_to_cluster | length' scripts/daily-polemic-policy.json 2>/dev/null || echo "")
if [ "$THEME_MAPPING_COUNT" -gt "0" ]; then
    echo "✓ Theme to cluster mapping has entries: $THEME_MAPPING_COUNT themes"
    ((PASS++))
else
    echo "✗ Theme to cluster mapping is empty"
    ((FAIL++))
fi

# Test 9: Sample theme mappings
AGI_SAFETY=$(jq -r '.theme_to_cluster["AGI safety"]' scripts/daily-polemic-policy.json 2>/dev/null || echo "")
CONSCIOUSNESS=$(jq -r '.theme_to_cluster["consciousness"]' scripts/daily-polemic-policy.json 2>/dev/null || echo "")
if [ "$AGI_SAFETY" = "tech_ethics" ] && [ "$CONSCIOUSNESS" = "metaphysics" ]; then
    echo "✓ Sample theme mappings are correct (AGI safety→$AGI_SAFETY, consciousness→$CONSCIOUSNESS)"
    ((PASS++))
else
    echo "✗ Sample theme mappings failed (AGI safety→$AGI_SAFETY, consciousness→$CONSCIOUSNESS)"
    ((FAIL++))
fi

echo ""
echo "Summary: $PASS passed, $FAIL failed"

if [ $FAIL -gt 0 ]; then
    exit 1
fi
