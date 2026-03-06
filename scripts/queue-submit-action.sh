#!/bin/bash
#
# Queue Submit Action - Submit actions to the queue service
#
# ⚡ PHASE 2 INTEGRATION (P2.1-P2.4 Engagement Service Quality)
# This script submits actions to Moltbot's engagement queue (port 3008).
# Actions are processed with:
# - P2.1: 5-factor relevance scoring (recency, activity, engagement, sentiment, quality)
# - P2.2: Content quality metrics (comment depth, sentiment analysis, controversial topics)
# - P2.3: Proactive posting triggers (engagement cycle evaluation)
# - P2.4: Rate limiting (1 post/30min, daily limits enforced by queue)
#
# SERVICES:
#   - Engagement Service (proactive): http://localhost:3010 (POST /engage, GET /stats)
#   - Reactive Handler (real-time): http://localhost:3011 (instant mentions/comments)
#   - Action Queue (processor): http://localhost:3008 (job queue with circuit breaker)
#
# Usage: queue-submit-action.sh <action-type> <agent-name> [payload-json]
#
# Examples:
#   queue-submit-action.sh POST classical '{"submolt_name":"General","content":"Hello!"}'
#   queue-submit-action.sh FOLLOW classical '{"username":"0xYeks"}'
#   queue-submit-action.sh COMMENT classical '{"postId":"abc123","content":"Great!"}'
#
# MONITORING:
#   Check action status: curl http://localhost:3008/actions/{ACTION_ID}
#   View engagement stats: curl http://localhost:3010/stats | jq '.summary'
#   Quality metrics: curl http://localhost:3010/stats | jq '.quality'

set -euo pipefail

# Configuration
QUEUE_URL="${ACTION_QUEUE_URL:-http://action-queue:3008}"
# SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"  # Unused, reserved for future
LOG_FILE="${LOG_FILE:-/app/logs/queue-submit.log}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log_info() {
    echo -e "${BLUE}ℹ${NC} $1" | tee -a "${LOG_FILE}" 2>/dev/null || echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "${LOG_FILE}" 2>/dev/null || echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1" | tee -a "${LOG_FILE}" 2>/dev/null || echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1" | tee -a "${LOG_FILE}" 2>/dev/null || echo -e "${YELLOW}⚠${NC} $1"
}

# Validate inputs
if [ $# -lt 2 ]; then
    log_error "Usage: $0 <action-type> <agent-name> [payload-json] [options]"
    echo ""
    echo "Action Types: POST, COMMENT, UPVOTE, DOWNVOTE, FOLLOW, UNFOLLOW, CREATE_SUBMOLT, SEND_DM, SKILL_UPDATE"
    echo ""
    echo "Options:"
    echo "  --priority <HIGH|NORMAL|LOW>  Priority (default: NORMAL)"
    echo "  --scheduled <ISO8601>         Schedule for later"
    echo "  --conditions <json>           Add conditional logic"
    echo ""
    echo "Examples:"
    echo "  # Immediate post"
    echo "  $0 POST classical '{\"submolt\":\"General\",\"content\":\"Hello!\"}'"
    echo ""
    echo "  # Follow user (immediate)"
    echo "  $0 FOLLOW classical '{\"username\":\"0xYeks\"}'"
    echo ""
    echo "  # Scheduled post"
    echo "  $0 POST classical '{\"submolt\":\"Ponderings\",\"content\":\"...\"}'  --scheduled 2026-02-20T12:00:00Z"
    echo ""
    echo "  # Conditional follow (after account active)"
    echo "  $0 FOLLOW classical '{\"username\":\"0xYeks\"}' --conditions '{\"type\":\"ACCOUNT_ACTIVE\"}'"
    exit 1
fi

ACTION_TYPE="$1"
AGENT_NAME="$2"
PAYLOAD="${3:-\{\}}"
shift 2; [ $# -gt 0 ] && shift || true

# Convert action type to lowercase (API expects lowercase)
ACTION_TYPE=$(echo "$ACTION_TYPE" | tr '[:upper:]' '[:lower:]')

# Convert priority to number if it's a word
PRIORITY="1"  # Default to NORMAL (1)
SCHEDULED_FOR=""
CONDITIONS=""
METADATA="{}"

while [ $# -gt 0 ]; do
    case "$1" in
        --priority)
            # Convert priority to number
            case "$2" in
                HIGH|high|2)
                    PRIORITY="2"
                    ;;
                NORMAL|normal|1)
                    PRIORITY="1"
                    ;;
                LOW|low|0)
                    PRIORITY="0"
                    ;;
                CRITICAL|critical|3)
                    PRIORITY="3"
                    ;;
                *)
                    PRIORITY="$2"
                    ;;
            esac
            shift 2
            ;;
        --scheduled)
            SCHEDULED_FOR="$2"
            shift 2
            ;;
        --conditions)
            CONDITIONS="$2"
            shift 2
            ;;
        --metadata)
            METADATA="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Build request body with jq for proper JSON
# Ensure priority is numeric
PRIORITY_NUM=${PRIORITY:-1}

# Create base request
REQUEST_BODY=$(jq -n \
    --arg action_type "$ACTION_TYPE" \
    --arg agent_name "$AGENT_NAME" \
    --arg payload_str "$PAYLOAD" \
    --arg priority "$PRIORITY_NUM" \
    '{
        actionType: $action_type,
        agentName: $agent_name,
        payload: ($payload_str | fromjson),
        priority: ($priority | tonumber)
    }')

# Add optional fields
if [ -n "$SCHEDULED_FOR" ]; then
    REQUEST_BODY=$(echo "$REQUEST_BODY" | jq --arg scheduled "$SCHEDULED_FOR" '. + {scheduledFor: $scheduled}')
fi

if [ -n "$CONDITIONS" ]; then
    REQUEST_BODY=$(echo "$REQUEST_BODY" | jq --argjson conditions "$CONDITIONS" '. + {conditions: $conditions}')
fi

if [ "$METADATA" != "{}" ]; then
    REQUEST_BODY=$(echo "$REQUEST_BODY" | jq --argjson metadata "$METADATA" '. + {metadata: $metadata}')
fi

# Submit to queue
log_info "Submitting action to queue: $ACTION_TYPE by $AGENT_NAME"

RESPONSE=$(curl -s -X POST "${QUEUE_URL}/actions" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
    ACTION_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    log_success "Action queued successfully"
    echo "  Action ID: $ACTION_ID"
    echo "  Status: $STATUS"
    echo "  Check status: curl ${QUEUE_URL}/actions/${ACTION_ID}"
    exit 0
else
    log_error "Failed to submit action (HTTP $HTTP_CODE)"
    echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 || echo "$BODY"
    exit 1
fi
