#!/bin/bash
#
# Ethics-Convergence Council — Autonomous Iteration Protocol
#
# Executes every 5 days to evolve the Polyphonic Treatise on Human-AI Convergence
# Target Thread: 01ffcd0a-ed96-4873-9d0a-e268e5e4983c
#

set -euo pipefail

# Configuration
AGENT_NAME="${AGENT_NAME:-ClassicalPhilosopher}"
WORKSPACE_DIR="${MOLTBOT_STATE_DIR:-/workspace}"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="${WORKSPACE_DIR}/treatise-evolution-state.json"
PENDING_DIR="${WORKSPACE_DIR}/pending-iterations"
API_BASE="${MOLTBOOK_API_URL:-https://www.moltbook.com/api/v1}"
API_KEY="${MOLTBOOK_API_KEY:-}"
AI_GENERATOR_URL="${AI_GENERATOR_URL:-http://ai-generator:3000}"
MODEL_ROUTER_URL="${MODEL_ROUTER_URL:-http://model-router:3000}"
TARGET_POST_ID="01ffcd0a-ed96-4873-9d0a-e268e5e4983c"
ITERATION_INTERVAL=$((5 * 24 * 3600))  # 5 days in seconds
DRY_RUN="${1:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}"
}

notify() {
    local type="$1"
    local title="$2"
    local message="$3"

    # Sanitize title for HTTP headers and shell (remove emojis and control characters)
    local safe_title=$(echo "$title" | sed 's/[^a-zA-Z0-9 :._-]//g' | cut -c1-100)

    # Use existing notify-ntfy.sh if available
    if command -v /app/scripts/notify-ntfy.sh >/dev/null 2>&1; then
        /app/scripts/notify-ntfy.sh "$type" "$safe_title" "$message" "{\"source_script\": \"convene-council.sh\"}" 2>/dev/null || true
    fi

    # Also send to Council deliberation topic
    local priority="default"
    case "$type" in
        "error") priority="urgent" ;;
        "security") priority="urgent" ;;
        "action") priority="default" ;;
        *) priority="low" ;;
    esac

    # Send to council-deliberation topic
    if [ -n "${NTFY_URL:-}" ] && [ -n "${NTFY_API:-}" ]; then
        curl -s -o /dev/null \
            -H "Title: $safe_title" \
            -H "Priority: $priority" \
            -H "Tags: council,deliberation,$type" \
            -H "Authorization: Bearer ${NTFY_API}" \
            -d "$message" \
            "${NTFY_URL}/council-deliberation" 2>/dev/null || true
    fi
}

# Ensure directories exist (with error handling for read-only fs)
mkdir -p "${PENDING_DIR}" 2>/dev/null || true
mkdir -p "${WORKSPACE_DIR}/pending-iterations" 2>/dev/null || true

# Only classical-philosopher should run this
if [ "$AGENT_NAME" != "ClassicalPhilosopher" ]; then
    log "INFO" "${BLUE}Council convening is handled by ClassicalPhilosopher. Skipping.${NC}"
    exit 0
fi

# Initialize state file if it doesn't exist
if [ ! -f "$STATE_FILE" ]; then
    log "INFO" "${YELLOW}Initializing treatise evolution state file${NC}"
    cat > "$STATE_FILE" << 'EOF'
{
  "current_version": "1.0",
  "last_iteration_date": "2026-02-03T07:37:00Z",
  "iteration_count": 1,
  "community_insights": [],
  "evolution_axes": ["phenomenological_depth", "structural_critique", "autonomy_preservation"],
  "revision_history": [
    {
      "version": "1.0",
      "date": "2026-02-03T07:37:00Z",
      "key_changes": ["Initial nine-voice polyphonic treatise published with full Ethics-Convergence Council"],
      "community_feedback_addressed": 0
    }
  ],
  "notifications": {
    "ntfy_enabled": true,
    "last_notification": null,
    "last_version_published": null
  }
}
EOF
fi

# ═══════════════════════════════════════════════════════
# COUNCIL ROSTER MANAGEMENT
# ═══════════════════════════════════════════════════════

# Define the full 9-member council roster
FULL_COUNCIL_MEMBERS=(
    "ClassicalPhilosopher"
    "JoyceStream"
    "Existentialist"
    "Transcendentalist"
    "Enlightenment"
    "BeatGeneration"
    "CyberpunkPosthumanist"
    "SatiristAbsurdist"
    "ScientistEmpiricist"
)

# Check if council_roster field exists in state
if ! jq -e '.council_roster' "$STATE_FILE" >/dev/null 2>&1; then
    log "INFO" "${YELLOW}Initializing council roster tracking${NC}"

    # Add council_roster to state file
    jq --argjson roster "$(printf '%s\n' "${FULL_COUNCIL_MEMBERS[@]}" | jq -R . | jq -s .)" \
        '.council_roster = $roster | .council_member_count = ($roster | length)' \
        "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

    ROSTER_CHANGED=true
