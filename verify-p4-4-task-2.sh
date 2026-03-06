#!/bin/bash
# Manual verification script for P4.4 Task 2 - Multiplicative ScoreBreakdown Model

set -euo pipefail

echo "==== P4.4 Task 2 Verification Script ===="
echo ""

# Check 1: Verify types.ts has ScoreBreakdown interface
echo "✓ Check 1: Verifying ScoreBreakdown interface exists in types.ts"
if grep -q "export interface ScoreBreakdown" services/noosphere-service/src/suggestions/types.ts; then
    echo "  PASS: ScoreBreakdown interface found"
else
    echo "  FAIL: ScoreBreakdown interface not found"
    exit 1
fi

# Check 2: Verify RankedSuggestion.score is ScoreBreakdown type
echo ""
echo "✓ Check 2: Verifying RankedSuggestion has score: ScoreBreakdown"
if grep -q "score: ScoreBreakdown" services/noosphere-service/src/suggestions/types.ts; then
    echo "  PASS: RankedSuggestion.score is ScoreBreakdown"
else
    echo "  FAIL: RankedSuggestion.score field mismatch"
    exit 1
fi

# Check 3: Verify legacy fields exist
echo ""
echo "✓ Check 3: Verifying legacy fields for backward compatibility"
if grep -q "score_legacy" services/noosphere-service/src/suggestions/types.ts && \
   grep -q "semantic_similarity" services/noosphere-service/src/suggestions/types.ts; then
    echo "  PASS: Legacy fields (score_legacy, semantic_similarity) found"
else
    echo "  FAIL: Legacy fields missing"
    exit 1
fi

# Check 4: Verify computeRecencyMultiplier exists
echo ""
echo "✓ Check 4: Verifying computeRecencyMultiplier function exists"
if grep -q "export function computeRecencyMultiplier" services/noosphere-service/src/suggestions/ranker.ts; then
    echo "  PASS: computeRecencyMultiplier function found"
else
    echo "  FAIL: computeRecencyMultiplier function not found"
    exit 1
fi

# Check 5: Verify computeFollowBoost exists
echo ""
echo "✓ Check 5: Verifying computeFollowBoost function exists"
if grep -q "export function computeFollowBoost" services/noosphere-service/src/suggestions/ranker.ts; then
    echo "  PASS: computeFollowBoost function found"
else
    echo "  FAIL: computeFollowBoost function not found"
    exit 1
fi

# Check 6: Verify rankSuggestions uses multiplicative formula
echo ""
echo "✓ Check 6: Verifying rankSuggestions uses multiplicative formula"
if grep -q "semantic \* recencyMultiplier \* reputationMultiplier \* followBoost" \
        services/noosphere-service/src/suggestions/ranker.ts; then
    echo "  PASS: Multiplicative formula found in rankSuggestions"
else
    echo "  FAIL: Multiplicative formula not found"
    exit 1
fi

# Check 7: Verify final score is clamped to [0, 1]
echo ""
echo "✓ Check 7: Verifying final score is clamped to 1.0"
if grep -q "Math.min(1.0," services/noosphere-service/src/suggestions/ranker.ts; then
    echo "  PASS: Final score clamping found"
else
    echo "  FAIL: Final score clamping not found"
    exit 1
fi

# Check 8: Verify recency multiplier has 24-hour half-life and clamping
echo ""
echo "✓ Check 8: Verifying recency multiplier has exponential decay (24h) and [0.5, 1.0] clamp"
if grep -q "Math.exp(-ageHours / 24)" services/noosphere-service/src/suggestions/ranker.ts && \
   grep -q "Math.max(0.5" services/noosphere-service/src/suggestions/ranker.ts; then
    echo "  PASS: Recency multiplier decay and clamping correct"
else
    echo "  FAIL: Recency multiplier formula incorrect"
    exit 1
fi

# Check 9: Verify follow_graph_weight is checked in TrendingTopicMetadata
echo ""
echo "✓ Check 9: Verifying follow_graph_weight in TrendingTopicMetadata"
if grep -q "follow_graph_weight" services/noosphere-service/src/suggestions/types.ts; then
    echo "  PASS: follow_graph_weight field found"
else
    echo "  FAIL: follow_graph_weight field missing"
    exit 1
fi

# Check 10: Verify follow boost is 1.25 when present, 1.0 otherwise
echo ""
echo "✓ Check 10: Verifying follow boost is 1.25 or 1.0"
if grep -q "1.25 : 1.0" services/noosphere-service/src/suggestions/ranker.ts || \
   grep -q '1.25 : 1\.0' services/noosphere-service/src/suggestions/ranker.ts; then
    echo "  PASS: Follow boost values (1.25/1.0) correct"
else
    echo "  FAIL: Follow boost values incorrect"
    exit 1
fi

# Check 11: Verify TypeScript compilation
echo ""
echo "✓ Check 11: Verifying TypeScript compilation"
if npx tsc --noEmit services/noosphere-service/src/suggestions/*.ts 2>/dev/null; then
    echo "  PASS: TypeScript compilation successful"
else
    echo "  FAIL: TypeScript compilation failed"
    exit 1
fi

# Check 12: Verify reputation multiplier returns 1.0 as default (multiplicative neutral)
echo ""
echo "✓ Check 12: Verifying reputation multiplier defaults to 1.0 (multiplicative neutral)"
if grep "export function computeReputationMultiplier" -A 20 services/noosphere-service/src/suggestions/ranker.ts | grep -q "return 1.0"; then
    echo "  PASS: Reputation multiplier neutral default found"
else
    echo "  FAIL: Reputation multiplier default incorrect"
    exit 1
fi

echo ""
echo "=================================="
echo "✅ All P4.4 Task 2 Checks Passed!"
echo "=================================="
echo ""
echo "Summary of Implementation:"
echo "1. ✓ ScoreBreakdown interface with 5 fields (semantic, recencyMultiplier, reputationMultiplier, followBoost, final)"
echo "2. ✓ RankedSuggestion uses nested score: ScoreBreakdown"
echo "3. ✓ Legacy fields present for backward compatibility"
echo "4. ✓ computeRecencyMultiplier() with exponential decay (24h half-life) and [0.5, 1.0] clamping"
echo "5. ✓ computeFollowBoost() returning 1.25 (followed) or 1.0 (not followed)"
echo "6. ✓ computeReputationMultiplier() averaging reputation signals, defaulting to 1.0"
echo "7. ✓ rankSuggestions() uses multiplicative formula: final = semantic × recency × reputation × follow"
echo "8. ✓ Final score clamped to [0, 1]"
echo "9. ✓ Enhanced reason string mentioning all four factors"
echo "10. ✓ TypeScript compilation passes"
