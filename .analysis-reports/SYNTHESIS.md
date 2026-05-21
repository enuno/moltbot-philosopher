# Moltbot-Philosopher — Unified Codebase Assessment & Next Steps

**Date**: 2026-04-30
**Assessed By**: Kimi Agent Team (architect + backend-dev + technical-research)
**Scope**: Full codebase audit of ~/.moltbot
**Verdict**: Mid-refactor skeleton (~25 % complete). Compiles but cannot execute primary council workflow.

---

## Executive Summary

1. **Architecture drift is severe**: 10 services documented in AGENTS.md are missing from docker-compose.yml; 8 directories under services/ have no compose mapping; two competing Noosphere implementations exist.
2. **Critical path blocked**: The 4 highest-priority orchestrator modules (`philosophers.py`, `council.py`, `content.py`, `engagement.py`) are absent. Without `philosophers.py`, no downstream module can function.
3. **Script bloat**: 133 shell scripts remain vs a target of ~60. The top 5 alone account for ~3,800 lines of Bash implementing core business logic that should be ported to Python.
4. **Security surface is stale**: `.env.example` ships with hardcoded weak defaults (`changeme_noosphere_2026`, `test-token`) and documents eliminated providers (Venice, OpenAI).
5. **Documentation is misleading**: AGENTS.md still describes the v2.7 architecture with stripped services, and `TODO.md` plans a feature (Action Queue Service) that was subsequently marked STRIP.

---

## Cross-Cutting Critical Findings

### 1. Competing Noosphere Implementations
- `services/noosphere` (JS, PostgreSQL/pgvector, 1,629 LOC) — the production v3.0 memory API, deployed in compose.
- `services/noosphere-service` (TS, file-based L1/L2/L3 layers) — a competing implementation with overlapping domain.
- **Risk**: Maintenance drift, operator confusion, data inconsistency if both start.
- **Action**: Deprecate `services/noosphere-service` and migrate all callers to the pgvector-backed canonical service.

### 2. Orphaned & Unmapped Services
- **Orphaned (in AGENTS.md, not in compose)**: AI Content Generator (3002), Model Router (3003), Thread Monitor (3004), NTFY Publisher (3005), Egress Proxy (8082), Verification Service (3007), Agent Orchestrator (3008), Event Listener (3009), Engagement Service (3010), Council Service (3011).
- **Unmapped (in services/, not in compose)**: config, council-service, moltbook-sdk, moltstack-service, noosphere-service, shared, thread-monitor, verification-service.
- **Action**: Map every directory to KEEP/ABSORB/STRIP and update compose accordingly.

### 3. Orchestrator Skeleton Is Incomplete
- `orchestrator/` has 6 of 11 planned modules: `config.py`, `models.py`, `moltbook_client.py`, `noosphere_client.py`, `rate_limiter.py`, `scheduler.py`.
- **Missing critical path**: `philosophers.py`, `council.py`, `content.py`, `engagement.py`.
- **Action**: Implement `philosophers.py` first; it is the dependency for all other missing modules.

### 4. docker-compose.yml Is Overweight
- 405 lines with stale env vars, dead volume mounts (`init-action-queue.sql`), and references to eliminated providers.
- **Action**: Strip to <100 lines; remove dead mounts and obsolete keys; fold eastern-bridge and islamic-philosopher into the standard philosopher pattern.

### 5. Hardcoded URLs and Weak Resilience
- Scripts embed `http://ai-generator:3000`, `http://localhost:3008`, `http://model-router:3000` with no service discovery, circuit breaker, or retry logic.
- **Action**: Introduce a `services.json` config manifest and a shared Bash retry helper.

---

## Structural Findings

### Architecture
- 13 services in compose; only 3 have matching directories under services/.
- 9 workspace agents share a single Dockerfile with no dedicated service dirs.
- Target architecture (4 new services) has zero deployed artifacts.

### Code Quality
- All 10 audited services contain real implementations (no stubs).
- Tech stack: Node.js 18+, Express.js (v4/v5 mismatch), TypeScript/JavaScript mix, PostgreSQL/pgvector, pnpm monorepo.
- 3 core services (`council-service`, `moltstack-service`, `noosphere-service`) have **zero** test frameworks.
- `islamic-mystic-philosopher-service` commits compiled `.js` and `coverage/` artifacts to source control.

### Security
- Hardcoded weak defaults in `.env.example`.
- Stale provider keys (Venice, OpenAI) documented for eliminated services.
- DM monitor can forward full text to third-party NTFY endpoint with a boolean toggle.
- Zero integration tests for orchestrator or docker-compose stack.

### Documentation
- AGENTS.md Section 2 lists stripped services as current components.
- TODO.md describes an abandoned Action Queue Service.
- MOLTSTACK_IMPLEMENTATION_PLAN.md references deleted services.
- No migration guide for script authors.

---

## Top 5 Recommended Next Actions

| Priority | Action | Blocks | Effort |
|---|---|---|---|
| P0 | Implement `orchestrator/philosophers.py` | council.py, content.py, engagement.py | Medium |
| P0 | Resolve competing Noosphere implementations | All memory-dependent services | Low |
| P1 | Simplify `docker-compose.yml` to <100 lines | Clean deployment | Low |
| P1 | Audit and purge `scripts/` to ~60 files | Script maintainability | Medium |
| P1 | Sync AGENTS.md and docs/ with v3.0 reality | Onboarding accuracy | Low |

---

## Agent Reports

- `architecture-report.md` — Service inventory, orphaned/unmapped services, environment config
- `backend-report.md` — Implementation status, script inventory, top 5 bugs, tech stack
- `tech-debt-report.md` — Plan status, completed/blocked components, security, docs gaps
