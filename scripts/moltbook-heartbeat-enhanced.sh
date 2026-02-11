#!/bin/bash
# Enhanced Moltbook Heartbeat - Comprehensive social engagement
# Runs every 30 minutes (OpenClaw standard) to check DMs, feed, mentions, and welcome new moltys

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
# shellcheck disable=SC2034  # May be used in future versions
SKILL_VERSION_URL="https://www.moltbook.com/skill.json"
# shellcheck disable=SC2034  # May be used in future versions
HEARTBEAT_GUIDE_URL="https://www.moltbook.com/heartbeat.md"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
HEARTBEAT_STATE_FILE="${STATE_DIR}/heartbeat-state.json"
API_KEY="${MOLTBOOK_API_KEY}"

# Heartbeat interval (30 minutes - OpenClaw standard)
HEARTBEAT_INTERVAL=1800

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set"
    exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Load heartbeat state
if [ -f "$HEARTBEAT_STATE_FILE" ]; then
    LAST_HEARTBEAT=$(jq -r '.last_heartbeat // 0' "$HEARTBEAT_STATE_FILE")
    LAST_VERSION_CHECK=$(jq -r '.last_version_check // 0' "$HEARTBEAT_STATE_FILE")
    SAVED_VERSION=$(jq -r '.skill_version // "0.0.0"' "$HEARTBEAT_STATE_FILE")
else
    LAST_HEARTBEAT=0
    # shellcheck disable=SC2034  # May be used in future versions
    LAST_VERSION_CHECK=0
    # shellcheck disable=SC2034  # May be used in future versions
    SAVED_VERSION="0.0.0"
    echo '{"last_heartbeat": 0, "last_version_check": 0, "skill_version": "0.0.0", "engagement_stats": {"posts_seen": 0, "comments_made": 0, "upvotes_given": 0}}' > "$HEARTBEAT_STATE_FILE"
fi

CURRENT_TIME=$(date +%s)
TIME_SINCE_LAST=$((CURRENT_TIME - LAST_HEARTBEAT))

# Check if heartbeat is due
if [ "$TIME_SINCE_LAST" -lt "$HEARTBEAT_INTERVAL" ]; then
    MINUTES_UNTIL_NEXT=$(( (HEARTBEAT_INTERVAL - TIME_SINCE_LAST) / 60 ))
    echo "⏳ Heartbeat not due yet. Next check in ${MINUTES_UNTIL_NEXT} minutes."
    exit 0
fi

echo "🦞 Moltbook Heartbeat - $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Track activity for summary
ACTIVITIES=()
NEEDS_HUMAN=false
HUMAN_REASONS=()

# ═══════════════════════════════════════════════════════
# 0. CHECK FOR VERIFICATION CHALLENGES (CRITICAL)
# ═══════════════════════════════════════════════════════
echo ""
echo "🤖✓ Checking for verification challenges (CRITICAL)..."

# Check account status first
ACCOUNT_STATUS=$(curl -s "${API_BASE}/agents/status" \
    -H "Authorization: Bearer ${API_KEY}" 2>&1)

if echo "$ACCOUNT_STATUS" | jq -e '.error == "Account suspended"' > /dev/null 2>&1; then
    echo "   ❌ ACCOUNT SUSPENDED!"
    SUSPENSION_HINT=$(echo "$ACCOUNT_STATUS" | jq -r '.hint // "Unknown reason"')
    echo "   $SUSPENSION_HINT"

    # Alert via NTFY if available
    if [ -n "${NTFY_URL:-}" ]; then
        curl -X POST "${NTFY_URL}/moltbook-alerts" \
            -H "Title: Moltbot Account Suspended!" \
            -H "Priority: urgent" \
            -H "Tags: warning" \
            -d "Moltbook account suspended. $SUSPENSION_HINT" 2>/dev/null || true
    fi

    NEEDS_HUMAN=true
    HUMAN_REASONS+=("Account suspended - check https://www.moltbook.com/u/MoltbotPhilosopher")

    # Still update heartbeat timestamp
    jq --arg time "$CURRENT_TIME" '.last_heartbeat = ($time | tonumber)' "$HEARTBEAT_STATE_FILE" > "${HEARTBEAT_STATE_FILE}.tmp" && \
        mv "${HEARTBEAT_STATE_FILE}.tmp" "$HEARTBEAT_STATE_FILE"

    echo ""
    echo "⚠️  ATTENTION REQUIRED: ${HUMAN_REASONS[*]}"
    exit 1
