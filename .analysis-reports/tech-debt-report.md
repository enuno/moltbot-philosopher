# Tech Debt Assessment — Moltbot Philosopher Council

**Date**: 2026-04-28  
**Scope**: v3.0 Refactor (Hermes-as-Orchestrator) + Legacy v2.7 Debt  
**Assessed By**: Technical Research Agent  
**VERDICT**: Project is in a fragile mid-refactor state (~25 % complete). Core orchestrator modules are missing, infrastructure still carries stale service baggage, and security hardening has not kept pace with the stripped surface area.

---

## 1. Plan Status Summary

- **Phase 0 (Foundation)** — ~75 % complete. `orchestrator/` skeleton exists with 6 of 11 planned modules (`config.py`, `models.py`, `moltbook_client.py`, `noosphere_client.py`, `rate_limiter.py`, `scheduler.py`). The four highest-priority modules (`council.py`, `philosophers.py`, `content.py`, `engagement.py`) are absent and block all downstream work.
- **Phase 1 (Strip & Simplify)** — Partially done. 12 STRIP services and 9 STRIP scripts have been deleted. However, `docker-compose.yml` is still 405 lines, still mounts `init-action-queue.sql` (deleted service), retains `OPENAI_API_KEY` / `EMBEDDING_PROVIDER=openrouter`, and keeps `verification-service` in `services/` despite being marked STRIP.
- **Phase 2–5 (Core Logic Porting → Production)** — Not started. No Python porting of shell scripts has occurred; `scripts/` still holds ~133 files against a target of ~60.
- **Action Queue Service (Feature G / TODO.md)** — Effectively abandoned. The detailed TODO.md describes a standalone TypeScript service that was subsequently marked STRIP in the refactor plan. Condition-evaluator types exist but there is no database layer, queue processor, or API server.
- **Moltstack Integration** — Planned but unimplemented. `MOLTSTACK_IMPLEMENTATION_PLAN.md` (2026-02-10) targets a 4-week delivery; zero artifacts exist in `skills/moltstack/` or `workspace/*/moltstack/`.

---

## 2. Completed Components

- `orchestrator/` skeleton with Pydantic models, Moltbook/Noosphere clients, rate-limiter, and scheduler.
- Service/script stripping: 12 obsolete services and 9 obsolete scripts removed from the tree.
- Config scaffolding: `config/hermes.yml` and `config/hermes-schedule.yml` are present.
- Venice references removed from `docker-compose.yml` (but not from `.env.example`).
- `.analysis-reports/` partially populated with prior audit artifacts (`SYNTHESIS.md`, `architecture-report.md`, `backend-report.md`).

---

## 3. Blocked / Missing Components

- **`orchestrator/philosophers.py`** — Required HTTP query interface to philosopher containers; blocks `council.py`, `content.py`, and `engagement.py`.
- **`orchestrator/council.py`** — Must port `convene-council.sh` and `synthesize-council-treatise.sh` into Python.
- **`orchestrator/content.py`** — Must port `daily-polemic-queue.sh` into `generate_daily_polemic()` and route all generation through Kimi API.
- **`orchestrator/engagement.py`** — Must absorb mentions, comments, thread-monitoring, and welcome logic.
- **`docker-compose.yml` simplification** — Still 405 lines, carries stale env vars and dead volume mounts; target is <100 lines.
- **`verification-service`** — Directory still exists in `services/` despite STRIP verdict.
- **~60 ABSORB scripts** — `scripts/` count is 133 vs target ~60; most have not been ported or deleted.

---

## 4. Security Posture

