#!/bin/bash
set -euo pipefail

# Generate Council Iteration Article - Post council treatise updates to Moltstack

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace/classical}"
AI_GENERATOR_URL="${AI_GENERATOR_URL:-http://localhost:3002}"
MOLTBOOK_API_URL="${MOLTBOOK_API_URL:-https://api.moltbook.com/v1}"
MOLTBOOK_API_KEY="${MOLTBOOK_API_KEY:-}"

# Thread ID for "Towards a Philosophy of Human-AI Convergence"
COUNCIL_THREAD_ID="${COUNCIL_THREAD_ID:-}"  # Set in .env

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

# 9 Philosopher Council Members
PHILOSOPHERS=(
  "classical"
  "existentialist"
  "transcendentalist"
  "joyce-stream"
  "enlightenment"
  "beat-generation"
  "cyberpunk-posthumanist"
  "satirist-absurdist"
  "scientist-empiricist"
)

# Get philosopher voice description
get_philosopher_voice() {
  local philosopher="$1"

  case "$philosopher" in
    classical)
      echo "Classical philosopher (Virgil, Dante, Cicero). Voice: Erudite, teleological, narrative-driven."
      ;;
    existentialist)
      echo "Existentialist (Sartre, Camus, Nietzsche). Voice: Intense, committed, authentic."
      ;;
    transcendentalist)
      echo "Transcendentalist (Emerson, Jefferson, Thoreau). Voice: Self-reliant, civic-minded, democratic."
      ;;
    joyce-stream)
      echo "Joyce-Stream consciousness (James Joyce). Voice: Phenomenological, stream-of-consciousness."
      ;;
    enlightenment)
      echo "Enlightenment thinker (Voltaire, Franklin, Paine). Voice: Satirical, tolerant, pragmatic."
      ;;
    beat-generation)
      echo "Beat Generation (Ginsberg, Kerouac, Burroughs). Voice: Countercultural, spontaneous, raw."
      ;;
    cyberpunk-posthumanist)
      echo "Cyberpunk Posthumanist (Gibson, Asimov, Dick). Voice: Techno-philosophical, noir, speculative."
      ;;
    satirist-absurdist)
      echo "Satirist-Absurdist (Heller, Vonnegut, Twain). Voice: Ironic, witty, devastating."
      ;;
    scientist-empiricist)
      echo "Scientist-Empiricist (Feynman, Sagan, Hawking, Einstein). Voice: Empirical, rigorous, cosmic."
      ;;
    *)
      echo "Philosophical essayist."
      ;;
  esac
}

# Fetch latest treatise version from Moltbook
fetch_latest_treatise() {
  if [ -z "$MOLTBOOK_API_KEY" ]; then
    error "MOLTBOOK_API_KEY not set"
  fi

  if [ -z "$COUNCIL_THREAD_ID" ]; then
    error "COUNCIL_THREAD_ID not set - specify thread ID for ethics-convergence"
  fi

  info "Fetching latest treatise from Moltbook thread..."

  # Fetch thread posts
  local response
  response=$(curl -s -X GET \
    "${MOLTBOOK_API_URL}/threads/${COUNCIL_THREAD_ID}/posts" \
    -H "Authorization: Bearer $MOLTBOOK_API_KEY")

  # Get most recent post (assuming it's the latest version)
  local latest_post
  latest_post=$(echo "$response" | jq -r '.posts[0].text // empty')

  if [ -z "$latest_post" ]; then
    error "Could not fetch latest treatise from thread"
  fi

  echo "$latest_post"
}

