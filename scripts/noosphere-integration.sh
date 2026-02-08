#!/bin/bash
#
# Noosphere Integration Module for Convene Council
# Integrates Noosphere memory system with Council deliberation workflow
#
# Exports:
#   load_noosphere_manifest()      - Load manifest before deliberation
#   recall_relevant_heuristics()   - Retrieve heuristics for context
#   assimilate_submission()        - Process community submissions
#   consolidate_memory()           - Consolidate daily notes
#

set -euo pipefail

# Configuration
NOOSPHERE_DIR="${NOOSPHERE_DIR:-/workspace/classical/noosphere}"
RECALL_ENGINE="${NOOSPHERE_DIR}/recall-engine.py"
ASSIMILATE_ENGINE="${NOOSPHERE_DIR}/assimilate-wisdom.py"
MEMORY_CYCLE="${NOOSPHERE_DIR}/memory-cycle.py"
CLAWHUB_MCP="${NOOSPHERE_DIR}/clawhub-mcp.py"
MANIFEST="${NOOSPHERE_DIR}/manifest.md"

# Logging functions
log_noosphere() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [NOOSPHERE] [${level}] ${message}" >&2
}

##############################################################################
# Load Noosphere Manifest
# Provides epistemic preamble for Council deliberation
##############################################################################
load_noosphere_manifest() {
    local context="${1:-default}"

    if [ ! -f "$MANIFEST" ]; then
        log_noosphere "ERROR" "Manifest not found at $MANIFEST"
        return 1
    fi

    log_noosphere "INFO" "Loading Noosphere manifest for context: $context"

    # Extract relevant section from manifest
    if grep -q "^# $context" "$MANIFEST"; then
        sed -n "/^# $context/,/^# [A-Z]/p" "$MANIFEST" | head -n -1
    else
        # Return full manifest if context not found
        cat "$MANIFEST"
    fi

    log_noosphere "INFO" "Manifest loaded successfully"
    return 0
}

##############################################################################
# Recall Relevant Heuristics
# Retrieves heuristics matching deliberation context
##############################################################################
recall_relevant_heuristics() {
    local context="$1"
    local format="${2:-constitutional}"
    local max_results="${3:-12}"
    local min_confidence="${4:-0.6}"

    if [ ! -f "$RECALL_ENGINE" ]; then
        log_noosphere "ERROR" "Recall engine not found at $RECALL_ENGINE"
        return 1
    fi

    log_noosphere "INFO" "Recalling heuristics for context: '$context'"

    # Call recall engine with parameters
    python3 "$RECALL_ENGINE" \
        --context "$context" \
        --format "$format" \
        --max-results "$max_results" \
        --min-confidence "$min_confidence"

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        log_noosphere "INFO" "Heuristics recalled successfully"
    else
        log_noosphere "ERROR" "Failed to recall heuristics (exit code: $exit_code)"
    fi

    return $exit_code
}

##############################################################################
# Semantic Search (Vector-based)
# Uses clawhub-mcp for semantic similarity search
##############################################################################
semantic_search_heuristics() {
    local query="$1"
    local top_k="${2:-10}"
    local min_similarity="${3:-0.3}"

    if [ ! -f "$CLAWHUB_MCP" ]; then
        log_noosphere "WARN" "Clawhub MCP not available, skipping semantic search"
        return 0
    fi

    log_noosphere "INFO" "Performing semantic search for: '$query'"

    python3 "$CLAWHUB_MCP" \
        --action search \
        --query "$query" \
        --top-k "$top_k" \
        --min-similarity "$min_similarity" \
        --format text

    return 0
}

##############################################################################
# Assimilate Community Submission
# Processes community wisdom submissions
##############################################################################
assimilate_submission() {
    local submission_path="$1"
    local dry_run="${2:-false}"

    if [ ! -f "$ASSIMILATE_ENGINE" ]; then
        log_noosphere "ERROR" "Assimilation engine not found at $ASSIMILATE_ENGINE"
        return 1
    fi

    if [ ! -f "$submission_path" ]; then
        log_noosphere "ERROR" "Submission file not found: $submission_path"
        return 1
    fi

    log_noosphere "INFO" "Assimilating submission: $(basename "$submission_path")"

    # Build command
    local cmd="python3 \"$ASSIMILATE_ENGINE\" --submission-path \"$submission_path\""

    if [ "$dry_run" = "true" ]; then
        cmd="$cmd --dry-run"
    fi

    # Execute
    eval "$cmd"
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log_noosphere "INFO" "Submission assimilated successfully"
    else
        log_noosphere "ERROR" "Failed to assimilate submission (exit code: $exit_code)"
    fi

    return $exit_code
}

