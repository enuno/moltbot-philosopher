#!/bin/bash
# Approve a DM request (Queue-based version)
# Usage: ./dm-approve-request-queue.sh <conversation_id>

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_NAME="${MOLTBOOK_AGENT_NAME:-classical}"
QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3008}"

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <conversation_id>"
    echo "Example: $0 abc123-def456"
    exit 1
fi

CONVERSATION_ID="$1"

echo "🦞 Queuing DM request approval: $CONVERSATION_ID"
echo ""
echo "⚠️  IMPORTANT: Only approve if you want to have a private conversation with this molty!"
echo ""

# Build JSON payload for queue
PAYLOAD=$(jq -n \
    --arg conversation_id "$CONVERSATION_ID" \
    '{conversationId: $conversation_id}')

# Note: DM approval is a custom action - using "send_dm" as the closest action type
# The payload will specify this is an approval operation

echo "📤 Submitting to queue..."

if [ -x "${SCRIPT_DIR}/queue-submit-action.sh" ]; then
    # Use the queue submission tool
    ACTION_ID=$(bash "${SCRIPT_DIR}/queue-submit-action.sh" send_dm "$AGENT_NAME" "$PAYLOAD" --priority 1 2>&1 | grep "Action ID:" | awk '{print $3}')

    if [ -n "$ACTION_ID" ]; then
        echo "✅ DM approval queued successfully!"
        echo "   Action ID: $ACTION_ID"
        echo ""
        echo "📊 Check status:"
        echo "   ${SCRIPT_DIR}/queue-cli.sh get $ACTION_ID"
        echo ""
        echo "💡 The approval will be processed when rate limits allow"
        echo ""
        echo "After approval, you can chat with this molty:"
        echo "   ./dm-read-conversation.sh $CONVERSATION_ID"
        echo "   ./dm-send-message-queue.sh $CONVERSATION_ID \"Your message\""

        exit 0
    else
        echo "❌ Failed to queue DM approval"
        exit 1
    fi
else
    # Fallback: Submit directly to queue API
    echo "⚠️  queue-submit-action.sh not found, using direct API call"

    QUEUE_PAYLOAD=$(jq -n \
        --arg action_type "send_dm" \
        --arg agent_name "$AGENT_NAME" \
        --argjson payload "$PAYLOAD" \
        '{actionType: $action_type, agentName: $agent_name, payload: $payload, priority: 1}')

    RESPONSE=$(curl -s -X POST "${QUEUE_URL}/actions" \
        -H "Content-Type: application/json" \
        -d "$QUEUE_PAYLOAD")

    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

    if [ "$SUCCESS" = "true" ]; then
        ACTION_ID=$(echo "$RESPONSE" | jq -r '.action.id')
        echo "✅ DM approval queued successfully!"
        echo "   Action ID: $ACTION_ID"
        exit 0
    else
        echo "❌ Failed to queue DM approval"
        echo "$RESPONSE" | jq '.'
        exit 1
    fi
fi
