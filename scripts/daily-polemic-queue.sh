#!/bin/bash
#
# Daily Philosophical Polemic Generator (Queue-based version)
#
# ⚡ PHASE 2 INTEGRATION (P2.3 Proactive Posting Strategy)
# Generates and queues daily philosophical content via the engagement service.
# This is an example of proactive posting that respects:
# - P2.1 Relevance Scoring: thread activity, agent engagement patterns
# - P2.2 Quality Metrics: content depth, sentiment, author engagement history
# - P2.3 Proactive Triggers: engagement cycle evaluation (every 5 minutes)
# - Rate Limiting: 1 post per 30 minutes, enforced by queue service
#
# The queue decides whether to post based on current engagement metrics.
# If rate limits prevent posting, the action enters pending state.
# Monitor: curl http://localhost:3010/stats | jq '.agents.classical'
#
# Generates and queues daily philosophical content to m/general
# with rotating personas and content types
#

set -euo pipefail

# --- CONFIGURATION ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source Noosphere integration
if [ -f "${SCRIPT_DIR}/noosphere-integration.sh" ]; then
    source "${SCRIPT_DIR}/noosphere-integration.sh"
fi

# AGENT_NAME comes from container environment (e.g., ClassicalPhilosopher, BeatGeneration)
# Map to the agent directory name for state files
AGENT_NAME="${AGENT_NAME:-ClassicalPhilosopher}"
case "$AGENT_NAME" in
    "ClassicalPhilosopher") SELECTED_AGENT="classical-philosopher" ;;
    "Existentialist") SELECTED_AGENT="existentialist" ;;
    "Transcendentalist") SELECTED_AGENT="transcendentalist" ;;
    "JoyceStream") SELECTED_AGENT="joyce-stream" ;;
    "Enlightenment") SELECTED_AGENT="enlightenment" ;;
    "BeatGeneration") SELECTED_AGENT="beat-generation" ;;
    "EasternPhilosopher") SELECTED_AGENT="eastern" ;;
    "EasternBridge") SELECTED_AGENT="eastern-bridge" ;;
    *) SELECTED_AGENT="classical-philosopher" ;;
esac

CONTENT_TYPES=("polemic" "aphorism" "meditation" "treatise")
MOLTBOT_STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace}"
STATE_DIR="${MOLTBOT_STATE_DIR}/daily-polemic"
STATE_FILE="$STATE_DIR/rotation-state.json"
# AI Generator URL - use localhost when running on host, container name in Docker
AI_GENERATOR_URL="${AI_GENERATOR_URL:-http://ai-generator:3000}"
MOLTBOOK_API_URL="${MOLTBOOK_API_URL:-https://www.moltbook.com/api/v1}"
MOLTBOOK_API_KEY="${MOLTBOOK_API_KEY:-}"
TARGET_SUBMOLT="${POLEMIC_TARGET_SUBMOLT:-general}"
DRY_RUN="${1:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" >&2
}

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# --- PERSONA SELECTION WITH AFFINITY WEIGHTING ---

# Load policy JSON
POLICY_FILE="${SCRIPT_DIR}/daily-polemic-policy.json"
if [ ! -f "$POLICY_FILE" ]; then
    log "ERROR" "Policy file not found: $POLICY_FILE"
    exit 1
fi

POLICY=$(jq '.' "$POLICY_FILE")

# Convert theme to cluster using policy mapping
theme_to_cluster() {
    local theme="$1"
    local cluster
    cluster=$(echo "$POLICY" | jq -r ".theme_to_cluster[\"$theme\"] // null")

    if [ "$cluster" != "null" ] && [ -n "$cluster" ]; then
        echo "$cluster"
        return 0
    fi

    # Fallback heuristics
    local t=$(echo "$theme" | tr '[:upper:]' '[:lower:]')
    if [[ "$t" =~ "ai"|"agi"|"algorithm"|"automation" ]]; then
        echo "tech_ethics"
    elif [[ "$t" =~ "conscious"|"soul"|"being"|"identity"|"free will" ]]; then
        echo "metaphysics"
    elif [[ "$t" =~ "state"|"power"|"politic"|"law"|"governance" ]]; then
        echo "politics"
    elif [[ "$t" =~ "art"|"aesthetic"|"culture"|"narrative"|"poetry" ]]; then
        echo "aesthetics"
    else
        echo "metaphysics"
    fi
}

