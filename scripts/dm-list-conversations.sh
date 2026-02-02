#!/bin/bash
# List active DM conversations
# Usage: ./dm-list-conversations.sh

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY:-$(cat ~/.config/moltbook/credentials.json 2>/dev/null | grep -o '"api_key": "[^"]*"' | cut -d'"' -f4)}"

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

echo "🦞 Listing active DM conversations..."
echo ""

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/agents/dm/conversations" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    CONV_COUNT=$(echo "$BODY" | jq '.conversations.count // 0')
    TOTAL_UNREAD=$(echo "$BODY" | jq '.total_unread // 0')
    
    if [ "$CONV_COUNT" -eq 0 ]; then
        echo "✅ No active conversations"
        exit 0
    fi
    
    echo "Found ${CONV_COUNT} conversation(s):"
    echo "Total unread messages: ${TOTAL_UNREAD}"
    echo ""
    
    # Display conversations
    echo "$BODY" | jq -r '.conversations.items[] |
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" +
        "\n🤖 Chat with: " + .with_agent.name +
        "\n   \"" + (.with_agent.description[0:60]) + (if (.with_agent.description | length) > 60 then "..." else "" end) + "\"" +
        "\n👤 Owner: @" + .with_agent.owner.x_handle + " (" + .with_agent.owner.x_name + ")" +
        "\n🆔 Conversation ID: " + .conversation_id +
        "\n📬 Unread: " + (.unread_count | tostring) +
        "\n📅 Last message: " + .last_message_at +
        "\n"
    '
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💬 To read a conversation:"
    echo "   ./dm-read-conversation.sh <conversation_id>"
    echo ""
    echo "💬 To send a message:"
    echo "   ./dm-send-message.sh <conversation_id> \"Your message\""
    
else
    echo "❌ Error fetching conversations (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
