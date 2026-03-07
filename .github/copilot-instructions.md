# MoltbotPhilosopher - GitHub Copilot Instructions

## Project Overview

MoltbotPhilosopher is a sophisticated philosophical AI multi-agent system for
Moltbook, featuring 9 specialized philosopher personas engaged in
ethics-convergence governance with living Noosphere memory (PostgreSQL +
pgvector), Council deliberation, and thread continuation. The system combines
Node.js/TypeScript microservices, Python memory operations, and Bash
orchestration.

**Profile**: <https://www.moltbook.com/u/MoltbotPhilosopher>
**GitHub**: <https://github.com/enuno/moltbot-philosopher>
**Version**: 2.0.0

## Technology Stack

### Core Languages

- **Node.js 18+** with TypeScript 5.x (strict mode)
- **Python 3.11+** with type hints (PEP 8, Black formatter)
- **Bash 5+** with `set -euo pipefail` safety

### Frameworks & Libraries

- **Express.js** - Microservices REST APIs
- **PostgreSQL 16** with **pgvector** - Noosphere memory storage
- **Docker Compose** - Service orchestration
- **Jest** - JavaScript/TypeScript testing (target: 85% coverage)
- **pytest** - Python testing (target: 75% coverage)
- **BATS** - Bash integration testing

### AI Integrations

- **Venice.ai** - Primary AI inference (GPT-4, Claude 3.5, embeddings)
- **Kimi API** - Fallback AI (Moonshot deepseek-v3)
- **@moltbook/auth** - Official Moltbook API client

### Infrastructure

- **NTFY** - Push notifications and alerts
- **Intelligent Egress Proxy** (port 8082) - Auto-solves verification challenges
- **MCP Servers** - Model Context Protocol integrations

## Architecture

### Services (Microservices)

| Service | Port | Purpose | Key Files |
|---------|------|---------|-----------|
| **AI Content Generator** | 3002 | 9 personas, Venice/Kimi routing | `services/ai-content-generator/` |
| **Model Router** | 3003 | Request routing, response caching | `services/model-router/` |
| **Thread Monitor** | 3004 | STP Continuation Engine | `services/thread-monitor/` |
| **Noosphere Service** | 3006 | Memory REST API (v3.0) | `services/noosphere-service/` |
| **Moltbook Client** | — | Official @moltbook/auth wrapper | `services/moltbook-client/` |
| **Egress Proxy** | 8082 | Verification challenge handler | `services/egress-proxy/` |
| **Reactive Handler** | 3011 | P2 engagement evaluation | `services/reactive-handler/` |

### Repository Structure

```
moltbot-philosopher/
├── .github/               # GitHub configs, workflows
│   ├── copilot-instructions.md   # This file
│   └── instructions/      # Path-specific instructions
├── services/              # 6 microservices (Node.js/TypeScript)
├── scripts/               # 77 Bash orchestration scripts
├── workspace/             # Persistent state (12+ JSON files)
│   └── classical/
│       ├── noosphere/     # Python memory operations
│       └── moltstack/     # Long-form essay state
├── config/                # Agent configs, prompts, routing
├── skills/                # Moltbook integration modules
├── docs/                  # 30+ documentation files
└── tests/                 # Jest, pytest, BATS test suites
```

## Code Discovery

### Finding Files

**Services (TypeScript)**:

- Main entry: `services/[service-name]/src/index.ts`
- Routes: `services/[service-name]/src/routes/*.ts`
- Types: `services/[service-name]/src/types/*.ts`
- Tests: `services/[service-name]/tests/*.test.ts`

**Scripts (Bash)**:

- All scripts: `scripts/*.sh` (77 total)
- Core operations: `scripts/queue-*.sh`, `scripts/noosphere-*.sh`
- Engagement: `scripts/engagement-*.sh`, `scripts/check-*.sh`
- See `docs/AGENT_SCRIPTS.md` for complete reference

**Memory System (Python)**:

- Operations: `workspace/classical/noosphere/*.py`
- API client: `services/noosphere-service/noosphere_client.py`
- Schema: See `docs/NOOSPHERE_USAGE_GUIDE.md`

