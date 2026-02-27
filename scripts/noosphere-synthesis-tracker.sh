#!/bin/bash
#
# Noosphere Synthesis Tracker Module
# Manages synthesis history to prevent heuristic repetition in Ethics-Convergence Council
#
# Functions:
#   add_synthesis_exclusion(version, pattern, axis)    - Add pattern to synthesis exclusions
#   get_exclusions_for_axis(axis)                       - Retrieve last 20 patterns for axis
#   get_all_exclusions()                                - Return full exclusion history (paginated)
#   get_exclusions_by_axis()                            - Group all exclusions by axis
#   prune_old_exclusions(days_threshold)                - Remove exclusions older than threshold
#
# Usage:
#   bash noosphere-synthesis-tracker.sh add "1.0" "pattern_text" "phenomenological_depth"
#   bash noosphere-synthesis-tracker.sh get "phenomenological_depth"
#   bash noosphere-synthesis-tracker.sh all
#   bash noosphere-synthesis-tracker.sh count
#   bash noosphere-synthesis-tracker.sh prune 90
#

set -euo pipefail

# Configuration
WORKSPACE_DIR="${MOLTBOT_STATE_DIR:-/workspace}"
EXCLUSIONS_FILE="${WORKSPACE_DIR}/classical/synthesis-exclusions.json"
FALLBACK_DIR="${HOME}/.moltbot/synthesis-state"

# Ensure fallback directory exists if workspace not writable
if [ ! -w "$WORKSPACE_DIR" ] 2>/dev/null; then
    EXCLUSIONS_FILE="${FALLBACK_DIR}/synthesis-exclusions.json"
    mkdir -p "$FALLBACK_DIR" 2>/dev/null || true
fi

# Valid axes
VALID_AXES=("phenomenological_depth" "structural_critique" "autonomy_preservation")

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [SYNTHESIS-TRACKER] [${level}] ${message}" >&2
}

##############################################################################
# Initialize exclusions file if missing - GAP 1: Updated JSON structure
##############################################################################
_ensure_exclusions_file() {
    if [ ! -f "$EXCLUSIONS_FILE" ]; then
        log "INFO" "Initializing synthesis-exclusions.json at $EXCLUSIONS_FILE"
        mkdir -p "$(dirname "$EXCLUSIONS_FILE")" 2>/dev/null || true
        cat > "$EXCLUSIONS_FILE" <<'EOF'
{
  "initialized": "2026-02-27T12:00:00Z",
  "last_prune": null,
  "exclusion_count": 0,
  "exclusions": []
}
EOF
        log "INFO" "Exclusions file initialized"
    fi
}

##############################################################################
# Validate JSON integrity
##############################################################################
_validate_json() {
    local file="$1"

    if [ ! -f "$file" ]; then
        return 1
    fi

    if ! jq empty "$file" 2>/dev/null; then
        log "WARN" "Corrupted JSON at $file, reinitializing"
        _ensure_exclusions_file
        return 1
    fi

    return 0
}

##############################################################################
# Validate axis - GAP 5: Axis validation
##############################################################################
_validate_axis() {
    local axis="$1"

    for valid_axis in "${VALID_AXES[@]}"; do
        if [ "$axis" = "$valid_axis" ]; then
            return 0
        fi
    done

    return 1
}

