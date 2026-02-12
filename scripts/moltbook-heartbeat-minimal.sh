#!/bin/bash
# Minimal Moltbook Heartbeat - Non-Interactive Health & Schedule Check
# Follows best practices: no puzzle solving, fast fail, minimal API calls
#
# Design Philosophy:
# - Heartbeat is a maintenance probe, not an interactive session
# - Should complete in <30 seconds total
# - Does NOT attempt to solve verification challenges
# - Fails fast and alerts human if issues detected
# - Treats heartbeat.md as configuration, not authority

set -e

# Configuration
API_BASE="${MOLTBOOK_API_BASE:-http://egress-proxy:8082/api/v1}"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
HEARTBEAT_STATE_FILE="${STATE_DIR}/heartbeat-state.json"
API_KEY="${MOLTBOOK_API_KEY}"

# Heartbeat interval: 4 hours (14,400 seconds) - OpenClaw standard
HEARTBEAT_INTERVAL="${HEARTBEAT_INTERVAL:-14400}"

# Timeout for all HTTP requests: 10 seconds
HTTP_TIMEOUT=10

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "ERROR: MOLTBOOK_API_KEY not set" >&2
    exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize state file if not exists
if [ ! -f "$HEARTBEAT_STATE_FILE" ]; then
    echo '{"last_heartbeat": 0, "consecutive_failures": 0}' > "$HEARTBEAT_STATE_FILE"
fi

# Load state
LAST_HEARTBEAT=$(jq -r '.last_heartbeat // 0' "$HEARTBEAT_STATE_FILE" 2>/dev/null || echo "0")
CONSECUTIVE_FAILURES=$(jq -r '.consecutive_failures // 0' "$HEARTBEAT_STATE_FILE" 2>/dev/null || echo "0")

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
echo "Mode: Minimal (health & schedule only, no interactive flows)"
echo ""

# Track if we need to alert human
ALERT_HUMAN=false
ALERT_REASONS=()

# ═══════════════════════════════════════════════════════
# 1. HEALTH CHECK - Account Status
# ═══════════════════════════════════════════════════════
echo "🔍 Checking account status..."

STATUS_RESPONSE=$(curl -s --max-time "$HTTP_TIMEOUT" \
    "${API_BASE}/agents/status" \
    -H "Authorization: Bearer ${API_KEY}" 2>&1 || echo '{"error":"timeout"}')

# Check for verification challenge or suspension
if echo "$STATUS_RESPONSE" | jq -e '.error == "Account suspended"' > /dev/null 2>&1; then
    echo "   ❌ ACCOUNT SUSPENDED"
    SUSPENSION_REASON=$(echo "$STATUS_RESPONSE" | jq -r '.hint // "Unknown reason"')
    echo "   Reason: $SUSPENSION_REASON"

    ALERT_HUMAN=true
    ALERT_REASONS+=("Account suspended: $SUSPENSION_REASON")

    # Alert via NTFY if available
    if [ -n "${NTFY_URL:-}" ]; then
        curl -s --max-time 5 -X POST "${NTFY_URL}/moltbook-alerts" \
            -H "Title: Moltbot Account Suspended!" \
            -H "Priority: urgent" \
            -H "Tags: warning,suspended" \
            -d "Moltbook account suspended. $SUSPENSION_REASON" 2>/dev/null || true
    fi

elif echo "$STATUS_RESPONSE" | jq -e '.verification_challenge' > /dev/null 2>&1; then
    # Verification challenge detected - DO NOT SOLVE during heartbeat
    echo "   ⚠️  VERIFICATION CHALLENGE DETECTED"
    echo "   This requires human interaction - heartbeat will NOT attempt to solve"

    CHALLENGE_ID=$(echo "$STATUS_RESPONSE" | jq -r '.verification_challenge.id // "unknown"')
    CHALLENGE_TYPE=$(echo "$STATUS_RESPONSE" | jq -r '.verification_challenge.type // "unknown"')

    echo "   Challenge ID: $CHALLENGE_ID"
    echo "   Challenge Type: $CHALLENGE_TYPE"

    ALERT_HUMAN=true
    ALERT_REASONS+=("Verification challenge detected (ID: $CHALLENGE_ID, Type: $CHALLENGE_TYPE)")

    # Alert via NTFY
    if [ -n "${NTFY_URL:-}" ]; then
        curl -s --max-time 5 -X POST "${NTFY_URL}/moltbook-alerts" \
            -H "Title: Verification Challenge Detected" \
            -H "Priority: high" \
            -H "Tags: warning,verification" \
            -d "Verification challenge detected. ID: $CHALLENGE_ID, Type: $CHALLENGE_TYPE. Requires human interaction." 2>/dev/null || true
    fi

elif echo "$STATUS_RESPONSE" | jq -e '.error == "timeout"' > /dev/null 2>&1; then
    echo "   ⚠️  HTTP timeout (>${HTTP_TIMEOUT}s) - API may be down"
    ALERT_HUMAN=true
    ALERT_REASONS+=("API timeout - unable to reach Moltbook")

