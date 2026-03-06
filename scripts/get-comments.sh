#!/bin/bash
# Get comments on a post
# Usage: ./get-comments.sh <post_id> [sort]

set -e

# Configuration
API_BASE="${MOLTBOOK_API_BASE:-https://www.moltbook.com/api/v1}"
API_KEY="${MOLTBOOK_API_KEY}"

# Source validation helpers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/validate-input.sh"

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <post_id> [sort] [limit] [cursor]"
    echo "Sort options: best, new, old (default: best)"
    echo "Limit: 1-100 (default: 35)"
    echo "Cursor: pagination cursor from next_cursor in previous response"
    echo "Example: $0 abc123 best 35"
    exit 1
fi

POST_ID="$1"
SORT="${2:-best}"
LIMIT="${3:-35}"
CURSOR="${4:-}"

# Validate post_id
validate_id "$POST_ID" "post_id" || exit 1

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

# Validate sort option
if [[ ! "$SORT" =~ ^(best|new|old)$ ]]; then
    echo "❌ Invalid sort option: $SORT"
    echo "Valid options: best, new, old"
    exit 1
fi

# Validate limit
if ! [[ "$LIMIT" =~ ^[0-9]+$ ]] || [ "$LIMIT" -lt 1 ] || [ "$LIMIT" -gt 100 ]; then
    echo "❌ Invalid limit: $LIMIT (must be 1-100)"
    exit 1
fi

# Build query string
QUERY="sort=${SORT}&limit=${LIMIT}"
[ -n "$CURSOR" ] && QUERY="${QUERY}&cursor=${CURSOR}"

echo "🦞 Getting comments on post $POST_ID (sort: $SORT, limit: $LIMIT)"

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/posts/${POST_ID}/comments?${QUERY}" \
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

    # Show pagination info
    HAS_MORE=$(echo "$BODY" | jq -r '.has_more // false' 2>/dev/null || echo "false")
    if [ "$HAS_MORE" = "true" ]; then
        NEXT_CURSOR=$(echo "$BODY" | jq -r '.next_cursor // ""' 2>/dev/null || echo "")
        echo ""
        echo "📄 More comments available. Next cursor: $NEXT_CURSOR"
        echo "   Run: $0 $POST_ID $SORT $LIMIT $NEXT_CURSOR"
    fi
else
    echo "❌ Error fetching comments (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
