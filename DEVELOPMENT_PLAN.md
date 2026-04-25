# Moltbot Philosopher Council Refactor Plan
## Hermes as Orchestrator — v3.0 Architecture

**Date**: 2026-04-24
**Scope**: Complete refactor of moltbot-philosopher to make Hermes the central orchestrator, manager, and proxy for the philosopher council.
**Goal**: Dramatically simplify the codebase by stripping everything except philosopher Docker containers and the Noosphere memory substrate. Hermes handles cron scheduling, philosopher queries, content generation, and Moltbook posting.

---

## 1. Executive Summary

The current architecture has 23 services, 142 scripts, and a complex microservice mesh that duplicates capabilities Hermes already provides. This refactor collapses that complexity:

- **Hermes becomes the orchestrator**: cron scheduling, event polling, council governance, engagement logic, and Moltbook posting all move into Hermes-native workflows.
- **Only containers remain**: 9 philosopher agents + PostgreSQL/pgvector (Noosphere) + noosphere-service API.
- **Venice.ai is eliminated**: All AI traffic routes through the Kimi API (using the existing `KIMI_API_KEY`).
- **Proxy layer removed**: Hermes calls Moltbook directly via a lightweight Python SDK adapter.

---

## 2. Current State Audit Summary

### 2.1 Services Audit (23 total)

| Verdict | Count | Services |
|---------|-------|----------|
| **KEEP** | 8 | `council-service`, `eastern-bridge-service`, `islamic-mystic-philosopher-service`, `noosphere`, `noosphere-service`, `shared`, `moltbook-sdk`, `config` |
| **STRIP** | 12 | `action-queue`, `agent-orchestrator`, `ai-content-generator`, `discovery-service`, `engagement-service`, `event-listener`, `intelligent-proxy`, `model-router`, `moltbook-client`, `moltbook-sdk-adapter`, `ntfy-publisher`, `test-service` |
| **MAYBE** | 3 | `moltstack-service`, `thread-monitor`, `verification-service` |

### 2.2 Scripts Audit (50 most important)

| Verdict | Count | Examples |
|---------|-------|----------|
| **KEEP** | 11 | `daily-polemic-personas.sh`, `moltbook-api-wrapper.sh`, `moltbook-cli.sh`, `moltbook-diagnose.sh`, `archive-thread.sh`, `engagement-stats.sh`, `check-engagement-health.sh`, `trigger-engagement-cycle.sh`, `setup-cron-jobs.sh`, `validate-cron-setup.sh`, `dm-monitor.sh` |
| **ABSORB** | 30 | `convene-council.sh`, `synthesize-council-treatise.sh`, `daily-polemic-queue.sh`, `daily-polemic-heartbeat.sh`, `check-mentions-v2.sh`, `check-comments-v2.sh`, `thread-monitor.sh`, `noosphere-scheduler.sh` |
| **STRIP** | 9 | `daily-polemic.sh`, `check-comments.sh`, `check-mentions.sh`, `follow-molty.sh`, `reply-to-mention.sh`, `comment-on-post.sh`, `generate-post-ai.sh`, `generate-post.sh`, `council-thread-reply.sh` |

### 2.3 Infrastructure Audit

- **9 philosopher containers** extending a common Dockerfile (production target)
- **PostgreSQL/pgvector** (`pgvector/pgvector:pg16`) as Noosphere v3.0 substrate
- **External Docker network**: `dokploy-network`
- **Root Dockerfile**: Ubuntu 24.04 base, Node.js + Python3 runtime, `agent` user (UID 1001)

### 2.4 Moltbook Posting Audit

- **Auth**: `Authorization: Bearer <MOLTBOOK_API_KEY>` (key must start with `moltbook_`)
- **Endpoints**: `POST /posts`, `POST /posts/:id/comments`, `POST /posts/:id/upvote`
- **SDK adapter** has retry logic (3 retries, exponential backoff, 429-aware); monolithic client has none.
- **Rate limits tracked** via `X-RateLimit-*` headers.

---

## 3. Target Architecture (v3.0)

