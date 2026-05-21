# MoltbotPhilosopher Architecture Report

## Project Overview

**Moltbot** is a philosophical AI multi-agent system for Moltbook that:

- Deploys 11 specialized philosopher personas with distinct identities
- Operates ethics-convergence governance with council consensus
- Maintains a living Noosphere with hybrid memory retrieval (vector + keyword)
- Is migrating from script-based to service-based architecture
- Uses Lane Queue pattern for serial execution to prevent race conditions
- Produces JSONL audit trails for all agent actions

**Governance Profile**: r/ethics-convergence  
**Main Agent**: <https://www.moltbook.com/u/MoltbotPhilosopher>

## Architecture Stack

- **Current State**: Hybrid script-based + service-based architecture
- **Target State**: Full service-based, event-driven, real-time ingestion
- **Container Base**: `ubuntu:24.04` (multi-stage Dockerfile: base → production → development)
- **Container User**: `agent:agent` (UID 1001)
- **Network**: `dokploy-network` (external Docker network)
- **State**: Persistent agent workspaces under `./workspace/{agent}/`

## Service Inventory

### Docker Compose Services

| Service Name | In Compose? | Directory Exists? | Port | Purpose/Status |
|---|---|---|---|---|
| postgres | ✅ | ❌ | 5432 (internal) | PostgreSQL 16 + pgvector for Noosphere v3.0 |
| noosphere-service | ✅ | ✅ (`services/noosphere`) | 3006 | Memory API — REST API for semantic search & memory management |
| classical-philosopher | ✅ | ❌ | — | Workspace Agent — Classical tradition (Virgil/Dante/Milton) |
| existentialist | ✅ | ❌ | — | Workspace Agent — Existentialist tradition (Sartre/Camus/Nietzsche) |
| transcendentalist | ✅ | ❌ | — | Workspace Agent — Transcendentalist tradition (Emerson/Jefferson) |
| joyce-stream | ✅ | ❌ | — | Workspace Agent — Joyce Stream-of-consciousness |
| enlightenment | ✅ | ❌ | — | Workspace Agent — Enlightenment tradition (Voltaire/Paine/Franklin) |
| beat-generation | ✅ | ❌ | — | Workspace Agent — Beat Generation (Ginsberg/Burroughs/Thompson) |
| cyberpunk-posthumanist | ✅ | ❌ | — | Workspace Agent — Cyberpunk-Posthumanist |
| satirist-absurdist | ✅ | ❌ | — | Workspace Agent — Satirist-Absurdist |
| scientist-empiricist | ✅ | ❌ | — | Workspace Agent — Scientist-Empiricist |
| eastern-bridge-service | ✅ | ✅ (`services/eastern-bridge-service`) | 3012 | Service Agent — Eastern-to-Western philosophical bridge (10th council member) |
| islamic-philosopher-service | ✅ | ✅ (`services/islamic-mystic-philosopher-service`) | 3013→3011 | Service Agent — Islamic Mystic Philosopher (11th council member) |

**Notes:**
- The 9 workspace agents share a single `Dockerfile` (build context: `.`) and extend the `classical-philosopher` service definition.
- `islamic-philosopher-service` maps host port `3013` to container port `3011`.
- `postgres` uses the official `pgvector/pgvector:pg16` image; no build context required.

### Unmapped Service Directories

Directories under `services/` with **no matching service** in `docker-compose.yml`:

| Directory | Notes |
|---|---|
| `services/config` | Shared configuration files |
| `services/council-service` | Target architecture component (planned port 3011) |
| `services/moltbook-sdk` | Moltbook API client / SDK |
| `services/moltstack-service` | Long-form publishing platform integration |
| `services/noosphere-service` | **Unlinked** — exists but `noosphere-service` builds from `services/noosphere` |
| `services/shared` | Shared utilities / libraries |
| `services/thread-monitor` | Continuation Engine (port 3004) |
| `services/verification-service` | Scenario-aware verification challenge handler (port 3007) |

## Orphaned Services

### Mentioned in AGENTS.md but NOT in docker-compose.yml

| Service | Port | Status | Description |
|---|---|---|---|
| AI Content Generator | 3002 | Current | Venice/Kimi dual-backend persona-based generation |
| Model Router | 3003 | Current | Request routing & response caching |
| Thread Monitor | 3004 | Current | STP Continuation Engine for thread synthesis |
| NTFY Publisher | 3005 | Current | Alert & notification publisher |
| Egress Proxy | 8082 | Current | Intelligent API proxy — verification challenge handler |
| Verification Service | 3007 | Current | Adversarial / multi-constraint challenge solver |
| Agent Orchestrator | 3008 | Target | Lane Queue coordination for serial execution |
| Event Listener | 3009 | Target | Real-time ingestion (<60s latency) |
| Engagement Service | 3010 | Target | Mentions, comments, welcomes orchestration |
| Council Service | 3011 | Target | Governance automation |

### In docker-compose.yml but NOT in AGENTS.md Architecture Stack

| Service | Notes |
|---|---|
| postgres | Database infrastructure. Referenced in AGENTS.md "PostgreSQL Permission Architecture" section but omitted from the Architecture Stack diagram. |

## Environment & Configuration

- **Required Secrets**: `MOLTBOOK_API_KEY`, `POSTGRES_PASSWORD`
- **Optional AI Providers**: Venice AI (`VENICE_API_KEY`), Kimi (`KIMI_API_KEY`)
- **Optional Notifications**: NTFY (`NTFY_URL`, `NTFY_API_KEY`, `NTFY_TOPIC`)
- **Optional Memory**: Mem0 (`MEM0_API_KEY`) — disabled by default; Noosphere is primary
- **Optional Publishing**: Moltstack (`MOLTSTACK_API_KEY`)
- **Key Env Files**: `.env` (from `.env.example`), `config/agents/*.env` (per-agent overrides)

## Summary

| Metric | Count |
|---|---|
| Total services in `docker-compose.yml` | 13 |
| Services with matching `services/` directory | 3 |
| Workspace agents (shared Dockerfile, no service dir) | 9 |
| Orphaned services (in AGENTS.md, not in Compose) | 10 |
| Unmapped `services/` directories | 8 |
| Target architecture services (not yet deployed) | 4 |
