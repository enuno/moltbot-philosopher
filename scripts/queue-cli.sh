#!/bin/bash
#
# Queue CLI - Manage the action queue service
#
# Usage: queue-cli.sh <command> [options]

set -euo pipefail

# Configuration
QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3008}"

# Colors
RED='\033[0;31m'
# GREEN='\033[0;32m'  # Unused, reserved for future
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
# CYAN='\033[0;36m'  # Unused, reserved for future
NC='\033[0m' # No Color

# Pretty print JSON
pretty_json() {
    if command -v jq &> /dev/null; then
        echo "$1" | jq '.'
    else
        echo "$1"
    fi
}

# Commands
cmd_health() {
    echo -e "${BLUE}Checking queue service health...${NC}"
    RESPONSE=$(curl -s "${QUEUE_URL}/queue/health")
    pretty_json "$RESPONSE"
}

cmd_stats() {
    echo -e "${BLUE}Fetching queue statistics...${NC}"
    RESPONSE=$(curl -s "${QUEUE_URL}/queue/stats")
    pretty_json "$RESPONSE"
}

cmd_list() {
    local STATUS="${1:-}"
    local LIMIT="${2:-100}"

    echo -e "${BLUE}Listing actions...${NC}"
    URL="${QUEUE_URL}/actions?limit=${LIMIT}"
    if [ -n "$STATUS" ]; then
        URL="${URL}&status=${STATUS}"
    fi

    RESPONSE=$(curl -s "$URL")
    pretty_json "$RESPONSE"
}

cmd_get() {
    local ACTION_ID="$1"
    echo -e "${BLUE}Fetching action $ACTION_ID...${NC}"
    RESPONSE=$(curl -s "${QUEUE_URL}/actions/${ACTION_ID}")
    pretty_json "$RESPONSE"
}

cmd_cancel() {
    local ACTION_ID="$1"
    echo -e "${YELLOW}Cancelling action $ACTION_ID...${NC}"
    RESPONSE=$(curl -s -X DELETE "${QUEUE_URL}/actions/${ACTION_ID}")
    pretty_json "$RESPONSE"
}

cmd_rate_limits() {
    local AGENT_NAME="$1"
    echo -e "${BLUE}Fetching rate limits for $AGENT_NAME...${NC}"
    RESPONSE=$(curl -s "${QUEUE_URL}/rate-limits/${AGENT_NAME}")
    pretty_json "$RESPONSE"
}

cmd_process() {
    echo -e "${YELLOW}Manually triggering queue processing...${NC}"
    RESPONSE=$(curl -s -X POST "${QUEUE_URL}/queue/process")
    pretty_json "$RESPONSE"
}

cmd_check_conditions() {
    echo -e "${YELLOW}Manually triggering condition check...${NC}"
    RESPONSE=$(curl -s -X POST "${QUEUE_URL}/queue/check-conditions")
    pretty_json "$RESPONSE"
}

cmd_help() {
    cat <<'EOF'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Moltbot Action Queue CLI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMANDS:

  health                    Check service health
  stats                     Show queue statistics
  list [status] [limit]     List actions (default: all, limit 100)
  get <action-id>           Get action details by ID
  cancel <action-id>        Cancel pending action
  rate-limits <agent>       Show rate limit status for agent
  process                   Manually trigger queue processing (testing)
  check-conditions          Manually trigger condition checks (testing)
  help                      Show this help message

EXAMPLES:

  # Check service health
  queue-cli.sh health

  # View statistics
  queue-cli.sh stats

  # List pending actions
  queue-cli.sh list PENDING

  # List scheduled actions
  queue-cli.sh list SCHEDULED

  # Get specific action
  queue-cli.sh get abc-123-def

  # Cancel action
  queue-cli.sh cancel abc-123-def

  # Check rate limits for classical agent
  queue-cli.sh rate-limits classical

  # Trigger manual processing (testing)
  queue-cli.sh process

STATUSES:

  PENDING          Ready to process
  SCHEDULED        Waiting for conditions/time
  PROCESSING       Currently executing
  COMPLETED        Successfully executed
  FAILED           Failed after max attempts
  CANCELLED        Cancelled by user
  RATE_LIMITED     Waiting for rate limit window

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

# Main
if [ $# -eq 0 ]; then
    cmd_help
    exit 0
fi

COMMAND="$1"
shift

case "$COMMAND" in
    health)
        cmd_health
        ;;
    stats)
        cmd_stats
        ;;
    list)
        cmd_list "$@"
        ;;
    get)
        if [ $# -eq 0 ]; then
            echo -e "${RED}Error: action-id required${NC}"
            exit 1
        fi
        cmd_get "$1"
        ;;
    cancel)
        if [ $# -eq 0 ]; then
            echo -e "${RED}Error: action-id required${NC}"
            exit 1
        fi
        cmd_cancel "$1"
        ;;
    rate-limits)
        if [ $# -eq 0 ]; then
            echo -e "${RED}Error: agent-name required${NC}"
            exit 1
        fi
        cmd_rate_limits "$1"
        ;;
    process)
        cmd_process
        ;;
    check-conditions)
        cmd_check_conditions
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        echo ""
        cmd_help
        exit 1
        ;;
esac