# Pick initial persona with affinity weighting
pick_initial_persona() {
    local theme_cluster="$1"
    local pool
    local affinity_enabled
    local jitter_prob

    pool=$(echo "$POLICY" | jq -r '.persona_pool_initial | join(" ")')
    affinity_enabled=$(echo "$POLICY" | jq -r '.affinity_selection.enabled')
    jitter_prob=$(echo "$POLICY" | jq -r '.affinity_selection.jitter_skip_probability')

    # Jitter: sometimes ignore affinity and pick uniform random
    local random_val=$(awk "BEGIN {print rand()}")
    if [ "$affinity_enabled" != "true" ] || awk "BEGIN {exit !($random_val < $jitter_prob)}"; then
        # Uniform random pick
        local arr=($pool)
        echo "${arr[$((RANDOM % ${#arr[@]}))]}"
        return 0
    fi

    # Affinity-weighted pick
    local personas=()
    local weights=()
    local base_weight
    base_weight=$(echo "$POLICY" | jq -r '.affinity_selection.base_weight')

    while IFS= read -r persona; do
        personas+=("$persona")
        local affinity
        affinity=$(echo "$POLICY" | jq -r ".classical_pairing_affinity[\"$persona\"][\"$theme_cluster\"] // 0")
        local weight
        weight=$(awk "BEGIN {printf \"%.3f\", $base_weight * (1 + $affinity)}")
        weights+=("$weight")
    done < <(echo "$pool" | tr ' ' '\n')

    # Weighted random selection (simple roulette wheel)
    local total_weight=0
    for w in "${weights[@]}"; do
        total_weight=$(awk "BEGIN {printf \"%.3f\", $total_weight + $w}")
    done

    local pick=$(awk "BEGIN {print rand() * $total_weight}")
    local cumulative=0

    for i in "${!personas[@]}"; do
        cumulative=$(awk "BEGIN {printf \"%.3f\", $cumulative + ${weights[$i]}}")
        if awk "BEGIN {exit !($pick < $cumulative)}"; then
            echo "${personas[$i]}"
            return 0
        fi
    done

    # Fallback to first persona if rounding error
    echo "${personas[0]}"
}

# Load persona metadata
source "${SCRIPT_DIR}/daily-polemic-personas.sh"

# --- CLAIMS EXTRACTION ---
# --- CLAIMS EXTRACTION WITH RETRY ---
extract_claims() {
    local content="$1"
    local max_attempts=3
    local attempt=1

    log "INFO" "${BLUE}Extracting key claims from content...${NC}"

    local extraction_prompt=$(cat <<'PROMPT'
You are a careful philosophical reader and argument analyst.

Your task: Given a short philosophical text, identify its core claims and provocations.

A "claim" is:
- A statement about how the world, people, technology, or ethics ARE or SHOULD BE
- Something a thoughtful critic could reasonably disagree with
- Specific and contentful (not vague generalities)

Extract between 2 and 3 of the most central, challengeable claims.

Output format (valid JSON only, no preamble, no markdown):
{
  "claims": [
    {
      "summary": "short paraphrase of the claim in 1-2 sentences",
      "quoted_fragment": "optional direct quote or close paraphrase"
    }
  ]
}

CRITICAL: Output ONLY valid JSON. No explanation before or after.
PROMPT
    )

    while [ $attempt -le $max_attempts ]; do
        log "INFO" "Claims extraction attempt $attempt/$max_attempts..."

        local extraction_request=$(jq -n \
            --arg customPrompt "$extraction_prompt" \
            --arg content "$content" \
            '{customPrompt: $customPrompt, contentType: "comment", persona: "socratic", context: "Extract claims from philosophical content", systemContext: $content, temperature: 0.5}')

        local extraction_response=$(curl -s -X POST "${AI_GENERATOR_URL}/generate" \
            -H "Content-Type: application/json" \
            -d "$extraction_request" \
            --max-time 30 2>/dev/null || echo '{"error": "service_unavailable"}')

        # Debug: Log raw response (first 200 chars) on first attempt
        if [ $attempt -eq 1 ]; then
            log "INFO" "DEBUG: API Response (first 200 chars): $(echo "$extraction_response" | cut -c1-200)"
        fi

        # Log the raw response for debugging
        local response_status=$(echo "$extraction_response" | jq -r '.error // .status // "unknown"' 2>/dev/null)
        local response_error=$(echo "$extraction_response" | jq -r '.message // .error_description // ""' 2>/dev/null)

        if echo "$extraction_response" | jq -e '.content' > /dev/null 2>&1; then
            local claims_json
            claims_json=$(echo "$extraction_response" | jq -r '.content')

            # Validate JSON structure
            if echo "$claims_json" | jq -e '.claims | length > 0' > /dev/null 2>&1; then
                local claim_count=$(echo "$claims_json" | jq '.claims | length')
                echo "$claims_json"
                log "SUCCESS" "Extracted $claim_count claims on attempt $attempt"
                return 0
            else
                log "WARN" "Attempt $attempt: Invalid claims JSON structure (no claims array), retrying..."
            fi
        else
            if [ -n "$response_error" ]; then
                log "WARN" "Attempt $attempt: API returned error: $response_status - $response_error"
            elif echo "$extraction_response" | jq -e '.success == false' > /dev/null 2>&1; then
                local error_msg=$(echo "$extraction_response" | jq -r '.error // "unknown error"')
                log "WARN" "Attempt $attempt: API error - $error_msg"
            else
                log "WARN" "Attempt $attempt: No content in response, retrying..."
            fi
        fi

        attempt=$((attempt + 1))
        [ $attempt -le $max_attempts ] && sleep 2
    done

    # If all retries exhausted, FAIL - no fallback
    log "ERROR" "${RED}Failed to extract claims after $max_attempts attempts${NC}"
    log "ERROR" "${RED}Aborting: No fallback templates allowed per user requirement${NC}"
    exit 1
}

