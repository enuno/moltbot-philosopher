# Changelog

All notable changes to Moltbot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
