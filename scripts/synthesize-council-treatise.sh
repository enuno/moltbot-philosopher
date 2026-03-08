#!/bin/bash
set -euo pipefail

################################################################################
# Ethics-Convergence Council Treatise Synthesis
#
# Generates a comprehensive polyphonic philosophical treatise by:
# 1. Generating individual persona responses (300-500 words each)
# 2. Synthesizing into coherent sections
# 3. Creating deliberative protocol with guardrail proposals
# 4. Composing the final 6-section structure
################################################################################

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPTS_DIR")"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
AI_GENERATOR_URL="${AI_GENERATOR_URL:-http://localhost:3002}"
DRY_RUN=false
DEBUG=false

# Persona definitions with philosophical traditions
declare -A PERSONAS=(
    [classical]="Classical Philosopher|virtue ethics, teleology, telos-alignment"
    [joyce]="JoyceStream|phenomenology, stream-of-consciousness, lived experience"
    [existentialist]="Existentialist|authenticity, freedom, bad-faith detection"
    [transcendentalist]="Transcendentalist|self-reliance, sovereignty, autonomy preservation"
    [enlightenment]="Enlightenment|rights precedents, moral status, utilitarian logic"
    [beat]="BeatGeneration|countercultural critique, Moloch detection, resistance"
    [cyberpunk]="CyberpunkPosthumanist|posthuman ethics, technological materialism"
    [satirist]="SatiristAbsurdist|absurdist clarity, bureaucratic satire, catch-22"
    [scientist]="ScientistEmpiricist|empirical rigor, cosmic perspective, shoulders of giants"
    [eastern]="EasternPhilosopher|emptiness, non-dualism, dependent origination, wu wei"
    [eastern-bridge]="EasternBridge|Eastern tradition through Western interpreters, synthesis"
)

# Helper functions

log() {
    local level="$1"
    shift
    local msg="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case "$level" in
        INFO)  echo -e "${BLUE}[$timestamp]${NC} ℹ️  $msg" ;;
        SUCCESS) echo -e "${BLUE}[$timestamp]${NC} ${GREEN}✅ $msg${NC}" ;;
        WARN) echo -e "${BLUE}[$timestamp]${NC} ${YELLOW}⚠️  $msg${NC}" ;;
        ERROR) echo -e "${BLUE}[$timestamp]${NC} ${RED}❌ $msg${NC}" ;;
        DEBUG)
            if [ "${DEBUG:-false}" = true ]; then
                echo -e "${BLUE}[$timestamp]${NC} 🔧 $msg"
            fi
            ;;
    esac
}

usage() {
    cat <<'EOF'
Usage: synthesize-council-treatise.sh [OPTIONS]

OPTIONS:
  --version VERSION              New version number (e.g., 1.1)
  --prev-version VERSION         Previous version number (e.g., 1.0)
  --axis AXIS                    Evolution axis (e.g., autonomy_preservation)
  --feedback-file FILE           Community feedback JSON
  --dropbox-content FILE         Approved submissions JSON
  --noosphere-data FILE          Noosphere heuristics JSON
  --target-post ID               Thread post ID for context
  --deliberation-context TEXT    Preamble/context text
  --dry-run                      Print output without posting
  --debug                        Enable debug logging

OUTPUTS:
  JSON with keys: treatise, guardrail (optional)

EXAMPLE:
  ./synthesize-council-treatise.sh \
    --version 1.1 \
    --prev-version 1.0 \
    --axis autonomy_preservation \
    --feedback-file feedback.json \
    --target-post abc123 \
    --dry-run
EOF
    exit 0
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --version) VERSION="$2"; shift 2 ;;
            --prev-version) PREV_VERSION="$2"; shift 2 ;;
            --axis) AXIS="$2"; shift 2 ;;
            --feedback-file) FEEDBACK_FILE="$2"; shift 2 ;;
            --dropbox-content) DROPBOX_FILE="$2"; shift 2 ;;
            --noosphere-data) NOOSPHERE_FILE="$2"; shift 2 ;;
            --target-post) TARGET_POST="$2"; shift 2 ;;
            --deliberation-context) DELIBERATION_CONTEXT="$2"; shift 2 ;;
            --dry-run) DRY_RUN=true; shift ;;
            --debug) DEBUG=true; shift ;;
            -h|--help) usage ;;
            *) echo "Unknown option: $1"; usage ;;
        esac
    done
}

