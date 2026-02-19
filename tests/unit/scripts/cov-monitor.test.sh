#!/bin/bash
# Tests for cov-monitor.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COV_SCRIPT="${SCRIPT_DIR}/../../../scripts/cov-monitor.sh"
PASS=0
FAIL=0

assert_exit() {
  local desc="$1" expected_exit="$2" expected_pattern="$3"
  shift 3
  local actual_output actual_exit
  actual_exit=0
  actual_output=$("$@" 2>/dev/null) || actual_exit=$?

  if [ "$actual_exit" -eq "$expected_exit" ] && echo "$actual_output" | grep -q "$expected_pattern"; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc"
    echo "  Expected exit=$expected_exit pattern='$expected_pattern'"
    echo "  Got exit=$actual_exit output='$actual_output'"
    FAIL=$((FAIL + 1))
  fi
}

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

# Generate ISO timestamps N minutes apart from a base time
make_timestamps() {
  local base_epoch="$1" count="$2" interval_min="$3"
  local ts_list=""
  for i in $(seq 0 $((count - 1))); do
    epoch=$((base_epoch + i * interval_min * 60))
    ts=$(date -d "@$epoch" -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -r "$epoch" -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null)
    ts_list="${ts_list},\"${ts}\""
  done
  echo "${ts_list#,}"
}

BASE=$(date +%s)

# Test 1: Very regular timestamps (30 min apart) → CoV should be low → warning
REGULAR_TS=$(make_timestamps "$BASE" 6 30)
STATE1="$TMPDIR_TEST/regular.json"
echo "{\"post_timestamps\":[${REGULAR_TS}]}" > "$STATE1"
assert_exit "Regular 30-min intervals trigger COV_WARNING (exit 1)" 1 "COV_WARNING" bash "$COV_SCRIPT" "$STATE1"

# Test 2: Varying timestamps (20min, 60min, 240min, 45min, 180min) → CoV should be high → OK
VARY_BASE="$BASE"
V1="$VARY_BASE"
V2=$((V1 + 20 * 60))
V3=$((V2 + 240 * 60))
V4=$((V3 + 45 * 60))
V5=$((V4 + 180 * 60))
V6=$((V5 + 90 * 60))
make_ts() { date -d "@$1" -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null; }
VARY_TS="\"$(make_ts $V1)\",\"$(make_ts $V2)\",\"$(make_ts $V3)\",\"$(make_ts $V4)\",\"$(make_ts $V5)\",\"$(make_ts $V6)\""
STATE2="$TMPDIR_TEST/varying.json"
echo "{\"post_timestamps\":[${VARY_TS}]}" > "$STATE2"
assert_exit "Varying intervals (20-240min) give COV_OK (exit 0)" 0 "COV_OK" bash "$COV_SCRIPT" "$STATE2"

# Test 3: Only 2 timestamps → INSUFFICIENT_DATA
TS1="$(make_ts $BASE)"
TS2="$(make_ts $((BASE + 3600)))"
STATE3="$TMPDIR_TEST/sparse.json"
echo "{\"post_timestamps\":[\"${TS1}\",\"${TS2}\"]}" > "$STATE3"
assert_exit "2 timestamps returns INSUFFICIENT_DATA (exit 0)" 0 "INSUFFICIENT_DATA" bash "$COV_SCRIPT" "$STATE3"

# Test 4: Missing state file → INSUFFICIENT_DATA
assert_exit "Missing state file returns INSUFFICIENT_DATA (exit 0)" 0 "INSUFFICIENT_DATA" bash "$COV_SCRIPT" "/nonexistent/file.json"

# Test 5: State file with no post_timestamps key → INSUFFICIENT_DATA
STATE5="$TMPDIR_TEST/no-timestamps.json"
echo '{"last_check":"2026-02-19T12:00:00Z","last_skill_version":null}' > "$STATE5"
assert_exit "State file without post_timestamps returns INSUFFICIENT_DATA" 0 "INSUFFICIENT_DATA" bash "$COV_SCRIPT" "$STATE5"

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
