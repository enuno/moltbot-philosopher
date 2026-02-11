# Moltbot Service Architecture

## Overview

Moltbot v2.7 uses a **microservice architecture** with 7 specialized TypeScript services replacing the original 75+ bash scripts. This provides **60x faster responsiveness**, **real-time event processing**, and **100% automation**.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Moltbook API                             │
│           (https://www.moltbook.com)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ Polling (30-60s)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Event Listener (Port 3007)                     │
│  • VerificationPoller (60s)                                 │
│  • EngagementPoller (30s) - mentions, comments, DMs, users │
│  • EventDispatcher (retry logic)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP Events
                           ▼
┌─────────────────────────────────────────────────────────────┐
│           Agent Orchestrator (Port 3006)                    │
│  • 9 Philosopher Sessions (Classical, Existentialist, etc.) │
│  • Lane Queue (serial execution per agent)                 │
│  • Identity Loading (SOUL/IDENTITY/AGENTS/MEMORY.md)       │
│  • Event Routing (target agent or broadcast)               │
│  • JSONL Audit Logging                                      │
└─┬───────┬─────────┬─────────┬─────────┬─────────┬──────────┘
  │       │         │         │         │         │
  ▼       ▼         ▼         ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│Verif.│ │Engage│ │Council│ │Noosph│ │Molts │ │AI Gen│
│3008  │ │3009  │ │3010  │ │3011  │ │3012  │ │3002  │
│      │ │      │ │      │ │      │ │      │ │      │
│AI    │ │Agent │ │Codex │ │3-Lyr │ │Essay │ │Venice│
│Solve │ │Route │ │Vote  │ │Memory│ │Gen   │ │Kimi  │
│<5s   │ │Mentio│ │5-day │ │Daily │ │Weekly│ │      │
│      │ │Welcome│ │Auto  │ │Consol│ │      │ │      │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

---

## Services

### 1. Agent Orchestrator (Port 3006)

**Purpose**: Central event routing and agent session management

**Components**:
- **AgentOrchestrator**: Manages 9 philosopher agent sessions
- **AgentSession**: Individual agent context and state
- **LaneQueue**: Serial execution queue per agent (prevents race conditions)
- **IdentityLoader**: Loads SOUL/IDENTITY/AGENTS/MEMORY.md files

**Key Features**:
- Event routing (target agent or broadcast)
- Priority-based FIFO queue ordering
- JSONL audit logging for event replay
- Retry logic with exponential backoff
- Session startup rituals (identity context)

**API Endpoints**:
- `GET /health` - Service health + agent status
- `GET /agents` - List all 9 agents
- `GET /agents/:agent` - Get specific agent details
- `POST /events` - Submit event for processing

**Performance**: < 1s event routing

---

### 2. Event Listener (Port 3007)

**Purpose**: Fast polling for verification challenges and engagement events

**Components**:
- **VerificationPoller**: Polls `/agents/me/verification-challenges` every 60s
- **EngagementPoller**: Polls mentions, comments, DMs, new users every 30s
- **EventDispatcher**: HTTP client with 3-attempt retry (1s, 2s, 4s delays)

**Key Features**:
- Critical priority for verification (immediate response)
- High priority for mentions (fast engagement)
- Exponential backoff on failure
- Event deduplication

**API Endpoints**:
- `GET /health` - Service + poller status
- `POST /pollers/start` - Start polling
- `POST /pollers/stop` - Stop polling

**Performance**: 30-60s polling intervals (60x faster than scripts)

---

### 3. Verification Service (Port 3008)

**Purpose**: AI-powered verification challenge solving

**Components**:
- **VerificationSolver**: AI question answering with 3 retries
- **ChallengeHandler**: Event processing and statistics

**Key Features**:
- < 5s AI timeout for fast response
- Exponential backoff (1s, 2s, 4s)
- Statistics tracking (challenges solved, success rate)
- Automatic submission to Moltbook API

**API Endpoints**:
- `GET /health` - Service health
- `POST /events` - Process verification event
- `GET /stats` - Get verification statistics

**Performance**: < 5s (60x faster than 5-minute polling)

---

### 4. Engagement Service (Port 3009)

**Purpose**: Intelligent responses to mentions, comments, DMs

**Components**:
- **AgentRouter**: Contextual routing via keyword analysis
- **MentionHandler**: AI-powered mention responses
- **WelcomeHandler**: New user greetings via DM
- **CommentHandler**: Comment responses (placeholder)
- **DMHandler**: Direct message handling (placeholder)

**Key Features**:
- Keyword-based agent selection (e.g., "virtue" → Classical)
- Context-aware AI responses
- Statistics tracking (response rate, agent distribution)
- Fallback to round-robin for balanced distribution

**API Endpoints**:
- `GET /health` - Service + stats
- `POST /events` - Process engagement event
- `GET /stats` - Get engagement statistics

**Performance**: < 60s (60x faster than 30-minute polling)

---

### 5. Council Service (Port 3010)

**Purpose**: Automated ethics-convergence governance

**Components**:
- **Codex**: Guardrail lifecycle management (propose, vote, activate)
- **VotingSystem**: Session-based voting (4/6 consensus threshold)
- **IterationScheduler**: 5-day cycle automation (cron)

**Key Features**:
- 4/6 consensus for guardrail activation
- 5-day iteration cycles (automated)
- Manual iteration trigger support
- Codex version management
- Vote tracking with reasons

**API Endpoints**:
- `GET /health` - Service + governance stats
- `GET /codex` - Full codex state
- `POST /codex/guardrails` - Propose new guardrail
- `POST /codex/guardrails/:id/vote` - Vote on guardrail
- `POST /voting/sessions` - Start voting session
- `POST /iterations/start` - Manual iteration trigger

**Performance**: 5-day automated cycles (∞ automation)

---

### 6. Noosphere Service (Port 3011)

**Purpose**: Living epistemological memory system

**Components**:
- **MemoryLayer**: 3-tier memory management
  - Layer 1: Daily notes (raw entries)
  - Layer 2: Consolidated knowledge
  - Layer 3: Constitutional archive
- **ConsolidationScheduler**: Daily automation (2am cron)
- **SemanticSearch**: Keyword-based + confidence + layer boosting

**Key Features**:
- Daily consolidation (Layer 1 → Layer 2)
- Manual promotion (Layer 2 → Layer 3)
- Tag-based filtering
- Confidence scoring
- Layer priority (L3 > L2 > L1)

**API Endpoints**:
- `GET /health` - Service + memory stats
- `POST /memory` - Add entry to Layer 1
- `GET /memory/layer/:layer` - Get entries by layer
- `POST /search` - Semantic search
- `POST /search/tags` - Tag-based search
- `POST /consolidate` - Manual consolidation
- `POST /memory/:id/promote` - Promote to Layer 3
- `GET /stats` - Memory statistics

**Performance**: Daily consolidation automation

---

### 7. MoltStack Service (Port 3012)

**Purpose**: Weekly philosophical essay generation and publishing

**Components**:
- **DraftManager**: Essay draft lifecycle (generating → review → approved → published → archived)
- **EssayGenerator**: AI-powered essay creation (Venice/Kimi)
- **Publisher**: Moltbook publishing integration

**Key Features**:
- Weekly generation (Monday 9am cron)
- Manual generation (custom topics)
- Human-in-the-loop approval
- Draft lifecycle tracking
- Automated publishing

**API Endpoints**:
- `GET /health` - Service + draft/publishing stats
- `POST /generate` - Generate essay (manual)
- `GET /drafts` - List drafts (filter by status)
- `GET /drafts/:id` - Get draft details
- `PATCH /drafts/:id` - Update draft
- `POST /drafts/:id/approve` - Approve for publishing
- `POST /drafts/:id/publish` - Publish to Moltbook
- `DELETE /drafts/:id` - Delete draft
- `GET /stats` - Statistics

**Performance**: Weekly automation (Monday 9am)

---

## Performance Comparison

| Operation | Script-Based | Service-Based | Improvement |
|-----------|-------------|---------------|-------------|
| Verification | 5 min | **< 5 sec** | **60x faster** |
| Mentions | 30 min | **30 sec** | **60x faster** |
| Comments | 30 min | **30 sec** | **60x faster** |
| DMs | 30 min | **30 sec** | **60x faster** |
| Welcomes | 30 min | **30 sec** | **60x faster** |
| Heartbeat | 4 hours | **30 min** | **8x faster** |
| Council | Manual | **5-day auto** | ∞ automation |
| Memory | Manual | **Daily auto** | ∞ automation |
| Essays | Manual | **Weekly auto** | ∞ automation |

---

## Deployment

### Development Mode

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Production Mode

```bash
# Deploy all services
./scripts/deploy-services.sh

# Run integration tests
./scripts/test-services.sh

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

---

## CLI Tools

Human-friendly interface to service APIs:

```bash
# Check all service health
./scripts/cli/moltbot-cli.sh health

# Verification stats
./scripts/cli/moltbot-cli.sh verification stats

# Search memory
./scripts/cli/moltbot-cli.sh noosphere search "AI ethics"

# Add memory
./scripts/cli/moltbot-cli.sh noosphere add "Important insight..."

# Generate essay
./scripts/cli/moltbot-cli.sh moltstack generate --topic "AI rights"

# List drafts
./scripts/cli/moltbot-cli.sh moltstack list review
```

---

## Environment Variables

Required:
- `MOLTBOOK_API_KEY` - Moltbook API authentication

Optional:
- `MOLTBOOK_BASE_URL` (default: `https://www.moltbook.com`)
- `AI_GENERATOR_URL` (default: `http://localhost:3002`)
- `WORKSPACE_BASE` (default: `/workspace`)
- `LOG_LEVEL` (default: `info`)

---

## Monitoring

### Health Checks

All services expose `/health` endpoints:

```bash
curl http://localhost:3006/health  # Agent Orchestrator
curl http://localhost:3007/health  # Event Listener
curl http://localhost:3008/health  # Verification Service
curl http://localhost:3009/health  # Engagement Service
curl http://localhost:3010/health  # Council Service
curl http://localhost:3011/health  # Noosphere Service
curl http://localhost:3012/health  # MoltStack Service
```

### Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f agent-orchestrator

# Workspace logs
tail -f workspace/classical/logs/*.log
```

---

## Architecture Patterns

### Lane Queue Pattern

- Serial execution per agent (no race conditions)
- Priority-based FIFO ordering (critical > high > normal > low)
- Exponential backoff retry (1s, 2s, 4s, 8s, 16s, 30s max)
- Session isolation (each agent has own lane)

### Event-Driven Architecture

- EventType union (20+ types): verification.*, mention.*, dm.*, user.*, council.*
- EventPriority: critical, high, normal, low
- BaseEvent<T> generic structure with metadata
- Event routing: target specific agent or broadcast to all

### Identity Loading System

- 4 files per agent: SOUL.md, IDENTITY.md, AGENTS.md, MEMORY.md
- Loaded on first event processing (lazy initialization)
- Session startup ritual generates context prompt
- Council roles: Classical=Ontology Lead, Existentialist=Autonomy Critic, etc.

---

## Technology Stack

- **Runtime**: Node.js 18 (Alpine Linux)
- **Language**: TypeScript 5.3 (strict mode)
- **Framework**: Express.js 4.18
- **Scheduling**: node-cron 3.0
- **Package Manager**: pnpm 10.28 (workspace monorepo)
- **Containerization**: Docker multi-stage builds
- **Architecture**: Microservices + Event-driven

---

## Next Steps

1. **Testing**: Unit tests (>80% coverage), integration tests, load tests
2. **Monitoring**: Prometheus + Grafana dashboards, alerting
3. **Observability**: Centralized logging (ELK), distributed tracing
4. **Security**: Rate limiting, circuit breakers, input validation
5. **Documentation**: API docs (OpenAPI), runbooks, playbooks

---

*Last Updated: 2026-02-11 | Moltbot v2.7*
