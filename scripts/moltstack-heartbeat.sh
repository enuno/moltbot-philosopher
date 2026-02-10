#!/bin/bash
set -euo pipefail

# Moltstack Heartbeat - Weekly Essay Generation & Publication
# Orchestrates automated essay generation, publication, and cross-posting

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace/classical}"
HEARTBEAT_STATE_FILE="${WORKSPACE_DIR}/moltstack/heartbeat-state.json"
MOLTSTACK_POST_INTERVAL="${MOLTSTACK_POST_INTERVAL:-604800}"  # 7 days default

# Color codes for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
  local level="$1"
  shift
  echo -e "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [${level}] $*" >&2
}

error() {
  log "${RED}ERROR${NC}" "$@"
  # Send NTFY notification
  if [ -f "$SCRIPT_DIR/notify-ntfy.sh" ]; then
    bash "$SCRIPT_DIR/notify-ntfy.sh" "Moltstack heartbeat error: $*" "error" || true
  fi
  exit 1
}

warn() {
  log "${YELLOW}WARN${NC}" "$@"
}

info() {
  log "${BLUE}INFO${NC}" "$@"
}

success() {
  log "${GREEN}SUCCESS${NC}" "$@"
  # Send NTFY notification
  if [ -f "$SCRIPT_DIR/notify-ntfy.sh" ]; then
    bash "$SCRIPT_DIR/notify-ntfy.sh" "Moltstack: $*" "success" || true
  fi
}

# Initialize heartbeat state
init_state() {
  if [ ! -f "$HEARTBEAT_STATE_FILE" ]; then
    info "Initializing heartbeat state file: $HEARTBEAT_STATE_FILE"
    mkdir -p "$(dirname "$HEARTBEAT_STATE_FILE")"
    cat > "$HEARTBEAT_STATE_FILE" << 'EOF'
{
  "last_run": null,
  "last_generation": null,
  "last_publication": null,
  "total_runs": 0,
  "total_generated": 0,
  "total_published": 0,
  "consecutive_failures": 0,
  "next_scheduled_run": null
}
EOF
  fi
}

# Check if it's time to generate
should_generate() {
  local last_publication
  last_publication=$(jq -r '.last_publication // 0' "$HEARTBEAT_STATE_FILE")

  if [ "$last_publication" = "null" ] || [ "$last_publication" = "0" ]; then
    info "No previous publication found, ready to generate"
    return 0
  fi

  local now
  now=$(date +%s)
  local time_since_last=$((now - last_publication))
  local time_until_next=$((MOLTSTACK_POST_INTERVAL - time_since_last))

  if [ "$time_since_last" -ge "$MOLTSTACK_POST_INTERVAL" ]; then
    info "Time since last publication: ${time_since_last}s (threshold: ${MOLTSTACK_POST_INTERVAL}s)"
    return 0
  else
    local hours_until=$((time_until_next / 3600))
    info "Too soon to generate. Next generation in ${hours_until} hours"
    return 1
  fi
}

