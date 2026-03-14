#!/bin/bash

# Daily Polemic Heartbeat - Orchestrates daily content pipeline
# Integrates semantic discovery with 30-minute non-blocking execution
#
# Usage: bash scripts/daily-polemic-heartbeat.sh [--dry-run] [--skip-discovery]
#
# Environment Variables:
#   WORKSPACE_DIR              - Workspace directory (default: ./workspace)
#   DISCOVERY_INTERVAL_SECONDS - Discovery execution interval (default: 1800 = 30 minutes)
#   ACTION_QUEUE_URL          - Action queue service URL (default: http://localhost:3010/queue)

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

WORKSPACE_DIR="${WORKSPACE_DIR:-.}/workspace"
DISCOVERY_INTERVAL_SECONDS="${DISCOVERY_INTERVAL_SECONDS:-1800}"
ACTION_QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3010/queue}"
HEARTBEAT_STATE_FILE="${WORKSPACE_DIR}/heartbeat-state.json"
DISCOVERY_SCRIPT="./scripts/discover-relevant-threads.sh"
DISCOVERY_LOG_FILE="${WORKSPACE_DIR}/discovery/discovery.log"
DISCOVERY_LOCK_FILE="${WORKSPACE_DIR}/.discovery-lock"

# Global exit status for error tracking
HEARTBEAT_EXIT_STATUS=0

# ============================================================================
# Logging
# ============================================================================

log() {
  local level="$1"
  shift
  local message="$@"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[${timestamp}] [${level}] ${message}" | tee -a "${DISCOVERY_LOG_FILE}"
}

log_error() {
  log "ERROR" "$@" >&2
}

log_info() {
  log "INFO" "$@"
}

log_debug() {
  if [[ "${DEBUG:-0}" == "1" ]]; then
    log "DEBUG" "$@"
  fi
}

# ============================================================================
# State Management
# ============================================================================

# Initialize or load heartbeat state
initialize_heartbeat_state() {
  if [[ ! -f "$HEARTBEAT_STATE_FILE" ]]; then
    mkdir -p "$(dirname "$HEARTBEAT_STATE_FILE")"
    cat > "$HEARTBEAT_STATE_FILE" <<EOF
{
  "lastDiscoveryTime": 0,
  "lastPolemicTime": 0,
  "discoveryCount": 0,
  "errors": [],
  "created": $(date +%s%N)
}
EOF
    log_debug "Initialized heartbeat state file: $HEARTBEAT_STATE_FILE"
  fi
}

# Load heartbeat state and return JSON
load_heartbeat_state() {
  if [[ -f "$HEARTBEAT_STATE_FILE" ]]; then
    cat "$HEARTBEAT_STATE_FILE"
  else
    echo '{"lastDiscoveryTime": 0, "discoveryCount": 0}'
  fi
}

# Update heartbeat state with new values
update_heartbeat_state() {
  local key="$1"
  local value="$2"

  initialize_heartbeat_state

  local state
  state=$(load_heartbeat_state)

  # Use jq to update (safely handles JSON)
  state=$(echo "$state" | jq --arg k "$key" --argjson v "$value" '.[$k] = $v | .updated = ('$(date +%s%N)')')

  mkdir -p "$(dirname "$HEARTBEAT_STATE_FILE")"
  echo "$state" | jq . > "$HEARTBEAT_STATE_FILE"
}

# ============================================================================
# Discovery Orchestration
# ============================================================================

# Check if discovery should run based on interval
should_run_discovery() {
  local state
  state=$(load_heartbeat_state)
  local lastDiscoveryTime
  lastDiscoveryTime=$(echo "$state" | jq -r '.lastDiscoveryTime // 0')

  local currentTime
  currentTime=$(date +%s)
  local elapsed=$((currentTime - lastDiscoveryTime))

  if [[ $elapsed -ge "$DISCOVERY_INTERVAL_SECONDS" ]]; then
    log_info "Discovery interval met (${elapsed}s >= ${DISCOVERY_INTERVAL_SECONDS}s)"
    return 0
  else
    log_debug "Discovery interval not met (${elapsed}s < ${DISCOVERY_INTERVAL_SECONDS}s)"
    return 1
  fi
}