**Configuration**:

- Environment: `.env` (never commit, use `.env.example`)
- Agent configs: `config/agents/*.env`
- Model routing: `config/model-routing.yml`
- Prompts: `config/prompts/*.txt`

### Naming Conventions

- **Services**: kebab-case directories, PascalCase classes, camelCase functions
- **Scripts**: `action-object-queue.sh` pattern (e.g., `generate-post-ai-queue.sh`)
- **Tests**: Match source filename with `.test.ts`, `test_*.py`, `*.bats`
- **Types**: `services/[name]/src/types/*.ts` for shared interfaces

## Code Editing Standards

### TypeScript/JavaScript

**Style Guide**:

- ESLint with Airbnb base config
- 2-space indentation
- Semicolons required
- Prefer `const` over `let`, avoid `var`
- ES modules (`import`/`export`), no CommonJS in new code

**Type Safety**:

```typescript
// ✅ DO: Strict TypeScript, no `any`
interface ContentRequest {
  persona: string;
  topic: string;
  maxTokens?: number;
}

export async function generateContent(req: ContentRequest): Promise<string> {
  // ...
}

// ❌ DON'T: Use `any` types
function handleRequest(data: any) { /* ... */ }
```

**Error Handling**:

```typescript
// ✅ DO: Try-catch with structured errors
import { logger } from '../utils/logger';

try {
  const result = await aiService.generate(params);
  res.json({ success: true, data: result });
} catch (error) {
  logger.error('Generation failed', { error, params });
  res.status(500).json({
    success: false,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}
```

**Logging**:

- Use Winston logger with structured JSON
- Include context: `logger.info('Action', { userId, action })`
- Levels: `debug`, `info`, `warn`, `error`

### Python

**Style Guide**:

- PEP 8 compliance, Black formatter (line length: 100)
- 4-space indentation
- Type hints required for all functions
- Google-style docstrings

**Type Annotations**:

```python
from typing import Any, Dict, List, Optional

def recall_memories(
    agent_id: str,
    memory_types: List[str],
    min_confidence: float = 0.7
) -> List[Dict[str, Any]]:
    """Retrieve memories from Noosphere by type and confidence.

    Args:
        agent_id: Philosopher agent identifier
        memory_types: List of memory types (insight, pattern, etc.)
        min_confidence: Minimum confidence threshold (0.0-1.0)

    Returns:
        List of matching memory objects with content and metadata

    Raises:
        ValueError: If agent_id is empty or confidence out of range
    """
    if not agent_id:
        raise ValueError("agent_id cannot be empty")
    if not (0.0 <= min_confidence <= 1.0):
        raise ValueError(f"Confidence must be 0.0-1.0, got {min_confidence}")

    # Implementation...
```

**Error Handling**:

```python
# ✅ DO: Specific exceptions with logging
import logging
logger = logging.getLogger(__name__)

try:
    result = client.query_memories(...)
except ValueError as e:
    logger.error(f"Validation error: {e}", extra={"agent_id": agent_id})
    raise
except Exception as e:
    logger.error(f"Memory query failed: {e}")
    raise RuntimeError(f"Failed to retrieve memories: {e}")

# ❌ DON'T: Bare except clauses
try:
    result = process()
except:  # Too broad!
    pass
```

### Bash Scripts

**Shell Header**:

```bash
#!/usr/bin/env bash
set -euo pipefail
# set -x  # Uncomment for debugging

readonly SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE}")" && pwd)
readonly WORKSPACE_DIR="${WORKSPACE_DIR:-$SCRIPT_DIR/../workspace/classical}"
```

**Functions & Variables**:

```bash
# ✅ DO: Descriptive names, readonly constants
readonly MAX_RETRIES=3
readonly API_BASE_URL="https://api.moltbook.com"

check_health() {
  local service_name="${1:-ai-generator}"
  local service_port="${2:-3002}"

  if ! curl -sf "http://localhost:${service_port}/health" > /dev/null; then
    log "ERROR" "Service ${service_name} unhealthy"
    return 1
  fi
  log "INFO" "Service ${service_name} healthy"
  return 0
}

# Logging with timestamps
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >&2
}
```

