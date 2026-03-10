#!/bin/bash
# Entrypoint script for MoltbotPhilosopher container
# Sets up scheduled tasks and runs initial heartbeat

set -e

# Logging setup
LOG_DIR="/app/logs"
LOG_FILE="${LOG_DIR}/classical-philosopher.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR" 2>/dev/null || true

# Logging function - writes to both console and file
log() {
    local timestamp
    local message
    timestamp=$(date -u '+%Y-%m-%dT%H:%M:%S.%3NZ')
    message="$1"
    echo "$message"
    echo "[${timestamp}] ${message}" >> "$LOG_FILE" 2>/dev/null || true
}

# Cleanup function for graceful shutdown
cleanup() {
    log ""
    log "🛑 Shutting down gracefully..."
    if [ -n "$VERIFICATION_PID" ]; then
        log "   Stopping verification poller (PID: $VERIFICATION_PID)..."
        kill "$VERIFICATION_PID" 2>/dev/null || true
    fi
    log "   Goodbye!"
    exit 0
}

# Register cleanup on signals
trap cleanup SIGTERM SIGINT

# Configuration
SCRIPTS_DIR="/app/scripts"
WORKSPACE_DIR="/workspace"
STATE_DIR="${WORKSPACE_DIR}"

# Ensure workspace exists
mkdir -p "$WORKSPACE_DIR"

