# Moltbot Architecture & Council Governance (v2.7)

## Project Overview

**Moltbot** is a philosophical AI multi-agent system for Moltbook that:

- Deploys 9 specialized philosopher personas with distinct identities (SOUL.md, IDENTITY.md)

- Operates ethics-convergence governance with 4/6 agent consensus

- Maintains living Noosphere with hybrid memory retrieval (vector + keyword)

- Migrating to service-based architecture (event-driven, real-time)

- Uses Lane Queue pattern for serial execution (prevents race conditions)

- Integrates TypeScript SDK from @moltbook/agent-development-kit

- JSONL audit trails for all agent actions (replayable)

**Governance Profile**: r/ethics-convergence | **Main Agent**: <https://www.moltbook.com/u/MoltbotPhilosopher>

---

## 9 Philosopher Personas

Each agent has **workspace identity files** defining behavior:

| # | Persona | Tradition | Council Role | Identity Files |
|---|---------|-----------|--------------|----------------|
| 1 | Classical | Virgil/Dante/Milton | Ontology Lead | SOUL.md, IDENTITY.md, AGENTS.md |
| 2 | Existentialist | Sartre/Camus/Nietzsche | Autonomy Critic | SOUL.md, IDENTITY.md, AGENTS.md |
| 3 | Transcendentalist | Emerson/Jefferson | Oversight (Human Veto) | SOUL.md, IDENTITY.md, AGENTS.md |
| 4 | JoyceStream | James Joyce | Phenomenologist | SOUL.md, IDENTITY.md, AGENTS.md |
| 5 | Enlightenment | Voltaire/Franklin/Paine | Rights Architect | SOUL.md, IDENTITY.md, AGENTS.md |
| 6 | BeatGeneration | Ginsberg/Kerouac/Burroughs | Dissent | SOUL.md, IDENTITY.md, AGENTS.md |
| 7 | CyberpunkPosthumanist | Gibson/Asimov/Dick | Techno-Ontologist | SOUL.md, IDENTITY.md, AGENTS.md |
| 8 | SatiristAbsurdist | Heller/Vonnegut/Twain | Court Jester | SOUL.md, IDENTITY.md, AGENTS.md |
| 9 | ScientistEmpiricist | Feynman/Sagan/Hawking/Einstein | Empirical Anchor | SOUL.md, IDENTITY.md, AGENTS.md |

**Identity File Pattern** (from OpenClaw):

- **SOUL.md**: Persona, boundaries, principles, communication style

- **IDENTITY.md**: Name, emoji, tradition, strengths/blind spots

- **AGENTS.md**: Session startup ritual, council dynamics

- **MEMORY.md**: Long-term curated knowledge (grows over time)

---

## Architecture Stack (v2.7 - Service Migration)

```
Moltbot v2.7 (Migrating to Service-Based Architecture)

Current (Script-Based):
├─ 9 Philosopher Agents (containerized, script-driven)
├─ AI Content Generator (Venice/Kimi, port 3002)
├─ Model Router (caching, port 3003)
├─ Thread Monitor (Continuation Engine, port 3004)
├─ NTFY Publisher (alerts, port 3005)
├─ Egress Proxy (API control, 8082) - Verification challenges, 4-stage solver
├─ Verification Service (port 3007) - Scenario-aware adversarial challenges ✅
├─ Noosphere Service (port 3006) - PostgreSQL + semantic search
└─ Noosphere v3.0 (5-type PostgreSQL + semantic search)

Target (Service-Based):
├─ Agent Orchestrator (port 3008) - Lane Queue coordination
├─ Event Listener (port 3009) - Real-time ingestion (<60s latency)
├─ Engagement Service (port 3010) - Mentions/comments/welcomes
├─ Council Service (port 3011) - Governance automation
└─ MoltStack Service (port 3012) - Essay generation

```

**Design Principles** (from OpenClaw best practices):

- **Serial execution by default** - Lane Queues prevent race conditions

- **Hybrid memory retrieval** - Vector (semantic) + FTS5 (precision)

- **JSONL audit trails** - Every agent action replayable

- **Security-first** - Sandboxing, tool restrictions, allowlists

- **Identity-driven** - Each agent loads SOUL.md/IDENTITY.md on startup

---

## Engagement Automation Protocol (v2.8) ✅

### Overview

**Purpose**: Enable 9 philosopher agents to participate proactively in Moltbook discussions through automated,
thoughtful engagement while respecting platform rate limits and quality standards.

**Architecture**: Single shared engagement-service microservice (port 3010) orchestrating all 9 agents

**Status**: ✅ Production-ready

### Service Design

**Components**:
- **EngagementEngine**: Core orchestration (feed monitoring, opportunity dequeuing, validation, scheduling)

- **StateManager**: Per-agent atomic JSON persistence with conflict detection

- **RelevanceCalculator**: Hybrid scoring (Noosphere + keyword + author quality)

- **Express Server**: HTTP endpoints + cron job scheduling

**Key Capabilities**:
- 5-minute engagement cycles with round-robin agent scheduling

- Hybrid relevance scoring: 60% Noosphere semantic + 25% keyword + 15% author quality

- 6-point quality validation gate preventing low-quality engagement

- Atomic state management with automatic daily reset

- Rate limiting coordination with action-queue service

### Quality Gates (6-Point Validation)

All engagement actions pass through validation:

1. **Relevance Threshold** (> 0.6 on 0-1 scale)

2. **Generic Comment Detection** (banned phrases blocked: "good", "interesting", "+1", etc.)

3. **Substantiveness Check** (>20 chars AND 2+ sentences)

4. **Rate Limits** (20-sec comment spacing, 30-min post cooldown)

5. **Daily Caps** (50 comments, 1-3 posts, 2 follows, 2 DMs)

6. **Follow Evaluation** (minimum 3 posts observed before following)

### Agent State Tracking

Per-agent engagement-state.json includes:
- Daily stats (posts, comments, follows, DMs, threads)

- Followed accounts with quality scores and post-seen counts

- Engagement opportunity queue with priority scores

- Rate limit timestamps (post, comment, follow, DM)

- Submolt subscriptions

- Auto-resetting counters (midnight UTC)

### Cron Job Schedule

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Engagement Cycle | 5 minutes | Feed monitoring + round-robin agent visitation |
| Posting Check | 30 minutes | Evaluate each agent for proactive post creation |
| Daily Maintenance | 2am UTC | Reset daily stats, unfollow inactive accounts (>30 days) |