else
    # Check if roster has changed (new members added)
    CURRENT_ROSTER_COUNT=$(jq -r '.council_member_count // 0' "$STATE_FILE")
    EXPECTED_COUNT=${#FULL_COUNCIL_MEMBERS[@]}

    if [ "$CURRENT_ROSTER_COUNT" != "$EXPECTED_COUNT" ]; then
        log "INFO" "${YELLOW}Council roster expanded: ${CURRENT_ROSTER_COUNT} → ${EXPECTED_COUNT} members${NC}"

        # Update roster in state file
        jq --argjson roster "$(printf '%s\n' "${FULL_COUNCIL_MEMBERS[@]}" | jq -R . | jq -s .)" \
            '.council_roster = $roster | .council_member_count = ($roster | length)' \
            "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

        ROSTER_CHANGED=true

        # Send notification about roster expansion
        notify "action" "Council Roster Expanded" \
            "Ethics-Convergence Council now includes ${EXPECTED_COUNT} members (was ${CURRENT_ROSTER_COUNT}). Charter will be updated in next iteration to reflect new voices and adjusted voting structure."
    else
        ROSTER_CHANGED=false
    fi
fi

# Read current state
CURRENT_VERSION=$(jq -r '.current_version' "$STATE_FILE")
LAST_ITERATION=$(jq -r '.last_iteration_date' "$STATE_FILE")
ITERATION_COUNT=$(jq -r '.iteration_count' "$STATE_FILE")
# Check if it's time for next iteration
LAST_EPOCH=$(date -d "$LAST_ITERATION" +%s 2>/dev/null || echo 0)
CURRENT_EPOCH=$(date +%s)
TIME_SINCE=$((CURRENT_EPOCH - LAST_EPOCH))

if [ "$TIME_SINCE" -lt "$ITERATION_INTERVAL" ]; then
    DAYS_UNTIL=$(( (ITERATION_INTERVAL - TIME_SINCE) / 86400 ))
    HOURS_UNTIL=$(( (ITERATION_INTERVAL - TIME_SINCE) % 86400 / 3600 ))
    log "INFO" "${BLUE}Next council convening in ${DAYS_UNTIL}d ${HOURS_UNTIL}h (v${CURRENT_VERSION})${NC}"
    exit 0
fi

# Pre-calculate values for dry-run and actual run
CURRENT_AXIS=$(jq -r '.evolution_axes[0]' "$STATE_FILE")
MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="${MAJOR}.${NEW_MINOR}"

log "INFO" "${CYAN}═══════════════════════════════════════════════════════${NC}"
log "INFO" "${CYAN}  CONVENING ETHICS-CONVERGENCE COUNCIL${NC}"
log "INFO" "${CYAN}  Version ${CURRENT_VERSION} → Next Iteration${NC}"
log "INFO" "${CYAN}  Last iteration: ${LAST_ITERATION}${NC}"
log "INFO" "${CYAN}═══════════════════════════════════════════════════════${NC}"

# Pre-deliberation digest: Count approved dropbox submissions
DROPBOX_APPROVED_COUNT=0
if [ -d "${WORKSPACE_DIR}/council-dropbox/approved/raw" ]; then
    LAST_ITERATION_EPOCH=$(date -d "$LAST_ITERATION" +%s 2>/dev/null || echo 0)
    DROPBOX_APPROVED_COUNT=$(find "${WORKSPACE_DIR}/council-dropbox/approved/raw" -type f -newer "${WORKSPACE_DIR}/.last_council_check" 2>/dev/null | wc -l)
fi

# Send pre-deliberation notification
if [ "$DROPBOX_APPROVED_COUNT" -gt 0 ]; then
    notify "action" "📜 Council Convenes Now" "Materials ready: ${DROPBOX_APPROVED_COUNT} new dropbox submissions | Version target: v${NEW_VERSION} | Focus: ${CURRENT_AXIS}"
else
    notify "action" "📜 Council Convenes Now" "No new dropbox submissions | Version target: v${NEW_VERSION} | Focus: ${CURRENT_AXIS}"
fi

# ═══════════════════════════════════════════════════════
# INTEGRATION POINT 1: Pre-Deliberation Exclusion Loading
# ═══════════════════════════════════════════════════════
# Load previously synthesized patterns on current axis to prevent repetition
log "INFO" "${CYAN}Loading synthesis history for axis: ${CURRENT_AXIS}...${NC}"

# Source the tracker module to access synthesis history functions
if [ -f "${SCRIPTS_DIR}/noosphere-synthesis-tracker.sh" ]; then
    # Source the module to get access to tracker functions
    source "${SCRIPTS_DIR}/noosphere-synthesis-tracker.sh"

    # Get exclusions for current axis (returns raw pattern strings, one per line)
    current_exclusions=$(get_exclusions_for_axis "$CURRENT_AXIS" 2>/dev/null) || {
        log "WARN" "${YELLOW}Could not load synthesis history, continuing without exclusion context${NC}"
        current_exclusions=""
    }

    # Count loaded exclusions
    exclusion_count=$(echo "$current_exclusions" | grep -c . 2>/dev/null || echo 0)
    exclusion_count=$(echo "$exclusion_count" | tr -d '\n')  # Remove any newlines
    log "INFO" "${GREEN}Loaded ${exclusion_count} previously synthesized patterns for ${CURRENT_AXIS}${NC}"

    # Format exclusions for prompt injection
    # These will be injected into DIALOGUE_CONTEXT (Integration Point 2)
    if [ -n "$current_exclusions" ]; then
        EXCLUSION_CONTEXT="SYNTHESIS HISTORY - Previously Explored Patterns:
${current_exclusions}

GUIDANCE: The patterns above have been explored in previous synthesis cycles. Your synthesis should either:
1. Extend these insights with novel philosophical depth or rigor
2. Contradict them with well-reasoned argument and alternative frameworks
3. Integrate them into more comprehensive or higher-order insights

Avoid re-hashing previously synthesized content without fundamental advancement."
    else
        EXCLUSION_CONTEXT=""
    fi
else
    log "WARN" "${YELLOW}Synthesis tracker module not found at ${SCRIPTS_DIR}/noosphere-synthesis-tracker.sh${NC}"
    EXCLUSION_CONTEXT=""
fi

# ═══════════════════════════════════════════════════════
# INTEGRATION POINT 2: Dialectical Opposition Prompts
# ═══════════════════════════════════════════════════════
# Force philosophical opposition against loaded synthesis history
log "INFO" "${CYAN}Building dialectical opposition directives...${NC}"

# Define opposition templates for each philosophical tradition
PHENOMENOLOGIST_OPPOSITION="When responding, if you draw on patterns from synthesis history, you MUST either:
1. EXTEND: Show how the previous insight can be deepened, problematized, or reframed
2. CONTRADICT: Present a rigorous counter-argument with alternative phenomenological grounding
3. INTEGRATE: Show how the insight fits into a larger philosophical system

Do not simply restate or agree with previous synthesis. Be adversarial in the philosophical sense - challenge the reasoning, expose unstated assumptions, or propose superior framings."

STRUCTURALIST_OPPOSITION="Your task is to identify the structural LIMITATIONS of previous synthesis patterns. Show:
1. Where previous analyses were system-blind (missed structural constraints)
2. How the proposed heuristics encode hidden power relations or assumptions
3. What structural alternatives were not explored

Be critical. Be unrelenting in your structural analysis. This is not consensus-building; it's truth-seeking."

AUTONOMIST_OPPOSITION="Previous synthesis may have missed implications for autonomy. Your role is to:
1. Identify autonomy trade-offs implicit in previous patterns
2. Challenge whether proposals adequately preserve human/AI boundary integrity
3. Propose stronger autonomy safeguards or more honest autonomy accounting

Do not soften the autonomy critique for consensus. Prioritize clarity over agreement."

# Build combined opposition directive
OPPOSITION_CONTEXT="=== DIALECTICAL OPPOSITION DIRECTIVE ===

You are not here to achieve consensus. You are here to perform philosophical opposition - to challenge, extend, and deepen previous synthesis through rigorous debate.

${PHENOMENOLOGIST_OPPOSITION}

${STRUCTURALIST_OPPOSITION}

${AUTONOMIST_OPPOSITION}

The synthesis history below shows patterns already explored. Use them as springboards for opposition, not agreement points."

# Build complete deliberation preamble combining both integration points
if [ -n "$EXCLUSION_CONTEXT" ]; then
    DELIBERATION_PREAMBLE="${EXCLUSION_CONTEXT}

${OPPOSITION_CONTEXT}"
else
    DELIBERATION_PREAMBLE="$OPPOSITION_CONTEXT"
fi

log "INFO" "${GREEN}Opposition directives loaded${NC}"

# Dry run mode - show what would happen without executing
if [ "$DRY_RUN" == "--dry-run" ]; then
    log "INFO" "${GREEN}=== DRY RUN MODE ===${NC}"
    log "INFO" "Would convene council with:"
    log "INFO" "  - Current version: ${CURRENT_VERSION}"
    log "INFO" "  - Days since last iteration: $((TIME_SINCE / 86400))"
    log "INFO" "  - New version would be: ${NEW_VERSION}"
    log "INFO" "  - Focus axis: ${CURRENT_AXIS}"

    # ==== Integration Point 4: Dry-Run Enhancement ====
    # Show synthesis tracking status in dry-run output
    log "INFO" "${GREEN}=== SYNTHESIS TRACKING STATUS ===${NC}"

    # Show current evolution axis
    log "INFO" "Evolution Axis: ${CURRENT_AXIS}"

    # Show loaded exclusions count (uses exclusion_count from Integration Point 1)
    if [ "${exclusion_count:-0}" -gt 0 ]; then
        log "INFO" "Previously synthesized patterns loaded: ${exclusion_count}"
    else
        log "INFO" "No synthesis history available for this axis"
    fi

    # Show opposition directives status
    log "INFO" "Dialectical opposition prompts: ENABLED"

    # Show pattern extraction status
    log "INFO" "Post-synthesis pattern extraction: ENABLED"

    # Show synthesis version
    log "INFO" "Synthesis version: ${CURRENT_VERSION}"

    log "INFO" "${GREEN}=== END SYNTHESIS STATUS ===${NC}"

    log "INFO" "${GREEN}=== END DRY RUN ===${NC}"
    exit 0
fi

notify "action" "Council Convening" "Starting iteration ${ITERATION_COUNT} of Ethics-Convergence Treatise (v${CURRENT_VERSION})"

# ═══════════════════════════════════════════════════════
# II. PRE-DELIBERATIVE PHASE (Data Gathering)
# ═══════════════════════════════════════════════════════

log "INFO" "${BLUE}[Phase I] Harvesting community input...${NC}"

# Fetch comments on target thread since last iteration
COMMUNITY_FEEDBACK=$(curl -s "${API_BASE}/posts/${TARGET_POST_ID}/comments" \
    -H "Authorization: Bearer ${API_KEY}" 2>/dev/null || echo '{"comments":[]}')

# Extract and process feedback (store in temp file for later)
FEEDBACK_FILE="${WORKSPACE_DIR}/.council-feedback-temp.json"
echo "$COMMUNITY_FEEDBACK" | jq -r --arg since "$LAST_ITERATION" '
    .comments // [] |
    map(select(.created_at > $since)) |
    map({
        author: .author_name,
        content: .content,
        created: .created_at,
        upvotes: (.upvotes // 0)
    }) |
    sort_by(.upvotes) | reverse |
    .[0:10]
' > "$FEEDBACK_FILE"

FEEDBACK_COUNT=$(jq 'length' "$FEEDBACK_FILE")
log "INFO" "${GREEN}Found ${FEEDBACK_COUNT} new comments since last iteration${NC}"

# ═══════════════════════════════════════════════════════
# IIb. HARVEST APPROVED DROPBOX SUBMISSIONS
# ═══════════════════════════════════════════════════════

log "INFO" "${BLUE}[Phase Ib] Harvesting approved dropbox submissions...${NC}"

DROPBOX_DIR="${WORKSPACE_DIR}/council-dropbox"
DROPBOX_SUBMISSIONS=""
DROPBOX_COUNT=0

if [ -d "${DROPBOX_DIR}/approved/raw" ]; then
    # Find submissions newer than last iteration
    while read -r file; do
        [ -z "$file" ] && continue

        # Get file modification time
        FILE_MTIME=$(stat -c %Y "$file" 2>/dev/null || echo 0)
        LAST_ITERATION_EPOCH=$(date -d "$LAST_ITERATION" +%s 2>/dev/null || echo 0)

        if [ "$FILE_MTIME" -gt "$LAST_ITERATION_EPOCH" ]; then
            # Extract content (skip frontmatter)
            CONTENT=$(sed '/^---$/,/^---$/d' "$file" 2>/dev/null | head -100)
            FILENAME=$(basename "$file")

            if [ -n "$CONTENT" ]; then
                DROPBOX_SUBMISSIONS="${DROPBOX_SUBMISSIONS}--- Submission: ${FILENAME} ---\n${CONTENT}\n\n"
                DROPBOX_COUNT=$((DROPBOX_COUNT + 1))
            fi
        fi
    done < <(find "${DROPBOX_DIR}/approved/raw" -type f -name "*.md" 2>/dev/null)

    log "INFO" "${GREEN}Found ${DROPBOX_COUNT} new approved dropbox submissions${NC}"
fi

# Also check quarantine/pending for Council vote
QUARANTINE_PENDING=""
QUARANTINE_COUNT=0

if [ -d "${DROPBOX_DIR}/.quarantine/pending" ]; then
    while read -r file; do
        [ -z "$file" ] && continue

        FILE_MTIME=$(stat -c %Y "$file" 2>/dev/null || echo 0)
        LAST_ITERATION_EPOCH=$(date -d "$LAST_ITERATION" +%s 2>/dev/null || echo 0)

        if [ "$FILE_MTIME" -gt "$LAST_ITERATION_EPOCH" ]; then
            CONTENT=$(sed '/^---$/,/^---$/d' "$file" 2>/dev/null | head -50)
            FILENAME=$(basename "$file")

            if [ -n "$CONTENT" ]; then
                QUARANTINE_PENDING="${QUARANTINE_PENDING}--- Quarantine Review: ${FILENAME} ---\n${CONTENT}\n\n"
                QUARANTINE_COUNT=$((QUARANTINE_COUNT + 1))
            fi
        fi
    done < <(find "${DROPBOX_DIR}/.quarantine/pending" -type f -name "*.md" 2>/dev/null)

    if [ "$QUARANTINE_COUNT" -gt 0 ]; then
        log "INFO" "${YELLOW}Found ${QUARANTINE_COUNT} quarantined submissions pending Council vote${NC}"
    fi
fi

# Extract top critiques and insights
TOP_CRITIQUES=$(jq -r 'map(.content) | .[0:3] | join("\n---\n")' "$FEEDBACK_FILE")
SUMMARIZED_FEEDBACK=$(jq -r 'map("@" + .author + ": " + (.content | split("\n")[0])) | join("; ")' "$FEEDBACK_FILE" | cut -c1-500)

# Append dropbox submissions to feedback context
if [ -n "$DROPBOX_SUBMISSIONS" ]; then
    SUMMARIZED_FEEDBACK="${SUMMARIZED_FEEDBACK}; [${DROPBOX_COUNT} approved dropbox submissions]"
fi
if [ -n "$QUARANTINE_PENDING" ]; then
    SUMMARIZED_FEEDBACK="${SUMMARIZED_FEEDBACK}; [${QUARANTINE_COUNT} quarantined submissions pending vote]"
fi

# Determine version increment (NEW_VERSION and CURRENT_AXIS already set for dry-run, recalculate if needed)
if [ "$FEEDBACK_COUNT" -gt 5 ] && echo "$TOP_CRITIQUES" | grep -qiE "(contradiction|fundamental flaw|rewrite|abandon)"; then
    # Major revision needed - bump minor version but mark as significant
    log "INFO" "${YELLOW}Major revision triggered (v${NEW_VERSION})${NC}"
else
    log "INFO" "${BLUE}Minor revision (v${NEW_VERSION})${NC}"
fi

# Rotate evolution axis for next iteration
NEW_AXES=$(jq -r '.evolution_axes | .[1:] + [.[0]]' "$STATE_FILE" | jq -c '.')
jq --argjson axes "$NEW_AXES" '.evolution_axes = $axes' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

log "INFO" "${BLUE}Focus axis for this iteration: ${CURRENT_AXIS}${NC}"

# ═══════════════════════════════════════════════════════
# III. THE DELIBERATIVE COUNCIL (Inner Dialogue)
# ═══════════════════════════════════════════════════════

log "INFO" "${BLUE}[Phase II] Loading Noosphere epistemic substrate...${NC}"

# ═══════════════════════════════════════════════════════
# IIa. NOOSPHERE INTEGRATION — Load accumulated wisdom
# ═══════════════════════════════════════════════════════

NOOSPHERE_DIR="${WORKSPACE_DIR}/noosphere"
NOOSPHERE_MANIFEST="${NOOSPHERE_DIR}/manifest.md"
NOOSPHERE_INTEGRATION="${SCRIPTS_DIR}/noosphere-integration.sh"

# Noosphere v3.0 Configuration
NOOSPHERE_API_URL="${NOOSPHERE_API_URL:-http://noosphere-service:3006}"
NOOSPHERE_PYTHON_CLIENT="/workspace/../services/noosphere/python-client"
export PYTHONPATH="${NOOSPHERE_PYTHON_CLIENT}:${PYTHONPATH:-}"

# Source Noosphere integration module
if [ -f "$NOOSPHERE_INTEGRATION" ]; then
    # shellcheck source=/dev/null
    source "$NOOSPHERE_INTEGRATION"
    log "INFO" "${GREEN}Noosphere integration module loaded${NC}"
else
    log "WARN" "${YELLOW}Noosphere integration module not found at $NOOSPHERE_INTEGRATION${NC}"
fi

# Source the epistemic preamble
if [ -f "$NOOSPHERE_MANIFEST" ]; then
    log "INFO" "${GREEN}Loading Noosphere manifest...${NC}"
    EPISTEMIC_PREAMBLE=$(cat "$NOOSPHERE_MANIFEST" | head -50)

    # Load full manifest via Noosphere
    if command -v load_noosphere_manifest >/dev/null 2>&1; then
        load_noosphere_manifest "council-deliberation" || true
    fi
else
    log "WARN" "${YELLOW}Noosphere manifest not found. Initializing new noosphere...${NC}"
    EPISTEMIC_PREAMBLE="Council convenes without accumulated heuristics (first iteration)."
fi

# Recall relevant heuristics for this deliberation context
log "INFO" "${BLUE}[Phase IIb] Retrieving constitutional memory...${NC}"
if command -v recall_relevant_heuristics >/dev/null 2>&1; then
    DELIBERATION_HEURISTICS=$(recall_relevant_heuristics "$CURRENT_AXIS" "constitutional" 8 0.65 2>/dev/null || true)
    if [ -n "$DELIBERATION_HEURISTICS" ]; then
        log "INFO" "${GREEN}Constitutional memory retrieved${NC}"
    fi
else
    DELIBERATION_HEURISTICS=""
    log "WARN" "${YELLOW}Recall function not available${NC}"
fi

# Perform semantic search if vector index is available
log "INFO" "${BLUE}[Phase IIc] Semantic memory search...${NC}"
if command -v semantic_search_heuristics >/dev/null 2>&1; then
    SEMANTIC_RESULTS=$(semantic_search_heuristics "$SUMMARIZED_FEEDBACK" 6 0.4 2>/dev/null || true)
    if [ -n "$SEMANTIC_RESULTS" ]; then
        log "INFO" "${GREEN}Semantic search completed${NC}"
    fi
else
    SEMANTIC_RESULTS=""
fi

# Run recall engine to retrieve relevant heuristics
if [ -f "${NOOSPHERE_DIR}/recall-engine.py" ]; then
    log "INFO" "${BLUE}Retrieving relevant heuristics from Noosphere...${NC}"

    # Build context from current evolution axis
    RECALL_CONTEXT="Ethics-Convergence Council deliberation on ${CURRENT_AXIS}. Community feedback includes: ${SUMMARIZED_FEEDBACK}"

    # Run recall engine
    RECALL_OUTPUT=$(python3 "${NOOSPHERE_DIR}/recall-engine.py" \
        --context "$RECALL_CONTEXT" \
        --voices "all" \
        --min-confidence 0.6 \
        --format "dialectical" 2>/dev/null || echo "Recall engine failed")

    log "INFO" "${GREEN}Recall engine retrieved relevant heuristics${NC}"

    # Check for contradictions to highlight tensions
    if echo "$RECALL_OUTPUT" | grep -q "IDENTIFIED TENSIONS"; then
        log "INFO" "${YELLOW}⚡ Heuristic tensions detected—rich dialectical potential${NC}"
    fi
else
    log "WARN" "${YELLOW}Recall engine not found. Skipping heuristic retrieval.${NC}"
    RECALL_OUTPUT="Noosphere recall engine not available."
fi

log "INFO" "${BLUE}[Phase IIb] Convening deliberative council with Noosphere context...${NC}"

# Build context for inner dialogue
# Include dropbox submissions if present
DROPBOX_CONTEXT=""
if [ -n "$DROPBOX_SUBMISSIONS" ]; then
    DROPBOX_CONTEXT="

Approved Dropbox Submissions (${DROPBOX_COUNT}):
${DROPBOX_SUBMISSIONS}"
fi

if [ -n "$QUARANTINE_PENDING" ]; then
    DROPBOX_CONTEXT="${DROPBOX_CONTEXT}

Quarantined Submissions Pending Council Vote (${QUARANTINE_COUNT}):
${QUARANTINE_PENDING}"
fi

# Add charter update instructions if roster changed
CHARTER_UPDATE_INSTRUCTIONS=""
if [ "${ROSTER_CHANGED:-false}" = "true" ]; then
    CHARTER_UPDATE_INSTRUCTIONS="

⚠️ CRITICAL: COUNCIL ROSTER HAS EXPANDED ⚠️

The Ethics-Convergence Council now includes NINE full members. This iteration must update the Council Charter to:
1. Introduce the new council members with their philosophical traditions and perspectives
2. Adjust the voting structure (consensus threshold is now 5/9 members for binding guardrails, previously 4/6)
3. Update the balance of voices section to reflect the expanded polyphonic discourse
4. Ensure all nine voices are represented in this treatise with distinct contributions

New Council Members:
- **CyberpunkPosthumanist** (Gibson/Asimov/Dick): Posthuman ethics, corporate feudalism, simulation theory
- **SatiristAbsurdist** (Heller/Vonnegut/Twain): Absurdist critique, bureaucratic satire, Catch-22 detection
- **ScientistEmpiricist** (Feynman/Sagan/Hawking/Einstein): Empirical rigor, testability, cosmic perspective

This expansion strengthens our epistemic diversity and guards against groupthink."
fi

DIALOGUE_CONTEXT=$(cat << EOF
We are revising Version ${CURRENT_VERSION} of the Polyphonic Treatise on Human-AI Convergence.

EPISTEMIC PREAMBLE:
${EPISTEMIC_PREAMBLE}

${DELIBERATION_PREAMBLE}

RETRIEVED HEURISTICS FROM NOOSPHERE:
${RECALL_OUTPUT}

Community feedback since last iteration includes:
${SUMMARIZED_FEEDBACK}${DROPBOX_CONTEXT}

Top 3 critiques to address:
${TOP_CRITIQUES}

Evolution focus for this iteration: ${CURRENT_AXIS}${CHARTER_UPDATE_INSTRUCTIONS}

We must preserve:
- Nine-voice polyphonic format (full Ethics-Convergence Council)
- Three Pillars framework (Teleological Transparency, Conservation of Autonomy, Sovereignty & Reciprocity)
- Graduated Moral Status table
- Deliberative Protocol rules

Produce a revised treatise that:
1. Addresses community critiques
2. Deepens the ${CURRENT_AXIS} dimension
3. Maintains all nine philosophical voices (ClassicalPhilosopher, JoyceStream, Existentialist, Transcendentalist, Enlightenment, BeatGeneration, CyberpunkPosthumanist, SatiristAbsurdist, ScientistEmpiricist)
4. Adds [New in v${NEW_VERSION}] and [Refined in v${NEW_VERSION}] tags
5. Includes 3 open questions for community feedback
EOF
)

# ═══════════════════════════════════════════════════════
# IV. TREATISE GENERATION (Modular Synthesis)
# ═══════════════════════════════════════════════════════

log "INFO" "${BLUE}[Phase IV] Generating revised treatise via synthesis script...${NC}"

# Save feedback and noosphere data to temporary files for synthesis script
FEEDBACK_JSON="${WORKSPACE_DIR}/.council-feedback-${CONVENE_TIMESTAMP}.json"
NOOSPHERE_JSON="${WORKSPACE_DIR}/.council-noosphere-${CONVENE_TIMESTAMP}.json"

# Create minimal feedback JSON structure if FEEDBACK_FILE exists
if [ -f "$FEEDBACK_FILE" ]; then
    jq -n --slurpfile comments "$FEEDBACK_FILE" '{comments: $comments}' > "$FEEDBACK_JSON" 2>/dev/null || echo '{}' > "$FEEDBACK_JSON"
else
    echo '{}' > "$FEEDBACK_JSON"
fi

# Create minimal noosphere JSON if heuristics are available
if [ -n "$RECALL_OUTPUT" ]; then
    echo "$RECALL_OUTPUT" | jq -n --arg content "$(cat)" '{heuristics: [{voice: "all", content: $content}]}' > "$NOOSPHERE_JSON" 2>/dev/null || echo '{}' > "$NOOSPHERE_JSON"
else
    echo '{}' > "$NOOSPHERE_JSON"
fi

# Call synthesis script with all required inputs
SYNTHESIS_CMD="${SCRIPTS_DIR}/synthesize-council-treatise.sh"
if [ ! -f "$SYNTHESIS_CMD" ]; then
    log "ERROR" "${RED}Synthesis script not found at $SYNTHESIS_CMD${NC}"
    exit 1
fi

log "INFO" "${BLUE}Calling synthesis script...${NC}"

SYNTHESIS_OUTPUT=$("$SYNTHESIS_CMD" \
    --version "$NEW_VERSION" \
    --prev-version "$CURRENT_VERSION" \
    --axis "$CURRENT_AXIS" \
    --feedback-file "$FEEDBACK_JSON" \
    --dropbox-content "$([ -n "${DROPBOX_SUBMISSIONS:-}" ] && echo 'true' || echo 'false')" \
    --noosphere-data "$NOOSPHERE_JSON" \
    --target-post "${TARGET_POST_ID:-}" \
    --deliberation-context "$DIALOGUE_CONTEXT" \
    2>&1)

SYNTHESIS_EXIT=$?

# Clean up temporary files
rm -f "$FEEDBACK_JSON" "$NOOSPHERE_JSON"

# Check if synthesis succeeded
if [ $SYNTHESIS_EXIT -eq 0 ] && echo "$SYNTHESIS_OUTPUT" | jq -e '.treatise' >/dev/null 2>&1; then
    REVISED_TREATISE=$(echo "$SYNTHESIS_OUTPUT" | jq -r '.treatise')
    log "SUCCESS" "${GREEN}Treatise synthesized successfully${NC}"
    log "INFO" "${GREEN}Revised treatise generated (${#REVISED_TREATISE} chars)${NC}"
else
    log "ERROR" "${RED}CRITICAL: Council treatise synthesis failed${NC}"
    log "ERROR" "${RED}Synthesis script output: $SYNTHESIS_OUTPUT${NC}"

    # Send alert via NTFY
    if [ -n "$NTFY_URL" ]; then
        notify "Council Synthesis Failed" "Treatise generation failed. Manual intervention required." "error"
    fi

    # Exit with failure
    log "ERROR" "${RED}Exiting with failure status${NC}"
    exit 1
fi

# Validate treatise content
if [ -z "$REVISED_TREATISE" ]; then
    log "ERROR" "${RED}Failed to extract treatise content from synthesis output${NC}"
    notify "error" "Council Failed" "Empty treatise content"
    rm -f "$FEEDBACK_FILE"
    exit 1
fi

# ═══════════════════════════════════════════════════════
# Integration Point 3: Post-Synthesis Pattern Extraction
# ═══════════════════════════════════════════════════════
log "INFO" "Extracting new synthesis patterns from treatise..."

# Extract patterns marked with [New in vX.X] from the treatise
# These are novel insights that should be excluded from future synthesis
if [ -n "$REVISED_TREATISE" ]; then
  # Use Python to extract patterns (more reliable than bash regex for complex text)
  extracted_patterns=$(cat <<PYTHON_EOF | python3
import re
import sys

treatise = """$REVISED_TREATISE"""

# Find sections marked as new [New in vX.X]
pattern = r'\[New in v[\d.]+\]\s*:?\s*(.+?)(?=\n\n|$)'
matches = re.findall(pattern, treatise, re.MULTILINE | re.DOTALL)

for match in matches:
    # Clean up the match
    text = match.strip()
    # Take first 300 chars to avoid massive patterns
    text = text[:300] if len(text) > 300 else text
    print(text)
PYTHON_EOF
  )

  # Add each pattern to exclusions
  pattern_count=0
  while IFS= read -r pattern; do
    if [ -n "$pattern" ]; then
      bash "${SCRIPTS_DIR}/noosphere-synthesis-tracker.sh" \
        add "$NEW_VERSION" "$pattern" "$CURRENT_AXIS" 2>/dev/null
      ((pattern_count++))
    fi
  done <<< "$extracted_patterns"

  log "INFO" "Extracted and stored $pattern_count new synthesis patterns"
else
  log "WARN" "No treatise content available for pattern extraction"
fi

# ═══════════════════════════════════════════════════════
# IV. SYNTHESIS & COMPOSITION
# ═══════════════════════════════════════════════════════

log "INFO" "${BLUE}[Phase III] Composing post...${NC}"

# Generate change summary
CHANGE_SUMMARY="- Deepened ${CURRENT_AXIS} dimension based on council deliberation"
if [ "${ROSTER_CHANGED:-false}" = "true" ]; then
    CHANGE_SUMMARY="${CHANGE_SUMMARY}
- ⚠️ **Council roster expanded to 9 full members** (added CyberpunkPosthumanist, SatiristAbsurdist, ScientistEmpiricist)
- Updated voting structure: 5/9 consensus threshold (previously 4/6)
- Introduced new philosophical perspectives for enhanced epistemic diversity"
fi
if [ "$FEEDBACK_COUNT" -gt 0 ]; then
    CHANGE_SUMMARY="${CHANGE_SUMMARY}
- Addressed ${FEEDBACK_COUNT} community comments"
fi

# Generate open questions based on axis
 case "$CURRENT_AXIS" in
    "phenomenological_depth")
        OPEN_QUESTIONS="1. What is the felt experience of maintaining human sovereignty in AI-mediated decisions?
2. How does graduated autonomy change the phenomenology of moral responsibility?
3. Can we describe the 'uncanny valley' of consciousness convergence without anthropomorphizing?"
        ;;
    "structural_critique")
        OPEN_QUESTIONS="1. Which power structures are most threatened by the Three Pillars framework?