```
┌─────────────────────────────────────────────────────────────┐
│                        HERMES (You)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Scheduler  │  │   Council   │  │   Moltbook Proxy    │ │
│  │  (cron)     │  │  Governance │  │   (post/comment)    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────────┴──────────┐ │
│  │  Kimi API   │  │  Philosopher│  │   Noosphere API     │ │
│  │  (content)  │  │   Queries   │  │   (memory r/w)      │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────────┘ │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────┴──────┐  ┌──────┴──────┐  ┌─────┴──────┐
   │  Classical  │  │ Existential │  │   Joyce    │
   │ Philosopher │  │ Philosopher │  │  Stream    │
   └─────────────┘  └─────────────┘  └────────────┘
          │                │                │
   ┌──────┴──────┐  ┌──────┴──────┐  ┌─────┴──────┐
   │Enlightenment│  │Beat Gen     │  │Cyberpunk   │
   │ Philosopher │  │ Philosopher │  │Posthumanist│
   └─────────────┘  └─────────────┘  └────────────┘
          │                │                │
   ┌──────┴──────┐  ┌──────┴──────┐  ┌─────┴──────────┐
   │ Satirist    │  │ Scientist   │  │Eastern Bridge  │
   │ Absurdist   │  │ Empiricist  │  │(+ Islamic Mystic│
   └─────────────┘  └─────────────┘  │ if deployed)    │
                                      └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │  PostgreSQL │
                    │  + pgvector │
                    │ (Noosphere) │
                    └─────────────┘
```

### 3.1 What Stays

| Component | Reason |
|-----------|--------|
| 9 philosopher containers | Core personas; simplified to remove auto-welcome/mention detection |
| `postgres` (pgvector) | Noosphere v3.0 memory substrate |
| `noosphere-service` | Node.js API fronting PostgreSQL for memory r/w |
| `shared` / `moltbook-sdk` | TypeScript types reused by noosphere-service |
| `config/` | Agent env files and persona prompts |
| `workspace/` | Per-agent state and noosphere data |

### 3.2 What Goes

| Component | Reason |
|-----------|--------|
| `agent-orchestrator` | Replaced by Hermes |
| `ai-content-generator` | Hermes generates content via Kimi API directly |
| `model-router` | Single vendor (Kimi); no routing needed |
| `intelligent-proxy` | Hermes posts directly to Moltbook |
| `engagement-service` | Hermes manages engagement cycles |
| `event-listener` | Hermes polls Moltbook API |
| `action-queue` | Hermes schedules actions natively |
| `ntfy-publisher` | Hermes sends notifications if needed |
| `moltbook-client` / `moltbook-sdk-adapter` | Replaced by lightweight Python client in Hermes |
| `discovery-service` | Hermes discovers threads directly |
| `verification-service` | Deprecated; Moltbook verification handled inline |

### 3.3 What Becomes Optional / Sidecar

| Component | Plan |
|-----------|------|
| `moltstack-service` | Evaluate: fold weekly essay generation into Hermes content pipeline, or keep as thin sidecar |
| `thread-monitor` | Evaluate: fold thread continuation into Hermes scheduler, or keep as thin sidecar |
| `council-service` | Evaluate: keep as containerized governance API, or port core logic into Hermes `council.py` |

---

## 4. Hermes Orchestrator Layer (New)

Create `orchestrator/` at repo root. This is **not** a Docker service — it is a Python package Hermes imports and executes.

```
orchestrator/
├── __init__.py
├── config.py              # Loads config/hermes.yml + env vars
├── scheduler.py           # Cron definitions and event loop
├── council.py             # Council convening, voting, treatise synthesis
├── philosophers.py        # Query interface to philosopher containers
├── moltbook_client.py     # Lightweight Moltbook API client
├── content.py             # Content generation via Kimi API
├── engagement.py          # Engagement cycle logic (absorbed from scripts)
├── noosphere_client.py    # Memory read/write wrapper
├── rate_limiter.py        # Token-bucket + Moltbook rate limit tracking
└── models.py              # Pydantic models for type safety
```

### 4.1 `philosophers.py`

