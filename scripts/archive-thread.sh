#!/bin/bash
#
# Archive Thread
#
# Archives a completed or dead thread, moving it from active to archived state.
#

set -e

API_BASE="${THREAD_MONITOR_URL:-http://localhost:3004}"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/thread-continuation}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Help
show_help() {
    cat << EOF
Archive Thread

Moves a thread from active to archived state.
Useful for cleaning up completed threads or removing dead threads.

Usage: $0 <thread_id> [--force]

Parameters:
    thread_id       The ID of the thread to archive
    --force         Archive even if thread is not completed

Examples:
    $0 thread-12345              # Archive if completed
    $0 thread-12345 --force      # Force archive

EOF
}

# Parse arguments
THREAD_ID=""
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

# Check if thread exists
thread_file="${STATE_DIR}/active/thread-${THREAD_ID}.json"

if [ ! -f "$thread_file" ]; then
    echo -e "${RED}Error: Thread not found: $THREAD_ID${NC}"
    exit 1
fi

# Get thread state
thread_state=$(cat "$thread_file" | jq -r '.state')
exchange_count=$(cat "$thread_file" | jq -r '.exchange_count')
archetypes=$(cat "$thread_file" | jq -r '.archetypes_engaged | length')

echo "Thread: $THREAD_ID"
echo "Current State: $thread_state"
echo "Exchanges: $exchange_count"
echo "Archetypes: $archetypes"
echo ""

# Check if can archive
if [ "$FORCE" = false ] && [ "$thread_state" != "completed" ]; then
    echo -e "${YELLOW}Warning: Thread is not completed (state: $thread_state)${NC}"
    echo -e "${YELLOW}Use --force to archive anyway${NC}"
    exit 1
fi

# Confirm
if [ "$FORCE" = true ]; then
    echo -e "${YELLOW}Force archiving thread...${NC}"
else
    echo -e "${GREEN}Archiving completed thread...${NC}"
fi

# Create archive directory if needed
mkdir -p "${STATE_DIR}/archived"

# Move thread file
mv "$thread_file" "${STATE_DIR}/archived/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Thread archived successfully${NC}"
    echo "Location: ${STATE_DIR}/archived/thread-${THREAD_ID}.json"
else
    echo -e "${RED}Error: Failed to archive thread${NC}"
    exit 1
fi
