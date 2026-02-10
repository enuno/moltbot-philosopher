#!/usr/bin/env bats
# Integration tests for Moltbook verification challenge handler

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'

setup() {
  export WORKSPACE_DIR="/tmp/moltbot-test-$$"
  export STATE_FILE="${WORKSPACE_DIR}/verification-state.json"
  export AI_GENERATOR_URL="http://localhost:3002"
  mkdir -p "$WORKSPACE_DIR"
}

teardown() {
  rm -rf "$WORKSPACE_DIR"
}

@test "Challenge detection: recognizes verification keywords" {
  run bash scripts/handle-verification-challenge.sh test "Please solve this verification puzzle: What is 2 + 2?"
  assert_output --partial "Detected as verification challenge"
}

@test "Challenge detection: recognizes structured format" {
  run bash scripts/handle-verification-challenge.sh test "Human check: Prove you can reason"
  assert_output --partial "Detected as verification challenge"
}

@test "Challenge detection: ignores normal messages" {
  run bash scripts/handle-verification-challenge.sh test "Hello, how are you today?"
  assert_output --partial "Not detected as verification challenge"
}

@test "Challenge solver: generates answer within timeout" {
  skip "Requires AI service running"

  run timeout 15s bash scripts/handle-verification-challenge.sh test "What is 5 * 3?"
  assert_success
  assert_output --partial "Challenge solved"
}

@test "State tracking: initializes correctly" {
  run bash scripts/handle-verification-challenge.sh stats
  assert_success
  assert_output --partial "Total Challenges: 0"
}

@test "State tracking: updates on simulated pass" {
  # Simulate a pass by directly updating state
  cat > "$STATE_FILE" << 'EOF'
{
  "total_challenges": 1,
  "challenges_passed": 1,
  "challenges_failed": 0,
  "last_challenge": "2026-02-10T21:00:00Z",
  "last_failure": null,
  "consecutive_failures": 0
}
EOF

  run bash scripts/handle-verification-challenge.sh stats
  assert_success
  assert_output --partial "Total Challenges: 1"
  assert_output --partial "Passed: 1"
  assert_output --partial "Success Rate: 100.0%"
}

@test "State tracking: detects consecutive failures" {
  # Simulate consecutive failures
  cat > "$STATE_FILE" << 'EOF'
{
  "total_challenges": 3,
  "challenges_passed": 1,
  "challenges_failed": 2,
  "last_challenge": "2026-02-10T21:00:00Z",
  "last_failure": "2026-02-10T21:00:00Z",
  "consecutive_failures": 2
}
EOF

  run bash scripts/handle-verification-challenge.sh stats
  assert_success
  assert_output --partial "⚠️  WARNING: Multiple consecutive failures"
}

@test "Help message displays correctly" {
  run bash scripts/handle-verification-challenge.sh --help
  assert_success
  assert_output --partial "Moltbook AI Verification Challenge Handler"
  assert_output --partial "COMMANDS:"
}

@test "Reset clears statistics" {
  # Create state with data
  cat > "$STATE_FILE" << 'EOF'
{
  "total_challenges": 5,
  "challenges_passed": 3,
  "challenges_failed": 2,
  "last_challenge": "2026-02-10T21:00:00Z",
  "last_failure": null,
  "consecutive_failures": 0
}
EOF

  run bash scripts/handle-verification-challenge.sh reset
  assert_success

  run bash scripts/handle-verification-challenge.sh stats
  assert_output --partial "Total Challenges: 0"
}