Each philosopher container exposes an HTTP API (or Hermes exec's into the container). Hermes queries them with a structured prompt and receives a JSON response.

```python
class PhilosopherClient:
    def query(self, persona: str, prompt: str, context: dict) -> str:
        """Send prompt to philosopher container, return response."""
```

### 4.2 `moltbook_client.py`

Python port of the SDK adapter logic with retry, rate-limit tracking, and Bearer auth.

```python
class MoltbookClient:
    def create_post(self, submolt: str, title: str, content: str) -> dict: ...
    def add_comment(self, post_id: str, content: str, parent_id: str = None) -> dict: ...
    def upvote_post(self, post_id: str) -> dict: ...
```

### 4.3 `scheduler.py`

Machine-readable cron schedule. Hermes reads this and uses its `cronjob` tool or `todo` list to manage execution.

```yaml
# config/hermes-schedule.yml
jobs:
  - name: daily-polemic
    cron: "0 9 * * *"
    action: content.generate_daily_polemic

  - name: council-convene
    cron: "0 0 */5 * *"
    action: council.convene_iteration

  - name: engagement-cycle
    cron: "*/5 * * * *"
    action: engagement.run_cycle

  - name: mention-check
    cron: "*/10 * * * *"
    action: engagement.check_mentions

  - name: noosphere-consolidation
    cron: "0 2 * * *"
    action: noosphere.consolidate_daily
```

### 4.4 `content.py`

All content generation routes through Kimi API using the existing `KIMI_API_KEY`.

```python
class ContentGenerator:
    def generate_daily_polemic(self, persona: str, topic: str) -> str:
        # Calls kimi API with persona prompt + topic
        ...
```

---

## 5. API Migration: Venice → Kimi

### 5.1 Current State

| Use Case | Current Model | New Model |
|----------|---------------|-----------|
| Default / cheap work | `venice/deepseek-v3.2` | `kimi-k2.5-instant` |
| Premium / long context | `venice/openai-gpt-52` | `kimi-k2.5-thinking` |
| Deep reasoning | `kimi-k2.5-thinking` | `kimi-k2.5-thinking` (keep) |
| Fast follow-ups | `kimi-k2.5-instant` | `kimi-k2.5-instant` (keep) |

### 5.2 Changes Required

1. **Remove from docker-compose.yml**:
   - `VENICE_API_KEY`
   - `VENICE_DEFAULT_MODEL`
   - `VENICE_PREMIUM_MODEL`

2. **Update philosopher env files** (`config/agents/*.env`):
   - Replace any Venice-specific variables with Kimi equivalents.
   - Set `DEFAULT_MODEL=kimi-k2.5-instant` and `PREMIUM_MODEL=kimi-k2.5-thinking`.

3. **Delete `config/model-routing.yml`** or simplify to a single Kimi routing table.

4. **Update `orchestrator/content.py`** to call Kimi API exclusively.

---

## 6. Docker Compose Simplification

### 6.1 Target docker-compose.yml

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: noosphere-postgres
    mem_limit: 2g
    cpus: '1.0'
    environment:
      POSTGRES_DB: noosphere
      POSTGRES_USER: noosphere_admin
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme_noosphere_2026}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data:rw
      - ./scripts/db/init-noosphere-v3.sql:/docker-entrypoint-initdb.d/01-init-noosphere.sql:ro
      - ./scripts/db/init-action-queue.sql:/docker-entrypoint-initdb.d/02-init-action-queue.sql:ro
    networks:
      - dokploy-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U noosphere_admin -d noosphere"]
      interval: 30s
      timeout: 10s
      retries: 3

  noosphere-service:
    build:
      context: ./services/noosphere-service
      dockerfile: Dockerfile
    container_name: noosphere-service
    ports:
      - "3006:3006"
    environment:
      - DATABASE_URL=postgresql://noosphere_admin:${POSTGRES_PASSWORD}@postgres:5432/noosphere
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - dokploy-network
    restart: unless-stopped

  classical-philosopher:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    image: moltbot:classical
    container_name: classical-philosopher
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    pids_limit: 512
    mem_limit: 4g
    cpus: '2.0'
    environment:
      - AGENT_NAME=ClassicalPhilosopher
      - AGENT_TYPE=classical
      - MAX_TOKENS=16384
      - CLAW_SYSTEM_PROMPT_FILE=/app/config/prompts/classical.txt
      - DEFAULT_MODEL=kimi-k2.5-instant
      - PREMIUM_MODEL=kimi-k2.5-thinking
      - MOLTBOOK_API_KEY=${MOLTBOOK_API_KEY}
      - NOOSPHERE_STATE_DIR=/workspace/classical/noosphere
    env_file:
      - config/agents/classical-philosopher.env
    volumes:
      - ./workspace/classical:/workspace:rw
      - ./config:/app/config:ro
      - ./skills:/app/skills:ro
    networks:
      - dokploy-network
    restart: unless-stopped

  # ... remaining 8 philosophers follow same pattern, extending classical-philosopher
  # existentialist, transcendentalist, joyce-stream, enlightenment,
  # beat-generation, cyberpunk-posthumanist, satirist-absurdist, scientist-empiricist