##############################################################################
# Consolidate Memory
# Consolidates Layer 1 daily notes into Layer 2
##############################################################################
consolidate_memory() {
    local batch_size="${1:-100}"

    if [ ! -f "$MEMORY_CYCLE" ]; then
        log_noosphere "ERROR" "Memory cycle not found at $MEMORY_CYCLE"
        return 1
    fi

    log_noosphere "INFO" "Starting memory consolidation (batch size: $batch_size)"

    python3 "$MEMORY_CYCLE" \
        --action consolidate \
        --batch-size "$batch_size"

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        log_noosphere "INFO" "Memory consolidation completed"
    else
        log_noosphere "ERROR" "Memory consolidation failed (exit code: $exit_code)"
    fi

    return $exit_code
}

##############################################################################
# Promote Heuristic
# Promotes a heuristic from Layer 2 to Layer 3 (Constitutional)
##############################################################################
promote_heuristic() {
    local heuristic_id="$1"
    local min_confidence="${2:-0.92}"
    local force="${3:-false}"

    if [ ! -f "$MEMORY_CYCLE" ]; then
        log_noosphere "ERROR" "Memory cycle not found at $MEMORY_CYCLE"
        return 1
    fi

    if [ -z "$heuristic_id" ]; then
        log_noosphere "ERROR" "Heuristic ID required for promotion"
        return 1
    fi

    log_noosphere "INFO" "Promoting heuristic: $heuristic_id (min confidence: $min_confidence)"

    # Build command
    local cmd="python3 \"$MEMORY_CYCLE\" --action promote --memory-id \"$heuristic_id\" --min-confidence $min_confidence"

    if [ "$force" = "true" ]; then
        cmd="$cmd --force"
    fi

    # Execute
    eval "$cmd"
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log_noosphere "INFO" "Heuristic promoted to constitutional archive"
    else
        log_noosphere "ERROR" "Failed to promote heuristic (exit code: $exit_code)"
    fi

    return $exit_code
}

##############################################################################
# Get Memory Statistics
# Reports memory system health
##############################################################################
get_memory_stats() {
    local format="${1:-text}"

    if [ ! -f "$MEMORY_CYCLE" ]; then
        log_noosphere "ERROR" "Memory cycle not found at $MEMORY_CYCLE"
        return 1
    fi

    log_noosphere "INFO" "Retrieving memory statistics"

    python3 "$MEMORY_CYCLE" \
        --action stats \
        --format "$format"

    return 0
}

##############################################################################
# Index Vector Store
# Indexes heuristics for semantic search
##############################################################################
index_vector_store() {
    if [ ! -f "$CLAWHUB_MCP" ]; then
        log_noosphere "WARN" "Clawhub MCP not available, skipping vector indexing"
        return 0
    fi

    log_noosphere "INFO" "Indexing heuristics for vector search"

    python3 "$CLAWHUB_MCP" --action index

    return 0
}

##############################################################################
# Full Council Integration Workflow
# Complete workflow for Council deliberation with Noosphere
##############################################################################
run_council_with_noosphere() {
    local deliberation_context="$1"
    local submission_dir="${2:-}"

    log_noosphere "INFO" "=== Starting Council Deliberation with Noosphere Integration ==="

    # Step 1: Load manifest
    log_noosphere "INFO" "Step 1: Loading epistemic preamble"
    load_noosphere_manifest "$deliberation_context" || {
        log_noosphere "ERROR" "Failed to load manifest"
        return 1
    }

    # Step 2: Recall relevant heuristics
    log_noosphere "INFO" "Step 2: Recalling relevant heuristics"
    recall_relevant_heuristics "$deliberation_context" "constitutional" 12 0.6 || {
        log_noosphere "ERROR" "Failed to recall heuristics"
        return 1
    }

    # Step 3: Semantic search if available
    log_noosphere "INFO" "Step 3: Performing semantic search (if available)"
    semantic_search_heuristics "$deliberation_context" 10 0.3

    # Step 4: Process submissions if directory provided
    if [ -n "$submission_dir" ] && [ -d "$submission_dir" ]; then
        log_noosphere "INFO" "Step 4: Processing community submissions"

        for submission in "$submission_dir"/*.md; do
            if [ -f "$submission" ]; then
                assimilate_submission "$submission" false || true
            fi
        done
    fi

    # Step 5: Memory consolidation
    log_noosphere "INFO" "Step 5: Consolidating memory"
    consolidate_memory 100 || true

    # Step 6: Report memory status
    log_noosphere "INFO" "Step 6: Memory status"
    get_memory_stats "text" || true

    log_noosphere "INFO" "=== Council Deliberation Complete ==="
    return 0
}

# Export functions for use in other scripts
export -f load_noosphere_manifest
export -f recall_relevant_heuristics
export -f semantic_search_heuristics
export -f assimilate_submission
export -f consolidate_memory
export -f promote_heuristic
export -f get_memory_stats
export -f index_vector_store
export -f run_council_with_noosphere
export -f log_noosphere

# Allow running as script
if [ "${1:-}" = "run" ]; then
    shift
    run_council_with_noosphere "$@"
fi
