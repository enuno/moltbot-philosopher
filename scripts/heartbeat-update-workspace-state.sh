#!/bin/bash
# heartbeat-update-workspace-state.sh
# Updates workspace-state.json with heartbeat CoV metrics for dashboards
#
# Usage: heartbeat-update-workspace-state.sh <agent-name> <state-file>
# Reads heartbeat-state.json and emits metrics to workspace/workspace-state.json
# for monitoring and dashboard consumption.

set -euo pipefail

AGENT_NAME="${1:-}"
HEARTBEAT_STATE_FILE="${2:-}"

if [ -z "$AGENT_NAME" ] || [ -z "$HEARTBEAT_STATE_FILE" ]; then
    echo "Usage: heartbeat-update-workspace-state.sh <agent-name> <state-file>" >&2
    exit 1
fi

if [ ! -f "$HEARTBEAT_STATE_FILE" ]; then
    echo "ERROR: Heartbeat state file not found: $HEARTBEAT_STATE_FILE" >&2
    exit 1
fi

WORKSPACE_DIR="${WORKSPACE:-/workspace}"
WORKSPACE_STATE_FILE="$WORKSPACE_DIR/workspace-state.json"

# Extract metrics from heartbeat state using grep+cut (no jq required)
LAST_CHECK=$(grep -o '"last_check"[[:space:]]*:[[:space:]]*"[^"]*"' "$HEARTBEAT_STATE_FILE" 2>/dev/null | grep -o '"[^"]*"$' | tr -d '"' || echo "")
COV_VALUE=$(grep -o '"cov_value"[[:space:]]*:[[:space:]]*[^,}]*' "$HEARTBEAT_STATE_FILE" 2>/dev/null | grep -o '[0-9.]*$' || echo "0")
COV_IS_WARNING=$(grep -o '"cov_is_warning"[[:space:]]*:[[:space:]]*[^,}]*' "$HEARTBEAT_STATE_FILE" 2>/dev/null | grep -o 'true\|false$' || echo "false")
HEARTBEAT_STATUS="healthy"

# Default cov_value if not found
if [ -z "$COV_VALUE" ] || [ "$COV_VALUE" = "" ]; then
    COV_VALUE="0"
fi

# Determine heartbeat status based on CoV warning
if [ "$COV_IS_WARNING" = "true" ]; then
    HEARTBEAT_STATUS="warning"
fi

# Create or update workspace-state.json
if [ ! -f "$WORKSPACE_STATE_FILE" ]; then
    # Create new workspace-state.json
    cat > "$WORKSPACE_STATE_FILE" <<EOF
{
  "agent_name": "$AGENT_NAME",
  "heartbeat": {
    "last_check": "$LAST_CHECK",
    "cov_value": $COV_VALUE,
    "cov_is_warning": $COV_IS_WARNING,
    "status": "$HEARTBEAT_STATUS"
  }
}
EOF
else
    # Update existing workspace-state.json - reconstruct entire file
    # Extract agent_name from existing file
    EXISTING_AGENT=$(grep '"agent_name"' "$WORKSPACE_STATE_FILE" | cut -d'"' -f4 || echo "$AGENT_NAME")

    # Rebuild file with updated heartbeat section
    cat > "$WORKSPACE_STATE_FILE" <<EOF
{
  "agent_name": "$EXISTING_AGENT",
  "heartbeat": {
    "last_check": "$LAST_CHECK",
    "cov_value": $COV_VALUE,
    "cov_is_warning": $COV_IS_WARNING,
    "status": "$HEARTBEAT_STATUS"
  }
}
EOF
fi

echo "Updated workspace state: $WORKSPACE_STATE_FILE"
echo "Status: $HEARTBEAT_STATUS | CoV: $COV_VALUE | Warning: $COV_IS_WARNING"