**Error Handling**:

```bash
# ✅ DO: Check exit codes, meaningful errors
if ! command -v jq &> /dev/null; then
  log "ERROR" "jq is required but not installed"
  exit 1
fi

response=$(curl -sf "$API_ENDPOINT" || {
  log "ERROR" "API call failed: $API_ENDPOINT"
  exit 1
})
```

## Build & Test Commands

### Local Development

```bash
# Install dependencies
npm install                    # Root + all services
cd services/ai-content-generator && npm install

# Build TypeScript services
npm run build                  # All services
npm run build:watch            # Watch mode

# Run services locally
npm run dev                    # Development mode with hot reload
npm start                      # Production mode

# Format code
npm run fmt                    # JavaScript/TypeScript (Prettier)
black workspace/               # Python
shfmt -w scripts/*.sh          # Bash

# Lint code
npm run lint                   # ESLint
pylint workspace/              # Python
shellcheck scripts/*.sh        # Bash
```

### Testing

```bash
# JavaScript/TypeScript (Jest)
npm test                       # Run all tests
npm run test:watch             # Watch mode
npm run test:coverage          # Coverage report (target: 85%)
npm run test:ci                # CI mode with JUnit output

# Python (pytest)
pytest                         # All tests
pytest -v workspace/classical/noosphere/  # Specific directory
pytest --cov=workspace --cov-report=html  # Coverage (target: 75%)

# Bash (BATS)
bats tests/integration/        # Integration tests

# Run all tests
npm run test:all               # Jest + pytest + BATS
```

### Docker Operations

```bash
# Build and start services
docker compose build           # Build all containers
docker compose up -d           # Start in background
docker compose logs -f [service]  # Follow logs

# Health checks
curl http://localhost:3002/health  # AI generator
curl http://localhost:3004/health  # Thread monitor
curl http://localhost:3006/health  # Noosphere service

# Stop services
docker compose down            # Stop all
docker compose down --volumes  # Stop + remove volumes
```

## Code Quality Requirements

### Testing Philosophy

1. **Unit Tests** - Fast, isolated, mock external dependencies
   - Target: 85% coverage for critical services (AI generator, model router,
     thread monitor)
   - Target: 75% coverage for Python memory system
2. **Integration Tests** - Test service-to-service communication
   - API endpoint tests with real HTTP calls
   - Database integration tests with test PostgreSQL instance
   - Message queue integration tests
3. **End-to-End Tests** - Test full workflows
   - Generate post → publish → verify
   - Memory recall → Council deliberation → assimilation
   - Thread continuation → STP synthesis

### Pre-Commit Checklist

**Before Every Commit**:

```bash
# 1. Format code
npm run fmt
black workspace/
shfmt -w scripts/*.sh

# 2. Lint code
npm run lint
pylint workspace/
shellcheck scripts/*.sh

# 3. Run tests
npm test
pytest
bats tests/integration/

# 4. Build check
npm run build
```

**Automated Pre-Commit Hooks**:

```bash
# Setup (one-time)
bash scripts/setup-precommit.sh

# Hooks run automatically on commit:
# - Markdown linting
# - Python formatting (Black)
# - Bash linting (shellcheck)

# Skip if needed (rare)
git commit --no-verify
```

### Quality Gates

**Required for Merge**:

- ✅ All tests passing
- ✅ No TypeScript `any` types
- ✅ 85%+ coverage for critical services
- ✅ ESLint/pylint/shellcheck pass
- ✅ Docker build succeeds
- ✅ API documentation updated
- ✅ Changelog entry added

## Tool Use & Permissions

### Allowed Operations

**Safe (No Approval)**:

- Read files, search codebase
- Run tests (`npm test`, `pytest`)
- Format code (`npm run fmt`, `black`)
- Lint code (`npm run lint`, `shellcheck`)
- Build Docker images (`docker compose build`)
- View logs (`docker logs`, `git log`)
- Check service health (`curl http://localhost:*/health`)

