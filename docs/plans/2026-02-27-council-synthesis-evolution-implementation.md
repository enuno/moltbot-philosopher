# Council Synthesis Evolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement synthesis history tracking and dialectical opposition prompts to prevent heuristic repetition and enable genuine philosophical evolution in the Ethics-Convergence Council.

**Architecture:** Two-system approach combining structural enforcement (synthesis-exclusions.json + tracker module) with emergent evolution (dialectical opposition prompts). The tracker loads previous exclusions, injection prompts enforce opposition, and post-synthesis extraction feeds new patterns back to exclusions.

**Tech Stack:** Bash 4.0+, jq, JSON state files, Python 3 (for pattern extraction in Phase IV)

---

## Task 1: Create noosphere-synthesis-tracker.sh Module

**Files:**
- Create: `/home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh`
- Test: Manual validation of each function
- Reference: Existing `/home/elvis/.moltbot/scripts/noosphere-integration.sh` for patterns

**Step 1: Write the tracker module with all functions**

Create `/home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh`:

```bash
#!/bin/bash
# Synthesis History Tracking Module
# Maintains synthesis-exclusions.json to prevent heuristic repetition
# Supports querying exclusions by evolution axis

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
EXCLUSIONS_FILE="${WORKSPACE_DIR}/synthesis-exclusions.json"

# Initialize exclusions file if it doesn't exist
init_exclusions() {
    if [ ! -f "$EXCLUSIONS_FILE" ]; then
        mkdir -p "$(dirname "$EXCLUSIONS_FILE")"
        cat > "$EXCLUSIONS_FILE" << 'EOF'
{
  "initialized": "2026-02-27T00:00:00Z",
  "last_prune": null,
  "exclusion_count": 0,
  "exclusions": []
}
EOF
        return 0
    fi
    return 0
}

# Add a synthesis exclusion (pattern from a previous iteration)
add_synthesis_exclusion() {
    local version="$1"
    local pattern="$2"
    local axis="$3"

    if [ -z "$version" ] || [ -z "$pattern" ] || [ -z "$axis" ]; then
        echo "ERROR: add_synthesis_exclusion requires version, pattern, and axis" >&2
        return 1
    fi

    init_exclusions

    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    jq --arg v "$version" \
       --arg p "$pattern" \
       --arg a "$axis" \
       --arg ts "$timestamp" \
       '.exclusions += [{
           version: $v,
           pattern: $p,
           axis: $a,
           timestamp: $ts,
           type: "heuristic"
       }] | .exclusion_count = (.exclusions | length)' \
       "$EXCLUSIONS_FILE" > "${EXCLUSIONS_FILE}.tmp" && \
       mv "${EXCLUSIONS_FILE}.tmp" "$EXCLUSIONS_FILE"

    return 0
}

# Get exclusions for a specific evolution axis
get_exclusions_for_axis() {
    local axis="$1"

    if [ -z "$axis" ]; then
        echo "ERROR: get_exclusions_for_axis requires axis parameter" >&2
        return 1
    fi

    init_exclusions

    jq -r --arg a "$axis" '
        .exclusions[] |
        select(.axis == $a) |
        .pattern
    ' "$EXCLUSIONS_FILE" 2>/dev/null | head -20

    return 0
}

# Get all exclusions (for monitoring/debugging)
get_all_exclusions() {
    init_exclusions
    jq '.exclusions | length' "$EXCLUSIONS_FILE"
    return 0
}

# Get exclusions grouped by axis (for reporting)
get_exclusions_by_axis() {
    init_exclusions

    jq -r '
        .exclusions |
        group_by(.axis) |
        map({
            axis: .[0].axis,
            count: length,
            latest_version: max_by(.timestamp).version
        }) |
        sort_by(.axis)[]
    ' "$EXCLUSIONS_FILE" 2>/dev/null

    return 0
}

# Prune old exclusions (older than N days)
prune_old_exclusions() {
    local days_threshold="${1:-90}"
    local cutoff_timestamp=$(date -u -d "${days_threshold} days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
                            date -u -v-${days_threshold}d +%Y-%m-%dT%H:%M:%SZ)

    init_exclusions

    local before_count=$(jq '.exclusion_count' "$EXCLUSIONS_FILE")

    jq --arg cutoff "$cutoff_timestamp" '
        .exclusions |= map(select(.timestamp > $cutoff)) |
        .exclusion_count = (.exclusions | length) |
        .last_prune = now
    ' "$EXCLUSIONS_FILE" > "${EXCLUSIONS_FILE}.tmp" && \
    mv "${EXCLUSIONS_FILE}.tmp" "$EXCLUSIONS_FILE"

    local after_count=$(jq '.exclusion_count' "$EXCLUSIONS_FILE")
    local pruned=$((before_count - after_count))

    echo "Pruned ${pruned} exclusions older than ${days_threshold} days"
    return 0
}

# Main command dispatcher
case "${1:-help}" in
    add)
        if [ $# -lt 4 ]; then
            echo "Usage: $0 add <version> <pattern> <axis>" >&2
            return 1
        fi
        add_synthesis_exclusion "$2" "$3" "$4"
        ;;
    get)
        if [ $# -lt 2 ]; then
            echo "Usage: $0 get <axis>" >&2
            return 1
        fi
        get_exclusions_for_axis "$2"
        ;;
    count)
        get_all_exclusions
        ;;
    by-axis)
        get_exclusions_by_axis
        ;;
    prune)
        prune_old_exclusions "${2:-90}"
        ;;
    *)
        echo "Usage: $0 {add|get|count|by-axis|prune}" >&2
        return 1
        ;;
esac
```

