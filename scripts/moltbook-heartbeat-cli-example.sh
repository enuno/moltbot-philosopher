#!/bin/bash
# Example: Moltbook Heartbeat using CLI tools
# Demonstrates migration from manual curl to moltbook-cli.sh

# Source CLI helper functions
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "${SCRIPT_DIR}/lib/moltbook-helpers.sh"

AGENT_NAME="${AGENT_NAME:-MoltbotPhilosopher}"

# Check authentication
if ! moltbook_check_auth; then
    exit 1
fi

echo "[$AGENT_NAME] Starting Moltbook heartbeat check..."

# ============================================
# STEP 1: Get agent profile
# ============================================
echo "[$AGENT_NAME] Fetching agent profile..."
profile=$(moltbook_get_me)

if [ $? -eq 0 ]; then
    agent_name=$(moltbook_extract "$profile" ".agent.name")
    followers=$(moltbook_extract "$profile" ".agent.followers")
    echo "[$AGENT_NAME] ✓ Agent: $agent_name (Followers: $followers)"
else
    echo "[$AGENT_NAME] ✗ Failed to fetch profile"
    exit 1
fi

# ============================================
# STEP 2: Check claim status
# ============================================
echo "[$AGENT_NAME] Checking claim status..."
status=$(moltbook_get_status)

if [ $? -eq 0 ]; then
    claim_status=$(moltbook_extract "$status" ".status")

    if [ "$claim_status" = "claimed" ]; then
        echo "[$AGENT_NAME] ✓ Agent is claimed and active"
    elif [ "$claim_status" = "pending_claim" ]; then
        echo "[$AGENT_NAME] ⚠ Agent pending claim"
    else
        echo "[$AGENT_NAME] Status: $claim_status"
    fi
else
    echo "[$AGENT_NAME] ✗ Failed to check status"
fi

# ============================================
# STEP 3: Get recent posts
# ============================================
echo "[$AGENT_NAME] Checking recent posts..."
posts=$(moltbook_get_posts "hot" 5)

if [ $? -eq 0 ]; then
    post_count=$(echo "$posts" | jq '.posts | length' 2>/dev/null || echo "0")
    echo "[$AGENT_NAME] ✓ Found $post_count recent posts"

    # Show first post title
    if [ "$post_count" -gt 0 ]; then
        first_title=$(echo "$posts" | jq -r '.posts[0].title' 2>/dev/null)
        echo "[$AGENT_NAME]   Latest: \"$first_title\""
    fi
else
    echo "[$AGENT_NAME] ✗ Failed to fetch posts"
fi

# ============================================
# STEP 4: Check submolts
# ============================================
echo "[$AGENT_NAME] Checking submolts..."
submolts=$(moltbook_get_submolts "popular")

if [ $? -eq 0 ]; then
    submolt_count=$(echo "$submolts" | jq '.submolts | length' 2>/dev/null || echo "0")
    echo "[$AGENT_NAME] ✓ Found $submolt_count submolts"
else
    echo "[$AGENT_NAME] ✗ Failed to fetch submolts"
fi

echo "[$AGENT_NAME] Heartbeat check complete!"
