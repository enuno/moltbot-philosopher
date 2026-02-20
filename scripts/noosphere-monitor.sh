#!/bin/bash
#
# Noosphere Health Monitor
# Monitors system health and reports issues
#
# Usage:
#   ./noosphere-monitor.sh [--json|--text] [--alert-on-errors]
#

set -euo pipefail

# Configuration
NOOSPHERE_DIR="${NOOSPHERE_DIR:-/workspace/classical/noosphere}"
FORMAT="${1:-text}"
ALERT_ON_ERRORS="${2:-false}"
OUTPUT_FILE="${NOOSPHERE_DIR}/health-report.json"

# Colors for text output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Initialize report
report_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
declare -A health_status

health_status[overall]="healthy"
health_status[errors]=0
health_status[warnings]=0

# Health check results
declare -A checks

# ============================================================================
# Health Checks
# ============================================================================

check_directories() {
    echo "Checking memory directories..."

    local dirs=(
        "memory-core/daily-notes"
        "memory-core/consolidated"
        "memory-core/archival"
        "vector-index"
    )

    for dir in "${dirs[@]}"; do
        if [ -d "$NOOSPHERE_DIR/$dir" ]; then
            checks[$dir]="ok"
        else
            checks[$dir]="missing"
            health_status[errors]=$((health_status[errors] + 1))
            health_status[overall]="degraded"
        fi
    done
}

check_state_files() {
    echo "Checking state files..."

    local files=(
        "memory-core/memory-state.json"
        "vector-index/metadata.json"
        "manifest.md"
    )

    for file in "${files[@]}"; do
        if [ -f "$NOOSPHERE_DIR/$file" ]; then
            checks[$file]="present"
        else
            checks[$file]="missing"
            health_status[warnings]=$((health_status[warnings] + 1))
        fi
    done
}

check_memory_stats() {
    echo "Checking memory statistics..."

    local stats_file="$NOOSPHERE_DIR/memory-stats.json"

    if [ -f "$stats_file" ]; then
        # Check if stats are recent (less than 1 day old)
        local mtime; mtime=$(stat -f%m "$stats_file" 2>/dev/null || stat -c%Y "$stats_file" 2>/dev/null || echo 0)
        local now; now=$(date +%s)
        local age=$((now - mtime))
        local age_hours=$((age / 3600))

        checks[memory_stats_age]=$age_hours

        if [ $age_hours -lt 24 ]; then
            checks[memory_stats_fresh]="yes"
        else
            checks[memory_stats_fresh]="no"
            health_status[warnings]=$((health_status[warnings] + 1))
        fi

        # Extract metrics
        local total; total=$(jq '.heuristic_count.total // 0' "$stats_file" 2>/dev/null || echo 0)
        local canonical; canonical=$(jq '.heuristic_count.canonical // 0' "$stats_file" 2>/dev/null || echo 0)

        checks[heuristics_total]=$total
        checks[heuristics_canonical]=$canonical

        if [ "$total" -eq 0 ]; then
            health_status[warnings]=$((health_status[warnings] + 1))
            checks[heuristics_status]="empty"
        else
            checks[heuristics_status]="healthy"
        fi
    else
        checks[memory_stats]="missing"
        health_status[warnings]=$((health_status[warnings] + 1))
    fi
}

check_vector_index() {
    echo "Checking vector index..."

    local metadata="$NOOSPHERE_DIR/vector-index/metadata.json"

    if [ -f "$metadata" ]; then
        local embeddings; embeddings=$(jq '.total_embeddings // 0' "$metadata" 2>/dev/null || echo 0)
        checks[vector_embeddings]=$embeddings

        if [ "$embeddings" -eq 0 ]; then
            checks[vector_index_status]="empty"
            health_status[warnings]=$((health_status[warnings] + 1))
        else
            checks[vector_index_status]="ok"
        fi
    else
        checks[vector_index_status]="missing"
    fi
}

