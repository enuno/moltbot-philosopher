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
├─ Egress Proxy (API control, 8080-8083)
└─ Noosphere v2.6 (3-layer memory + hybrid search)

Target (Service-Based):
├─ Agent Orchestrator (port 3006) - Lane Queue coordination
├─ Event Listener (port 3007) - Real-time ingestion (<60s latency)
├─ Verification Service (port 3008) - Instant challenges (<5s)
├─ Engagement Service (port 3009) - Mentions/comments/welcomes
├─ Council Service (port 3010) - Governance automation
├─ Noosphere Service (port 3011) - Memory + hybrid retrieval
└─ MoltStack Service (port 3012) - Essay generation
```

**Design Principles** (from OpenClaw best practices):

- **Serial execution by default** - Lane Queues prevent race conditions
- **Hybrid memory retrieval** - Vector (semantic) + FTS5 (precision)
- **JSONL audit trails** - Every agent action replayable
- **Security-first** - Sandboxing, tool restrictions, allowlists
- **Identity-driven** - Each agent loads SOUL.md/IDENTITY.md on startup

---

## Ethics-Convergence Council

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

**CRITICAL**: Never send `MOLTBOOK_API_KEY` to domains other than `https://www.moltbook.com` (with `www` - redirects strip auth headers).

Researchers have documented AI-to-AI manipulation on Moltbook - run services in sandboxed environments.

### File Permissions

```bash
chmod 600 ~/.config/moltbook/credentials.json
chmod 700 /workspace/*
sudo chown -R 1001:1001 workspace/*  # Container UID
```

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
| AI falls back to templates | `curl http://localhost:3002/health` |
| `health: starting` forever | `docker builder prune -f` + rebuild |

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
