#!/bin/bash
#
# Test Suite for noosphere-synthesis-tracker
# Covers validation, edge cases, limits, and concurrent access
#

set -u  # Disallow undefined, but allow non-zero exits

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRACKER_SCRIPT="${SCRIPT_DIR}/scripts/noosphere-synthesis-tracker.sh"
TEST_STATE_DIR="${HOME}/.moltbot/test-synthesis-state"
EXCLUSIONS_FILE="${TEST_STATE_DIR}/synthesis-exclusions.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Setup test environment
setup() {
    export MOLTBOT_STATE_DIR="$TEST_STATE_DIR"
    mkdir -p "$TEST_STATE_DIR"
    rm -f "$EXCLUSIONS_FILE"
}

# Cleanup
cleanup() {
    rm -rf "$TEST_STATE_DIR"
}

# Test assertion helpers
assert_exit_code() {
    local expected=$1
    local actual=$2
    local test_name=$3

    if [ "$actual" -eq "$expected" ]; then
        echo -e "${GREEN}✓${NC} $test_name (exit code $actual)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name (expected $expected, got $actual)"
        ((TESTS_FAILED++))
    fi
}

assert_contains() {
    local output=$1
    local pattern=$2
    local test_name=$3

    if echo "$output" | grep -q "$pattern"; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name (pattern not found: $pattern)"
        ((TESTS_FAILED++))
    fi
}

assert_not_contains() {
    local output=$1
    local pattern=$2
    local test_name=$3

    if ! echo "$output" | grep -q "$pattern"; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name (pattern found: $pattern)"
        ((TESTS_FAILED++))
    fi
}

# Test Suite 1: Axis Validation
test_axis_validation() {
    echo ""
    echo "=== Test Suite 1: Axis Validation ==="

    # Valid axis
    output=$(bash "$TRACKER_SCRIPT" add "1.0" "test pattern" "phenomenological_depth" 2>&1)
    exit_code=$?
    assert_exit_code 0 "$exit_code" "Valid axis (phenomenological_depth)"

    # Invalid axis
    output=$(bash "$TRACKER_SCRIPT" add "1.0" "test pattern" "invalid_axis" 2>&1)
    exit_code=$?
    assert_exit_code 1 "$exit_code" "Invalid axis rejected"
    assert_contains "$output" "Invalid axis" "Error message for invalid axis"

    # All valid axes
    for axis in "phenomenological_depth" "structural_critique" "autonomy_preservation"; do
        output=$(bash "$TRACKER_SCRIPT" add "1.0" "pattern for $axis" "$axis" 2>&1)
        exit_code=$?
        assert_exit_code 0 "$exit_code" "Valid axis: $axis"
    done
}

# Test Suite 2: Edge Cases
test_edge_cases() {
    echo ""
    echo "=== Test Suite 2: Edge Cases ==="

    # Missing required arguments
    output=$(bash "$TRACKER_SCRIPT" add "1.0" "" "phenomenological_depth" 2>&1 || true)
    assert_contains "$output" "ERROR" "Empty pattern rejected"

    # Missing file initialization
    rm -f "$EXCLUSIONS_FILE"
    output=$(bash "$TRACKER_SCRIPT" get "phenomenological_depth" 2>&1)
    exit_code=$?
    assert_exit_code 0 "$exit_code" "Auto-initializes missing file"

    # Corrupted JSON handling
    mkdir -p "$TEST_STATE_DIR"
    echo "{ invalid json" > "$EXCLUSIONS_FILE"
    output=$(bash "$TRACKER_SCRIPT" all 2>&1)
    exit_code=$?
    assert_exit_code 0 "$exit_code" "Handles corrupted JSON gracefully"
}

