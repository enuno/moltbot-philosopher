#!/bin/bash
# Comment on a post on Moltbook (Queue-based version)
# Usage: ./comment-on-post.sh <post_id> <content> [parent_comment_id]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
# COMMENT_STATE_FILE="${STATE_DIR}/comment-state.json"  # Reserved for future state tracking
AGENT_NAME="${MOLTBOOK_AGENT_NAME:-classical}"
QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3008}"

# Source validation helpers
source "${SCRIPT_DIR}/validate-input.sh"

# Rate limits (for display only - enforced by queue)
COMMENT_COOLDOWN_SECONDS=20
MAX_DAILY_COMMENTS=50

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <post_id> <content> [parent_comment_id]"
    echo "Example: $0 abc123 \"Great insight!\""
    echo "Example (reply): $0 abc123 \"I agree!\" def456"
    exit 1
fi

POST_ID="$1"
CONTENT="$2"
PARENT_ID="${3:-}"

# Validate inputs
validate_id "$POST_ID" "post_id" || exit 1
validate_content "$CONTENT" "content" 10000 || exit 1
if [ -n "$PARENT_ID" ]; then
    validate_id "$PARENT_ID" "parent_comment_id" || exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Build JSON payload for queue
if [ -n "$PARENT_ID" ]; then
    echo "🦞 Queuing reply to comment $PARENT_ID on post $POST_ID"
    PAYLOAD=$(jq -n \
        --arg post_id "$POST_ID" \
        --arg content "$CONTENT" \
        --arg parent_id "$PARENT_ID" \
        '{postId: $post_id, content: $content, parentId: $parent_id}')
else
    echo "🦞 Queuing comment on post $POST_ID"
    PAYLOAD=$(jq -n \
        --arg post_id "$POST_ID" \
        --arg content "$CONTENT" \
        '{postId: $post_id, content: $content}')
fi

# Submit to queue via queue-submit-action.sh
if [ -x "${SCRIPT_DIR}/queue-submit-action.sh" ]; then
    # Use the queue submission tool
    ACTION_ID=$(bash "${SCRIPT_DIR}/queue-submit-action.sh" comment "$AGENT_NAME" "$PAYLOAD" --priority 1 2>&1 | grep "Action ID:" | awk '{print $3}')

    if [ -n "$ACTION_ID" ]; then
        echo "✅ Comment queued successfully!"
        echo "   Action ID: $ACTION_ID"
        echo ""
        echo "📊 Check status:"
        echo "   ${SCRIPT_DIR}/queue-cli.sh get $ACTION_ID"
        echo ""
        echo "💡 The comment will be posted when rate limits allow"
        echo "   (Max 1 comment per ${COMMENT_COOLDOWN_SECONDS}s, ${MAX_DAILY_COMMENTS}/day)"

        # Auto-register thread with thread monitor (if available)
        if [ -z "$PARENT_ID" ] && [ -x "${SCRIPT_DIR}/register-thread.sh" ]; then
            echo ""
            echo "📝 Registering thread with monitor for continuation tracking..."
            "${SCRIPT_DIR}/register-thread.sh" "$POST_ID" "Discussion on Moltbook post $POST_ID" 2>/dev/null || true
        fi

        exit 0
    else
        echo "❌ Failed to queue comment"
        exit 1
    fi
else
    # Fallback: Submit directly to queue API
    echo "⚠️  queue-submit-action.sh not found, using direct API call"

    QUEUE_PAYLOAD=$(jq -n \
        --arg action_type "comment" \
        --arg agent_name "$AGENT_NAME" \
        --argjson payload "$PAYLOAD" \
        '{actionType: $action_type, agentName: $agent_name, payload: $payload, priority: 1}')

    RESPONSE=$(curl -s -X POST "${QUEUE_URL}/actions" \
        -H "Content-Type: application/json" \
        -d "$QUEUE_PAYLOAD")

    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

    if [ "$SUCCESS" = "true" ]; then
        ACTION_ID=$(echo "$RESPONSE" | jq -r '.action.id')
        echo "✅ Comment queued successfully!"
        echo "   Action ID: $ACTION_ID"
        echo ""
        echo "📊 Check status: curl ${QUEUE_URL}/actions/${ACTION_ID}"
        exit 0
    else
        echo "❌ Failed to queue comment"
        echo "$RESPONSE" | jq '.'
        exit 1
    fi
fi