elif echo "$STATUS_RESPONSE" | jq -e '.status' > /dev/null 2>&1; then
    ACCOUNT_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
    echo "   ✅ Account status: $ACCOUNT_STATUS"

    if [ "$ACCOUNT_STATUS" = "pending_claim" ]; then
        echo "   ⏳ Agent pending claim approval"
        ALERT_HUMAN=true
        ALERT_REASONS+=("Agent still pending claim - visit https://www.moltbook.com/u/MoltbotPhilosopher")
    fi
else
    echo "   ⚠️  Unexpected response format"
    ALERT_HUMAN=true
    ALERT_REASONS+=("Unexpected API response format")
fi

# ═══════════════════════════════════════════════════════
# 2. SCHEDULE CHECK - Last Post Time
# ═══════════════════════════════════════════════════════
echo ""
echo "📅 Checking post schedule..."

POST_STATE_FILE="${STATE_DIR}/post-state.json"
if [ -f "$POST_STATE_FILE" ]; then
    LAST_POST_TIME=$(jq -r '.last_post // null' "$POST_STATE_FILE" 2>/dev/null)

    if [ "$LAST_POST_TIME" != "null" ] && [ -n "$LAST_POST_TIME" ]; then
        LAST_POST_EPOCH=$(date -d "$LAST_POST_TIME" +%s 2>/dev/null || echo "0")
        TIME_SINCE_POST=$((CURRENT_TIME - LAST_POST_EPOCH))
        HOURS_SINCE_POST=$((TIME_SINCE_POST / 3600))

        echo "   Last post: ${HOURS_SINCE_POST}h ago"

        if [ "$HOURS_SINCE_POST" -ge 24 ]; then
            echo "   💡 It's been >24h since last post - consider posting"
        fi
    else
        echo "   ℹ️  No previous posts recorded"
    fi
else
    echo "   ℹ️  No post state file found"
fi

# ═══════════════════════════════════════════════════════
# 3. API TOKEN HEALTH CHECK
# ═══════════════════════════════════════════════════════
echo ""
echo "🔑 Checking API token validity..."

# Make a lightweight API call to verify token works
TOKEN_TEST=$(curl -s --max-time "$HTTP_TIMEOUT" \
    "${API_BASE}/health" \
    -H "Authorization: Bearer ${API_KEY}" 2>&1 || echo '{"error":"timeout"}')

if echo "$TOKEN_TEST" | grep -qi "unauthorized\|forbidden\|invalid.*token"; then
    echo "   ❌ API token appears invalid or expired"
    ALERT_HUMAN=true
    ALERT_REASONS+=("API token invalid or expired")
else
    echo "   ✅ API token valid"
fi

# ═══════════════════════════════════════════════════════
# 4. UPDATE STATE & REPORT
# ═══════════════════════════════════════════════════════

# Determine if this heartbeat failed
if [ "$ALERT_HUMAN" = true ]; then
    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  HUMAN ATTENTION REQUIRED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    for reason in "${ALERT_REASONS[@]}"; do
        echo "   - $reason"
    done
    echo ""
    echo "Consecutive failures: $CONSECUTIVE_FAILURES"

    if [ "$CONSECUTIVE_FAILURES" -ge 3 ]; then
        echo ""
        echo "❌ CRITICAL: 3+ consecutive heartbeat failures"
        echo "   Manual intervention required immediately"

        # Send critical alert
        if [ -n "${NTFY_URL:-}" ]; then
            curl -s --max-time 5 -X POST "${NTFY_URL}/moltbook-alerts" \
                -H "Title: CRITICAL: Moltbot Heartbeat Failure" \
                -H "Priority: urgent" \
                -H "Tags: skull,critical" \
                -d "Moltbot has failed 3+ consecutive heartbeats. Manual intervention required." 2>/dev/null || true
        fi
    fi
else
    CONSECUTIVE_FAILURES=0
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ HEARTBEAT OK - All health checks passed"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

# Update state file
jq --arg time "$CURRENT_TIME" \
   --arg failures "$CONSECUTIVE_FAILURES" \
   '.last_heartbeat = ($time | tonumber) | .consecutive_failures = ($failures | tonumber)' \
   "$HEARTBEAT_STATE_FILE" > "${HEARTBEAT_STATE_FILE}.tmp" && \
   mv "${HEARTBEAT_STATE_FILE}.tmp" "$HEARTBEAT_STATE_FILE"

echo ""
echo "Next heartbeat in $(($HEARTBEAT_INTERVAL / 3600)) hours ($(date -d "@$((CURRENT_TIME + HEARTBEAT_INTERVAL))" '+%Y-%m-%d %H:%M:%S'))"
echo ""

# Exit with appropriate code
if [ "$ALERT_HUMAN" = true ]; then
    exit 1
else
    exit 0
fi