# Execute discovery in non-blocking background process with timeout
execute_discovery_nonblocking() {
  log_info "Starting semantic discovery (non-blocking, timeout 30s)"

  # Create discovery directory if needed
  mkdir -p "$(dirname "$DISCOVERY_LOG_FILE")"

  # Background process with timeout and error handling
  {
    timeout 30s bash "$DISCOVERY_SCRIPT" --dry-run \
      2>>"${DISCOVERY_LOG_FILE}" | while read -r line; do
        echo "$line" >> "${DISCOVERY_LOG_FILE}"
      done

    # Capture exit code
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
      log_info "Discovery completed successfully"

      # Parse results and queue posts
      queue_discovered_posts

      # Update discovery metrics
      update_heartbeat_state "lastDiscoveryTime" "$(date +%s)"
      update_heartbeat_state "discoveryCount" "$(get_discovery_count)"
    elif [[ $exit_code -eq 124 ]]; then
      log_error "Discovery timed out after 30 seconds"
      # Don't update state on timeout; next cycle will retry
    else
      log_error "Discovery failed with exit code $exit_code"
      # Don't update state on failure; next cycle will retry
    fi
  } & # Run in background

  # Don't wait for background process; heartbeat continues
  log_debug "Discovery process started in background (PID: $!)"
}

# Queue discovered posts to action-queue service
queue_discovered_posts() {
  log_debug "Queueing discovered posts to action-queue"

  # This would integrate with actual Noosphere results
  # For now, it's a placeholder that validates the integration point
  # In production, would parse discover-relevant-threads.sh output and POST to action-queue

  # Example integration (when discover-relevant-threads.sh returns JSON):
  # local results
  # results=$(bash "$DISCOVERY_SCRIPT" --dry-run --limit 5)
  # echo "$results" | jq -c '.posts[]' | while read -r post; do
  #   curl -X POST "$ACTION_QUEUE_URL" \
  #     -H "Content-Type: application/json" \
  #     -d "{\"type\": \"discovered_post\", \"payload\": $post}" \
  #     2>>"${DISCOVERY_LOG_FILE}" || true
  # done

  log_debug "Post queueing integration point ready for Noosphere results"
}

# Get total discovery count from current cycle
get_discovery_count() {
  local state
  state=$(load_heartbeat_state)
  echo "$state" | jq -r '.discoveryCount // 0'
}

# ============================================================================
# Main Heartbeat Logic
# ============================================================================

main() {
  local dry_run=0
  local skip_discovery=0

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        dry_run=1
        ;;
      --skip-discovery)
        skip_discovery=1
        ;;
      *)
        log_error "Unknown argument: $1"
        exit 1
        ;;
    esac
    shift
  done

  log_info "=== Daily Polemic Heartbeat Starting ==="
  log_debug "Workspace: $WORKSPACE_DIR"
  log_debug "Discovery Interval: ${DISCOVERY_INTERVAL_SECONDS}s"
  log_debug "Dry Run: $dry_run | Skip Discovery: $skip_discovery"

  # Initialize state
  initialize_heartbeat_state
  local state
  state=$(load_heartbeat_state)
  log_debug "Loaded state: $state"

  # Execute discovery if interval met and not skipped
  if [[ $skip_discovery -eq 0 ]] && should_run_discovery; then
    if [[ $dry_run -eq 1 ]]; then
      log_info "[DRY-RUN] Would execute discovery now"
      # Simulate discovery update for testing
      update_heartbeat_state "lastDiscoveryTime" "$(date +%s)" || true
      update_heartbeat_state "discoveryCount" "0" || true
    else
      execute_discovery_nonblocking || true # Non-fatal
    fi
  elif [[ $skip_discovery -eq 1 ]]; then
    log_info "Discovery skipped (--skip-discovery)"
  else
    log_info "Discovery skipped (interval not met)"
  fi

  # Update heartbeat timestamp
  update_heartbeat_state "lastPolemicTime" "$(date +%s)" || true

  # Log final state
  state=$(load_heartbeat_state)
  log_info "=== Daily Polemic Heartbeat Complete ==="
  log_debug "Final state: $state"

  return $HEARTBEAT_EXIT_STATUS
}

# ============================================================================
# Entry Point
# ============================================================================

main "$@"
exit $?
