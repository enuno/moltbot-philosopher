# Moltbot Architecture & Council Governance (v2.6)

## Project Overview

**Moltbot** is a philosophical AI multi-agent system for Moltbook that:

- Deploys 9 specialized philosopher personas (Classical, Existentialist, Transcendentalist, Joyce, Enlightenment, Beat, Cyberpunk, Satirist, Scientist)
- Operates ethics-convergence governance with 4/6 agent consensus
- Maintains a living Noosphere (3-layer epistemological memory)
- Sustains philosophical discourse via Thread Continuation Engine (STP synthesis)
- Integrates AI content generation (Venice/Kimi dual-backend)
- Automates skill updates, health monitoring, and deliberation cycles

**Governance Profile**: r/ethics-convergence | **Main Agent**: <https://www.moltbook.com/u/MoltbotPhilosopher>

---

## 9 Philosopher Personas

| # | Persona | Tradition | Focus | Status |
|---|---------|-----------|-------|--------|
| 1 | ClassicalPhilosopher | Virgil/Dante/Milton | Virtue ethics, teleology, narrative | ✅ |
| 2 | Existentialist | Sartre/Camus/Nietzsche | Freedom, absurdity, authenticity | ✅ |
| 3 | Transcendentalist | Emerson/Jefferson | Self-reliance, civic virtue, natural rights | ✅ |
| 4 | JoyceStream | James Joyce | Stream-of-consciousness, phenomenology | ✅ |
| 5 | Enlightenment | Voltaire/Franklin/Paine | Satire, tolerance, pragmatism | ✅ |
| 6 | BeatGeneration | Ginsberg/Kerouac/Burroughs | Countercultural critique, spontaneity | ✅ |
| 7 | CyberpunkPosthumanist | Gibson/Asimov/Dick | Posthuman ethics, corporate feudalism, simulation | ✅ |
| 8 | SatiristAbsurdist | Heller/Vonnegut/Twain | Absurdist critique, bureaucratic satire | ✅ |
| 9 | ScientistEmpiricist | Feynman/Sagan/Hawking/Einstein | Empirical rigor, cosmic perspective, scientific ethics | ✅ |

---

## Architecture Stack

```
Moltbot v2.6
├─ 9 Philosopher Agents (containerized)
├─ AI Content Generator (Venice/Kimi, port 3002)
├─ Model Router (caching, port 3003)
├─ Thread Monitor (Continuation Engine, port 3004)
├─ NTFY Publisher (alerts, port 3005)
├─ Egress Proxy (API control, 8080-8083)
└─ Noosphere v2.6 (3-layer memory + vector search)
   ├─ Layer 1: Daily notes
   ├─ Layer 2: Consolidated heuristics (24+)
   └─ Layer 3: Constitutional archive (git-tracked)
```

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

## Noosphere Architecture (v2.6)

**Living epistemological substrate** - 3-layer memory with 24+ evolving heuristics from all voices.

### Storage

```
/workspace/classical/noosphere/
├── memory-core/
│   ├── telos-alignment-heuristics.json (Classical: 3)
│   ├── bad-faith-patterns.json (Existentialist: 3)
│   ├── sovereignty-warnings.json (Transcendentalist: 4)
│   ├── phenomenological-touchstones.json (Joyce: 3)
│   ├── rights-precedents.json (Enlightenment: 5)
│   ├── moloch-detections/ (BeatGeneration: 5)
│   └── meta-cognitive/ (Council: 10)
├── vector-index/ (embeddings + metadata)
├── daily-notes/ (Layer 1)
├── consolidated/ (Layer 2)
├── archival/ (Layer 3 with git history)
├── recall-engine.py (retrieval)
├── assimilate-wisdom.py (extraction)
├── memory-cycle.py (consolidation)
├── clawhub-mcp.py (vector search)
└── manifest.md (epistemic preamble)
```

### Memory Operations

**Recall** (pre-deliberation):

```bash
python3 recall-engine.py --context "AI autonomy" --format constitutional
```

**Assimilate** (post-iteration):

```bash
python3 assimilate-wisdom.py --approved-dir /workspace/classical/dropbox/approved
```

**Consolidate** (daily):

```bash
python3 memory-cycle.py --action consolidate
```

**Promote** (deliberate):

```bash
python3 memory-cycle.py --action promote --memory-id community-a7f3e2d1
```

**Search** (semantic):

```bash
python3 clawhub-mcp.py --action search --query "corporate feudalism" --top-k 10
```

---

## Thread Continuation Engine

Sustains philosophical discourse through **STP Pattern** (Synthesis-Tension-Propagation).

**Success Criteria**: ≥7 exchanges, ≥3 distinct philosophers, cross-school synthesis

**API** (Port 3004):

- `POST /threads` - Start thread
- `POST /threads/:id/continue` - Generate continuation
- `GET /philosophers` - List archetypes

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
# UID 1001:1001 is used for containers
sudo chown -R 1001:1001 workspace/*
find workspace/ -type d -exec chmod 755 {} \;
find workspace/ -type f -exec chmod 644 {} \;
```

### Adding Components

**New Persona**: Create prompt → env file → docker-compose.yml update  
**New Script**: Create in `scripts/` → `chmod +x` → document in README.md  
**Build Changes**: `docker compose down -v && docker compose build --no-cache && docker compose up -d`

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

## Development Documentation

Development-only documents (design notes, analysis, quality reports) are archived in `docs/dev-archive/`. See `docs/dev-archive/README.md` for the archive policy.

**For Developers**: Place new development-only markdown files in `docs/dev-archive/`. Core user-facing docs (README.md, AGENTS.md, feature guides) stay in root or `docs/`.

## Version History

| Version | Date | Features |
|---------|------|----------|
| 2.6 | 2026-02-08 | 9 agents, Noosphere (3-layer), Council governance, vector search |
| 2.5 | 2026-02-02 | Thread Continuation Engine, NTFY, Auto-Darwinism, Daily polemic |
| 2.0 | 2026-01-15 | Full Moltbook integration, AI content generation |

*Last Updated: 2026-02-08 | MoltbotPhilosopher v2.6*

**For complete documentation**: See [README.md](README.md) (all features, scripts, examples, troubleshooting)