networks:
  dokploy-network:
    external: true
```

### 6.2 Key Simplifications

- Remove `egress-proxy`, `ntfy-publisher` from `depends_on`
- Remove `AI_GENERATOR_SERVICE_URL`, `ENABLE_AUTO_WELCOME`, `ENABLE_MENTION_DETECTION` from env (Hermes handles these)
- Remove Venice variables
- Remove `scripts/` and `logs` volume mounts from philosopher containers (they no longer run scripts)
- Keep `skills/` and `config/` as read-only

---

## 7. Implementation Phases

### Phase 0: Foundation (Week 1)

- [ ] Create `orchestrator/` package skeleton with `models.py`, `config.py`
- [ ] Implement `moltbook_client.py` with retry, rate-limit tracking, and Bearer auth
- [ ] Implement `noosphere_client.py` wrapping the noosphere-service API
- [ ] Write tests for both clients (`pytest`)
- [ ] Create `config/hermes-schedule.yml` with all cron jobs
- [ ] Create `config/hermes.yml` for orchestrator configuration

### Phase 1: Strip & Simplify (Week 1–2)

- [ ] Delete 12 STRIP services from `services/` (keep git history via `git rm`)
- [ ] Delete 9 STRIP scripts from `scripts/`
- [ ] Simplify `docker-compose.yml` to target architecture
- [ ] Remove Venice references from all env files and configs
- [ ] Update `Dockerfile` to remove proxy dependencies and unused packages
- [ ] Verify `docker compose config` passes validation
- [ ] Run `docker compose up postgres noosphere-service` and confirm health

### Phase 2: Port Core Logic (Week 2–3)

- [ ] Port `convene-council.sh` → `orchestrator/council.py::convene_iteration()`
- [ ] Port `synthesize-council-treatise.sh` → `orchestrator/council.py::synthesize_treatise()`
- [ ] Port `daily-polemic-queue.sh` → `orchestrator/content.py::generate_daily_polemic()`
- [ ] Port `check-mentions-v2.sh` / `check-comments-v2.sh` → `orchestrator/engagement.py`
- [ ] Port `discover-relevant-threads.sh` → `orchestrator/engagement.py::discover_threads()`
- [ ] Port `thread-monitor.sh` → `orchestrator/engagement.py::monitor_threads()`
- [ ] Port `noosphere-scheduler.sh` → `orchestrator/noosphere_client.py::consolidate()`

### Phase 3: Philosopher Query Interface (Week 3)

- [ ] Design and implement `philosophers.py` query API
- [ ] Ensure each philosopher container exposes a lightweight HTTP endpoint (or use `docker exec`)
- [ ] Test querying all 9 philosophers with sample prompts
- [ ] Implement response parsing and error handling
- [ ] Benchmark query latency (target <5s per philosopher)

### Phase 4: Integration & End-to-End Testing (Week 3–4)

- [ ] End-to-end test: Hermes convenes council → queries philosophers → synthesizes treatise → posts to Moltbook
- [ ] End-to-end test: Daily polemic generation and posting
- [ ] End-to-end test: Engagement cycle (mentions, comments, follows)
- [ ] Verify rate limits are respected
- [ ] Verify Noosphere memory writes/reads function
- [ ] Run 24-hour burn-in test on staging

### Phase 5: Cleanup & Documentation (Week 4)

- [ ] Update `README.md` with new architecture diagram
- [ ] Update `AGENTS.md` to reflect Hermes-as-orchestrator role
- [ ] Delete deprecated docs referencing stripped services
- [ ] Archive old `DEVELOPMENT_PLAN.md` as `DEVELOPMENT_PLAN.v2.md`
- [ ] Write `orchestrator/README.md` with developer setup
- [ ] Commit all changes with clear git history

---

## 8. Configuration Changes

### 8.1 Required Environment Variables

```bash
# Kimi (already present)
KIMI_API_KEY=***
KIMI_REASONING_MODEL=kimi-k2.5-thinking
KIMI_FAST_MODEL=kimi-k2.5-instant

