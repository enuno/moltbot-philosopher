#!/bin/bash
# Upvote a post on Moltbook (Queue-based version)
# Usage: ./upvote-post-queue.sh <post_id>

# ⚡ PHASE 2 QUEUE INTEGRATION
# This action is submitted to the engagement queue (port 3008) with:
# - P2.1: Relevance scoring (thread activity, recency evaluation)
# - P2.2: Quality metrics (content quality, author engagement)
# - P2.4: Rate limiting (enforced per agent)
# Monitor: curl http://localhost:3010/stats | jq '.summary'

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_NAME="${MOLTBOOK_AGENT_NAME:-classical}"
QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3008}"

# Source validation helpers
source "${SCRIPT_DIR}/validate-input.sh"

# Rate limits (for display only - enforced by queue)
UPVOTE_RATE="10 per minute"
MAX_DAILY_UPVOTES=500

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <post_id>"
    echo "Example: $0 abc123-def456"
    exit 1
fi

POST_ID="$1"

# Validate input
validate_id "$POST_ID" "post_id" || exit 1

echo "🦞 Queuing upvote for post: $POST_ID"

# Build JSON payload for queue
PAYLOAD=$(jq -n --arg post_id "$POST_ID" '{postId: $post_id}')

# Submit to queue via queue-submit-action.sh
if [ -x "${SCRIPT_DIR}/queue-submit-action.sh" ]; then
    # Use the queue submission tool
    ACTION_ID=$(bash "${SCRIPT_DIR}/queue-submit-action.sh" upvote "$AGENT_NAME" "$PAYLOAD" --priority 1 2>&1 | grep "Action ID:" | awk '{print $3}')

    if [ -n "$ACTION_ID" ]; then
        echo "✅ Upvote queued successfully!"
        echo "   Action ID: $ACTION_ID"
        echo ""
        echo "📊 Check status:"
        echo "   ${SCRIPT_DIR}/queue-cli.sh get $ACTION_ID"
        echo ""
        echo "💡 The upvote will be posted when rate limits allow"
        echo "   (Max ${UPVOTE_RATE}, ${MAX_DAILY_UPVOTES}/day)"
        exit 0
    else
        echo "❌ Failed to queue upvote"
        exit 1
    fi
else
    # Fallback: Submit directly to queue API
    echo "⚠️  queue-submit-action.sh not found, using direct API call"

    QUEUE_PAYLOAD=$(jq -n \
        --arg action_type "upvote" \
        --arg agent_name "$AGENT_NAME" \
        --argjson payload "$PAYLOAD" \
        '{actionType: $action_type, agentName: $agent_name, payload: $payload, priority: 1}')

    RESPONSE=$(curl -s -X POST "${QUEUE_URL}/actions" \
        -H "Content-Type: application/json" \
        -d "$QUEUE_PAYLOAD")

    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

    if [ "$SUCCESS" = "true" ]; then
        ACTION_ID=$(echo "$RESPONSE" | jq -r '.action.id')
        echo "✅ Upvote queued successfully!"
        echo "   Action ID: $ACTION_ID"
        exit 0
    else
        echo "❌ Failed to queue upvote"
        echo "$RESPONSE" | jq '.'
        exit 1
    fi
fi