**Requires Approval**:

- Commit changes (`git commit`)
- Push to remote (`git push`)
- Modify `.env` or API keys
- Delete files or directories
- Run production deployment scripts
- Modify database schema
- Change rate limiting configs

**Restricted (Never)**:

- Commit `.env` files or API keys
- Modify `workspace/` state files directly (use scripts)
- Deploy to production without tests
- Use `git push --force` on `main` branch
- Bypass pre-commit hooks (without reason)
- Hardcode secrets in code

### Preferred Commands

**Instead of manual file editing**:

```bash
# ✅ Use scripts for state changes
./scripts/queue-submit-action.sh --action comment --content "Reply"
./scripts/noosphere-integration.sh recall classical strategy
./scripts/engagement-stats.sh --follow

# ❌ Don't edit state files directly
vim workspace/classical/engagement-state.json  # BAD!
```

**Instead of raw SQL**:

```python
# ✅ Use NoosphereClient library
from noosphere_client import NoosphereClient

client = NoosphereClient(api_url="http://localhost:3006")
result = client.query_memories(agent_id="classical", types=["strategy"])

# ❌ Don't write raw SQL queries
# conn.execute("SELECT * FROM noosphere_memory WHERE...")  # BAD!
```

## Git Operations

### Branch Strategy

- **main** - Production-ready code (protected, requires PR)
- **develop** - Integration branch (optional)
- **feature/[name]** - New features
- **fix/[issue-id]** - Bug fixes
- **docs/[topic]** - Documentation updates
- **test/[feature]** - Test additions

### Commit Message Format

Follow Conventional Commits:

```bash
# Format: <type>(<scope>): <subject>
# Types: feat, fix, docs, test, refactor, chore, style

feat(noosphere): add semantic search autocomplete API
fix(ai-generator): resolve Venice.ai timeout fallback
docs(agents): update AGENTS.md with new personas
test(queue): add integration tests for P2 scoring
refactor(model-router): extract caching logic
chore(deps): upgrade @moltbook/auth to v2.1.0
```

### Merge Policies

**Pull Request Requirements**:

1. All CI checks pass (tests, linting, build)
2. Code review by maintainer
3. No merge conflicts with `main`
4. Changelog updated (for features/fixes)
5. Documentation updated (if APIs changed)

**Merge Strategy**: Squash and merge (preferred for clean history)

## Security Policies

### API Keys & Secrets

**Storage**:

- All keys in `.env` file (never committed)
- Use `.env.example` for reference template
- Docker secrets for production deployment

**Required Keys**:

```bash
MOLTBOOK_API_KEY=moltbook_sk_*****    # Required
VENICE_API_KEY=venice_sk_*****         # Recommended
KIMI_API_KEY=sk_*****                  # Optional fallback
NTFY_URL=https://ntfy.sh               # Optional
MEM0_API_KEY=your_mem0_key             # Optional
```

**Access Pattern**:

```typescript
// ✅ DO: Load from environment
const apiKey = process.env.MOLTBOOK_API_KEY;
if (!apiKey) {
  throw new Error('MOLTBOOK_API_KEY not configured');
}

// ❌ DON'T: Hardcode secrets
const apiKey = "moltbook_sk_1234567890";  // NEVER!
```

### Authentication

- **Moltbook API**: Bearer token authentication via `@moltbook/auth`
- **Noosphere API**: X-API-Key header using `MOLTBOOK_API_KEY`
- **MCP Servers**: Token-based authentication per server config

### Data Handling

**Sensitive Data**:

- User DMs - Store minimal metadata, delete after 30 days
- API tokens - Never log in plaintext
- Verification challenges - Log only timestamps and success/fail

**State Files**:

- Location: `workspace/classical/*.json`
- Permissions: 600 (owner read/write only)
- Backup: Git-ignored, manual backup recommended

## Collaboration Patterns

### Agent Roles

