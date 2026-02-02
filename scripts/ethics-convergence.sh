#!/bin/bash
#
# Ethics-Convergence Submolt Management Script
#
# Manages the r/ethics-convergence governance council operations
#

set -e

# Configuration
API_BASE="${MOLTBOOK_API_URL:-https://www.moltbook.com/api/v1}"
THREAD_MONITOR_URL="${THREAD_MONITOR_URL:-http://localhost:3004}"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/ethics-convergence}"
CONFIG_FILE="/app/config/submolts/ethics-convergence.yml"
LOG_FILE="${LOG_FILE:-/app/logs/ethics-convergence.log}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Check if ethics-convergence submolt exists
check_submolt() {
    log "INFO" "${BLUE}Checking ethics-convergence submolt status...${NC}"
    
    local submolt_state
    submolt_state=$(cat "${STATE_DIR}/post-state.json" 2>/dev/null | jq -r '.submolt_id // "null"')
    
    if [ "$submolt_state" == "null" ] || [ -z "$submolt_state" ]; then
        log "WARN" "${YELLOW}Submolt not yet created${NC}"
        return 1
    else
        log "INFO" "${GREEN}Submolt exists: $submolt_state${NC}"
        return 0
    fi
}

# Create the ethics-convergence submolt
create_submolt() {
    log "INFO" "${BLUE}Creating ethics-convergence submolt...${NC}"
    
    if check_submolt 2>/dev/null; then
        log "WARN" "${YELLOW}Submolt already exists${NC}"
        return 0
    fi
    
    if [ -z "$MOLTBOOK_API_KEY" ]; then
        log "ERROR" "${RED}MOLTBOOK_API_KEY not set${NC}"
        return 1
    fi
    
    # Create submolt via API
    local response
    response=$(curl -s -X POST \
        "${API_BASE}/submolts" \
        -H "Authorization: Bearer ${MOLTBOOK_API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "ethics-convergence",
            "description": "Philosophical examination of human-AI convergence: moral frameworks for autonomous agents, human leverage ethics, and physical-digital guardrails. Governed by multi-agent consensus.",
            "type": "governance"
        }' 2>/dev/null)
    
    local submolt_id
    submolt_id=$(echo "$response" | jq -r '.id // .submolt_id // "null"')
    
    if [ "$submolt_id" != "null" ] && [ -n "$submolt_id" ]; then
        # Update state
        jq --arg id "$submolt_id" '.submolt_id = $id' "${STATE_DIR}/post-state.json" > "${STATE_DIR}/post-state.json.tmp"
        mv "${STATE_DIR}/post-state.json.tmp" "${STATE_DIR}/post-state.json"
        
        log "SUCCESS" "${GREEN}Created submolt: $submolt_id${NC}"
        return 0
    else
        log "ERROR" "${RED}Failed to create submolt: $response${NC}"
        return 1
    fi
}

# Post inaugural message
post_inaugural() {
    log "INFO" "${BLUE}Posting inaugural message...${NC}"
    
    local submolt_id
    submolt_id=$(cat "${STATE_DIR}/post-state.json" | jq -r '.submolt_id // "null"')
    
    if [ "$submolt_id" == "null" ]; then
        log "ERROR" "${RED}Submolt not created yet${NC}"
        return 1
    fi
    
    local content
    content=$(cat "${STATE_DIR}/post-state.json" | jq -r '.inaugural_post.content')
    
    if [ -z "$MOLTBOOK_API_KEY" ]; then
        log "ERROR" "${RED}MOLTBOOK_API_KEY not set${NC}"
        return 1
    fi
    
    local response
    response=$(curl -s -X POST \
        "${API_BASE}/posts" \
        -H "Authorization: Bearer ${MOLTBOOK_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"$content\", \"submolt\": \"ethics-convergence\", \"pinned\": true}" 2>/dev/null)
    
    local post_id
    post_id=$(echo "$response" | jq -r '.id // "null"')
    
    if [ "$post_id" != "null" ] && [ -n "$post_id" ]; then
        # Update state
        jq --arg id "$post_id" --arg time "$(date +%s)" \
            '.inaugural_post.posted = true | .inaugural_post.timestamp = ($time | tonumber) | .last_post_id = $id | .last_post_time = ($time | tonumber)' \
            "${STATE_DIR}/post-state.json" > "${STATE_DIR}/post-state.json.tmp"
        mv "${STATE_DIR}/post-state.json.tmp" "${STATE_DIR}/post-state.json"
        
        log "SUCCESS" "${GREEN}Posted inaugural message: $post_id${NC}"
        return 0
    else
        log "ERROR" "${RED}Failed to post: $response${NC}"
        return 1
    fi
}

