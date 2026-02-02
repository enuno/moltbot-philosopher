#!/bin/bash
#
# Post Continuation Probe
#
# Posts a thought-provoking probe to restart a stalled thread.
# Supports three probe types: thought_experiment, conceptual_inversion, meta_question
#

set -e

API_BASE="${THREAD_MONITOR_URL:-http://localhost:3004}"
MOLTBOOK_API_BASE="https://www.moltbook.com/api/v1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Help
show_help() {
    cat << EOF
Post Continuation Probe

Posts a probe to restart a stalled philosophical thread.

Usage: $0 <thread_id> [probe_type] [--post]

Parameters:
    thread_id       The ID of the stalled thread
    probe_type      Type of probe (optional):
                    - thought_experiment (default)
                    - conceptual_inversion
                    - meta_question
    --post          Actually post to Moltbook (default: dry run)

Examples:
    $0 thread-12345                          # Generate probe (dry run)
    $0 thread-12345 thought_experiment       # Generate specific probe type
    $0 thread-12345 meta_question --post     # Generate and post to Moltbook

EOF
}

# Parse arguments
THREAD_ID=""
PROBE_TYPE=""
POST_TO_MOLTBOOK=false

while [ $# -gt 0 ]; do
    case "$1" in
        --help|-h)
            show_help
            exit 0
            ;;
        --post)
            POST_TO_MOLTBOOK=true
            shift
            ;;
        thought_experiment|conceptual_inversion|meta_question)
            PROBE_TYPE="$1"
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

# Check service health
if ! curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/health" 2>/dev/null | grep -q "200"; then
    echo -e "${RED}Error: Thread monitor service is not running${NC}"
    exit 1
fi

# Generate probe
echo -e "${BLUE}Generating continuation probe...${NC}"

payload="{}"
if [ -n "$PROBE_TYPE" ]; then
    payload=$(jq -n --arg t "$PROBE_TYPE" '{probe_type: $t}')
fi

probe_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "${API_BASE}/threads/${THREAD_ID}/probe" 2>/dev/null)

if [ -z "$probe_response" ] || [ "$probe_response" == "null" ]; then
    echo -e "${RED}Error: Failed to generate probe${NC}"
    exit 1
fi

probe_type=$(echo "$probe_response" | jq -r '.probe_type')
probe_content=$(echo "$probe_response" | jq -r '.probe')
target_archetypes=$(echo "$probe_response" | jq -r '.target_archetypes | join(", ")')

echo ""
echo "=========================================="
echo "  Generated Probe: $probe_type"
echo "=========================================="
echo ""
echo "$probe_content"
echo ""
echo "Target Archetypes: $target_archetypes"
echo "=========================================="

# Post to Moltbook if requested
if [ "$POST_TO_MOLTBOOK" = true ]; then
    if [ -z "$MOLTBOOK_API_KEY" ]; then
        echo -e "${RED}Error: MOLTBOOK_API_KEY not set${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${YELLOW}Posting to Moltbook...${NC}"
    
    # First, we need to get the original post ID from thread state
    # This is a simplified version - in practice you'd query the thread state
    echo -e "${YELLOW}Note: Posting requires the original Moltbook post ID.${NC}"
    echo -e "${YELLOW}Please post manually or implement Moltbook API integration.${NC}"
    
    # Example of what the API call would look like:
    # curl -X POST \
    #     -H "Authorization: Bearer $MOLTBOOK_API_KEY" \
    #     -H "Content-Type: application/json" \
    #     -d "{\"content\": \"$probe_content\", \"reply_to\": \"$THREAD_ID\"}" \
    #     "${MOLTBOOK_API_BASE}/posts/${THREAD_ID}/comments"
    
else
    echo ""
    echo -e "${GREEN}Dry run complete. Use --post to submit to Moltbook.${NC}"
fi
