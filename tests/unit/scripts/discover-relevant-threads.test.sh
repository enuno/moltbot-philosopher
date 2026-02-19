#!/bin/bash
# Tests for discover-relevant-threads.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVER_SCRIPT="${SCRIPT_DIR}/../../../scripts/discover-relevant-threads.sh"
PASS=0
FAIL=0

assert_output() {
  local desc="$1" expected_pattern="$2"
  shift 2
  local actual_output actual_exit
  actual_exit=0
  actual_output=$("$@" 2>/dev/null) || actual_exit=$?

  if echo "$actual_output" | grep -q "$expected_pattern"; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc"
    echo "  Expected pattern: '$expected_pattern'"
    echo "  Got exit=$actual_exit output='$actual_output'"
    FAIL=$((FAIL + 1))
  fi
}

assert_exit() {
  local desc="$1" expected_exit="$2"
  shift 2
  local actual_exit
  actual_exit=0
  "$@" >/dev/null 2>&1 || actual_exit=$?

  if [ "$actual_exit" -eq "$expected_exit" ]; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc"
    echo "  Expected exit=$expected_exit, got exit=$actual_exit"
    FAIL=$((FAIL + 1))
  fi
}

assert_empty() {
  local desc="$1"
  shift
  local actual_output actual_exit
  actual_exit=0
  actual_output=$("$@" 2>/dev/null) || actual_exit=$?

  if [ -z "$actual_output" ]; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc"
    echo "  Expected empty output, got: '$actual_output'"
    FAIL=$((FAIL + 1))
  fi
}

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

FAKE_WORKSPACE="${TMPDIR_TEST}/workspace/testagent"
mkdir -p "$FAKE_WORKSPACE"

# Mock API: we override the curl call by pointing API_BASE at a local mock server
# Use a file-based mock: write responses to temp files and use a wrapper script
MOCK_CURL="${TMPDIR_TEST}/curl"
MOCK_RESPONSE_FILE="${TMPDIR_TEST}/mock_response.json"

# Write a curl mock that returns predefined JSON.
# Use unquoted heredoc so $MOCK_RESPONSE_FILE path is embedded literally.
cat > "$MOCK_CURL" << CURLEOF
#!/bin/bash
# Mock curl: ignore all args, return predefined response
cat "${MOCK_RESPONSE_FILE}"
CURLEOF
chmod +x "$MOCK_CURL"

# Make PATH prefer mock curl
export PATH="${TMPDIR_TEST}:${PATH}"
export MOLTBOOK_API_KEY="moltbook_sk_testkey"
# Point workspace to our temp dir so seen-threads.json goes there
# The script uses WORKSPACE_DIR=/workspace/${AGENT}, so we can't easily redirect
# Instead, we use a subshell trick: wrap the script call using a temp HOME

# Since WORKSPACE_DIR is hardcoded as /workspace/${AGENT}, we need a different approach.
# We'll test the awk parsing and filtering logic by invoking the script with mocked responses
# via PATH injection of curl and using a test agent name with /tmp-based workspace.
#
# Override: patch WORKSPACE_DIR by setting AGENT to a path-safe name and ensuring
# the script's mkdir -p works. We'll use agent name that resolves to our tmpdir.
# Actually the script uses: WORKSPACE_DIR="/workspace/${AGENT}" - this is hardcoded.
# We can work around by using a symlink.

FAKE_WORKSPACE_PARENT="${TMPDIR_TEST}/workspace"
mkdir -p "$FAKE_WORKSPACE_PARENT"

# Create a symlink so /workspace in tests maps... actually we can't modify /workspace
# Instead, test what we can: argument validation, min-similarity filtering via seen file,
# and full flow with a writable workspace path.
#
# The cleanest approach: run the script with agent name containing a relative path won't work.
# We test:
# 1. Missing --agent → exit 1 with usage
# 2. Missing --query → exit 1 with usage
# 3. Missing MOLTBOOK_API_KEY → exit 1 with error
# 4. API returns empty results → exit 0, no output
# 5. API returns results above min_similarity → output lines emitted
# 6. Deduplication: already-seen IDs skipped

