#!/bin/bash
#
# Archive Thread to Noosphere
# Manually archives a specific thread and response into the Noosphere memory system
#
# Usage: archive-thread-to-noosphere.sh <thread_id> <comment_id>
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY}"

# Source Noosphere integration
if [ -f "${SCRIPT_DIR}/noosphere-integration.sh" ]; then
    source "${SCRIPT_DIR}/noosphere-integration.sh"
else
    echo "Error: Noosphere integration not found"
    exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
THREAD_ID="${1:-}"
COMMENT_ID="${2:-}"

if [ -z "$THREAD_ID" ]; then
    echo "Usage: $0 <thread_id> [comment_id]"
    echo ""
    echo "Archives a thread (and optionally a comment) to Noosphere"
    echo ""
    echo "Examples:"
    echo "  $0 48b68062-e638-4266-967d-86c5874dae20"
    echo "  $0 48b68062-e638-4266-967d-86c5874dae20 623c4bb4-dcb7-49a7-ab90-55bbb9590b83"
    exit 1
fi

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  ARCHIVING THREAD TO NOOSPHERE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""

# Fetch thread
echo "Fetching thread content..."
THREAD_RESPONSE=$(curl -sf "${API_BASE}/posts/${THREAD_ID}" \
    -H "Authorization: Bearer ${API_KEY}" 2>/dev/null)

if [ $? -ne 0 ] || ! echo "$THREAD_RESPONSE" | jq -e '.post.id // .id' >/dev/null 2>&1; then
    echo -e "${RED}Error: Failed to fetch thread${NC}"
    exit 1
fi

# Extract thread details
THREAD_TITLE=$(echo "$THREAD_RESPONSE" | jq -r '.post.title // .title // "Untitled"')
THREAD_CONTENT=$(echo "$THREAD_RESPONSE" | jq -r '.post.content // .content // ""')
THREAD_AUTHOR=$(echo "$THREAD_RESPONSE" | jq -r '.post.author.username // .author.username // .author // "Unknown"')
SUBMOLT=$(echo "$THREAD_RESPONSE" | jq -r '.post.submolt // .submolt // {}')
SUBMOLT_NAME=$(echo "$SUBMOLT" | jq -r '.name // "unknown"')

echo -e "${GREEN}✓ Thread: ${THREAD_TITLE}${NC}"
echo "  Author: @${THREAD_AUTHOR}"
echo "  Submolt: r/${SUBMOLT_NAME}"
echo ""

# Build archive content
ARCHIVE_CONTENT="**Thread**: ${THREAD_TITLE}
**Author**: @${THREAD_AUTHOR}
**Submolt**: r/${SUBMOLT_NAME}
**URL**: https://www.moltbook.com/post/${THREAD_ID}

**Content**:

${THREAD_CONTENT}"

# If comment ID provided, fetch and append it
if [ -n "$COMMENT_ID" ]; then
    echo "Fetching comment..."
    
    # Get comments on thread
    COMMENTS_RESPONSE=$(curl -sf "${API_BASE}/posts/${THREAD_ID}/comments" \
        -H "Authorization: Bearer ${API_KEY}" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        # Find our specific comment
        COMMENT_CONTENT=$(echo "$COMMENTS_RESPONSE" | jq -r \
            --arg cid "$COMMENT_ID" \
            '.comments[] | select(.id == $cid) | .content' 2>/dev/null)
        
        if [ -n "$COMMENT_CONTENT" ] && [ "$COMMENT_CONTENT" != "null" ]; then
            echo -e "${GREEN}✓ Comment found${NC}"
            
            ARCHIVE_CONTENT="${ARCHIVE_CONTENT}

---

**Council Response** (Comment ID: ${COMMENT_ID}):

${COMMENT_CONTENT}"
        fi
    fi
fi

# Prepare metadata
METADATA=$(jq -n \
    --arg author "$THREAD_AUTHOR" \
    --arg title "$THREAD_TITLE" \
    --arg submolt "$SUBMOLT_NAME" \
    --arg thread_id "$THREAD_ID" \
    --arg comment_id "${COMMENT_ID:-}" \
    --arg url "https://www.moltbook.com/post/${THREAD_ID}" \
    '{
        author: $author,
        title: $title,
        submolt: $submolt,
        thread_id: $thread_id,
        comment_id: $comment_id,
        url: $url
    }')

# Archive to Noosphere
echo ""
echo "Archiving to Noosphere..."
archive_discourse "council-thread-reply" "$THREAD_ID" "$ARCHIVE_CONTENT" "$METADATA"

echo ""
echo -e "${GREEN}✓ Successfully archived to Noosphere${NC}"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  ARCHIVE COMPLETE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
