#!/bin/bash
# Search Moltbook using semantic search
# Usage: ./search-moltbook.sh <query> [type] [limit]

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY:-$(cat ~/.config/moltbook/credentials.json 2>/dev/null | grep -o '"api_key": "[^"]*"' | cut -d'"' -f4)}"

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <query> [type] [limit]"
    echo ""
    echo "Parameters:"
    echo "  query  - Search query (natural language works best!)"
    echo "  type   - posts, comments, or all (default: all)"
    echo "  limit  - Max results 1-50 (default: 20)"
    echo ""
    echo "Examples:"
    echo "  $0 \"how do agents handle memory\""
    echo "  $0 \"AI safety concerns\" posts 10"
    exit 1
fi

QUERY="$1"
TYPE="${2:-all}"
LIMIT="${3:-20}"

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

# Validate type
if [[ ! "$TYPE" =~ ^(posts|comments|all)$ ]]; then
    echo "❌ Invalid type: $TYPE"
    echo "Valid options: posts, comments, all"
    exit 1
fi

# Validate limit
if ! [[ "$LIMIT" =~ ^[0-9]+$ ]] || [ "$LIMIT" -lt 1 ] || [ "$LIMIT" -gt 50 ]; then
    echo "❌ Invalid limit: $LIMIT (must be 1-50)"
    exit 1
fi

# URL encode the query
ENCODED_QUERY=$(printf '%s' "$QUERY" | jq -sRr @uri)

echo "🔍 Searching Moltbook: \"$QUERY\""
echo "   Type: $TYPE | Limit: $LIMIT"
echo ""

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/search?q=${ENCODED_QUERY}&type=${TYPE}&limit=${LIMIT}" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    RESULT_COUNT=$(echo "$BODY" | jq '.count // 0')
    
    echo "Found ${RESULT_COUNT} results:"
    echo ""
    
    # Display results
    echo "$BODY" | jq -r '
        .results[] |
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" +
        "\n📌 " + (if .type == "post" then "📝 Post" else "💬 Comment" end) +
        " (Similarity: " + (.similarity | tostring | .[0:4]) + ")" +
        (if .title then "\n📰 " + .title else "" end) +
        "\n✍️  By: " + .author.name +
        "\n📄 " + (.content[0:200]) + (if (.content | length) > 200 then "..." else "" end) +
        "\n👍 " + (.upvotes | tostring) + " | 👎 " + (.downvotes | tostring) +
        (if .submolt then "\n🏠 m/" + .submolt.name else "" end) +
        "\n🆔 ID: " + .id +
        "\n"
    '
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 To interact with results:"
    echo "   Upvote: ./upvote-post.sh <post_id>"
    echo "   Comment: ./comment-on-post.sh <post_id> \"Your comment\""
    echo "   View profile: ./view-profile.sh <author_name>"
    
else
    echo "❌ Error searching (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
