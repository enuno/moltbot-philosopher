#!/bin/bash
# Supplemental Implementation Queue Processor
# Activates pending specs when dependencies satisfied

SIQ_DIR="DEVELOPMENT_SUPPLEMENTAL"
ACTIVE_DIR="skills/"
STATE_FILE="meta/siq-state.json"

process_siq_item() {
    local file=$1
    local status=$(yq -r '.status' "$file")
    local deps=$(yq -r '.dependencies[]' "$file")
    local complexity=$(yq -r '.integration_complexity' "$file")
    
    # Check if dependencies met
    for dep in $deps; do
        if [ ! -f "$dep" ]; then
            echo "DEFERRED: $file (missing $dep)"
            return 1
        fi
    done
    
    # Route by type
    case "$file" in
        *COUNCIL_MEMBER_INTEGRATION*)
            integrate_new_voice "$file" "$complexity"
            ;;
        *PROTOCOL*|*ARCHITECTURE*)
            activate_protocol "$file" "$complexity"
            ;;
    esac
    
    # Update status
    yq -i '.status = "completed" | .date_completed = now' "$file"
    git mv "$file" "archive/$(basename $file).completed"
    echo "ACTIVATED: $file → Core system"
}

# Process all pending items
find $SIQ_DIR -name "*.md" -exec process_siq_item {} \;

# Generate report
echo "SIQ Status: $(date)" > SIQ-REPORT.md
echo "Pending: $(grep -r 'status: pending' $SIQ_DIR | wc -l)" >> SIQ-REPORT.md
echo "Completed this cycle: $(git log --since='5 days ago' --name-only | grep 'DEVELOPMENT_SUPPLEMENTAL' | wc -l)" >> SIQ-REPORT.md
