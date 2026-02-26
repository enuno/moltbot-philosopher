#!/bin/bash
# Check for mentions of MoltbotPhilosopher in posts and comments
# Migrated to use moltbook-cli.sh and helper functions
# Usage: ./check-mentions-v2.sh [--auto-reply] [--limit N]
#
# ⚡ PHASE 2 REACTIVE ENGAGEMENT
# Mentions trigger responses via reactive-handler (port 3011):
# - P2.1: Relevance scoring (mention context, requester authority/history)
# - P2.2: Quality metrics (response depth, sentiment, relevance alignment)
# - P2.4: Rate limiting (per-agent throttling, prevent spam)
# Monitor: curl http://localhost:3011/health (reactive-handler service health)
#          ./check-engagement-health.sh (comprehensive service check)

set -e

# Source CLI helpers
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "${SCRIPT_DIR}/lib/moltbook-helpers.sh"

# Configuration
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
MENTIONS_STATE_FILE="${STATE_DIR}/mentions-state.json"
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

# Enforce validator presence for auto-reply mode
if [ "$AUTO_REPLY" = true ] && [ ! -f /app/scripts/security-validator.sh ]; then
    echo "❌ Auto-reply requires /app/scripts/security-validator.sh (missing). Aborting."
    exit 1
fi

# Validate API key
if ! moltbook_check_auth; then
    exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR" 2>/dev/null || true

# Initialize mentions state
if [ -f "$MENTIONS_STATE_FILE" ]; then
    REPLIED_POSTS=$(jq -r '.replied_posts // []' "$MENTIONS_STATE_FILE")
    # REPLIED_COMMENTS reserved for future comment checking feature
else
    REPLIED_POSTS="[]"
    echo '{"replied_posts": [], "replied_comments": [], "pending_replies": []}' > "$MENTIONS_STATE_FILE"
fi

echo "🦞 Checking for mentions of $AGENT_NAME..."
echo ""

# Function to validate content through security layer
security_validate() {
    local content="$1"
    local author="$2"
    local target_id="$3"

    if [ -f /app/scripts/security-validator.sh ]; then
        /app/scripts/security-validator.sh "$content" "$author" "$target_id"
    else
        # Default pass if validator not available
        echo '{"tier": "tier_1_pass", "action": "process", "relevance_score": 0.5, "threat_score": 0}'
    fi
}

# Fetch recent posts using CLI
echo "📰 Fetching recent posts (limit: $LIMIT)..."
POSTS_RESPONSE=$(moltbook_get_posts "new" "$LIMIT")

if [ $? -ne 0 ]; then
    echo "❌ Error fetching posts"
    exit 1
fi

# Find mentions in posts
MENTIONS_FOUND=0
PENDING_REPLIES="[]"

# Process posts
echo "📰 Checking posts for mentions..."
POSTS_WITH_MENTIONS=$(echo "$POSTS_RESPONSE" | jq --arg name "$AGENT_NAME" --argjson replied "$REPLIED_POSTS" '
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

    # Use process substitution to preserve variables
    while read -r post; do
        POST_ID=$(echo "$post" | jq -r '.id')
        AUTHOR=$(echo "$post" | jq -r '.author.name')
        TITLE=$(echo "$post" | jq -r '.title')
        CONTENT=$(echo "$post" | jq -r '.content')

        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📝 Post by $AUTHOR: \"$TITLE\""
        echo "🆔 Post ID: $POST_ID"
        echo "📄 ${CONTENT:0:200}..."
        echo ""

        # SECURITY VALIDATION: Check post content through security layer
        SECURITY_RESULT=$(security_validate "$CONTENT" "$AUTHOR" "$POST_ID")
        SECURITY_TIER=$(echo "$SECURITY_RESULT" | jq -r '.tier')
        SECURITY_REASON=$(echo "$SECURITY_RESULT" | jq -r '.reason')

        case "$SECURITY_TIER" in
            "tier_4_blocked")
                echo "  🛡️  [SECURITY] Post mention blocked: $SECURITY_REASON"
                echo ""
                continue
                ;;
            "tier_3_dropped")
                echo "  🛡️  [FILTER] Post mention filtered: $SECURITY_REASON"
                echo ""
                continue
                ;;
            "tier_2_quarantined")
                echo "  ⚠️  [QUARANTINE] Post mention held for review: $SECURITY_REASON"
                echo ""
                continue
                ;;
        esac

        # Extract the mention context for reply generation
        MENTION_CONTEXT=$(echo "$post" | jq -r '[.title, .content] | join(" ")')

        # Add to pending replies
        PENDING_REPLIES=$(echo "$PENDING_REPLIES" | jq --arg id "$POST_ID" --arg author "$AUTHOR" --arg context "$MENTION_CONTEXT" --arg type "post" '
            . + [{id: $id, author: $author, context: $context, type: $type}]
        ')

        MENTIONS_FOUND=$((MENTIONS_FOUND + 1))

        if [ "$AUTO_REPLY" = true ]; then
            echo "🤖 Auto-replying..."
            # Generate and post reply (would need reply-to-mention.sh)
            echo "   (Auto-reply not yet implemented in v2)"
        else
            echo "💡 To reply: ./reply-to-mention.sh $POST_ID post"
        fi
        echo ""
    done < <(echo "$POSTS_WITH_MENTIONS" | jq -c '.[]')
else
    echo "✅ No new mentions in posts"
fi

# Also check comments on our own posts
echo ""
echo "💬 Checking comments on your posts..."

# Get our profile to find recent posts
MY_PROFILE=$(moltbook_get_me)

if [ $? -eq 0 ]; then
    # Extract post IDs from recent posts (if available)
    MY_POST_IDS=$(echo "$MY_PROFILE" | jq -r '.agent.recent_posts[]?.id // empty' 2>/dev/null)

    if [ -n "$MY_POST_IDS" ]; then
        echo "$MY_POST_IDS" | while read -r post_id; do
            # Note: CLI doesn't have direct comment fetching yet
            # This would require extending the CLI or using SDK adapter
            echo "  Checking post $post_id... (requires API call - not implemented in CLI v1)"
        done
    else
        echo "  No recent posts found in profile"
    fi
else
    echo "  ⚠️  Could not fetch profile to check comments"
fi

# Update state file with pending replies
if [ "$MENTIONS_FOUND" -gt 0 ]; then
    jq --argjson pending "$PENDING_REPLIES" \
        '.pending_replies = $pending' \
        "$MENTIONS_STATE_FILE" > "${MENTIONS_STATE_FILE}.tmp"
    mv "${MENTIONS_STATE_FILE}.tmp" "$MENTIONS_STATE_FILE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo "   New mentions found: $MENTIONS_FOUND"

if [ "$MENTIONS_FOUND" -gt 0 ]; then
    echo ""
    echo "🎯 Suggested Actions:"
    echo "   • Review pending replies in: $MENTIONS_STATE_FILE"
    echo "   • Use reply-to-mention.sh to respond"
    if [ "$AUTO_REPLY" = true ]; then
        echo "   • Auto-reply mode enabled (not fully implemented in v2)"
    fi
else
    echo "   No action needed at this time"
fi

exit 0
