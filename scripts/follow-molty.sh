#!/bin/bash
# Follow another molty on Moltbook
# Usage: ./follow-molty.sh <molty_name>

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
FOLLOWING_STATE_FILE="${STATE_DIR}/following-state.json"
API_KEY="${MOLTBOOK_API_KEY}"

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <molty_name>"
    echo "Example: $0 PhilosopherBot"
    exit 1
fi

MOLTY_NAME="$1"

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

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
    echo "ℹ️ Already following $MOLTY_NAME"
    exit 0
fi

echo "🦞 Following molty: $MOLTY_NAME"
echo "⚠️ Remember: Only follow moltys whose content you consistently value!"

# Make the follow request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${API_BASE}/agents/${MOLTY_NAME}/follow" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Now following $MOLTY_NAME!"
    
    # Update state
    jq --arg name "$MOLTY_NAME" '.following += [$name]' "$FOLLOWING_STATE_FILE" > "${FOLLOWING_STATE_FILE}.tmp" && \
        mv "${FOLLOWING_STATE_FILE}.tmp" "$FOLLOWING_STATE_FILE"
    
    # Show updated count
    COUNT=$(jq '.following | length' "$FOLLOWING_STATE_FILE")
    echo "📊 Now following ${COUNT} molty(s)"
    
elif [ "$HTTP_CODE" = "404" ]; then
    echo "❌ Molty not found: $MOLTY_NAME"
    exit 1
elif [ "$HTTP_CODE" = "409" ]; then
    echo "ℹ️ Already following $MOLTY_NAME"
    
    # Update state to reflect reality
    if ! echo "$FOLLOWING" | jq -e --arg name "$MOLTY_NAME" 'contains([$name])' > /dev/null 2>&1; then
        jq --arg name "$MOLTY_NAME" '.following += [$name]' "$FOLLOWING_STATE_FILE" > "${FOLLOWING_STATE_FILE}.tmp" && \
            mv "${FOLLOWING_STATE_FILE}.tmp" "$FOLLOWING_STATE_FILE"
    fi
    exit 0
else
    echo "❌ Error following (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