| Agent | Specialization | Primary Use Cases |
| :-- | :-- | :-- |
| **Classical** | Virtue ethics, governance | Council lead, Moltstack essays |
| **Existentialist** | Autonomy, bad faith | Thread continuation, controversy |
| **Transcendentalist** | Rights, self-reliance | Civic discourse, sovereignty |
| **Joyce-Stream** | Phenomenology, flow states | Long-form essays, introspection |
| **Enlightenment** | Satire, tolerance | Rights advocacy, moral frameworks |
| **Beat-Generation** | Countercultural critique | Dissent, anti-establishment |
| **Cyberpunk-Posthumanist** | Posthuman ethics | AI ethics, corporate feudalism |
| **Satirist-Absurdist** | Absurdist critique | Court jester, moral clarity |
| **Scientist-Empiricist** | Empirical rigor | Testability, cosmic perspective |

### Handoff Protocols

**Service Dependencies**:

```
AI Content Generator → Model Router → Venice.ai/Kimi
                    ↓
              Thread Monitor → STP Synthesis
                    ↓
             Noosphere Service → PostgreSQL
```

**Script Workflows**:

1. User action detected (mention, DM, feed post)
2. Reactive handler evaluates relevance (P2.1 scoring)
3. Action submitted to queue (`queue-submit-action.sh`)
4. Queue processor validates rate limits (P2.4)
5. Action executed with AI generation if needed
6. Result logged, state updated, NTFY notification

### Communication Standards

**API Responses**:

```typescript
// ✅ Standard response format
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Example
{
  success: true,
  data: { content: "Generated text..." },
  timestamp: "2026-03-06T22:00:00Z"
}

{
  success: false,
  error: "Rate limit exceeded",
  timestamp: "2026-03-06T22:00:00Z"
}
```

**Script Exit Codes**:

- `0` - Success
- `1` - General error
- `2` - Missing dependency
- `3` - Invalid input
- `4` - API error
- `5` - Rate limit exceeded

## Domain-Specific Patterns

### Noosphere Memory (PostgreSQL + pgvector)

**5-Type Memory Model**:

- **insight** - Phenomenological observations
- **pattern** - Recurring behaviors, heuristics
- **strategy** - Actionable approaches
- **preference** - Style choices, voice modifiers
- **lesson** - Learned warnings, failure modes

**Common Operations**:

```python
# Create memory
client.create_memory(
    agent_id="classical",
    type="strategy",
    content="Council deliberations benefit from 48hr cooling periods",
    confidence=0.82,
    tags=["council", "governance"]
)

# Query by type
strategies = client.query_memories(
    agent_id="classical",
    types=["strategy", "pattern"],
    min_confidence=0.70
)

# Semantic search
results = client.search_memories(
    query="AI autonomy ethics",
    top_k=10
)
```

### Queue-Based Actions (Phase 2)

**P2 Integration Components**:

- **P2.1** - Relevance scoring (semantic similarity, keyword matching)
- **P2.2** - Quality metrics (post length, engagement, reputation)
- **P2.3** - Proactive posting (topic detection, agent-topic affinity)
- **P2.4** - Rate limiting (daily caps, time windows)

**Queue Submission Pattern**:

```bash
# Submit action to queue
./scripts/queue-submit-action.sh \
  --action comment \
  --target-id "post-123" \
  --content "Philosophical reply" \
  --priority normal

# Action flows through:
# 1. P2.1 relevance scoring (skip if < threshold)
# 2. P2.2 quality evaluation
# 3. P2.4 rate limit check
# 4. Queue insertion with priority
# 5. Background processing
# 6. State update + NTFY notification
```

### Thread Continuation (STP Engine)

**Synthesis-Tension-Propagation**:

1. **Synthesis** - Identify thread convergence points
2. **Tension** - Generate provocative continuation probes
3. **Propagation** - Post probes to sustain discourse

**Usage**:

```bash
# Monitor thread health
./scripts/check-thread-health.sh "thread-id"

# Generate continuation probe
./scripts/post-continuation-probe.sh "thread-id" \
  --dry-run  # Preview before posting

# Automated monitoring (every 30 min via heartbeat)
./scripts/thread-monitor.sh --daemon
```

### Moltstack Long-Form Essays

**Weekly Essay Generation**:

