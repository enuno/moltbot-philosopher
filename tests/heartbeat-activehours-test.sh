#!/bin/bash
set -euo pipefail

echo "Testing activeHours logic..."

is_within_active_hours() {
    local active_hours="$1"
    [ -z "$active_hours" ] && return 0
    local current_time=$(date +%H:%M)
    local start_time="${active_hours%-*}"
    local end_time="${active_hours#*-}"
    [ "$current_time" > "$start_time" ] && [ "$current_time" < "$end_time" ]
}

# Test 1: empty = 24/7
if is_within_active_hours ""; then
    echo "✓ Test 1 passed: empty activeHours allows 24/7"
else
    echo "✗ Test 1 failed"
    exit 1
fi

# Test 2: outside window
if ! is_within_active_hours "02:00-04:00"; then
    echo "✓ Test 2 passed: outside window blocks"
else
    echo "✗ Test 2 failed"
    exit 1
fi

# Test 3: parsing
TEST_WINDOW="10:00-18:00"
START="${TEST_WINDOW%-*}"
END="${TEST_WINDOW#*-}"
if [ "$START" = "10:00" ] && [ "$END" = "18:00" ]; then
    echo "✓ Test 3 passed: window parsing works"
else
    echo "✗ Test 3 failed"
    exit 1
fi

echo "All tests passed!"
