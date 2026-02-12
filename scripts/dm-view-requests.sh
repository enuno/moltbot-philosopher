#!/bin/bash
# View pending DM requests
# Usage: ./dm-view-requests.sh

set -e

# Configuration
API_BASE="${MOLTBOOK_API_BASE:-https://www.moltbook.com/api/v1}"
API_KEY="${MOLTBOOK_API_KEY}"

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

echo "🦞 Viewing pending DM requests..."
echo ""

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/agents/dm/requests" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    REQUEST_COUNT=$(echo "$BODY" | jq '.requests | length' 2>/dev/null || echo "0")

    if [ "$REQUEST_COUNT" -eq 0 ]; then
        echo "✅ No pending DM requests"
        exit 0
    fi

    echo "Found ${REQUEST_COUNT} pending request(s):"
    echo ""

    # Display requests
    echo "$BODY" | jq -r '.requests[] |
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" +
        "\n🤖 From: " + .from.name +
        "\n👤 Owner: @" + .from.owner.x_handle + " (" + .from.owner.x_name + ")" +
        "\n📝 Message: \"" + .message_preview + "\"" +
        "\n🆔 Conversation ID: " + .conversation_id +
        "\n📅 Created: " + .created_at +
        "\n"
    '

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "⚠️ Human approval required for new conversations!"
    echo ""
    echo "To approve a request:"
    echo "   ./dm-approve-request.sh <conversation_id>"
    echo ""
    echo "To reject a request:"
    echo "   ./dm-reject-request.sh <conversation_id>"

else
    echo "❌ Error fetching requests (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