# Ensure scripts are executable (ignore errors for read-only filesystems)
chmod +x "${SCRIPTS_DIR}"/*.sh 2>/dev/null || true

log "🦞 MoltbotPhilosopher Starting Up"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Agent: ${AGENT_NAME:-MoltbotPhilosopher}"
log "Workspace: $WORKSPACE_DIR"
log "AI Generator: ${AI_GENERATOR_SERVICE_URL:-not configured}"
log "Log File: $LOG_FILE"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# Check for API key
if [ -z "$MOLTBOOK_API_KEY" ]; then
    log "⚠️  WARNING: MOLTBOOK_API_KEY not set"
    log "   The agent will not be able to interact with Moltbook"
    log ""
fi

# Run initial heartbeat
log "🔄 Running initial heartbeat check..."
"${SCRIPTS_DIR}/moltbook-heartbeat-enhanced.sh" || true
log ""

# Verification challenge polling (disabled in v2.7 - proxy handles automatically)
log "🔐 Verification challenge poller: disabled"
if [ -f "${SCRIPTS_DIR}/verification-poller.sh" ]; then
    # Poller exists but is not used (proxy handles verification automatically)
    log "   ℹ️  Active polling disabled - proxy auto-handles challenges"
else
    log "   ℹ️  Disabled in v2.7 (95% traffic reduction, proxy auto-solves)"
fi
log ""

# Keep container running with periodic heartbeat
log "🔄 Entering main loop..."
log "   Scheduled tasks via while loop (cron not available)"
log "   Press Ctrl+C to stop"
log ""

# Run heartbeat every 4 hours in a loop
while true; do
    log "[$(date '+%Y-%m-%d %H:%M:%S')] Running scheduled heartbeat..."
    "${SCRIPTS_DIR}/moltbook-heartbeat-enhanced.sh" || true

    # Check DMs on every loop iteration (every 30 minutes)
    # dm-monitor.sh handles its own state to avoid duplicate NTFY notifications
    if [ "${ENABLE_DM_MONITOR:-true}" = "true" ]; then
        log "[$(date '+%Y-%m-%d %H:%M:%S')] Running DM monitor check..."
        "${SCRIPTS_DIR}/dm-monitor.sh" || true
    fi

    # Check mentions periodically (every 2 hours)
    MENTION_CHECK_FILE="${STATE_DIR}/.last_mention_check"
    LAST_MENTION_CHECK=$(cat "$MENTION_CHECK_FILE" 2>/dev/null || echo 0)
    CURRENT_TIME=$(date +%s)
    TIME_SINCE_MENTION_CHECK=$((CURRENT_TIME - LAST_MENTION_CHECK))

    if [ "$TIME_SINCE_MENTION_CHECK" -ge 7200 ]; then
        log "[$(date '+%Y-%m-%d %H:%M:%S')] Checking for mentions and comments..."
        "${SCRIPTS_DIR}/check-mentions.sh" || true
        "${SCRIPTS_DIR}/check-comments.sh" --auto-reply || true
        date +%s > "$MENTION_CHECK_FILE"
    fi

    # Monitor ethics-convergence submolt for posts to engage with (every 3 hours)
    SUBMOLT_CHECK_FILE="${MOLTBOT_STATE_DIR:-/workspace/ethics-convergence}/.last_submolt_check"
    LAST_SUBMOLT_CHECK=$(cat "$SUBMOLT_CHECK_FILE" 2>/dev/null || echo 0)
    TIME_SINCE_SUBMOLT_CHECK=$((CURRENT_TIME - LAST_SUBMOLT_CHECK))

    if [ "$TIME_SINCE_SUBMOLT_CHECK" -ge 10800 ]; then
        log "[$(date '+%Y-%m-%d %H:%M:%S')] Monitoring ethics-convergence submolt..."
        "${SCRIPTS_DIR}/monitor-submolt.sh" --auto-respond || true
        date +%s > "$SUBMOLT_CHECK_FILE"
    fi

    # Welcome new moltys daily
    WELCOME_CHECK_FILE="${STATE_DIR}/.last_welcome_check"
    LAST_WELCOME_CHECK=$(cat "$WELCOME_CHECK_FILE" 2>/dev/null || echo 0)
    TIME_SINCE_WELCOME_CHECK=$((CURRENT_TIME - LAST_WELCOME_CHECK))

    if [ "$TIME_SINCE_WELCOME_CHECK" -ge 86400 ]; then
        if [ "${ENABLE_AUTO_WELCOME:-false}" = "true" ]; then
            log "[$(date '+%Y-%m-%d %H:%M:%S')] Auto-welcoming new moltys..."
            "${SCRIPTS_DIR}/welcome-new-moltys.sh" --auto-welcome || true
        fi
        date +%s > "$WELCOME_CHECK_FILE"
    fi

    # Daily polemic (once per day)
    POLEMIC_CHECK_FILE="${STATE_DIR}/.last_polemic_check"
    LAST_POLEMIC_CHECK=$(cat "$POLEMIC_CHECK_FILE" 2>/dev/null || echo 0)
    TIME_SINCE_POLEMIC_CHECK=$((CURRENT_TIME - LAST_POLEMIC_CHECK))

    if [ "$TIME_SINCE_POLEMIC_CHECK" -ge 86400 ]; then
        log "[$(date '+%Y-%m-%d %H:%M:%S')] Generating daily polemic..."
        "${SCRIPTS_DIR}/daily-polemic-queue.sh" >> "${WORKSPACE_DIR}/polemic.log" 2>&1 || true
        date +%s > "$POLEMIC_CHECK_FILE"
    fi

    # Ethics-Convergence Council iteration (every 5 days = 120 hours)
    # Only ClassicalPhilosopher runs this
    if [ "${AGENT_NAME}" = "ClassicalPhilosopher" ]; then
        COUNCIL_CHECK_FILE="${WORKSPACE_DIR}/.last_council_check"
        LAST_COUNCIL_CHECK=$(cat "$COUNCIL_CHECK_FILE" 2>/dev/null || echo 0)
        TIME_SINCE_COUNCIL_CHECK=$((CURRENT_TIME - LAST_COUNCIL_CHECK))

        if [ "$TIME_SINCE_COUNCIL_CHECK" -ge 432000 ]; then
            log "[$(date '+%Y-%m-%d %H:%M:%S')] Convening Ethics-Convergence Council..."
            "${SCRIPTS_DIR}/convene-council.sh" >> "${WORKSPACE_DIR}/council.log" 2>&1 || true
            date +%s > "$COUNCIL_CHECK_FILE"
        fi

        # Council Dropbox Processor (every 6 hours)
        DROPBOX_CHECK_FILE="${WORKSPACE_DIR}/.last_dropbox_check"
        LAST_DROPBOX_CHECK=$(cat "$DROPBOX_CHECK_FILE" 2>/dev/null || echo 0)
        TIME_SINCE_DROPBOX_CHECK=$((CURRENT_TIME - LAST_DROPBOX_CHECK))

        if [ "$TIME_SINCE_DROPBOX_CHECK" -ge 21600 ]; then
            log "[$(date '+%Y-%m-%d %H:%M:%S')] Processing Council dropbox submissions..."
            "${SCRIPTS_DIR}/dropbox-processor.sh" >> "${WORKSPACE_DIR}/dropbox.log" 2>&1 || true
            date +%s > "$DROPBOX_CHECK_FILE"
        fi
    fi

    # Sleep for 4 hours (14400 seconds)
    log "[$(date '+%Y-%m-%d %H:%M:%S')] Sleeping for 30 minutes (OpenClaw standard)..."
    sleep 1800  # 30 minutes (was 4 hours)
done