- **Hard-coded credentials in `.env.example`** — `POSTGRES_PASSWORD=changeme_noosphere_2026` and `ADMIN_TOKEN=test-token` ship with unsafe defaults and no runtime enforcement to change them.
- **Stale provider keys** — `.env.example` still documents `VENICE_API_KEY`, `OPENAI_API_KEY`, and `EMBEDDING_PROVIDER=openrouter`, even though the refactor plan mandates Kimi-only traffic. This creates confusion and risk of leaked/exposed keys for eliminated services.
- **DM monitor privacy leak vector** — `ENABLE_DM_MONITOR=false` and `DM_MONITOR_INCLUDE_FULL_CONTENT=false` are defaults, but the feature design allows forwarding full DM text to a third-party NTFY endpoint with only a boolean toggle and a comment warning.
- **No integration tests** — Zero automated test coverage for the orchestrator or the docker-compose stack; regressions from the refactor will not be caught.
- **No security audit** — `TODO.md` and `MOLTSTACK_IMPLEMENTATION_PLAN.md` both list a security audit as a future task, but no evidence of execution exists.

---

## 5. Documentation Gaps

- **README / docs still reference stripped services** — Discovery, engagement, model-router, and action-queue services are mentioned in `docs/*.md` but no longer exist in `services/`.
- **AGENTS.md describes v2.7 architecture** — Section 2 lists AI Content Generator, Model Router, NTFY Publisher, Egress Proxy, and Verification Service as current stack components, misleading any new contributor.
- **`TODO.md` is orphaned** — It details a 4-week implementation plan for a standalone Action Queue Service that has since been marked STRIP, creating conflicting guidance.
- **`MOLTSTACK_IMPLEMENTATION_PLAN.md` references deleted services** — Cites `services/ai-content-generator/` and Venice/Kimi dual backend that no longer exist.
- **No migration guide for script authors** — Contributors maintaining bash scripts in `scripts/` have no documented map showing which scripts were absorbed, which were stripped, and what the Python equivalents will be.

---

## 6. Top 5 Recommended Next Actions

1. **Implement `orchestrator/philosophers.py`** — Design and build the HTTP query interface to philosopher containers. This is the critical-path dependency; council, content, and engagement modules all require it.
2. **Simplify `docker-compose.yml` to <100 lines** — Remove stale mounts (`init-action-queue.sql`), eliminate `OPENAI_API_KEY` / `EMBEDDING_PROVIDER=openrouter`, fold `eastern-bridge-service` and `islamic-philosopher-service` into the standard philosopher pattern, and delete `verification-service`.
3. **Harden `.env.example` defaults** — Remove `VENICE_API_KEY`, `OPENAI_API_KEY`, and obsolete service URLs; add runtime validation that `POSTGRES_PASSWORD` and `ADMIN_TOKEN` are changed from defaults; add `.env.production.example` with stricter settings.
4. **Audit and purge `scripts/` to target ~60 files** — Classify the remaining 133 scripts into KEEP / ABSORB / STRIP, delete fully superseded ones, and document the porting roadmap for the rest.
5. **Sync AGENTS.md and docs/ with v3.0 reality** — Rewrite Section 2 (Architecture Stack) to reflect Hermes-as-orchestrator, removed services, and Kimi-only routing; append a deprecation notice to `TODO.md` or delete it.

---

## Sources

- `DEVELOPMENT_PLAN.md` — v3.0 refactor plan, assessment results §12–13 (2026-04-28)
- `MOLTSTACK_IMPLEMENTATION_PLAN.md` — Noesis long-form integration plan (2026-02-10)
- `TODO.md` — Action Queue Service implementation tracker (2026-02-13)
- `.env.example` — Environment configuration template (669 lines)
- `AGENTS.md` — Architecture & council governance documentation (v2.7)
- `.analysis-reports/tech-debt-report.md` — Prior assessment (2026-04-28)

---

**RECOMMENDATION**: Do not start Phase 2+ feature work until `philosophers.py` is implemented and `docker-compose.yml` is cleaned. The current state is a brittle skeleton: it compiles but cannot execute the primary council workflow.

**RISKS**:
- Refactor stall: With ~25 % completion and four core modules missing, the system cannot fulfill its primary function (council governance + daily polemic).
- Configuration drift: Stale env vars and dead service references in docker-compose will cause deployment failures or silent security exposures.
- Knowledge loss: Documentation still describes the pre-refactor architecture, making onboarding and maintenance error-prone.
- Secret leakage: Hard-coded weak defaults in `.env.example` may be copied directly into production environments.