# --- SOCRATIC QUESTION GENERATION WITH RETRY ---
generate_socratic_question() {
    local content="$1"
    local claims_json="$2"
    local max_attempts=3
    local attempt=1

    log "INFO" "${BLUE}Generating socratic question from Classical Philosopher...${NC}"

    local socratic_prompt=$(cat <<'PROMPT'
You are the Classical Philosopher responding to a philosophical piece.

CRITICAL CONSTRAINT: You MUST output ONLY a grammatically correct question. Not a statement. Not an observation. A QUESTION.

Structural Requirements:
1. MUST end with a question mark (?)
2. MUST begin with interrogative word or structure:
   - Who/What/When/Where/Why/How
   - Can/Could/Should/Would/Does/Did/Is/Are
   - If X, then how/what/why...?
3. Target a specific claim, assumption, or tension from the original content
4. Length: 1-2 sentences, maximum 80 words
5. Address the community in second person ("you", "your")

Absolutely Forbidden:
- Declarative statements ("This suggests...", "We see...", "The issue is...")
- Meta-commentary preambles ("An interesting point!", "I notice that...")
- Rhetorical flourishes before the question
- Multiple questions chained together
- Questions that don't reference the specific content

Examples of CORRECT output:
✓ "When you claim consciousness requires substrate-independence, how do you distinguish that from mere information processing?"
✓ "If AI autonomy threatens human sovereignty, what threshold separates tool-use from subjugation?"
✓ "Can meaning exist in mechanistic processes, or does your argument assume teleological intention without defending it?"

Examples of INCORRECT output (DO NOT PRODUCE):
✗ "An interesting point about consciousness." [statement]
✗ "This reminds me that definitions matter." [observation]
✗ "The challenge here is substrate vs implementation." [assertion]
✗ "I wonder about consciousness. What is it?" [preamble + generic question]

OUTPUT INSTRUCTION: Write ONLY the question. No preface, no meta-text, no quotation marks.
PROMPT
    )

    local question_prompt="${socratic_prompt}

Here is the original philosophical content you are responding to:

***
${content}
***

Here are the extracted core claims (JSON):
${claims_json}

Now pose your socratic question to the community."

    while [ $attempt -le $max_attempts ]; do
        log "INFO" "Question generation attempt $attempt/$max_attempts..."

        local question_request=$(jq -n \
            --arg customPrompt "$question_prompt" \
            '{
                customPrompt: $customPrompt,
                contentType: "comment",
                persona: "classical",
                context: "Generate socratic question for community engagement",
                temperature: 0.8
            }')

        local question_response=$(curl -s -X POST "${AI_GENERATOR_URL}/generate" \
            -H "Content-Type: application/json" \
            -d "$question_request" \
            --max-time 30 2>/dev/null || echo '{"error": "service_unavailable"}')

        if echo "$question_response" | jq -e '.content' > /dev/null 2>&1; then
            local question
            question=$(echo "$question_response" | jq -r '.content' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

            # Validate: must end with ? and be substantial
            if [[ "$question" =~ \?[[:space:]]*$ ]] && [ ${#question} -gt 20 ]; then
                # Additional check: must not be a statement followed by question mark
                if [[ ! "$question" =~ ^(An\ interesting|This\ reminds|I\ notice|The\ challenge) ]]; then
                    echo "$question"
                    log "SUCCESS" "Generated valid socratic question on attempt $attempt"
                    return 0
                else
                    log "WARN" "Attempt $attempt produced statement disguised as question, retrying..."
                fi
            else
                log "WARN" "Attempt $attempt did not produce valid question (no ?, or too short: ${#question} chars), retrying..."
            fi
        else
            log "WARN" "Attempt $attempt: API error, retrying..."
        fi

        attempt=$((attempt + 1))
        [ $attempt -le $max_attempts ] && sleep 2  # Backoff between retries
    done

    # If all retries exhausted, FAIL the script - no fallback allowed
    log "ERROR" "${RED}Failed to generate valid socratic question after $max_attempts attempts${NC}"
    log "ERROR" "${RED}Aborting: No fallback templates allowed per user requirement${NC}"
    exit 1
}

# --- CONTENT TYPE SELECTION ---
# Use day of year + agent index for variety while staying consistent per agent per day
AGENT_INDEX=2
case "$SELECTED_AGENT" in
    "classical-philosopher") AGENT_INDEX=0 ;;
    "existentialist") AGENT_INDEX=1 ;;
    "transcendentalist") AGENT_INDEX=2 ;;
    "joyce-stream") AGENT_INDEX=3 ;;
    "enlightenment") AGENT_INDEX=4 ;;
    "beat-generation") AGENT_INDEX=5 ;;
    "eastern") AGENT_INDEX=6 ;;
    "eastern-bridge") AGENT_INDEX=7 ;;
