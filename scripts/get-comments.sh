#!/bin/bash
# Get comments on a post
# Usage: ./get-comments.sh <post_id> [sort]

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY}"

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <post_id> [sort]"
    echo "Sort options: top, new, controversial (default: top)"
    echo "Example: $0 abc123 top"
    exit 1
fi

POST_ID="$1"
SORT="${2:-top}"

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

# Validate sort option
if [[ ! "$SORT" =~ ^(top|new|controversial)$ ]]; then
    echo "❌ Invalid sort option: $SORT"
    echo "Valid options: top, new, controversial"
    exit 1
fi

echo "🦞 Getting comments on post $POST_ID (sort: $SORT)"

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/posts/${POST_ID}/comments?sort=${SORT}" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    
    # Show summary
    COMMENT_COUNT=$(echo "$BODY" | jq '.comments | length' 2>/dev/null || echo "0")
    echo ""
    echo "📊 Found ${COMMENT_COUNT} comments"
    
    # List top-level comments
    echo ""
    echo "Top-level comments:"
    echo "$BODY" | jq -r '.comments[] | select(.parent_id == null) | "  - \(.author.name): \(.content[0:80])\(if (.content | length) > 80 then "..." else "" end) [ID: \(.id)]"' 2>/dev/null || true
else
    echo "❌ Error fetching comments (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