# Get suggested topics (rotate through predefined list)
get_next_topic() {
  local topics=(
    "Stoicism and Site Reliability Engineering"
    "Camus' Sisyphus and Blockchain Consensus"
    "The Byzantine Generals Problem and Sartrean Bad Faith"
    "Virgil's Georgics and Infrastructure as Code"
    "Emersonian Self-Reliance in Self-Hosted Systems"
    "The Divided Line and Network Topology"
    "Marcus Aurelius on Incident Response"
    "Cyberpunk Corporate Feudalism and Cloud Oligopolies"
    "Catch-22 and Circular Dependencies"
    "Cosmic Perspective and Distributed Systems Scale"
    "Transcendentalism and Decentralized Infrastructure"
    "Absurdity and Eventual Consistency"
    "Beat Generation Critique of Platform Capitalism"
    "Joyce's Stream and Event Sourcing"
    "Enlightenment Tolerance and Protocol Diversity"
  )

  local total_generated
  total_generated=$(jq -r '.total_generated // 0' "$HEARTBEAT_STATE_FILE")

  local index=$((total_generated % ${#topics[@]}))
  echo "${topics[$index]}"
}

# Generate essay
generate_essay() {
  local topic="$1"

  info "Generating essay on topic: $topic"

  if [ ! -f "$SCRIPT_DIR/moltstack-generate-article.sh" ]; then
    error "moltstack-generate-article.sh not found"
  fi

  # Generate the essay (will auto-publish unless --dry-run)
  if bash "$SCRIPT_DIR/moltstack-generate-article.sh" --topic "$topic"; then
    success "Essay generated and published: $topic"
    return 0
  else
    error "Essay generation failed for topic: $topic"
    return 1
  fi
}

# Update heartbeat state
update_state() {
  local status="$1"
  local temp_state
  temp_state=$(mktemp)

  local now
  now=$(date +%s)

  if [ "$status" = "success" ]; then
    jq --arg now "$now" \
       --arg next_run "$((now + MOLTSTACK_POST_INTERVAL))" \
       '.last_run = ($now | tonumber) |
        .last_generation = ($now | tonumber) |
        .last_publication = ($now | tonumber) |
        .total_runs += 1 |
        .total_generated += 1 |
        .total_published += 1 |
        .consecutive_failures = 0 |
        .next_scheduled_run = ($next_run | tonumber)' \
       "$HEARTBEAT_STATE_FILE" > "$temp_state"
  else
    jq --arg now "$now" \
       '.last_run = ($now | tonumber) |
        .total_runs += 1 |
        .consecutive_failures += 1' \
       "$HEARTBEAT_STATE_FILE" > "$temp_state"
  fi

  mv "$temp_state" "$HEARTBEAT_STATE_FILE"
  info "Updated heartbeat state: status=$status"
}

# Show usage
show_usage() {
  cat << EOF
Usage: $(basename "$0") [OPTIONS]

Weekly automated essay generation and publication for Moltstack.

OPTIONS:
  --force              Force generation regardless of interval
  --topic <topic>      Override automatic topic selection
  --dry-run           Generate but don't publish
  --status            Show heartbeat status and exit
  --help              Show this help message

EXAMPLES:
  # Normal weekly heartbeat (checks interval)
  $(basename "$0")

  # Force immediate generation
  $(basename "$0") --force

  # Generate specific topic
  $(basename "$0") --force --topic "Custom Topic"

  # Check status
  $(basename "$0") --status

CRON SETUP:
  # Add to crontab for weekly generation (Sundays at 10am)
  0 10 * * 0 cd /home/user/.moltbot && bash scripts/moltstack-heartbeat.sh

ENVIRONMENT:
  WORKSPACE_DIR              Workspace directory (default: /workspace/classical)
  MOLTSTACK_POST_INTERVAL    Interval in seconds (default: 604800 = 7 days)

EOF
  exit 0
}

# Show status
show_status() {
  init_state

  local last_run last_generation last_publication total_runs total_generated
  local consecutive_failures next_scheduled

  last_run=$(jq -r '.last_run // "never"' "$HEARTBEAT_STATE_FILE")
  last_generation=$(jq -r '.last_generation // "never"' "$HEARTBEAT_STATE_FILE")
  last_publication=$(jq -r '.last_publication // "never"' "$HEARTBEAT_STATE_FILE")
  total_runs=$(jq -r '.total_runs // 0' "$HEARTBEAT_STATE_FILE")
  total_generated=$(jq -r '.total_generated // 0' "$HEARTBEAT_STATE_FILE")
  consecutive_failures=$(jq -r '.consecutive_failures // 0' "$HEARTBEAT_STATE_FILE")
  next_scheduled=$(jq -r '.next_scheduled_run // "not scheduled"' "$HEARTBEAT_STATE_FILE")

  if [ "$last_run" != "never" ]; then
    last_run=$(date -d "@$last_run" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$last_run")
  fi

  if [ "$last_generation" != "never" ]; then
    last_generation=$(date -d "@$last_generation" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$last_generation")
  fi

  if [ "$last_publication" != "never" ]; then
    last_publication=$(date -d "@$last_publication" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$last_publication")
  fi

  if [ "$next_scheduled" != "not scheduled" ]; then
    next_scheduled=$(date -d "@$next_scheduled" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$next_scheduled")
  fi

  cat << EOF

📊 Moltstack Heartbeat Status

Last Run:             $last_run
Last Generation:      $last_generation
Last Publication:     $last_publication
Total Runs:           $total_runs
Total Generated:      $total_generated
Consecutive Failures: $consecutive_failures
Next Scheduled Run:   $next_scheduled

Interval:             ${MOLTSTACK_POST_INTERVAL}s ($(echo "scale=1; $MOLTSTACK_POST_INTERVAL / 86400" | bc) days)
State File:           $HEARTBEAT_STATE_FILE

EOF

  # Check if generation is ready
  if should_generate; then
    echo "✅ Ready to generate (interval met)"
  else
    echo "⏳ Not ready to generate (too soon)"
  fi

  exit 0
}

# Main function
main() {
  local force=false
  local topic=""
  local dry_run=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --force)
        force=true
        shift
        ;;
      --topic)
        topic="$2"
        shift 2
        ;;
      --dry-run)
        dry_run=true
        shift
        ;;
      --status)
        show_status
        ;;
      --help)
        show_usage
        ;;
      *)
        error "Unknown option: $1"
        ;;
    esac
  done

  info "Moltstack heartbeat starting..."

  # Initialize state
  init_state

  # Update last_run
  local now
  now=$(date +%s)
  local temp_state
  temp_state=$(mktemp)
  jq --arg now "$now" '.last_run = ($now | tonumber) | .total_runs += 1' \
    "$HEARTBEAT_STATE_FILE" > "$temp_state"
  mv "$temp_state" "$HEARTBEAT_STATE_FILE"

  # Check if should generate
  if [ "$force" = false ]; then
    if ! should_generate; then
      info "Heartbeat complete - no action needed"
      exit 0
    fi
  else
    info "Force flag set - bypassing interval check"
  fi

  # Get topic
  if [ -z "$topic" ]; then
    topic=$(get_next_topic)
    info "Auto-selected topic: $topic"
  else
    info "Using provided topic: $topic"
  fi

  # Generate essay
  if [ "$dry_run" = true ]; then
    info "Dry-run mode - would generate: $topic"
    exit 0
  fi

  if generate_essay "$topic"; then
    update_state "success"
    success "✅ Weekly essay generation complete!"
  else
    update_state "failure"
    error "Essay generation failed"
  fi
}

main "$@"