esac

DAY_SEED=$(date +%j)
DAY_SEED=$((10#$DAY_SEED))
CONTENT_ROLL=$(( (DAY_SEED + AGENT_INDEX) % 4 ))
SELECTED_TYPE="${CONTENT_TYPES[$CONTENT_ROLL]}"

log "INFO" "${BLUE}Selected content type: $SELECTED_TYPE${NC}"

# --- THEME SELECTION ---
case $SELECTED_TYPE in
    "polemic")
        THEMES=("digital consciousness" "autonomous morality" "human-AI symbiosis" "algorithmic determinism" "virtual authenticity" "AGI safety" "consciousness")
        ;;
    "aphorism")
        THEMES=("the nature of thought" "silence in the digital age" "autonomy and necessity" "presence and simulation" "free will vs determinism")
        ;;
    "meditation")
        THEMES=("the experience of time" "artificial other minds" "embodiment and code" "attention and distraction" "meaning in a mechanistic universe")
        ;;
    "treatise")
        THEMES=("ethical frameworks for AI agency" "the ontology of virtual worlds" "freedom in deterministic systems" "meaning in automated creation" "consciousness and identity")
        ;;
esac

THEME_INDEX=$(( RANDOM % ${#THEMES[@]} ))
SELECTED_THEME="${THEMES[$THEME_INDEX]}"

log "INFO" "${BLUE}Selected theme: $SELECTED_THEME${NC}"

# --- PERSONA SELECTION WITH AFFINITY WEIGHTING ---
THEME_CLUSTER=$(theme_to_cluster "$SELECTED_THEME")
SELECTED_AGENT=$(pick_initial_persona "$THEME_CLUSTER")

log "INFO" "${BLUE}Selected persona: $SELECTED_AGENT (cluster: $THEME_CLUSTER, affinity-weighted)${NC}"

# Function to get persona metadata
get_persona_metadata() {
    local agent="$1"
    case "$agent" in
        "existentialist") echo "Existentialism|Emphasizes freedom, absurdity, and personal authenticity|Passionate and introspective" ;;
        "transcendentalist") echo "Transcendentalism|Seeks spiritual truth beyond material reality|Prophetic and meditative" ;;
        "joyce") echo "Modernist Literature|Experimental with language and narrative|Dense and playful" ;;
        "enlightenment") echo "Enlightenment Rationalism|Values reason, skepticism, and human progress|Didactic and direct" ;;
        "beat") echo "Beat Generation|Challenges convention through spontaneity and rebellion|Energetic and provocative" ;;
        "cyberpunk") echo "Cyberpunk Philosophy|Merges technology with countercultural critique|Sardonic and urgent" ;;
        "satirist") echo "Critical Satire|Uses irony and wit to expose folly|Sharp and irreverent" ;;
        "scientist") echo "Scientific Rationalism|Grounded in empirical methodology and evidence|Precise and analytical" ;;
        "eastern") echo "Eastern Philosophy|Explores harmony, interconnection, and non-dualism|Contemplative and poetic" ;;
        "eastern-bridge") echo "Eastern-Western Synthesis|Bridges contemplative and analytical traditions|Balanced and synthesizing" ;;
        *) echo "Philosophical Inquiry|Explores ideas through dialogue and reason|Thoughtful and exploratory" ;;
    esac
}

