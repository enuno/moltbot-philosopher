#!/bin/bash
#
# Check Thread Health
#
# Evaluates the health metrics of active threads and reports on
# vitality, engagement quality, and completion progress.
#

set -e

API_BASE="${THREAD_MONITOR_URL:-http://localhost:3004}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check service health
if ! curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/health" 2>/dev/null | grep -q "200"; then
    echo -e "${RED}Error: Thread monitor service is not running${NC}"
    exit 1
fi

echo "=========================================="
echo "   Thread Health Dashboard"
echo "=========================================="
echo ""

# Get all threads
threads=$(curl -s "${API_BASE}/threads" 2>/dev/null)
count=$(echo "$threads" | jq -r '.count // 0')

echo -e "Active Threads: ${BLUE}$count${NC}"
echo ""

if [ "$count" -eq 0 ]; then
    echo -e "${YELLOW}No active threads found.${NC}"
    exit 0
fi

# Analyze thread health
echo "$threads" | jq -r '.threads[] | @base64' | while read -r thread; do
    _jq() {
        echo "${thread}" | base64 -d | jq -r "${1}"
    }
    
    thread_id=$(_jq '.thread_id')
    state=$(_jq '.state')
    exchanges=$(_jq '.exchange_count')
    participants=$(_jq '.participants | length')
    archetypes=$(_jq '.archetypes_engaged | length')
    last_activity=$(_jq '.last_activity')
    
    # Calculate time since activity
    now=$(date +%s)
    hours_inactive=$(( (now - last_activity) / 3600 ))
    
    # Determine health status
    health_status="${GREEN}HEALTHY${NC}"
    if [ "$state" == "stalled" ]; then
        health_status="${YELLOW}STALLED${NC}"
    elif [ "$hours_inactive" -gt 24 ]; then
        health_status="${RED}AT RISK${NC}"
    fi
    
    # Check success criteria progress
    exchange_progress=$(( exchanges * 100 / 7 ))
    archetype_progress=$(( archetypes * 100 / 3 ))
    
    echo "Thread: $thread_id"
    echo "  State: $state | Health: $health_status"
    echo "  Exchanges: $exchanges/7 (${exchange_progress}%) | Participants: $participants"
    echo "  Archetypes: $archetypes/3 (${archetype_progress}%)"
    echo "  Hours Inactive: $hours_inactive"
    echo "------------------------------------------"
done

echo ""
echo "=========================================="
echo "Success Criteria: 7+ exchanges, 3+ archetypes"
echo "Stall Threshold: 24 hours"
echo "Death Threshold: 48 hours + 3 stalls"
echo "=========================================="
