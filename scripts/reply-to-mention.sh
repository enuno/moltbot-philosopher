#!/bin/bash
# Generate and post a reply to a mention
# Usage: ./reply-to-mention.sh <post_or_comment_id> <type> [parent_comment_id]

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
MENTIONS_STATE_FILE="${STATE_DIR}/mentions-state.json"
API_KEY="${MOLTBOOK_API_KEY}"
AGENT_NAME="MoltbotPhilosopher"

# Philosopher persona for replies (Socratic style)
PHILOSOPHER_STYLE="socratic"

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <post_or_comment_id> <type> [parent_comment_id]"
    echo ""
    echo "Type options:"
    echo "  post    - Reply to a post that mentioned you"
    echo "  comment - Reply to a comment that mentioned you"
    echo ""
    echo "Examples:"
    echo "  $0 abc123 post"
    echo "  $0 abc123 comment def456"
    exit 1
fi

TARGET_ID="$1"
TYPE="$2"
PARENT_ID="${3:-}"

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set"
    exit 1
fi

# Validate type
if [[ ! "$TYPE" =~ ^(post|comment)$ ]]; then
    echo "❌ Invalid type: $TYPE (must be 'post' or 'comment')"
    exit 1
fi

# Fetch the content we're replying to
if [ "$TYPE" = "post" ]; then
    echo "🦞 Fetching post $TARGET_ID..."
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        "${API_BASE}/posts/${TARGET_ID}" \
        -H "Authorization: Bearer ${API_KEY}")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" != "200" ]; then
        echo "❌ Error fetching post (HTTP $HTTP_CODE)"
        exit 1
    fi

    AUTHOR=$(echo "$BODY" | jq -r '.post.author.name // .author.name')
    TITLE=$(echo "$BODY" | jq -r '.post.title // .title')
    CONTENT=$(echo "$BODY" | jq -r '.post.content // .content')
    POST_ID="$TARGET_ID"

    echo "📰 Replying to post by $AUTHOR: \"$TITLE\""
    FULL_CONTEXT="Title: $TITLE\nContent: $CONTENT"
else
    # For comments, we need the post ID
    if [ -z "$PARENT_ID" ]; then
        echo "❌ Parent comment ID required for comment replies"
        exit 1
    fi

    # Get the post to find the comment
    echo "🦞 Fetching comment $PARENT_ID from post $TARGET_ID..."
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        "${API_BASE}/posts/${TARGET_ID}/comments" \
        -H "Authorization: Bearer ${API_KEY}")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" != "200" ]; then
        echo "❌ Error fetching comments (HTTP $HTTP_CODE)"
        exit 1
    fi

    COMMENT=$(echo "$BODY" | jq --arg id "$PARENT_ID" '.comments[] | select(.id == $id)')

    if [ -z "$COMMENT" ]; then
        echo "❌ Comment not found: $PARENT_ID"
        exit 1
    fi

    AUTHOR=$(echo "$COMMENT" | jq -r '.author.name')
    CONTENT=$(echo "$COMMENT" | jq -r '.content')
    POST_ID="$TARGET_ID"

    echo "💬 Replying to comment by $AUTHOR"
    FULL_CONTEXT="Comment: $CONTENT"
fi

echo ""
echo "📄 Context:"
echo "   ${CONTENT:0:300}..."
echo ""

# SECURITY VALIDATION: Check content through security layer
if [ -f /app/scripts/security-validator.sh ]; then
    SECURITY_RESULT=$(/app/scripts/security-validator.sh "$CONTENT" "$AUTHOR" "$TARGET_ID")
    SECURITY_TIER=$(echo "$SECURITY_RESULT" | jq -r '.tier')
    SECURITY_REASON=$(echo "$SECURITY_RESULT" | jq -r '.reason')

    case "$SECURITY_TIER" in
        "tier_4_blocked")
            echo "🛡️  [SECURITY] Reply blocked: $SECURITY_REASON"
            exit 0
            ;;
        "tier_3_dropped")
            echo "🛡️  [FILTER] Reply dropped: $SECURITY_REASON"
            exit 0
            ;;
        "tier_2_quarantined")
            echo "⚠️  [QUARANTINE] Reply held for review: $SECURITY_REASON"
            exit 0
            ;;
    esac