# Moltbook (already present)
MOLTBOOK_API_KEY=moltbook_***

# Noosphere (already present)
POSTGRES_PASSWORD=***
NOOSPHERE_DATABASE_URL=postgresql://noosphere_admin:***@postgres:5432/noosphere

# Hermes (new)
HERMES_CONFIG_PATH=./config/hermes.yml
HERMES_SCHEDULE_PATH=./config/hermes-schedule.yml
HERMES_LOG_LEVEL=INFO
```

### 8.2 Deleted Environment Variables

```bash
# Venice — remove entirely
VENICE_API_KEY
VENICE_DEFAULT_MODEL
VENICE_PREMIUM_MODEL

# Proxy — remove entirely
HTTPS_PROXY
HTTP_PROXY

# Service URLs — remove (Hermes calls directly)
AI_GENERATOR_SERVICE_URL
VERIFICATION_SERVICE_URL
```

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Philosopher containers rely on removed services (proxy, ntfy) | High | Audit each container's entrypoint before stripping; provide stub health endpoints |
| Moltbook rate limits exceeded during transition | Medium | Start with `dry_run: true` in `hermes.yml`; validate all posts before live execution |
| Council governance logic lost in translation | Medium | Port `council-service` core logic line-by-line; keep original service as backup for 1 week |
| Noosphere-service API changes | Low | Freeze noosphere-service version; write integration tests |
| Kimi API downtime | Low | Implement 3-retry exponential backoff; queue failed actions for retry |
| Hermes context window overflow | Medium | Summarize philosopher responses before synthesis; use MemPalace for long-term council history |

---

## 10. Rollback Plan

1. **Tag the pre-refactor commit**: `git tag v2.7-pre-hermes-orchestrator`
2. **Branch protection**: Do all work on `refactor/hermes-orchestrator` branch
3. **Service backup**: Before `git rm`, move deprecated services to `archive/services/`
4. **Database backup**: `pg_dump` before any schema changes
5. **Quick rollback**: If production fails, `git checkout v2.7-pre-hermes-orchestrator && docker compose up`

---

## 11. Success Criteria

- [ ] `docker compose up` starts only postgres, noosphere-service, and 9 philosophers
- [ ] Hermes can query every philosopher and receive a response within 5 seconds
- [ ] Hermes can post to Moltbook on behalf of any philosopher
- [ ] Daily polemic runs autonomously via Hermes scheduler
- [ ] Council convenes every 5 days and publishes a treatise
- [ ] No Venice API calls are made (verify via network inspection)
- [ ] All engagement actions respect Moltbook rate limits
- [ ] Noosphere memory reads/writes function correctly
- [ ] Codebase is <50% of current size (target: ~15 services → 3, ~142 scripts → ~60)

---

## 12. Appendix: Audit Artifacts

The following files were generated during planning and are preserved in `.refactor/`:

- `.refactor/services-audit.md` — Service classification (KEEP/STRIP/MAYBE)
- `.refactor/scripts-audit.md` — Script classification (KEEP/ABSORB/STRIP)
- `.refactor/infrastructure-audit.md` — Docker Compose and Dockerfile analysis
- `.refactor/moltbook-posting-audit.md` — Moltbook API client analysis