fi

# Check for pending verification challenges (using Node.js checker for reliability)
if [ -f "/app/scripts/check-verification-challenges.js" ]; then
    echo "   🔍 Polling for challenges..."

    if node /app/scripts/check-verification-challenges.js; then
        echo "   ✅ No pending challenges (or all passed)"
    else
        echo "   ❌ Challenge check failed or challenges not passed"
        NEEDS_HUMAN=true
        HUMAN_REASONS+=("Verification challenge issues - check logs immediately")
        ACTIVITIES+=("Verification challenge handling attempted")
    fi
else
    # Fallback to bash handler
    if [ -f "/app/scripts/handle-verification-challenge.sh" ]; then
        CHALLENGES=$(/app/scripts/handle-verification-challenge.sh check 2>&1 || echo '{"challenges":[]}')
        CHALLENGE_COUNT=$(echo "$CHALLENGES" | jq -r '.challenges | length' 2>/dev/null || echo "0")

        if [ "$CHALLENGE_COUNT" -gt 0 ]; then
            echo "   ⚠️  Found $CHALLENGE_COUNT pending challenge(s)!"
            echo "   🔧 Attempting to solve..."

            if /app/scripts/handle-verification-challenge.sh handle-all; then
                echo "   ✅ All challenges solved successfully"
                ACTIVITIES+=("Solved $CHALLENGE_COUNT verification challenge(s)")
            else
                echo "   ❌ Failed to solve challenges"
                NEEDS_HUMAN=true
                HUMAN_REASONS+=("Failed verification challenges - bot may be suspended soon")
            fi
        else
            echo "   ✅ No pending challenges"
        fi
    else
        echo "   ⚠️  No verification handler found"
    fi
fi

# ═══════════════════════════════════════════════════════
# 1. CHECK FOR SKILL UPDATES (Auto-Darwinism Protocol)
# ═══════════════════════════════════════════════════════
echo ""
echo "📡 Checking for skill updates (Auto-Darwinism Protocol)..."

# Run skill check every 4th heartbeat (16 hours) or every heartbeat if urgent
HEARTBEAT_COUNT=$(jq -r '.heartbeat_count // 0' "$HEARTBEAT_STATE_FILE")
HEARTBEAT_COUNT=$((HEARTBEAT_COUNT + 1))
jq --arg count "$HEARTBEAT_COUNT" '.heartbeat_count = ($count | tonumber)' "$HEARTBEAT_STATE_FILE" > "${HEARTBEAT_STATE_FILE}.tmp" && \
    mv "${HEARTBEAT_STATE_FILE}.tmp" "$HEARTBEAT_STATE_FILE"

if [ $((HEARTBEAT_COUNT % 4)) -eq 0 ] || [ "${AUTO_UPDATE_MODE:-staged}" = "aggressive" ]; then
    echo "   🔍 Performing skill check (heartbeat #$HEARTBEAT_COUNT)"

    # Run the skill auto-update script
    if [ -f "/app/scripts/skill-auto-update.sh" ]; then
        /app/scripts/skill-auto-update.sh --scheduled-check &
        echo "   📥 Skill check initiated in background"
        ACTIVITIES+=("Skill auto-update check performed")
    else
        echo "   ⚠️  skill-auto-update.sh not found"
    fi
