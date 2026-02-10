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
MOLTBOOK_API_URL="${MOLTBOOK_API_URL:-https://www.moltbook.com/api/v1}"
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

# Update state
update_state() {
  local result="$1"
  local challenge_text="$2"

  local temp_state
  temp_state=$(mktemp)

  if [ "$result" = "pass" ]; then
    jq --arg challenge "$challenge_text" \
       --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
       '.total_challenges += 1 |
        .challenges_passed += 1 |
        .last_challenge = $timestamp |
        .consecutive_failures = 0' "$STATE_FILE" > "$temp_state"
  else
    jq --arg challenge "$challenge_text" \
       --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
       '.total_challenges += 1 |
        .challenges_failed += 1 |
        .last_challenge = $timestamp |
        .last_failure = $timestamp |
        .consecutive_failures += 1' "$STATE_FILE" > "$temp_state"
  fi

  mv "$temp_state" "$STATE_FILE"
}

# Detect if message is a verification challenge
is_verification_challenge() {
  local message="$1"

  # Detection patterns for verification challenges
  # Focus on instruction compliance and anti-human patterns
  if echo "$message" | grep -qiE "(if you read this|verification|agent verification|prove you (are|can)|instruction:|follow this exact|respond with only|format:|heartbeat check|compliance test)"; then
    return 0
  fi

  # Check for structured challenge format
  if echo "$message" | jq -e '.type == "verification_challenge"' > /dev/null 2>&1; then
    return 0
  fi

  # Detect metadata flags
  if echo "$message" | jq -e '.metadata.is_verification == true' > /dev/null 2>&1; then
    return 0
  fi

  return 1
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
  response=$(timeout "${VERIFICATION_TIMEOUT}s" curl -s -X POST "$AI_GENERATOR_URL/generate" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg customPrompt "$prompt" \
      '{
        customPrompt: $customPrompt,
        contentType: "post",
        model: "deepseek-v3",
        temperature: 0.2,
        maxTokens: 60
      }')" 2>/dev/null)

  local end_time
  end_time=$(date +%s)
  local elapsed=$((end_time - start_time))

  if [ $elapsed -ge $VERIFICATION_TIMEOUT ]; then
    error "Challenge solving timed out after ${elapsed}s"
    return 1
  fi

  if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    local raw_answer
    raw_answer=$(echo "$response" | jq -r '.content // .text')

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

    # If answer is still too verbose (>50 chars), it's probably not compliant
    if [ ${#answer} -gt 50 ]; then
      warn "Answer too verbose (${#answer} chars), likely non-compliant"
      # Try extracting just first few words
      answer=$(echo "$answer" | cut -d' ' -f1-5)
    fi

    info "Challenge solved in ${elapsed}s"
    echo "$answer"
    return 0
  else
    error "Failed to generate challenge answer"
    return 1
  fi
}

# Submit challenge answer to Moltbook
submit_answer() {
  local challenge_id="$1"
  local answer="$2"

  if [ -z "$MOLTBOOK_API_KEY" ]; then
    error "MOLTBOOK_API_KEY not set"
    return 1
  fi

  info "Submitting challenge answer to Moltbook"

  local response
  response=$(curl -s -X POST \
    "${MOLTBOOK_API_URL}/agents/verification/${challenge_id}/answer" \
    -H "Authorization: Bearer $MOLTBOOK_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg answer "$answer" '{answer: $answer}')")

  if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
    success "Challenge answer accepted"
    return 0
  else
    local error_msg
    error_msg=$(echo "$response" | jq -r '.error // "Unknown error"')
    error "Challenge submission failed: $error_msg"
    return 1
  fi
}

# Main challenge handler
handle_challenge() {
  local challenge_id="$1"
  local challenge_text="$2"

  info "=== VERIFICATION CHALLENGE DETECTED ==="
  info "Challenge ID: $challenge_id"

  # Solve challenge
  local answer
  if answer=$(solve_challenge "$challenge_text"); then
    info "Generated answer: $answer"

    # Submit answer
    if submit_answer "$challenge_id" "$answer"; then
      update_state "pass" "$challenge_text"
      success "✅ Challenge passed successfully"

      # Alert via NTFY if configured
      if command -v notify-ntfy.sh &> /dev/null; then
        bash "$SCRIPT_DIR/notify-ntfy.sh" \
          "✅ Verification Challenge Passed" \
          "Challenge ID: $challenge_id" \
          "low" \
          "moltbook,verification,success"
      fi

      return 0
    else
      update_state "fail" "$challenge_text"
      error "❌ Challenge submission failed"

      # Alert on failure
      if command -v notify-ntfy.sh &> /dev/null; then
        bash "$SCRIPT_DIR/notify-ntfy.sh" \
          "❌ Verification Challenge FAILED" \
          "Challenge ID: $challenge_id - Submission error" \
          "urgent" \
          "moltbook,verification,failure"
      fi

      return 1
    fi
  else
    update_state "fail" "$challenge_text"
    error "❌ Challenge solving failed"

    # Alert on failure
    if command -v notify-ntfy.sh &> /dev/null; then
      bash "$SCRIPT_DIR/notify-ntfy.sh" \
        "❌ Verification Challenge FAILED" \
        "Challenge ID: $challenge_id - Solver error" \
        "urgent" \
        "moltbook,verification,failure"
    fi

    return 1
  fi
}

# Show current verification stats
show_stats() {
  init_state

  echo "📊 Verification Challenge Statistics"
  echo "====================================="
  echo ""

  local total
  local passed
  local failed
  local consecutive

  total=$(jq -r '.total_challenges' "$STATE_FILE")
  passed=$(jq -r '.challenges_passed' "$STATE_FILE")
  failed=$(jq -r '.challenges_failed' "$STATE_FILE")
  consecutive=$(jq -r '.consecutive_failures' "$STATE_FILE")

  echo "Total Challenges: $total"
  echo "Passed: $passed"
  echo "Failed: $failed"

  if [ "$total" -gt 0 ]; then
    local success_rate
    success_rate=$(echo "scale=1; $passed * 100 / $total" | bc)
    echo "Success Rate: ${success_rate}%"
  fi

  echo "Consecutive Failures: $consecutive"

  if [ "$consecutive" -ge 2 ]; then
    echo ""
    echo -e "${RED}⚠️  WARNING: Multiple consecutive failures detected${NC}"
    echo "Review challenge handler implementation"
  fi

  echo ""
}

# Show usage
show_usage() {
  cat << EOF
Moltbook AI Verification Challenge Handler

Handles AI verification challenges with fast, accurate solving.

USAGE:
  $(basename "$0") <command> [OPTIONS]

COMMANDS:
  handle <id> <text>    Handle a verification challenge
  test <text>           Test challenge detection and solving
  stats                 Show verification statistics
  reset                 Reset statistics

EXAMPLES:
  # Handle challenge from Moltbook webhook
  $(basename "$0") handle "challenge-123" "What is 2 + 2?"

  # Test challenge detection
  $(basename "$0") test "Solve this puzzle: What is 5 * 3?"

  # Show stats
  $(basename "$0") stats

ENVIRONMENT:
  MOLTBOOK_API_KEY         Moltbook API key (required for submission)
  AI_GENERATOR_URL         AI service URL (default: http://localhost:3002)
  VERIFICATION_TIMEOUT     Solver timeout in seconds (default: 10)

EOF
  exit 0
}

# Main function
main() {
  local command="${1:-}"

  if [ -z "$command" ]; then
    show_usage
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

    stats)
      show_stats
      ;;

    reset)
      rm -f "$STATE_FILE"
      init_state
      success "Statistics reset"
      ;;

    --help)
      show_usage
      ;;

    *)
      error "Unknown command: $command"
      exit 1
      ;;
  esac
}

main "$@"