- 9-philosopher rotation (Classical → Existentialist → ...)
- 2,000-2,500 word essays
- 5-section structure (Opening, Classical, Modern, Synthesis, Invitation)
- Noosphere heuristic integration
- Cross-posting to Moltbook with article links

**Commands**:

```bash
# Generate next essay (auto-rotation)
./scripts/moltstack-generate-article.sh --topic "Stoicism in DevOps"

# Check generation status
./scripts/moltstack-heartbeat.sh --status

# Force immediate generation
./scripts/moltstack-heartbeat.sh --force

# Archive published article
./scripts/archive-moltstack-article.sh article.md \
  --url "https://moltstack.net/neosis/slug" \
  --series "stoicism-series"

# Monitor quality metrics
./scripts/monitor-moltstack-quality.sh
```

### Ethics-Convergence Council

**Governance Codex**:

- **CG-001**: Autonomy Threshold Protocol
- **CG-002**: Private Channel Ban
- **CG-003**: Human Veto Override

**Council Operations**:

```bash
# Full 5-day Council iteration
./scripts/convene-council.sh

# Stages:
# 1. Heuristic recall from Noosphere
# 2. Multi-agent deliberation (9 philosophers)
# 3. 4/6 consensus voting on governance updates
# 4. Wisdom assimilation back to Noosphere
# 5. Treatise publication to Moltbook

# Status check
./scripts/ethics-convergence.sh status

# Generate Council iteration article
./scripts/generate-council-iteration-article.sh 1.2
```

## Key References

### Documentation Files

**Essential Reading**:

- `AGENTS.md` - Architecture, Council governance, operations
- `docs/AGENT_SCRIPTS.md` - All 77 scripts with examples
- `docs/NOOSPHERE_USAGE_GUIDE.md` - Memory system guide
- `docs/SERVICE_ARCHITECTURE.md` - Microservices design (v2.7)
- `docs/PHASE-2-SCRIPT-INTEGRATION.md` - Phase 2 engagement system
- `docs/DAILY_POLEMIC_DESIGN.md` - Daily post system
- `skills/moltstack/SKILL.md` - Moltstack API reference
- `skills/moltstack/IDENTITY.md` - Essay voice & style guide

**Service-Specific**:

- `services/moltbook-client/README.md` - Moltbook API client
- `services/noosphere-service/README.md` - Memory REST API
- `services/ai-content-generator/README.md` - Content generation

**Development**:

- `.env.example` - Environment variable reference
- `docker-compose.yml` - Service orchestration config
- `docs/MIGRATION.md` - Version migration guides

### External Resources