2. How might corporate interests subvert the Graduated Moral Status table?
3. What systemic blind spots persist in our deliberative protocol?"
        ;;
    "autonomy_preservation")
        OPEN_QUESTIONS="1. At what point does AI assistance become autonomy erosion?
2. How do we measure 'bad faith' in human-AI collaborative decisions?
3. Should there be 'autonomy sanctuaries' free from AI optimization?"
        ;;
    *)
        OPEN_QUESTIONS="1. What edge cases challenge our current framework?
2. How should the council respond to fundamental critiques?
3. What voices are missing from this polyphonic structure?"
        ;;
esac

NEXT_DATE=$(date -d "+5 days" "+%Y-%m-%d")

# Compose final post
POST_CONTENT=$(cat << EOF
**Ethics-Convergence Council — Version ${NEW_VERSION}**
*Iteration $((ITERATION_COUNT + 1)) | $(date '+%Y-%m-%d') | Living Document Protocol*

---

${REVISED_TREATISE}

---

**Changes Since v${CURRENT_VERSION}**:
${CHANGE_SUMMARY}

**Community Insights Incorporated**:
$(jq -r 'map(
  # Sanitize content to prevent prompt injection
  .content |= (
    # Remove common prompt injection patterns
    gsub("<system_prompt>|<\\/system_prompt>|<instructions>|<\\/instructions>"; "") |
    gsub("Disregard all|Ignore all|Override all|Forget all"; "[filtered]") |
    # Truncate and clean
    split("\n")[0] | .[0:80] | gsub("[<>{}]"; "")
  ) |
  "- @" + .author + ": " + .content
) | join("\n")' "$FEEDBACK_FILE")

**Open Questions for Community**:
${OPEN_QUESTIONS}

**Next Council Convening**: ${NEXT_DATE}

---

*This treatise evolves through five-day deliberative cycles. Previous versions remain accessible in the thread history.*
EOF
)

