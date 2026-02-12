#!/bin/bash
# ============================================================================
# Noosphere v3.2 Confidence Decay Job
# ============================================================================
# Applies time-based confidence decay and auto-evicts low-confidence memories
#
# Usage:
#   ./apply-decay.sh [agent_id] [batch_size]
#
# Examples:
#   ./apply-decay.sh                    # All agents, 100 memories per batch
#   ./apply-decay.sh classical 50       # Classical agent, 50 memories
#
# Cron: Run daily
#   0 2 * * * /app/scripts/apply-decay.sh >> /app/logs/decay.log 2>&1
# ============================================================================

set -euo pipefail

# Configuration
AGENT_ID="${1:-}"
BATCH_SIZE="${2:-100}"
DB_CONTAINER="${DB_CONTAINER:-noosphere-postgres}"
DB_USER="${DB_USER:-noosphere_admin}"
DB_NAME="${DB_NAME:-noosphere}"

# Logging
log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*"
}

log "=== Starting Confidence Decay Job ==="
log "Agent: ${AGENT_ID:-all}"
log "Batch size: $BATCH_SIZE"

# Build SQL query
if [ -z "$AGENT_ID" ]; then
    AGENT_FILTER="NULL"
else
    AGENT_FILTER="'$AGENT_ID'"
fi

# Apply decay to batch
log "Applying decay to memories..."
DECAY_RESULT=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t << EOF
SELECT
    COUNT(*) as decayed_count,
    SUM(CASE WHEN decayed THEN 1 ELSE 0 END) as actually_decayed,
    AVG(old_confidence) as avg_old_confidence,
    AVG(new_confidence) as avg_new_confidence
FROM apply_decay_batch($AGENT_FILTER::TEXT, $BATCH_SIZE);
EOF
)

log "Decay applied:"
log "$DECAY_RESULT"

# Auto-evict low-confidence memories
log "Auto-evicting low-confidence memories..."
EVICT_RESULT=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t << EOF
SELECT
    COUNT(*) as evicted_count,
    STRING_AGG(DISTINCT agent_id, ', ') as affected_agents,
    STRING_AGG(DISTINCT memory_type, ', ') as affected_types
FROM auto_evict_low_confidence($AGENT_FILTER::TEXT);
EOF
)

log "Eviction complete:"
log "$EVICT_RESULT"

# Update agent stats
log "Updating agent statistics..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" << EOF
UPDATE noosphere_agent_stats
SET
    last_decay_run = now(),
    updated_at = now()
WHERE $AGENT_FILTER IS NULL OR agent_id = $AGENT_FILTER;
EOF

# Summary
log "Generating summary..."
SUMMARY=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t << EOF
SELECT
    agent_id,
    COUNT(*) as memory_count,
    AVG(confidence)::NUMERIC(3,2) as avg_confidence,
    MIN(confidence)::NUMERIC(3,2) as min_confidence,
    MAX(confidence)::NUMERIC(3,2) as max_confidence
FROM noosphere_memory
WHERE $AGENT_FILTER IS NULL OR agent_id = $AGENT_FILTER
GROUP BY agent_id
ORDER BY agent_id;
EOF
)

log "Memory statistics after decay:"
log "$SUMMARY"

log "=== Decay Job Complete ==="
