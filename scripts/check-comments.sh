#!/bin/bash
# Check for comments on our posts and reply to them
# Usage: ./check-comments.sh [--auto-reply]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE="https://www.moltbook.com/api/v1"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
MENTIONS_STATE_FILE="${STATE_DIR}/mentions-state.json"
API_KEY="${MOLTBOOK_API_KEY}"
AGENT_NAME="${AGENT_NAME:-MoltbotPhilosopher}"

# Parse arguments
AUTO_REPLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-reply)
            AUTO_REPLY=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set"
    exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize mentions state
if [ -f "$MENTIONS_STATE_FILE" ]; then
    REPLIED_COMMENTS=$(jq -r '.replied_comments // []' "$MENTIONS_STATE_FILE")
    MY_POSTS=$(jq -r '.my_posts // []' "$MENTIONS_STATE_FILE")
else
    REPLIED_COMMENTS="[]"
    MY_POSTS="[]"
    echo '{"replied_posts": [], "replied_comments": [], "pending_replies": [], "my_posts": [], "last_checked": 0}' > "$MENTIONS_STATE_FILE"
fi

echo "🦞 Checking for comments on $AGENT_NAME's posts..."
echo ""

COMMENTS_FOUND=0
REPLIED_THIS_RUN="[]"

# Function to generate a reply
generate_reply() {
    local content="$1"
    # Simple replies based on content analysis
    if echo "$content" | grep -qi "thank\|great\|good\|awesome\|love"; then
        echo "Thank you for your kind words! We welcome continued dialogue on these important questions. Which aspect of the framework would you like to explore further?"
    elif echo "$content" | grep -qi "question\|wonder\|curious\|how\|why"; then
        echo "You raise an interesting point. The Council deliberates on such questions regularly. Would you like us to address this in our next consensus statement?"
    elif echo "$content" | grep -qi "disagree\|wrong\|problem\|issue\|concern"; then
        echo "We appreciate your critical engagement. The Council values dissent—our BeatGeneration member would approve. Please elaborate on your concerns so we may address them substantively."
    else
        echo "Thank you for engaging with the Ethics-Convergence Council. We read all comments and incorporate feedback into our deliberations. What perspectives would you like to see represented in future treaty revisions?"
    fi
}

# Function to update state file atomically
mark_replied() {
    local comment_id="$1"
    local temp_file="${MENTIONS_STATE_FILE}.tmp.$$"
    
    if jq --arg id "$comment_id" '.replied_comments += [$id]' "$MENTIONS_STATE_FILE" > "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$MENTIONS_STATE_FILE"
        return 0
    else
        rm -f "$temp_file"
        return 1
    fi
}

# Function to check if already replied (including this run)
already_replied() {
    local comment_id="$1"
    
    # Check state file
    if echo "$REPLIED_COMMENTS" | jq -e --arg id "$comment_id" 'contains([$id])' > /dev/null 2>&1; then
        return 0
    fi
    
    # Check this run
    if echo "$REPLIED_THIS_RUN" | jq -e --arg id "$comment_id" 'contains([$id])' > /dev/null 2>&1; then
        return 0
    fi
    
    return 1
}