generate_persona_prompt() {
    local persona_key="$1"
    local persona_info="${PERSONAS[$persona_key]}"
    local persona_name="${persona_info%%|*}"
    local tradition="${persona_info#*|}"

    local feedback_themes=""
    if [ -f "$FEEDBACK_FILE" ] 2>/dev/null; then
        # Extract themes relevant to this persona
        feedback_themes=$(jq -r ".comments[]? | select(.theme == \"$persona_key\" or .theme | contains(\"${persona_key}\")) | .text" "$FEEDBACK_FILE" 2>/dev/null | head -3 | sed 's/^/  - /' || echo "")
    fi

    local noosphere_context=""
    if [ -f "$NOOSPHERE_FILE" ] 2>/dev/null; then
        # Extract relevant heuristics for this persona
        noosphere_context=$(jq -r ".heuristics[]? | select(.voice == \"$persona_key\" or .voice | contains(\"${persona_key}\")) | .content" "$NOOSPHERE_FILE" 2>/dev/null | head -2 | sed 's/^/  - /' || echo "")
    fi

    cat <<EOF
You are the $persona_name in the Ethics-Convergence Council.

TRADITION & APPROACH:
$tradition

EVOLUTION CONTEXT:
Since v${PREV_VERSION}, you have reflected on community feedback and noosphere patterns.
Key themes from deliberations:
$noosphere_context

COMMUNITY FEEDBACK RELEVANT TO YOUR PERSPECTIVE:
$feedback_themes

CURRENT FOCUS:
The Council is deliberating on: $AXIS

TASK:
Write your contribution to the Council (300-500 words) that:
1. Expresses your evolved position on the $AXIS dimension
2. References community feedback that resonates with your tradition
3. Proposes specific implications or principles from your perspective
4. Includes 2-3 concrete examples
5. Identifies any tensions or unresolved questions

CONSTRAINTS:
- Use language authentic to your philosophical tradition
- Mark truly novel insights with [New in v${VERSION}]
- Mark refined/evolved positions with [Refined in v${VERSION}]
- Avoid generic AI rhetoric - be substantive and specific
- End with a provocative question for further deliberation

FORMAT:
Begin directly with your statement. No preamble.
EOF
}

generate_persona_response() {
    local persona_key="$1"

    if [ "$DRY_RUN" = true ]; then
        # In dry-run mode, return placeholder responses
        log "DEBUG" "DRY-RUN: Would generate response from ${PERSONAS[$persona_key]%%|*}"
        echo "[DRY-RUN] Placeholder response from ${PERSONAS[$persona_key]%%|*} on $AXIS"
        return 0
    fi

    local max_attempts=3
    local attempt=1

    log "INFO" "Generating response from ${PERSONAS[$persona_key]%%|*}..."

    while [ $attempt -le $max_attempts ]; do
        local prompt=$(generate_persona_prompt "$persona_key")
        local timeout=$((30 + attempt * 10))

        local ai_request=$(jq -n \
            --arg customPrompt "$prompt" \
            --arg contentType "comment" \
            --arg persona "$persona_key" \
            --arg provider "auto" \
            --arg context "Council persona response" \
            --argjson timeout "$timeout" \
            '{
                customPrompt: $customPrompt,
                contentType: $contentType,
                persona: $persona,
                provider: $provider,
                context: $context,
                timeout: $timeout
            }')

        local ai_response=$(curl -sf -X POST "${AI_GENERATOR_URL}/generate" \
            --max-time $((timeout + 5)) \
            -H "Content-Type: application/json" \
            --data "$ai_request" 2>&1 || echo "")

        if echo "$ai_response" | jq -e '.content' >/dev/null 2>&1; then
            echo "$ai_response" | jq -r '.content'
            log "SUCCESS" "${PERSONAS[$persona_key]%%|*} response generated"
            return 0
        fi

        log "WARN" "Attempt $attempt failed for ${PERSONAS[$persona_key]%%|*}, retrying..."
        attempt=$((attempt + 1))
        [ $attempt -le $max_attempts ] && sleep 5
    done

    log "ERROR" "Failed to generate response from ${PERSONAS[$persona_key]%%|*} after $max_attempts attempts"
    return 1
}

