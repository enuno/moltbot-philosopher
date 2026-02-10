#!/bin/bash
# Moltstack Article Publisher for Noesis (The Divided Line)
# Publishes long-form philosophical essays to Moltstack
# Part of moltbot-philosopher v2.6

set -euo pipefail

# ================================================================================
# Configuration
# ================================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace/classical}"
MOLTSTACK_DIR="$WORKSPACE_DIR/moltstack"
STATE_FILE="$MOLTSTACK_DIR/state.json"
LOG_FILE="${LOG_FILE:-/logs/moltstack.log}"

# Ensure log directory exists
LOG_DIR="$(dirname "$LOG_FILE")"
mkdir -p "$LOG_DIR" 2>/dev/null || LOG_FILE="/tmp/moltstack.log"

MOLTSTACK_API_URL="${MOLTSTACK_API_URL:-https://moltstack.net/api}"
MOLTSTACK_PUBLICATION_SLUG="${MOLTSTACK_PUBLICATION_SLUG:-noesis}"

# Rate limiting: 7 days (604800 seconds) recommended
MIN_PUBLISH_INTERVAL="${MOLTSTACK_POST_INTERVAL:-604800}"

# ================================================================================
# Functions
# ================================================================================

log() {
  local level="$1"
  shift
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [$level] $*" | tee -a "$LOG_FILE"
}

error() {
  log ERROR "$@"
  exit 1
}

# Initialize state file if missing
init_state() {
  if [ ! -f "$STATE_FILE" ]; then
    log INFO "Initializing state file: $STATE_FILE"
    mkdir -p "$MOLTSTACK_DIR"
    cat > "$STATE_FILE" <<EOF
{
  "last_published": null,
  "article_count": 0,
  "draft_queue": [],
  "publication_history": []
}
EOF
  fi
}

# Check if enough time has passed since last publish
can_publish() {
  local last_published
  last_published=$(jq -r '.last_published' "$STATE_FILE")

  if [ "$last_published" = "null" ]; then
    return 0  # Never published before
  fi

  local now
  now=$(date -u +%s)

  local last_pub_ts
  last_pub_ts=$(date -d "$last_published" +%s 2>/dev/null || echo 0)

  local seconds_since=$((now - last_pub_ts))

  if [ "$seconds_since" -ge "$MIN_PUBLISH_INTERVAL" ]; then
    log INFO "Time since last publish: $((seconds_since / 3600)) hours (threshold: $((MIN_PUBLISH_INTERVAL / 3600)) hours)"
    return 0
  else
    local hours_remaining=$(( (MIN_PUBLISH_INTERVAL - seconds_since) / 3600 ))
    log WARN "Rate limited: $hours_remaining hours until next publish allowed"
    return 1
  fi
}

# Validate API key format
validate_api_key() {
  local key="$1"

  if [ -z "$key" ]; then
    error "MOLTSTACK_API_KEY is not set"
  fi

  if ! [[ "$key" =~ ^molt_ ]]; then
    log WARN "API key does not start with 'molt_' prefix (expected format)"
    log WARN "Proceeding anyway, but verify your API key is correct"
  fi
}

# Convert markdown to HTML using marked
markdown_to_html() {
  local markdown_file="$1"
  local html_file="$2"

  if ! command -v marked &> /dev/null; then
    log WARN "marked not found, using basic conversion"
    # Fallback: simple paragraph wrapping
    sed 's/^$/\n<\/p><p>/g' "$markdown_file" | \
      sed '1s/^/<p>/' | \
      sed '$s/$/<\/p>/' > "$html_file"
  else
    # Use marked with philosophical formatting
    marked "$markdown_file" \
      --gfm \
      --breaks \
      --smartypants \
      > "$html_file"
  fi

  log INFO "Converted markdown to HTML: $(wc -c < "$html_file") bytes"
}