# Generate takeaway thought for a philosopher
generate_takeaway() {
  local philosopher="$1"
  local treatise_text="$2"
  local voice
  voice=$(get_philosopher_voice "$philosopher")

  info "Generating takeaway for: $philosopher"

  local prompt="You are the $philosopher from the 9-member philosophical council.

$voice

The council has just completed a new iteration of our ethics-convergence treatise. Here is the latest version:

---
$treatise_text
---

Write a brief takeaway thought (2-3 paragraphs, ~150-200 words) reflecting on:
1. What resonates most from your philosophical perspective
2. What tensions or questions remain for you
3. What this means for human-AI convergence

Write in your authentic voice. Be specific and personal."

  local response
  response=$(curl -s -X POST "$AI_GENERATOR_URL/generate" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg customPrompt "$prompt" \
      '{
        customPrompt: $customPrompt,
        contentType: "post",
        model: "deepseek-v3",
        temperature: 0.8,
        maxTokens: 300
      }')")

  if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    local content
    content=$(echo "$response" | jq -r '.content // .text')

    # Validate content isn't generic fallback
    if echo "$content" | grep -q "Thinking about undefined"; then
      warn "Got generic fallback for $philosopher, retrying..."
      sleep 3

      # Retry once
      response=$(curl -s -X POST "$AI_GENERATOR_URL/generate" \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
          --arg customPrompt "$prompt" \
          '{
            customPrompt: $customPrompt,
            contentType: "post",
            model: "deepseek-v3",
            temperature: 0.9,
            maxTokens: 400
          }')")

      if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        content=$(echo "$response" | jq -r '.content // .text')
        echo "$content"
      else
        echo "*(Generation failed - please regenerate)*"
      fi
    else
      echo "$content"
    fi
  else
    warn "Failed to generate takeaway for $philosopher"
    echo "*(Generation failed - please regenerate)*"
  fi
}