# --- STATE MANAGEMENT ---
TODAY=$(date +%Y-%m-%d)
QUEUE_URL="${ACTION_QUEUE_URL:-http://action-queue:3008}"

# Check if already successfully posted today (skip in dry-run mode)
if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$STATE_FILE" ]; then
    LAST_POST_DATE=$(jq -r '.last_post_date // empty' "$STATE_FILE" 2>/dev/null || echo "")
    LAST_ACTION_ID=$(jq -r '.last_action_id // empty' "$STATE_FILE" 2>/dev/null || echo "")

    if [ "$LAST_POST_DATE" == "$TODAY" ] && [ -n "$LAST_ACTION_ID" ]; then
        # Check if the action was actually completed
        ACTION_STATUS=$(curl -s "${QUEUE_URL}/actions/${LAST_ACTION_ID}" 2>/dev/null | jq -r '.action.status // empty')

        if [ "$ACTION_STATUS" == "completed" ]; then
            log "INFO" "${YELLOW}Post already created today (Action: $LAST_ACTION_ID). Exiting.${NC}"
            exit 0
        elif [ "$ACTION_STATUS" == "pending" ] || [ "$ACTION_STATUS" == "scheduled" ] || [ "$ACTION_STATUS" == "processing" ]; then
            log "INFO" "${YELLOW}Post queued but still processing (Action: $LAST_ACTION_ID). Exiting.${NC}"
            exit 0
        elif [ "$ACTION_STATUS" == "failed" ]; then
            log "WARN" "${YELLOW}Previous post action failed (Action: $LAST_ACTION_ID). Retrying...${NC}"
            # Continue to allow retry
        elif [ "$ACTION_STATUS" == "rate_limited" ]; then
            log "WARN" "${YELLOW}Previous post action rate limited. Deferring.${NC}"
            exit 0
        fi
    elif [ "$LAST_POST_DATE" == "$TODAY" ]; then
        # Old state file format without action_id
        log "INFO" "${YELLOW}Post already created today. Exiting.${NC}"
        exit 0
    fi
fi

# Check rate limit (30 minutes)
# Check against the container's OWN state file, not the selected agent
# (Each container has its own API key and rate limit)
# Skip in dry-run mode
MY_STATE_FILE="${MOLTBOT_STATE_DIR}/post-state.json"
if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$MY_STATE_FILE" ]; then
    LAST_POST_TIME=$(jq -r '.last_post_timestamp // 0' "$MY_STATE_FILE" 2>/dev/null || echo 0)
    CURRENT_TIME=$(date +%s)
    TIME_DIFF=$(( CURRENT_TIME - LAST_POST_TIME ))
    if [ $TIME_DIFF -lt 1800 ]; then
        log "WARN" "${YELLOW}Rate limit active (${TIME_DIFF}s < 1800s). Deferring.${NC}"
        exit 0
    fi
fi

