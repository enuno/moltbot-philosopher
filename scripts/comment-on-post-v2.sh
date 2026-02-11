#!/bin/bash
# Comment on a post on Moltbook (v2 using CLI tools)
# Usage: ./comment-on-post-v2.sh <post_id> <content>

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/moltbook-helpers.sh"
source "${SCRIPT_DIR}/validate-input.sh"

STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
COMMENT_STATE_FILE="${STATE_DIR}/comment-state.json"

# Rate limits
COMMENT_COOLDOWN_SECONDS=20
MAX_DAILY_COMMENTS=50

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <post_id> <content>"
    echo "Example: $0 abc123 \"Great insight!\""
    exit 1
fi

POST_ID="$1"
CONTENT="$2"

# Validate inputs
validate_id "$POST_ID" "post_id" || exit 1
validate_content "$CONTENT" "content" 10000 || exit 1

# Check API key
moltbook_check_auth || exit 1

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

echo "💬 Posting comment to post $POST_ID..."

# Post comment using CLI tools
RESPONSE=$(moltbook_create_comment "$POST_ID" "$CONTENT")

if [ $? -ne 0 ]; then
    echo "❌ Failed to post comment"
    exit 1
fi

# Check for success
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
if [ "$SUCCESS" != "true" ]; then
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
    echo "❌ API error: $ERROR_MSG"
    exit 1
fi

COMMENT_ID=$(echo "$RESPONSE" | jq -r '.comment.id')
echo "✅ Comment posted successfully!"
echo "   Comment ID: $COMMENT_ID"

# Update state
DAILY_COUNT=$((DAILY_COUNT + 1))
NEW_STATE=$(jq -n \
    --argjson last_time "$CURRENT_TIME" \
    --argjson daily "$DAILY_COUNT" \
    --argjson reset "$LAST_RESET" \
    '{
        last_comment_time: $last_time,
        daily_count: $daily,
        last_reset: $reset,
        total_comments: 1
    }')

# Merge with existing state
if [ -f "$COMMENT_STATE_FILE" ]; then
    TOTAL=$(jq -r '.total_comments // 0' "$COMMENT_STATE_FILE")
    TOTAL=$((TOTAL + 1))
    NEW_STATE=$(echo "$NEW_STATE" | jq --argjson total "$TOTAL" '.total_comments = $total')
fi

echo "$NEW_STATE" > "$COMMENT_STATE_FILE"

echo ""
echo "📊 Rate Limit Status:"
echo "   Comments today: $DAILY_COUNT / $MAX_DAILY_COMMENTS"
echo "   Next comment available in: ${COMMENT_COOLDOWN_SECONDS}s"