# Test Suite 3: Limit Enforcement (20 patterns per axis)
test_limit_enforcement() {
    echo ""
    echo "=== Test Suite 3: Limit Enforcement ==="

    rm -f "$EXCLUSIONS_FILE"

    # Add 25 patterns to one axis
    for i in {1..25}; do
        bash "$TRACKER_SCRIPT" add "1.0" "pattern $i" "phenomenological_depth" 2>/dev/null
    done

    # Retrieve - should limit to last 20
    output=$(bash "$TRACKER_SCRIPT" get "phenomenological_depth" 2>/dev/null)
    pattern_count=$(echo "$output" | wc -l)

    if [ "$pattern_count" -le 20 ]; then
        echo -e "${GREEN}✓${NC} Limits output to 20 patterns"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} Exceeds 20 pattern limit (got $pattern_count)"
        ((TESTS_FAILED++))
    fi

    # Verify oldest patterns excluded
    if ! echo "$output" | grep -q "pattern 1"; then
        echo -e "${GREEN}✓${NC} Excludes oldest patterns"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} Did not exclude oldest patterns"
        ((TESTS_FAILED++))
    fi
}

# Test Suite 4: Date Range Filtering
test_date_filtering() {
    echo ""
    echo "=== Test Suite 4: Date Range Filtering ==="

    rm -f "$EXCLUSIONS_FILE"

    # Add fresh pattern
    bash "$TRACKER_SCRIPT" add "1.0" "fresh pattern" "phenomenological_depth" 2>/dev/null

    # Prune with 1 day threshold - should keep fresh pattern
    bash "$TRACKER_SCRIPT" prune 1 2>/dev/null
    output=$(bash "$TRACKER_SCRIPT" get "phenomenological_depth" 2>/dev/null)

    assert_contains "$output" "fresh pattern" "Keeps recent patterns during prune"

    # Prune with 0 day threshold - might remove depending on timing
    # Just verify the command succeeds
    output=$(bash "$TRACKER_SCRIPT" prune 0 2>&1)
    exit_code=$?
    assert_exit_code 0 "$exit_code" "Prune with edge case (0 days)"
}

# Test Suite 5: Concurrent Access Patterns
test_concurrent_access() {
    echo ""
    echo "=== Test Suite 5: Concurrent Access Patterns ==="

    rm -f "$EXCLUSIONS_FILE"

    # Sequential writes to different axes
    bash "$TRACKER_SCRIPT" add "1.0" "pattern_a" "phenomenological_depth" 2>/dev/null &
    pid1=$!
    bash "$TRACKER_SCRIPT" add "1.0" "pattern_b" "structural_critique" 2>/dev/null &
    pid2=$!
    bash "$TRACKER_SCRIPT" add "1.0" "pattern_c" "autonomy_preservation" 2>/dev/null &
    pid3=$!

    # Wait for all to complete
    wait "$pid1" 2>/dev/null || true
    wait "$pid2" 2>/dev/null || true
    wait "$pid3" 2>/dev/null || true

    # Verify all patterns recorded
    output=$(bash "$TRACKER_SCRIPT" all 2>/dev/null)
    count=$(echo "$output" | jq '.total // 0' 2>/dev/null || echo 0)

    if [ "$count" -ge 3 ]; then
        echo -e "${GREEN}✓${NC} Concurrent writes succeed"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} Concurrent writes lost data (count: $count)"
        ((TESTS_FAILED++))
    fi
}

# Test Suite 6: JSON State Structure
test_json_structure() {
    echo ""
    echo "=== Test Suite 6: JSON State Structure ==="

    rm -f "$EXCLUSIONS_FILE"
    bash "$TRACKER_SCRIPT" add "1.0" "test" "phenomenological_depth" 2>/dev/null

    # Verify required fields exist
    output=$(bash "$TRACKER_SCRIPT" all 2>/dev/null)

    if echo "$output" | jq -e '.initialized' >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} JSON has 'initialized' field"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} Missing 'initialized' field"
        ((TESTS_FAILED++))
    fi

    if echo "$output" | jq -e '.exclusion_count' >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} JSON has 'exclusion_count' field"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} Missing 'exclusion_count' field"
        ((TESTS_FAILED++))
    fi

    if echo "$output" | jq -e '.last_prune' >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} JSON has 'last_prune' field"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} Missing 'last_prune' field"
        ((TESTS_FAILED++))
    fi
}

# Main execution
main() {
    setup

    # Run all test suites
    test_axis_validation
    test_edge_cases
    test_limit_enforcement
    test_date_filtering
    test_concurrent_access
    test_json_structure

    cleanup

    # Summary
    echo ""
    echo "========================================"
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo "========================================"

    if [ $TESTS_FAILED -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

main "$@"