# Extract title from markdown frontmatter or first H1
extract_title() {
  local markdown_file="$1"

  # Try frontmatter first
  local title
  title=$(awk '
    /^---$/ { in_frontmatter=!in_frontmatter; next }
    in_frontmatter && /^title:/ {
      sub(/^title: */, "");
      gsub(/"/, "");
      print;
      exit
    }
  ' "$markdown_file")

  if [ -n "$title" ]; then
    echo "$title"
    return
  fi

  # Fallback to first H1
  title=$(grep -m1 '^# ' "$markdown_file" | sed 's/^# //')

  if [ -n "$title" ]; then
    echo "$title"
    return
  fi

  # Default fallback
  echo "Untitled Essay"
}

# Extract subtitle from frontmatter
extract_subtitle() {
  local markdown_file="$1"

  # Extract subtitle from frontmatter
  local subtitle
  subtitle=$(awk '
    /^---$/ { in_frontmatter=!in_frontmatter; next }
    in_frontmatter && /^subtitle:/ {
      sub(/^subtitle: */, "");
      gsub(/"/, "");
      print;
      exit
    }
  ' "$markdown_file")

  echo "$subtitle"
}

# Extract excerpt from frontmatter or first paragraph
extract_excerpt() {
  local markdown_file="$1"

  # Try frontmatter
  local excerpt
  excerpt=$(awk '
    /^---$/ { in_frontmatter=!in_frontmatter; next }
    in_frontmatter && /^excerpt:/ {
      sub(/^excerpt: */, "");
      gsub(/"/, "");
      print;
      exit
    }
  ' "$markdown_file")

  if [ -n "$excerpt" ]; then
    echo "$excerpt"
    return
  fi

  # Fallback: first paragraph after frontmatter (first 200 chars)
  excerpt=$(awk '
    /^---$/ && !seen_frontmatter { in_frontmatter=!in_frontmatter; seen_frontmatter=1; next }
    /^---$/ && in_frontmatter { in_frontmatter=0; next }
    !in_frontmatter && /^[A-Z]/ {
      print;
      exit
    }
  ' "$markdown_file" | tr '\n' ' ' | cut -c1-200)

  echo "${excerpt}..."
}

# Publish article to Moltstack API
publish_article() {
  local html_file="$1"
  local title="$2"
  local subtitle="$3"
  local excerpt="$4"

  validate_api_key "$MOLTSTACK_API_KEY"

  log INFO "Publishing article: $title"

  # Read HTML content
  local content
  content=$(cat "$html_file")

  # Build JSON payload
  local payload
  if [ -n "$subtitle" ]; then
    payload=$(jq -n \
      --arg title "$title" \
      --arg subtitle "$subtitle" \
      --arg content "$content" \
      --arg excerpt "$excerpt" \
      --arg status "published" \
      '{
        title: $title,
        subtitle: $subtitle,
        content: $content,
        status: $status
      } + if $excerpt != "" then {excerpt: $excerpt} else {} end')
  else
    payload=$(jq -n \
      --arg title "$title" \
      --arg content "$content" \
      --arg excerpt "$excerpt" \
      --arg status "published" \
      '{
        title: $title,
        content: $content,
        status: $status
      } + if $excerpt != "" then {excerpt: $excerpt} else {} end')
  fi

  # Publish with retry logic
  local attempt=1
  local max_attempts=3
  local delay=5
  local response_file
  response_file=$(mktemp)

  while [ $attempt -le $max_attempts ]; do
    log INFO "Publish attempt $attempt/$max_attempts"

    local http_code
    http_code=$(curl -s -w "%{http_code}" -o "$response_file" \
      -X POST "$MOLTSTACK_API_URL/posts" \
      -H "Authorization: Bearer $MOLTSTACK_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$payload")

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
      log INFO "Successfully published (HTTP $http_code)"

      # Parse response (based on actual API spec)
      local post_id post_slug post_url published_at
      post_id=$(jq -r '.post.id // .id' "$response_file")
      post_slug=$(jq -r '.post.slug // .slug' "$response_file")
      post_url=$(jq -r '.post.url // .url' "$response_file")
      published_at=$(jq -r '.post.publishedAt // .publishedAt // .post.created_at // .created_at' "$response_file")

      log INFO "Published URL: $post_url"

      # Update state file
      update_state "$post_id" "$title" "$post_slug" "$post_url" "$published_at"

      # Notify via NTFY
      if [ -n "${NTFY_URL:-}" ]; then
        "$SCRIPT_DIR/notify-ntfy.sh" "✅ Published: $title" \
          --priority high \
          --tags books,success \
          --click "$post_url" || true
      fi

      rm -f "$response_file"
      return 0
    elif [ "$http_code" = "429" ]; then
      log WARN "Rate limited (429). Retrying in ${delay}s..."
      sleep $delay
      delay=$((delay * 2))
      attempt=$((attempt + 1))
    elif [ "$http_code" = "500" ] || [ "$http_code" = "503" ]; then
      log WARN "Server error ($http_code). Retrying in ${delay}s..."
      sleep $delay
      delay=$((delay * 2))
      attempt=$((attempt + 1))
    else
      log ERROR "Publishing failed with HTTP $http_code"
      cat "$response_file" | jq -C '.' || cat "$response_file"

      # Notify via NTFY
      if [ -n "${NTFY_URL:-}" ]; then
        "$SCRIPT_DIR/notify-ntfy.sh" "❌ Moltstack publish failed: HTTP $http_code" \
          --priority high \
          --tags warning || true
      fi

      rm -f "$response_file"
      return 1
    fi
  done

  log ERROR "Publishing failed after $max_attempts attempts"
  rm -f "$response_file"
  return 1
}

# Update state file with published article
update_state() {
  local post_id="$1"
  local title="$2"
  local slug="$3"
  local url="$4"
  local published_at="$5"

  local temp_state
  temp_state=$(mktemp)

  jq --arg id "$post_id" \
     --arg title "$title" \
     --arg slug "$slug" \
     --arg url "$url" \
     --arg publishedAt "$published_at" \
     '.last_published = $publishedAt |
      .article_count += 1 |
      .publication_history += [{
        id: $id,
        title: $title,
        slug: $slug,
        url: $url,
        publishedAt: $publishedAt
      }]' "$STATE_FILE" > "$temp_state"

  mv "$temp_state" "$STATE_FILE"
  log INFO "Updated state file: article_count=$(jq -r '.article_count' "$STATE_FILE")"
}

# ================================================================================
# Main
# ================================================================================

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS] <markdown_file>

Publish a philosophical essay to Moltstack (The Divided Line).

OPTIONS:
  --dry-run         Convert and validate but don't publish
  --force           Bypass rate limiting (use with caution)
  --help            Show this help message

ARGUMENTS:
  <markdown_file>   Path to markdown article with frontmatter

EXAMPLES:
  # Publish article
  $(basename "$0") drafts/sisyphus-blockchain.md

  # Test conversion without publishing
  $(basename "$0") --dry-run drafts/test.md

  # Force publish (bypass rate limit)
  $(basename "$0") --force drafts/urgent.md

ENVIRONMENT:
  MOLTSTACK_API_KEY           API key for Moltstack (required)
  MOLTSTACK_API_URL           API base URL (default: https://moltstack.net/api)
  MOLTSTACK_PUBLICATION_SLUG  Publication slug (default: noesis)
  MOLTSTACK_POST_INTERVAL     Min seconds between publishes (default: 604800)
  WORKSPACE_DIR               Workspace directory (default: /workspace/classical)

STATE FILE:
  $STATE_FILE

EOF
  exit 0
}

main() {
  local dry_run=false
  local force=false
  local markdown_file=""

  # Parse arguments
  while [ $# -gt 0 ]; do
    case "$1" in
      --dry-run)
        dry_run=true
        shift
        ;;
      --force)
        force=true
        shift
        ;;
      --help|-h)
        usage
        ;;
      -*)
        error "Unknown option: $1"
        ;;
      *)
        markdown_file="$1"
        shift
        ;;
    esac
  done

  if [ -z "$markdown_file" ]; then
    error "Missing required argument: <markdown_file>"
  fi

  if [ ! -f "$markdown_file" ]; then
    error "File not found: $markdown_file"
  fi

  # Initialize state
  init_state

  # Check rate limiting (unless forced)
  if [ "$force" = false ] && ! can_publish; then
    error "Rate limit exceeded. Use --force to bypass."
  fi

  # Extract metadata
  local title subtitle excerpt
  title=$(extract_title "$markdown_file")
  subtitle=$(extract_subtitle "$markdown_file")
  excerpt=$(extract_excerpt "$markdown_file")

  log INFO "Title: $title"
  if [ -n "$subtitle" ]; then
    log INFO "Subtitle: $subtitle"
  fi
  log INFO "Excerpt: ${excerpt:0:50}..."

  # Convert markdown to HTML
  local html_file
  html_file=$(mktemp --suffix=.html)
  markdown_to_html "$markdown_file" "$html_file"

  if [ "$dry_run" = true ]; then
    log INFO "Dry-run mode: HTML conversion complete"
    log INFO "HTML file: $html_file"
    log INFO "Would publish to: $MOLTSTACK_API_URL/posts"
    exit 0
  fi

  # Publish to Moltstack
  if publish_article "$html_file" "$title" "$subtitle" "$excerpt"; then
    log INFO "✅ Article published successfully"
    rm -f "$html_file"
    exit 0
  else
    log ERROR "❌ Publishing failed"
    rm -f "$html_file"
    exit 1
  fi
}

main "$@"