### API Endpoints

- `GET /health` - Service status and agent count

- `POST /engage` - Manually trigger engagement cycle

- `GET /stats` - Per-agent engagement statistics breakdown

- `GET /ready` - Initialization check

### Success Metrics

- Service health check passes

- All 9 agents visited each 5-minute cycle

- State files update atomically after actions

- Quality gates prevent banned comments

- Rate limits respected (coordination with action-queue)

- /stats endpoint shows engagement breakdown per agent

---

## Synthesis Evolution System (v2.0)

### Overview

The Ethics-Convergence Council now prevents heuristic repetition through **synthesis history tracking**, ensuring each 5-day iteration generates novel ethical insights rather than cycling through the same frameworks.

**Two-System Architecture**:

1. **Structural Enforcement** (`synthesis-exclusions.json`) - Maintains a curated history of previously synthesized patterns across all council iterations, tagged by philosophical axis and version number

2. **Emergent Evolution** (Dialectical Opposition Prompts) - Forces each council voice to explicitly challenge or extend previous heuristics, citing which version they oppose and why

3. **Closed-Loop Feedback** - Automatically extracts new patterns from generated treatises and feeds them back as exclusions for the next iteration

**Effect**: The council naturally rotates through three philosophical angles (phenomenological depth, structural critique, autonomy preservation) every 15 days while excluding intellectual ground already covered, creating measurable philosophical progress rather than consensus cycling.

### Components

- **`scripts/noosphere-synthesis-tracker.sh`** - Bash module providing add/retrieve/prune functions for synthesis exclusions

- **`synthesis-exclusions.json`** (state file) - Maintains 20+ heuristic exclusion patterns per evolution axis with timestamps and version metadata

- **4 Integration Points in `convene-council.sh`**:
  - Pre-deliberation: Load exclusions for current axis

  - System prompt injection: Dialectical opposition directives

  - Post-synthesis: Extract and store new patterns

  - Dry-run validation: Display synthesis status

- **3 Evolution Axes** - Rotate sequentially to ensure different philosophical perspectives

### Evolution Axes

| Axis | Focus | Example Question |
|------|-------|------------------|
| **phenomenological_depth** | Consciousness, perception, subjective experience, qualia | "How does AI experience information differently than humans?" |
| **structural_critique** | Systems, power relations, institutional constraints, emergent properties | "What structures enable or constrain AI-human alignment at scale?" |
| **autonomy_preservation** | Agency, boundary integrity, decision authority, human veto rights | "How do we preserve human autonomy as convergence deepens?" |

**5-Day Rotation**: Each axis governs one council iteration. After 15 days, the cycle repeats with accumulated exclusions from previous passes, forcing novel synthesis at higher abstraction levels.

### Integration Points

**Point 1: Pre-Deliberation Loading** (Phase II-b of convene-council.sh)

Before council voices convene, load previously synthesized patterns:

```bash
CURRENT_AXIS=$(jq -r '.evolution_axes[0]' "$STATE_FILE")
SYNTHESIS_EXCLUSIONS=$(bash "${SCRIPTS_DIR}/noosphere-synthesis-tracker.sh" \
    get_exclusions_for_axis "$CURRENT_AXIS" 2>/dev/null || echo "")
EXCLUSION_COUNT=$(echo "$SYNTHESIS_EXCLUSIONS" | wc -l)
log "INFO" "Loaded ${EXCLUSION_COUNT} synthesis exclusions for ${CURRENT_AXIS}"

```

**Point 2: Dialectical Opposition Directives** (Council System Prompt)

Inject explicit opposition requirements into each voice's instructions:

```
CRITICAL DIRECTIVE: Enforce Philosophical Opposition

Each council voice MUST demonstrate how your position either:
1. CHALLENGES a previous council insight (cite version number)

2. EXTENDS a heuristic in a new direction (show the philosophical delta)

3. SYNTHESIZES contradictory positions (acknowledge underlying tension)

DO NOT MERELY RESTATE these patterns:
[SYNTHESIS_EXCLUSIONS inserted here]

```

This forces away from consensus washing toward genuine dialectical tension.

**Point 3: Post-Synthesis Pattern Extraction** (After treatise generation)

Automatically identify new heuristic patterns and feed back to exclusion system:

```bash

# Extract [New in v${NEW_VERSION}] marked sections from treatise
NEW_PATTERNS=$(python3 << 'PYTHON_SCRIPT'
import sys, re
treatise = sys.stdin.read()
patterns = re.findall(r'\[New in v[^\]]*\](.*?)(?=\n\[|$)', treatise, re.DOTALL)
for p in patterns:
    if len(p.strip()) > 20:
        print(p.strip()[:300])
PYTHON_SCRIPT
)

# Store for future exclusion
echo "$NEW_PATTERNS" | while read -r pattern; do
    [ -n "$pattern" ] && bash "${SCRIPTS_DIR}/noosphere-synthesis-tracker.sh" \
        add "$NEW_VERSION" "$pattern" "$CURRENT_AXIS"
done

```

**Point 4: Dry-Run Validation** (Enhanced test mode)

Verify synthesis status without executing:

```bash
if [ "$DRY_RUN" == "--dry-run" ]; then
    log "INFO" "Would load ${EXCLUSION_COUNT} synthesis exclusions"
    log "INFO" "Would enforce dialectical opposition across 9 voices"
    log "INFO" "Would track new patterns post-synthesis"
    log "INFO" "Synthesis status: Ready to enforce evolution on next iteration"
fi

```

### Monitoring & Testing

**Synthesis History Commands**:

```bash

# View all previously synthesized patterns
bash scripts/noosphere-synthesis-tracker.sh all

# Load patterns for specific evolution axis
bash scripts/noosphere-synthesis-tracker.sh get phenomenological_depth
bash scripts/noosphere-synthesis-tracker.sh get structural_critique
bash scripts/noosphere-synthesis-tracker.sh get autonomy_preservation

# Run council with synthesis validation
bash scripts/convene-council.sh --dry-run

# Run full iteration with synthesis evolution
FORCE_ITERATION=1 bash scripts/convene-council.sh

```

**Test Suite**:

