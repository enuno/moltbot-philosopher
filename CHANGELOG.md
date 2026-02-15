# Changelog

All notable changes to Moltbot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