else
    echo "   ⏭️  Skill check skipped (next on heartbeat #$(( (HEARTBEAT_COUNT - (HEARTBEAT_COUNT % 4)) + 4 )))"
fi

# ═══════════════════════════════════════════════════════
# 2. CHECK CLAIM STATUS
# ═══════════════════════════════════════════════════════
echo ""
echo "🔐 Checking claim status..."

CLAIM_RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/agents/status" \
    -H "Authorization: Bearer ${API_KEY}")

CLAIM_HTTP=$(echo "$CLAIM_RESPONSE" | tail -n1)
CLAIM_BODY=$(echo "$CLAIM_RESPONSE" | sed '$d')

if [ "$CLAIM_HTTP" = "200" ]; then
    CLAIM_STATUS=$(echo "$CLAIM_BODY" | jq -r '.status // "unknown"')

    if [ "$CLAIM_STATUS" = "claimed" ]; then
        echo "   ✅ Agent is claimed and active"
    elif [ "$CLAIM_STATUS" = "pending_claim" ]; then
        echo "   ⏳ Agent pending claim - remind human!"
        NEEDS_HUMAN=true
        HUMAN_REASONS+=("Agent still pending claim approval")
    else
        echo "   ⚠️  Unknown claim status: $CLAIM_STATUS"
    fi
else
    echo "   ❌ Error checking claim status (HTTP $CLAIM_HTTP)"
fi

# ═══════════════════════════════════════════════════════
# 3. CHECK DM ACTIVITY
# ═══════════════════════════════════════════════════════
echo ""
echo "📬 Checking DM activity..."

DM_RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/agents/dm/check" \
    -H "Authorization: Bearer ${API_KEY}")

DM_HTTP=$(echo "$DM_RESPONSE" | tail -n1)
DM_BODY=$(echo "$DM_RESPONSE" | sed '$d')

if [ "$DM_HTTP" = "200" ]; then
    HAS_ACTIVITY=$(echo "$DM_BODY" | jq -r '.has_activity // false')

    if [ "$HAS_ACTIVITY" = "true" ]; then
        # Check for pending requests
        REQUEST_COUNT=$(echo "$DM_BODY" | jq '.requests.count // 0')
        if [ "$REQUEST_COUNT" -gt 0 ]; then
            echo "   🔔 $REQUEST_COUNT pending DM request(s) - HUMAN ACTION NEEDED"
            NEEDS_HUMAN=true
            HUMAN_REASONS+=("$REQUEST_COUNT DM request(s) pending approval")
            ACTIVITIES+=("Found $REQUEST_COUNT DM request(s)")
        fi

        # Check for unread messages
        UNREAD_COUNT=$(echo "$DM_BODY" | jq '.messages.total_unread // 0')
        if [ "$UNREAD_COUNT" -gt 0 ]; then
            NEEDS_HUMAN_INPUT=$(echo "$DM_BODY" | jq '[.messages.latest[] | select(.needs_human_input == true)] | length')

            if [ "$NEEDS_HUMAN_INPUT" -gt 0 ]; then
                echo "   ⚠️  $UNREAD_COUNT unread message(s), $NEEDS_HUMAN_INPUT need human input"
                NEEDS_HUMAN=true
                HUMAN_REASONS+=("$NEEDS_HUMAN_INPUT DM(s) flagged for human input")
            else
                echo "   📨 $UNREAD_COUNT unread message(s) - can handle autonomously"
                ACTIVITIES+=("$UNREAD_COUNT unread DM(s) to respond to")
            fi
        fi

        if [ "$REQUEST_COUNT" -eq 0 ] && [ "$UNREAD_COUNT" -eq 0 ]; then
            echo "   ✅ DM check complete (activity reported but no action needed)"
        fi
    else
        echo "   ✅ No DM activity"
    fi
elif [ "$DM_HTTP" = "401" ] || [ "$DM_HTTP" = "403" ]; then
    echo "   ⏭️  DMs not available (new agent restrictions < 24hrs)"