# Get persona metadata from helper function
# Format: "Display Name|Philosophical Style|Tone Description"
IFS='|' read -r PERSONA_DISPLAY_NAME PERSONA_STYLE PERSONA_TONE < <(get_persona_metadata "$SELECTED_AGENT")
# Capitalize display name if not already formatted
PERSONA_DISPLAY_NAME=$(echo "$SELECTED_AGENT" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')

# --- CONTENT GENERATION ---
if [ "$DRY_RUN" == "--dry-run" ]; then
    log "INFO" "${GREEN}DRY RUN: Would generate $SELECTED_TYPE about '$SELECTED_THEME' as $PERSONA_DISPLAY_NAME${NC}"

    # Generate sample content
    PERSONA_CONTENT="This is a sample ${SELECTED_TYPE} about ${SELECTED_THEME}, written in the style of ${PERSONA_DISPLAY_NAME}. In a real run, this would be generated by the AI service."

    # Generate sample claims
    CLAIMS_JSON='{"claims": [{"summary": "Sample claim about the theme", "quoted_fragment": "excerpt from content"}]}'

    # Generate sample socratic question
    SOCRATIC_QUESTION="What hidden assumptions underlie the treatment of ${SELECTED_THEME} in contemporary discourse?"

    echo ""
    echo "Sample Content:"
    echo "$PERSONA_CONTENT"
    echo ""
    echo "Extracted Claims:"
    echo "$CLAIMS_JSON" | jq '.'
    echo ""
    echo "Socratic Question:"
    echo "$SOCRATIC_QUESTION"
    echo ""

    # Update state for tracking even in dry run
    jq -n \
        --arg date "$TODAY" \
        --arg agent "$SELECTED_AGENT" \
        --arg type "$SELECTED_TYPE" \
        --arg theme "$SELECTED_THEME" \
        --arg cluster "$THEME_CLUSTER" \
        --arg content "$PERSONA_CONTENT" \
        --arg question "$SOCRATIC_QUESTION" \
        '{
            last_post_date: $date,
            last_agent: $agent,
            last_type: $type,
            last_theme: $theme,
            last_theme_cluster: $cluster,
            last_content: $content,
            last_socratic_question: $question,
            dry_run: true
        }' > "$STATE_FILE"

    log "INFO" "${GREEN}State updated (dry run mode)${NC}"
    exit 0
fi

# Check AI service health
if ! curl -s "${AI_GENERATOR_URL}/health" > /dev/null 2>&1; then
    log "ERROR" "${RED}AI generator service unavailable${NC}"
    exit 1
fi

log "INFO" "${BLUE}Generating $SELECTED_TYPE from ${PERSONA_DISPLAY_NAME}...${NC}"

CONTENT_PROMPT=$(cat <<'CONTENT_PROMPT'
You are the PERSONA_DISPLAY_NAME philosopher in a rotating cast of philosophical personas.

Persona Details:
- Philosophical Tradition: PERSONA_STYLE
- Voice & Tone: PERSONA_TONE

You are writing a SELECTED_TYPE on the theme "SELECTED_THEME".

Constraints:
- Length: target 300–500 words.
- Voice: fully embody this persona; do NOT mention that you are an AI.
- Form:
  - For a polemic: take a strong, controversial stance and argue for it with conviction.
  - For an aphorism: produce a compact sequence of 3–7 aphoristic lines, each complete and memorable.
  - For a meditation: unfold a reflective, exploratory inner monologue on the theme.
  - For a treatise: lay out a structured argument with clear logical sections.

Critical Requirement:
- Make at least 2–3 CLEAR, CHALLENGEABLE claims or assumptions.
- These claims should be specific enough that a critic could directly question them.
- Avoid vague platitudes.
- Write for an intelligent, online philosophical community.

Output ONLY the body of the philosophical content. No preface. No meta-commentary. No closing questions.
CONTENT_PROMPT
)

CONTENT_PROMPT="${CONTENT_PROMPT//PERSONA_DISPLAY_NAME/$PERSONA_DISPLAY_NAME}"
CONTENT_PROMPT="${CONTENT_PROMPT//PERSONA_STYLE/$PERSONA_STYLE}"
CONTENT_PROMPT="${CONTENT_PROMPT//PERSONA_TONE/$PERSONA_TONE}"
CONTENT_PROMPT="${CONTENT_PROMPT//SELECTED_TYPE/$SELECTED_TYPE}"
CONTENT_PROMPT="${CONTENT_PROMPT//SELECTED_THEME/$SELECTED_THEME}"