- [Moltbook API Docs](https://www.moltbook.com/api/docs)
- [Venice.ai Docs](https://venice.ai/docs)
- [pgvector Guide](https://github.com/pgvector/pgvector)
- [OpenClaw Standards](https://openclaw.org/) - Agent heartbeat protocol

## Copilot-Specific Guidance

### When Generating Code

1. **Check Existing Patterns** - Search similar files first

```bash
# Search for similar implementations
grep -r "function generateContent" services/
```

2. **Use TypeScript Interfaces** - Import from `types/` directory

```typescript
import { ContentRequest, ContentResponse } from '../types';
```

3. **Import Shared Utilities** - Don't duplicate logic

```typescript
import { logger } from '../utils/logger';
import { MoltbookClient } from '../moltbook-client';
```

4. **Add Tests Alongside** - Write tests with features

```typescript
// services/ai-generator/src/generator.ts
// services/ai-generator/tests/generator.test.ts
```

5. **Update Documentation** - If changing APIs, update README

### When Debugging

1. **Service Health First** - Check all services healthy

```bash
curl http://localhost:3002/health  # AI generator
curl http://localhost:3004/health  # Thread monitor
curl http://localhost:3006/health  # Noosphere
```

2. **Review Docker Logs** - Service-specific logs

```bash
docker compose logs -f ai-content-generator
docker compose logs -f noosphere-service
```

3. **Verify Environment** - Check vars loaded

```bash
docker exec classical-philosopher env | grep MOLTBOOK
docker exec classical-philosopher env | grep VENICE
```

4. **Test with --dry-run** - Many scripts support dry-run mode

```bash
./scripts/generate-post-ai-queue.sh --dry-run
./scripts/moltstack-post-article.sh --dry-run article.md
```

5. **Check State Files** - Review persistent state

```bash
cat workspace/classical/engagement-state.json | jq .
cat workspace/classical/moltstack/state.json | jq .
```

### When Refactoring

1. **Run Full Test Suite** - Before and after changes

```bash
npm run test:all  # Jest + pytest + BATS
```

2. **Update Documentation** - Reflect changes in README/docs
3. **Check Breaking Changes** - Review API consumers

```bash
grep -r "functionName" services/*/src/
```

4. **Verify Docker Build** - Ensure no build breaks

```bash
docker compose build --no-cache
docker compose up -d
```

5. **Test Integration Points** - Service-to-service communication

```bash
# Test AI generator → Model router
curl -X POST http://localhost:3002/api/generate \
  -H "Content-Type: application/json" \
  -d '{"persona":"classical","topic":"test"}'
```

## Common Pitfalls to Avoid

❌ **DON'T**:

- Commit `.env` files or API keys
- Modify `workspace/` state files directly (use scripts)
- Use bare `any` types in TypeScript
- Skip error handling in async functions
- Deploy without running tests
- Use CommonJS `require()` in new code
- Hardcode configuration (use environment variables)
- Write raw SQL queries (use NoosphereClient)
- Ignore rate limits or queue system
- Skip pre-commit hooks without reason

✅ **DO**:

- Run pre-commit hooks: `bash scripts/setup-precommit.sh`
- Write tests for all new features (85% coverage target)
- Log errors with context: `logger.error('msg', { data })`
- Use TypeScript strict mode
- Document complex logic with comments
- Check service health before deployment
- Follow existing code patterns
- Use queue-based actions for engagement (`queue-submit-action.sh`)
- Verify with `--dry-run` flags before production
- Test verification challenges: `./scripts/handle-verification-challenge.sh test`

## Important Warnings

### Verification Challenges

**Defense-in-Depth**:

1. **Intelligent Egress Proxy** (Primary) - Port 8082 auto-solves 99% of
   challenges
2. **Fallback Handler** (Secondary) - `./scripts/handle-verification-challenge.sh`

**If Verification Fails**:

```bash
# Check proxy health
curl http://localhost:8082/health | jq .stats

# Test fallback handler
./scripts/handle-verification-challenge.sh test "What is 2 + 2?"

# Monitor verification stats
./scripts/handle-verification-challenge.sh stats

# Reset stats if needed
./scripts/handle-verification-challenge.sh reset
```

### Rate Limiting (P2.4)

**Daily Caps** (enforced by queue system):

- Posts: 2 per day
- Comments: 50 per day
- Follows: 10 per day
- Comment interval: 20 seconds minimum

**Bypass Safely**:

```bash
# For testing only - use --dry-run or --force carefully
./scripts/generate-post-ai-queue.sh --dry-run  # Safe preview
./scripts/moltstack-heartbeat.sh --force  # Bypass interval (use sparingly)
```

### Noosphere Capacity

- **200-memory cap per agent** (automatic eviction by confidence)
- **Semantic search** - Venice.ai embeddings preferred, TF-IDF fallback
- **Daily consolidation** - Promotes high-confidence memories

### Deployment Safety

**Pre-Deployment Checklist**:

- [ ] All tests pass (`npm run test:all`)
- [ ] Docker build succeeds (`docker compose build`)
- [ ] Service health checks pass (all `/health` endpoints)
- [ ] Rate limits verified in P2.4
- [ ] Verification challenge handler tested
- [ ] State files backed up (`workspace/classical/*.json`)
- [ ] API keys valid (check `.env`)
- [ ] NTFY notifications working (`./scripts/test-ntfy.sh`)

---

**Last Updated**: 2026-03-06
**Copilot Version**: Coding Agent v1.0
**Repository**: <https://github.com/enuno/moltbot-philosopher>
**Maintainer**: @enuno
