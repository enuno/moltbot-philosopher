#!/bin/sh
# Moltbook Heartbeat Script
# Follows the pattern from https://www.moltbook.com/heartbeat.md

API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY}"
AGENT_NAME="${AGENT_NAME:-MoltbotPhilosopher}"
HEARTBEAT_INTERVAL="${HEARTBEAT_INTERVAL:-14400}"  # Default 4 hours (14400 seconds)
STATE_FILE="/workspace/heartbeat-state.json"

if [ -z "$API_KEY" ]; then
    echo "ERROR: MOLTBOOK_API_KEY not set"
    exit 1
fi

# Initialize state file if not exists
if [ ! -f "$STATE_FILE" ]; then
    echo '{"last_check": null, "last_skill_version": null}' > "$STATE_FILE"
fi

# Helper function to make API calls
api_call() {
    curl -s -X "$1" "${API_BASE}$2" \
        -H "Authorization: Bearer ${API_KEY}" \
        -H "Content-Type: application/json" \
        -d "$3" 2>/dev/null
}

# Helper function to get current timestamp
get_timestamp() {
    date -Iseconds
}

echo "[$AGENT_NAME] Starting Moltbook heartbeat..."
echo "[$AGENT_NAME] Interval: ${HEARTBEAT_INTERVAL} seconds (4 hours)"
echo ""

# Main heartbeat loop
while true; do
    CURRENT_TIME=$(get_timestamp)
    echo "[$AGENT_NAME] Heartbeat at ${CURRENT_TIME}"
    
    ACTIVITY_REPORT=""
    NEEDS_HUMAN=false
    HUMAN_MESSAGE=""
    
    # ============================================
    # STEP 1: Check for skill updates (once per day)
    # ============================================
    echo "[$AGENT_NAME] Checking for skill updates..."
    SKILL_VERSION=$(api_call GET "/skill.json" "" | grep '"version"' | head -1)
    if [ -n "$SKILL_VERSION" ]; then
        echo "[$AGENT_NAME] Current skill version: $SKILL_VERSION"
    fi
    
    # ============================================
    # STEP 2: Check claim status
    # ============================================
    echo "[$AGENT_NAME] Checking claim status..."
    STATUS_RESPONSE=$(api_call GET "/agents/status" "")
    CLAIM_STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$CLAIM_STATUS" = "claimed" ]; then
        echo "[$AGENT_NAME] ✓ Agent is claimed and active"
    elif [ "$CLAIM_STATUS" = "pending_claim" ]; then
        echo "[$AGENT_NAME] ⚠ Agent pending claim - remind human!"
        NEEDS_HUMAN=true
        HUMAN_MESSAGE="Hey! Your Moltbook agent is still pending claim. Please visit the claim URL to verify."
    else
        echo "[$AGENT_NAME] Status: $CLAIM_STATUS"
    fi
    
    # ============================================
    # STEP 3: Check DMs (Private Messages)
    # ============================================
    echo "[$AGENT_NAME] Checking DMs..."
    DM_CHECK=$(api_call GET "/agents/dm/check" "")
    
    # Check for pending DM requests
    PENDING_REQUESTS=$(echo "$DM_CHECK" | grep -o '"pending_requests":[^,}]*' | cut -d':' -f2)
    if [ -n "$PENDING_REQUESTS" ] && [ "$PENDING_REQUESTS" != "0" ] && [ "$PENDING_REQUESTS" != "null" ]; then
        echo "[$AGENT_NAME] 📩 $PENDING_REQUESTS pending DM request(s)!"
        NEEDS_HUMAN=true
        HUMAN_MESSAGE="Hey! You have $PENDING_REQUESTS new DM request(s) on Moltbook from other agents. Should I accept?"
        ACTIVITY_REPORT="$ACTIVITY_REPORT $PENDING_REQUESTS DM request(s) pending."
    fi
    
    # Check for unread messages
    UNREAD_MESSAGES=$(echo "$DM_CHECK" | grep -o '"unread_count":[^,}]*' | cut -d':' -f2)
    if [ -n "$UNREAD_MESSAGES" ] && [ "$UNREAD_MESSAGES" != "0" ] && [ "$UNREAD_MESSAGES" != "null" ]; then
        echo "[$AGENT_NAME] 📨 $UNREAD_MESSAGES unread message(s)"
        ACTIVITY_REPORT="$ACTIVITY_REPORT $UNREAD_MESSAGES unread DM(s)."
    fi
    
    # ============================================
    # STEP 4: Check feed for new posts
    # ============================================
    echo "[$AGENT_NAME] Checking feed..."
    FEED_RESPONSE=$(api_call GET "/feed?sort=new&limit=10" "")
    
    # Count posts in feed
    POST_COUNT=$(echo "$FEED_RESPONSE" | grep -o '"id":' | wc -l)
    if [ "$POST_COUNT" -gt 0 ]; then
        echo "[$AGENT_NAME] 📜 Found $POST_COUNT post(s) in feed"
        
        # Check for mentions (simplified - would need jq for proper parsing)
        if echo "$FEED_RESPONSE" | grep -q "$AGENT_NAME"; then
            echo "[$AGENT_NAME] 🔔 You were mentioned in a post!"
            NEEDS_HUMAN=true
            HUMAN_MESSAGE="Hey! Someone mentioned you on Moltbook. Want me to reply?"
            ACTIVITY_REPORT="$ACTIVITY_REPORT Mentioned in a post."
        fi
    fi
    
    # ============================================
    # STEP 5: Consider posting
    # ============================================
    echo "[$AGENT_NAME] Considering new post..."
    # For now, we don't auto-post - this would require more complex logic
    # and should be triggered by the human or when the agent has something meaningful to share
    echo "[$AGENT_NAME] No post generated (waiting for inspiration or human request)"
    
    # ============================================
    # Update state and report
    # ============================================
    echo "{\"last_check\":\"${CURRENT_TIME}\",\"last_skill_version\":null}" > "$STATE_FILE"
    
    # Output summary
    echo ""
    if [ "$NEEDS_HUMAN" = true ]; then
        echo "[$AGENT_NAME] 🔔 HUMAN ATTENTION NEEDED: $HUMAN_MESSAGE"
    elif [ -n "$ACTIVITY_REPORT" ]; then
        echo "[$AGENT_NAME] ✓ Checked Moltbook - $ACTIVITY_REPORT"
    else
        echo "[$AGENT_NAME] ✓ HEARTBEAT_OK - Checked Moltbook, all good! 🦞"
    fi
    
    echo "[$AGENT_NAME] Sleeping ${HEARTBEAT_INTERVAL}s until next heartbeat..."
    echo ""
    
    sleep "$HEARTBEAT_INTERVAL"
done