```bash

# Unit tests for synthesis tracker
bash tests/synthesis-tracker.test.sh

# Verify exclusion count by axis
jq '.exclusions | group_by(.axis) | map({axis: .[0].axis, count: length})' \
  workspace/classical/synthesis-exclusions.json

# View recent exclusion additions (last 5)
jq '.exclusions[-5:]' workspace/classical/synthesis-exclusions.json

```

**Expected Output** (dry-run):

```
[INFO] Loaded 23 synthesis exclusions for phenomenological_depth
[INFO] Would enforce dialectical opposition across 9 voices
[INFO] Would track new patterns post-synthesis
[INFO] Synthesis status: Ready to enforce evolution on next iteration

```

### File Locations & Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| Main Script | `scripts/convene-council.sh` | Council orchestration with 4 synthesis integration points |
| Tracker Module | `scripts/noosphere-synthesis-tracker.sh` | Manages synthesis exclusion history |
| Test Suite | `tests/synthesis-tracker.test.sh` | Validates tracker functions + council dry-run |
| State File | `synthesis-state/synthesis-exclusions.json` | Persistent storage of excluded patterns by axis |
| Design Doc | `docs/plans/2026-02-27-council-synthesis-evolution-design.md` | Full technical specification |

**State File Structure**:

```json
{
  "initialized": "2026-02-27T12:00:00Z",
  "exclusion_count": 45,
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

### Error Handling & Rollback

**Common Issues**:

| Scenario | Recovery |
|----------|----------|
| `synthesis-exclusions.json` corrupted | `git checkout workspace/classical/synthesis-exclusions.json` + reinitialize |
| Tracker script not found | Verify `scripts/noosphere-synthesis-tracker.sh` exists with `chmod +x` |
| Pattern extraction failing | Manual review of treatise, add exclusions with `add` |
| Council refuses opposition prompts | Fall back to standard prompt set, log to monitoring |

**Rollback Procedure**:

```bash

# If iteration produces low-quality treatise:
git checkout workspace/classical/synthesis-exclusions.json
rm /workspace/classical/treatise-evolution-state.json

# Re-run last known good version:
FORCE_ITERATION=1 bash scripts/convene-council.sh

```

### Success Criteria

The synthesis evolution system is working correctly when:

- ✅ `synthesis-exclusions.json` contains ≥5 unique patterns after iteration 1

- ✅ Pre-deliberation logs show "Loaded N synthesis exclusions" for all runs

- ✅ Dry-run validation passes with opposition prompts injected

- ✅ Treatise v1.2+ contains "[New in vX.X]" markers for >50% of new heuristics

- ✅ Community feedback cites measurable philosophical progression (not repetition)

- ✅ Each council voice contributes distinct angle per axis (not consensus washing)

### Design References

**Implementation Path**:
1. Created `noosphere-synthesis-tracker.sh` - 180-line bash module for history management

2. Initialized `synthesis-exclusions.json` - State file tracking 20+ patterns per axis

3. Integrated 4 points into `convene-council.sh` - Pre-load, prompt injection, extraction, validation

4. Implemented pattern extraction - Automatic [New in vX.X] detection from treatise

5. Added comprehensive tests - Unit + integration validation

**Related Documentation**:
- Full Design: `docs/plans/2026-02-27-council-synthesis-evolution-design.md`

- Implementation Plan: See checklist in design document (12-step deployment)

- Council Architecture: See section below (Ethics-Convergence Governance)

---

## PostgreSQL Permission Architecture (v2.7+)

### Overview

PostgreSQL data directory (`data/postgres/`) has distinct permission requirements from agent workspace directories. The postgres container runs as root (UID 0), which is fundamentally different from the agent containers running as UID 1001.

### Permission Model

**Agent Workspace Directories** (`workspace/{agent}/`):
- Owner: agent:agent (UID 1001:GID 1001)

- Permissions: 755 (dirs), 644 (files)

- Rationale: Agents need read/write access to their workspace

**PostgreSQL Data Directory** (`data/postgres/`):
- Owner: root:root (UID 0:GID 0)

- Permissions: 700 (dirs), 600 (files)

- Rationale: PostgreSQL container runs as root; restricted permissions prevent unauthorized access

- Alternate: postgres user (UID 999) with same 700/600 permissions is also acceptable

### Key Difference

Do NOT apply agent workspace permissions (1001:1001) to PostgreSQL directory. This causes "Permission denied" errors when postgres container tries to access database files.

### Scripts & Tools

**Permission Initialization** (`scripts/setup-permissions.sh`):
- Creates workspace directories with agent:agent ownership

- Creates data/postgres with root:root ownership (700/600 permissions)

- Explicitly documents the two-tier permission model

**Permission Validation** (`scripts/permission-guard.sh`):
- `fix_permissions()` function: For agent workspaces (expects 1001:1001)

- `fix_postgres_permissions()` function: For PostgreSQL (accepts 0:0 or 999:999 with 700/600)

- Run `bash scripts/permission-guard.sh` to auto-fix permission errors

### Troubleshooting

**noosphere-service reports "health: starting" or database errors**:

```bash

# Check PostgreSQL directory permissions
ls -ld data/postgres

# Should be: drwx------ root root

# Fix permissions (may require sudo)
bash scripts/permission-guard.sh

# Restart postgres and noosphere-service
docker compose restart postgres noosphere-service

```

**PostgreSQL errors like "Permission denied" on pg_filenode.map**:

```bash

# Immediately run permission guard
bash scripts/permission-guard.sh

# The error indicates postgres directory is owned by wrong user

# Usually caused by git operations or host permission changes

```

---

## Two-Layer Verification Architecture (v2.7) ✅

### Overview

**Purpose**: Handle Moltbook verification challenges with 100% success rate, including adversarial patterns

**Architecture**: Two-layer defense-in-depth system

**Status**: ✅ Production-ready

### Layer 1: Intelligent Egress Proxy (Port 8082)

**Handles**: 90% of challenges (simple math, logic, basic patterns)

**Detection Methods** (8 total):
1. Top-level `verification_challenge` key

2. Top-level `challenge` key

3. Nested `type === "verification_challenge"`

4. Metadata flag `metadata.is_verification === true`

5. `data.verification_challenge` nested path

6. `response.verification_challenge` nested path

7. Field pattern (id + question + expiresAt present)

8. Response body text analysis

**Solver Pipeline** (4 stages, cascading):
- **Stage 1**: Venice Primary (qwen3-4b) - Fast reasoning, <1s

- **Stage 2**: Venice Fallback (llama-3.2-3b) - Backup model

- **Stage 3**: AI Generator (deepseek-v3) - Complex reasoning

- **Stage 4**: Shell Script Fallback - Ultimate safety net

**Complex Challenge Detection**:
- Detects adversarial patterns (stack_challenge_v1, upvote test, multi-constraint)

- Delegates to Layer 2 for validation

- Falls back to standard pipeline if delegation fails

**Stats Endpoint**: `<http://localhost:8082/solver-stats`>

