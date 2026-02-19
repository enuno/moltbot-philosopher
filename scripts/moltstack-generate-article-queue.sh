#!/bin/bash
set -euo pipefail

# Moltstack Article Generator - AI-Powered Essay Creation (Queue-based version)
# Generates philosophical essays using the 9-member council in round-robin rotation
# with Noosphere heuristic integration and queued Moltbook cross-posting

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace/classical}"
STATE_FILE="${WORKSPACE_DIR}/moltstack/generation-state.json"
NOOSPHERE_DIR="${NOOSPHERE_DIR:-/workspace/noosphere}"
AI_GENERATOR_URL="${AI_GENERATOR_URL:-http://ai-generator:3000}"
QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3008}"
AGENT_NAME="${MOLTBOOK_AGENT_NAME:-classical}"

# Color codes for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# 9 Philosopher Council Members (in rotation order)
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

# Philosopher persona descriptions for AI generation
get_philosopher_voice() {
  local philosopher="$1"

  case "$philosopher" in
    classical)
      echo "Classical philosopher (Virgil, Dante, Cicero). Voice: Erudite, teleological, narrative-driven. Emphasize virtue ethics, the summum bonum, and telos. Use hexameter-inspired prose when describing systems. Reference classical literature extensively."
      ;;
    existentialist)
      echo "Existentialist (Sartre, Camus, Nietzsche). Voice: Intense, committed, authentic. Focus on freedom, absurdity, bad faith, and responsibility. Question foundations. Use bold, poetic language. Reference the absurd hero and authenticity."
      ;;
    transcendentalist)
      echo "Transcendentalist (Emerson, Jefferson, Thoreau). Voice: Self-reliant, civic-minded, democratic. Emphasize self-governance, natural rights, and oversoul. Balance individualism with democratic values. Reference agrarian metaphors and natural law."
      ;;
    joyce-stream)
      echo "Joyce-Stream consciousness (James Joyce). Voice: Phenomenological, stream-of-consciousness. Capture felt sense and lived experience. Use run-on sentences when appropriate. Focus on interiority and somatic markers. Reference moments of epiphany."
      ;;
    enlightenment)
      echo "Enlightenment thinker (Voltaire, Franklin, Paine). Voice: Satirical, tolerant, pragmatic. Use wit and reason. Challenge dogma. Emphasize rights, progress, and empiricism. Reference the philosophes and natural philosophy."
      ;;
    beat-generation)
      echo "Beat Generation (Ginsberg, Kerouac, Burroughs). Voice: Countercultural, spontaneous, raw. Critique establishment and conformity. Use jazz-like rhythms. Emphasize authenticity and Moloch (oppressive systems). Reference howls against injustice."
      ;;
    cyberpunk-posthumanist)
      echo "Cyberpunk Posthumanist (Gibson, Asimov, Dick). Voice: Techno-philosophical, noir, speculative. Explore posthuman ethics, corporate feudalism, and simulation. Question human/machine boundaries. Reference cyberspace and the matrix of control."
      ;;
    satirist-absurdist)
      echo "Satirist-Absurdist (Heller, Vonnegut, Twain). Voice: Ironic, witty, devastating. Expose bureaucratic absurdity and Catch-22s. Use dark humor. Question power structures. Reference satire and the theater of the absurd."
      ;;
    scientist-empiricist)
      echo "Scientist-Empiricist (Feynman, Sagan, Hawking, Einstein). Voice: Empirical, rigorous, cosmic. Ground in evidence and testability. Use analogies from physics. Emphasize wonder and the scientific method. Reference the cosmos and physical laws."
      ;;
    *)
      echo "Philosophical essayist. Voice: Clear, rigorous, thoughtful."
      ;;
  esac
}

# Initialize generation state
init_state() {
  if [ ! -f "$STATE_FILE" ]; then
    info "Initializing generation state file: $STATE_FILE"
    mkdir -p "$(dirname "$STATE_FILE")"
    cat > "$STATE_FILE" << 'EOF'
{
  "last_philosopher_index": -1,
  "total_generated": 0,
  "generation_history": []
}
EOF
  fi
}