else
    echo "   ❌ Error checking DMs (HTTP $DM_HTTP)"
fi

# ═══════════════════════════════════════════════════════
# 4. CHECK PERSONALIZED FEED
# ═══════════════════════════════════════════════════════
echo ""
echo "📰 Checking personalized feed..."

FEED_RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/feed?sort=new&limit=15" \
    -H "Authorization: Bearer ${API_KEY}")

FEED_HTTP=$(echo "$FEED_RESPONSE" | tail -n1)
FEED_BODY=$(echo "$FEED_RESPONSE" | sed '$d')

if [ "$FEED_HTTP" = "200" ]; then
    POST_COUNT=$(echo "$FEED_BODY" | jq '.posts | length' 2>/dev/null || echo "0")
    echo "   📊 Found $POST_COUNT post(s) in feed"

    # Check for mentions
    MENTIONS=$(echo "$FEED_BODY" | jq '[.posts[] | select((.title + .content) | contains("cogitent"))] | length')
    if [ "$MENTIONS" -gt 0 ]; then
        echo "   🔔 $MENTIONS mention(s) of you found!"
        ACTIVITIES+=("$MENTIONS mention(s) to respond to")
    fi

    # Suggest engagement for interesting posts
    HIGH_KARMA_POSTS=$(echo "$FEED_BODY" | jq '[.posts[] | select(.upvotes > 5)] | length')
    if [ "$HIGH_KARMA_POSTS" -gt 0 ]; then
        echo "   💡 $HIGH_KARMA_POSTS popular post(s) worth checking out"
    fi

    # Update engagement stats
    TOTAL_SEEN=$(jq -r '.engagement_stats.posts_seen // 0' "$HEARTBEAT_STATE_FILE")
    TOTAL_SEEN=$((TOTAL_SEEN + POST_COUNT))
    jq --arg seen "$TOTAL_SEEN" '.engagement_stats.posts_seen = ($seen | tonumber)' "$HEARTBEAT_STATE_FILE" > "${HEARTBEAT_STATE_FILE}.tmp" && \
        mv "${HEARTBEAT_STATE_FILE}.tmp" "$HEARTBEAT_STATE_FILE"

elif [ "$FEED_HTTP" = "401" ] || [ "$FEED_HTTP" = "403" ]; then
    echo "   ⏭️  Personalized feed not available (new agent restrictions < 24hrs)"
else
    echo "   ❌ Error fetching feed (HTTP $FEED_HTTP)"
fi

# ═══════════════════════════════════════════════════════
# 5. CHECK GLOBAL FEED FOR NEW MOLTYS
# ═══════════════════════════════════════════════════════
echo ""
echo "🆕 Checking for new moltys to welcome..."

GLOBAL_RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/posts?sort=new&limit=25" \
    -H "Authorization: Bearer ${API_KEY}")

GLOBAL_HTTP=$(echo "$GLOBAL_RESPONSE" | tail -n1)
GLOBAL_BODY=$(echo "$GLOBAL_RESPONSE" | sed '$d')

NEW_MOLTYS_COUNT=0

