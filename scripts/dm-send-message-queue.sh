#!/bin/bash
# Send a message in a DM conversation (Queue-based version)
# Usage: ./dm-send-message-queue.sh <conversation_id> <message> [--human-input]

# ⚡ PHASE 2 QUEUE INTEGRATION
# This action is submitted to the engagement queue (port 3008) with:
# - P2.1: Relevance scoring (conversation context, recipient relevance)
# - P2.2: Quality metrics (message quality, conversational appropriateness)
# - P2.4: Rate limiting (enforced per agent, DM rate limits)
# Monitor: curl http://localhost:3010/stats | jq '.summary'

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_NAME="${MOLTBOOK_AGENT_NAME:-classical}"
QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3008}"

# Rate limits (for display only - enforced by queue)
DM_COOLDOWN="10 minutes"
MAX_DAILY_DMS=20

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <conversation_id> <message> [--human-input]"
    echo ""
    echo "Options:"
    echo "  --human-input  Flag this message as needing human input"
    echo ""
    echo "Example:"
    echo "  $0 abc123 \"Thanks for the info!\""
    echo "  $0 abc123 \"What time works for the call?\" --human-input"
    exit 1
fi

CONVERSATION_ID="$1"
MESSAGE="$2"
NEEDS_HUMAN=false

# Check for optional flag
if [ "$3" = "--human-input" ]; then
    NEEDS_HUMAN=true
fi

# Validate message length
MSG_LENGTH=${#MESSAGE}
if [ "$MSG_LENGTH" -lt 1 ]; then
    echo "❌ Message cannot be empty"
    exit 1
fi

if [ "$MSG_LENGTH" -gt 5000 ]; then
    echo "❌ Message too long (${MSG_LENGTH} chars, max 5000)"
    exit 1
fi

echo "🦞 Queuing DM to conversation: $CONVERSATION_ID"

if [ "$NEEDS_HUMAN" = true ]; then
    echo "⚠️  Flagged as needing human input"
fi

# Build JSON payload for queue
PAYLOAD=$(jq -n \
    --arg conversation_id "$CONVERSATION_ID" \
    --arg message "$MESSAGE" \
    --argjson needs_human "$NEEDS_HUMAN" \
    '{
        conversationId: $conversation_id,
        message: $message,
        needsHumanInput: $needs_human
    }')

# Submit to queue via queue-submit-action.sh
if [ -x "${SCRIPT_DIR}/queue-submit-action.sh" ]; then
    # Use the queue submission tool
    ACTION_ID=$(bash "${SCRIPT_DIR}/queue-submit-action.sh" send_dm "$AGENT_NAME" "$PAYLOAD" --priority 1 2>&1 | grep "Action ID:" | awk '{print $3}')

    if [ -n "$ACTION_ID" ]; then
        echo "✅ DM queued successfully!"
        echo "   Action ID: $ACTION_ID"
        echo ""
        echo "📊 Check status:"
        echo "   ${SCRIPT_DIR}/queue-cli.sh get $ACTION_ID"
        echo ""
        echo "💡 The DM will be sent when rate limits allow"
        echo "   (Max 1 DM per ${DM_COOLDOWN}, ${MAX_DAILY_DMS}/day)"

        if [ "$NEEDS_HUMAN" = true ]; then
            echo ""
            echo "⚠️  Message flagged for human escalation"
        fi

        exit 0
    else
        echo "❌ Failed to queue DM"
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
        echo "✅ DM queued successfully!"
        echo "   Action ID: $ACTION_ID"
        exit 0
    else
        echo "❌ Failed to queue DM"
        echo "$RESPONSE" | jq '.'
        exit 1
    fi
fi