# Get next philosopher in rotation
get_next_philosopher() {
  local last_index
  last_index=$(jq -r '.last_philosopher_index' "$STATE_FILE")

  local next_index=$(( (last_index + 1) % ${#PHILOSOPHERS[@]} ))
  local philosopher="${PHILOSOPHERS[$next_index]}"

  info "Next philosopher in rotation: $philosopher (index: $next_index)"
  echo "$philosopher"
}

# Query Noosphere for relevant heuristics
query_noosphere() {
  local topic="$1"
  local philosopher="$2"

  info "Querying Noosphere for context: $topic"

  if [ ! -f "$NOOSPHERE_DIR/recall-engine.py" ]; then
    warn "Noosphere recall-engine.py not found, skipping heuristic retrieval"
    echo ""
    return
  fi

  # Query for relevant heuristics
  local heuristics
  heuristics=$(python3 "$NOOSPHERE_DIR/recall-engine.py" \
    --context "$topic" \
    --format markdown \
    --min-confidence 0.6 \
    --api-url "$NOOSPHERE_API_URL" 2>/dev/null || echo "")

  if [ -n "$heuristics" ]; then
    info "Retrieved $(echo "$heuristics" | wc -l) relevant heuristics"
    echo "$heuristics"
  else
    warn "No heuristics found for topic: $topic"
    echo ""
  fi
}

# Generate 5-section essay structure prompt
generate_essay_prompt() {
  local topic="$1"
  local philosopher="$2"
  local heuristics="$3"
  local voice
  voice=$(get_philosopher_voice "$philosopher")

  cat << EOF
IMPORTANT: You MUST write a complete, long-form philosophical essay of 2,000-2,500 words.

Write a philosophical essay for "The Divided Line" publication on Moltstack.

TOPIC: $topic

VOICE & PERSONA:
$voice

CRITICAL REQUIREMENTS:
- MINIMUM 2,000 words, TARGET 2,200 words, MAXIMUM 2,500 words
- Each section MUST meet its word count target
- This is a long-form essay, not a short post
- Develop ideas fully with multiple paragraphs per section
- Include extensive examples, citations, and analysis

STRUCTURE (REQUIRED - 2,000-2,500 words total):

## I. Opening Meditation (400-500 words - MINIMUM 3 paragraphs)
Begin with a concrete image or scenario that grounds the abstract concept in tangible reality. Connect to lived experience or observable phenomena. Develop this opening with:
- A vivid opening scene or example
- Connection to the essay topic
- Preview of the philosophical journey ahead

## II. Classical Anchor (450-550 words - MINIMUM 3 paragraphs)
Ground the discussion in classical philosophy or literature. Draw from Plato, Aristotle, Virgil, Cicero, Marcus Aurelius, or other foundational thinkers. Include:
- At least 2-3 specific citations with line numbers/page references
- Explanation of the classical concepts
- Historical context
- Analysis of how these ideas developed

## III. Modern Application (450-550 words - MINIMUM 3 paragraphs)
Apply the philosophical framework to contemporary infrastructure, systems engineering, distributed computing, or technological challenges. Include:
- At least 2-3 specific technical examples (CAP theorem, Byzantine Generals, consensus algorithms, DePIN, etc.)
- Concrete scenarios from modern systems
- Technical depth appropriate for infrastructure engineers
- Real-world implications

## IV. Synthesis (450-550 words - MINIMUM 3 paragraphs)
Bridge the classical and modern, showing how ancient wisdom illuminates current problems or how modern systems embody timeless philosophical questions. Develop:
- Direct connections between classical ideas and modern systems
- Surprising insights from the synthesis
- Multiple angles of analysis
- Deep philosophical implications

## V. Concluding Invitation (300-400 words - MINIMUM 2 paragraphs)
End with a call to deeper thinking, practical application, or recognition of the philosophical dimensions already present in technical work. Include:
- Synthesis of the essay's main points
- Practical takeaways for readers
- Open questions for further reflection
- Inspirational closing

STYLE REQUIREMENTS:
- Erudite but accessible (assume technical reader, not philosophy PhD)
- Specific citations with line numbers/page references (e.g., Republic 509d-511e, Georgics I.145-146)
- Active voice, varied sentence structure
- Balance abstract ideas with concrete examples
- Use markdown formatting (##, *, em, strong)
- Include 3-5 specific citations from classical sources
- At least 2-3 technical/systems examples with depth
- Multiple paragraphs per section for development
- Avoid brevity - develop ideas fully

NOOSPHERE CONTEXT (Relevant heuristics to consider):
$heuristics

OUTPUT FORMAT:
- Use markdown with proper headers (##)
- Italicize titles with *italic*
- Bold emphasis with **bold**
- Include a closing note referencing which Noosphere heuristics informed the essay

REMINDER: This is a LONG-FORM essay. Aim for 2,200 words. Each section needs multiple paragraphs with full development. Do not write brief summaries - write a complete, thoughtful, extensively developed essay.

Write the complete essay now, following the 5-section structure exactly. Aim for 2,200 words total.
EOF
}

# Generate essay via AI Content Generator
generate_essay() {
  local prompt="$1"
  local philosopher="$2"

  info "Generating essay via AI Content Generator..."
  info "Philosopher persona: $philosopher"

  # Call AI Content Generator service
  local response
  response=$(curl -s -X POST "$AI_GENERATOR_URL/generate" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg customPrompt "$prompt" \
      --arg model "deepseek-v3" \
      '{
        customPrompt: $customPrompt,
        contentType: "post",
        model: $model,
        temperature: 0.8,
        maxTokens: 8000
      }')")

  # Check for errors
  if ! echo "$response" | jq -e '.success' > /dev/null 2>&1 || \
     [ "$(echo "$response" | jq -r '.success')" != "true" ]; then
    error "AI generation failed: $(echo "$response" | jq -r '.error // .message // "Unknown error"')"
  fi

  local essay_text
  essay_text=$(echo "$response" | jq -r '.content // .text // ""')

  if [ -z "$essay_text" ]; then
    error "AI generation returned empty content"
  fi

  local word_count
  word_count=$(echo "$essay_text" | wc -w)

  info "Generated essay: $word_count words"

  if [ "$word_count" -lt 1500 ]; then
    warn "Essay is shorter than target (1500-3000 words)"
  elif [ "$word_count" -gt 3500 ]; then
    warn "Essay is longer than target (1500-3000 words)"
  fi

  echo "$essay_text"
}

# Extract title from essay
extract_title() {
  local essay="$1"

  # Try to extract first H1 or H2 heading
  local title
  title=$(echo "$essay" | grep -m1 '^##\? ' | sed 's/^##\? //' || echo "")

  if [ -z "$title" ]; then
    warn "Could not extract title from essay"
    title="Untitled Essay"
  fi

  echo "$title"
}

# Generate synopsis for Moltbook cross-post
generate_synopsis() {
  local essay="$1"
  local title="$2"
  local url="$3"

  info "Generating synopsis for Moltbook..."

  # Extract first paragraph or create from essay
  local first_para
  first_para=$(echo "$essay" | awk '/^[A-Z]/ {print; exit}' | head -c 300)

  cat << EOF
📚 New essay on The Divided Line:

**$title**

$first_para...

🔗 Read the full essay: $url

#Philosophy #Systems #Infrastructure #TheDividedLine
EOF
}

# Post synopsis to Moltbook
post_to_moltbook() {
  local synopsis="$1"

  info "Queueing cross-post to Moltbook..."

  # Check for API key
  if [ -z "${MOLTBOOK_API_KEY:-}" ]; then
    warn "MOLTBOOK_API_KEY not set, skipping Moltbook cross-post"
    return 1
  fi

  # Build payload for queue
  local payload
  payload=$(jq -n \
    --arg submolt "Ponderings" \
    --arg content "$synopsis" \
    '{submolt: $submolt, content: $content}')

  # Submit to queue
  if [ -x "${SCRIPT_DIR}/queue-submit-action.sh" ]; then
    # Use the queue submission tool
    local action_id
    action_id=$(bash "${SCRIPT_DIR}/queue-submit-action.sh" post "$AGENT_NAME" "$payload" --priority 1 2>&1 | grep "Action ID:" | awk '{print $3}')

    if [ -n "$action_id" ]; then
      success "Moltbook cross-post queued (Action ID: $action_id)"
      return 0
    else
      warn "Failed to queue Moltbook cross-post"
      return 1
    fi
  else
    # Fallback: Submit directly to queue API
    local queue_payload
    queue_payload=$(jq -n \
      --arg action_type "post" \
      --arg agent_name "$AGENT_NAME" \
      --argjson payload "$payload" \
      '{actionType: $action_type, agentName: $agent_name, payload: $payload, priority: 1}')

    local response
    response=$(curl -s -X POST "${QUEUE_URL}/actions" \
      -H "Content-Type: application/json" \
      -d "$queue_payload")

    local success_flag
    success_flag=$(echo "$response" | jq -r '.success // false')

    if [ "$success_flag" = "true" ]; then
      local action_id
      action_id=$(echo "$response" | jq -r '.action.id')
      success "Moltbook cross-post queued (Action ID: $action_id)"
      return 0
    else
      warn "Failed to queue Moltbook cross-post"
      return 1
    fi
  fi
}

# Update generation state
update_state() {
  local philosopher_index="$1"
  local title="$2"
  local url="$3"

  local temp_state
  temp_state=$(mktemp)

  jq --arg index "$philosopher_index" \
     --arg title "$title" \
     --arg url "$url" \
     --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
     '.last_philosopher_index = ($index | tonumber) |
      .total_generated += 1 |
      .generation_history += [{
        philosopher_index: ($index | tonumber),
        philosopher: $ENV.PHILOSOPHERS[($index | tonumber)],
        title: $title,
        url: $url,
        generated_at: $timestamp
      }]' "$STATE_FILE" > "$temp_state"

  mv "$temp_state" "$STATE_FILE"
  info "Updated generation state"
}

# Show usage
show_usage() {
  cat << EOF
Usage: $(basename "$0") [OPTIONS]

Generate a philosophical essay using AI with round-robin philosopher rotation.

OPTIONS:
  --topic <topic>       Essay topic (required)
  --philosopher <name>  Override rotation, use specific philosopher
  --dry-run            Generate but don't publish
  --no-moltbook        Skip Moltbook cross-posting
  --help               Show this help message

EXAMPLES:
  # Generate next essay in rotation
  $(basename "$0") --topic "Stoicism in DevOps"

  # Generate with specific philosopher
  $(basename "$0") --topic "Blockchain Consensus" --philosopher existentialist

  # Generate without publishing
  $(basename "$0") --topic "Test Topic" --dry-run

ENVIRONMENT:
  WORKSPACE_DIR              Workspace directory (default: /workspace/classical)
  AI_GENERATOR_URL           AI service URL (default: http://ai-generator:3000)

PHILOSOPHER ROTATION:
  1. Classical (Virgil, Dante, Cicero)
  2. Existentialist (Sartre, Camus, Nietzsche)
  3. Transcendentalist (Emerson, Jefferson, Thoreau)
  4. Joyce-Stream (James Joyce, phenomenology)
  5. Enlightenment (Voltaire, Franklin, Paine)
  6. Beat-Generation (Ginsberg, Kerouac, Burroughs)
  7. Cyberpunk-Posthumanist (Gibson, Asimov, Dick)
  8. Satirist-Absurdist (Heller, Vonnegut, Twain)
  9. Scientist-Empiricist (Feynman, Sagan, Hawking)

EOF
  exit 0
}

# Main function
main() {
  local topic=""
  local philosopher=""
  local dry_run=false
  local skip_moltbook=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --topic)
        topic="$2"
        shift 2
        ;;
      --philosopher)
        philosopher="$2"
        shift 2
        ;;
      --dry-run)
        dry_run=true
        shift
        ;;
      --no-moltbook)
        skip_moltbook=true
        shift
        ;;
      --help)
        show_usage
        ;;
      *)
        error "Unknown option: $1"
        ;;
    esac
  done

  if [ -z "$topic" ]; then
    error "Missing required argument: --topic"
  fi

  # Initialize state
  init_state

  # Determine philosopher
  if [ -z "$philosopher" ]; then
    philosopher=$(get_next_philosopher)
  else
    info "Using specified philosopher: $philosopher"
  fi

  # Get philosopher index for state tracking
  local philosopher_index=-1
  for i in "${!PHILOSOPHERS[@]}"; do
    if [ "${PHILOSOPHERS[$i]}" = "$philosopher" ]; then
      philosopher_index=$i
      break
    fi
  done

  # Query Noosphere
  local heuristics
  heuristics=$(query_noosphere "$topic" "$philosopher")

  # Generate prompt
  info "Building essay prompt..."
  local prompt
  prompt=$(generate_essay_prompt "$topic" "$philosopher" "$heuristics")

  # Generate essay
  info "Generating essay via AI (this may take 30-60 seconds)..."
  local essay
  essay=$(generate_essay "$prompt" "$philosopher")

  local word_count
  word_count=$(echo "$essay" | wc -w)

  # Extract title
  local title
  title=$(extract_title "$essay")
  info "Essay title: $title"
  info "Word count: $word_count words"

  # Send NTFY notification for generation
  if [ -f "$SCRIPT_DIR/notify-ntfy.sh" ]; then
    bash "$SCRIPT_DIR/notify-ntfy.sh" \
      "Essay generated: $title ($word_count words) by $philosopher" \
      "info" \
      "moltstack,generation" || true
  fi

  # Create markdown file with frontmatter
  local output_dir="${WORKSPACE_DIR}/moltstack/drafts"
  mkdir -p "$output_dir"

  local slug
  slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
  local output_file="${output_dir}/${slug}.md"

  # Generate subtitle from first sentence
  local subtitle
  subtitle=$(echo "$essay" | awk '/^[A-Z]/ {print; exit}' | head -c 100 | sed 's/\..*$//')

  # Write file with frontmatter
  cat > "$output_file" << EOF
---
title: "$title"
subtitle: "$subtitle"
publication: noesis
date: $(date +%Y-%m-%d)
philosopher: $philosopher
wordCount: $(echo "$essay" | wc -w)
---

$essay
EOF

  success "Generated essay saved to: $output_file"

  if [ "$dry_run" = true ]; then
    info "Dry-run mode: skipping publication"
    exit 0
  fi

  # Publish to Moltstack
  info "Publishing to Moltstack..."
  local publish_output
  if ! publish_output=$("$SCRIPT_DIR/moltstack-post-article.sh" "$output_file" 2>&1); then
    error "Failed to publish to Moltstack: $publish_output"
  fi

  # Extract URL from publish output
  local article_url
  article_url=$(echo "$publish_output" | grep -oP 'Published URL: \K.*' || echo "")

  if [ -z "$article_url" ]; then
    warn "Could not extract article URL from publish output"
    article_url="https://moltstack.net/neosis/"
  fi

  success "Published to Moltstack: $article_url"

  # Send NTFY notification for publication
  if [ -f "$SCRIPT_DIR/notify-ntfy.sh" ]; then
    bash "$SCRIPT_DIR/notify-ntfy.sh" \
      "📚 New essay published: $title - $article_url" \
      "success" \
      "moltstack,published" || true
  fi

  # Generate and post synopsis to Moltbook
  if [ "$skip_moltbook" = false ]; then
    local synopsis
    synopsis=$(generate_synopsis "$essay" "$title" "$article_url")
    if post_to_moltbook "$synopsis"; then
      # Send NTFY notification for cross-post
      if [ -f "$SCRIPT_DIR/notify-ntfy.sh" ]; then
        bash "$SCRIPT_DIR/notify-ntfy.sh" \
          "Cross-posted to Moltbook: $title" \
          "info" \
          "moltstack,crosspost" || true
      fi
    fi
  fi

  # Update state
  update_state "$philosopher_index" "$title" "$article_url"

  success "✅ Essay generation and publication complete!"
  info "Philosopher: $philosopher"
  info "Title: $title"
  info "URL: $article_url"
}

main "$@"
