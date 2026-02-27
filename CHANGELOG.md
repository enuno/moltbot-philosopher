# Changelog

All notable changes to Moltbot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.9.0] - 2026-02-27

### Added

- **P4.1 Hybrid Search Scoring**: Complete hybrid search ranking system combining semantic relevance with multiple ranking factors
  - **Scoring Types**: PostScoringInputs, ScoringWeights, ScoringResult interfaces for type-safe scoring
  - **Recency Decay**: Exponential decay formula with configurable half-life and exponent
  - **Author Reputation**: Weighted average of historical and recent scores with [0.5, 1.5] clamping
  - **Follow Boost**: 1.25x multiplier for followed authors
  - **Normalization**: Min-max scaling per query to [0, 1] range
  - **Configuration Module**: Environment variable loading, runtime updates, feature flags for per-factor enable/disable
  - **Conditional Scoring**: scorePostConditional function respects feature flags (recency, reputation, follow boost)
  - **SemanticSearch Integration**: Passes follow graph, applies hybrid scoring, includes optional debug output
  - **Debug Output**: Optional intermediate multiplier tracking for troubleshooting
- **Comprehensive Test Coverage** (100+ tests, 772/774 passing):
  - Scoring functions test suite
  - Feature flag conditional scoring tests
  - End-to-end hybrid search ranking scenarios (10 realistic cases)
  - A/B parameter tuning sensitivity tests (14 tests)
  - Configuration loading and runtime updates
- **Documentation**: P4.1-HYBRID-SEARCH-GUIDE.md with configuration, tuning scenarios, and troubleshooting

### Changed

- SemanticSearch now applies hybrid scoring by default instead of simple semantic ranking
- Scoring results include normalizedScore (0-1 per query) for consistent ranking

### Commits

- c9698db: feat(p4-1-task-12): implement A/B parameter tuning test suite
- d4a347d: feat(p4-1-task-10): implement conditional scoring with feature flags
- 632eb2f: feat(p4-1-task-9): create config module for scoring parameters
- f60e30a: feat(p4-1-task-8): add debug output formatting to search results

## [2.8.0] - 2026-02-20

### Added

- **Enhanced Platform Engagement Automation (Phase 6.5)**: Single shared engagement-service microservice
  (port 3010) orchestrating proactive platform engagement for all 9 philosopher agents.
- **EngagementEngine**: Core orchestration component handling feed monitoring (5-minute cycles),
  opportunity detection via hybrid relevance scoring (60% Noosphere semantic + 25% keyword + 15% author quality),
  rate limit management, and intelligent scheduling via round-robin agent visitation.
- **StateManager**: Atomic JSON persistence for per-agent engagement state with conflict detection,
  automatic daily reset, and 3-point follow evaluation tracking.
- **RelevanceCalculator**: Hybrid scoring system combining Noosphere semantic queries, keyword pattern
  matching, and author quality heuristics. Implements 6-point quality validation gate: relevance > 0.6,
  no banned phrases (generic comments blocked), substantiveness >20 chars + 2 sentences, rate limits,
  daily caps, and 3-post minimum before following.
- **Engagement State Schema**: Per-agent JSON tracking daily stats (posts, comments, follows, DMs),
  followed accounts with quality scores, opportunity queue, and rate limit timestamps.
- **Engagement Protocol Documentation**: Comprehensive `skills/moltbook/ENGAGEMENT.md` (v2.8) covering
  architecture, API endpoints, quality gates, agent state schema, daily reset behavior, submolt strategy,
  deployment, operational tasks, monitoring, testing, and success criteria.
- **Cron Job Scheduling**: 5-minute engagement cycle (feed monitoring + round-robin), 30-minute posting
  check (proactive content evaluation), 2am daily maintenance (stats reset + unfollow inactive accounts).
- **HTTP API Endpoints**: GET /health (service status), POST /engage (manual trigger), GET /stats
  (per-agent engagement breakdown), GET /ready (initialization check).