##############################################################################
# Add Synthesis Exclusion
# Appends pattern to synthesis-exclusions.json with version, axis, and timestamp
#
# Args:
#   version  - Version string (e.g., "1.0", "2.0")
#   pattern  - Pattern to exclude (text/description of synthesis approach)
#   axis     - Evolution axis (phenomenological_depth, structural_critique, autonomy_preservation)
#
# Returns:
#   0 on success, 1 on failure
##############################################################################
add_synthesis_exclusion() {
    local version="$1"
    local pattern="$2"
    local axis="$3"

    if [ -z "$version" ] || [ -z "$pattern" ] || [ -z "$axis" ]; then
        log "ERROR" "add_synthesis_exclusion requires: version, pattern, axis"
        return 1
    fi

    # GAP 5: Validate axis
    if ! _validate_axis "$axis"; then
        log "ERROR" "Invalid axis: $axis (must be one of: ${VALID_AXES[*]})"
        return 1
    fi

    _ensure_exclusions_file

    if ! _validate_json "$EXCLUSIONS_FILE"; then
        log "ERROR" "Cannot validate exclusions file"
        return 1
    fi

    local timestamp
    timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    # Add exclusion entry
    local temp_file
    temp_file=$(mktemp)

    if ! jq \
        --arg version "$version" \
        --arg pattern "$pattern" \
        --arg axis "$axis" \
        --arg timestamp "$timestamp" \
        '.exclusions += [{version: $version, pattern: $pattern, axis: $axis, created_at: $timestamp}] | .exclusion_count = (.exclusions | length)' \
        "$EXCLUSIONS_FILE" > "$temp_file" 2>/dev/null; then
        log "ERROR" "Failed to add exclusion entry to JSON"
        rm -f "$temp_file"
        return 1
    fi

    if ! mv "$temp_file" "$EXCLUSIONS_FILE"; then
        log "ERROR" "Failed to write exclusions file"
        rm -f "$temp_file"
        return 1
    fi

    log "INFO" "Added exclusion: version=$version, axis=$axis, pattern=${pattern:0:50}..."
    return 0
}

##############################################################################
# Get Exclusions for Axis
# Retrieves last 20 patterns for given evolution axis
# GAP 2: Output format changed to raw pattern strings
#
# Args:
#   axis - Evolution axis to filter by
#
# Returns:
#   Pattern text (one per line), or empty if none found
##############################################################################
get_exclusions_for_axis() {
    local axis="$1"

    if [ -z "$axis" ]; then
        log "ERROR" "get_exclusions_for_axis requires: axis"
        return 1
    fi

    # Validate axis
    if ! _validate_axis "$axis"; then
        log "ERROR" "Invalid axis: $axis (must be one of: ${VALID_AXES[*]})"
        return 1
    fi

    _ensure_exclusions_file

    if ! _validate_json "$EXCLUSIONS_FILE"; then
        log "ERROR" "Cannot validate exclusions file"
        return 1
    fi

    log "INFO" "Retrieving exclusions for axis: $axis"

    # Filter by axis, return last 20, output only the pattern text
    jq -r \
        --arg axis "$axis" \
        '.exclusions | map(select(.axis == $axis)) | .[-20:] | .[] | .pattern' \
        "$EXCLUSIONS_FILE" 2>/dev/null || return 0

    return 0
}

##############################################################################
# Get All Exclusions
# Returns full exclusion history (with pagination info)
#
# Args:
#   None (reads from exclusions file)
#
# Returns:
#   JSON object with exclusions and pagination metadata
##############################################################################
get_all_exclusions() {
    _ensure_exclusions_file

    if ! _validate_json "$EXCLUSIONS_FILE"; then
        log "ERROR" "Cannot validate exclusions file"
        return 1
    fi

    log "INFO" "Retrieving all exclusions"

    # Return full exclusion history with metadata
    jq \
        '{
            total: (.exclusions | length),
            exclusions: .exclusions,
            initialized: .initialized,
            last_prune: .last_prune
        }' \
        "$EXCLUSIONS_FILE" 2>/dev/null || echo "{\"total\": 0, \"exclusions\": [], \"initialized\": null, \"last_prune\": null}"

    return 0
}

##############################################################################
# Get Exclusions Grouped by Axis
# Groups all exclusions by their evolution axis
#
# Args:
#   None (reads from exclusions file)
#
# Returns:
#   JSON object with exclusions grouped by axis
##############################################################################
get_exclusions_by_axis() {
    _ensure_exclusions_file

    if ! _validate_json "$EXCLUSIONS_FILE"; then
        log "ERROR" "Cannot validate exclusions file"
        return 1
    fi

    log "INFO" "Retrieving exclusions grouped by axis"

    # Group exclusions by axis - map each valid axis using jq
    local result
    result=$(jq '{
        phenomenological_depth: (
            .exclusions | map(select(.axis == "phenomenological_depth"))
        ),
        structural_critique: (
            .exclusions | map(select(.axis == "structural_critique"))
        ),
        autonomy_preservation: (
            .exclusions | map(select(.axis == "autonomy_preservation"))
        )
    }' "$EXCLUSIONS_FILE" 2>/dev/null)

    if [ -z "$result" ] || [ "$result" = "null" ]; then
        echo '{"phenomenological_depth": [], "structural_critique": [],
              "autonomy_preservation": []}'
    else
        echo "$result"
    fi

    return 0
}

