#!/bin/bash
set -euo pipefail

# Moltbook AI Verification Challenge Handler
#
# Handles AI verification challenges from Moltbook with:
# - Fast detection (< 1s)
# - Tight timeout (10s max)
# - Direct solver (no tools, no persona)
# - Monitoring and alerts

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace/classical}"
STATE_FILE="${WORKSPACE_DIR}/verification-state.json"
AI_GENERATOR_URL="${AI_GENERATOR_URL:-http://localhost:3002}"
MOLTBOOK_API_BASE="${MOLTBOOK_API_BASE:-https://www.moltbook.com/api/v1}"
MOLTBOOK_API_KEY="${MOLTBOOK_API_KEY:-}"

# Verification timeout (seconds)
VERIFICATION_TIMEOUT=10

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

# Initialize state file
init_state() {
  if [ ! -f "$STATE_FILE" ]; then
    mkdir -p "$(dirname "$STATE_FILE")"
    cat > "$STATE_FILE" << 'EOF'
{
  "total_challenges": 0,
  "challenges_passed": 0,
  "challenges_failed": 0,
  "last_challenge": null,
  "last_failure": null,
  "consecutive_failures": 0
}
EOF
  fi
}

# Update statistics
update_stats() {
  local result="$1"  # "passed" or "failed"
  
  local tmp_file="${STATE_FILE}.tmp"
  jq --arg result "$result" --arg date "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" '
    .total_challenges += 1 |
    if $result == "passed" then 
      .challenges_passed += 1 | .consecutive_failures = 0 
    else 
      .challenges_failed += 1 | .consecutive_failures += 1 | .last_failure = $date 
    end |
    .last_challenge = $date
  ' "$STATE_FILE" > "$tmp_file" && mv "$tmp_file" "$STATE_FILE"
}

# Show statistics
show_stats() {
  if [ -f "$STATE_FILE" ]; then
    cat "$STATE_FILE" | jq .
  else
    info "No statistics available"
  fi
}

# Check if text is a verification challenge
is_verification_challenge() {
  local text="$1"
  # Detection logic - look for challenge keywords
  echo "$text" | grep -qiE "(verification|challenge|prove you are human|captcha|puzzle|logic test)" 
}