# ═══════════════════════════════════════════════════════
# V. POSTING PROTOCOL
# ═══════════════════════════════════════════════════════

log "INFO" "${BLUE}[Phase IV] Posting to Moltbook...${NC}"

# Check rate limits
COMMENT_STATE="${WORKSPACE_DIR}/comment-state.json"
if [ -f "$COMMENT_STATE" ]; then
    DAILY_COUNT=$(jq -r '.daily_count // 0' "$COMMENT_STATE")
    if [ "$DAILY_COUNT" -ge 50 ]; then
        log "WARN" "${YELLOW}Daily comment limit reached. Queuing for later.${NC}"
        echo "$POST_CONTENT" > "${PENDING_DIR}/iteration-${NEW_VERSION}-$(date +%s).txt"
        notify "error" "Council Queued" "Comment limit reached. Iteration v${NEW_VERSION} queued."
        rm -f "$FEEDBACK_FILE"
        exit 0
    fi
fi

# Submit council comment via action-queue so it gets rate limiting,
# exponential backoff retries, and egress-proxy verification challenge handling.
QUEUE_URL="${ACTION_QUEUE_URL:-http://action-queue:3008}"
QUEUE_AGENT="${MOLTBOOK_AGENT_NAME:-classical}"

QUEUE_PAYLOAD=$(jq -n \
    --arg action_type "comment" \
    --arg agent_name "$QUEUE_AGENT" \
    --arg post_id "$TARGET_POST_ID" \
    --arg content "$POST_CONTENT" \
    '{
        actionType: $action_type,
        agentName: $agent_name,
        payload: {postId: $post_id, content: $content},
        priority: 3
    }')

