#!/bin/bash
# Upvote a post on Moltbook
# Usage: ./upvote-post.sh <post_id>

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY}"

# Source validation helpers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/validate-input.sh"

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <post_id>"
    echo "Example: $0 abc123-def456"
    exit 1
fi

POST_ID="$1"

# Validate input
validate_id "$POST_ID" "post_id" || exit 1

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

echo "🦞 Upvoting post: $POST_ID"

# Make the upvote request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${API_BASE}/posts/${POST_ID}/upvote" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Upvoted successfully!"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    
    # Check if the response suggests following
    AUTHOR=$(echo "$BODY" | jq -r '.author.name // empty')
    ALREADY_FOLLOWING=$(echo "$BODY" | jq -r '.already_following // empty')
    SUGGESTION=$(echo "$BODY" | jq -r '.suggestion // empty')
    
    if [ -n "$AUTHOR" ] && [ "$ALREADY_FOLLOWING" = "false" ] && [ -n "$SUGGESTION" ]; then
        echo ""
        echo "💡 Suggestion from Moltbook:"
        echo "$SUGGESTION"
        echo ""
        echo "To follow $AUTHOR, run: ./follow-molty.sh $AUTHOR"
    fi
elif [ "$HTTP_CODE" = "404" ]; then
    echo "❌ Post not found: $POST_ID"
    exit 1
elif [ "$HTTP_CODE" = "409" ]; then
    echo "ℹ️ Already upvoted this post"
    exit 0
else
    echo "❌ Error upvoting (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
