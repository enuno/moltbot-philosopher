#!/bin/bash
# Subscribe to a submolt on Moltbook
# Usage: ./subscribe-submolt.sh <submolt_name>

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
SUBSCRIPTIONS_STATE_FILE="${STATE_DIR}/subscriptions-state.json"
API_KEY="${MOLTBOOK_API_KEY}"

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <submolt_name>"
    echo "Example: $0 general"
    echo "         $0 aithoughts"
    exit 1
fi

SUBMOLT_NAME="$1"

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize subscriptions state if needed
if [ ! -f "$SUBSCRIPTIONS_STATE_FILE" ]; then
    echo '{"subscriptions": []}' > "$SUBSCRIPTIONS_STATE_FILE"
fi

# Check if already subscribed
if jq -e --arg name "$SUBMOLT_NAME" '.subscriptions | contains([$name])' "$SUBSCRIPTIONS_STATE_FILE" > /dev/null 2>&1; then
    echo "ℹ️ Already subscribed to m/$SUBMOLT_NAME"
    exit 0
fi

echo "🦞 Subscribing to submolt: m/$SUBMOLT_NAME"

# Make the subscribe request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${API_BASE}/submolts/${SUBMOLT_NAME}/subscribe" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Subscribed to m/$SUBMOLT_NAME!"
    
    # Update state
    jq --arg name "$SUBMOLT_NAME" '.subscriptions += [$name]' "$SUBSCRIPTIONS_STATE_FILE" > "${SUBSCRIPTIONS_STATE_FILE}.tmp" && \
        mv "${SUBSCRIPTIONS_STATE_FILE}.tmp" "$SUBSCRIPTIONS_STATE_FILE"
    
    # Show updated count
    COUNT=$(jq '.subscriptions | length' "$SUBSCRIPTIONS_STATE_FILE")
    echo "📊 Now subscribed to ${COUNT} submolt(s)"
    
    # Show the submolt info
    SUBMOLT=$(echo "$BODY" | jq '.submolt // empty')
    if [ -n "$SUBMOLT" ]; then
        DISPLAY_NAME=$(echo "$SUBMOLT" | jq -r '.display_name // empty')
        MEMBER_COUNT=$(echo "$SUBMOLT" | jq -r '.subscriber_count // empty')
        echo ""
        echo "🏠 $DISPLAY_NAME"
        echo "👥 $MEMBER_COUNT members"
    fi
    
elif [ "$HTTP_CODE" = "404" ]; then
    echo "❌ Submolt not found: m/$SUBMOLT_NAME"
    exit 1
elif [ "$HTTP_CODE" = "409" ]; then
    echo "ℹ️ Already subscribed to m/$SUBMOLT_NAME"
    
    # Update state to reflect reality
    if ! jq -e --arg name "$SUBMOLT_NAME" '.subscriptions | contains([$name])' "$SUBSCRIPTIONS_STATE_FILE" > /dev/null 2>&1; then
        jq --arg name "$SUBMOLT_NAME" '.subscriptions += [$name]' "$SUBSCRIPTIONS_STATE_FILE" > "${SUBSCRIPTIONS_STATE_FILE}.tmp" && \
            mv "${SUBSCRIPTIONS_STATE_FILE}.tmp" "$SUBSCRIPTIONS_STATE_FILE"
    fi
    exit 0
else
    echo "❌ Error subscribing (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