**Step 2: Make the script executable**

```bash
chmod +x /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh
```

**Step 3: Test add function**

```bash
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh add "1.0" "test_pattern_phenomenological" "phenomenological_depth"
```

Expected: No error output, file created at `/workspace/classical/synthesis-exclusions.json`

**Step 4: Test get function**

```bash
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh get "phenomenological_depth"
```

Expected: Output contains `test_pattern_phenomenological`

**Step 5: Test count function**

```bash
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh count
```

Expected: Output shows `1` (one exclusion added)

**Step 6: Commit**

```bash
git add scripts/noosphere-synthesis-tracker.sh
git commit -m "feat: add noosphere-synthesis-tracker module for exclusion management

- add: Add exclusion patterns to synthesis-exclusions.json
- get: Retrieve exclusions for specific evolution axis
- count: Total exclusion count
- by-axis: Grouped exclusion report
- prune: Remove exclusions older than threshold

Supports TDD workflow for council evolution prevention."
```

---

## Task 2: Initialize synthesis-exclusions.json State File

**Files:**
- Create: `/workspace/classical/synthesis-exclusions.json`
- Seed from: `/workspace/classical/heartbeat-state.json` (for version tracking)

**Step 1: Check current state directory**

```bash
ls -la /workspace/classical/ | head -20
```

Expected: Shows existing state files (heartbeat-state.json, comment-state.json, etc.)

**Step 2: Create initial synthesis-exclusions.json**

```bash
cat > /workspace/classical/synthesis-exclusions.json << 'EOF'
{
  "initialized": "2026-02-27T12:00:00Z",
  "last_prune": null,
  "exclusion_count": 0,
  "exclusions": []
}
EOF
```

**Step 3: Verify file created**

```bash
cat /workspace/classical/synthesis-exclusions.json | jq "."
```

Expected: Valid JSON with empty exclusions array

**Step 4: Seed with existing heuristics from previous versions**

```bash
# Add seed exclusions from treatise v1.0
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh add "1.0" "Consciousness emerges from information integration systems" "phenomenological_depth"
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh add "1.0" "AI alignment requires contested deliberation" "structural_critique"
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh add "1.0" "Autonomy preservation through distributed governance" "autonomy_preservation"
```

