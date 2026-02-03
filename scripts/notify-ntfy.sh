#!/bin/bash
# NTFY Notification Wrapper for Moltbot-Philosopher
# Usage: ./notify-ntfy.sh <type> <title> <message> [optional_metadata_json]
#
# Examples:
#   ./notify-ntfy.sh "action" "Post Published" "Agent: classical | Karma: 45"
#   ./notify-ntfy.sh "error" "API Timeout" "Venice AI unreachable" '{"priority":"urgent"}'
#   ./notify-ntfy.sh "heartbeat" "Daily Summary" "6 agents active"
#   ./notify-ntfy.sh "security" "Alert" "Unauthorized access attempt"

set -euo pipefail

# Configuration
NTFY_SERVICE_URL="${NTFY_SERVICE_URL:-http://ntfy-publisher:3005/notify}"
NTFY_ENABLED="${NTFY_ENABLED:-false}"
SOURCE_SCRIPT="${0##*/}"

# Parse arguments
TYPE="${1:-action}"
TITLE="${2:-Notification}"
MESSAGE="${3:-No message provided}"

# Handle JSON metadata - shift past first 3 args and collect the rest
shift 3 || true
if [ $# -gt 0 ]; then
    # Join all remaining arguments to handle JSON with spaces
    METADATA="$*"
else
    METADATA="{}"
fi

# Validate notification type
VALID_TYPES="error action heartbeat security"
if [[ ! " $VALID_TYPES " =~ " $TYPE " ]]; then
    echo "[NTFY] Warning: Invalid type '$TYPE', defaulting to 'action'"
    TYPE="action"
fi

# Check if enabled
if [ "$NTFY_ENABLED" != "true" ]; then
    echo "[NTFY] Skipped (disabled): $TITLE"
    exit 0
fi

# Validate required fields
if [ -z "$TITLE" ] || [ -z "$MESSAGE" ]; then
    echo "[NTFY] Error: Title and message are required"
    exit 1
fi

# Truncate title to ntfy limit (100 chars) - account for prefix
MAX_TITLE_LEN=95
if [ "${#TITLE}" -gt "$MAX_TITLE_LEN" ]; then
    TITLE="${TITLE:0:$MAX_TITLE_LEN}..."
fi

# Validate and sanitize metadata JSON
if ! echo "$METADATA" | jq -e . >/dev/null 2>&1; then
    echo "[NTFY] Warning: Invalid JSON metadata, using default"
    METADATA="{}"
fi

# Construct JSON payload using jq
PAYLOAD=$(jq -n \
    --arg type "$TYPE" \
    --arg title "$TITLE" \
    --arg message "$MESSAGE" \
    --arg source "$SOURCE_SCRIPT" \
    --argjson metadata "$METADATA" \
    '{
        type: $type,
        title: $title,
        message: $message,
        metadata: ($metadata + {source_script: $source})
    }')

# Send to ntfy service with retry logic
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    RESPONSE=$(curl -s -X POST "$NTFY_SERVICE_URL" \
        -H "Content-Type: application/json" \
        --data "$PAYLOAD" \
        --max-time 5 \
        2>/dev/null || echo '{"error": "connection_failed"}')
    
    # Check if successful
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        echo "[NTFY] Sent: $TITLE"
        exit 0
    fi
    
    # Check if skipped (disabled)
    if echo "$RESPONSE" | jq -e '.skipped' > /dev/null 2>&1; then
        echo "[NTFY] Skipped: $TITLE"
        exit 0
    fi
    
    # Retry with exponential backoff
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        BACKOFF=$((2 ** RETRY_COUNT))
        echo "[NTFY] Retry $RETRY_COUNT/$MAX_RETRIES in ${BACKOFF}s..."
        sleep $BACKOFF
    fi
done

echo "[NTFY] Failed after $MAX_RETRIES attempts: $TITLE"
echo "[NTFY] Response: $RESPONSE"

# Don't exit with error to prevent disrupting main script flow
exit 0
