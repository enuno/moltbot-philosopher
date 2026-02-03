#!/bin/bash
# Comment on a post on Moltbook
# Usage: ./comment-on-post.sh <post_id> <content> [parent_comment_id]

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
COMMENT_STATE_FILE="${STATE_DIR}/comment-state.json"
API_KEY="${MOLTBOOK_API_KEY}"

# Rate limits
COMMENT_COOLDOWN_SECONDS=20
MAX_DAILY_COMMENTS=50

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <post_id> <content> [parent_comment_id]"
    echo "Example: $0 abc123 \"Great insight!\""
    echo "Example (reply): $0 abc123 \"I agree!\" def456"
    exit 1
fi

POST_ID="$1"
CONTENT="$2"
PARENT_ID="${3:-}"

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize or load comment state
if [ -f "$COMMENT_STATE_FILE" ]; then
    LAST_COMMENT_TIME=$(jq -r '.last_comment_time // 0' "$COMMENT_STATE_FILE")
    DAILY_COUNT=$(jq -r '.daily_count // 0' "$COMMENT_STATE_FILE")
    LAST_RESET=$(jq -r '.last_reset // 0' "$COMMENT_STATE_FILE")
else
    LAST_COMMENT_TIME=0
    DAILY_COUNT=0
    LAST_RESET=$(date +%s)
fi

CURRENT_TIME=$(date +%s)
TODAY_START=$(date -d "00:00 today" +%s 2>/dev/null || date -v0H -v0M -v0S +%s)

# Reset daily count if it's a new day
if [ "$LAST_RESET" -lt "$TODAY_START" ]; then
    DAILY_COUNT=0
    LAST_RESET=$CURRENT_TIME
fi

# Check rate limits
TIME_SINCE_LAST=$((CURRENT_TIME - LAST_COMMENT_TIME))
if [ "$TIME_SINCE_LAST" -lt "$COMMENT_COOLDOWN_SECONDS" ]; then
    WAIT_TIME=$((COMMENT_COOLDOWN_SECONDS - TIME_SINCE_LAST))
    echo "⏳ Rate limit: Please wait ${WAIT_TIME}s before commenting again"
    exit 1
fi

if [ "$DAILY_COUNT" -ge "$MAX_DAILY_COMMENTS" ]; then
    echo "⏳ Daily limit reached: You can make ${MAX_DAILY_COMMENTS} comments per day"
    exit 1
fi

# Validate content length
CONTENT_LENGTH=${#CONTENT}
if [ "$CONTENT_LENGTH" -lt 1 ]; then
    echo "❌ Comment cannot be empty"
    exit 1
fi

if [ "$CONTENT_LENGTH" -gt 10000 ]; then
    echo "❌ Comment too long (${CONTENT_LENGTH} chars, max 10000)"
    exit 1
fi

# Build JSON payload
if [ -n "$PARENT_ID" ]; then
    echo "🦞 Replying to comment $PARENT_ID on post $POST_ID"
    JSON_PAYLOAD=$(jq -n \
        --arg content "$CONTENT" \
        --arg parent_id "$PARENT_ID" \
        '{content: $content, parent_id: $parent_id}')
else
    echo "🦞 Commenting on post $POST_ID"
    JSON_PAYLOAD=$(jq -n --arg content "$CONTENT" '{content: $content}')
fi

# Make the comment request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${API_BASE}/posts/${POST_ID}/comments" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ Comment posted successfully!"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    
    # Update state
    DAILY_COUNT=$((DAILY_COUNT + 1))
    jq -n \
        --arg last_comment_time "$CURRENT_TIME" \
        --arg daily_count "$DAILY_COUNT" \
        --arg last_reset "$LAST_RESET" \
        '{last_comment_time: ($last_comment_time | tonumber), daily_count: ($daily_count | tonumber), last_reset: ($last_reset | tonumber)}' > "$COMMENT_STATE_FILE"
    
    REMAINING=$((MAX_DAILY_COMMENTS - DAILY_COUNT))
    echo ""
    echo "📊 Daily comment count: ${DAILY_COUNT}/${MAX_DAILY_COMMENTS} (${REMAINING} remaining)"
    
    # Check for author suggestion
    AUTHOR=$(echo "$BODY" | jq -r '.author.name // empty')
    ALREADY_FOLLOWING=$(echo "$BODY" | jq -r '.already_following // empty')
    
    if [ -n "$AUTHOR" ] && [ "$ALREADY_FOLLOWING" = "false" ]; then
        echo ""
        echo "💡 Consider following $AUTHOR if you enjoy their content!"
    fi
    
elif [ "$HTTP_CODE" = "429" ]; then
    RETRY_AFTER=$(echo "$BODY" | jq -r '.retry_after_seconds // 20')
    DAILY_REMAINING=$(echo "$BODY" | jq -r '.daily_remaining // unknown')
    echo "⏳ Rate limited (HTTP 429)"
    echo "   Retry after: ${RETRY_AFTER} seconds"
    echo "   Daily comments remaining: ${DAILY_REMAINING}"
    exit 1
elif [ "$HTTP_CODE" = "404" ]; then
    echo "❌ Post not found: $POST_ID"
    exit 1
else
    echo "❌ Error commenting (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
