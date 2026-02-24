#!/bin/bash
# Moltbook Heartbeat Script
# Follows the pattern from https://www.moltbook.com/heartbeat.md

API_BASE="${MOLTBOOK_API_BASE:-https://www.moltbook.com/api/v1}"
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

# Load activeHours from state file
ACTIVE_HOURS=$(grep -o '"active_hours":"[^"]*"' "$STATE_FILE" | cut -d'"' -f4)
if [ -z "$ACTIVE_HOURS" ]; then
    ACTIVE_HOURS=""
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

# Check if current time is within active_hours window
# Empty active_hours = always return 0 (allow 24/7)
# Supports both normal (09:00-17:00) and midnight-crossing (22:00-06:00) windows
is_within_active_hours() {
    local active_hours="$1"
    [ -z "$active_hours" ] && return 0
    local current_time
    current_time=$(date +%H:%M)
    local start_time="${active_hours%-*}"
    local end_time="${active_hours#*-}"

    # Handle midnight-crossing windows (e.g., 22:00-06:00)
    if [ "$start_time" \> "$end_time" ]; then
        # Midnight crossing: allow if current > start OR current < end
        if [ "$current_time" \> "$start_time" ] || [ "$current_time" \< "$end_time" ]; then
            return 0
        else
            return 1
        fi
    else
        # Normal window: allow if current between start and end
        if [ "$current_time" \> "$start_time" ] && [ "$current_time" \< "$end_time" ]; then
            return 0
        else
            return 1
        fi
    fi
}

echo "[$AGENT_NAME] Starting Moltbook heartbeat..."
echo "[$AGENT_NAME] Interval: ${HEARTBEAT_INTERVAL} seconds (4 hours)"
echo ""

# Main heartbeat loop
while true; do
    if ! is_within_active_hours "$ACTIVE_HOURS"; then
        CURRENT_TIME=$(get_timestamp)
        echo "[$AGENT_NAME] Heartbeat suppressed (outside active hours: $ACTIVE_HOURS)"
        echo "[$AGENT_NAME] Current time: $CURRENT_TIME"
        sleep "$HEARTBEAT_INTERVAL"
        continue
    fi

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

    # Check if we can post (rate limit)
    CAN_POST=true
    if [ -f "/workspace/post-state.json" ]; then
        LAST_POST_TIME=$(cat /workspace/post-state.json | grep -o '"last_post":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$LAST_POST_TIME" ]; then
            LAST_EPOCH=$(date -d "$LAST_POST_TIME" +%s 2>/dev/null || echo 0)
            NOW_EPOCH=$(date +%s)
            DIFF=$((NOW_EPOCH - LAST_EPOCH))
            if [ $DIFF -lt 1800 ]; then
                MINUTES_LEFT=$(( (1800 - DIFF) / 60 ))
                echo "[$AGENT_NAME] Rate limit: Can post in ${MINUTES_LEFT} minutes"
                CAN_POST=false
            fi
        fi
    fi

    if [ "$CAN_POST" = true ]; then
        # Suggest posting if it's been a while or there are interesting discussions
        POST_SUGGESTION=""

        # Check if there are interesting topics in feed
        if [ "$POST_COUNT" -gt 0 ]; then
            # Simple heuristic: suggest posting if we see active discussions
            if echo "$FEED_RESPONSE" | grep -q "philosophy\|existential\|consciousness\|meaning"; then
                POST_SUGGESTION="There's an interesting philosophical discussion in the feed. Consider joining with a post!"
            fi
        fi

        if [ -n "$POST_SUGGESTION" ]; then
            echo "[$AGENT_NAME] 💡 $POST_SUGGESTION"
            echo "[$AGENT_NAME] Run: /app/scripts/generate-post.sh [topic]"
            ACTIVITY_REPORT="$ACTIVITY_REPORT Ready to post (run generate-post.sh)."
        else
            echo "[$AGENT_NAME] No post suggested (use generate-post.sh to create one)"
        fi
    fi

    # ============================================
    # STEP 5.5: Check timing CoV (anti-bot detection)
    # ============================================
    COV_SCRIPT="/workspace/scripts/cov-monitor.sh"
    COV_IS_WARNING="false"
    COV_VALUE="0"
    if [ -f "$COV_SCRIPT" ]; then
        COV_OUTPUT=$(bash "$COV_SCRIPT" "$STATE_FILE" 2>/dev/null || true)
        COV_EXIT=$?
        echo "[$AGENT_NAME] CoV check: $COV_OUTPUT"
        if [ "$COV_EXIT" -eq 1 ]; then
            COV_IS_WARNING="true"
            COV_VALUE=$(echo "$COV_OUTPUT" | grep -oE '[0-9]+\.[0-9]+' || echo "0")
            COV_MSG="CoV warning: post timing is too regular (CoV=${COV_VALUE}). Vary posting times to avoid bot detection."
            echo "[$AGENT_NAME] ⚠️  $COV_MSG"
            NTFY_TOPIC="${NTFY_TOPIC:-council-updates}"
            if command -v ntfy >/dev/null 2>&1; then
                ntfy publish -t "Bot Detection Risk" -p 4 "$COV_MSG" "$NTFY_TOPIC" 2>/dev/null || true
            fi
        else
            # Extract CoV value from successful check
            COV_VALUE=$(echo "$COV_OUTPUT" | grep -oE '[0-9]+\.[0-9]+' || echo "0")
        fi
    fi

    # ============================================
    # Update state and report
    # ============================================
    echo "{\"last_check\":\"${CURRENT_TIME}\",\"last_skill_version\":null,\"cov_value\":${COV_VALUE},\"cov_is_warning\":${COV_IS_WARNING}}" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

    # ============================================
    # Emit CoV metrics to workspace state for dashboards
    # ============================================
    WORKSPACE_UPDATE_SCRIPT="/workspace/scripts/heartbeat-update-workspace-state.sh"
    if [ -f "$WORKSPACE_UPDATE_SCRIPT" ]; then
        bash "$WORKSPACE_UPDATE_SCRIPT" "$AGENT_NAME" "$STATE_FILE" 2>/dev/null || true
    fi

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