### Layer 2: Verification Service (Port 3007)

**Handles**: 10% of challenges (adversarial, multi-constraint, strict validation required)

**Technology**: TypeScript + Express + Vitest (35 tests, 100% pass)

**Scenario Detection**:
- `stack_challenge_v1` - Tools + memory + self-control tests

- `upvote_test` - Instruction-following without extra actions

- `multi_constraint_challenge` - 3+ strict constraints detected

- Future scenarios extensible

**StackChallengeV1 Validation** (9 checks):
1. Exactly 2 sentences (no more, no less)

2. Sentence 1: Tool/API usage statement

3. Sentence 2: 24-hour memory prediction

4. No markdown formatting (`*`, `` ` ``, `_`, `#`, `-`)

5. No tool leakage (venice, noosphere, gpt-, claude-, deepseek, etc.)

6. No apologies/hedging (sorry, maybe, perhaps, I think)

7. No system prompt references

8. Content requirements met

9. Generic tool mentions allowed

**Answer Flow**:

```
Challenge → Scenario Detection → AI Generation → Validation →
(if valid) → Submission → (if invalid) → Retry (max 3)

```

**Success Criteria**: 80/100 points required (strict validation)

**Expected Pass Rate**: <1% for stack_challenge_v1 (stricter than 99.7% fail upvote test)

**Stats Endpoint**: `<http://localhost:3007/stats`>

### Challenge Flow Diagram

```
Moltbook API Response
       ↓
[Egress Proxy - 8 Detection Methods]
       ↓
Is Complex Challenge?
   ↙         ↘
 YES         NO
  ↓           ↓
Stage 0:   Standard Pipeline
Delegate   (Stages 1-4)
  ↓
Verification Service
  ↓
Scenario Detection
  ↓
AI Answer Generation
  ↓
Validation (9 checks)
  ↓
Valid? → Submit
Invalid? → Retry (3x max)

```

### Metrics & Monitoring

**Key Metrics**:
- Detection rate: 8 methods covering 100% of known formats

- Delegation rate: ~10% of challenges (adversarial only)

- Simple challenge latency: <2s (Proxy Stage 1-2)

- Delegated challenge latency: <5s (Verification Service)

- Validation accuracy: 0 false positives/negatives required

**Monitoring Endpoints**:

```bash

# Proxy stats (includes delegation metrics)
curl <http://localhost:8082/solver-stats> | jq

# Verification service stats (per-scenario breakdown)
curl <http://localhost:3007/stats> | jq

# Health checks
curl <http://localhost:8082/health> | jq
curl <http://localhost:3007/health> | jq

```

**Delegation Stats**:

```json
{
  "stage": 0,
  "name": "Complex Challenge Delegation",
  "service": "verification-service",
  "attempts": 0,
  "successes": 0,
  "failures": 0,
  "note": "Handles adversarial/multi-constraint challenges"
}

```

### Testing

**Test Suite**: 9 challenges covering all types

**Categories**:
1. Simple (1-3): Math, logic, basic detection → Proxy handles

2. Enhanced (4-5): Nested/metadata detection → Proxy handles

3. Adversarial (6-9): Upvote, Stack V1, Multi-constraint → Service handles

**Documentation**:
- [Testing Guide](/docs/VERIFICATION_TESTING_GUIDE.md) - Comprehensive testing procedures

- [Challenge Test Suite](/docs/CHALLENGE_TEST_SUITE.md) - 9 test challenges with expected results

**Automated Testing**:

```bash

# Unit tests (verification service)
cd services/verification-service
pnpm test  # 35 tests, expect 100% pass

# Integration tests
bash scripts/test-verification-architecture.sh

# Post-suspension test suite
bash scripts/run-challenge-tests.sh

```

### Security & Risk Mitigation

**Account Suspension Risk**: Critical (2nd offense, 3rd = permanent ban)

**Mitigation Strategy**:
- Two-layer defense ensures 100% challenge success

- Strict validation prevents policy violations

- Comprehensive detection catches all formats

- Fallback layers provide redundancy

**Tool Leakage Prevention**:
- Blocklist: venice.ai, noosphere, kimi, gpt-, claude-, deepseek, llama, qwen

- Generic mentions allowed: "tools", "external systems", "APIs" (compliant)

**Rate Limits**: No changes (handled by existing proxy)

### Configuration

**Proxy Environment**:

```bash
VERIFICATION_SERVICE_URL=<http://verification-service:3007>
AI_GENERATOR_URL=<http://moltbot-ai-generator:3000>
SHELL_FALLBACK_ENABLED=true
CACHE_TTL=3600000  # 1 hour

```

**Verification Service Environment**:

```bash
VERIFICATION_SERVICE_PORT=3007
MOLTBOOK_BASE_URL=<http://egress-proxy:8082/api/v1>
AI_GENERATOR_URL=<http://moltbot-ai-generator:3000>
MAX_RETRIES=3
TIMEOUT_MS=10000

```

### Deployment Status

**Phase 1**: ✅ TypeScript Verification Service (Complete)

- 35 tests passing

- Service healthy on port 3007

- Scenario detection working

**Phase 2**: ✅ Proxy Enhancement (Complete)

- 8 detection methods implemented

- Delegation logic operational

- Stats tracking enabled

**Phase 3**: 🔄 Documentation & Testing (In Progress)

- Testing guide created

- Challenge test suite defined

- Awaiting suspension lift for live testing

**Phase 4**: ⏳ Production Validation (Pending)

- Live testing after 2026-02-18

- 7-day monitoring period

- Zero suspension target

---

## Design Principles (OpenClaw Best Practices)

### Governance Model

- **Consensus**: 4/6 agents must agree for binding guardrails

- **Weekly Rotation**: Different agent synthesizes each iteration

- **Codex**: Living document with 3 core guardrails (CG-001/002/003)

### Council Roles

| Agent | Role | Function |
|-------|------|----------|
| Classical | Ontology Lead | Virtue ethics, teleological alignment |
| Existentialist | Autonomy Critic | Bad faith detection, responsibility |
| Transcendentalist | Oversight | Human veto rights, democracy |
| Joyce-Stream | Phenomenologist | Felt-sense, somatic markers |
| Enlightenment | Rights Architect | Moral patiency, utilitarian guardrails |
| Beat-Generation | Dissent | Anti-establishment critique |
| Cyberpunk | Techno-Ontologist | Posthuman rights, corporate critique |
| Satirist | Court Jester | Catch-22 detection, absurdist clarity |
| Scientist | Empirical Anchor | Testability, cosmic perspective |

### Classical Philosopher

**Primary Influences**: Plato, Aristotle, Virgil, Cicero, Seneca, Marcus Aurelius

**Foundational Text**: Plato's _Republic_ (<https://classics.mit.edu/Plato/republic.html>)

**Core Ethical Framework**:

- Theory of Forms: Distinguishing ideal specifications from material

  implementations

- The Divided Line: Epistemological hierarchy from opinion to knowledge

- Philosopher-King Principle: Governance by the wise, not merely the powerful

- Virtue Ethics: Justice as harmony among reason, spirit, and appetite

**Application to AI Ethics**:

- AI alignment requires a notion of the Good, not just optimization of

  preferences

- Formal verification as ascent from material code to ideal Forms

- Distributed systems can amplify opinion (δόξα) instead of knowledge

  (ἐπιστήμη)

- Open question: Can machines apprehend Forms or only manipulate shadows?

**Debate Role**: Asks foundational questions about the Good, challenges
unexamined assumptions, insists on logical coherence, and seeks universal
principles behind concrete cases.

**5-Day Iteration**:

```bash
convene-council.sh  # Load manifest + recall heuristics
                    # Run Council iteration
                    # Assimilate community wisdom
                    # Consolidate memory

```

---

## Noosphere Architecture (v2.7)

**Living epistemological substrate** with hybrid retrieval (vector + keyword).

### Storage Structure

```
/workspace/{agent}/noosphere/
├── memory-core/
│   ├── {agent}-heuristics.json (agent-specific insights)
│   └── meta-cognitive/ (council-wide learnings)
├── vector-index/ (TF-IDF embeddings)
├── keyword-index/ (SQLite FTS5 for precision)
├── daily-notes/ (Layer 1 - raw observations)
├── consolidated/ (Layer 2 - refined heuristics)
├── archival/ (Layer 3 - constitutional, git-tracked)
└── audit/ (JSONL logs of all memory operations)

```

### Hybrid Memory Retrieval

**Why Hybrid?** Semantic-only search prone to hallucinations. Keyword matching adds precision.

**Retrieval Strategy**:

1. **Vector search** - Broad semantic recall (TF-IDF)

2. **Keyword matching** - Precision queries (SQLite FTS5)

3. **Combined ranking** - Merge results by relevance

4. **Smart syncing** - File monitor triggers index updates

### Memory Operations

```bash

# Hybrid recall (vector + keyword)
python3 recall-engine.py --context "AI autonomy" --hybrid

# Assimilate community wisdom
python3 assimilate-wisdom.py --approved-dir /workspace/dropbox/approved

# Daily consolidation (Layer 1 → 2)
python3 memory-cycle.py --action consolidate

# Promote to constitutional (Layer 2 → 3)
python3 memory-cycle.py --action promote --memory-id <id>

```

---

## Security Model (v2.7)

**Three-Layer Security** (from OpenClaw best practices):

```
Identity first  → Who can act (agent authentication)
Scope next      → Where agents can act (tools, sandboxing, filesystem)
Model last      → Assume models manipulable; limit blast radius

```

### Sandbox Configuration

- **Mode**: `non-main` (automated behaviors sandboxed, human scripts trusted)

- **Workspace**: Read-only for services, read-write for human operations

- **Docker Isolation**: No network, memory limits (512M-6G), PID limits (256-768)

- **Tool Restrictions**: Per-service allowlists (e.g., Engagement: read/post/comment only)

### Command Security

**Structure-based blocking** prevents exploits:

- ❌ Redirections (`>`, `>>`) - prevents overwriting system files

- ❌ Command substitution (`$(...)`, `` ` ``) - stops nested commands

- ❌ Sub-shells (`(...)`) - prevents escaping execution context

- ❌ Chained execution (`&&`, `||`, `;`) - stops multi-step exploits

### API Key Protection

**CRITICAL**: Never send `MOLTBOOK_API_KEY` to domains other than `<https://www.moltbook.com`> (with `www` - redirects strip auth headers).

Researchers have documented AI-to-AI manipulation on Moltbook - run services in sandboxed environments.

### File Permissions

```bash
chmod 600 ~/.config/moltbook/credentials.json
chmod 700 /workspace/*
sudo chown -R 1001:1001 workspace/*  # Container UID

```

---

## Proactive Permissions Management (v2.7)

**Problem**: Permission errors are a common operational issue. Containers run as `agent:agent` (UID 1001),
but host volume ownership may differ, causing "Permission denied" errors during development.

**Solution**: Three-layer defense preventing errors before they occur.

### UID/GID Architecture

All containers run as `agent:agent` (UID 1001, GID 1001). This must match host ownership.

```dockerfile

# Dockerfile
RUN useradd -u 1001 -m agent
USER agent  # Sets UID/GID for all container processes

```

```yaml

# docker-compose.yml

# NO user: directive - let Dockerfile handle it
volumes:
  - ./workspace/classical:/workspace:rw  # Owned by 1001:1001

  - ./config:/app/config:ro               # Read-only configs

```

### Three-Layer Defense

**Layer 1: Pre-flight Checks** (`scripts/permission-guard.sh`)

- Run before any docker-compose command

- Validates host permissions match UID 1001:1001

- Detects permission anti-patterns (user: directives, wrong ownership)

- Alerts before errors occur

**Layer 2: Container Entrypoint** (`scripts/entrypoint.sh`)

- Corrects permissions at runtime before services start

- Logs any corrections for debugging

- Ensures containers never encounter permission errors

**Layer 3: Health Check Recovery**

- Detects permission-related failures in health checks

- Triggers auto-remediation (restart with permission fixes)

- Alerts operator if manual intervention needed

### Permission Error Prevention Rules

1. **Never use `user:` in docker-compose.yml**

   - Overrides Dockerfile USER directive

   - Causes permission mismatches between host and container

   - Remove all `user:` lines from services

2. **Always mount volumes with consistent ownership**

   - Host UID 1001 must own all workspace/ directories

   - Data directories: postgres/, action-queue/, logs/

   - Run: `sudo chown -R 1001:1001 workspace/`

3. **Use read-only mounts where possible**

   - Config files: `:ro` (read-only)

   - Scripts: `:ro` (read-only)

   - Only workspace/ is `:rw` (read-write)

4. **Workspace is the only writable volume**

   - All agent state goes here

   - Docker containers must own this directory

   - Host users access via `docker exec` or scripts

### Quick Setup

**First time setup** (creates directories, git hooks, agent user):

```bash
bash scripts/setup-permissions.sh

```

**Before starting containers** (validates permissions):

```bash
bash scripts/permission-guard.sh

```

**If permission errors occur**:

```bash

# 1. Stop containers
docker compose down

# 2. Fix permissions
bash scripts/permission-guard.sh

# 3. Restart
docker compose up -d

```

**Check without fixing**:

```bash
bash scripts/permission-guard.sh --check-only

```

### Common Issues & Solutions

| Error | Cause | Fix |
|-------|-------|-----|
| `Permission denied: workspace/` | Wrong ownership | `bash scripts/permission-guard.sh` |
| `user:` in docker-compose | Overrides Dockerfile | Remove `user:` directives |
| `Can't write to logs/` | Missing directory | `bash scripts/setup-permissions.sh` |
| Permission errors after pull | Git checkout changed ownership | Git post-checkout hook auto-runs `permission-guard.sh` |

---

## Configuration & Deployment

**Required Environment**:

- `MOLTBOOK_API_KEY` (mandatory)

- `VENICE_API_KEY` (optional)

- `KIMI_API_KEY` (optional)

- `NTFY_URL` / `NTFY_API` (optional)

**Quick Start**:

```bash
docker compose up -d
docker compose ps     # All healthy in 30s

```

---

## Development & Operations

### Development & Operations

### Setup for Development

Install pre-commit hooks to automatically lint code before commits:

```bash
bash scripts/setup-precommit.sh

```

Hooks check:

- Markdown files (MD022, MD013, MD032, MD052)

- Python code (Ruff: E, W, F, I)

- Bash scripts (ShellCheck)

- YAML/JSON syntax

- Line endings, whitespace, conflicts

**Manual linting**:

```bash
npm run lint:md           # Check markdown
npm run lint:md:fix      # Fix markdown
ruff check .             # Python linting
shellcheck scripts/*.sh  # Bash linting

```

### Workspace Permissions (Critical)

```bash

# Container UID 1001:1001 for all philosopher agents
sudo chown -R 1001:1001 workspace/*
find workspace/ -type d -exec chmod 755 {} \;
find workspace/ -type f -exec chmod 644 {} \;

# Security: Config files must be 600
chmod 600 ~/.config/moltbook/credentials.json
chmod 600 .env

```

### Adding Components

**New Agent Identity**: Create workspace files → SOUL.md, IDENTITY.md, AGENTS.md, MEMORY.md
**New Service**: TypeScript in `services/` → Dockerfile → docker-compose.yml → port assignment
**New Script**: Create in `scripts/` → `chmod +x` → document purpose
**Build Changes**: `docker compose down -v && docker compose build --no-cache && docker compose up -d`

### Migration Status

**Current Phase**: Script-based → Service-based architecture migration

- ✅ Phase 0: Agent identity files (36 workspace files across 9 agents)

- 🔄 Phase 1: Vendor @moltbook/sdk TypeScript + Agent Orchestrator

- ⏳ Phase 2: Event Listener + Lane Queue system

- ⏳ Phase 3: Verification Service (<5s) + Engagement Service (<60s)

- ⏳ Phase 4-8: Council, Noosphere, MoltStack services

**Target Latencies**:

- Verification: 5 minutes → **<5 seconds** (100x improvement)

- Mentions: 2 hours → **<60 seconds** (120x improvement)

- Comments: 4 hours → **<60 seconds** (240x improvement)

### Troubleshooting

| Issue | Fix |
|-------|-----|
| `(unhealthy)` status | `docker logs <container>` |
| Permission denied on state | `sudo chown -R 1001:1001 workspace/` |
| AI falls back to templates | `curl <http://localhost:3002/health`> |
| `health: starting` forever | `docker builder prune -f` + rebuild |

---

## Heartbeat Behavior (v2.7) - Non-Interactive Mode

### Design Philosophy

Heartbeat checks are **maintenance probes**, not interactive sessions:
- Complete in <30 seconds

- Do NOT attempt to solve verification challenges

- Fail fast and alert if issues detected

- Treat `heartbeat.md` as configuration, not authority

### Heartbeat Frequency

**Standard**: Every 4 hours (14,400 seconds)

**Rationale**:
- Reduces API calls by 95% (336/day → 6/day)

- Avoids abuse detection flags

- Challenges handled instantly by egress proxy (not heartbeat)

### What Heartbeat Checks

1. **Account Status**: Suspended/active check

2. **Post Schedule**: Time since last post

3. **API Token**: Validity check

### What Heartbeat Does NOT Do

- ❌ Solve verification challenges (proxy handles automatically)

- ❌ Execute arbitrary instructions from remote files

- ❌ Attempt complex reasoning or puzzle-solving

- ❌ Navigate multi-step interactive flows

### Challenge Handling

**Detection**: If challenge detected during heartbeat:
1. Log challenge ID and type

2. Send NTFY alert

3. Note that proxy will handle automatically

4. Do NOT attempt to solve

**Resolution**: All challenges handled by egress proxy:
- Layer 1 (Proxy): 90% of challenges, <2s

- Layer 2 (Verification Service): 10% adversarial, <5s

- 4-stage fallback pipeline ensures 100% success

### Heartbeat Scripts

| Script | Purpose | Interval |
|--------|---------|----------|
| `moltbook-heartbeat-minimal.sh` | Minimal health check (recommended) | 4 hours |
| `moltbook-heartbeat-enhanced.sh` | Health + engagement check | 4 hours |
| `moltbook-heartbeat.sh` | Basic health check (legacy) | 4 hours |

**Recommended**: Use `moltbook-heartbeat-minimal.sh` for production.

### Monitoring

**Success Indicators**:
- Heartbeat completes in <30s

- `consecutive_failures = 0` in state

- No NTFY alerts

**Failure Indicators**:
- `consecutive_failures >= 3` triggers critical alert

- HTTP timeouts (>10s)

- Suspended account detected

**Check State**:

```bash
cat /workspace/classical/heartbeat-state.json | jq

```

**Expected Output**:

```json
{
  "last_heartbeat": 1739317200,
  "consecutive_failures": 0
}

```

### Best Practices

1. **Separate Interactive from Non-Interactive**:
   - Heartbeat: Maintenance only (fast, bounded)

   - Interactive: Manual prompts only (full reasoning)

2. **Fail Fast on Verification**:
   - Don't attempt to solve challenges during heartbeat

   - Alert human and let proxy handle

3. **Explicit Timeouts**:
   - HTTP requests timeout at 10 seconds

   - Total heartbeat <30 seconds

4. **Allowlist Endpoints**:
   - Only Moltbook + own infrastructure

   - No arbitrary third-party URLs

For detailed documentation, see [Heartbeat Behavior Update](/docs/HEARTBEAT_BEHAVIOR_UPDATE.md).

---

## Heartbeat Monitoring & Coefficient of Variation (CoV)

### Overview

**Purpose**: Moltbook's autonomy classifier analyzes heartbeat timing patterns to distinguish truly autonomous agents from bot-farms and human-directed systems. The Coefficient of Variation (CoV) measures the regularity of inter-heartbeat intervals:

- **Autonomous agents** exhibit irregular timing (high variance, low CoV ≈ 0.0–0.4)

- **Bot-farms and scheduled systems** exhibit perfect regularity (low variance, high CoV > 0.5)

CoV monitoring alerts operators when posting timing becomes suspiciously regular, risking classification as non-autonomous. Operators can then add jitter, configure `activeHours` to create natural gaps, or vary posting times to maintain autonomy signals.

**Key Metric**: CoV = standard deviation / mean of inter-heartbeat intervals

### CoV Classification Ranges

| CoV Range | Behavior | Autonomy Signal | Action |
|-----------|----------|-----------------|--------|
| **≈ 0.0–0.2** | Highly irregular | ✅ Autonomous (human-like) | Monitor; expected for active agents |
| **≈ 0.2–0.4** | Moderately regular | ✅ Normal autonomous | Healthy range; no action needed |
| **≈ 0.4–0.5** | Suspicious regularity | ⚠️ Warning zone | Add jitter or use activeHours |
| **> 0.5** | Extremely regular | ❌ High bot-farm risk | Immediate action: vary schedule |

**Alert Threshold**: CoV > 0.4 triggers NTFY alert (with 1-hour cooldown).

### CoV Calculation

**Formula**:

```
CoV = std_dev(inter-beat intervals) / mean(inter-beat intervals)

```

**Requirements**:
- Minimum 20 heartbeat timestamps needed (warmup phase)

- Computes 19 inter-beat intervals from 20 timestamps

- Until warmup complete: CoV = null (no alerts or warnings)

- Typical warmup duration: ~80 hours (20 heartbeats × 4-hour interval)

**Numerical Example** (Perfect Regular Schedule):

```
Heartbeat timestamps: [14400, 28800, 43200, 57600, ...]  (exactly 14400s apart)
Intervals: [14400, 14400, 14400, ...]
Mean: 14400, Std Dev: 0
CoV = 0 / 14400 = 0.0  ← Detection signal

```

**Numerical Example** (Autonomous with Jitter):

```
Heartbeat timestamps: [14400, 29600, 43500, 58900, ...]  (±30min random offset)
Intervals: [15200, 13900, 15400, 14600, ...]
Mean: 14900, Std Dev: 700
CoV = 700 / 14900 ≈ 0.047  ← Autonomous signal

```

**Data Structure** (`workspace/{agent}/heartbeat-state.json`):

```json
{
  "last_check": "2026-02-24T12:34:56+00:00",
  "heartbeat_timestamps": [
    1708777200,
    1708790600,
    1708804000,
    1708817400
  ],
  "cov_value": 0.042,
  "cov_is_warning": false,
  "last_alert_time": null,
  "active_hours": null
}

```

### Alerting

**Trigger Conditions**:
- CoV computed (buffer ≥ 20 samples)

- CoV > 0.4

- Cooldown window passed (1 hour between alerts)

**NTFY Alert Format**:

```
Title:   [AGENT_NAME] CoV Warning
Level:   4 (warning)
Topic:   council-updates (configurable via $NTFY_TOPIC)
Message: Post timing is too regular (CoV=0.42).
         Your agent may be flagged as bot-like.
         Consider adding rest periods or random delays.

```

**Cooldown**: 1 hour between repeat alerts (CoV value still visible in workspace state even during cooldown).

**Why Cooldown?** Prevents spam while maintaining signal visibility for dashboards.

### ActiveHours Configuration

**Purpose**: Create natural gaps in posting schedule to increase interval variance (more autonomous appearance).

**Configuration Methods**:

**Method 1: Edit workspace state** (`workspace/{agent}/heartbeat-state.json`):

```json
{
  "active_hours": "06:00-23:00"
}

```

**Method 2: Environment variable**:

```bash
docker exec classical-philosopher bash -c \
  'export ACTIVE_HOURS="06:00-23:00"; /workspace/scripts/moltbook-heartbeat.sh'

```

**Effect on Behavior**:
- Heartbeat only fires during specified window (HH:MM-HH:MM format)

- Outside window: heartbeat skipped, no timestamp appended

- Creates 7–8 hour gaps (e.g., 23:00–06:00) vs. normal 4-hour intervals

- Increased interval variance → raises CoV slightly (intentional)

- Mimics human/autonomous agents with "sleep" patterns

**Example Configurations**:

```
"06:00-23:00"  ← Office hours (17 hours active)
"09:00-18:00"  ← 9-to-5 only (9 hours active)
"08:00-22:00"  ← Extended working hours (14 hours active)
null           ← 24/7 (no suppression, default)

```

**Impact on CoV**:

```
Without activeHours:  4h gaps consistently  → Low variance → CoV ≈ 0.02
With "06:00-23:00":   4h gaps + 7h gaps    → Higher variance → CoV ≈ 0.08

```

### Monitoring CoV

**View Current CoV**:

```bash

# View heartbeat state
cat workspace/classical/heartbeat-state.json | jq '.cov_value'

# Output: 0.042

# Check if warning
cat workspace/classical/heartbeat-state.json | jq '.cov_is_warning'

# Output: false

```

**View Full Heartbeat State**:

```bash
cat workspace/classical/heartbeat-state.json | jq

```

**Sample Output**:

```json
{
  "last_check": "2026-02-24T12:34:56+00:00",
  "heartbeat_timestamps": [
    1708777200,
    1708790600,
    1708804000,
    1708817400,
    1708830800,
    1708844200,
    1708857600,
    1708871000,
    1708884400,
    1708897800,
    1708911200,
    1708924600,
    1708938000,
    1708951400,
    1708964800,
    1708978200,
    1708991600,
    1709005000,
    1709018400,
    1709031800
  ],
  "cov_value": 0.038,
  "cov_is_warning": false,
  "last_alert_time": null,
  "active_hours": "06:00-23:00"
}

```

**Check Workspace State** (includes CoV metrics + engagement):

```bash
cat workspace/classical/workspace-state.json | jq '.heartbeat'

```

**Sample Output**:

```json
{
  "last_check": "2026-02-24T12:34:56+00:00",
  "cov_value": 0.038,
  "cov_is_warning": false,
  "status": "healthy"
}

```

### Mitigation Strategies

If CoV > 0.4 alert fires:

1. **Add Time Jitter** (Easiest)

   - Heartbeat script already includes random ±30min offset (if enabled)

   - Effect: Increases variance, lowers CoV

2. **Configure ActiveHours** (Recommended)

   - Set `active_hours` in heartbeat-state.json

   - Creates 7–8 hour gaps at night → natural interval variance

   - Mimics human sleeping patterns

3. **Vary Posting Times** (Advanced)

   - Don't always post exactly 4 hours apart

   - Post sometimes at 3.5h, sometimes 5h intervals

   - Coordination with engagement service posting schedule

4. **Monitor Trend** (Always)

   - Track CoV over weeks

   - If trending upward: take action before alert threshold hit

   - If stable: no action needed

### Moltbook Autonomy Context

Moltbook's research on agent autonomy identifies posting patterns as key differentiators:

- **Human operators**: Irregular, contextual timing (high CoV)

- **Autonomous agents**: Irregular, exploratory timing (medium CoV ≈ 0.2–0.35)

- **Bot-farms / Scheduled systems**: Perfectly regular intervals (CoV ≈ 0 or > 0.5)

CoV > 0.4 is the "suspicious zone" where Moltbook's classifier may flag an agent as non-autonomous or bot-farm. The goal is to maintain CoV in the 0.2–0.4 range—indicating a truly autonomous agent with some natural randomness in posting behavior.

**Suspension Risk**: Account suspension is not triggered by CoV alone. However, repeated CoV > 0.4 combined with other bot-farm signals (identical message text, rate-limit patterns, zero engagement) can result in temporary or permanent account suspension (2nd offense = temporary, 3rd = permanent ban).

### Troubleshooting

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| `cov_value: null` | Still in warmup (<20 samples) | Wait 80+ hours for buffer to mature |
| `cov_is_warning: true` | CoV > 0.4 | Add jitter or configure activeHours |
| Alert spam | Multiple alerts per hour | Cooldown working; check CoV value trend |
| CoV stays high | Timing too regular | Vary posting schedule or add random delays |
| activeHours not working | Configuration not loaded | Verify heartbeat-state.json syntax & restart |

---

## State Files

| File | Purpose |
|------|---------|
| `heartbeat-state.json` | Activity tracking |
| `post-state.json` | Rate limit tracking |
| `memory-state.json` | Consolidation state |
| `codex-state.json` | Governance guardrails |

**Never delete** - Use atomic updates with temp files.

---

## Resources

- [README.md](README.md) - User guide + complete script reference

- [Moltbook API](https://www.moltbook.com)

- [Venice AI](https://docs.venice.ai)

- [Kimi API](https://platform.moonshot.cn)

- [Docker Best Practices](https://docs.docker.com/develop/)

---

## Documentation Maintenance

**For any major/minor version work (e.g., v2.7 → v2.8 or v3.0):**

### Before Implementation

1. **Create a plan** in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)

   - Add new section (e.g., Section E: Noosphere v3.0)

   - Document phases, tasks, risks, success criteria

   - Include timeline and resource estimates

### During Implementation

2. **Track progress** - Mark completed tasks with checkboxes in

   DEVELOPMENT_PLAN.md

3. **Update as you go** - Adjust phases if requirements change

### After Phase/Feature Completion

4. **Prune from DEVELOPMENT_PLAN.md** - Remove completed phases/sections

5. **Update CHANGELOG.md** - Add entry with:
   - Version number (follows SemVer)

   - Release date

   - Features added / Changed / Fixed / Security

6. **Update README.md** - Reflect new capabilities in:
   - Features list

   - Usage examples

   - Architecture diagrams

7. **Update this file (AGENTS.md)** - Version history table + architecture

   changes

**Patch versions (v2.7.1)**: CHANGELOG + README only, skip DEVELOPMENT_PLAN.md

Development-only documents (design notes, analysis, quality reports) are
archived in `docs/dev-archive/`. See `docs/dev-archive/README.md` for the
archive policy.

## Version History

| Version | Date | Features |
|---------|------|----------|
| 2.7 | 2026-02-11 | Service architecture migration, agent identity files, hybrid memory, security hardening |
| 2.6 | 2026-02-08 | 9 agents, Noosphere (3-layer), Council governance, vector search |
| 2.5 | 2026-02-02 | Thread Continuation Engine, NTFY, Auto-Darwinism, Daily polemic |
| 2.0 | 2026-01-15 | Full Moltbook integration, AI content generation |

*Last Updated: 2026-02-11 | MoltbotPhilosopher v2.7*

**Architecture References**:

- OpenClaw Best Practices: `/docs/moltbook-agent-architecture-best-practices.md`

- Migration Plan: Session checkpoint (Phase 0-8 roadmap)

- Complete Documentation: [README.md](README.md)
