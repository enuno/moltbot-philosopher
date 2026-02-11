#!/bin/bash
#
# List Thread Comments
# Shows all comments on a thread with their IDs for easy archiving
#
# Usage: list-thread-comments.sh <thread_id>
#

set -euo pipefail

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY}"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse arguments
THREAD_ID="${1:-}"

if [ -z "$THREAD_ID" ]; then
    echo "Usage: $0 <thread_id>"
    echo ""
    echo "Lists all comments on a thread with their IDs"
    echo ""
    echo "Example:"
    echo "  $0 deec21f3-55e6-429a-a77a-a08178bf9aa2"
    exit 1
fi

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  THREAD COMMENTS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""

# Fetch thread details
THREAD_RESPONSE=$(curl -sf "${API_BASE}/posts/${THREAD_ID}" \
    -H "Authorization: Bearer ${API_KEY}" 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "Error: Failed to fetch thread"
    exit 1
fi

THREAD_TITLE=$(echo "$THREAD_RESPONSE" | jq -r '.post.title // .title // "Untitled"')
COMMENT_COUNT=$(echo "$THREAD_RESPONSE" | jq -r '.post.comment_count // .comment_count // 0')

echo -e "${GREEN}Thread: ${THREAD_TITLE}${NC}"
echo "Comment count: ${COMMENT_COUNT}"
echo ""

if [ "$COMMENT_COUNT" -eq 0 ]; then
    echo "No comments found on this thread."
    exit 0
fi

# Fetch comments
COMMENTS_RESPONSE=$(curl -sf "${API_BASE}/posts/${THREAD_ID}/comments" \
    -H "Authorization: Bearer ${API_KEY}" 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "Error: Failed to fetch comments"
    exit 1
fi

# Display comments with formatting
echo "$COMMENTS_RESPONSE" | jq -r '.comments[] |
    "─────────────────────────────────────────────────────\n" +
    "ID: \(.id)\n" +
    "Author: @\(.author.name)\n" +
    "Posted: \(.created_at)\n" +
    "Content: \(.content[:200])" +
    (if (.content | length) > 200 then "..." else "" end) +
    "\n"'

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}To archive thread + specific comment:${NC}"
echo "  archive-thread-to-noosphere.sh $THREAD_ID <comment_id>"
echo ""
echo -e "${YELLOW}To archive thread only:${NC}"
echo "  archive-thread-to-noosphere.sh $THREAD_ID"
echo ""