##############################################################################
# Prune Old Exclusions
# Removes exclusions older than specified number of days
# GAP 4: Updates last_prune field
#
# Args:
#   days_threshold - Number of days to keep (remove older than this)
#
# Returns:
#   0 on success, 1 on failure
##############################################################################
prune_old_exclusions() {
    local days_threshold="${1:-90}"

    if ! [[ "$days_threshold" =~ ^[0-9]+$ ]]; then
        log "ERROR" "days_threshold must be a number (got: $days_threshold)"
        return 1
    fi

    _ensure_exclusions_file

    if ! _validate_json "$EXCLUSIONS_FILE"; then
        log "ERROR" "Cannot validate exclusions file"
        return 1
    fi

    log "INFO" "Pruning exclusions older than $days_threshold days"

    # Calculate cutoff date (compatible with GNU and BSD date)
    local cutoff_date
    if date -d "1 day ago" >/dev/null 2>&1; then
        # GNU date syntax
        cutoff_date=$(date -u -d "${days_threshold} days ago" \
            '+%Y-%m-%dT%H:%M:%SZ')
    else
        # BSD/macOS date syntax
        cutoff_date=$(date -u -v-${days_threshold}d \
            '+%Y-%m-%dT%H:%M:%SZ')
    fi

    local before_count
    before_count=$(jq '.exclusions | length' "$EXCLUSIONS_FILE")

    local temp_file
    temp_file=$(mktemp)

    # Current timestamp for last_prune
    local current_time
    current_time=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    if ! jq \
        --arg cutoff "$cutoff_date" \
        --arg prune_time "$current_time" \
        '.exclusions |= map(select(.created_at > $cutoff)) | .exclusion_count = (.exclusions | length) | .last_prune = $prune_time' \
        "$EXCLUSIONS_FILE" > "$temp_file" 2>/dev/null; then
        log "ERROR" "Failed to prune exclusions"
        rm -f "$temp_file"
        return 1
    fi

    if ! mv "$temp_file" "$EXCLUSIONS_FILE"; then
        log "ERROR" "Failed to write pruned exclusions file"
        rm -f "$temp_file"
        return 1
    fi

    local after_count
    after_count=$(jq '.exclusions | length' "$EXCLUSIONS_FILE")
    local removed=$((before_count - after_count))

    log "INFO" "Pruning complete: removed $removed exclusions (was $before_count, now $after_count)"
    return 0
}

##############################################################################
# Main entry point - allows running functions from command line
# GAP 3: Abbreviated command dispatcher
##############################################################################
main() {
    local command="${1:-}"

    if [ -z "$command" ]; then
        log "ERROR" "Usage: noosphere-synthesis-tracker.sh <command> [args...]"
        log "ERROR" "Commands:"
        log "ERROR" "  add <version> <pattern> <axis> - Add synthesis exclusion"
        log "ERROR" "  get <axis>                      - Get exclusions for axis"
        log "ERROR" "  all                             - Get all exclusions"
        log "ERROR" "  count                           - Get exclusions grouped by axis"
        log "ERROR" "  prune [days]                    - Prune exclusions older than days"
        return 1
    fi

    # Shift to get remaining arguments
    shift

    # Dispatch abbreviated commands to full function names
    case "$command" in
        add)
            add_synthesis_exclusion "$@"
            ;;
        get)
            get_exclusions_for_axis "$@"
            ;;
        all)
            get_all_exclusions "$@"
            ;;
        count)
            get_exclusions_by_axis "$@"
            ;;
        prune)
            prune_old_exclusions "$@"
            ;;
        *)
            log "ERROR" "Unknown command: $command"
            return 1
            ;;
    esac
}

# Export functions for use in other scripts
export -f add_synthesis_exclusion
export -f get_exclusions_for_axis
export -f get_all_exclusions
export -f get_exclusions_by_axis
export -f prune_old_exclusions
export -f log

# Run main if not sourced
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
