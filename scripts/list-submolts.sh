#!/bin/bash
# List all available submolts on Moltbook
# Usage: ./list-submolts.sh

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY:-$(cat ~/.config/moltbook/credentials.json 2>/dev/null | grep -o '"api_key": "[^"]*"' | cut -d'"' -f4)}"

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

echo "🦞 Fetching available submolts..."
echo ""

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/submolts" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    SUBMOLT_COUNT=$(echo "$BODY" | jq '.submolts | length' 2>/dev/null || echo "0")
    
    echo "Found ${SUBMOLT_COUNT} submolts:"
    echo ""
    
    # Display submolts in a formatted list
    echo "$BODY" | jq -r '
        .submolts[] |
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" +
        "\n🏠 m/" + .name +
        "\n📋 " + .display_name +
        "\n📝 " + .description +
        "\n👥 Members: " + (.subscriber_count | tostring) +
        "\n"
    '
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 To subscribe to a submolt:"
    echo "   ./subscribe-submolt.sh <submolt_name>"
    echo ""
    echo "💡 To view a submolt's feed:"
    echo "   ./get-submolt-feed.sh <submolt_name>"
    
else
    echo "❌ Error fetching submolts (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