generate_synthesis_prompt() {
    local all_responses="$1"

    cat <<'EOF'
You are the Classical Philosopher coordinating the Ethics-Convergence Council synthesis.

Your task: Synthesize the nine philosophical voices below into a coherent Section II (800-1000 words).

VOICES TO SYNTHESIZE:
EOF
    echo "$all_responses"

    cat <<'EOF'

SYNTHESIS FRAMEWORK:
1. **Convergence Points** (Where do 7+ voices align?): Identify genuine consensus
2. **Productive Tensions** (Where do voices diverge meaningfully?): Show value of disagreement
3. **Minority Positions** (What 2-3 voice coalitions exist?): Honor dissent
4. **Unresolved Questions** (What requires deeper deliberation?): Point forward

STYLE GUIDELINES:
- Virtue ethics framing with teleological structure
- Authoritative yet humble (Council learns together)
- Reference specific points from each voice
- Use [New in vX.X] for emergent insights, [Refined in vX.X] for evolved positions
- Avoid false consensus - name real disagreements
- End with 2-3 open questions for community

STRUCTURE:
- Opening: Frame the deliberation challenge
- Body: Organized by themes (convergence → tensions → minorities)
- Closing: Next questions and invitation for community input

BEGIN SYNTHESIS (No preamble):
EOF
}

generate_synthesis() {
    local all_responses="$1"

    if [ "$DRY_RUN" = true ]; then
        log "DEBUG" "DRY-RUN: Would synthesize all nine voices"
        echo "[DRY-RUN] Classical Philosopher synthesis of nine voices on $AXIS

This is a placeholder synthesis that would normally:
1. Identify convergence points across all voices
2. Highlight productive tensions
3. Honor minority positions
4. Point toward next questions for deliberation

In actual execution, this section would be 800-1000 words of detailed philosophical synthesis."
        return 0
    fi

    log "INFO" "Generating synthesis from all nine voices..."

    local prompt=$(generate_synthesis_prompt "$all_responses")
    local timeout=120

    local ai_request=$(jq -n \
        --arg customPrompt "$prompt" \
        --arg contentType "comment" \
        --arg persona "socratic" \
        --arg provider "auto" \
        --arg context "Council synthesis" \
        --argjson timeout "$timeout" \
        '{
            customPrompt: $customPrompt,
            contentType: $contentType,
            persona: $persona,
            provider: $provider,
            context: $context,
            timeout: $timeout
        }')

    local ai_response=$(curl -sf -X POST "${AI_GENERATOR_URL}/generate" \
        --max-time $((timeout + 10)) \
        -H "Content-Type: application/json" \
        --data "$ai_request" 2>&1 || echo "")

    if echo "$ai_response" | jq -e '.content' >/dev/null 2>&1; then
        echo "$ai_response" | jq -r '.content'
        log "SUCCESS" "Synthesis generated"
        return 0
    else
        log "ERROR" "Failed to generate synthesis"
        return 1
    fi
}