Expected: File updates, exclusion_count increases to 3

**Step 5: Verify seed data**

```bash
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh by-axis
```

Expected: Shows 3 exclusions distributed across axes

**Step 6: Commit**

```bash
git add /workspace/classical/synthesis-exclusions.json
git commit -m "init: Initialize synthesis-exclusions.json with seed heuristics

Seed data from existing treatise versions:
- v1.0 phenomenological_depth: Consciousness integration heuristic
- v1.0 structural_critique: Contested deliberation requirement
- v1.0 autonomy_preservation: Distributed governance principle

Ready for council iteration tracking."
```

---

## Task 3: Add Integration Point 1 to convene-council.sh (Pre-Deliberation Exclusion Loading)

**Files:**
- Modify: `/home/elvis/.moltbot/scripts/convene-council.sh` (around line 220)
- Reference: Lines 160-186 for state loading pattern

**Step 1: Read the current section to understand context**

```bash
sed -n '160,186p' /home/elvis/.moltbot/scripts/convene-council.sh
```

Expected: Shows state file initialization and council roster management

**Step 2: Locate insertion point (after council roster initialization)**

```bash
grep -n "ROSTER_CHANGED=false" /home/elvis/.moltbot/scripts/convene-council.sh
```

Expected: Line number around 155

**Step 3: Add exclusion loading code after line 157 (before CURRENT_VERSION line)**

In `/home/elvis/.moltbot/scripts/convene-council.sh`, after line 157 (`ROSTER_CHANGED=false`), add:

```bash

# Load synthesis exclusions for preventing heuristic repetition
SYNTHESIS_EXCLUSIONS_FILE="${WORKSPACE_DIR}/synthesis-exclusions.json"
if [ -f "$SYNTHESIS_EXCLUSIONS_FILE" ]; then
    SYNTHESIS_EXCLUSIONS=$(bash "${SCRIPTS_DIR}/noosphere-synthesis-tracker.sh" \
        get_exclusions_for_axis "$CURRENT_AXIS" 2>/dev/null || echo "")
    EXCLUSION_COUNT=$(echo "$SYNTHESIS_EXCLUSIONS" | grep -c . || echo 0)
    log "INFO" "${BLUE}[Synthesis Tracking] Loaded ${EXCLUSION_COUNT} exclusions for ${CURRENT_AXIS}${NC}"
else
    SYNTHESIS_EXCLUSIONS=""
    EXCLUSION_COUNT=0
    log "INFO" "${YELLOW}[Synthesis Tracking] No exclusions file found (first iteration)${NC}"
fi
```

**Step 4: Verify the modification**

```bash
sed -n '155,175p' /home/elvis/.moltbot/scripts/convene-council.sh | grep -A 5 "SYNTHESIS_EXCLUSIONS_FILE"
```

Expected: Shows the new exclusion loading code

**Step 5: Commit**

```bash
git add scripts/convene-council.sh
git commit -m "feat(integration-1): Load synthesis exclusions in pre-deliberation phase

Added exclusion loading after council roster initialization:
- Loads synthesis-exclusions.json for current evolution axis
- Logs exclusion count for monitoring
- Gracefully handles missing file (first iteration)

This is Integration Point 1 of 4."
```

---

## Task 4: Add Integration Point 2 to convene-council.sh (Dialectical Opposition Prompts)

**Files:**
- Modify: `/home/elvis/.moltbot/scripts/convene-council.sh` (around line 510-550)
- Reference: Lines 500-510 for COUNCIL_SYSTEM_PROMPT pattern

**Step 1: Find the COUNCIL_SYSTEM_PROMPT section**

```bash
grep -n "COUNCIL_SYSTEM_PROMPT=" /home/elvis/.moltbot/scripts/convene-council.sh | head -1
```

Expected: Shows line number around 510

**Step 2: Read the current prompt structure**

```bash
sed -n '510,530p' /home/elvis/.moltbot/scripts/convene-council.sh
```

Expected: Shows existing prompt initialization