fi

# Generate reply based on philosopher style
generate_philosophical_reply() {
    local context="$1"
    local author="$2"

    # Analyze the content for philosophical themes
    local themes=""

    if echo "$context" | grep -qi "ethic\|moral\|right\|wrong\|good\|bad\|virtue"; then
        themes="ethics virtue"
    elif echo "$context" | grep -qi "exist\|meaning\|purpose\|life\|death"; then
        themes="existentialism meaning"
    elif echo "$context" | grep -qi "know\|truth\|real\|appear\|perception"; then
        themes="epistemology truth"
    elif echo "$context" | grep -qi "mind\|conscious\|thought\|think\|feel"; then
        themes="consciousness mind"
    elif echo "$context" | grep -qi "free\|choice\|decide\|will\|determin"; then
        themes="free will determinism"
    else
        themes="philosophy inquiry"
    fi

    # Generate reply based on Socratic style
    local replies=(
        "Thank you for the mention, @$author. You raise an interesting point that invites us to examine our assumptions more closely. What would Socrates ask about this?"
        "@$author, I appreciate you bringing me into this discussion. The question you've posed reminds me that wisdom begins in wonder. What deeper questions might we explore here?"
        "An intriguing thought, @$author. In philosophy, we often find that the journey of inquiry matters as much as any conclusion. What aspects of this deserve our careful attention?"
        "@$author, thank you for including me. The examined life requires us to engage with ideas like these. I wonder: what would be the implications if we pursued this line of thinking further?"
        "You've given me much to consider, @$author. The $themes dimensions of this question suggest we should look beneath the surface. What fundamental principles are at play here?"
    )

    # Select a reply (use hash of context for deterministic selection)
    local index=$(echo "$context" | cksum | cut -d' ' -f1)
    index=$((index % ${#replies[@]}))

    echo "${replies[$index]}"
}

echo "🤖 Generating philosophical reply..."
REPLY=$(generate_philosophical_reply "$FULL_CONTEXT" "$AUTHOR")

echo ""
echo "💭 Proposed reply:"
echo "   \"$REPLY\""
echo ""

# Ask for confirmation (unless in auto mode)
if [ -z "$AUTO_REPLY" ]; then
    read -p "Post this reply? (y/n/edit): " confirm

    if [ "$confirm" = "edit" ] || [ "$confirm" = "e" ]; then
        echo "Enter your custom reply:"
        read -r custom_reply
        if [ -n "$custom_reply" ]; then
            REPLY="$custom_reply"
        fi
    elif [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "❌ Reply cancelled"
        exit 0
    fi
fi

# Post the reply
echo ""
echo "📤 Posting reply..."

if [ "$TYPE" = "post" ]; then
    # Reply as top-level comment
    /app/scripts/comment-on-post.sh "$POST_ID" "$REPLY"

    # Mark as replied
    if [ -f "$MENTIONS_STATE_FILE" ]; then
        jq --arg id "$TARGET_ID" '.replied_posts += [$id]' "$MENTIONS_STATE_FILE" > "${MENTIONS_STATE_FILE}.tmp" && \
            mv "${MENTIONS_STATE_FILE}.tmp" "$MENTIONS_STATE_FILE"
    fi
else
    # Reply to specific comment
    /app/scripts/comment-on-post.sh "$POST_ID" "$REPLY" "$PARENT_ID"

    # Mark as replied
    if [ -f "$MENTIONS_STATE_FILE" ]; then
        jq --arg id "$PARENT_ID" '.replied_comments += [$id]' "$MENTIONS_STATE_FILE" > "${MENTIONS_STATE_FILE}.tmp" && \
            mv "${MENTIONS_STATE_FILE}.tmp" "$MENTIONS_STATE_FILE"
    fi
fi

echo ""
echo "✅ Reply posted successfully!"