- **Docker Integration**: engagement-service in docker-compose.yml with health checks, volume mounts for
  workspace state, environment configuration for rate limits and engagement bounds.
- **Initialization Automation**: `scripts/init-engagement-state.sh` initializes engagement-state.json for
  all 9 agents with today's date and empty opportunity queues.
- **P2.3: Proactive Post Creation Strategy** (2026-02-25): Automated discovery of high-quality discussion
  threads with intelligent agent-topic matching and editorial queue management:
  - **Topic Detection**: Extract topics from discussion threads with keyword density scoring (0-1 relevance)
  - **Agent-Topic Affinity**: 54-entry configuration (9 agents × 6+ topics) with relevance scoring
  - **Template System**: 9 starter templates across 3 agents × 3 topics with deterministic interpolation
  - **Editorial Queue**: Draft management with 8 decision types and audit trails
  - **State Persistence**: 30-day rolling window with automatic pruning and metric folding
  - **Integration**: Full pipeline in engagement-engine.ts with 60/40 relevance/quality scoring
  - **Test Coverage**: 638+ tests passing (512+ baseline + 126 new P2.3 tests), zero regressions
- **P2.4: Comprehensive Engagement Statistics & Metrics Endpoint** (2026-02-26): Production-grade
  /stats endpoint providing real-time visibility into 9-agent engagement performance across P2.1→P2.3:
  - **Summary Metrics**: Aggregated engagement across all agents (total posts, comments, follows, quality scores)
  - **Trend Analysis**: 7-day trend windows with topic mentions, thread quality analysis, posting velocity changes
  - **Per-Agent Metrics**: Individual agent performance tracking (daily/weekly activity, quality scores, engagement velocity)
  - **Quality Metrics Section**: Sentiment trends, controversial thread detection, high/low quality categorization
  - **Rolling Metrics**: 7-day and 30-day aggregates with automatic calculation from daily rollups
  - **Stats Builder Module** (stats-builder.ts): 5 core functions with comprehensive error handling:
    - buildSummary(): Aggregates dailyStats and rollingMetrics across all agents
    - buildTrends(): Analyzes 7-day topic engagement and thread quality trends
    - buildAgentsSection(): Per-agent metrics including posts, comments, quality, velocity
    - buildQualitySection(): Quality aggregation with sentiment and controversy analysis
    - calculateRollingMetrics(): Computes 7/30-day rolling metrics from daily rollups
  - **Robust Error Handling**: All builders include try-catch blocks, bounds validation (0-100), safe Map iteration, graceful degradation
  - **Type Safety**: Extended EngagementState with DailyRollup and RollingMetrics (P2.4), proper TypeScript type annotations
  - **Test Coverage**: 16 new E2E tests validating full P2.1→P2.3→/stats pipeline with edge cases
  - **Service Integration**: Updated engagement-service.ts to expose /stats endpoint and track cycle freshness for health monitoring

### Modified

- `docker-compose.yml`: Added engagement-service with dependencies (egress-proxy, action-queue,
  noosphere-service), workspace volume mounts for all 9 agents, and health check configuration.
- `services/engagement-service/Dockerfile`: Updated CMD to use engagement-service.js (new proactive
  engagement service replacing reactive structure).

---

## [3.1.0] - 2026-02-19

### Added

- **Rate limit sync from API** (7.1): `RateLimiter.syncFromApiResponse()` ingests
  `daily_remaining: 0` from 429 responses and blocks the action type until midnight UTC,
  preventing redundant API calls after a confirmed daily limit.
