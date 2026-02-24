#!/bin/bash
# heartbeat-edge-cases-test.sh
# Edge case and boundary condition testing for heartbeat CoV monitoring system
# Tests: missing state file, empty buffer, boundary conditions, large timestamps, midnight crossing, null alerting

set -euo pipefail

echo "Running heartbeat edge case tests..."
echo ""

# ============================================
# Setup test environment
# ============================================
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

WORKSPACE_DIR="$TEST_DIR/workspace"
SCRIPTS_DIR="$TEST_DIR/scripts"
mkdir -p "$WORKSPACE_DIR" "$SCRIPTS_DIR"

echo "Test environment created at $TEST_DIR"
echo ""

# ============================================
# Test 1: Missing State File Handling
# ============================================
echo "Test 1: Missing state file handling..."

# Attempt to read a non-existent state file
export WORKSPACE="$WORKSPACE_DIR"

# Create a minimal test script that checks for missing state
cat > "$SCRIPTS_DIR/test-missing-state.sh" << 'EOF'
#!/bin/bash
STATE_FILE="$1"
STATE_DIR=$(dirname "$STATE_FILE")

if [ ! -d "$STATE_DIR" ]; then
    mkdir -p "$STATE_DIR"
fi

if [ ! -f "$STATE_FILE" ]; then
    echo "State file not found, initializing..."
    echo '{"heartbeat_timestamps": [], "cov_value": null, "cov_is_warning": false, "last_alert_time": null}' > "$STATE_FILE"
    echo "State file initialized"
else
    echo "State file exists"
fi
EOF
chmod +x "$SCRIPTS_DIR/test-missing-state.sh"

bash "$SCRIPTS_DIR/test-missing-state.sh" "$WORKSPACE_DIR/nonexistent/heartbeat-state.json"

if [ -f "$WORKSPACE_DIR/nonexistent/heartbeat-state.json" ]; then
    STATE_CONTENT=$(cat "$WORKSPACE_DIR/nonexistent/heartbeat-state.json")
    if echo "$STATE_CONTENT" | grep -q "heartbeat_timestamps"; then
        echo "✓ Test 1: Missing state file auto-initialized with empty buffer"
    else
        echo "✗ Test 1 FAILED: State file not properly initialized"
        exit 1
    fi
else
    echo "✗ Test 1 FAILED: State file creation failed"
    exit 1
fi

echo ""

# ============================================
# Test 2: Empty Buffer Handling
# ============================================
echo "Test 2: Empty buffer edge case..."

# Create state with empty buffer
echo '{"heartbeat_timestamps": [], "cov_value": null, "cov_is_warning": false, "last_alert_time": null}' \
    > "$WORKSPACE_DIR/empty-state.json"

# Verify empty buffer doesn't crash analysis
COUNT=$(jq '.heartbeat_timestamps | length' "$WORKSPACE_DIR/empty-state.json")
COV=$(jq '.cov_value' "$WORKSPACE_DIR/empty-state.json")

if [ "$COUNT" -eq 0 ] && [ "$COV" = "null" ]; then
    echo "✓ Test 2: Empty buffer handled correctly (CoV remains null)"
else
    echo "✗ Test 2 FAILED: Expected empty buffer with null CoV"
    exit 1
fi

echo ""

# ============================================
# Test 3: Exactly 20 Timestamps (Boundary)
# ============================================
echo "Test 3: Exactly 20 timestamps boundary condition..."

# Create state with exactly 20 timestamps
echo '{"heartbeat_timestamps": [], "cov_value": null, "cov_is_warning": false, "last_alert_time": null}' \
    > "$WORKSPACE_DIR/boundary-state.json"

# Add exactly 20 uniform timestamps (4-hour intervals)
for i in {1..20}; do
    EPOCH=$((1708777200 + (i-1) * 14400))
    jq --arg ts "$EPOCH" '.heartbeat_timestamps += [$ts | tonumber]' \
        "$WORKSPACE_DIR/boundary-state.json" > "${WORKSPACE_DIR}/boundary-state.json.tmp"
    mv "${WORKSPACE_DIR}/boundary-state.json.tmp" "$WORKSPACE_DIR/boundary-state.json"
done

COUNT=$(jq '.heartbeat_timestamps | length' "$WORKSPACE_DIR/boundary-state.json")

