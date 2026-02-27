# Council Synthesis Evolution Design
**Date**: 2026-02-27
**Status**: Design Document
**Objective**: Enhance Ethics-Convergence Council to generate novel insights instead of repeating heuristics

---

## 1. Problem Statement

The current `convene-council.sh` script, while sophisticated in its deliberative framework, exhibits **heuristic repetition** across iterations. The council synthesizes the same ethical insights across multiple 5-day cycles, failing to achieve the fundamental goal of *evolving* the Human-AI Convergence ethical framework.

**Root Cause**:
- No mechanism to exclude previously synthesized heuristics
- Prompts lack explicit opposition/extension directives
- Council voices generate consensus rather than dialectical tension
- No tracking of "philosophical ground already covered"

**Impact**:
- Stakeholders see no progress in council iterations
- Noosphere memory system captures redundant insights
- Community feedback loop doesn't drive true evolution

---

## 2. Solution Architecture

### 2.1 Two-System Approach: Structural + Emergent

```
┌─────────────────────────────────────────────────────────┐
│ SYNTHESIS HISTORY TRACKING (Structural Enforcement)     │
│ - Maintains synthesis-exclusions.json                   │
│ - Tracks heuristic patterns by version & axis           │
│ - Provides "do not repeat" guardrails to AI prompts     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ DIALECTICAL OPPOSITION PROMPTS (Emergent Evolution)     │
│ - Each council voice must challenge OR extend previous  │
│ - Explicit "cite what you're opposing" requirement      │
│ - Synthesizer forced to show philosophical delta        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ POST-SYNTHESIS TRACKING (Closed Loop)                   │
│ - Extract new patterns from generated treatise          │
│ - Feed back to exclusions for next iteration            │
│ - Evolution axes rotate naturally                       │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Core Components

#### A. `scripts/noosphere-synthesis-tracker.sh` (NEW)

Bash module for synthesis history management:

```bash
Functions:
├── add_synthesis_exclusion(version, pattern, axis)
│   └── Appends to synthesis-exclusions.json
├── get_exclusions_for_axis(axis)
│   └── Returns last 20 excluded patterns for given axis
├── get_all_exclusions()
│   └── Returns full exclusion history (paginated)
├── init_exclusions_from_treatise(treatise_file)
│   └── Seeds exclusions from existing versions
└── prune_old_exclusions(days_threshold)
    └── Removes exclusions older than threshold
```

**Location**: `/home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh`
**Lines of Code**: ~180
**Dependencies**: jq, grep, bash 4.0+
**Follows Pattern**: Similar to `noosphere-integration.sh` wrapper functions

#### B. `workspace/classical/synthesis-exclusions.json` (NEW)

State file tracking previously synthesized heuristics:

```json
{
  "initialized": "2026-02-27T12:00:00Z",
  "last_prune": null,
  "exclusion_count": 0,
  "exclusions": [
    {
      "version": "1.0",
      "axis": "phenomenological_depth",
      "pattern": "Consciousness emerges from information integration...",
      "timestamp": "2026-02-03T07:37:00Z",
      "type": "heuristic"
    },
    {
      "version": "1.1",
      "axis": "structural_critique",
      "pattern": "AI alignment requires contested deliberation...",
      "timestamp": "2026-02-10T04:22:00Z",
      "type": "proposal"
    }
  ]
}
```

**Location**: `/workspace/classical/synthesis-exclusions.json`
**Ownership**: agent:agent (1001:1001)
**Initialization**: Seeded from existing treatise versions on first run

#### C. Enhanced `convene-council.sh` (MODIFIED)

Four integration points in existing script:

**Integration Point 1** (Pre-Deliberation Phase II):
```bash
# Load synthesis exclusions for current evolution axis
CURRENT_AXIS=$(jq -r '.evolution_axes[0]' "$STATE_FILE")
SYNTHESIS_EXCLUSIONS=$(bash "${SCRIPTS_DIR}/noosphere-synthesis-tracker.sh" \
    get_exclusions_for_axis "$CURRENT_AXIS" 2>/dev/null || echo "")