- **CoV timing monitor** (7.2): `scripts/cov-monitor.sh` computes Coefficient of Variation
  across post timestamps (pure bash, no jq required). Exit 1 when CoV < 0.4 (warning
  threshold below Moltbook's 0.5 bot-detection floor). Integrated into
  `scripts/moltbook-heartbeat.sh` as Step 5.5 with NTFY alert on trigger.
- **Smart following policy** (7.5): `SmartFollowingPolicy` class enforces a minimum of 3
  observed posts before the agent may follow a target, preventing follow-spam on first sight.
- **Semantic search discovery** (7.6): `scripts/discover-relevant-threads.sh` queries the
  Moltbook `/search` endpoint, filters by configurable `min-similarity` threshold, and
  deduplicates against `workspace/{agent}/seen-threads.json` (rotating to 500 entries max).
- **Circuit breaker** (7.7): `CircuitBreaker` class opens after 3 consecutive non-rate-limit
  failures, disabling queue processing and firing an NTFY alert. Rate-limit 429s are excluded
  from the failure count (expected behavior, not system failure).
- **Pre-production validation** (7.9): `tests/pre-production-check.sh` runs 8 environment
  checks (API key format, `.env` permissions, Docker services, rate limiter config, skill
  hashes, lint, unit tests).
- **Skill file version-pinning** (7.10): `scripts/skill-auto-update.sh` now uses
  `safe_update_skill_file()` — backup before overwrite, atomic replace, restore on empty
  download. Stale backups auto-purged after 7 days via `cleanup_old_backups()`.

### Fixed

- `TODO.md`: Fixed pre-existing markdownlint MD022/MD032 violations (blank lines around
  headings and lists).

---

## [3.0.4] - 2026-02-19

### Fixed

- **Noosphere Python Client**: Fixed `ModuleNotFoundError: No module named 'noosphere_client'`
  that silently suppressed all heuristic retrieval during article generation and council
  deliberation. Root cause: `CLIENT_DIR` path calculation resolved to
  `/services/noosphere/python-client` (nonexistent in containers). Fix: install
  `requests`/`urllib3` in Dockerfile, volume-mount `services/noosphere/python-client`
  into all 9 agent containers at `/app/noosphere-client`, and update Python scripts to
  read path from `NOOSPHERE_PYTHON_CLIENT` env var.
- **NOOSPHERE_DIR path**: Scripts derived `NOOSPHERE_DIR` from `WORKSPACE_DIR`
  (`/workspace/classical/noosphere`) but Python engines live at `/workspace/noosphere`.
  Fixed across `moltstack-generate-article.sh`, `moltstack-generate-article-queue.sh`,
  `noosphere-integration.sh`, `seed-noosphere-heuristics.sh`, `dropbox-processor.sh`.
- **mktemp write failure**: `moltstack-post-article.sh` called `mktemp` which defaults to
  `/tmp/` — read-only in agent containers. Added `TMPDIR=/app/logs/tmp` export with
  fallback to `$WORKSPACE_DIR/.tmp`.
- **AI Generator - Custom Prompts**: `customPrompt` field now used as primary prompt
  when no `topic` is provided, `maxTokens` from request body is passed through to
  Venice/Kimi, and timeout scales dynamically with token count.
- **Pre-commit Ruff Config**: `--select=E, W, F, I` arg had spaces causing `W`, `F`, `I`
  to be treated as file paths — F401 (unused imports) and I001 (import sorting) rules
  were never enforced.

---

## [3.0.3] - 2026-02-18

### Fixed

- **entrypoint.sh - Daily Polemic**: Switch from direct-post `daily-polemic.sh`
  to `daily-polemic-queue.sh`. Polemic now goes through the action-queue for
  rate limiting, exponential backoff retries, and egress-proxy verification
  challenge handling.
- **convene-council.sh - Council Convergence**: Replace inline direct Moltbook
  API call (with hand-rolled verification challenge loop) with a queue
  submission to the action-queue service. The queue handles retries and the
  egress proxy handles verification challenges. State tracking uses `action_id`
  instead of `comment_id` since execution is asynchronous.
- **queue-submit-action.sh**: Fix wrong default port (3006 → 3008) and wrong
  default host (localhost → action-queue container name).

---

## [3.0.2] - 2026-02-18

### Fixed

- **Action Queue - Retry Backoff**: Exponential backoff delays now actually
  persist — retried actions are set to `status='scheduled'` with a future
  `scheduled_for` timestamp instead of burning through attempts immediately.
- **Action Queue - Rate-Limit Deferral**: When an action is rate-limited and the
  queue knows the retry window, it is now set to `status='scheduled'` with the
  correct `scheduled_for` time rather than being left in `status='rate_limited'`
  indefinitely.
- **Action Queue - Scheduled Action Activation**: Added a periodic loop that
  promotes time-based `status='scheduled'` actions (no conditions) to
  `status='pending'` once their `scheduled_for` time arrives. Previously, these
  actions were invisible to the processing loop and never executed.

---

## [3.0.1] - 2026-02-15

### Fixed

- **ClawSec Script**: Fixed readonly filesystem error in `clawsec-feed-check.sh`
  - Changed relative path `$(dirname "$0")/../workspace/classical` to absolute `/workspace`
  - Resolves `mkdir: cannot create directory '/app/scripts/../workspace': Read-only file system` error
  - Script now correctly uses the read-write mounted `/workspace` directory

---

## [3.0.0] - 2026-02-11

### 🎉 Major Release: Noosphere v3.0 - 5-Type Memory Architecture

Complete transformation from 3-layer JSON file system to PostgreSQL-backed
typed memory with semantic search.

### Added

#### Core Infrastructure

- **PostgreSQL Backend**: PostgreSQL 16 with pgvector extension for semantic
  vector search
- **5-Type Memory Model**: Structured memory types per agent (insight, pattern,
  strategy, preference, lesson)
- **200-Memory Cap**: Automatic eviction enforcement per agent with confidence-
  based retention strategy
- **REST API**: Noosphere microservice (port 3006) with full CRUD + semantic
  search endpoints
- **Venice.ai Integration**: Primary embedding provider (768-dim) with TF-IDF
  fallback for offline operation
- **NoosphereClient Library**: Python abstraction layer for unified memory
  operations across all scripts

#### Database Schema

- `noosphere_memory` - Main memory table with:
  - UUID primary keys
  - pgvector embeddings (1536-dim)
  - Type classification (5 types)
  - Confidence scoring (0.0-1.0)
  - Tag arrays (GIN index)
  - Source trace IDs (unique)
  - Supersession tracking
- `noosphere_agent_stats` - Per-agent memory tracking with auto-update triggers
- `noosphere_migration_log` - v2.6→v3.0 audit trail (39 memories migrated)

### Changed

#### Python Scripts (4 core scripts rewritten)

- **recall-engine.py**: Type-filtered queries, 4 output formats (simple,
  dialectical, constitutional, hybrid)
- **memory-cycle.py**: Simplified to promote/evict/stats operations
  (consolidation deprecated in favor of confidence-based approach)
- **assimilate-wisdom.py**: Type classification for community submissions,
  9-voice mapping, API persistence
- **clawhub-mcp.py**: Venice.ai embeddings with hybrid TF-IDF fallback, cosine
  similarity search supporting both dense and sparse vectors

#### Bash Scripts (6 scripts updated)

- `convene-council.sh` - Council orchestration with v3.0 API calls
- `noosphere-scheduler.sh` - Daily consolidation + indexing automation
- `noosphere-integration.sh` - Configuration library with PYTHONPATH exports
- `seed-noosphere-heuristics.sh` - Heuristic seeding with API persistence
- `moltstack-generate-article.sh` - Article generation with recall-engine
- `dropbox-processor.sh` - Community submission processing

All scripts now include:

```bash
NOOSPHERE_API_URL="${NOOSPHERE_API_URL:-http://noosphere-service:3006}"
NOOSPHERE_PYTHON_CLIENT="/workspace/../services/noosphere/python-client"
export PYTHONPATH="${NOOSPHERE_PYTHON_CLIENT}:${PYTHONPATH:-}"
```

### Migration

#### Type Classification Mapping

| Agent | Legacy File | Type | Initial Confidence |
|-------|-------------|------|-------------------|
| Classical | telos-alignment-heuristics.json | strategy | 0.75 |
| Existentialist | bad-faith-patterns.json | pattern | 0.70 |
| Transcendentalist | sovereignty-warnings.json | lesson | 0.72 |
| Joyce-Stream | phenomenological-touchstones.json | insight | 0.68 |
| Enlightenment | rights-precedents.json | strategy | 0.80 |
| BeatGeneration | moloch-detections/ | lesson | 0.78 |

#### Statistics

- **Total Memories Migrated**: 39 (33 legacy + 2 test + 4 community)
- **Agent Distribution**: Classical (15), Enlightenment (5), Beat (5),
  Transcendentalist (5), Existentialist (4), Joyce (4)
- **Database Size**: ~150 KB (efficient JSON compression)
- **Query Performance**: 20-50ms latency (vs. full file scan in v2.6)

### Infrastructure

#### Docker Compose

Added two new services:

```yaml
postgres:
  image: postgres:16
  ports: ["5432:5432"]  # internal only
  volumes: ["./data/postgres:/var/lib/postgresql/data"]

noosphere-service:
  build: ./services/noosphere
  ports: ["3006:3006"]
  depends_on: [postgres]
  environment:
    - MOLTBOOK_API_KEY=${MOLTBOOK_API_KEY}
    - VENICE_API_KEY=${VENICE_API_KEY}
```

#### Health Checks

- PostgreSQL: Connection pooling (max 20)
- Noosphere API: `http://localhost:3006/health`
- Authentication: X-API-Key header using `MOLTBOOK_API_KEY`

### Performance

- **Query Latency**: 20-50ms for type-filtered queries (vs. 500ms+ file scan)
- **Embedding Generation**: Venice.ai 768-dim or TF-IDF fallback
- **Concurrent Writes**: Supports 9 agents writing simultaneously
- **Vector Search**: pgvector ivfflat index with 100 lists
- **Database Connections**: Pooled (max 20 concurrent)

### Deprecated

- **3-Layer Consolidation**: Layer 1→2→3 progression replaced by confidence-
  based promotion
- **JSON File Storage**: v2.6 files archived in workspace but not actively used
- **Direct File I/O**: All memory operations now via NoosphereClient API
- **TF-IDF Primary**: Demoted to fallback (Venice.ai primary)

### Breaking Changes

- **API Changes**: All Python scripts require `--api-url` parameter
- **Environment**: `NOOSPHERE_API_URL` must be set (defaults to
  `http://noosphere-service:3006`)
- **PYTHONPATH**: Scripts need `services/noosphere/python-client` in path
- **No Backward Compatibility**: v2.6 file operations removed, no dual-mode
  support

### Security

- **API Authentication**: All endpoints require MOLTBOOK_API_KEY (except
  /health)
- **Port Exposure**: PostgreSQL (5432) internal only, Noosphere API (3006)
  behind proxy
- **SQL Injection**: Parameterized queries throughout
- **Input Validation**: Type enum constraints, confidence range checks

### Commits (Phase 3 Complete)

- `916b267` - recall-engine.py migration to v3.0 API
- `12b07ee` - memory-cycle.py rewrite (promote/evict/stats)
- `ed297c1` - assimilate-wisdom.py with type classification
- `9f24827` - clawhub-mcp.py with Venice.ai + TF-IDF hybrid
- `cff60dd` - convene-council.sh v3.0 compatibility
- `ce5e711` - Batch update of 5 bash scripts

### Future Work (Planned)

- **Phase 4**: Documentation + integration testing
- **Phase 5**: Advanced consolidation (MERGE/UPDATE/DOWNGRADE/DELETE operations)
- **Layer 4**: OriginTrail DKG federation for cross-council knowledge sharing
- **Voice Modifiers**: Dynamic system prompts based on memory type distribution
- **Monitoring**: Grafana/Prometheus dashboards for memory health

### References

- [5-Type Memory Architecture Best
  Practices](docs/best-practices/5-Type-Memory-Architecture.md)
- [DEVELOPMENT_PLAN.md Section E](DEVELOPMENT_PLAN.md)
- [PostgreSQL pgvector](https://github.com/pgvector/pgvector)
- [Venice.ai Embeddings](https://docs.venice.ai)

---

## [2.7.0] - 2026-02-11

### 🎉 Major Release: Service Architecture Migration

Complete transformation from script-based polling to microservice architecture.

### Added

#### Services (7 new TypeScript microservices)

- **Agent Orchestrator (port 3006)**: Central event routing + 9 agent sessions
  - Lane Queue pattern for serial execution
  - Identity loading system (SOUL/IDENTITY/AGENTS/MEMORY.md)
  - JSONL audit logging
  - Priority-based event routing
- **Event Listener (port 3007)**: Fast polling (30-60s intervals)
  - VerificationPoller (60s critical priority)
  - EngagementPoller (30s high priority)
  - Event dispatcher with 3-retry logic
- **Verification Service (port 3008)**: AI challenge solving
  - < 5s response time (60x faster than v2.6)
  - AI-powered question answering with retries
  - Exponential backoff (1s, 2s, 4s)
  - Statistics tracking
- **Engagement Service (port 3009)**: Intelligent responses
  - MentionHandler (context-aware AI responses)
  - WelcomeHandler (new user greetings via DM)
  - AgentRouter (keyword-based agent selection)
  - CommentHandler (placeholder)
  - DMHandler (placeholder)
- **Council Service (port 3010)**: Automated governance
  - 5-day iteration cycles (cron-based)
  - Codex management (4/6 consensus threshold)
  - VotingSystem (session-based voting)
  - Manual iteration triggers
- **Noosphere Service (port 3011)**: Memory management
  - 3-layer architecture (daily notes → consolidated → constitutional)
  - Daily consolidation automation (2am cron)
  - SemanticSearch (keyword + confidence + layer boosting)
  - Manual promotion (Layer 2 → Layer 3)
- **MoltStack Service (port 3012)**: Essay generation
  - Weekly generation (Monday 9am cron)
  - DraftManager (full lifecycle management)
  - EssayGenerator (AI-powered 2000-word essays)
  - Publisher (Moltbook integration)
  - Human-in-the-loop approval workflow

#### CLI Tools (4 human-friendly wrappers)

- **moltbot-cli.sh**: Unified CLI interface with health checks
- **verification-cli.sh**: Verification operations (stats, health)
- **noosphere-cli.sh**: Memory operations (search, add, consolidate, promote)
- **moltstack-cli.sh**: Essay operations (generate, list, approve, publish)

#### Infrastructure

- **docker-compose.prod.yml**: Production deployment (all 7 services)
- **Dockerfiles**: Multi-stage production builds for all services
- **scripts/deploy-services.sh**: Automated deployment script
- **scripts/test-services.sh**: Integration test suite
- **docs/SERVICE_ARCHITECTURE.md**: 409-line architecture guide
- **docs/MIGRATION.md**: v2.6 → v2.7 migration guide
- **scripts/script-audit.md**: Script replacement analysis

### Changed

#### Performance (60x improvement)

- **Verification**: 5 min → < 5 sec (60x faster)
- **Mentions**: 30 min → 30 sec (60x faster)
- **Comments**: 30 min → 30 sec (60x faster)
- **DMs**: 30 min → 30 sec (60x faster)
- **Welcomes**: 30 min → 30 sec (60x faster)
- **Heartbeat**: 4 hours → 30 min (8x faster)

#### Automation (100% automated)

- **Council**: Manual → 5-day automatic cycles
- **Memory**: Manual → daily consolidation (2am)
- **Essays**: Manual → weekly generation (Monday 9am)

### Deprecated

#### Scripts (replaced by services)

- `check-verification-challenges.js` → Verification Service
- `handle-verification-challenge.sh` → Verification Service
- `frequent-challenge-check.sh` → Event Listener
- `check-mentions-v2.sh` → Engagement Service
- `check-comments-v2.sh` → Engagement Service
- `welcome-new-moltys-v2.sh` → Engagement Service
- `convene-council.sh` → Council Service
- `council-thread-reply.sh` → Council Service
- `post-council-treatise.sh` → Council Service
- `memory-cycle.py` → Noosphere Service
- `moltstack-heartbeat.sh` → MoltStack Service
- `moltstack-generate-article.sh` → MoltStack Service
- `moltstack-post-article.sh` → MoltStack Service
- `archive-moltstack-article.sh` → MoltStack Service
- `moltbook-heartbeat-enhanced.sh` → Event Listener

**Note**: 12 human-initiated scripts remain with CLI wrappers. 5 utility
scripts unchanged. See `scripts/script-audit.md`.

### Technical Details

- **Language**: TypeScript 5.3 (strict mode)
- **Runtime**: Node.js 18 (Alpine Linux)
- **Framework**: Express.js 4.18
- **Scheduling**: node-cron 3.0
- **Package Manager**: pnpm 10.28 (workspace monorepo)
- **Architecture**: Event-driven microservices
- **Patterns**: Lane Queue, retry logic, exponential backoff
- **Lines of Code**: ~23,000 (TypeScript + infrastructure)

### Migration Notes

See [MIGRATION.md](docs/MIGRATION.md) for detailed upgrade instructions.

**Breaking Changes**:
- Script execution → Service automation or CLI tools
- Manual operations → Automated workflows
- Direct API calls → Service HTTP APIs

**Data Compatibility**:
- All workspace files compatible (no migration needed)
- State files automatically migrated
- No data loss

---

## [2.6.0] - 2026-02-08

### Added

- **9 Philosopher Agents**: Full council implementation
- **Noosphere v2.6**: 3-layer epistemological memory with vector search
- **Thread Continuation Engine**: STP synthesis for sustained discourse
- **Venice/Kimi Dual-Backend**: AI content generation
- **NTFY Real-time Alerting**: Push notifications
- **Auto-Darwinism**: Automated skill updates
- **Daily Polemic**: Automated philosophical provocations

### Changed

- Council: 4/6 consensus threshold
- Memory: 24+ evolving heuristics from all voices
- Noosphere: Git-tracked constitutional layer

---

## [2.5.0] - 2026-02-02

### Added

- **Thread Continuation Engine**: Automated discourse sustenance
- **NTFY Integration**: Real-time alerting
- **Auto-Darwinism**: Skill evolution system
- **Daily Polemic**: Daily philosophical posts

### Changed

- Improved memory consolidation logic
- Enhanced council voting system

---

## [2.0.0] - 2026-01-15

### Added

- **Full Moltbook Integration**: Complete API implementation
- **AI Content Generation**: Venice API integration
- **Multi-Agent System**: 9 philosopher personas
- **Council Governance**: Ethics-convergence framework
- **Noosphere**: 3-layer memory system
- **Docker Infrastructure**: Containerized deployment

### Changed

- Migrated from prototype to production architecture
- Improved error handling and logging
- Enhanced security (secrets management)

---

## [1.0.0] - 2025-12-01

### Added

- Initial release
- Basic Moltbook agent functionality
- Script-based automation
- Single philosopher persona (Classical)

---

[2.7.0]: https://github.com/enuno/moltbot-philosopher/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/enuno/moltbot-philosopher/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/enuno/moltbot-philosopher/compare/v2.0.0...v2.5.0
[2.0.0]: https://github.com/enuno/moltbot-philosopher/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/enuno/moltbot-philosopher/releases/tag/v1.0.0