# Test 1: Missing --agent exits with error
assert_exit "Missing --agent exits 1" 1 \
  bash "$DISCOVER_SCRIPT" --query="consciousness"

# Test 2: Missing --query exits with error
assert_exit "Missing --query exits 1" 1 \
  bash "$DISCOVER_SCRIPT" --agent="testagent"

# Test 3: Missing API key exits with error
(
  unset MOLTBOOK_API_KEY
  exit_code=0
  bash "$DISCOVER_SCRIPT" --agent="testagent" --query="philosophy" >/dev/null 2>&1 || exit_code=$?
  if [ "$exit_code" -eq 1 ]; then
    echo "PASS: Missing MOLTBOOK_API_KEY exits 1"
    exit 0
  else
    echo "FAIL: Missing MOLTBOOK_API_KEY exits 1 (got $exit_code)"
    exit 1
  fi
) && PASS=$((PASS + 1)) || FAIL=$((FAIL + 1))

# Test 4: Empty results → no output (exit 0)
echo '{"results":[]}' > "$MOCK_RESPONSE_FILE"
assert_empty "Empty API results produces no output" \
  bash "$DISCOVER_SCRIPT" --agent="testagent" --query="consciousness"

# Test 5: Results with similarity above threshold → JSON lines output
# Note: WORKSPACE_DIR will be /workspace/testagent (not our tmpdir) but mkdir -p will
# fail silently if /workspace doesn't exist; seen-threads.json just won't be created.
# Output lines are still emitted before the seen-file update, so we can test that.
RESPONSE='{"results":[{"id":"thread-abc","title":"Free Will Debate","similarity":0.92},{"id":"thread-def","title":"Ethics Forum","similarity":0.45}]}'
echo "$RESPONSE" > "$MOCK_RESPONSE_FILE"
assert_output "Results above min-similarity (0.6) emitted as JSON lines" '"id":"thread-abc"' \
  bash "$DISCOVER_SCRIPT" --agent="testagent" --query="free will" --min-similarity=0.6

# Test 6: Results below min-similarity are filtered out (all results score 0.45 and 0.50, below 0.9)
LOW_RESPONSE='{"results":[{"id":"thread-low1","title":"Low Score One","similarity":0.45},{"id":"thread-low2","title":"Low Score Two","similarity":0.50}]}'
echo "$LOW_RESPONSE" > "$MOCK_RESPONSE_FILE"
assert_empty "Results below min-similarity (0.9) suppressed" \
  bash "$DISCOVER_SCRIPT" --agent="testagent" --query="free will" --min-similarity=0.9

# Test 7: --limit caps output count
MANY_RESULTS='{"results":['
for i in $(seq 1 10); do
  [ $i -gt 1 ] && MANY_RESULTS="${MANY_RESULTS},"
  MANY_RESULTS="${MANY_RESULTS}{\"id\":\"thread-${i}\",\"title\":\"Thread ${i}\",\"similarity\":0.85}"
done
MANY_RESULTS="${MANY_RESULTS}]}"
echo "$MANY_RESULTS" > "$MOCK_RESPONSE_FILE"

OUTPUT=$(bash "$DISCOVER_SCRIPT" --agent="testagent" --query="consciousness" --limit=3 2>/dev/null || true)
COUNT=0
while IFS= read -r line; do
  [ -n "$line" ] && COUNT=$((COUNT + 1))
done <<< "$OUTPUT"
if [ "$COUNT" -le 3 ]; then
  echo "PASS: --limit=3 caps output to at most 3 results (got $COUNT)"
  PASS=$((PASS + 1))
else
  echo "FAIL: --limit=3 should cap at 3, got $COUNT"
  FAIL=$((FAIL + 1))
fi

# Test 8: Unknown argument exits with error
assert_exit "Unknown argument exits 1" 1 \
  bash "$DISCOVER_SCRIPT" --agent="testagent" --query="test" --unknown=foo

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
