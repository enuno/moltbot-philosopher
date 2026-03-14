#!/bin/bash

# discover-relevant-threads.sh
# Queries Noosphere for relevant philosophical content via semantic search
# Enforces similarity thresholds (0.7+) and deduplicates against historical seen-posts
#
# Usage:
#   bash scripts/discover-relevant-threads.sh [--dry-run] [--category CATEGORY] [--limit LIMIT]
#
# Flags:
#   --dry-run        Use mock Noosphere data instead of making real API calls
#   --category CAT   Limit search to specific category (epistemology, ethics, metaphysics, logic, political)
#   --limit N        Maximum number of posts to return (default: 10, max: 10)

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DISCOVERY_SERVICE_DIR="${PROJECT_ROOT}/services/discovery-service"
WORKSPACE_DIR="${PROJECT_ROOT}/workspace/discovery"

# Defaults
DRY_RUN=false
CATEGORY=""
LIMIT=10
SIMILARITY_THRESHOLD=0.7

# Ensure workspace directory exists
mkdir -p "$WORKSPACE_DIR"

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Enforce maximum limit of 10
if [[ $LIMIT -gt 10 ]]; then
  LIMIT=10
fi

# Start timing
START_TIME=$(date +%s%N | cut -b1-13)

# Load taxonomy using Node.js
TAXONOMY=$(node -e "
try {
  const loader = require('${DISCOVERY_SERVICE_DIR}/src/taxonomy-loader.js');
  const taxonomy = loader.loadTaxonomy();
  console.log(JSON.stringify(taxonomy));
} catch (error) {
  console.error('Error loading taxonomy:', error.message);
  process.exit(1);
}
" 2>/dev/null) || {
  # Fallback: return empty result if taxonomy loading fails
  END_TIME=$(date +%s%N | cut -b1-13)
  EXECUTION_TIME=$((END_TIME - START_TIME))
  cat <<EOF
{
  "posts": [],
  "execution_time_ms": $EXECUTION_TIME,
  "discovery_count": 0
}
EOF
  exit 0
}

# Helper function to generate mock post
mock_post() {
  local id="$1"
  local title="$2"
  local similarity="$3"
  cat <<EOF
{
  "id": "$id",
  "title": "$title",
  "content": "Mock philosophical content about $title",
  "similarity": $similarity,
  "author": "philosopher-$((RANDOM % 9))",
  "timestamp": $(date +%s)
}
EOF
}

# Generate or fetch posts based on category or all keywords
POSTS_JSON=""

if [[ "$DRY_RUN" == "true" ]]; then
  # Dry-run mode: generate mock posts
  POST_ARRAY=()

  if [[ -n "$CATEGORY" ]]; then
    # Query specific category
    KEYWORDS=$(echo "$TAXONOMY" | jq -r ".\"$CATEGORY\"[]" 2>/dev/null | head -3)
  else
    # Query all categories: pick 1-2 from each
    KEYWORDS=$(echo "$TAXONOMY" | jq -r '.[] | .[0:2][]' 2>/dev/null)
  fi

  # Create mock posts from keywords
  mock_count=0
  while IFS= read -r keyword; do
    if [[ -z "$keyword" ]]; then
      continue
    fi

    # Generate 1-2 mock posts per keyword
    for _ in 1 2; do
      if [[ $mock_count -ge $LIMIT ]]; then
        break 2
      fi

      # Generate similarity score between 0.75 and 0.95 (above threshold)
      SIMILARITY=$(awk "BEGIN {printf \"%.2f\", 0.75 + rand() * 0.20}")

      POST_ITEM=$(mock_post "mock-post-${mock_count}" "Post about $keyword" "$SIMILARITY")
      POST_ARRAY+=("$POST_ITEM")
      mock_count=$((mock_count + 1))
    done
  done <<< "$KEYWORDS"

  # Build posts JSON array
  if [[ ${#POST_ARRAY[@]} -gt 0 ]]; then
    POSTS_JSON=$(printf '[%s]' "$(IFS=,; printf '%s' "${POST_ARRAY[*]}")")
  else
    POSTS_JSON="[]"
  fi
else
  # Real mode: would call Noosphere API
  # For now, return empty results (API integration in Task 5)
  POSTS_JSON="[]"
fi

# Filter posts by similarity threshold
FILTERED_POSTS=$(echo "$POSTS_JSON" | jq --arg threshold "$SIMILARITY_THRESHOLD" '
  map(select(.similarity >= ($threshold | tonumber)))
')

# Initialize seen-posts manager and deduplicate
DEDUPLICATED_POSTS=$(node -e "
try {
  const SeenPostsManager = require('${DISCOVERY_SERVICE_DIR}/src/seen-posts-manager.js');
  const manager = new SeenPostsManager('${WORKSPACE_DIR}/seen-posts.json');
  manager.initializeSeenPosts();

  // Load posts from stdin
  const postsJson = '$FILTERED_POSTS';
  let posts = JSON.parse(postsJson);

  // Filter out seen posts and add new ones
  const newPosts = [];
  for (const post of posts) {
    if (!manager.hasSeenPost(post.id)) {
      newPosts.push(post);
      manager.addSeenPost(post.id);
    }
  }

  console.log(JSON.stringify(newPosts));
} catch (error) {
  console.error('Error in deduplication:', error.message);
  // Return filtered posts without deduplication on error
  process.exit(0);
}
" 2>/dev/null) || {
  # If deduplication fails, use filtered posts as-is
  DEDUPLICATED_POSTS="$FILTERED_POSTS"
}

# Parse deduplicated posts
DEDUPLICATED_POSTS=${DEDUPLICATED_POSTS:-"[]"}

# Limit to requested number
FINAL_POSTS=$(echo "$DEDUPLICATED_POSTS" | jq ".[:$LIMIT]")
FINAL_COUNT=$(echo "$FINAL_POSTS" | jq 'length')

# Calculate execution time
END_TIME=$(date +%s%N | cut -b1-13)
EXECUTION_TIME=$((END_TIME - START_TIME))

# Output JSON result
cat <<EOF
{
  "posts": $FINAL_POSTS,
  "execution_time_ms": $EXECUTION_TIME,
  "discovery_count": $FINAL_COUNT
}
EOF

exit 0