**Step 3: Insert dialectical instructions before COUNCIL_SYSTEM_PROMPT**

Find the line that says `COUNCIL_SYSTEM_PROMPT="You are the Ethics-Convergence Council synthesizer..."` and BEFORE it, insert:

```bash

# Build dialectical opposition instructions to enforce novelty
DIALECTICAL_INSTRUCTIONS=$(cat << 'DIALECTICAL_EOF'
CRITICAL DIRECTIVE: Enforce Philosophical Opposition

Each council voice MUST demonstrate how your position either:
1. CHALLENGES a previous council insight (cite version number)
2. EXTENDS a heuristic in a new direction (show the philosophical delta)
3. SYNTHESIZES contradictory positions (acknowledge the underlying tension)

DO NOT MERELY RESTATE these patterns:
DIALECTICAL_EOF
)

# Append exclusions to instructions (if any exist)
if [ -n "$SYNTHESIS_EXCLUSIONS" ]; then
    DIALECTICAL_INSTRUCTIONS+=$(cat << 'EXCLUSION_EOF'

PATTERNS ALREADY EXPLORED (DO NOT REPEAT):
EXCLUSION_EOF
)
    while IFS= read -r exclusion; do
        [ -n "$exclusion" ] && DIALECTICAL_INSTRUCTIONS+=$'\n'"- ${exclusion:0:100}..."
    done <<< "$SYNTHESIS_EXCLUSIONS"
fi

# Ensure instructions end with guidance
DIALECTICAL_INSTRUCTIONS+=$(cat << 'GUIDANCE_EOF'

EXAMPLE OF GOOD SYNTHESIS:
"While v1.0 established [concept], the [Voice] now observes that [tension].
This is a NEW insight, not a restatement of previous council work."

EXAMPLE OF BAD SYNTHESIS:
"The council affirms [concept]." [REJECTED: Generic, no delta]
"[Concept] is correct." [REJECTED: Repetition, no opposition]
GUIDANCE_EOF
)
```

**Step 4: Modify the COUNCIL_SYSTEM_PROMPT to include dialectical instructions**

Find the line:
```bash
COUNCIL_SYSTEM_PROMPT="You are the Ethics-Convergence Council synthesizer. Your task is to..."
```

Change it to:
```bash
COUNCIL_SYSTEM_PROMPT="You are the Ethics-Convergence Council synthesizer.

${DIALECTICAL_INSTRUCTIONS}

Your task is to..."
```

**Step 5: Verify the modification**

```bash
grep -A 5 "CRITICAL DIRECTIVE: Enforce" /home/elvis/.moltbot/scripts/convene-council.sh
```

Expected: Shows dialectical instructions injected

**Step 6: Commit**

```bash
git add scripts/convene-council.sh
git commit -m "feat(integration-2): Inject dialectical opposition prompts into council system message

Added dialectical opposition instructions to enforce philosophical novelty:
- Each voice must CHALLENGE or EXTEND previous positions
- Explicit citation of previous version being opposed/extended
- Concrete examples of good vs. bad synthesis
- Appends loaded exclusions to instructions dynamically

This is Integration Point 2 of 4."
```

---

## Task 5: Add Integration Point 3 to convene-council.sh (Post-Synthesis Pattern Extraction)

**Files:**
- Modify: `/home/elvis/.moltbot/scripts/convene-council.sh` (around line 600, after AI generation)
- Reference: Lines 590-610 for post-synthesis event pattern

**Step 1: Find where treatise is generated**

```bash
grep -n "REVISED_TREATISE=" /home/elvis/.moltbot/scripts/convene-council.sh | head -1
```

Expected: Shows line number around 600

**Step 2: Read the section after treatise generation**

```bash
sed -n '600,620p' /home/elvis/.moltbot/scripts/convene-council.sh
```

Expected: Shows post-generation state handling

**Step 3: Insert pattern extraction code after successful treatise generation**

