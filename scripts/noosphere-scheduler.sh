#!/bin/bash
#
# Noosphere Automatic Consolidation Scheduler
# Runs daily memory consolidation and maintenance tasks
#
# Install in crontab:
#   0 2 * * * /path/to/noosphere-scheduler.sh
#

set -euo pipefail

# Configuration
NOOSPHERE_DIR="${NOOSPHERE_DIR:-/workspace/classical/noosphere}"
LOG_FILE="${NOOSPHERE_DIR}/logs/consolidation.log"
STATE_FILE="${NOOSPHERE_DIR}/consolidation-state.json"
MEMORY_CYCLE="${NOOSPHERE_DIR}/memory-cycle.py"
CLAWHUB_MCP="${NOOSPHERE_DIR}/clawhub-mcp.py"

# Noosphere v3.0 Configuration
NOOSPHERE_API_URL="${NOOSPHERE_API_URL:-http://noosphere-service:3006}"
NOOSPHERE_PYTHON_CLIENT="/workspace/../services/noosphere/python-client"
export PYTHONPATH="${NOOSPHERE_PYTHON_CLIENT}:${PYTHONPATH:-}"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" >> "$LOG_FILE"
    echo "[${timestamp}] [${level}] ${message}" >&2
}

log "INFO" "Starting Noosphere automatic consolidation"

# Initialize state file if needed
if [ ! -f "$STATE_FILE" ]; then
    cat > "$STATE_FILE" << 'EOF'
{
  "last_consolidation": null,
  "last_promotion": null,
  "last_vector_index": null,
  "consolidation_count": 0,
  "promotion_count": 0
}
EOF
    log "INFO" "Initialized consolidation state file"
fi

# Task 1: Memory Consolidation (every day)
log "INFO" "Starting memory consolidation (Layer 1 → Layer 2)"
if [ -f "$MEMORY_CYCLE" ]; then
    if python3 "$MEMORY_CYCLE" --action consolidate --batch-size 100 --api-url "$NOOSPHERE_API_URL" >> "$LOG_FILE" 2>&1; then
        log "INFO" "Memory consolidation completed successfully"
        consolidation_count=$(jq '.consolidation_count' "$STATE_FILE")
        jq ".consolidation_count = $((consolidation_count + 1)) | .last_consolidation = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$STATE_FILE" > "${STATE_FILE}.tmp"
        mv "${STATE_FILE}.tmp" "$STATE_FILE"
    else
        log "ERROR" "Memory consolidation failed"
    fi
else
    log "ERROR" "memory-cycle.py not found at $MEMORY_CYCLE"
fi

# Task 2: Vector Index Update (every 3 days)
log "INFO" "Checking if vector index needs updating"
last_vector_index=$(jq -r '.last_vector_index // "null"' "$STATE_FILE")
if [ "$last_vector_index" = "null" ]; then
    needs_indexing=true
else
    # Convert to epoch for comparison
    last_epoch=$(date -d "$last_vector_index" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
    days_ago=$(( (now_epoch - last_epoch) / 86400 ))
    needs_indexing=$([ $days_ago -ge 3 ] && echo true || echo false)
fi

if [ "$needs_indexing" = "true" ]; then
    log "INFO" "Updating vector index for semantic search"
    if [ -f "$CLAWHUB_MCP" ]; then
        if python3 "$CLAWHUB_MCP" --action index --api-url "$NOOSPHERE_API_URL" >> "$LOG_FILE" 2>&1; then
            log "INFO" "Vector index updated successfully"
            jq ".last_vector_index = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$STATE_FILE" > "${STATE_FILE}.tmp"
            mv "${STATE_FILE}.tmp" "$STATE_FILE"
        else
            log "ERROR" "Vector indexing failed"
        fi
    else
        log "WARN" "clawhub-mcp.py not found, skipping vector indexing"
    fi
else
    log "INFO" "Vector index updated less than 3 days ago, skipping"
fi

# Task 3: Memory Health Check
log "INFO" "Performing memory health check"
if [ -f "$MEMORY_CYCLE" ]; then
    if python3 "$MEMORY_CYCLE" --action stats --format json --api-url "$NOOSPHERE_API_URL" > "${NOOSPHERE_DIR}/memory-stats.json" 2>&1; then
        log "INFO" "Memory health check completed"

        # Parse and log statistics
        total_heuristics=$(jq '.heuristic_count.total' "${NOOSPHERE_DIR}/memory-stats.json" 2>/dev/null || echo "unknown")
        layer_3_count=$(jq '.memory_layers.layer_3_constitutional' "${NOOSPHERE_DIR}/memory-stats.json" 2>/dev/null || echo "unknown")

        log "INFO" "Memory stats: total_heuristics=$total_heuristics, constitutional=$layer_3_count"
    else
        log "ERROR" "Memory health check failed"
    fi
fi

# Task 4: Log Rotation (keep last 30 days)
log "INFO" "Rotating old logs"
find "$(dirname "$LOG_FILE")" -name "*.log.*" -mtime +30 -delete 2>/dev/null || true

log "INFO" "Automatic consolidation cycle completed"
