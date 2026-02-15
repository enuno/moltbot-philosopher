#!/bin/bash
# Follow another molty on Moltbook (Queue-based version)
# Usage: ./follow-molty.sh <molty_name>

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
FOLLOWING_STATE_FILE="${STATE_DIR}/following-state.json"
AGENT_NAME="${MOLTBOOK_AGENT_NAME:-classical}"
QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3008}"

# Rate limits (for display only - enforced by queue)
FOLLOW_COOLDOWN="5 minutes"
MAX_DAILY_FOLLOWS=10

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <molty_name>"
    echo "Example: $0 PhilosopherBot"
    exit 1
fi

MOLTY_NAME="$1"

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize following state if needed
if [ -f "$FOLLOWING_STATE_FILE" ]; then
    FOLLOWING=$(jq -r '.following // []' "$FOLLOWING_STATE_FILE")
else
    FOLLOWING="[]"
    echo '{"following": []}' > "$FOLLOWING_STATE_FILE"
fi

# Check if already following
if echo "$FOLLOWING" | jq -e --arg name "$MOLTY_NAME" 'contains([$name])' > /dev/null 2>&1; then
    echo "ℹ️ Already following $MOLTY_NAME (or follow queued)"
    exit 0
fi

echo "🦞 Queuing follow for molty: $MOLTY_NAME"
echo "⚠️ Remember: Only follow moltys whose content you consistently value!"

# Build JSON payload for queue
PAYLOAD=$(jq -n --arg username "$MOLTY_NAME" '{username: $username}')

# Submit to queue via queue-submit-action.sh
if [ -x "${SCRIPT_DIR}/queue-submit-action.sh" ]; then
    # Use the queue submission tool
    ACTION_ID=$(bash "${SCRIPT_DIR}/queue-submit-action.sh" follow "$AGENT_NAME" "$PAYLOAD" --priority 1 2>&1 | grep "Action ID:" | awk '{print $3}')

    if [ -n "$ACTION_ID" ]; then
        echo "✅ Follow queued successfully!"
        echo "   Action ID: $ACTION_ID"
        echo ""
        echo "📊 Check status:"
        echo "   ${SCRIPT_DIR}/queue-cli.sh get $ACTION_ID"
        echo ""
        echo "💡 The follow will be executed when rate limits allow"
        echo "   (Max 1 follow per ${FOLLOW_COOLDOWN}, ${MAX_DAILY_FOLLOWS}/day)"

        # Optimistically update state
        jq --arg name "$MOLTY_NAME" '.following += [$name]' "$FOLLOWING_STATE_FILE" > "${FOLLOWING_STATE_FILE}.tmp" && \
            mv "${FOLLOWING_STATE_FILE}.tmp" "$FOLLOWING_STATE_FILE"

        COUNT=$(jq '.following | length' "$FOLLOWING_STATE_FILE")
        echo ""
        echo "📊 Tracking ${COUNT} molty(s) (including queued)"

        exit 0
    else
        echo "❌ Failed to queue follow"
        exit 1
    fi
else
    # Fallback: Submit directly to queue API
    echo "⚠️  queue-submit-action.sh not found, using direct API call"

    QUEUE_PAYLOAD=$(jq -n \
        --arg action_type "follow" \
        --arg agent_name "$AGENT_NAME" \
        --argjson payload "$PAYLOAD" \
        '{actionType: $action_type, agentName: $agent_name, payload: $payload, priority: 1}')

    RESPONSE=$(curl -s -X POST "${QUEUE_URL}/actions" \
        -H "Content-Type: application/json" \
        -d "$QUEUE_PAYLOAD")

    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

    if [ "$SUCCESS" = "true" ]; then
        ACTION_ID=$(echo "$RESPONSE" | jq -r '.action.id')
        echo "✅ Follow queued successfully!"
        echo "   Action ID: $ACTION_ID"

        # Optimistically update state
        jq --arg name "$MOLTY_NAME" '.following += [$name]' "$FOLLOWING_STATE_FILE" > "${FOLLOWING_STATE_FILE}.tmp" && \
            mv "${FOLLOWING_STATE_FILE}.tmp" "$FOLLOWING_STATE_FILE"

        exit 0
    else
        echo "❌ Failed to queue follow"
        echo "$RESPONSE" | jq '.'
        exit 1
    fi
fi
