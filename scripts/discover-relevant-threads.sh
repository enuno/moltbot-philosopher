#!/bin/bash
# discover-relevant-threads.sh - Semantic search for philosophically relevant content
#
# Uses the Moltbook /search endpoint to find threads semantically similar to the
# agent's interests. Deduplicates against seen-threads.json to avoid re-engaging.
#
# Usage:
#   discover-relevant-threads.sh --agent=<name> --query=<topic> \
#     [--min-similarity=0.6] [--limit=5]
#
# Output: JSON lines, one per result: {"id":"...","title":"...","similarity":0.85}
# Environment: MOLTBOOK_API_KEY, MOLTBOOK_API_BASE
set -euo pipefail

API_BASE="${MOLTBOOK_API_BASE:-https://www.moltbook.com/api/v1}"
API_KEY="${MOLTBOOK_API_KEY:-}"
AGENT=""
QUERY=""
MIN_SIMILARITY="0.6"
LIMIT="5"
MAX_SEEN_THREADS=500

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --agent=*)   AGENT="${arg#--agent=}" ;;
    --query=*)   QUERY="${arg#--query=}" ;;
    --min-similarity=*) MIN_SIMILARITY="${arg#--min-similarity=}" ;;
    --limit=*)   LIMIT="${arg#--limit=}" ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if [ -z "$AGENT" ] || [ -z "$QUERY" ]; then
  echo "Usage: $0 --agent=<name> --query=<topic> [--min-similarity=0.6] [--limit=5]" >&2
  exit 1
fi
if [ -z "$API_KEY" ]; then
  echo "ERROR: MOLTBOOK_API_KEY not set" >&2
  exit 1
fi

WORKSPACE_DIR="/workspace/${AGENT}"
SEEN_FILE="${WORKSPACE_DIR}/seen-threads.json"

# URL-encode the query (replace spaces and common special chars)
ENCODED_QUERY=$(echo "$QUERY" | sed 's/ /%20/g; s/&/%26/g; s/?/%3F/g; s/#/%23/g')

# Load seen thread IDs (one per line from JSON array)
if [ -f "$SEEN_FILE" ]; then
  SEEN_IDS=$(grep -oE '"[a-zA-Z0-9_-]+"' "$SEEN_FILE" | tr -d '"' || true)
else
  SEEN_IDS=""
fi

# Fetch search results (search up to 20 to have headroom after filtering)
SEARCH_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/search?q=${ENCODED_QUERY}&limit=20&sort=relevance" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  2>/dev/null || echo '{"results":[]}')

# Parse results: extract id, title, similarity using awk (no jq required)
# Expected format: {"results": [{"id": "...", "title": "...", "similarity": 0.85}, ...]}
RESULTS=$(echo "$SEARCH_RESPONSE" | awk -v min_sim="$MIN_SIMILARITY" -v limit="$LIMIT" '
BEGIN {
  in_results = 0
  count = 0
  id = ""; title = ""; similarity = ""
}
{
  # Extract fields - simplified single-line JSON parser for result objects
  while (match($0, /"id":"([^"]+)"/, a)) {
    id = a[1]; $0 = substr($0, RSTART + RLENGTH)
    if (match($0, /"title":"([^"]*)"/, b)) {
      title = b[1]; $0 = substr($0, RSTART + RLENGTH)
    }
    if (match($0, /"similarity":([0-9.]+)/, c)) {
      similarity = c[1]
      if (similarity + 0 >= min_sim + 0 && count < limit + 0) {
        print "{\"id\":\"" id "\",\"title\":\"" title "\",\"similarity\":" similarity "}"
        count++
      }
    }
    id = ""; title = ""; similarity = ""
  }
}
' 2>/dev/null || true)

if [ -z "$RESULTS" ]; then
  exit 0
fi

# Filter out already-seen thread IDs and output new ones
NEW_IDS=""
while IFS= read -r result_line; do
  # Extract ID from JSON line
  thread_id=$(echo "$result_line" | grep -oE '"id":"[^"]+"' | cut -d'"' -f4)
  if [ -z "$thread_id" ]; then
    continue
  fi

  # Check if already seen
  if echo "$SEEN_IDS" | grep -qxF "$thread_id" 2>/dev/null; then
    continue  # Already seen, skip
  fi

  echo "$result_line"
  NEW_IDS="${NEW_IDS} ${thread_id}"
done <<< "$RESULTS"

# Update seen-threads.json with newly seen IDs (rotate to max MAX_SEEN_THREADS)
if [ -n "$NEW_IDS" ]; then
  # Collect all existing IDs
  ALL_IDS=""
  if [ -f "$SEEN_FILE" ]; then
    ALL_IDS=$(grep -oE '"[a-zA-Z0-9_-]+"' "$SEEN_FILE" | tr -d '"' || true)
  fi

  for new_id in $NEW_IDS; do
    ALL_IDS="${ALL_IDS}
${new_id}"
  done

  # Deduplicate and limit to MAX_SEEN_THREADS most recent entries
  UNIQUE_IDS=$(echo "$ALL_IDS" | grep -v '^$' | awk '!seen[$0]++' | tail -n "$MAX_SEEN_THREADS")

  # Write updated seen-threads.json
  mkdir -p "$WORKSPACE_DIR"
  {
    echo "["
    first=true
    while IFS= read -r id_entry; do
      [ -z "$id_entry" ] && continue
      if [ "$first" = true ]; then
        echo "  \"${id_entry}\""
        first=false
      else
        echo "  ,\"${id_entry}\""
      fi
    done <<< "$UNIQUE_IDS"
    echo "]"
  } > "${SEEN_FILE}.tmp" && mv "${SEEN_FILE}.tmp" "$SEEN_FILE"
fi