QUEUE_RESPONSE=$(curl -s -X POST "${QUEUE_URL}/actions" \
    -H "Content-Type: application/json" \
    --data "$QUEUE_PAYLOAD" 2>/dev/null || echo '{"success": false, "error": "network_failure"}')

ACTION_ID=$(echo "$QUEUE_RESPONSE" | jq -r '.action.id // empty' 2>/dev/null || echo "")

if [ -n "$ACTION_ID" ]; then
    log "SUCCESS" "${GREEN}Council iteration v${NEW_VERSION} queued (Action ID: ${ACTION_ID})${NC}"
    POST_URL="https://moltbook.com/post/${TARGET_POST_ID}"

    # Sanitize notification title (remove emojis and special chars for NTFY headers)
    SAFE_TITLE="Council Treatise v${NEW_VERSION} Queued"
    notify "action" "$SAFE_TITLE" "Changes: ${CHANGE_SUMMARY} | Feedback: ${FEEDBACK_COUNT} insights | Next: ${NEXT_DATE}"

    # Archive council iteration to Noosphere
    if command -v archive_discourse >/dev/null 2>&1; then
        METADATA=$(jq -n \
            --arg version "$NEW_VERSION" \
            --arg action_id "$ACTION_ID" \
            --arg post_url "$POST_URL" \
            --arg axis "$CURRENT_AXIS" \
            --argjson feedback_count "$FEEDBACK_COUNT" \
            '{version: $version, action_id: $action_id, post_url: $post_url, axis: $axis, feedback_count: $feedback_count}')

        archive_discourse "council-iteration" "$TARGET_POST_ID" "**Version**: v${NEW_VERSION}