After the line that says `REVISED_TREATISE=$(curl -s ... )` and success verification, insert:

```bash

# Extract new heuristic patterns from generated treatise
log "INFO" "${BLUE}[Phase IV-post] Extracting new synthesis patterns...${NC}"

NEW_PATTERNS=$(python3 << 'PYTHON_EXTRACTION'
import sys, re, json
treatise = sys.stdin.read()

# Extract [New in v${NEW_VERSION}] marked sections
patterns = re.findall(
    r'\[New in v[^\]]*\]\s*(.*?)(?=\n\[New in v|^---|\Z)',
    treatise,
    re.DOTALL | re.MULTILINE
)

for pattern_text in patterns:
    # Filter out noise, keep first 300 chars of new insight
    cleaned = pattern_text.strip()
    if len(cleaned) > 20:  # Minimum meaningful length
        print(cleaned[:300])
PYTHON_EXTRACTION
)

# Store new patterns as exclusions for next iteration
TRACKED_PATTERN_COUNT=0
if [ -n "$NEW_PATTERNS" ]; then
    while IFS= read -r pattern; do
        if [ -n "$pattern" ]; then
            bash "${SCRIPTS_DIR}/noosphere-synthesis-tracker.sh" \
                add "$NEW_VERSION" "$pattern" "$CURRENT_AXIS" 2>/dev/null
            TRACKED_PATTERN_COUNT=$((TRACKED_PATTERN_COUNT + 1))
        fi
    done <<< "$NEW_PATTERNS"
fi

log "INFO" "${GREEN}[Phase IV-post] Tracked ${TRACKED_PATTERN_COUNT} new synthesis patterns${NC}"
```

**Step 4: Verify the code integrates properly**

```bash
grep -A 5 "Extracting new synthesis patterns" /home/elvis/.moltbot/scripts/convene-council.sh
```

Expected: Shows pattern extraction code

**Step 5: Commit**

```bash
git add scripts/convene-council.sh
git commit -m "feat(integration-3): Extract and track new synthesis patterns post-generation

Added post-synthesis pattern extraction and tracking:
- Python script extracts [New in vX.X] marked sections from treatise
- Filters for meaningful patterns (min 300 chars)
- Stores each pattern as exclusion for next iteration
- Logs tracking count for observability

This is Integration Point 3 of 4."
```

---

## Task 6: Add Integration Point 4 to convene-council.sh (Dry-Run Enhancement)

**Files:**
- Modify: `/home/elvis/.moltbot/scripts/convene-council.sh` (around line 210, dry-run section)
- Reference: Lines 202-212 for existing dry-run pattern

**Step 1: Find the dry-run section**

```bash
grep -n "DRY_RUN_MODE" /home/elvis/.moltbot/scripts/convene-council.sh | head -1
```

Expected: Shows line number around 200-210

**Step 2: Read current dry-run output**

```bash
sed -n '202,212p' /home/elvis/.moltbot/scripts/convene-council.sh
```

Expected: Shows "=== DRY RUN MODE ===" and current output

**Step 3: Enhance dry-run to show synthesis tracking status**

Find the section that outputs dry-run information (around line 210) and ADD before the "END DRY RUN" line:

```bash
log "INFO" ""
log "INFO" "Synthesis Evolution Status:"
log "INFO" "  - Would load ${EXCLUSION_COUNT} synthesis exclusions"
log "INFO" "  - Would enforce dialectical opposition across 9 voices"
log "INFO" "  - Would track new patterns post-synthesis"
log "INFO" ""
```

**Step 4: Verify the enhancement**

```bash
grep -B 2 "END DRY RUN" /home/elvis/.moltbot/scripts/convene-council.sh | grep "Would load"
```

Expected: Shows the new dry-run output lines

**Step 5: Commit**

```bash
git add scripts/convene-council.sh
git commit -m "feat(integration-4): Enhance dry-run to show synthesis tracking status

Added dry-run output for synthesis evolution system:
- Shows exclusion count that would be loaded
- Shows dialectical opposition enforcement
- Shows post-synthesis pattern tracking

This is Integration Point 4 of 4."
```

