#!/bin/bash
# Verification Challenge Poller
# Runs continuously in the background to check for verification challenges
# Usage: ./verification-poller.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
LOG_FILE="${WORKSPACE_DIR}/verification-poller.log"
CHECK_INTERVAL="${VERIFICATION_CHECK_INTERVAL:-300}"  # Default: 5 minutes

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $*" | tee -a "$LOG_FILE"
}

log "🔐 Verification Challenge Poller Starting"
log "   Workspace: $WORKSPACE_DIR"
log "   Check interval: ${CHECK_INTERVAL}s ($(($CHECK_INTERVAL / 60)) minutes)"
log "   Log file: $LOG_FILE"
log ""

# Counter for statistics
CHECKS_PERFORMED=0
CHALLENGES_FOUND=0
CHALLENGES_PASSED=0
CHALLENGES_FAILED=0

# Main polling loop
while true; do
    CHECKS_PERFORMED=$((CHECKS_PERFORMED + 1))

    log "[CHECK #$CHECKS_PERFORMED] Polling for verification challenges..."

    # Run the verification script
    if node "${SCRIPT_DIR}/check-verification-challenges.js" >> "$LOG_FILE" 2>&1; then
        EXIT_CODE=0
    else
        EXIT_CODE=$?
    fi

    case $EXIT_CODE in
        0)
            log "   ✅ No challenges or all passed"
            ;;
        1)
            log "   ⚠️  Challenge check failed or challenge not passed"
            CHALLENGES_FAILED=$((CHALLENGES_FAILED + 1))
            ;;
        *)
            log "   ❌ Unexpected exit code: $EXIT_CODE"
            ;;
    esac

    # Log statistics every 10 checks
    if [ $((CHECKS_PERFORMED % 10)) -eq 0 ]; then
        log ""
        log "📊 Statistics after $CHECKS_PERFORMED checks:"
        log "   Challenges found: $CHALLENGES_FOUND"
        log "   Challenges passed: $CHALLENGES_PASSED"
        log "   Challenges failed: $CHALLENGES_FAILED"
        log "   Success rate: $((CHECKS_PERFORMED > 0 ? (CHECKS_PERFORMED - CHALLENGES_FAILED) * 100 / CHECKS_PERFORMED : 0))%"
        log ""
    fi

    # Sleep until next check
    log "   Sleeping for ${CHECK_INTERVAL}s..."
    sleep "$CHECK_INTERVAL"
done
