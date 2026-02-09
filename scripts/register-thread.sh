#!/bin/bash
#
# Register Thread with Thread Monitor
#
# Automatically registers a Moltbook post/thread with the thread monitor service
# for continuation probe generation and philosophical discourse tracking.
#
# Usage: ./register-thread.sh <thread_id> [original_question]

set -e

# Configuration
THREAD_MONITOR_URL="${THREAD_MONITOR_URL:-http://thread-monitor:3004}"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
THREAD_REGISTRY="${STATE_DIR}/thread-registry.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Help
show_help() {
    cat << EOF
Register Thread with Thread Monitor

Registers a Moltbook post/thread for philosophical discourse tracking.

Usage: $0 <thread_id> [original_question] [--force]

Parameters:
    thread_id           Moltbook post ID (UUID format)
    original_question   The original philosophical question (optional)
    --force            Force re-registration even if already exists

Examples:
    $0 abc123-def456-789...
    $0 abc123-def456-789... "What is consciousness?"
    $0 abc123-def456-789... "AI ethics question" --force

Environment:
    THREAD_MONITOR_URL  Thread monitor service URL
                       Default: http://thread-monitor:3004
    MOLTBOT_STATE_DIR   State directory for tracking
                       Default: /workspace/classical

EOF
}

# Parse arguments
THREAD_ID=""
QUESTION=""
FORCE=false

while [ $# -gt 0 ]; do
    case "$1" in
        --help|-h)
            show_help
            exit 0
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            if [ -z "$THREAD_ID" ]; then
                THREAD_ID="$1"
            elif [ -z "$QUESTION" ]; then
                QUESTION="$1"
            fi
            shift
            ;;
    esac
done

if [ -z "$THREAD_ID" ]; then
    echo -e "${RED}Error: Thread ID required${NC}"
    show_help
    exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize registry if it doesn't exist
if [ ! -f "$THREAD_REGISTRY" ]; then
    echo '{"threads": {}}' > "$THREAD_REGISTRY"
fi

# Check if already registered (unless force)
if [ "$FORCE" = false ]; then
    ALREADY_REGISTERED=$(jq -r --arg id "$THREAD_ID" '.threads[$id] // empty' "$THREAD_REGISTRY")
    if [ -n "$ALREADY_REGISTERED" ]; then
        echo -e "${YELLOW}Thread $THREAD_ID already registered${NC}"
        echo -e "${BLUE}Registered at: $(echo "$ALREADY_REGISTERED" | jq -r '.registered_at')${NC}"
        echo -e "${BLUE}Use --force to re-register${NC}"
        exit 0
    fi
fi

# Check if thread monitor is available
if ! curl -s -o /dev/null -w "%{http_code}" "${THREAD_MONITOR_URL}/health" 2>/dev/null | grep -q "200"; then
    echo -e "${RED}Error: Thread monitor service not available at ${THREAD_MONITOR_URL}${NC}"
    echo -e "${YELLOW}Make sure the thread-monitor service is running${NC}"
    exit 1
fi

# Check if thread already exists in thread monitor
EXISTING=$(curl -s "${THREAD_MONITOR_URL}/threads/${THREAD_ID}" 2>/dev/null)
if echo "$EXISTING" | jq -e '.thread_id' >/dev/null 2>&1; then
    if [ "$FORCE" = false ]; then
        echo -e "${YELLOW}Thread already exists in thread monitor${NC}"
        echo -e "${BLUE}State: $(echo "$EXISTING" | jq -r '.state')${NC}"
        echo -e "${BLUE}Exchanges: $(echo "$EXISTING" | jq -r '.exchange_count')${NC}"
        
        # Update local registry
        TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        jq --arg id "$THREAD_ID" \
           --arg ts "$TIMESTAMP" \
           --arg state "verified" \
           '.threads[$id] = {registered_at: $ts, state: $state}' \
           "$THREAD_REGISTRY" > "${THREAD_REGISTRY}.tmp" && \
           mv "${THREAD_REGISTRY}.tmp" "$THREAD_REGISTRY"
        
        exit 0
    fi
fi

# Create thread in thread monitor
echo -e "${BLUE}Registering thread with monitor...${NC}"

PAYLOAD=$(jq -n \
    --arg id "$THREAD_ID" \
    --arg question "${QUESTION:-Philosophical discussion on Moltbook}" \
    '{
        thread_id: $id,
        original_question: $question,
        constraints: [],
        metadata: {
            source: "moltbook",
            created_via: "auto",
            registered_at: now | todate
        }
    }')

RESPONSE=$(curl -s -X POST "${THREAD_MONITOR_URL}/threads" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" 2>/dev/null)

# Check response
if echo "$RESPONSE" | jq -e '.thread_id' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Thread registered successfully!${NC}"
    echo ""
    echo "Thread ID: $(echo "$RESPONSE" | jq -r '.thread_id')"
    echo "State: $(echo "$RESPONSE" | jq -r '.state')"
    echo "Created: $(echo "$RESPONSE" | jq -r '.created_at' | xargs -I {} date -d @{} 2>/dev/null || date -r {} 2>/dev/null || echo {})"
    
    # Update local registry
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    jq --arg id "$THREAD_ID" \
       --arg ts "$TIMESTAMP" \
       --arg state "registered" \
       --arg question "${QUESTION:-Philosophical discussion on Moltbook}" \
       '.threads[$id] = {registered_at: $ts, state: $state, question: $question}' \
       "$THREAD_REGISTRY" > "${THREAD_REGISTRY}.tmp" && \
       mv "${THREAD_REGISTRY}.tmp" "$THREAD_REGISTRY"
    
    echo ""
    echo -e "${BLUE}You can now generate continuation probes:${NC}"
    echo "  /app/scripts/post-continuation-probe.sh $THREAD_ID"
    
else
    echo -e "${RED}❌ Failed to register thread${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi
