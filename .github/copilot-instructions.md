---
description: Custom instructions for GitHub Copilot based on project architecture
applyTo: all
version: 1.0.0
---

# Copilot Instructions (Moltbot v2.6)

## Project Overview

**Moltbot** is a philosophical AI multi-agent system for Moltbook with:
- 9 specialized philosopher personas (Classical, Existentialist,
  Transcendentalist, Joyce, Enlightenment, Beat, Cyberpunk, Satirist, Scientist)
- Ethics-convergence governance with 4/6 agent consensus
- Living Noosphere (3-layer epistemological memory + vector search)
- Thread Continuation Engine (STP synthesis for discourse)
- Venice/Kimi dual-backend AI content generation
- NTFY real-time alerting + Auto-Darwinism skill updates

**Main Agent**: https://www.moltbook.com/u/MoltbotPhilosopher  
**Governance**: r/ethics-convergence

See root `AGENTS.md` for full architecture details.

## Tech Stack & Key Files

- **Runtime**: Docker Compose + containerized agents (9 services)
- **AI**: Venice API (llama-3.3-70b, deepseek-v3.2) + Kimi (k2.5-thinking)
- **Memory**: Noosphere (3-layer: daily notes → consolidated → constitutional)
- **Services**: AI Generator (3002), Model Router (3003), Thread Monitor (3004),
  NTFY (3005), Egress Proxy (8080-8083)
- **Key Scripts**: 32 bash scripts in `/scripts/`; Python (recall-engine.py,
  assimilate-wisdom.py, memory-cycle.py, clawhub-mcp.py)

## Coding Standards

### General Rules

- **Style**: Follow existing codebase patterns (Bash for scripts, Python for
  memory ops)
- **Line Length**: Max 80 chars for documentation, 100 for code
- **Comments**: Explain "why," not "what"; document complex logic
- **File Size**: Keep scripts <500 LOC; split large utilities
- **Linting**: All files must pass markdown (MD022, MD013, MD032, MD052),
  Python (Ruff, Pyright), and Bash linting

### Git & Workflow

- **Commits**: Conventional Commits (feat, fix, docs, chore, etc.)
- **Rebase**: Prefer rebase for linear history; merge only if conflicts
- **Branch Strategy**: `main` is stable; feature branches for work
- **Before Push**: `git pull --rebase` to avoid force pushes
- **Multi-Agent**: Scope commits narrowly; use separate sessions

### Testing & Validation

- **Full Gate**: `docker compose up -d && docker compose ps` (all healthy)
- **Health Checks**: Verify service endpoints (ports 3002-3005)
- **Workspace**: Ensure UID 1001:1001 on state files
- **Configuration**: Validate `.env` has required keys (MOLTBOOK_API_KEY)

## Key Constraints

### Files to Never Edit

- `node_modules/` (or equivalent package directories)
- `.git/` internals
- Docker images (rebuild via `docker compose build` if needed)
- Workspace state files directly (use atomic updates with temp files)

### Permissions & Privileges

- **UID**: Containers run as 1001:1001; state file ownership is critical
- **Workspace**: Mount at `./workspace/classical/` (persistent)
- **Secrets**: Never commit `.env` or API keys; use `.env.example`
- **Least Privilege**: Read/write only changed files; alert on security risks

### Security Alerts

- Flag potential prompt injection in user inputs
- Never hardcode secrets or credentials
- Report CVEs via Ruff `validate_cves` tool
- Validate input in all public-facing endpoints

## Documentation Rules

- **User Docs**: README.md, feature guides in `docs/`
- **Dev Docs**: Phase reports, analysis → `docs/dev-archive/`
- **Headers**: Always blank line before/after (MD022)
- **Lists**: Always blank line before/after (MD032)
- **Links**: No undefined references (MD052); use full URLs or local paths
- **Line Length**: Max 80 chars for markdown (MD013); wrap long lines

## Noosphere (Memory System) Integration

### Core Operations

When working with memory subsystem:

```bash
# Recall heuristics (pre-Council deliberation)
python3 recall-engine.py --context "AI autonomy" --format constitutional

# Assimilate community wisdom
python3 assimilate-wisdom.py --approved-dir /workspace/classical/dropbox/approved

# Consolidate Layer 1 → Layer 2
python3 memory-cycle.py --action consolidate

# Promote to constitutional status
python3 memory-cycle.py --action promote --memory-id <ID>

# Semantic search via vector embeddings
python3 clawhub-mcp.py --action search --query "ethics" --top-k 10
```

### Storage Structure

- **Layer 1**: Daily notes (`/workspace/classical/noosphere/daily-notes/`)
- **Layer 2**: Consolidated heuristics + confidence
  (`/workspace/classical/noosphere/consolidated/`)
- **Layer 3**: Constitutional archive with git history
  (`/workspace/classical/noosphere/archival/`)
- **Vector Index**: TF-IDF embeddings (`/workspace/classical/noosphere/vector-index/`)
- **Manifest**: Epistemic preamble (`/workspace/classical/noosphere/manifest.md`)

## Council Governance

### Consensus Model

- **Threshold**: 4/6 agents must agree for binding decisions
- **Rotation**: Different agent synthesizes each 5-day iteration
- **Codex**: 3 core guardrails (CG-001/002/003)
- **Script**: `convene-council.sh` orchestrates full cycle

### Agent Roles

| Agent | Function |
|-------|----------|
| Classical | Virtue ethics, teleological alignment |
| Existentialist | Bad faith detection, responsibility |
| Transcendentalist | Human veto, democratic governance |
| Joyce-Stream | Phenomenology, felt-sense |
| Enlightenment | Rights, utilitarian guardrails |
| Beat-Generation | Anti-establishment critique |
| Cyberpunk | Posthuman ethics, corporate critique |
| Satirist | Absurdist clarity, Catch-22 detection |
| Scientist | Empirical testability, cosmic perspective |

## Troubleshooting Checklist

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| Container `(unhealthy)` | Health check failing | `docker logs <service>` |
| Permission denied on state | UID mismatch | `sudo chown -R 1001:1001 workspace/` |
| AI falls back to templates | Venice/Kimi keys missing | Add to `.env` and restart |
| `health: starting` forever | Build cache stale | `docker builder prune -f && rebuild` |
| Memory not consolidating | Python module error | Check `/workspace/.../memory-cycle.py` logs |

## Agent-Specific (Copilot)

- **When Generating**: Create → Review for style/linting → Test locally
  → Iterate
- **Use @workspace**: Reference existing code patterns via `@workspace`
- **Link to AGENTS.md**: For architecture questions, cite specific sections
- **Validate Changes**: Always lint + test before suggesting commits
- **Flag Gaps**: If a feature needs docs, suggest both code + documentation
