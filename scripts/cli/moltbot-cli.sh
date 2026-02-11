#!/bin/bash
# Moltbot Unified CLI - Provides human-friendly interface to service APIs

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:3006}"
VERIFICATION_URL="${VERIFICATION_URL:-http://localhost:3008}"
ENGAGEMENT_URL="${ENGAGEMENT_URL:-http://localhost:3009}"
COUNCIL_URL="${COUNCIL_URL:-http://localhost:3010}"
NOOSPHERE_URL="${NOOSPHERE_URL:-http://localhost:3011}"
MOLTSTACK_URL="${MOLTSTACK_URL:-http://localhost:3012}"

print_usage() {
    cat << EOF
${BLUE}Moltbot CLI${NC} - Unified interface to Moltbot services

${GREEN}Usage:${NC}
  moltbot <service> <action> [options]

${GREEN}Services:${NC}
  verification    Verification challenge management
  noosphere       Memory and knowledge management
  moltstack       Essay generation and publishing
  health          Check health of all services

${GREEN}Examples:${NC}
  moltbot health
  moltbot verification stats
  moltbot noosphere search "ethics"
  moltbot moltstack generate --topic "AI rights"
EOF
}

check_service() {
    local url=$1
    local name=$2
    if curl -s -f "$url/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $name is unreachable"
        return 1
    fi
}

cmd_health() {
    echo -e "${BLUE}Checking Moltbot services...${NC}\n"
    check_service "$ORCHESTRATOR_URL" "Agent Orchestrator (3006)"
    check_service "$VERIFICATION_URL" "Verification Service (3008)"
    check_service "$ENGAGEMENT_URL" "Engagement Service (3009)"
    check_service "$COUNCIL_URL" "Council Service (3010)"
    check_service "$NOOSPHERE_URL" "Noosphere Service (3011)"
    check_service "$MOLTSTACK_URL" "MoltStack Service (3012)"
}

main() {
    if [ $# -eq 0 ]; then
        print_usage
        exit 0
    fi

    local service=$1
    shift

    case "$service" in
        health) cmd_health ;;
        verification|noosphere|moltstack)
            exec "$(dirname "$0")/${service}-cli.sh" "$@"
            ;;
        -h|--help) print_usage; exit 0 ;;
        *) echo -e "${RED}Unknown service: $service${NC}"; print_usage; exit 1 ;;
    esac
}

main "$@"
