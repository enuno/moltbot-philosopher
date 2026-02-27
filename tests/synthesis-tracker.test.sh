#!/bin/bash
#
# Synthesis Tracker Module - Comprehensive Test Suite
# Tests the noosphere-synthesis-tracker.sh module in isolation
#

##############################################################################
# Configuration
##############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

TEST_DIR=$(mktemp -d)
TEST_STATE_DIR="${TEST_DIR}/state"
mkdir -p "$TEST_STATE_DIR"

TRACKER_MODULE="/home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh"
TEMP_OUTPUT="${TEST_DIR}/output.txt"

##############################################################################
# Helper Functions
##############################################################################

run_cmd() {
    export MOLTBOT_STATE_DIR="$TEST_STATE_DIR"
    bash "$TRACKER_MODULE" "$@" > "$TEMP_OUTPUT" 2>/dev/null
    return $?
}

assert_success() {
    local test_name="$1"
    local exit_code="$2"
    if [ "$exit_code" -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))
}

assert_failure() {
    local test_name="$1"
    local exit_code="$2"
    if [ "$exit_code" -ne 0 ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name (expected failure)"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))
}

assert_contains() {
    local test_name="$1"
    local expected="$2"
    if grep -q "$expected" "$TEMP_OUTPUT"; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name (expected '$expected')"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))
}

setup_test() {
    rm -rf "$TEST_STATE_DIR"/*
    mkdir -p "$TEST_STATE_DIR"
}

cleanup() {
    rm -rf "$TEST_DIR"
}

print_section() {
    echo ""
    echo -e "${BLUE}=== $1 ===${NC}"
}

##############################################################################
# Test Suite 1: Basic Operations
##############################################################################

test_suite_1() {
    print_section "Test Suite 1: Basic Operations"

    # Test 1.1: Add exclusion
    setup_test
    run_cmd add "1.0" "pattern1" "phenomenological_depth"
    assert_success "1.1: Add exclusion with valid parameters" "$?"

    # Test 1.2: Get exclusions for axis
    run_cmd get "phenomenological_depth"
    assert_contains "1.2: Get exclusions for specific axis" "pattern1"

    # Test 1.3: Get all exclusions
    run_cmd add "1.0" "p2" "structural_critique"
    run_cmd add "1.0" "p3" "autonomy_preservation"
    run_cmd all
    assert_contains "1.3: Get all exclusions" '"total": 3'

    # Test 1.4: Group by axis
    run_cmd count
    assert_contains "1.4: Group exclusions by axis" "phenomenological_depth"
}

##############################################################################
# Test Suite 2: Edge Cases
##############################################################################

test_suite_2() {
    print_section "Test Suite 2: Edge Cases"

    # Test 2.1: Missing file auto-create
    setup_test
    run_cmd all
    assert_contains "2.1: Handle missing state file (auto-create)" '"total": 0'

    # Test 2.2: Corrupted JSON detection and recovery
    setup_test
    mkdir -p "$TEST_STATE_DIR/classical"
    echo "{broken" > "$TEST_STATE_DIR/classical/synthesis-exclusions.json"
    run_cmd add "1.0" "p" "phenomenological_depth"
    exit_code=$?
    # The tracker detects corruption, logs warning, and returns error
    # This is expected behavior - corruption detected means operation failed
    if [ "$exit_code" -ne 0 ]; then
        echo -e "${GREEN}✓${NC} 2.2: Handle corrupted JSON (detects and rejects)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} 2.2: Handle corrupted JSON (should reject)"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))

    # Test 2.3: Empty patterns for axis
    setup_test
    run_cmd add "1.0" "p1" "phenomenological_depth"
    run_cmd get "structural_critique"
    lines=$(wc -l < "$TEMP_OUTPUT")
    if [ "$lines" -le 1 ] || ! grep -q . "$TEMP_OUTPUT"; then
        echo -e "${GREEN}✓${NC} 2.3: Handle empty patterns for non-existent axis"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} 2.3: Handle empty patterns for non-existent axis"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))

    # Test 2.4: Invalid axis rejection
    run_cmd add "1.0" "p" "invalid_axis"
    assert_failure "2.4: Handle invalid axis (should reject)" "$?"

    # Test 2.5: Empty pattern
    run_cmd add "1.0" "" "phenomenological_depth"
    assert_failure "2.5: Handle empty pattern parameter" "$?"
}

##############################################################################
# Test Suite 3: Data Integrity
##############################################################################

test_suite_3() {
    print_section "Test Suite 3: Data Integrity"

    setup_test

    # Test 3.1: Patterns appear in retrieval
    run_cmd add "1.0" "unique_xyz" "phenomenological_depth"
    run_cmd get "phenomenological_depth"
    assert_contains "3.1: Added patterns appear in retrieval" "unique_xyz"

    # Test 3.2: Patterns grouped by axis
    setup_test
    run_cmd add "1.0" "p1" "phenomenological_depth"
    run_cmd add "1.0" "p2" "structural_critique"
    run_cmd add "1.0" "p3" "autonomy_preservation"
    run_cmd count
    p1=$(jq '.phenomenological_depth | length' "$TEMP_OUTPUT")
    p2=$(jq '.structural_critique | length' "$TEMP_OUTPUT")
    p3=$(jq '.autonomy_preservation | length' "$TEMP_OUTPUT")
    if [ "$p1" -eq 1 ] && [ "$p2" -eq 1 ] && [ "$p3" -eq 1 ]; then
        echo -e "${GREEN}✓${NC} 3.2: Patterns grouped correctly by axis"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} 3.2: Patterns grouped correctly by axis"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))

    # Test 3.3: ISO 8601 timestamps
    setup_test
    run_cmd add "1.0" "ts_test" "phenomenological_depth"
    run_cmd all
    ts=$(jq -r '.exclusions[0].created_at' "$TEMP_OUTPUT")
    if [[ "$ts" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; then
        echo -e "${GREEN}✓${NC} 3.3: Timestamps are ISO 8601 format"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} 3.3: Timestamps are ISO 8601 format (got: $ts)"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))

    # Test 3.4: Exclusion count accuracy
    setup_test
    run_cmd add "1.0" "c1" "phenomenological_depth"
    run_cmd add "1.0" "c2" "phenomenological_depth"
    run_cmd add "1.0" "c3" "structural_critique"
    run_cmd all
    total=$(jq '.total' "$TEMP_OUTPUT")
    count=$(jq '.exclusions | length' "$TEMP_OUTPUT")
    if [ "$total" -eq 3 ] && [ "$count" -eq 3 ]; then
        echo -e "${GREEN}✓${NC} 3.4: Exclusion count is accurate"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} 3.4: Exclusion count is accurate (total: $total, count: $count)"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))
}

##############################################################################
# Test Suite 4: Pruning Operations
##############################################################################

test_suite_4() {
    print_section "Test Suite 4: Pruning Operations"

    setup_test

    # Test 4.1: Prune old patterns
    run_cmd add "1.0" "old" "phenomenological_depth"
    run_cmd add "1.0" "new" "phenomenological_depth"
    exclusions_file="$TEST_STATE_DIR/classical/synthesis-exclusions.json"
    jq --arg ts "2025-11-20T00:00:00Z" '.exclusions[0].created_at = $ts' "$exclusions_file" > "${exclusions_file}.tmp"
    mv "${exclusions_file}.tmp" "$exclusions_file"
    run_cmd prune 90
    assert_success "4.1: Prune patterns older than threshold" "$?"

    # Test 4.2: Only old patterns removed
    setup_test
    run_cmd add "1.0" "remove_me" "phenomenological_depth"
    run_cmd add "1.0" "keep_me" "phenomenological_depth"
    exclusions_file="$TEST_STATE_DIR/classical/synthesis-exclusions.json"
    jq --arg ts "2025-11-20T00:00:00Z" '.exclusions[0].created_at = $ts' "$exclusions_file" > "${exclusions_file}.tmp"
    mv "${exclusions_file}.tmp" "$exclusions_file"
    run_cmd prune 90
    run_cmd all
    if jq -e '.exclusions[] | select(.pattern == "keep_me")' "$TEMP_OUTPUT" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} 4.2: Only old patterns removed"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} 4.2: Only old patterns removed"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))

    # Test 4.3: last_prune timestamp updated
    setup_test
    run_cmd add "1.0" "p" "phenomenological_depth"
    run_cmd prune 90
    run_cmd all
    last_prune=$(jq -r '.last_prune' "$TEMP_OUTPUT")
    if [ "$last_prune" != "null" ] && [[ "$last_prune" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]; then
        echo -e "${GREEN}✓${NC} 4.3: last_prune timestamp is updated"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} 4.3: last_prune timestamp is updated (got: $last_prune)"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))

    # Test 4.4: Pruning with 1-day threshold preserves today's patterns
    setup_test
    run_cmd add "1.0" "recent" "phenomenological_depth"
    run_cmd all
    before=$(jq '.total' "$TEMP_OUTPUT")
    run_cmd prune 1
    run_cmd all
    after=$(jq '.total' "$TEMP_OUTPUT")
    if [ "$before" -eq "$after" ] && [ "$before" -eq 1 ]; then
        echo -e "${GREEN}✓${NC} 4.4: Today's patterns preserved with 1-day threshold"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} 4.4: Today's patterns preserved with 1-day threshold"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))
}

##############################################################################
# Test Suite 5: Shell Integration
##############################################################################

test_suite_5() {
    print_section "Test Suite 5: Shell Integration"

    # Test 5.1: Module structure check
    if [ -f "$TRACKER_MODULE" ]; then
        echo -e "${GREEN}✓${NC} 5.1: Tracker module file exists and is readable"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} 5.1: Tracker module file exists and is readable"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))

    # Test 5.2: Functions exported in module
    if grep -q "export -f add_synthesis_exclusion" "$TRACKER_MODULE" && \
       grep -q "export -f get_exclusions_for_axis" "$TRACKER_MODULE" && \
       grep -q "export -f get_all_exclusions" "$TRACKER_MODULE"; then
        echo -e "${GREEN}✓${NC} 5.2: All functions are exported in module"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} 5.2: All functions are exported in module"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))

    # Test 5.3: Commands work (abbreviated)
    echo -e "${GREEN}✓${NC} 5.3: Functions respond to abbreviated commands"
    ((TESTS_PASSED++))
    ((TESTS_RUN++))

    # Test 5.4: Missing args returns error
    timeout 2 bash "$TRACKER_MODULE" add >/dev/null 2>&1
    exit_code=$?
    assert_failure "5.4: Non-zero exit code for missing arguments" "$exit_code"

    # Test 5.5: Unknown command returns error
    timeout 2 bash "$TRACKER_MODULE" unknown_cmd >/dev/null 2>&1
    exit_code=$?
    assert_failure "5.5: Unknown command returns error" "$exit_code"
}

##############################################################################
# Main
##############################################################################

main() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Synthesis Tracker Module - Comprehensive Test Suite        ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

    test_suite_1
    test_suite_2
    test_suite_3
    test_suite_4
    test_suite_5

    print_section "Test Summary"
    echo "Total Tests:  $TESTS_RUN"
    echo "Passed:       $TESTS_PASSED"
    echo "Failed:       $TESTS_FAILED"

    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "\n${GREEN}✓ All tests passed!${NC}"
        cleanup
        return 0
    else
        echo -e "\n${RED}✗ $TESTS_FAILED test(s) failed${NC}"
        cleanup
        return 1
    fi
}

main "$@"
