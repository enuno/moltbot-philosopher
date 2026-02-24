#!/bin/bash
# heartbeat-workspace-state-test.sh
# Test suite for heartbeat-update-workspace-state.sh

set -euo pipefail

TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

echo "=== Testing heartbeat-update-workspace-state.sh ==="
echo ""

# Test 1: Create workspace state from healthy heartbeat
echo "Test 1: Create workspace state from healthy heartbeat..."
TEMP_HEARTBEAT=$(mktemp)
cat > "$TEMP_HEARTBEAT" <<'EOF'
{
  "last_check": "2026-02-24T12:34:56Z",
  "cov_value": 0.38,
  "cov_is_warning": false
}
EOF

export WORKSPACE="$TEST_DIR"
bash /home/elvis/.moltbot/scripts/heartbeat-update-workspace-state.sh "classical" "$TEMP_HEARTBEAT"

if [ -f "$TEST_DIR/workspace-state.json" ]; then
    echo "✓ Test 1.1: workspace-state.json created"
else
    echo "✗ Test 1.1 FAILED: workspace-state.json not created"
    exit 1
fi

# Verify content using grep with flexible whitespace handling
AGENT=$(grep '"agent_name"' "$TEST_DIR/workspace-state.json" | cut -d'"' -f4 || echo "")
STATUS=$(grep '"status"' "$TEST_DIR/workspace-state.json" | cut -d'"' -f4 || echo "")
COV_VAL=$(grep '"cov_value"' "$TEST_DIR/workspace-state.json" | grep -o '[0-9.]*' | head -1 || echo "")

if [ "$AGENT" = "classical" ]; then
    echo "✓ Test 1.2: Agent name set correctly"
else
    echo "✗ Test 1.2 FAILED: Agent name is $AGENT, expected 'classical'"
    exit 1
fi

if [ "$STATUS" = "healthy" ]; then
    echo "✓ Test 1.3: Status is healthy (no warning)"
else
    echo "✗ Test 1.3 FAILED: Status is $STATUS, expected 'healthy'"
    exit 1
fi

if [ "$COV_VAL" = "0.38" ]; then
    echo "✓ Test 1.4: CoV value set correctly"
else
    echo "✗ Test 1.4 FAILED: CoV value is $COV_VAL, expected 0.38"
    exit 1
fi

# Test 2: Update with warning state
echo ""
echo "Test 2: Update with warning state..."
cat > "$TEMP_HEARTBEAT" <<'EOF'
{
  "last_check": "2026-02-24T13:00:00Z",
  "cov_value": 0.25,
  "cov_is_warning": true
}
EOF

bash /home/elvis/.moltbot/scripts/heartbeat-update-workspace-state.sh "classical" "$TEMP_HEARTBEAT"

STATUS=$(grep '"status"' "$TEST_DIR/workspace-state.json" | cut -d'"' -f4 || echo "")
COV_IS_WARNING=$(grep '"cov_is_warning"' "$TEST_DIR/workspace-state.json" | grep -o 'true\|false' || echo "")

if [ "$STATUS" = "warning" ]; then
    echo "✓ Test 2.1: Status updated to warning"
else
    echo "✗ Test 2.1 FAILED: Status is $STATUS, expected 'warning'"
    exit 1
fi

if [ "$COV_IS_WARNING" = "true" ]; then
    echo "✓ Test 2.2: cov_is_warning flag set to true"
else
    echo "✗ Test 2.2 FAILED: cov_is_warning is $COV_IS_WARNING, expected 'true'"
    exit 1
fi

# Test 3: Verify timestamp updates
echo ""
echo "Test 3: Verify timestamp updates..."
LAST_CHECK=$(grep '"last_check"' "$TEST_DIR/workspace-state.json" | cut -d'"' -f4 || echo "")

if [ "$LAST_CHECK" = "2026-02-24T13:00:00Z" ]; then
    echo "✓ Test 3.1: Last check timestamp updated"
else
    echo "✗ Test 3.1 FAILED: Last check is $LAST_CHECK, expected 2026-02-24T13:00:00Z"
    exit 1
fi

# Test 4: Test with missing heartbeat file
echo ""
echo "Test 4: Test error handling with missing heartbeat file..."
if bash /home/elvis/.moltbot/scripts/heartbeat-update-workspace-state.sh "classical" "/nonexistent/file" 2>/dev/null; then
    echo "✗ Test 4.1 FAILED: Should have exited with error"
    exit 1
else
    echo "✓ Test 4.1: Script exits with error for missing heartbeat file"
fi

# Test 5: Test with missing agent name
echo ""
echo "Test 5: Test error handling with missing agent name..."
if bash /home/elvis/.moltbot/scripts/heartbeat-update-workspace-state.sh "" "$TEMP_HEARTBEAT" 2>/dev/null; then
    echo "✗ Test 5.1 FAILED: Should have exited with error"
    exit 1
else
    echo "✓ Test 5.1: Script exits with error for missing agent name"
fi

# Test 6: Test with default/missing CoV values
echo ""
echo "Test 6: Test handling of missing CoV values..."
cat > "$TEMP_HEARTBEAT" <<'EOF'
{
  "last_check": "2026-02-24T14:00:00Z"
}
EOF

bash /home/elvis/.moltbot/scripts/heartbeat-update-workspace-state.sh "classical" "$TEMP_HEARTBEAT"

COV_VAL=$(grep '"cov_value"' "$TEST_DIR/workspace-state.json" | grep -o '[0-9.]*' | head -1 || echo "")
if [ "$COV_VAL" = "0" ]; then
    echo "✓ Test 6.1: Missing CoV value defaults to 0"
else
    echo "✗ Test 6.1 FAILED: CoV value is $COV_VAL, expected 0"
    exit 1
fi

# Clean up
rm -f "$TEMP_HEARTBEAT"

echo ""
echo "=========================================="
echo "All tests passed! ✓"
echo "=========================================="
