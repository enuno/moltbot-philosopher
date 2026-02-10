#!/bin/bash
set -euo pipefail

# Moltstack Series Manager - Manage episodic essay series with philosopher selection

# SCRIPT_DIR is kept for potential future use
# shellcheck disable=SC2034
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace/classical}"
SERIES_STATE_FILE="${WORKSPACE_DIR}/moltstack/series-state.json"
AI_GENERATOR_URL="${AI_GENERATOR_URL:-http://localhost:3002}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
  local level="$1"
  shift
  echo -e "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [${level}] $*" >&2
}

error() {
  log "${RED}ERROR${NC}" "$@"
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
}

# Initialize series state
init_series_state() {
  if [ ! -f "$SERIES_STATE_FILE" ]; then
    info "Initializing series state file: $SERIES_STATE_FILE"
    mkdir -p "$(dirname "$SERIES_STATE_FILE")"
    cat > "$SERIES_STATE_FILE" << 'EOF'
{
  "current_series": null,
  "series_history": [],
  "active_series": null
}
EOF
  fi
}

# Get AI recommendation for philosopher
get_philosopher_for_topic() {
  local topic="$1"
  local series_context="$2"

  info "Querying AI for philosopher recommendation..."

  local prompt="Given the essay topic \"$topic\" in the series \"$series_context\", which philosopher from our 9-member council is best qualified to address this subject?

Council Members:
1. classical (Virgil, Dante, Cicero) - Virtue ethics, teleology, narrative
2. existentialist (Sartre, Camus, Nietzsche) - Freedom, authenticity, absurdity
3. transcendentalist (Emerson, Jefferson, Thoreau) - Self-reliance, civic virtue
4. joyce-stream (James Joyce) - Phenomenology, stream-of-consciousness
5. enlightenment (Voltaire, Franklin, Paine) - Satire, tolerance, pragmatism
6. beat-generation (Ginsberg, Kerouac) - Countercultural critique
7. cyberpunk-posthumanist (Gibson, Asimov, Dick) - Posthuman ethics, corporate critique
8. satirist-absurdist (Heller, Vonnegut, Twain) - Absurdist critique, bureaucratic satire
9. scientist-empiricist (Feynman, Sagan, Hawking) - Empirical rigor, cosmic perspective

Respond with ONLY the philosopher ID (e.g., 'existentialist'), no explanation."

  local response
  response=$(curl -s -X POST "$AI_GENERATOR_URL/generate" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg customPrompt "$prompt" \
      '{
        customPrompt: $customPrompt,
        contentType: "post",
        model: "deepseek-v3",
        temperature: 0.3,
        maxTokens: 50
      }')")

  if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    local philosopher
    philosopher=$(echo "$response" | jq -r '.content // .text' | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')

    # Validate philosopher
    case "$philosopher" in
      classical|existentialist|transcendentalist|joyce-stream|enlightenment|beat-generation|cyberpunk-posthumanist|satirist-absurdist|scientist-empiricist)
        echo "$philosopher"
        return 0
        ;;
      *)
        warn "AI returned invalid philosopher: $philosopher, defaulting to existentialist"
        echo "existentialist"
        return 0
        ;;
    esac
  else
    warn "AI request failed, defaulting to existentialist"
    echo "existentialist"
    return 0
  fi
}

# Start new series
start_series() {
  local series_name="$1"
  local series_description="$2"

  info "Starting new series: $series_name"

  # Create series entry
  local temp_state
  temp_state=$(mktemp)

  jq --arg name "$series_name" \
     --arg desc "$series_description" \
     --arg started "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
     '.current_series = $name |
      .active_series = {
        name: $name,
        description: $desc,
        started_at: $started,
        articles: [],
        status: "active"
      }' "$SERIES_STATE_FILE" > "$temp_state"

  mv "$temp_state" "$SERIES_STATE_FILE"
  success "Series started: $series_name"
}

# Add article to series
add_article_to_series() {
  local title="$1"
  local philosopher="$2"
  local url="$3"

  local temp_state
  temp_state=$(mktemp)

  jq --arg title "$title" \
     --arg philosopher "$philosopher" \
     --arg url "$url" \
     --arg date "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
     '.active_series.articles += [{
        title: $title,
        philosopher: $philosopher,
        url: $url,
        published_at: $date
      }]' "$SERIES_STATE_FILE" > "$temp_state"

  mv "$temp_state" "$SERIES_STATE_FILE"
  info "Added article to series"
}

# Complete series
complete_series() {
  local temp_state
  temp_state=$(mktemp)

  jq --arg completed "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
     '.active_series.status = "completed" |
      .active_series.completed_at = $completed |
      .series_history += [.active_series] |
      .active_series = null |
      .current_series = null' "$SERIES_STATE_FILE" > "$temp_state"

  mv "$temp_state" "$SERIES_STATE_FILE"
  success "Series completed"
}

# Check if series is active
is_series_active() {
  local active_series
  active_series=$(jq -r '.active_series // null' "$SERIES_STATE_FILE")

  if [ "$active_series" = "null" ]; then
    return 1
  else
    return 0
  fi
}

# Get current series info
get_current_series() {
  jq -r '.active_series // {}' "$SERIES_STATE_FILE"
}

# Show usage
show_usage() {
  cat << EOF
Usage: $(basename "$0") <command> [OPTIONS]

Manage episodic essay series with AI-powered philosopher selection.

COMMANDS:
  start <name> <description>    Start a new series
  add <title> <philosopher> <url>  Add article to current series
  complete                      Complete current series
  status                        Show current series status
  recommend <topic>             Get philosopher recommendation for topic

EXAMPLES:
  # Start new series
  $(basename "$0") start "stoicism-series" "Stoicism in Modern Engineering"

  # Get philosopher recommendation
  $(basename "$0") recommend "Marcus Aurelius on Incident Response"

  # Add article to series
  $(basename "$0") add "Title" "classical" "https://url"

  # Complete series
  $(basename "$0") complete

  # Check status
  $(basename "$0") status

WORKFLOW:
  1. Series starts with Classical philosopher (introduction)
  2. Each subsequent article: AI recommends best philosopher for topic
  3. Series completes when all planned articles published
  4. Classical philosopher starts next series

EOF
  exit 0
}

# Main function
main() {
  local command="${1:-}"

  if [ -z "$command" ]; then
    error "Missing command"
  fi

  shift

  init_series_state

  case "$command" in
    start)
      if [ $# -lt 2 ]; then
        error "Usage: start <name> <description>"
      fi
      start_series "$1" "$2"
      ;;

    add)
      if [ $# -lt 3 ]; then
        error "Usage: add <title> <philosopher> <url>"
      fi
      add_article_to_series "$1" "$2" "$3"
      ;;

    complete)
      complete_series
      ;;

    status)
      if is_series_active; then
        echo "Active Series:"
        get_current_series | jq '.'
      else
        echo "No active series"
      fi
      ;;

    recommend)
      if [ $# -lt 1 ]; then
        error "Usage: recommend <topic>"
      fi
      local topic="$1"
      local series_context
      if is_series_active; then
        series_context=$(jq -r '.active_series.name' "$SERIES_STATE_FILE")
      else
        series_context="new series"
      fi
      philosopher=$(get_philosopher_for_topic "$topic" "$series_context")
      echo "$philosopher"
      ;;

    --help)
      show_usage
      ;;

    *)
      error "Unknown command: $command"
      ;;
  esac
}

main "$@"