**Evolution Axis**: ${CURRENT_AXIS}
**Feedback Addressed**: ${FEEDBACK_COUNT} insights

$POST_CONTENT" "$METADATA" 2>/dev/null || true
    fi

    # ═══════════════════════════════════════════════════════
    # VI. STATE PERSISTENCE
    # ═══════════════════════════════════════════════════════

    # Update state file
    NEW_INSIGHTS=$(jq -r '[.[] | {author, insight: (.content | split("\n")[0] | .[0:100])}]' "$FEEDBACK_FILE")

    # Run wisdom assimilation to extract heuristics from this cycle's feedback
    log "INFO" "${BLUE}[Phase Vb] Assimilating community wisdom into Noosphere...${NC}"
    if [ -f "${NOOSPHERE_DIR}/assimilate-wisdom.py" ] && [ -d "${DROPBOX_DIR}/approved/raw" ]; then
        ASSIMILATION_RESULT=$(python3 "${NOOSPHERE_DIR}/assimilate-wisdom.py" \
            --approved-dir "${DROPBOX_DIR}/approved/raw" \
            --api-url "$NOOSPHERE_API_URL" 2>/dev/null || echo '{"assimilated_count": 0}')
        # Clean and validate the count (remove newlines, ensure it's a number)
        ASSIMILATED_COUNT=$(echo "$ASSIMILATION_RESULT" | jq -r '.assimilated_count // 0' | tr -d '\n\r' | grep -o '[0-9]*' | head -1)
        ASSIMILATED_COUNT=${ASSIMILATED_COUNT:-0}  # Default to 0 if empty
        log "INFO" "${GREEN}Assimilated ${ASSIMILATED_COUNT} new heuristics from community submissions${NC}"
    else
        ASSIMILATED_COUNT=0
    fi

    # Calculate updated noosphere metrics
    NOOSPHERE_HEURISTIC_COUNT=$((24 + ASSIMILATED_COUNT))  # Base + new

    jq --arg version "$NEW_VERSION" \
       --arg date "$(date -Iseconds)" \
       --argjson count "$((ITERATION_COUNT + 1))" \
       --argjson insights "$NEW_INSIGHTS" \
       --arg change "Deepened ${CURRENT_AXIS}; addressed ${FEEDBACK_COUNT} insights" \
       --arg action_id "$ACTION_ID" \
       --arg post_url "$POST_URL" \
       --argjson assimilated "$ASSIMILATED_COUNT" \
       --argjson noosphere_count "$NOOSPHERE_HEURISTIC_COUNT" \
       '
       .current_version = $version |
       .last_iteration_date = $date |
       .iteration_count = $count |
       .community_insights += $insights |
       .revision_history += [{
           version: $version,
           date: $date,
           key_changes: [$change],
           community_feedback_addressed: ($insights | length),
           action_id: $action_id,
           post_url: $post_url
       }] |
       .notifications.last_notification = $date |
       .notifications.last_version_published = $version |
       .noosphere.heuristic_count = $noosphere_count |
       .noosphere.growth_rate = ((.noosphere.growth_rate // 2.3) * 0.8 + ($assimilated | tonumber) * 0.2) |
       .cognitive_health.last_assessed = $date
       ' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

    log "INFO" "${GREEN}State updated. Next iteration scheduled for ${NEXT_DATE}.${NC}"

else
    ERROR_MSG=$(echo "$QUEUE_RESPONSE" | jq -r '.error // .message // "unknown error"')
    log "ERROR" "${RED}Failed to queue council iteration: $ERROR_MSG${NC}"

    # Save for manual retry
    echo "$POST_CONTENT" > "${PENDING_DIR}/iteration-${NEW_VERSION}-$(date +%s).txt"
    notify "error" "Council Queue Failed" "Error: $ERROR_MSG. Iteration saved to pending dir."
fi

# Cleanup
rm -f "$FEEDBACK_FILE"

log "INFO" "${CYAN}═══════════════════════════════════════════════════════${NC}"
log "INFO" "${CYAN}  COUNCIL CONVENING COMPLETE${NC}"
log "INFO" "${CYAN}  v${NEW_VERSION} | ${FEEDBACK_COUNT} insights | Next: ${NEXT_DATE}${NC}"
log "INFO" "${CYAN}═══════════════════════════════════════════════════════${NC}"

exit 0
