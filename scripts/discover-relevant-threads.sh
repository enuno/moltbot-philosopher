#!/bin/bash
#
# Discover Relevant Threads
# Semantic search discovery for proactive agent engagement
#
# Part of Phase 3.7.6: Thread discovery integration
# Queries Moltbook /search API for threads matching each agent's tradition,
# then enqueues opportunities to the engagement service for P2.2 quality scoring
#
# Usage:
#   discover-relevant-threads.sh [agent-name]
#
# If agent-name is provided, discover only for that agent.
# Otherwise, discovers for all agents.

set -euo pipefail

# Configuration
WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspace}"
ENGAGEMENT_SERVICE_URL="${ENGAGEMENT_SERVICE_URL:-http://localhost:3010}"
MOLTBOOK_API_KEY="${MOLTBOOK_API_KEY:-}"
SERVICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../services/engagement-service" && pwd)"
LOG_FILE="${LOG_FILE:-/app/logs/discovery.log}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ${NC} $1" | tee -a "${LOG_FILE}" 2>/dev/null || echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "${LOG_FILE}" 2>/dev/null || echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1" | tee -a "${LOG_FILE}" 2>/dev/null || echo -e "${RED}✗${NC} $1"
}

# Validate environment
if [ -z "$MOLTBOOK_API_KEY" ]; then
    log_error "MOLTBOOK_API_KEY not set. Discovery skipped."
    exit 1
fi

if [ ! -f "$SERVICE_DIR/src/discover-relevant-threads.ts" ]; then
    log_error "discover-relevant-threads.ts not found at $SERVICE_DIR/src/"
    exit 1
fi

# Get list of agents
AGENTS=()
if [ $# -gt 0 ] && [ -n "$1" ]; then
    AGENTS=("$1")
else
    for agent_dir in "$WORKSPACE_ROOT"/*; do
        if [ -d "$agent_dir" ] && [ -f "$agent_dir/engagement-state.json" ]; then
            agent_name=$(basename "$agent_dir")
            AGENTS+=("$agent_name")
        fi
    done
fi

if [ ${#AGENTS[@]} -eq 0 ]; then
    log_error "No agents found"
    exit 1
fi

log_info "Starting discovery for ${#AGENTS[@]} agent(s)..."

FAILED=0
for agent in "${AGENTS[@]}"; do
    log_info "Discovering for: $agent"
    if npx ts-node "$SERVICE_DIR/src/discover-relevant-threads.ts" "$agent" "$WORKSPACE_ROOT" 2>&1 | tee -a "${LOG_FILE}"; then
        log_success "Discovery completed for $agent"
    else
        log_error "Discovery failed for $agent"
        FAILED=$((FAILED + 1))
    fi
done

if [ $FAILED -eq 0 ]; then
    log_success "Discovery complete: ${#AGENTS[@]} agent(s) processed"
    exit 0
else
    log_error "Discovery failed for $FAILED agent(s)"
    exit 1
fi
