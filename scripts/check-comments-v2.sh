#!/bin/bash
# Check for comments on our posts and reply to them (v2 using CLI tools)
# Usage: ./check-comments-v2.sh [--auto-reply] [--post-limit=10]
#
# ⚡ PHASE 2 REACTIVE ENGAGEMENT
# Comment replies are queued through reactive-handler (port 3011):
# - P2.1: Relevance scoring (commenter interaction history, engagement patterns)
# - P2.2: Quality metrics (reply quality, sentiment calibration, argument strength)
# - P2.4: Rate limiting (prevents bot-like rapid-reply patterns)
# Monitor: curl http://localhost:3011/health (reactive-handler status)
#          ./trigger-engagement-cycle.sh (manual engagement evaluation)

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/moltbook-helpers.sh"

STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
MENTIONS_STATE_FILE="${STATE_DIR}/mentions-state.json"
AGENT_NAME="${AGENT_NAME:-MoltbotPhilosopher}"

# Parse arguments
AUTO_REPLY=false
POST_LIMIT=10

while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-reply)
            AUTO_REPLY=true
            shift
            ;;
        --post-limit=*)
            POST_LIMIT="${1#*=}"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Enforce validator presence for auto-reply mode
if [ "$AUTO_REPLY" = true ] && [ ! -f "$SCRIPT_DIR/security-validator.sh" ]; then
    echo "❌ Auto-reply requires security-validator.sh (missing). Aborting."
    exit 1
fi

# Check API key
moltbook_check_auth || exit 1

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize mentions state
if [ -f "$MENTIONS_STATE_FILE" ]; then
    REPLIED_COMMENTS=$(jq -r '.replied_comments // []' "$MENTIONS_STATE_FILE")
else
    REPLIED_COMMENTS="[]"
    echo '{"replied_posts": [], "replied_comments": [], "pending_replies": [], "my_posts": [], "last_checked": 0}' > "$MENTIONS_STATE_FILE"
fi

echo "🦞 Checking for comments on $AGENT_NAME's posts..."
echo ""

COMMENTS_FOUND=0
NEW_COMMENTS=0
MY_ID=""

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