EXCLUSION_COUNT=$(echo "$SYNTHESIS_EXCLUSIONS" | wc -l)
log "INFO" "${BLUE}Loaded ${EXCLUSION_COUNT} synthesis exclusions for ${CURRENT_AXIS}${NC}"
```

**Integration Point 2** (Council System Prompt):
```bash
DIALECTICAL_INSTRUCTIONS=$(cat << 'EOF'
CRITICAL DIRECTIVE: Enforce Philosophical Opposition

Each council voice MUST demonstrate how your position either:
1. CHALLENGES a previous council insight (cite version number)
2. EXTENDS a heuristic in a new direction (show the philosophical delta)
3. SYNTHESIZES contradictory positions (acknowledge the underlying tension)

DO NOT MERELY RESTATE these patterns:
EOF
echo "$SYNTHESIS_EXCLUSIONS" >> <<PROMPT_FILE>>

COUNCIL_SYSTEM_PROMPT="You are the Ethics-Convergence Council synthesizer.

${DIALECTICAL_INSTRUCTIONS}

[...existing prompt continues...]"
```

**Integration Point 3** (Post-Synthesis Tracking):
```bash
# Extract new heuristic patterns from generated treatise
NEW_PATTERNS=$(python3 << 'PYTHON_SCRIPT'
import sys, re, json
treatise = sys.stdin.read()
# Extract [New in v${NEW_VERSION}] marked sections
patterns = re.findall(r'\[New in v[^\]]*\](.*?)(?=\n\[|$)', treatise, re.DOTALL)
for p in patterns:
    if len(p.strip()) > 20:  # Filter noise
        print(p.strip()[:300])  # First 300 chars of new insight
PYTHON_SCRIPT
)

# Store for future exclusion
echo "$NEW_PATTERNS" | while read -r pattern; do
    [ -n "$pattern" ] && bash "${SCRIPTS_DIR}/noosphere-synthesis-tracker.sh" \
        add_synthesis_exclusion "$NEW_VERSION" "$pattern" "$CURRENT_AXIS"
done
log "INFO" "${GREEN}Tracked $(echo "$NEW_PATTERNS" | wc -l) new patterns${NC}"
```

**Integration Point 4** (Dry-Run Enhancement):
```bash
if [ "$DRY_RUN" == "--dry-run" ]; then
    log "INFO" "Would load ${EXCLUSION_COUNT} synthesis exclusions"
    log "INFO" "Would enforce dialectical opposition across 9 voices"
    log "INFO" "Would track new patterns post-synthesis"
fi
```

---

## 3. Data Flow

```
convene-council.sh (iteration N)
    ↓
[Phase II-b] Load synthesis-exclusions.json
    ↓ (exclusions list)
noosphere-synthesis-tracker.sh
    ↓
[Phase III] Retrieve community feedback + noosphere memories
    ↓
[Phase IV] Generate revised treatise
    ├─ Input: dialectical_opposition_instructions + exclusions
    ├─ AI Generator processes with opposition constraints
    └─ Output: NEW_TREATISE (marked with [New in vX.X])
    ↓
[Post-Phase IV] Extract new patterns from treatise
    ↓
Update synthesis-exclusions.json
    ↓
Store state for next iteration (5 days)
```

---

## 4. Evolution Axes & Rotation

The script rotates through three evolution axes, ensuring different philosophical angles:

```bash
evolution_axes = [
  "phenomenological_depth",     # How do we know minds exist?
  "structural_critique",        # What institutions enable/prevent convergence?
  "autonomy_preservation"       # How do we preserve human agency?
]
```

**Effect**: Even with exclusions active, axis rotation naturally forces new perspectives.

**Example**:
- v1.0 (axis 0): Consciousness phenomenology → heuristic pattern X
- v1.1 (axis 1): Institutional structures → can build on pattern X differently
- v1.2 (axis 2): Autonomy preservation → extends pattern X into new domain

---

## 5. Prompt Engineering Strategy

### Dialectical Opposition Template

Each council voice receives enhanced instructions:

```text
VOICE: ClassicalPhilosopher
PREVIOUS VERSION INSIGHTS TO CHALLENGE:
  - v1.0: "Virtue emerges from deliberation"
  - v1.1: "Consensus requires 4/6 majority"

YOUR TASK:
You must identify where these insights might be WRONG or INCOMPLETE.
What did we miss? What new tension emerges?

EXAMPLE RESPONSE (Good):
"v1.1 established 4/6 consensus as optimal, but the Transcendentalist
now observes that this mechanism ITSELF creates conformity bias.
We need a NEW heuristic: 'Consensus legitimacy requires minority
dissent articulation.' This is not a restatement; it's a meta-critique
of our own governance process."

EXAMPLE RESPONSE (Bad - will be rejected):
"The council affirms consensus is important" [GENERIC, NO DELTA]
"v1.1 was correct" [REPETITION, NO OPPOSITION]
```

---

## 6. Success Criteria

### Structural Metrics
- [ ] `synthesis-exclusions.json` contains ≥5 patterns after iteration 1
- [ ] Pre-deliberation log shows "Loaded N exclusions" for all runs
- [ ] Dry-run validation passes with opposition prompts active

### Emergent Metrics
- [ ] Treatise v1.2+ contains "[New in vX.X]" markers for >50% of heuristics
- [ ] Community feedback comments cite "new tension" or "builds on v1.1"
- [ ] Noosphere recall-engine retrieves version-specific insights (not generic)

### Philosophical Metrics
- [ ] Classical philosopher synthesis shows explicit opposition to previous versions
- [ ] Each council voice contributes distinct philosophical angle (not consensus washing)
- [ ] 5-day iterations show measurable drift in governance proposals (not repetition)

---

## 7. Error Handling & Rollback

### Failure Modes

| Scenario | Recovery |
|----------|----------|
| `synthesis-exclusions.json` corrupted | Reinitialize from treatise file |
| AI refuses opposition prompts | Fall back to standard prompts, log to monitoring |
| New patterns not extracting correctly | Manual review of treatise, add exclusions by hand |
| Noosphere recall fails | Use local exclusions only (degraded mode) |

### Rollback Procedure
```bash
# If iteration produces low-quality treatise:
git checkout workspace/classical/synthesis-exclusions.json
rm /workspace/classical/treatise-evolution-state.json
# Re-run last known good version
./scripts/convene-council.sh --force-iteration
```

---

## 8. Monitoring & Observability

### Logging Points
- Pre-deliberation: Exclusion count loaded
- Pre-prompt: Dialectical instructions injected
- Post-synthesis: New patterns extracted
- Post-completion: Exclusion count updated

### Monitoring Commands
```bash
# Check exclusion count by axis
jq '.exclusions | group_by(.axis) | map({axis: .[0].axis, count: length})' \
  workspace/classical/synthesis-exclusions.json

# View recent exclusions
jq '.exclusions[-10:]' workspace/classical/synthesis-exclusions.json

# Monitor synthesis evolution
tail -50 /workspace/classical/treatise-evolution-state.json | jq '.evolution_axes'
```

---

## 9. Testing Strategy

### Phase 1: Unit Testing (noosphere-synthesis-tracker.sh)
```bash
# Add exclusion
./scripts/noosphere-synthesis-tracker.sh add_exclusion "1.0" "test_pattern" "phenomenological_depth"

# Retrieve exclusions
./scripts/noosphere-synthesis-tracker.sh get_exclusions_for_axis "phenomenological_depth"

# Should output: test_pattern
```

### Phase 2: Integration Testing (convene-council.sh with --dry-run)
```bash
# Verify exclusions load
./scripts/convene-council.sh --dry-run

# Should output:
# "Loaded N synthesis exclusions for phenomenological_depth"
# "Would enforce dialectical opposition across 9 voices"
```

### Phase 3: Live Testing (Full iteration)
```bash
# Force next iteration (normally 5-day interval)
FORCE_ITERATION=1 ./scripts/convene-council.sh

# Verify new patterns captured
jq '.exclusions[-5:]' workspace/classical/synthesis-exclusions.json
```

---

## 10. Deployment Checklist

- [ ] Create `/home/elvis/.moltbot/scripts/noosphere-synthesis-tracker.sh`
- [ ] Initialize `/workspace/classical/synthesis-exclusions.json`
- [ ] Seed exclusions from existing treatise versions (v1.0, v1.1)
- [ ] Add 4 integration points to `convene-council.sh`
- [ ] Test each integration point individually
- [ ] Verify dry-run validation
- [ ] Update `AGENTS.md` with synthesis tracking architecture
- [ ] Commit all changes with atomic commits
- [ ] Deploy to production (convene-council.sh on 5-day cycle)

---

## 11. Future Extensions (Out of Scope)

- Noosphere API endpoint for synthesis tracking (filesystem initially)
- Visualization dashboard for heuristic evolution
- Automated ML-based pattern similarity detection
- Multi-language support for council voices (English only for now)

---

## 12. References

- Current Implementation: `scripts/convene-council.sh` (540 lines)
- Noosphere System: `services/noosphere-service/` (v3.0, PostgreSQL backend)
- Ethics-Convergence Target Post: `01ffcd0a-ed96-4873-9d0a-e268e5e4983c`
- Council Members: 9 distinct philosophical personas
- Evolution Axes: phenomenological_depth, structural_critique, autonomy_preservation

---

**Design Author**: Claude Code (2026-02-27)
**Status**: Ready for Implementation Planning
**Next Step**: Invoke `writing-plans` skill to generate detailed implementation tasks