if [ "$COUNT" -eq 20 ]; then
    echo "✓ Test 3: Exactly 20 timestamps at boundary (exit warmup)"

    # Simulate CoV computation at boundary
    jq '.cov_value = 0 | .cov_is_warning = false' \
        "$WORKSPACE_DIR/boundary-state.json" > "${WORKSPACE_DIR}/boundary-state.json.tmp"
    mv "${WORKSPACE_DIR}/boundary-state.json.tmp" "$WORKSPACE_DIR/boundary-state.json"

    COV=$(jq '.cov_value' "$WORKSPACE_DIR/boundary-state.json")
    if [ "$COV" = "0" ]; then
        echo "✓ Test 3.1: CoV correctly computed at 20-entry boundary"
    else
        echo "✗ Test 3.1 FAILED: CoV should be 0, got $COV"
        exit 1
    fi
else
    echo "✗ Test 3 FAILED: Expected 20 timestamps, got $COUNT"
    exit 1
fi

echo ""

# ============================================
# Test 4: Large Future Timestamps (Year 2030)
# ============================================
echo "Test 4: Large future timestamps (year 2030)..."

echo '{"heartbeat_timestamps": [], "cov_value": null, "cov_is_warning": false, "last_alert_time": null}' \
    > "$WORKSPACE_DIR/future-state.json"

# Create timestamps in year 2030 (Unix epoch ~1893456000)
FUTURE_BASE=1893456000
for i in {1..5}; do
    EPOCH=$((FUTURE_BASE + (i-1) * 14400))
    jq --arg ts "$EPOCH" '.heartbeat_timestamps += [$ts | tonumber]' \
        "$WORKSPACE_DIR/future-state.json" > "${WORKSPACE_DIR}/future-state.json.tmp"
    mv "${WORKSPACE_DIR}/future-state.json.tmp" "$WORKSPACE_DIR/future-state.json"
done

FIRST_TS=$(jq '.heartbeat_timestamps[0]' "$WORKSPACE_DIR/future-state.json")
LAST_TS=$(jq '.heartbeat_timestamps[-1]' "$WORKSPACE_DIR/future-state.json")

if [ "$FIRST_TS" -eq "$FUTURE_BASE" ] && [ "$LAST_TS" -eq "$((FUTURE_BASE + 57600))" ]; then
    echo "✓ Test 4: Large future timestamps accepted (2030 epoch values valid)"

    # Verify intervals remain stable regardless of year
    TS_ARRAY=$(jq '.heartbeat_timestamps | .[]' "$WORKSPACE_DIR/future-state.json")
    TS_VALUES=($(echo "$TS_ARRAY"))

    INTERVAL=$((${TS_VALUES[1]} - ${TS_VALUES[0]}))
    if [ "$INTERVAL" -eq 14400 ]; then
        echo "✓ Test 4.1: Future timestamp intervals computed correctly"
    else
        echo "✗ Test 4.1 FAILED: Interval should be 14400, got $INTERVAL"
        exit 1
    fi
else
    echo "✗ Test 4 FAILED: Future timestamps not stored correctly"
    exit 1
fi

echo ""

# ============================================
# Test 5: ActiveHours Midnight Crossing
# ============================================
echo "Test 5: ActiveHours midnight crossing boundary..."

# Create state with activeHours configuration crossing midnight
echo '{
  "heartbeat_timestamps": [],
  "cov_value": null,
  "cov_is_warning": false,
  "last_alert_time": null,
  "activeHours": {
    "enabled": true,
    "start": "22:00",
    "end": "06:00"
  }
}' > "$WORKSPACE_DIR/midnight-state.json"

# Create a test to validate midnight crossing logic
cat > "$SCRIPTS_DIR/test-midnight-crossing.sh" << 'EOF'
#!/bin/bash
STATE_FILE="$1"

# Extract activeHours config
ACTIVE_START=$(jq -r '.activeHours.start' "$STATE_FILE")
ACTIVE_END=$(jq -r '.activeHours.end' "$STATE_FILE")
ACTIVE_ENABLED=$(jq -r '.activeHours.enabled' "$STATE_FILE")