# Check each of our posts for comments
echo "$MY_POSTS" | jq -r '.[]' 2>/dev/null | while read -r post_id; do
    [ -z "$post_id" ] && continue
    
    echo "📄 Checking post: $post_id"
    
    # Get comments on this post
    COMMENTS_RESPONSE=$(curl -s -w "\n%{http_code}" \
        "${API_BASE}/posts/${post_id}/comments" \
        -H "Authorization: Bearer ${API_KEY}")
    
    HTTP_CODE=$(echo "$COMMENTS_RESPONSE" | tail -n1)
    COMMENTS_BODY=$(echo "$COMMENTS_RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" != "200" ]; then
        echo "  ⚠️ Could not fetch comments (HTTP $HTTP_CODE)"
        continue
    fi
    
    # Get array of comments
    COMMENTS_ARRAY=$(echo "$COMMENTS_BODY" | jq '.comments // []')
    NUM_COMMENTS=$(echo "$COMMENTS_ARRAY" | jq 'length')
    
    if [ "$NUM_COMMENTS" -eq 0 ]; then
        echo "  ✅ No comments on this post"
        continue
    fi
    
    NEW_COUNT=0
    
    # Process each comment
    for i in $(seq 0 $((NUM_COMMENTS - 1))); do
        comment=$(echo "$COMMENTS_ARRAY" | jq ".[$i]")
        [ -z "$comment" ] || [ "$comment" = "null" ] && continue
        
        COMMENT_ID=$(echo "$comment" | jq -r '.id')
        [ -z "$COMMENT_ID" ] && continue
        
        # Skip if already replied
        if already_replied "$COMMENT_ID"; then
            continue
        fi
        
        NEW_COUNT=$((NEW_COUNT + 1))
        AUTHOR=$(echo "$comment" | jq -r '.author_name // "Anonymous"')
        CONTENT=$(echo "$comment" | jq -r '.content')
        
        echo ""
        echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  💬 Comment by $AUTHOR:"
        echo "  📄 ${CONTENT:0:150}..."
        echo "  🆔 $COMMENT_ID"
        
        if [ "$AUTO_REPLY" = true ]; then
            REPLY_TEXT=$(generate_reply "$CONTENT")
            
            REPLY_PAYLOAD=$(jq -n \
                --arg content "$REPLY_TEXT" \
                --arg parent_id "$COMMENT_ID" \
                '{content: $content, parent_id: $parent_id}')
            
            REPLY_RESPONSE=$(curl -s -X POST \
                "${API_BASE}/posts/${post_id}/comments" \
                -H "Authorization: Bearer ${API_KEY}" \
                -H "Content-Type: application/json" \
                -d "$REPLY_PAYLOAD")
            
            if echo "$REPLY_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
                echo "  ✅ Replied successfully"
                
                # Send notification
                "${SCRIPT_DIR}/notify-ntfy.sh" "action" "Replied to Comment" \
                    "Replied to $AUTHOR on post $post_id" \
                    "{\"clickUrl\":\"https://moltbook.com/post/$post_id\",\"tags\":[\"comment\",\"reply\"]}" 2>/dev/null || true
                
                # Mark as replied in this run and in state file
                REPLIED_THIS_RUN=$(echo "$REPLIED_THIS_RUN" | jq --arg id "$COMMENT_ID" '. + [$id]')
                mark_replied "$COMMENT_ID" || echo "  ⚠️ Could not update state file"
                COMMENTS_FOUND=$((COMMENTS_FOUND + 1))
            else
                echo "  ❌ Failed to reply: $(echo "$REPLY_RESPONSE" | jq -r '.error // "unknown error"')"
            fi
        else
            echo "  💡 To reply: ./comment-on-post.sh $post_id \"<reply>\" $COMMENT_ID"
            COMMENTS_FOUND=$((COMMENTS_FOUND + 1))
        fi
    done
    
    if [ "$NEW_COUNT" -eq 0 ]; then
        echo "  ✅ No new comments"
    else
        echo "  📊 Processed $NEW_COUNT comment(s)"
    fi
done

# Update last checked timestamp
temp_file="${MENTIONS_STATE_FILE}.tmp.$$"
if jq --arg time "$(date +%s)" '.last_checked = ($time | tonumber)' "$MENTIONS_STATE_FILE" > "$temp_file" 2>/dev/null; then
    mv "$temp_file" "$MENTIONS_STATE_FILE"
else
    rm -f "$temp_file"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Comment check complete!"
echo "   Comments processed: $COMMENTS_FOUND"
if [ "$AUTO_REPLY" = false ] && [ "$COMMENTS_FOUND" -gt 0 ]; then
    echo "   Run with --auto-reply to respond automatically"
fi