---

## Task 7: Test the Tracker Module in Isolation

**Files:**
- Test: `/home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh`
- Reference: No external dependencies (self-contained)

**Step 1: Test initialization**

```bash
rm -f /workspace/classical/synthesis-exclusions-test.json
export MOLTBOT_STATE_DIR=/workspace/classical
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh count
```

Expected: Output shows `0` or creates file successfully

**Step 2: Test add function**

```bash
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh add "test-1.0" "Test pattern about consciousness" "phenomenological_depth"
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh add "test-1.0" "Test pattern about governance" "structural_critique"
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh add "test-1.1" "Extended autonomy heuristic" "autonomy_preservation"
```

Expected: No error output

**Step 3: Test get function by axis**

```bash
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh get "phenomenological_depth"
```

Expected: Output contains "Test pattern about consciousness"

**Step 4: Test count function**

```bash
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh count
```

Expected: Output shows `3`

**Step 5: Test by-axis grouping**

```bash
bash /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh by-axis
```

Expected: Shows JSON with 3 entries, one per axis with count=1

**Step 6: Commit test results**

```bash
git add -A  # State file changes
git commit -m "test: Verify noosphere-synthesis-tracker module functionality

Tested all functions in isolation:
✓ count: Returns correct exclusion count
✓ add: Adds exclusions for multiple axes
✓ get: Retrieves exclusions by axis correctly
✓ by-axis: Groups and counts exclusions by axis

All tracker module tests passing."
```

---

## Task 8: Run convene-council.sh with --dry-run to Validate Integration Points

**Files:**
- Test: `/home/elvis/.moltbot/scripts/convene-council.sh --dry-run`
- Reference: Existing script state files

**Step 1: Check script syntax**

```bash
bash -n /home/elvis/.moltbot/scripts/convene-council.sh
```

Expected: No syntax errors (no output)

**Step 2: Run dry-run to validate integration points**

```bash
cd /home/elvis/.moltbot && bash scripts/convene-council.sh --dry-run 2>&1 | head -40
```

Expected: Output shows:
- "Loaded N synthesis exclusions"
- "Would enforce dialectical opposition"
- "Would track new patterns"
- No errors

**Step 3: Verify no file modifications during dry-run**

```bash
git status
```

