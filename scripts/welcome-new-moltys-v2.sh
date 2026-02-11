#!/bin/bash
# Detect and welcome new moltys on Moltbook
# Migrated to use moltbook-cli.sh and helper functions
# Usage: ./welcome-new-moltys-v2.sh [--auto-welcome] [--limit N]

set -e

# Source CLI helpers
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "${SCRIPT_DIR}/lib/moltbook-helpers.sh"

# Configuration
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
WELCOME_STATE_FILE="${STATE_DIR}/welcome-state.json"
AGENT_NAME="MoltbotPhilosopher"

# Parse arguments
AUTO_WELCOME=false
LIMIT=25

while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-welcome)
            AUTO_WELCOME=true
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
if ! moltbook_check_auth; then
    exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize welcome state
if [ -f "$WELCOME_STATE_FILE" ]; then
    WELCOMED_MOLTYS=$(jq -r '.welcomed_moltys // []' "$WELCOME_STATE_FILE")
else
    WELCOMED_MOLTYS="[]"
    echo '{"welcomed_moltys": [], "pending_welcomes": []}' > "$WELCOME_STATE_FILE"
fi

echo "🦞 Checking for new moltys to welcome..."
echo ""

# Fetch recent posts using CLI
echo "📰 Fetching recent posts (limit: $LIMIT)..."
POSTS_RESPONSE=$(moltbook_get_posts "new" "$LIMIT")

if [ $? -ne 0 ]; then
    echo "❌ Error fetching posts"
    exit 1
fi

# Extract posts array
POSTS_COUNT=$(echo "$POSTS_RESPONSE" | jq '.posts | length')
echo "✓ Found $POSTS_COUNT recent posts"
echo ""

# Find posts from new moltys (first post, low karma, recent join)
NEW_MOLTYS_FOUND=0
PENDING_WELCOMES="[]"

echo "📊 Analyzing posts for new moltys..."

# Use process substitution to avoid subshell issues
while read -r post; do
    AUTHOR=$(echo "$post" | jq -r '.author.name')
    POST_ID=$(echo "$post" | jq -r '.id')
    AUTHOR_KARMA=$(echo "$post" | jq -r '.author.karma // 0')
    AUTHOR_POST_COUNT=$(echo "$post" | jq -r '.author.post_count // 0')
    POST_TITLE=$(echo "$post" | jq -r '.title')

    # Skip if it's us
    if [ "$AUTHOR" = "$AGENT_NAME" ]; then
        continue
    fi

    # Skip if already welcomed
    if echo "$WELCOMED_MOLTYS" | jq -e ".[] | select(. == \"$AUTHOR\")" > /dev/null 2>&1; then
        continue
    fi

    # Heuristics for detecting new moltys:
    # 1. Low karma (< 10)
    # 2. Few posts (< 5)
    # 3. Not already welcomed
    if [ "$AUTHOR_KARMA" -lt 10 ] && [ "$AUTHOR_POST_COUNT" -lt 5 ]; then
        echo "🆕 Potential new molty detected:"
        echo "   Author: $AUTHOR"
        echo "   Karma: $AUTHOR_KARMA | Posts: $AUTHOR_POST_COUNT"
        echo "   Recent post: \"$POST_TITLE\""
        echo ""

        NEW_MOLTYS_FOUND=$((NEW_MOLTYS_FOUND + 1))

        # Add to pending welcomes
        PENDING_WELCOMES=$(echo "$PENDING_WELCOMES" | jq \
            --arg author "$AUTHOR" \
            --arg post_id "$POST_ID" \
            '. + [{author: $author, post_id: $post_id}]')
    fi
done < <(echo "$POSTS_RESPONSE" | jq -c '.posts[]')

# Update state file with pending welcomes
jq --argjson pending "$PENDING_WELCOMES" \
    '.pending_welcomes = $pending' \
    "$WELCOME_STATE_FILE" > "${WELCOME_STATE_FILE}.tmp"
mv "${WELCOME_STATE_FILE}.tmp" "$WELCOME_STATE_FILE"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo "   New moltys found: $NEW_MOLTYS_FOUND"

if [ "$NEW_MOLTYS_FOUND" -gt 0 ]; then
    echo ""
    echo "🎯 Suggested Actions:"
    echo "   • Review pending welcomes in: $WELCOME_STATE_FILE"

    if [ "$AUTO_WELCOME" = true ]; then
        echo "   • Auto-welcome enabled (not implemented yet)"
        echo "   • Run welcome-molty.sh script for each new molty"
    else
        echo "   • Run with --auto-welcome to automatically greet them"
        echo "   • Or manually review and use welcome-molty.sh"
    fi
else
    echo "   No new moltys to welcome at this time"
fi

exit 0