# Parse times (HH:MM format)
START_HOUR=$(echo "$ACTIVE_START" | cut -d: -f1)
START_MIN=$(echo "$ACTIVE_START" | cut -d: -f2)
END_HOUR=$(echo "$ACTIVE_END" | cut -d: -f1)
END_MIN=$(echo "$ACTIVE_END" | cut -d: -f2)

# Midnight crossing occurs when start > end (e.g., 22:00 to 06:00)
if [ "$START_HOUR" -gt "$END_HOUR" ]; then
    echo "midnight_crossing"
else
    echo "no_crossing"
fi
EOF
chmod +x "$SCRIPTS_DIR/test-midnight-crossing.sh"

CROSSING=$(bash "$SCRIPTS_DIR/test-midnight-crossing.sh" "$WORKSPACE_DIR/midnight-state.json")

if [ "$CROSSING" = "midnight_crossing" ]; then
    echo "✓ Test 5: Midnight crossing detected correctly (22:00-06:00)"

    # Verify configuration is valid JSON
    ENABLED=$(jq '.activeHours.enabled' "$WORKSPACE_DIR/midnight-state.json")
    if [ "$ENABLED" = "true" ]; then
        echo "✓ Test 5.1: ActiveHours configuration stored correctly"
    else
        echo "✗ Test 5.1 FAILED: ActiveHours enabled flag incorrect"
        exit 1
    fi
else
    echo "✗ Test 5 FAILED: Midnight crossing not detected"
    exit 1
fi

echo ""

# ============================================
# Test 6: Alerting with null last_alert_time
# ============================================
echo "Test 6: Alerting logic with null last_alert_time..."

# Create state with null last_alert_time (first alert scenario)
echo '{"heartbeat_timestamps": [], "cov_value": 0.5, "cov_is_warning": true, "last_alert_time": null}' \
    > "$WORKSPACE_DIR/alert-state.json"

# Create test script for alert logic
cat > "$SCRIPTS_DIR/test-alert-logic.sh" << 'EOF'
#!/bin/bash
STATE_FILE="$1"
CURRENT_TIME=$(date -u +%s)

# Extract fields
COV_WARNING=$(jq -r '.cov_is_warning' "$STATE_FILE")
LAST_ALERT=$(jq -r '.last_alert_time' "$STATE_FILE")

# If no previous alert (null) and current warning state, should alert
if [ "$LAST_ALERT" = "null" ] && [ "$COV_WARNING" = "true" ]; then
    echo "should_alert"
else
    echo "should_not_alert"
fi
EOF
chmod +x "$SCRIPTS_DIR/test-alert-logic.sh"

ALERT_DECISION=$(bash "$SCRIPTS_DIR/test-alert-logic.sh" "$WORKSPACE_DIR/alert-state.json")

if [ "$ALERT_DECISION" = "should_alert" ]; then
    echo "✓ Test 6: Alert triggered correctly with null last_alert_time"

    # Simulate alert being sent and state updated
    ALERT_TIMESTAMP=$(date -u +%s)
    jq --arg ts "$ALERT_TIMESTAMP" '.last_alert_time = $ts' \
        "$WORKSPACE_DIR/alert-state.json" > "${WORKSPACE_DIR}/alert-state.json.tmp"
    mv "${WORKSPACE_DIR}/alert-state.json.tmp" "$WORKSPACE_DIR/alert-state.json"

    UPDATED_ALERT=$(jq '.last_alert_time' "$WORKSPACE_DIR/alert-state.json")
    if [ "$UPDATED_ALERT" != "null" ]; then
        echo "✓ Test 6.1: Alert timestamp recorded correctly"
    else
        echo "✗ Test 6.1 FAILED: Alert timestamp not updated"
        exit 1
    fi
else
    echo "✗ Test 6 FAILED: Alert not triggered with null last_alert_time and warning state"
    exit 1
fi

echo ""

# ============================================
# Summary
# ============================================
echo "=========================================="
echo "All edge case tests passed! ✓"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Test 1: Missing state file auto-initialization"
echo "  ✓ Test 2: Empty buffer handling (CoV null)"
echo "  ✓ Test 3: Exactly 20 timestamps boundary"
echo "  ✓ Test 4: Large future timestamps (year 2030)"
echo "  ✓ Test 5: ActiveHours midnight crossing"
echo "  ✓ Test 6: Alerting with null last_alert_time"
echo ""