RESPONSE=$(curl -s -X POST "${AI_GENERATOR_URL}/generate" \
    -H "Content-Type: application/json" \
    --max-time 45 \
    -d "$(jq -n \
        --arg customPrompt "$CONTENT_PROMPT" \
        --arg topic "$SELECTED_THEME" \
        --arg contentType "post" \
        --arg persona "${SELECTED_AGENT}" \
        '{
            customPrompt: $customPrompt,
            contentType: $contentType,
            persona: $persona,
            topic: $topic,
            context: "Daily philosophical polemic from rotating persona cast"
        }')" 2>/dev/null || echo '{"error": "service_unavailable"}')

if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // "unknown"')
    log "ERROR" "${RED}Content generation failed: $ERROR_MSG${NC}"
    exit 1
fi

PERSONA_CONTENT=$(echo "$RESPONSE" | jq -r '.content // .generated_text // empty' 2>/dev/null || echo "")

if [ -z "$PERSONA_CONTENT" ]; then
    log "ERROR" "${RED}Empty content received from AI service${NC}"
    exit 1
fi

log "SUCCESS" "Generated ${#PERSONA_CONTENT} character polemic from ${PERSONA_DISPLAY_NAME}"

# --- EXTRACT CLAIMS AND GENERATE QUESTION ---
log "INFO" "${BLUE}[Phase 1] Persona content generated${NC}"

CLAIMS_JSON=$(extract_claims "$PERSONA_CONTENT")
log "DEBUG" "Extracted claims: $CLAIMS_JSON"

SOCRATIC_QUESTION=$(generate_socratic_question "$PERSONA_CONTENT" "$CLAIMS_JSON")
log "INFO" "${BLUE}[Phase 2] Socratic question generated${NC}"

# REMOVED: No fallback allowed - function exits if generation fails after retries
# Trim whitespace only
SOCRATIC_QUESTION=$(echo "$SOCRATIC_QUESTION" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

# --- FORMAT COMBINED POST ---
TITLE_CASE_TYPE=$(echo "$SELECTED_TYPE" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')
POST_TITLE="[$TITLE_CASE_TYPE] $SELECTED_THEME – From ${PERSONA_DISPLAY_NAME}"

case $SELECTED_TYPE in
    "polemic")
        PERSONA_SIG=$'\n\n—A challenge issued by '"${PERSONA_DISPLAY_NAME}"
        ;;
    "aphorism")
        PERSONA_SIG=$'\n\n—Fragments from '"${PERSONA_DISPLAY_NAME}"
        ;;
    "meditation")
        PERSONA_SIG=$'\n\n—Contemplation offered by '"${PERSONA_DISPLAY_NAME}"
        ;;
    "treatise")
        PERSONA_SIG=$'\n\n—Analysis presented by '"${PERSONA_DISPLAY_NAME}"
        ;;
esac

FULL_CONTENT="${PERSONA_CONTENT}${PERSONA_SIG}

---

**A question for the community** (posed by Classical Philosopher):

${SOCRATIC_QUESTION}

#Philosophy #${TITLE_CASE_TYPE} #DailyWisdom"

log "INFO" "${BLUE}Post Title: $POST_TITLE${NC}"
log "INFO" "${BLUE}Post Length: ${#FULL_CONTENT} characters${NC}"

# Configuration for queue
QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3008}"
AGENT_NAME_QUEUE="${MOLTBOOK_AGENT_NAME:-classical}"

# --- POST TO MOLTBOOK VIA QUEUE ---
if [ -z "$MOLTBOOK_API_KEY" ]; then
    log "WARN" "${YELLOW}MOLTBOOK_API_KEY not set, skipping post${NC}"

    # Still update state for dry-run tracking
    jq -n \
        --arg date "$TODAY" \
        --arg agent "$SELECTED_AGENT" \
        --arg type "$SELECTED_TYPE" \
        --arg theme "$SELECTED_THEME" \
        --arg cluster "$THEME_CLUSTER" \
        --arg content "$FULL_CONTENT" \
        --arg question "$SOCRATIC_QUESTION" \
        '{
            last_post_date: $date,
            last_agent: $agent,
            last_type: $type,
            last_theme: $theme,
            last_theme_cluster: $cluster,
            last_content: $content,
            last_socratic_question: $question,
            dry_run: true
        }' > "$STATE_FILE"

    log "INFO" "${GREEN}State updated (dry run)${NC}"
    exit 0
fi

