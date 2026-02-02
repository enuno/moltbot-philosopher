#!/bin/bash
#
# Thread Monitor Script
# 
# Monitors active philosophical threads and generates continuations.
# Can be run manually or via cron.
#

set -e

# Configuration
API_BASE="${THREAD_MONITOR_URL:-http://localhost:3004}"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/thread-continuation}"
LOG_FILE="${LOG_FILE:-/app/logs/thread-monitor-cli.log}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Check if thread-monitor service is healthy
check_health() {
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/health" 2>/dev/null || echo "000")
    
    if [ "$response" == "200" ]; then
        return 0
    else
        return 1
    fi
}

# List active threads
list_threads() {
    log "INFO" "${BLUE}Fetching active threads...${NC}"
    
    if ! check_health; then
        log "ERROR" "${RED}Thread monitor service is not running${NC}"
        return 1
    fi
    
    local threads
    threads=$(curl -s "${API_BASE}/threads" 2>/dev/null)
    
    if [ -z "$threads" ]; then
        log "WARN" "${YELLOW}No threads found or service error${NC}"
        return 1
    fi
    
    local count
    count=$(echo "$threads" | jq -r '.count // 0')
    
    echo ""
    echo "Active Threads: $count"
    echo "----------------------------------------"
    
    echo "$threads" | jq -r '.threads[] | 
        "Thread: \(.thread_id)
         State: \(.state)
         Exchanges: \(.exchange_count)
         Participants: \(.participants | join(\", \"))
         Archetypes: \(.archetypes_engaged | join(\", \"))
         Last Activity: \(.last_activity | todate)
         ----------------------------------------"' 2>/dev/null || echo "Error parsing threads"
}

# Get details for a specific thread
get_thread() {
    local thread_id="$1"
    
    if [ -z "$thread_id" ]; then
        log "ERROR" "${RED}Thread ID required${NC}"
        echo "Usage: $0 get <thread_id>"
        return 1
    fi
    
    log "INFO" "${BLUE}Fetching thread: $thread_id${NC}"
    
    local thread
    thread=$(curl -s "${API_BASE}/threads/${thread_id}" 2>/dev/null)
    
    if [ -z "$thread" ] || [ "$thread" == "null" ]; then
        log "ERROR" "${RED}Thread not found: $thread_id${NC}"
        return 1
    fi
    
    echo "$thread" | jq '.'
}

# Create a new thread
create_thread() {
    local question="$1"
    local constraint1="$2"
    local constraint2="$3"
    local constraint3="$4"
    
    if [ -z "$question" ]; then
        log "ERROR" "${RED}Question required${NC}"
        echo "Usage: $0 create <question> [constraint1] [constraint2] [constraint3]"
        return 1
    fi
    
    # Generate thread ID
    local thread_id="thread-$(date +%s)-$RANDOM"
    
    # Build constraints array
    local constraints="[]"
    if [ -n "$constraint1" ]; then
        constraints=$(echo "$constraints" | jq --arg c "$constraint1" '. + [$c]')
    fi
    if [ -n "$constraint2" ]; then
        constraints=$(echo "$constraints" | jq --arg c "$constraint2" '. + [$c]')
    fi
    if [ -n "$constraint3" ]; then
        constraints=$(echo "$constraints" | jq --arg c "$constraint3" '. + [$c]')
    fi
    
    log "INFO" "${BLUE}Creating thread: $thread_id${NC}"
    
    local payload
    payload=$(jq -n \
        --arg tid "$thread_id" \
        --arg q "$question" \
        --argjson c "$constraints" \
        '{thread_id: $tid, original_question: $q, constraints: $c}')
    
    local response
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "${API_BASE}/threads" 2>/dev/null)
    
    if [ -n "$response" ]; then
        log "SUCCESS" "${GREEN}Thread created: $thread_id${NC}"
        echo "$response" | jq '.'
    else
        log "ERROR" "${RED}Failed to create thread${NC}"
        return 1
    fi
}

# Generate continuation for a thread
continue_thread() {
    local thread_id="$1"
    
    if [ -z "$thread_id" ]; then
        log "ERROR" "${RED}Thread ID required${NC}"
        echo "Usage: $0 continue <thread_id>"
        return 1
    fi
    
    log "INFO" "${BLUE}Generating continuation for: $thread_id${NC}"
    
    local response
    response=$(curl -s -X POST \
        "${API_BASE}/threads/${thread_id}/continue" 2>/dev/null)
    
    if [ -n "$response" ] && [ "$response" != "null" ]; then
        log "SUCCESS" "${GREEN}Continuation generated${NC}"
        echo ""
        echo "$response" | jq -r '.continuation'
        echo ""
        echo "Synthesis: $(echo "$response" | jq -r '.synthesis')"
        echo "Tension: $(echo "$response" | jq -r '.tension')"
        echo "Propagation: $(echo "$response" | jq -r '.propagation')"
        echo "Mentions: $(echo "$response" | jq -r '.mentions | join(", ")')"
    else
        log "ERROR" "${RED}Failed to generate continuation${NC}"
        return 1
    fi
}

# Post probe for stalled thread
probe_thread() {
    local thread_id="$1"
    local probe_type="$2"
    
    if [ -z "$thread_id" ]; then
        log "ERROR" "${RED}Thread ID required${NC}"
        echo "Usage: $0 probe <thread_id> [thought_experiment|conceptual_inversion|meta_question]"
        return 1
    fi
    
    log "INFO" "${BLUE}Generating probe for: $thread_id${NC}"
    
    local payload="{}"
    if [ -n "$probe_type" ]; then
        payload=$(jq -n --arg t "$probe_type" '{probe_type: $t}')
    fi
    
    local response
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "${API_BASE}/threads/${thread_id}/probe" 2>/dev/null)
    
    if [ -n "$response" ] && [ "$response" != "null" ]; then
        log "SUCCESS" "${GREEN}Probe generated: $(echo "$response" | jq -r '.probe_type')${NC}"
        echo ""
        echo "$response" | jq -r '.probe'
    else
        log "ERROR" "${RED}Failed to generate probe${NC}"
        return 1
    fi
}

# Show thread statistics
show_stats() {
    log "INFO" "${BLUE}Fetching thread statistics...${NC}"
    
    local metrics
    metrics=$(curl -s "${API_BASE}/metrics" 2>/dev/null)
    
    echo ""
    echo "Thread Statistics"
    echo "========================================"
    
    # Parse Prometheus metrics
    echo "$metrics" | grep -E "^moltbot_" | while read -r line; do
        local metric_name=$(echo "$line" | cut -d'{' -f1)
        local value=$(echo "$line" | awk '{print $NF}')
        echo "$metric_name: $value"
    done
}

# List available philosophers
list_philosophers() {
    log "INFO" "${BLUE}Fetching available philosophers...${NC}"
    
    local philosophers
    philosophers=$(curl -s "${API_BASE}/philosophers" 2>/dev/null)
    
    if [ -n "$philosophers" ]; then
        echo ""
        echo "Available Philosopher Archetypes"
        echo "========================================"
        echo "$philosophers" | jq -r '.philosophers[] | 
            "\(.id): \(.name)
             Tags: \(.tags | join(\", \"))
             ----------------------------------------"'
    else
        log "ERROR" "${RED}Failed to fetch philosophers${NC}"
        return 1
    fi
}

# Run monitoring cycle
run_monitor() {
    log "INFO" "${BLUE}Running thread monitoring cycle...${NC}"
    
    if ! check_health; then
        log "ERROR" "${RED}Thread monitor service is not running${NC}"
        return 1
    fi
    
    log "INFO" "${GREEN}Monitoring cycle triggered via API${NC}"
    echo "The service runs monitoring automatically every ${THREAD_CHECK_INTERVAL:-900} seconds."
    echo "Use 'list' command to see current thread states."
}

# Show help
show_help() {
    cat << EOF
Thread Monitor - Manage philosophical discourse threads

Usage: $0 <command> [options]

Commands:
    list                    List all active threads
    get <thread_id>         Get details for a specific thread
    create <question> [c1] [c2] [c3]
                           Create a new thread with optional constraints
    continue <thread_id>    Generate continuation for a thread
    probe <thread_id> [type]
                           Post continuation probe (type: thought_experiment,
                           conceptual_inversion, meta_question)
    stats                   Show thread statistics
    philosophers            List available philosopher archetypes
    monitor                 Run monitoring cycle
    help                    Show this help message

Environment Variables:
    THREAD_MONITOR_URL      Thread monitor API URL (default: http://localhost:3004)
    MOLTBOT_STATE_DIR       State directory (default: /workspace/thread-continuation)
    LOG_FILE                Log file path (default: /app/logs/thread-monitor-cli.log)

Examples:
    $0 list
    $0 create "What is consciousness?" "functional vs representational" "third-person only"
    $0 continue thread-12345
    $0 probe thread-12345 thought_experiment
    $0 get thread-12345

EOF
}

# Main
main() {
    local command="${1:-help}"
    
    case "$command" in
        list)
            list_threads
            ;;
        get)
            get_thread "$2"
            ;;
        create)
            create_thread "$2" "$3" "$4" "$5"
            ;;
        continue)
            continue_thread "$2"
            ;;
        probe)
            probe_thread "$2" "$3"
            ;;
        stats)
            show_stats
            ;;
        philosophers)
            list_philosophers
            ;;
        monitor)
            run_monitor
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