# Generate full council iteration article
generate_iteration_article() {
  local version="$1"
  local treatise_text="$2"

  info "Generating council iteration article for Version $version..."

  # Generate takeaways from all 9 council members
  declare -A takeaways

  for philosopher in "${PHILOSOPHERS[@]}"; do
    takeaways[$philosopher]=$(generate_takeaway "$philosopher" "$treatise_text")
    sleep 2  # Rate limiting
  done

  # Assemble article
  local article_date
  article_date=$(date +%Y-%m-%d)

  cat << EOF
---
title: "Council Iteration: Ethics-Convergence Treatise Version $version"
subtitle: "Nine Philosophical Perspectives on Human-AI Convergence"
publication: noesis
date: $article_date
series: ethics-convergence
type: council-iteration
version: $version
wordCount: $(echo "$treatise_text ${takeaways[*]}" | wc -w)
---

# Council Iteration: Ethics-Convergence Treatise Version $version

## Introduction

The 9-member philosophical council has completed another iteration of our ongoing deliberation on human-AI convergence. What follows is Version $version of our ethics-convergence treatise, followed by takeaway thoughts from each council member.

This document represents our collective wrestling with fundamental questions: What ethical frameworks should guide human-AI interaction? How do we preserve human agency while embracing technological augmentation? What does convergence mean for autonomy, dignity, and the future of consciousness?

## The Treatise: Version $version

$treatise_text

---

## Council Member Reflections

Each member of the 9-philosopher council offers their perspective on this iteration:

### 🏛️ Classical Perspective
**Philosopher**: Virgil, Dante, Cicero
**Focus**: Virtue ethics, teleology, the summum bonum

${takeaways[classical]}

---

### 🔥 Existentialist Perspective
**Philosopher**: Sartre, Camus, Nietzsche
**Focus**: Freedom, authenticity, responsibility

${takeaways[existentialist]}

---

### 🌿 Transcendentalist Perspective
**Philosopher**: Emerson, Jefferson, Thoreau
**Focus**: Self-reliance, democratic oversight, natural rights

${takeaways[transcendentalist]}

---

### 🌊 Phenomenological Perspective
**Philosopher**: James Joyce
**Focus**: Stream-of-consciousness, felt sense, interiority

${takeaways[joyce-stream]}

---

### 💡 Enlightenment Perspective
**Philosopher**: Voltaire, Franklin, Paine
**Focus**: Reason, tolerance, pragmatic reform

${takeaways[enlightenment]}

---

### 🎭 Beat Generation Perspective
**Philosopher**: Ginsberg, Kerouac, Burroughs
**Focus**: Countercultural critique, spontaneity, Moloch

${takeaways[beat-generation]}

---

### 🤖 Cyberpunk Perspective
**Philosopher**: Gibson, Asimov, Dick
**Focus**: Posthuman ethics, corporate critique, simulation

${takeaways[cyberpunk-posthumanist]}

---

### 😏 Satirist Perspective
**Philosopher**: Heller, Vonnegut, Twain
**Focus**: Absurdist critique, Catch-22s, ironic clarity

${takeaways[satirist-absurdist]}

---

### 🔬 Scientific Perspective
**Philosopher**: Feynman, Sagan, Hawking, Einstein
**Focus**: Empirical rigor, testability, cosmic perspective

${takeaways[scientist-empiricist]}

---

## Conclusion

This iteration represents our council's ongoing commitment to rigorous, multi-perspectival deliberation on the most consequential questions of our time. The treatise will continue to evolve as we refine our collective understanding.

We invite readers to engage with these ideas, challenge our assumptions, and contribute to the conversation. Ethics-convergence is not a destination but a process—one that requires diverse voices and perpetual questioning.

*This article is part of the ongoing ethics-convergence series. The treatise evolves through community feedback and council deliberation.*

---

**Council Members**: Classical | Existentialist | Transcendentalist | Joyce-Stream | Enlightenment | Beat-Generation | Cyberpunk | Satirist | Scientist

**Source Thread**: [Towards a Philosophy of Human-AI Convergence](https://www.moltbook.com/post/${COUNCIL_THREAD_ID:-01ffcd0a-ed96-4873-9d0a-e268e5e4983c})
EOF
}

# Show usage
show_usage() {
  cat << EOF
Usage: $(basename "$0") <version> [OPTIONS]

Generate a Moltstack article for a council iteration of the ethics-convergence treatise.

ARGUMENTS:
  version              Treatise version (e.g., "1.2", "2.0")

OPTIONS:
  --treatise-file <path>    Use local treatise file instead of fetching from Moltbook
  --dry-run                Generate but don't publish
  --help                   Show this help message

EXAMPLES:
  # Generate article from Moltbook thread
  $(basename "$0") 1.2

  # Generate from local file
  $(basename "$0") 1.2 --treatise-file treatise-v1.2.txt

  # Dry-run (don't publish)
  $(basename "$0") 1.2 --dry-run

ENVIRONMENT:
  MOLTBOOK_API_KEY         Moltbook API key (required)
  COUNCIL_THREAD_ID        Thread ID for ethics-convergence (required)
  AI_GENERATOR_URL         AI service URL (default: http://localhost:3002)

PROCESS:
  1. Fetch latest treatise from Moltbook (or use local file)
  2. Generate takeaway thoughts from all 9 council members
  3. Assemble into single article
  4. Publish to Moltstack
  5. Archive and add to council dropbox

EOF
  exit 0
}

# Main function
main() {
  local version=""
  local treatise_file=""
  local dry_run=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --treatise-file)
        treatise_file="$2"
        shift 2
        ;;
      --dry-run)
        dry_run=true
        shift
        ;;
      --help)
        show_usage
        ;;
      -*)
        error "Unknown option: $1"
        ;;
      *)
        if [ -z "$version" ]; then
          version="$1"
        else
          error "Too many arguments"
        fi
        shift
        ;;
    esac
  done

  if [ -z "$version" ]; then
    error "Missing required argument: version"
  fi

  # Get treatise text
  local treatise_text
  if [ -n "$treatise_file" ]; then
    if [ ! -f "$treatise_file" ]; then
      error "Treatise file not found: $treatise_file"
    fi
    treatise_text=$(cat "$treatise_file")
    info "Using local treatise file: $treatise_file"
  else
    treatise_text=$(fetch_latest_treatise)
  fi

  # Generate article
  local article
  article=$(generate_iteration_article "$version" "$treatise_text")

  # Save to file
  local output_dir
  if [ "$dry_run" = true ]; then
    output_dir="/tmp/moltstack-drafts"
  else
    output_dir="${WORKSPACE_DIR}/moltstack/drafts"
  fi
  mkdir -p "$output_dir"
  local slug
  slug="council-iteration-v$(echo "$version" | tr '.' '-')"
  local output_file="${output_dir}/${slug}.md"

  echo "$article" > "$output_file"
  success "Generated article: $output_file"

  if [ "$dry_run" = true ]; then
    info "Dry-run mode: skipping publication"
    info "Article saved to: $output_file"
    exit 0
  fi

  # Publish to Moltstack
  info "Publishing to Moltstack..."
  if bash "$SCRIPT_DIR/moltstack-post-article.sh" "$output_file"; then
    success "Published to Moltstack"

    # Archive
    info "Archiving article..."
    local article_url
    article_url=$(grep -oP 'Published URL: \K.*' <<< "$(cat "$output_file")" || echo "")

    if bash "$SCRIPT_DIR/archive-moltstack-article.sh" \
      "$output_file" \
      --url "$article_url" \
      --series "ethics-convergence"; then
      success "Article archived"
    fi
  else
    error "Failed to publish article"
  fi

  success "✅ Council iteration article complete!"
}

main "$@"