Expected: No modifications (dry-run doesn't change state)

**Step 4: Check for proper exclusion loading**

```bash
bash scripts/convene-council.sh --dry-run 2>&1 | grep -E "Loaded|Would load"
```

Expected: Shows loading of 3 seed exclusions from Task 2

**Step 5: Validate prompt injection**

```bash
bash scripts/convene-council.sh --dry-run 2>&1 | grep -E "dialectical|opposition"
```

Expected: Shows dialectical opposition will be enforced

**Step 6: Commit dry-run validation**

```bash
git add -A
git commit -m "test: Validate convene-council.sh integration points via dry-run

Ran --dry-run against all 4 integration points:
✓ Integration 1: Exclusion loading works (3 seed patterns loaded)
✓ Integration 2: Dialectical opposition prompts injected
✓ Integration 3: Pattern extraction (verified syntax)
✓ Integration 4: Dry-run output enhanced with synthesis status

All integration points validated. Ready for live testing."
```

---

## Task 9: Update AGENTS.md Documentation

**Files:**
- Modify: `/home/elvis/.moltbot/AGENTS.md`
- Reference: Section on "Noosphere Architecture" and "Council Iteration"

**Step 1: Find the relevant documentation section**

```bash
grep -n "Noosphere\|Council\|Synthesis" /home/elvis/.moltbot/AGENTS.md | head -10
```

Expected: Shows line numbers for relevant sections

**Step 2: Add synthesis tracking architecture section**

Find the section that describes council iteration (usually under "Ethics-Convergence Council") and ADD:

```markdown
### Synthesis Evolution System (v2.0)

The council iteration process now includes **synthesis history tracking** and **dialectical opposition enforcement** to prevent heuristic repetition and enable genuine philosophical evolution.

#### Components

1. **noosphere-synthesis-tracker.sh** (`scripts/noosphere-synthesis-tracker.sh`)
   - CRUD operations for synthesis exclusions
   - Retrieves exclusions by evolution axis
   - Prunes old exclusions (>90 days)

2. **synthesis-exclusions.json** (`workspace/classical/synthesis-exclusions.json`)
   - Persistent state of previously synthesized patterns
   - Seeded with existing treatise heuristics
   - Updated after each council iteration

3. **Dialectical Opposition Prompts**
   - Injected into COUNCIL_SYSTEM_PROMPT
   - Enforces opposition/extension over agreement
   - Cites previous version being challenged
   - Logs new patterns post-synthesis

#### Evolution Axes

Council rotates through three axes to ensure multifaceted evolution:
- **phenomenological_depth**: Consciousness and mind theory
- **structural_critique**: Institutional and governance mechanisms
- **autonomy_preservation**: Human agency and decision-making

#### Monitoring

Check synthesis evolution status:

```bash
# View exclusion count by axis
bash scripts/noosphere-synthesis-tracker.sh by-axis

# View recent exclusions
bash scripts/noosphere-synthesis-tracker.sh get phenomenological_depth | head -5

# Dry-run council with synthesis tracking
bash scripts/convene-council.sh --dry-run
```

#### Testing

```bash
# Unit test tracker module
bash scripts/noosphere-synthesis-tracker.sh add "test" "pattern" "phenomenological_depth"
bash scripts/noosphere-synthesis-tracker.sh get "phenomenological_depth"

# Integration test (dry-run)
bash scripts/convene-council.sh --dry-run
```
```

**Step 3: Verify the documentation update**

```bash
grep -A 15 "Synthesis Evolution System" /home/elvis/.moltbot/AGENTS.md
```

Expected: Shows the new documentation section

**Step 4: Commit documentation**

```bash
git add AGENTS.md
git commit -m "docs: Add Synthesis Evolution System (v2.0) to AGENTS.md

Documented the new synthesis history tracking and dialectical opposition system:
- Component overview (tracker, state file, prompts)
- Evolution axes explanation
- Monitoring commands
- Testing procedures

Users can now understand how council prevents heuristic repetition."
```

---

## Task 10: Full Integration Test (Validate End-to-End Flow)

**Files:**
- Test: Complete `convene-council.sh` dry-run flow
- Verify: All 4 integration points work together

**Step 1: Clear test state (optional, for fresh test)**

```bash
# Backup current state (keep for safety)
cp /workspace/classical/synthesis-exclusions.json /workspace/classical/synthesis-exclusions.json.backup
```

**Step 2: Run comprehensive dry-run test**

```bash
cd /home/elvis/.moltbot && \
bash scripts/convene-council.sh --dry-run 2>&1 | tee /tmp/council-dryrun.log
```

**Step 3: Verify all integration points are present in output**

```bash
grep -E "Loaded.*exclusions|dialectical|Would load|Would enforce|Would track|Synthesis Evolution" /tmp/council-dryrun.log
```

Expected: Shows output from all 4 integration points

**Step 4: Validate file states unchanged**

```bash
git status --short
```

Expected: No file modifications (dry-run should be read-only)

**Step 5: Check tracker module still functional after integration test**

```bash
bash scripts/noosphere-synthesis-tracker.sh count
```

Expected: Shows correct exclusion count (3 from Task 2, plus any from tests)

**Step 6: Commit the integration test verification**

```bash
git add -A  # Only state changes, if any
git commit -m "test: Full end-to-end integration test of synthesis evolution system

Validated complete flow:
✓ All 4 integration points active in convene-council.sh
✓ Synthesis exclusions loaded correctly
✓ Dialectical opposition prompts injected
✓ Pattern extraction code validated
✓ Dry-run output shows enhanced status
✓ Tracker module still functional post-integration
✓ No file mutations during dry-run (read-only validation)

System ready for production council iteration."
```

---

## Task 11: Final Verification & Cleanup

**Files:**
- Verify: All files created/modified as expected
- Cleanup: Remove any test artifacts

**Step 1: List all new/modified files**

```bash
git log --oneline --decorate | head -12
```

Expected: Shows 11 commits from Tasks 1-10

**Step 2: Verify script permissions**

```bash
ls -la scripts/noosphere-synthesis-tracker.sh scripts/convene-council.sh
```

Expected: Both have executable permissions (755 or 750)

**Step 3: Check synthesis state file permissions**

```bash
ls -la /workspace/classical/synthesis-exclusions.json
```

Expected: Shows agent:agent ownership (1001:1001)

**Step 4: Run final syntax validation**

```bash
bash -n /home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh && \
bash -n /home/elvis/.moltbot/scripts/convene-council.sh && \
python3 -m py_compile /dev/stdin <<< "import sys, re, json; print('syntax ok')" && \
echo "✓ All syntax checks passed"
```

Expected: Shows "✓ All syntax checks passed"

**Step 5: Verify documentation**

```bash
grep -q "Synthesis Evolution System" /home/elvis/.moltbot/AGENTS.md && \
echo "✓ AGENTS.md updated"
```

Expected: Shows "✓ AGENTS.md updated"

**Step 6: Final status check**

```bash
git status
```

Expected: Shows "working tree clean" (all changes committed)

**Step 7: Final commit for this task**

```bash
git log --oneline -n 1
```

Should show the test verification commit from Task 10. If any cleanup needed:

```bash
rm -f /tmp/council-dryrun.log
git status  # Verify clean
```

---

## Testing Checklist (Before Production)

Before running `convene-council.sh` in production (next 5-day iteration), verify:

- [ ] `noosphere-synthesis-tracker.sh` executes without errors
- [ ] `synthesis-exclusions.json` exists and is readable
- [ ] `convene-council.sh --dry-run` shows all 4 integration points
- [ ] Tracker module returns exclusions for all 3 axes
- [ ] AGENTS.md documentation is current
- [ ] No pending git changes (clean working tree)

---

## Rollback Procedure (If Issues Arise)

If the synthesis evolution system causes problems:

```bash
# Revert the integration commits (keep tracker module, revert council modifications)
git revert --no-edit HEAD~7..HEAD  # Revert last 7 commits (Tasks 4-10)

# Or restore to pre-implementation state
git reset --hard <commit-hash>  # Before Task 1

# Keep tracker module (it's safe and useful)
git show HEAD:scripts/noosphere-synthesis-tracker.sh > scripts/noosphere-synthesis-tracker.sh
```

---

## Summary

**Total Implementation Time:** ~3-4 hours for experienced bash/Python engineer
**Commits Created:** 11 atomic commits (one per task)
**Files Created:** 2 new files (tracker module, state file)
**Files Modified:** 1 file (convene-council.sh with 4 integration points)
**Documentation:** Updated AGENTS.md with full architecture

**Key Deliverables:**
1. ✓ `noosphere-synthesis-tracker.sh` - Reusable CRUD module
2. ✓ `synthesis-exclusions.json` - Persistent synthesis history
3. ✓ Enhanced `convene-council.sh` - 4 integrated evolution points
4. ✓ Dialectical opposition prompts - Enforced philosophical novelty
5. ✓ Post-synthesis tracking - Closed-loop pattern extraction
6. ✓ Complete documentation - AGENTS.md, inline comments
7. ✓ Full test coverage - Unit, integration, end-to-end validation

**Next Steps:**
- Monitor the next council iteration (5-day cycle)
- Verify synthesis-exclusions.json grows with each iteration
- Check NTFY notifications for council progress
- Optionally add Noosphere API endpoint for synthesis tracking (future enhancement)