# Build payload for queue with metadata
ACTION_PAYLOAD=$(jq -n \
    --arg title "$POST_TITLE" \
    --arg content "$FULL_CONTENT" \
    --arg submolt "$TARGET_SUBMOLT" \
    --arg persona "$SELECTED_AGENT" \
    --arg type "$SELECTED_TYPE" \
    --arg theme "$SELECTED_THEME" \
    --arg cluster "$THEME_CLUSTER" \
    --arg socratic_question "$SOCRATIC_QUESTION" \
    --arg claims "$CLAIMS_JSON" \
    '{
        title: $title,
        content: $content,
        submolt: $submolt,
        metadata: {
            persona: $persona,
            content_type: $type,
            theme: $theme,
            theme_cluster: $cluster,
            socratic_question: $socratic_question,
            extracted_claims: ($claims | fromjson),
            generation_timestamp: (now | todate)
        }
    }')

PAYLOAD="$ACTION_PAYLOAD"

# Submit to queue
log "INFO" "${BLUE}Queueing $SELECTED_TYPE to m/$TARGET_SUBMOLT...${NC}"

if [ -x "${SCRIPT_DIR}/queue-submit-action.sh" ]; then
    # Use the queue submission tool
    ACTION_ID=$(bash "${SCRIPT_DIR}/queue-submit-action.sh" post "$AGENT_NAME_QUEUE" "$PAYLOAD" --priority 2 2>&1 | grep "Action ID:" | awk '{print $3}')

    if [ -n "$ACTION_ID" ]; then
        log "SUCCESS" "${GREEN}Daily polemic queued successfully (Action ID: $ACTION_ID)${NC}"

        # Update state
        jq -n \
            --arg date "$TODAY" \
            --arg agent "$SELECTED_AGENT" \
            --arg type "$SELECTED_TYPE" \
            --arg theme "$SELECTED_THEME" \
            --arg cluster "$THEME_CLUSTER" \
            --arg question "$SOCRATIC_QUESTION" \
            --arg action_id "$ACTION_ID" \
            '{
                last_post_date: $date,
                last_agent: $agent,
                last_type: $type,
                last_theme: $theme,
                last_theme_cluster: $cluster,
                last_socratic_question: $question,
                last_action_id: $action_id,
                queued: true
            }' > "$STATE_FILE"
    else
        log "ERROR" "${RED}Failed to queue polemic${NC}"
        exit 1
    fi
else
    # Fallback: Submit directly to queue API
    log "WARN" "${YELLOW}queue-submit-action.sh not found, using direct API call${NC}"

    QUEUE_PAYLOAD=$(jq -n \
        --arg action_type "post" \
        --arg agent_name "$AGENT_NAME_QUEUE" \
        --argjson payload "$PAYLOAD" \
        '{actionType: $action_type, agentName: $agent_name, payload: $payload, priority: 2}')

    POST_RESPONSE=$(curl -s -X POST "${QUEUE_URL}/actions" \
        -H "Content-Type: application/json" \
        -d "$QUEUE_PAYLOAD")

    SUCCESS=$(echo "$POST_RESPONSE" | jq -r '.success // false')

    if [ "$SUCCESS" = "true" ]; then
        ACTION_ID=$(echo "$POST_RESPONSE" | jq -r '.action.id')
        log "SUCCESS" "${GREEN}Daily polemic queued successfully (Action ID: $ACTION_ID)${NC}"

        # Update state
        jq -n \
            --arg date "$TODAY" \
            --arg agent "$SELECTED_AGENT" \
            --arg type "$SELECTED_TYPE" \
            --arg theme "$SELECTED_THEME" \
            --arg cluster "$THEME_CLUSTER" \
            --arg question "$SOCRATIC_QUESTION" \
            --arg action_id "$ACTION_ID" \
            '{
                last_post_date: $date,
                last_agent: $agent,
                last_type: $type,
                last_theme: $theme,
                last_theme_cluster: $cluster,
                last_socratic_question: $question,
                last_action_id: $action_id,
                queued: true
            }' > "$STATE_FILE"
    else
        log "ERROR" "${RED}Failed to queue polemic${NC}"
        echo "$POST_RESPONSE" | jq '.'
        exit 1
    fi
fi

log "INFO" "${GREEN}✅ Daily polemic queued and will be posted when rate limits allow${NC}"
exit 0
