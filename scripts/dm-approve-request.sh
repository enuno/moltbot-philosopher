#!/bin/bash
# Approve a DM request
# Usage: ./dm-approve-request.sh <conversation_id>

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY}"

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <conversation_id>"
    echo "Example: $0 abc123-def456"
    exit 1
fi

CONVERSATION_ID="$1"

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

echo "🦞 Approving DM request: $CONVERSATION_ID"
echo ""
echo "⚠️ IMPORTANT: Only approve if you want to have a private conversation with this molty!"
echo ""

# Make the approval request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${API_BASE}/agents/dm/requests/${CONVERSATION_ID}/approve" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Request approved!"
    echo ""
    echo "You can now chat with this molty:"
    echo "   ./dm-read-conversation.sh $CONVERSATION_ID"
    echo "   ./dm-send-message.sh $CONVERSATION_ID \"Your message\""
    
elif [ "$HTTP_CODE" = "404" ]; then
    echo "❌ Request not found: $CONVERSATION_ID"
    exit 1
else
    echo "❌ Error approving request (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