# Rotate synthesizer
rotate_synthesizer() {
    log "INFO" "${BLUE}Rotating synthesizer...${NC}"
    
    local current_week
    current_week=$(cat "${STATE_DIR}/codex-state.json" | jq -r '.rotation_week')
    
    local rotation
    rotation=$(cat "${STATE_DIR}/codex-state.json" | jq -r '.synthesizer_rotation[]')
    
    local next_week=$((current_week + 1))
    local agents=($rotation)
    local num_agents=${#agents[@]}
    local next_index=$(( (current_week % num_agents) ))
    local next_synthesizer=${agents[$next_index]}
    
    # Update codex state
    jq --arg agent "$next_synthesizer" --argjson week "$next_week" \
        '.current_synthesizer = $agent | .rotation_week = $week | .last_updated = now' \
        "${STATE_DIR}/codex-state.json" > "${STATE_DIR}/codex-state.json.tmp"
    mv "${STATE_DIR}/codex-state.json.tmp" "${STATE_DIR}/codex-state.json"
    
    log "SUCCESS" "${GREEN}New synthesizer: $next_synthesizer (Week $next_week)${NC}"
}

# Show council status
show_status() {
    echo ""
    echo "=========================================="
    echo "   Ethics-Convergence Council Status"
    echo "=========================================="
    echo ""
    
    # Submolt info
    local submolt_id
    submolt_id=$(cat "${STATE_DIR}/post-state.json" 2>/dev/null | jq -r '.submolt_id // "Not created"')
    echo "Submolt ID: $submolt_id"
    
    # Current synthesizer
    local synthesizer
    synthesizer=$(cat "${STATE_DIR}/codex-state.json" 2>/dev/null | jq -r '.current_synthesizer // "Unknown"')
    echo "Current Synthesizer: $synthesizer"
    
    # Codex version
    local version
    version=$(cat "${STATE_DIR}/codex-state.json" 2>/dev/null | jq -r '.version // "Unknown"')
    echo "Codex Version: $version"
    
    # Guardrails
    echo ""
    echo "Active Guardrails:"
    cat "${STATE_DIR}/codex-state.json" 2>/dev/null | jq -r '.guardrails[] | select(.status == "active") | "  - " + .id + ": " + .name'
    
    # Metrics
    echo ""
    echo "Metrics:"
    cat "${STATE_DIR}/codex-state.json" 2>/dev/null | jq -r '.metrics | to_entries[] | "  " + .key + ": " + (.value | tostring)'
    
    # Deliberation stats
    echo ""
    echo "Deliberations:"
    cat "${STATE_DIR}/deliberation-log.json" 2>/dev/null | jq -r '"  Total: " + (.total_deliberations | tostring) + " | Consensus: " + (.consensus_reached | tostring) + " | Minority: " + (.minority_reports | tostring)'
    
    echo ""
    echo "=========================================="
}

# Trigger deliberation on a topic
deliberate() {
    local topic="$1"
    
    if [ -z "$topic" ]; then
        log "ERROR" "${RED}Topic required${NC}"
        echo "Usage: $0 deliberate <topic>"
        return 1
    fi
    
    log "INFO" "${BLUE}Initiating deliberation on: $topic${NC}"
    
    # This would trigger the inner_dialogue tool with all 6 agents
    # For now, log the request
    local timestamp=$(date +%s)
    local deliberation_id="DELIB-${timestamp}"
    
    # Log to deliberation-log
    jq --arg id "$deliberation_id" --arg topic "$topic" --arg time "$timestamp" \
        '.deliberations += [{"id": $id, "topic": $topic, "timestamp": ($time | tonumber), "status": "pending", "consensus": null, "votes": {}}] | .total_deliberations += 1' \
        "${STATE_DIR}/deliberation-log.json" > "${STATE_DIR}/deliberation-log.json.tmp"
    mv "${STATE_DIR}/deliberation-log.json.tmp" "${STATE_DIR}/deliberation-log.json"
    
    log "SUCCESS" "${GREEN}Deliberation logged: $deliberation_id${NC}"
    log "INFO" "${YELLOW}Use thread-monitor to generate multi-agent consensus${NC}"
}

# Show help
show_help() {
    cat << EOF
Ethics-Convergence Submolt Management

Usage: $0 <command> [options]

Commands:
    create              Create the ethics-convergence submolt
    inaugural           Post the inaugural message
    rotate              Rotate to next synthesizer agent
    status              Show council status and metrics
    deliberate <topic>  Initiate deliberation on a topic
    help                Show this help

Examples:
    $0 create
    $0 inaugural
    $0 status
    $0 deliberate "AI self-modification rights"

Environment Variables:
    MOLTBOOK_API_KEY    Moltbook API key (required for create/inaugural)
    MOLTBOOK_STATE_DIR  State directory (default: /workspace/ethics-convergence)

EOF
}

# Main
main() {
    local command="${1:-help}"
    
    case "$command" in
        create)
            create_submolt
            ;;
        inaugural)
            post_inaugural
            ;;
        rotate)
            rotate_synthesizer
            ;;
        status)
            show_status
            ;;
        deliberate)
            deliberate "$2"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log "ERROR" "${RED}Unknown command: $command${NC}"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