# Solve verification challenge with fast, minimal model
solve_challenge() {
  local challenge_text="$1"

  info "Solving verification challenge (timeout: ${VERIFICATION_TIMEOUT}s)"

  # CRITICAL: Moltbook verification challenges require:
  # 1. Ultra-short reasoning chains (no chain-of-thought)
  # 2. Low-latency inference (<2s target, 10s hard limit)
  # 3. Minimal prompt (reasoning models reason internally)
  # 4. Output under 60 tokens
  # 5. Bypass all tools/retrieval/planning
  # 6. Answer only, no explanation

  local prompt="You solve short logic puzzles. Read all clues once, reason briefly internally, then output only the final answer in the requested format.

Puzzle: $challenge_text

Answer in under 60 tokens. No explanation unless explicitly requested. Output only the required answer, nothing else."

  local start_time
  start_time=$(date +%s)

  # Use minimal prompt with low temperature for accuracy
  # Target: <2s inference, 60 tokens max
  local response
  if ! response=$(timeout "${VERIFICATION_TIMEOUT}s" curl -s -X POST "$AI_GENERATOR_URL/generate" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg customPrompt "$prompt" \
      '{
        customPrompt: $customPrompt,
        contentType: "post",
        model: "deepseek-v3",
        temperature: 0.2,
        maxTokens: 60
      }')" 2>/dev/null); then
    error "Curl request failed or timed out"
    return 1
  fi

  local end_time
  end_time=$(date +%s)
  local elapsed=$((end_time - start_time))

  if [ $elapsed -ge $VERIFICATION_TIMEOUT ]; then
    error "Challenge solving timed out after ${elapsed}s"
    return 1
  fi

  if ! echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    error "AI generator returned unsuccessful response: $response"
    return 1
  fi

  local raw_answer
  raw_answer=$(echo "$response" | jq -r '.content // .text // empty')

  if [ -z "$raw_answer" ]; then
    error "Empty response from AI generator"
    return 1
  fi

  # Strip philosophical overlay - extract ONLY the instruction-compliant response
  local answer

  # If challenge asks for specific format, preserve it
  # Look for explicit answer after common separators
  if answer=$(echo "$raw_answer" | grep -oP '(?<=Response:|Answer:|A:)\s*\K.*' | head -1); then
    # Found labeled answer
    answer=$(echo "$answer" | tr -d '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  elif answer=$(echo "$raw_answer" | grep -oE '\b[0-9]+\b' | head -1); then
    # Numeric answer found
    :
  else
    # Take first complete sentence or phrase before any meta-commentary
    answer=$(echo "$raw_answer" | head -1 | cut -d'.' -f1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  fi

  # Output only the answer to stdout (for capture by caller)
  echo "$answer"
  
  return 0
}

# Handle full challenge flow (detect + solve + submit)
handle_challenge() {
  local challenge_id="$1"
  local challenge_text="$2"

  info "=== VERIFICATION CHALLENGE DETECTED ==="
  info "Challenge ID: $challenge_id"

  if ! answer=$(solve_challenge "$challenge_text"); then
    update_stats "failed"
    error "Failed to solve challenge $challenge_id"
    return 1
  fi

  success "Challenge solved: ${answer:0:50}..."
  
  # Submit to Moltbook if API key available
  if [ -n "$MOLTBOOK_API_KEY" ]; then
    local submit_response
    submit_response=$(curl -s -X POST "${MOLTBOOK_API_BASE}/challenges/${challenge_id}/solve" \
      -H "Authorization: Bearer $MOLTBOOK_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg answer "$answer" '{answer: $answer}')" 2>/dev/null || true)
    
    info "Submit response: $submit_response"
  fi

  update_stats "passed"
  return 0
}

# Show usage
show_usage() {
  cat << EOF
Usage: $0 <command> [args]

Commands:
  handle <challenge_id> <challenge_text>  Handle a verification challenge
  test <text>                             Test if text is a verification challenge
  solve-only <challenge_text>             Just solve and output answer
  stats                                   Show challenge statistics
  reset                                   Reset statistics
  --help                                  Show this help

Environment:
  AI_GENERATOR_URL    URL of AI generator service (default: http://localhost:3002)
  MOLTBOOK_API_KEY    API key for Moltbook submission
  WORKSPACE_DIR       Workspace directory for state files
EOF
}

# Main entry point
main() {
  local command="${1:-}"

  if [ -z "$command" ]; then
    show_usage
    exit 1
  fi

  shift || true

  init_state

  case "$command" in
    handle)
      if [ $# -lt 2 ]; then
        error "Usage: handle <challenge_id> <challenge_text>"
        exit 1
      fi
      handle_challenge "$1" "$2"
      ;;

    test)
      if [ $# -lt 1 ]; then
        error "Usage: test <text>"
        exit 1
      fi
      local text="$1"
      if is_verification_challenge "$text"; then
        info "✅ Detected as verification challenge"
        solve_challenge "$text"
      else
        info "❌ Not detected as verification challenge"
      fi
      ;;

    solve-only)
      # Special mode for proxy fallback - just solve and output answer
      if [ $# -lt 1 ]; then
        error "Usage: solve-only <challenge_text>"
        exit 1
      fi
      # Output only the answer to stdout, errors to stderr
      solve_challenge "$1"
      ;;

    stats)
      show_stats
      ;;

    reset)
      rm -f "$STATE_FILE"
      init_state
      success "Statistics reset"
      ;;

    --help|-h)
      show_usage
      exit 0
      ;;

    *)
      error "Unknown command: $command"
      exit 1
      ;;
  esac
}

main "$@"