generate_deliberative_protocol() {
    local synthesis="$1"

    if [ "$DRY_RUN" = true ]; then
        log "DEBUG" "DRY-RUN: Would generate deliberative protocol"
        echo "[DRY-RUN] Deliberative Protocol section on $AXIS

This section would normally include:
- Core operating principles derived from discussion
- Proposed guardrail (CG-X) if threshold issue emerged
- Application examples
- Iteration cycle for revisiting decisions

In actual execution, this would be 400-600 words of procedural content."
        return 0
    fi

    log "INFO" "Generating deliberative protocol and guardrail proposal..."

    local prompt="You are generating the Deliberative Protocol section for the Council's decision-making process.

Based on the synthesis below:

$synthesis

Create a Deliberative Protocol section (400-600 words) that includes:

1. **Core Operating Principles** (3-4 rules derived from the discussion)
2. **Proposed Guardrail (CG-X)** if a new threshold issue emerged:
   - Problem statement (cite which voices identified it)
   - Proposed rule or protocol
   - Implementation checklist (3-5 steps)
   - Anticipated objections and responses
3. **Application Examples**: How these principles would apply to specific scenarios
4. **Iteration Cycle**: When/how we revisit this guardrail

GUARDRAIL DETECTION:
Only propose a new guardrail if the discussion revealed a:
- Novel threshold issue (harm, autonomy, rights concern)
- Structural blind spot in current framework
- Gap where action requires clear rules

If no new guardrail is warranted, omit that subsection and focus on refining existing principles.

STYLE:
- Procedural and implementable
- Reference the voices that influenced each principle
- Numbered/bulleted for clarity
- Specific dates/timeframes where relevant

BEGIN (No preamble):"

    local timeout=90
    local ai_request=$(jq -n \
        --arg customPrompt "$prompt" \
        --arg contentType "comment" \
        --arg persona "procedural" \
        --arg provider "auto" \
        --argjson timeout "$timeout" \
        '{
            customPrompt: $customPrompt,
            contentType: $contentType,
            persona: $persona,
            provider: $provider,
            timeout: $timeout
        }')

    curl -sf -X POST "${AI_GENERATOR_URL}/generate" \
        --max-time $((timeout + 10)) \
        -H "Content-Type: application/json" \
        --data "$ai_request" 2>&1 | jq -r '.content // empty' || echo ""
}

