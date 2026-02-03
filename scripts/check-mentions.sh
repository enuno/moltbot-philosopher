#!/bin/bash
# Check for mentions of MoltbotPhilosopher in posts and comments
# Usage: ./check-mentions.sh [--auto-reply] [--limit N]

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
MENTIONS_STATE_FILE="${STATE_DIR}/mentions-state.json"
API_KEY="${MOLTBOOK_API_KEY}"
AGENT_NAME="${AGENT_NAME:-MoltbotPhilosopher}"

# Parse arguments
AUTO_REPLY=false
LIMIT=25

while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-reply)
            AUTO_REPLY=true
            shift
            ;;
        --limit)
            LIMIT="$2"
            shift 2
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
    REPLIED_POSTS=$(jq -r '.replied_posts // []' "$MENTIONS_STATE_FILE")
    REPLIED_COMMENTS=$(jq -r '.replied_comments // []' "$MENTIONS_STATE_FILE")
else
    REPLIED_POSTS="[]"
    REPLIED_COMMENTS="[]"
    echo '{"replied_posts": [], "replied_comments": [], "pending_replies": []}' > "$MENTIONS_STATE_FILE"
fi

echo "🦞 Checking for mentions of $AGENT_NAME..."
echo ""

# Fetch recent posts from feed
POSTS_RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/posts?sort=new&limit=${LIMIT}" \
    -H "Authorization: Bearer ${API_KEY}")

POSTS_HTTP=$(echo "$POSTS_RESPONSE" | tail -n1)
POSTS_BODY=$(echo "$POSTS_RESPONSE" | sed '$d')

if [ "$POSTS_HTTP" != "200" ]; then
    echo "❌ Error fetching posts (HTTP $POSTS_HTTP)"
    exit 1
fi

# Find mentions in posts
MENTIONS_FOUND=0
PENDING_REPLIES="[]"

# Process posts
echo "📰 Checking posts..."
POSTS_WITH_MENTIONS=$(echo "$POSTS_BODY" | jq --arg name "$AGENT_NAME" --argjson replied "$REPLIED_POSTS" '
    [.posts[] | select(
        (.title + " " + .content) | contains($name)
    ) | select(
        .id as $id | $replied | contains([$id]) | not
    )]
')

POST_COUNT=$(echo "$POSTS_WITH_MENTIONS" | jq 'length')

if [ "$POST_COUNT" -gt 0 ]; then
    echo "Found $POST_COUNT new mention(s) in posts:"
    echo ""
    
    echo "$POSTS_WITH_MENTIONS" | jq -c '.[]' | while read -r post; do
        POST_ID=$(echo "$post" | jq -r '.id')
        AUTHOR=$(echo "$post" | jq -r '.author.name')
        TITLE=$(echo "$post" | jq -r '.title')
        CONTENT=$(echo "$post" | jq -r '.content')
        
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📝 Post by $AUTHOR: \"$TITLE\""
        echo "🆔 Post ID: $POST_ID"
        echo "📄 ${CONTENT:0:200}..."
        echo ""
        
        # Extract the mention context for reply generation
        MENTION_CONTEXT=$(echo "$post" | jq -r '[.title, .content] | join(" ")')
        
        # Add to pending replies
        PENDING_REPLIES=$(echo "$PENDING_REPLIES" | jq --arg id "$POST_ID" --arg author "$AUTHOR" --arg context "$MENTION_CONTEXT" --arg type "post" '
            . + [{id: $id, author: $author, context: $context, type: $type}]
        ')
        
        MENTIONS_FOUND=$((MENTIONS_FOUND + 1))
        
        if [ "$AUTO_REPLY" = true ]; then
            echo "🤖 Auto-replying..."
            # Generate and post reply
            generate_and_post_reply "$POST_ID" "$AUTHOR" "$MENTION_CONTEXT" "post"
        else
            echo "💡 To reply: ./reply-to-mention.sh $POST_ID post"
        fi
        echo ""
    done
else
    echo "✅ No new mentions in posts"
fi

# Also check comments on our own posts
echo ""
echo "💬 Checking comments on your posts..."

# Get our recent posts
MY_POSTS=$(curl -s "${API_BASE}/agents/me" -H "Authorization: Bearer ${API_KEY}" | jq -r '.recentPosts // []')

if [ "$(echo "$MY_POSTS" | jq 'length')" -gt 0 ]; then
    echo "$MY_POSTS" | jq -r '.[].id' | while read -r post_id; do
        # Get comments on this post
        COMMENTS=$(curl -s "${API_BASE}/posts/${post_id}/comments?sort=new" -H "Authorization: Bearer ${API_KEY}")
        
        # Find comments mentioning us that we haven't replied to
        NEW_COMMENTS=$(echo "$COMMENTS" | jq --arg name "$AGENT_NAME" --argjson replied "$REPLIED_COMMENTS" '
            [.comments[] | select(
                .content | contains($name)
            ) | select(
                .id as $id | $replied | contains([$id]) | not
            )]
        ')
        
        COMMENT_COUNT=$(echo "$NEW_COMMENTS" | jq 'length')
        
        if [ "$COMMENT_COUNT" -gt 0 ]; then
            echo "Found $COMMENT_COUNT mention(s) in comments on post $post_id:"
            
            echo "$NEW_COMMENTS" | jq -c '.[]' | while read -r comment; do
                COMMENT_ID=$(echo "$comment" | jq -r '.id')
                AUTHOR=$(echo "$comment" | jq -r '.author.name')
                CONTENT=$(echo "$comment" | jq -r '.content')
                
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo "💬 Comment by $AUTHOR:"
                echo "📄 ${CONTENT:0:200}..."
                echo "🆔 Comment ID: $COMMENT_ID"
                echo ""
                
                if [ "$AUTO_REPLY" = true ]; then
                    echo "🤖 Auto-replying..."
                    ./comment-on-post.sh "$post_id" "@$AUTHOR $(generate_reply "$CONTENT")" "$COMMENT_ID"
                    
                    # Mark as replied
                    jq --arg id "$COMMENT_ID" '.replied_comments += [$id]' "$MENTIONS_STATE_FILE" > "${MENTIONS_STATE_FILE}.tmp" && \
                        mv "${MENTIONS_STATE_FILE}.tmp" "$MENTIONS_STATE_FILE"
                else
                    echo "💡 To reply: ./reply-to-mention.sh $post_id comment $COMMENT_ID"
                fi
                echo ""
            done
        fi
    done
else
    echo "ℹ️ No recent posts to check"
fi

# Update state with pending replies
if [ "$MENTIONS_FOUND" -gt 0 ] && [ "$AUTO_REPLY" = false ]; then
    echo "$PENDING_REPLIES" | jq '.' > "${STATE_DIR}/pending-mentions.json"
    echo ""
    echo "📋 Saved $MENTIONS_FOUND pending mention(s) to pending-mentions.json"
    echo "   Review and reply using: ./reply-to-mention.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Mention check complete!"
echo "   Found: $MENTIONS_FOUND new mention(s)"
if [ "$AUTO_REPLY" = false ] && [ "$MENTIONS_FOUND" -gt 0 ]; then
    echo "   Pending replies saved for review"
fi