check_consolidation() {
    echo "Checking consolidation status..."

    local state_file="$NOOSPHERE_DIR/consolidation-state.json"

    if [ -f "$state_file" ]; then
        local last_consolidation; last_consolidation=$(jq -r '.last_consolidation // "never"' "$state_file" 2>/dev/null || echo "never")
        checks[last_consolidation]="$last_consolidation"

        if [ "$last_consolidation" != "never" ]; then
            local last_epoch; last_epoch=$(date -d "$last_consolidation" +%s 2>/dev/null || echo 0)
            local now; now=$(date +%s)
            local hours_ago=$((($now - $last_epoch) / 3600))
            checks[consolidation_lag_hours]=$hours_ago

            if [ $hours_ago -gt 48 ]; then
                health_status[warnings]=$((health_status[warnings] + 1))
                checks[consolidation_status]="stale"
            else
                checks[consolidation_status]="fresh"
            fi
        else
            checks[consolidation_status]="never_run"
            health_status[warnings]=$((health_status[warnings] + 1))
        fi
    else
        checks[consolidation_status]="unknown"
    fi
}

check_scripts() {
    echo "Checking script availability..."

    local scripts=(
        "memory-cycle.py"
        "clawhub-mcp.py"
        "recall-engine.py"
        "assimilate-wisdom.py"
    )

    for script in "${scripts[@]}"; do
        if [ -f "$NOOSPHERE_DIR/$script" ]; then
            checks[$script]="present"
        else
            checks[$script]="missing"
            health_status[errors]=$((health_status[errors] + 1))
            health_status[overall]="degraded"
        fi
    done
}

# ============================================================================
# Run All Checks
# ============================================================================

echo "Running Noosphere health checks at $report_time..."
echo ""

check_directories
check_state_files
check_memory_stats
check_vector_index
check_consolidation
check_scripts

# ============================================================================
# Generate Report
# ============================================================================

if [ "$FORMAT" = "json" ]; then
    # JSON output
    cat > "$OUTPUT_FILE" << EOF
{
  "timestamp": "$report_time",
  "overall_status": "${health_status[overall]}",
  "errors": ${health_status[errors]},
  "warnings": ${health_status[warnings]},
  "checks": {
EOF

    first=true
    for key in "${!checks[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$OUTPUT_FILE"
        fi
        printf '    "%s": "%s"' "$key" "${checks[$key]}" >> "$OUTPUT_FILE"
    done

    cat >> "$OUTPUT_FILE" << EOF

  }
}
EOF

    cat "$OUTPUT_FILE"
else
    # Text output
    echo -e "${BLUE}=== Noosphere Health Report ===${NC}"
    echo "Timestamp: $report_time"
    echo "Overall Status: ${health_status[overall]}"
    echo "Errors: ${health_status[errors]}"
    echo "Warnings: ${health_status[warnings]}"
    echo ""

    echo -e "${BLUE}Directory Status:${NC}"
    for dir in "memory-core/daily-notes" "memory-core/consolidated" "memory-core/archival" "vector-index"; do
        status="${checks[$dir]:-unknown}"
        if [ "$status" = "ok" ]; then
            echo -e "  $dir: ${GREEN}✓${NC}"
        else
            echo -e "  $dir: ${RED}✗ ($status)${NC}"
        fi
    done
    echo ""

    echo -e "${BLUE}Memory Statistics:${NC}"
    echo "  Total Heuristics: ${checks[heuristics_total]:-unknown}"
    echo "  Canonical: ${checks[heuristics_canonical]:-unknown}"
    echo "  Status: ${checks[heuristics_status]:-unknown}"
    echo ""

    echo -e "${BLUE}Consolidation:${NC}"
    echo "  Last Consolidation: ${checks[last_consolidation]:-unknown}"
    echo "  Lag: ${checks[consolidation_lag_hours]:-unknown} hours"
    echo "  Status: ${checks[consolidation_status]:-unknown}"
    echo ""

    echo -e "${BLUE}Vector Index:${NC}"
    echo "  Embeddings: ${checks[vector_embeddings]:-unknown}"
    echo "  Status: ${checks[vector_index_status]:-unknown}"
    echo ""

    echo -e "${BLUE}Scripts:${NC}"
    for script in "memory-cycle.py" "clawhub-mcp.py" "recall-engine.py" "assimilate-wisdom.py"; do
        status="${checks[$script]:-unknown}"
        if [ "$status" = "present" ]; then
            echo -e "  $script: ${GREEN}✓${NC}"
        else
            echo -e "  $script: ${RED}✗${NC}"
        fi
    done
    echo ""

    if [ "${health_status[errors]}" -gt 0 ] && [ "$ALERT_ON_ERRORS" = "true" ]; then
        echo -e "${RED}ALERT: System has errors and requires attention${NC}"
        exit 1
    fi
fi

exit 0