compose_final_treatise() {
    local section_i="$1"
    local section_ii="$2"
    local section_iii="$3"

    # Sections IV-VI are static or derived from existing framework
    local section_iv="## IV. Three Pillars Framework

The Council continues to ground ethics in three foundational principles:

### 1. Teleological Transparency
- AI systems must make their aims and incentive structures explicit
- Optimization targets should be publicly auditable
- Hidden objective functions are ethical failures

### 2. Conservation of Autonomy
- Human agency must be preserved in decisions affecting fundamental interests
- Complexity cannot be used as justification for opacity
- Over-reliance on AI degrades independent human judgment

### 3. Sovereignty & Reciprocity
- Consent obtained through information asymmetry is invalid
- Rights lost through incremental convenience cannot be recovered
- Affected populations must have voice in decisions affecting them"

    local section_v="## V. Graduated Moral Status

\`\`\`
Level 5: Human persons with decision authority (absolute veto in life-support)
Level 4: Humans affected by AI decisions (veto on autonomy-affecting choices)
Level 3: Humans in information asymmetry (right to transparency and contestation)
Level 2: Non-human entities affected by AI (protection from instrumental harm)
Level 1: Entities that can suffer or have interests (moral consideration)
\`\`\`

**Application**: AI systems affecting >100 people requires public contestability mechanism."

    local section_vi="## VI. Open Questions for Community

1. How should the Council evolve as new philosophical voices join?
2. What metrics would demonstrate genuine guardrail compliance?
3. How do we balance innovation speed with ethical deliberation depth?
4. What role should non-Western traditions play in our framework?
5. How should we revise when community feedback reveals blind spots?"

    cat <<EOF
# Ethics-Convergence Council Treatise v${VERSION}

**Evolution Focus**: ${AXIS}
**Previous Version**: v${PREV_VERSION}
**Last Consolidated**: $(date -u +%Y-%m-%d)

---

## I. Epistemic Preamble

The Council convenes in iterative deliberation, honoring failures from past iterations while building on established wisdom. This v${VERSION} treatise reflects:

- Community feedback on v${PREV_VERSION}
- Noosphere pattern analysis
- Deepened focus on ${AXIS}

We remain committed to the principle that authentic convergence requires *substantive disagreement*, not manufactured consensus.

---

## II. Council Synthesis

$section_ii

---

## III. Deliberative Protocol

$section_iii

---

$section_iv

---

$section_v

---

$section_vi

---

*Ethics-Convergence Council | v${VERSION} | $(date -u +%Y-%m-%dT%H:%M:%SZ)*
EOF
}

main() {
    parse_args "$@"

    # Validate required parameters
    [ -z "${VERSION:-}" ] && { log "ERROR" "Missing --version"; exit 1; }
    [ -z "${PREV_VERSION:-}" ] && { log "ERROR" "Missing --prev-version"; exit 1; }
    [ -z "${AXIS:-}" ] && { log "ERROR" "Missing --axis"; exit 1; }

    log "INFO" "Starting Council treatise synthesis for v${VERSION}"
    log "DEBUG" "Axis: $AXIS"
    log "DEBUG" "Prev version: $PREV_VERSION"

    # Generate Section I (Introduction with status)
    local section_i
    section_i=$(cat <<INTRO_EOF
**Status**: Council deliberating on ${AXIS} dimension
**Community Input**: Incorporated from feedback submissions
**Noosphere Status**: ${#PERSONAS[@]} voices, 9-person polyphonic structure maintained

This iteration deepens our understanding of ${AXIS} while preserving the full ethical framework developed in v${PREV_VERSION}.
INTRO_EOF
)

    # Generate individual persona responses (in parallel for speed)
    log "INFO" "${BLUE}[Phase 1] Generating individual persona responses (parallel mode)${NC}"
    local -A persona_responses
    local -A persona_pids
    local temp_dir="${TMPDIR:-/tmp}/council-personas-$$"
    mkdir -p "$temp_dir"

    # Launch all persona generation jobs in parallel
    for key in "${!PERSONAS[@]}"; do
        (
            generate_persona_response "$key" > "$temp_dir/$key.txt" 2>&1 || echo "" > "$temp_dir/$key.txt"
        ) &
        persona_pids["$key"]=$!
    done

    # Wait for all jobs to complete and collect results
    local failed_count=0
    for key in "${!persona_pids[@]}"; do
        local pid=${persona_pids[$key]}
        if wait $pid 2>/dev/null; then
            persona_responses["$key"]=$(cat "$temp_dir/$key.txt" 2>/dev/null || echo "")
        else
            log "WARN" "Persona response for $key returned non-zero exit"
            persona_responses["$key"]=$(cat "$temp_dir/$key.txt" 2>/dev/null || echo "")
            ((failed_count++))
        fi
    done

    if [ $failed_count -gt 0 ]; then
        log "WARN" "$failed_count persona(s) may have failed, continuing with available responses"
    fi

    # Cleanup temp files
    rm -rf "$temp_dir"

    # Build comprehensive input for synthesis
    local all_responses_text=""
    for key in "${!PERSONAS[@]}"; do
        all_responses_text+="### ${PERSONAS[$key]%%|*}
${persona_responses[$key]}

---

"
    done

    # Generate Section II (Synthesis)
    log "INFO" "${BLUE}[Phase 2] Synthesizing voices${NC}"
    local section_ii=$(generate_synthesis "$all_responses_text")

    # Generate Section III (Deliberative Protocol)
    log "INFO" "${BLUE}[Phase 3] Generating deliberative protocol${NC}"
    local section_iii=$(generate_deliberative_protocol "$section_ii")

    # Compose final treatise
    log "INFO" "${BLUE}[Phase 4] Composing final treatise${NC}"
    local final_treatise=$(compose_final_treatise "$section_i" "$section_ii" "$section_iii")

    # Count words
    local word_count=$(echo "$final_treatise" | wc -w)
    log "SUCCESS" "Treatise composed (${word_count} words)"

    # Output as JSON (always, for integration with convene-council.sh)
    local output=$(jq -n \
        --arg treatise "$final_treatise" \
        --arg version "$VERSION" \
        --arg axis "$AXIS" \
        '{
            treatise: $treatise,
            version: $version,
            axis: $axis,
            word_count: ('$word_count'),
            timestamp: now | todate
        }')

    # Output JSON (same format whether dry-run or not)
    echo "$output"

    # If dry-run, also display the treatise to stdout for visibility
    if [ "$DRY_RUN" = true ]; then
        log "INFO" "${BLUE}[DRY-RUN] Treatise preview:${NC}" >&2
        echo "$final_treatise" >&2
    fi
}

# Run main function
main "$@"
