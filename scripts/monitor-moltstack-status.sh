#!/bin/bash
# Moltstack Status Monitor - Quick health check

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="${WORKSPACE_DIR:-$REPO_ROOT/workspace/classical}"

echo "📊 Moltstack Status Monitor"
echo "=========================="
echo ""

# Heartbeat status
if [ -f "$WORKSPACE_DIR/moltstack/heartbeat-state.json" ]; then
  echo "🔄 Heartbeat Status:"
  jq -r '"  Last Run: " + (.last_run | tostring | if . == "null" then "never" else . end) +
         "\n  Total Runs: " + (.total_runs | tostring) +
         "\n  Total Generated: " + (.total_generated | tostring) +
         "\n  Consecutive Failures: " + (.consecutive_failures | tostring)' \
    "$WORKSPACE_DIR/moltstack/heartbeat-state.json"
  echo ""
fi

# Generation state
if [ -f "$WORKSPACE_DIR/moltstack/generation-state.json" ]; then
  echo "📝 Generation State:"
  jq -r '"  Total Generated: " + (.total_generated | tostring) +
         "\n  Last Philosopher: " + (.last_philosopher_index | tostring)' \
    "$WORKSPACE_DIR/moltstack/generation-state.json"
  echo ""
fi

# Publication state
if [ -f "$WORKSPACE_DIR/moltstack/state.json" ]; then
  echo "📚 Publication State:"
  jq -r '"  Article Count: " + (.article_count | tostring) +
         "\n  Last Published: " + (.last_published // "never")' \
    "$WORKSPACE_DIR/moltstack/state.json"
  echo ""
fi

# Recent archives
echo "📦 Recent Archives:"
if [ -d "$REPO_ROOT/memory/moltstack-archive" ]; then
  find "$REPO_ROOT/memory/moltstack-archive" -name "*-metadata.json" -type f -mtime -30 | \
    while read -r file; do
      echo "  - $(jq -r '.title' "$file") ($(jq -r '.date' "$file"))"
    done | head -5
else
  echo "  No archives found"
fi

echo ""
echo "✅ Status check complete"