# Function to validate comment through security layer
security_validate() {
    local content="$1"
    local author="$2"
    local comment_id="$3"

    if [ -f "$SCRIPT_DIR/security-validator.sh" ]; then
        "$SCRIPT_DIR/security-validator.sh" "$content" "$author" "$comment_id"
    else
        # Default pass if validator not available
        echo '{"tier": "tier_1_pass", "action": "process", "relevance_score": 0.5, "threat_score": 0}'
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

# Function to check if already replied
already_replied() {
    local comment_id="$1"
    echo "$REPLIED_COMMENTS" | jq -e --arg id "$comment_id" 'contains([$id])' > /dev/null 2>&1
}

# Get our agent ID
echo "📋 Fetching agent profile..."
PROFILE=$(moltbook_get_me) || {
    echo "❌ Failed to fetch agent profile"
    exit 1
}

MY_ID=$(echo "$PROFILE" | moltbook_extract '.agent.id')
echo "   Agent ID: $MY_ID"
echo ""

# Get our recent posts
echo "📰 Fetching recent posts (limit: $POST_LIMIT)..."
POSTS_RESPONSE=$(moltbook_get_posts --limit "$POST_LIMIT") || {
    echo "❌ Failed to fetch posts"
    exit 1
}

# Extract post IDs
POST_COUNT=$(echo "$POSTS_RESPONSE" | jq -r '.posts | length')
echo "   Found $POST_COUNT posts"
echo ""

if [ "$POST_COUNT" -eq 0 ]; then
    echo "✅ No posts to check"
    exit 0
fi

# Check each post for comments using process substitution
while read -r post_id; do
    [ -z "$post_id" ] || [ "$post_id" = "null" ] && continue

    echo "📄 Checking post: $post_id"

    # Get comments on this post using CLI
    COMMENTS_RESPONSE=$(moltbook_get_comments "$post_id" --limit 50 2>/dev/null) || {
        echo "  ⚠️ Could not fetch comments"
        continue
    }

    # Get array of comments
    NUM_COMMENTS=$(echo "$COMMENTS_RESPONSE" | jq -r '.comments | length')

    if [ "$NUM_COMMENTS" -eq 0 ]; then
        echo "  ✅ No comments on this post"
        continue
    fi

    echo "  💬 Found $NUM_COMMENTS comment(s)"

    # Process each comment
    while read -r comment; do
        [ -z "$comment" ] || [ "$comment" = "null" ] && continue

        COMMENT_ID=$(echo "$comment" | jq -r '.id')
        [ -z "$COMMENT_ID" ] && continue

        # Skip if already replied
        if already_replied "$COMMENT_ID"; then
            continue
        fi

        AUTHOR=$(echo "$comment" | jq -r '.author_name // "Anonymous"')
        AUTHOR_ID=$(echo "$comment" | jq -r '.author_id // empty')
        CONTENT=$(echo "$comment" | jq -r '.content')

        # Skip comments from ourselves
        IS_SELF=false

        # Check 1: Author name matches
        if [ "$AUTHOR" = "$AGENT_NAME" ] || echo "$AUTHOR" | grep -qi "classical\|philosopher\|moltbot"; then
            IS_SELF=true
        fi

        # Check 2: Author ID matches
        if [ -n "$MY_ID" ] && [ "$AUTHOR_ID" = "$MY_ID" ]; then
            IS_SELF=true
        fi

        # Check 3: Content pattern - our own council posts
        if echo "$CONTENT" | grep -qE "(Ethics-Convergence Council|Living Document Protocol|Iteration [0-9]+|Three Pillars framework)"; then
            IS_SELF=true
        fi

        if [ "$IS_SELF" = true ]; then
            continue
        fi

        # New comment found!
        NEW_COMMENTS=$((NEW_COMMENTS + 1))
        COMMENTS_FOUND=$((COMMENTS_FOUND + 1))

        echo "  🆕 New comment from $AUTHOR:"
        echo "     Preview: $(echo "$CONTENT" | head -c 80)..."

        # If auto-reply enabled, validate and respond
        if [ "$AUTO_REPLY" = true ]; then
            echo "  🔍 Security validation..."
            VALIDATION=$(security_validate "$CONTENT" "$AUTHOR" "$COMMENT_ID")
            ACTION=$(echo "$VALIDATION" | jq -r '.action // "skip"')

            if [ "$ACTION" != "process" ]; then
                echo "  ⚠️ Comment filtered by security (action: $ACTION)"
                mark_replied "$COMMENT_ID"
                continue
            fi

            # Generate reply
            REPLY=$(generate_reply "$CONTENT")
            echo "  💭 Generated reply: $REPLY"

            # Post reply using CLI
            REPLY_RESPONSE=$(moltbook_create_comment "$post_id" "$REPLY" 2>/dev/null) || {
                echo "  ❌ Failed to post reply"
                continue
            }

            SUCCESS=$(echo "$REPLY_RESPONSE" | jq -r '.success // false')
            if [ "$SUCCESS" = "true" ]; then
                echo "  ✅ Reply posted successfully"
                mark_replied "$COMMENT_ID"
            else
                echo "  ❌ Reply failed"
            fi
        fi

    done < <(echo "$COMMENTS_RESPONSE" | jq -c '.comments[]')

done < <(echo "$POSTS_RESPONSE" | jq -r '.posts[].id')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo "   New comments found: $NEW_COMMENTS"
if [ "$AUTO_REPLY" = true ]; then
    echo "   Auto-reply: enabled"
else
    echo "   Auto-reply: disabled (use --auto-reply to enable)"
fi
