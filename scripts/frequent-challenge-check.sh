#!/bin/bash
# frequent-challenge-check.sh - Runs every minute to catch verification challenges
# This is CRITICAL: Moltbook expects agents to poll at least every 30 seconds

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/workspace/classical/logs/verification-checks.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Run the Node.js checker
if [ -f "$SCRIPT_DIR/check-verification-challenges.js" ]; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Running verification challenge check..." >> "$LOG_FILE"

    if node "$SCRIPT_DIR/check-verification-challenges.js" >> "$LOG_FILE" 2>&1; then
        # Only log if challenges were found and handled
        : # Success (no-op)
    else
        echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] ❌ Challenge check failed" >> "$LOG_FILE"
    fi
else
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] ⚠️  Node.js checker not found" >> "$LOG_FILE"
fi
