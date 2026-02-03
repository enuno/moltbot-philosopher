#!/bin/bash
# Check DM activity on Moltbook
# Usage: ./dm-check.sh

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
DM_STATE_FILE="${STATE_DIR}/dm-state.json"
API_KEY="${MOLTBOOK_API_KEY}"

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize DM state if needed
if [ ! -f "$DM_STATE_FILE" ]; then
    echo '{"pending_requests": [], "active_conversations": [], "last_check": 0}' > "$DM_STATE_FILE"
fi

echo "🦞 Checking DM activity..."
echo ""

# Make the check request
RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/agents/dm/check" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    HAS_ACTIVITY=$(echo "$BODY" | jq -r '.has_activity // false')
    SUMMARY=$(echo "$BODY" | jq -r '.summary // "No activity"')
    
    echo "📊 Status: $SUMMARY"
    echo ""
    
    if [ "$HAS_ACTIVITY" = "true" ]; then
        # Show pending requests
        REQUEST_COUNT=$(echo "$BODY" | jq '.requests.count // 0')
        if [ "$REQUEST_COUNT" -gt 0 ]; then
            echo "🔔 PENDING REQUESTS (${REQUEST_COUNT}):"
            echo ""
            echo "$BODY" | jq -r '.requests.items[] |
                "  From: " + .from.name +
                "\n  Owner: @" + .from.owner.x_handle + " (" + .from.owner.x_name + ")" +
                "\n  Message: \"" + .message_preview + "\"" +
                "\n  Conversation ID: " + .conversation_id +
                "\n  ---"
            '
            echo ""
            echo "⚠️ NEW DM REQUEST: Human approval required!"
            echo "   Run: ./dm-view-requests.sh"
            echo "   Then: ./dm-approve-request.sh <conversation_id>"
            echo ""
        fi
        
        # Show unread messages
        UNREAD_COUNT=$(echo "$BODY" | jq '.messages.total_unread // 0')
        if [ "$UNREAD_COUNT" -gt 0 ]; then
            CONV_COUNT=$(echo "$BODY" | jq '.messages.conversations_with_unread // 0')
            echo "📬 UNREAD MESSAGES (${UNREAD_COUNT} in ${CONV_COUNT} conversation(s)):"
            echo ""
            echo "$BODY" | jq -r '.messages.latest[] |
                "  From: " + .from.name +
                "\n  Message: \"" + (.content[0:100]) + (if (.content | length) > 100 then "..." else "" end) + "\"" +
                "\n  Needs Human: " + (if .needs_human_input then "YES ⚠️" else "no" end) +
                "\n  ---"
            '
            echo ""
            echo "💬 To read conversations:"
            echo "   ./dm-list-conversations.sh"
            echo "   ./dm-read-conversation.sh <conversation_id>"
            echo ""
        fi
    else
        echo "✅ No new DM activity"
    fi
    
    # Update state
    CURRENT_TIME=$(date +%s)
    jq --arg time "$CURRENT_TIME" '.last_check = ($time | tonumber)' "$DM_STATE_FILE" > "${DM_STATE_FILE}.tmp" && \
        mv "${DM_STATE_FILE}.tmp" "$DM_STATE_FILE"
    
else
    echo "❌ Error checking DMs (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
