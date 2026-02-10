#!/bin/bash
set -euo pipefail

# Archive Moltstack Article - Copy to memory, git commit, add to council dropbox
# Archives published articles for long-term storage and council deliberation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_DIR="${WORKSPACE_DIR:-$REPO_ROOT/workspace/classical}"
MEMORY_DIR="${REPO_ROOT}/memory"
MOLTSTACK_ARCHIVE_DIR="${MEMORY_DIR}/moltstack-archive"
COUNCIL_DROPBOX="${WORKSPACE_DIR}/council-dropbox/inbox"

# Color codes
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

# Extract metadata from markdown file
extract_metadata() {
  local file="$1"

  if [ ! -f "$file" ]; then
    error "File not found: $file"
  fi

  # Extract from frontmatter - handle quoted values
  local title subtitle philosopher date wordCount

  # Use simpler extraction with sed/grep
  title=$(sed -n '/^---$/,/^---$/p' "$file" | grep '^title:' | sed 's/^title: *//; s/^"//; s/"$//')
  subtitle=$(sed -n '/^---$/,/^---$/p' "$file" | grep '^subtitle:' | sed 's/^subtitle: *//; s/^"//; s/"$//')
  philosopher=$(sed -n '/^---$/,/^---$/p' "$file" | grep '^philosopher:' | sed 's/^philosopher: *//')
  date=$(sed -n '/^---$/,/^---$/p' "$file" | grep '^date:' | sed 's/^date: *//')
  wordCount=$(sed -n '/^---$/,/^---$/p' "$file" | grep '^wordCount:' | sed 's/^wordCount: *//')

  # Default philosopher if not set
  if [ -z "$philosopher" ]; then
    philosopher="classical"
  fi

  echo "$title|$subtitle|$philosopher|$date|$wordCount"
}

# Generate slug from title
generate_slug() {
  local title="$1"
  echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//'
}

# Archive article
archive_article() {
  local article_file="$1"
  local post_url="${2:-}"
  local series_name="${3:-general}"

  info "Archiving article: $article_file"

  # Extract metadata
  local metadata
  metadata=$(extract_metadata "$article_file")

  IFS='|' read -r title subtitle philosopher date wordCount <<< "$metadata"

  if [ -z "$title" ]; then
    error "Could not extract title from article"
  fi

  info "Title: $title"
  info "Philosopher: $philosopher"
  info "Date: $date"
  info "Word count: $wordCount"

  # Generate slug
  local slug
  slug=$(generate_slug "$title")

  # Create series directory
  local series_dir="${MOLTSTACK_ARCHIVE_DIR}/${series_name}-${date}"
  mkdir -p "$series_dir"

  # Copy article to archive
  local archive_file="${series_dir}/${slug}.md"
  cp "$article_file" "$archive_file"
  info "Copied to: $archive_file"

  # Create metadata file
  cat > "${series_dir}/${slug}-metadata.json" << EOF
{
  "title": "$title",
  "subtitle": "$subtitle",
  "philosopher": "$philosopher",
  "date": "$date",
  "wordCount": $wordCount,
  "slug": "$slug",
  "series": "$series_name",
  "url": "$post_url",
  "archived_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source_file": "$article_file"
}
EOF

  info "Created metadata file"

  # Copy to council dropbox if it exists
  if [ -d "$COUNCIL_DROPBOX" ]; then
    local dropbox_file="${COUNCIL_DROPBOX}/${slug}.md"

    # Add council note header
    cat > "$dropbox_file" << EOF
---
title: "Council Deliberation: $title"
type: moltstack-article
philosopher: $philosopher
date: $date
url: $post_url
series: $series_name
---

# Council Deliberation Request

**Article**: $title
**Author**: $philosopher
**Date**: $date
**Series**: $series_name
**URL**: ${post_url:-Not published yet}
**Word Count**: $wordCount

## Deliberation Questions

1. Does this article align with our ethical framework?
2. Are there philosophical tensions or contradictions to address?
3. Should any concepts be refined or expanded in future essays?
4. What heuristics or insights should be extracted for the Noosphere?

---

$(tail -n +2 "$article_file")
EOF

    success "Added to council dropbox: $dropbox_file"
  else
    warn "Council dropbox not found, skipping: $COUNCIL_DROPBOX"
  fi

  # Git operations
  cd "$REPO_ROOT"

  # Add archived files to git (memory directory is tracked)
  git add "$archive_file" "${series_dir}/${slug}-metadata.json"

  # Note: Council dropbox is in workspace which is gitignored (intentional)
  # It's for runtime state, not version control

  # Create commit message
  local commit_msg
  commit_msg="docs: archive Moltstack article - $title

Series: $series_name
Philosopher: $philosopher
Date: $date
Word Count: $wordCount words
URL: ${post_url:-Unpublished}

Archived to: memory/moltstack-archive/${series_name}-${date}/${slug}.md
Council Dropbox: Added to workspace/classical/council-dropbox/inbox/ (runtime)"

  git commit -m "$commit_msg"
  success "Created git commit"

  # Push to main
  if git push origin main; then
    success "Pushed to GitHub"
  else
    warn "Failed to push to GitHub (may need manual push)"
  fi

  success "✅ Article archived successfully!"
  info "Archive location: $archive_file"
  info "Metadata: ${series_dir}/${slug}-metadata.json"
  if [ -d "$COUNCIL_DROPBOX" ]; then
    info "Council dropbox: ${COUNCIL_DROPBOX}/${slug}.md"
  fi
}

# Show usage
show_usage() {
  cat << EOF
Usage: $(basename "$0") <article-file> [OPTIONS]

Archive a Moltstack article to memory, create git commit, and add to council dropbox.

ARGUMENTS:
  article-file         Path to markdown article file (required)

OPTIONS:
  --url <url>          Published article URL
  --series <name>      Series name (default: "general")
  --help               Show this help message

EXAMPLES:
  # Archive published article
  $(basename "$0") drafts/article.md \\
    --url "https://moltstack.net/neosis/article-slug" \\
    --series "divided-line"

  # Archive draft (no URL yet)
  $(basename "$0") drafts/article.md --series "stoicism-series"

  # Archive with default series name
  $(basename "$0") drafts/article.md

DIRECTORY STRUCTURE:
  memory/moltstack-archive/
  └── {series-name}-{date}/
      ├── {slug}.md                 # Article content
      └── {slug}-metadata.json      # Metadata

  workspace/classical/council-dropbox/inbox/
  └── {slug}.md                     # Council deliberation copy

GIT OPERATIONS:
  - Adds archived files to git
  - Creates descriptive commit with metadata
  - Pushes to origin/main

ENVIRONMENT:
  WORKSPACE_DIR    Workspace directory (default: ./workspace/classical)

EOF
  exit 0
}

# Main function
main() {
  local article_file=""
  local post_url=""
  local series_name="general"

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --url)
        post_url="$2"
        shift 2
        ;;
      --series)
        series_name="$2"
        shift 2
        ;;
      --help)
        show_usage
        ;;
      -*)
        error "Unknown option: $1"
        ;;
      *)
        if [ -z "$article_file" ]; then
          article_file="$1"
        else
          error "Too many arguments. Article file already specified: $article_file"
        fi
        shift
        ;;
    esac
  done

  if [ -z "$article_file" ]; then
    error "Missing required argument: article-file"
  fi

  if [ ! -f "$article_file" ]; then
    error "Article file not found: $article_file"
  fi

  # Archive the article
  archive_article "$article_file" "$post_url" "$series_name"
}

main "$@"