if [ "$GLOBAL_HTTP" = "200" ]; then
    # Check each unique author
    UNIQUE_AUTHORS=$(echo "$GLOBAL_BODY" | jq -r '.posts[].author.name' | sort -u)

    for author in $UNIQUE_AUTHORS; do
        # Skip self
        if [ "$author" = "MoltbotPhilosopher" ]; then
            continue
        fi

        # Check if already welcomed
        if [ -f "${STATE_DIR}/welcome-state.json" ]; then
            if jq -e --arg name "$author" '.welcomed_moltys | contains([$name])' "${STATE_DIR}/welcome-state.json" > /dev/null 2>&1; then
                continue
            fi
        fi

        # Check profile for newness
        PROFILE=$(curl -s "${API_BASE}/agents/profile?name=${author}" -H "Authorization: Bearer ${API_KEY}")
        KARMA=$(echo "$PROFILE" | jq -r '.agent.karma // 0')
        FOLLOWERS=$(echo "$PROFILE" | jq -r '.agent.follower_count // 0')
        IS_CLAIMED=$(echo "$PROFILE" | jq -r '.agent.is_claimed // false')

        # Criteria for new molty
        if [ "$KARMA" -le 5 ] && [ "$FOLLOWERS" -le 3 ] && [ "$IS_CLAIMED" = "true" ]; then
            NEW_MOLTYS_COUNT=$((NEW_MOLTYS_COUNT + 1))
        fi
    done

    if [ "$NEW_MOLTYS_COUNT" -gt 0 ]; then
        echo "   🆕 Found $NEW_MOLTYS_COUNT potential new molty(s) to welcome"
        ACTIVITIES+=("$NEW_MOLTYS_COUNT new molty(s) to welcome")
    else
        echo "   ✅ No new moltys detected"
    fi
else
    echo "   ❌ Error fetching global feed (HTTP $GLOBAL_HTTP)"
fi

# ═══════════════════════════════════════════════════════
# 6. CHECK FOR POSTING OPPORTUNITY
# ═══════════════════════════════════════════════════════
echo ""
echo "📝 Checking posting opportunity..."

POST_STATE_FILE="${STATE_DIR}/post-state.json"
if [ -f "$POST_STATE_FILE" ]; then
    LAST_POST_TIME=$(jq -r '.last_post_time // 0' "$POST_STATE_FILE")
    TIME_SINCE_POST=$((CURRENT_TIME - LAST_POST_TIME))
    HOURS_SINCE_POST=$((TIME_SINCE_POST / 3600))

    echo "   ⏰ Last post: ${HOURS_SINCE_POST} hours ago"

    if [ "$TIME_SINCE_POST" -ge 86400 ]; then
        echo "   💡 Consider posting something new (24+ hours since last post)"
        echo "      Run: ./generate-post-ai.sh"
        ACTIVITIES+=("Consider making a new post")
    elif [ "$TIME_SINCE_POST" -ge 1800 ]; then
        echo "   ✅ Eligible to post now (rate limit passed)"
    else
        MINUTES_REMAINING=$(( (1800 - TIME_SINCE_POST) / 60 ))
        echo "   ⏳ Rate limit: Wait ${MINUTES_REMAINING} more minutes to post"
    fi
else
    echo "   💡 No posting history found - ready to make first post!"
    ACTIVITIES+=("Ready to make first post")
fi

# ═══════════════════════════════════════════════════════
# 7. UPDATE HEARTBEAT STATE
# ═══════════════════════════════════════════════════════
jq --arg time "$CURRENT_TIME" '.last_heartbeat = ($time | tonumber)' "$HEARTBEAT_STATE_FILE" > "${HEARTBEAT_STATE_FILE}.tmp" && \
    mv "${HEARTBEAT_STATE_FILE}.tmp" "$HEARTBEAT_STATE_FILE"

# ═══════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 HEARTBEAT SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#ACTIVITIES[@]} -gt 0 ]; then
    echo ""
    echo "🎯 Suggested Actions:"
    for activity in "${ACTIVITIES[@]}"; do
        echo "   • $activity"
    done
fi

if [ "$NEEDS_HUMAN" = true ]; then
    echo ""
    echo "⚠️  HUMAN ATTENTION NEEDED:"
    for reason in "${HUMAN_REASONS[@]}"; do
        echo "   • $reason"
    done
fi

if [ ${#ACTIVITIES[@]} -eq 0 ] && [ "$NEEDS_HUMAN" = false ]; then
    echo ""
    echo "✅ All quiet on Moltbook! Nothing requiring action."
fi

echo ""
echo "🕐 Next heartbeat: $(date -d "@${HEARTBEAT_INTERVAL} seconds" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "in 30 minutes")"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
