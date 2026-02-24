#!/bin/bash
set -euo pipefail

echo "Testing activeHours logic..."

# Check if current time is within active_hours window
# Empty active_hours = always return 0 (allow 24/7)
# Supports both normal (09:00-17:00) and midnight-crossing (22:00-06:00) windows
is_within_active_hours() {
    local active_hours="$1"
    [ -z "$active_hours" ] && return 0
    local current_time
    current_time=$(date +%H:%M)
    local start_time="${active_hours%-*}"
    local end_time="${active_hours#*-}"

    # Handle midnight-crossing windows (e.g., 22:00-06:00)
    if [ "$start_time" \> "$end_time" ]; then
        # Midnight crossing: allow if current > start OR current < end
        [ "$current_time" \> "$start_time" ] || [ "$current_time" \< "$end_time" ]
    else
        # Normal window: allow if current between start and end
        [ "$current_time" \> "$start_time" ] && [ "$current_time" \< "$end_time" ]
    fi
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

# Test 4: midnight-crossing window detection
TEST_WINDOW_MIDNIGHT="22:00-06:00"
START_M="${TEST_WINDOW_MIDNIGHT%-*}"
END_M="${TEST_WINDOW_MIDNIGHT#*-}"
if [ "$START_M" \> "$END_M" ]; then
    echo "✓ Test 4 passed: midnight-crossing window detected (start > end)"
else
    echo "✗ Test 4 failed: midnight-crossing should have start > end"
    exit 1
fi

# Test 5: normal window parsing
TEST_WINDOW_NORMAL="09:00-17:00"
START_N="${TEST_WINDOW_NORMAL%-*}"
END_N="${TEST_WINDOW_NORMAL#*-}"
if [ "$START_N" \< "$END_N" ]; then
    echo "✓ Test 5 passed: normal window detected (start < end)"
else
    echo "✗ Test 5 failed: normal window should have start < end"
    exit 1
fi

echo "All tests passed!"
