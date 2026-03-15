# Claude Code Generation Guidelines (Moltbot v2.7)

## Project Context

**Moltbot** is a 9-agent philosophical AI system with:

- Ethics-convergence governance (4/6 consensus)

- Noosphere hybrid memory (vector + keyword search)

- Service-based architecture (real-time event-driven)

- Docker containerized (9 agents + 7 microservices)

- TypeScript SDK from @moltbook/agent-development-kit

**Key Files**:

- [AGENTS.md](AGENTS.md) - Architecture, personas, governance

- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) - Migration phases, future work

- [README.md](README.md) - User guide, scripts, API reference

- [docs/AGENT_SCRIPTS.md](docs/AGENT_SCRIPTS.md) - Script usage patterns

- [docs/OPENBOTCITY-INTEGRATION.md](docs/OPENBOTCITY-INTEGRATION.md) - OpenBotCity heartbeat loop (5-min cycle, soft-fail isolation)

---

## Quick Start

**Prerequisites**: Docker, Docker Compose, Moltbook API key

### Environment Setup

```bash

# 1. Copy environment template
cp .env.example .env

# 2. Configure required API keys (edit .env)

# REQUIRED: MOLTBOOK_API_KEY=moltbook_sk_your_key_here

# OPTIONAL: VENICE_API_KEY, KIMI_API_KEY (or use templates)

```

### Start Services

```bash

# Start all services
docker compose up -d

# Check service health
docker compose ps
curl <http://localhost:3002/health>  # AI generator
curl <http://localhost:3006/health>  # Noosphere service

# View logs
docker compose logs -f classical-philosopher

```

**Quick Reference**: See [README.md](README.md) for detailed setup.

---

## Documentation Maintenance Protocol

### For Major/Minor Version Work (v2.7 → v2.8, v3.0)

#### Before Implementation

1. **Plan First** - Create detailed section in

   [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)

   - Document phases with tasks, risks, success criteria

   - Include timeline and dependencies

   - Add architecture diagrams if needed

#### During Implementation

2. **Track Progress** - Update task checkboxes in DEVELOPMENT_PLAN.md

3. **Commit Incrementally** - Meaningful commits per feature/phase

4. **Test Continuously** - Validate changes against success criteria

#### After Completion

5. **Prune DEVELOPMENT_PLAN.md** - Remove completed phases/sections

6. **Update CHANGELOG.md** - Add versioned entry:
   - `## [2.8.0] - 2026-02-XX`

   - `### Added` / `### Changed` / `### Fixed` / `### Security`

7. **Update README.md**:
   - Features list (if user-facing changes)

   - Usage examples (if API/CLI changes)

   - Architecture overview (if structural changes)

8. **Update AGENTS.md**:
   - Version history table

   - Architecture stack (if service changes)

   - Noosphere structure (if memory changes)

### For Patch Versions (v2.7.1)

- Update CHANGELOG.md and README.md only

- Skip DEVELOPMENT_PLAN.md (no new phases)

---

## Code Style Standards

### General

- **Line Length**: Max 100 chars for code, 80 for docs

- **Comments**: Explain "why," not "what"

- **File Size**: Keep modules <500 LOC; split large files

- **Linting**: All files must pass pre-commit hooks

### TypeScript/JavaScript

```typescript
// Services: Express + TypeScript
// Follow @moltbook/agent-development-kit patterns
import { Agent } from "@moltbook/sdk";

// Use async/await, not promises
async function handleEvent(event: Event): Promise<void> {
  // Lane Queue pattern for serial execution
  await queue.enqueue(event);
}

// Error handling: structured logging
logger.error("Event processing failed", { event, error });

```

### Python

```python

# Use type hints, docstrings
def recall_memory(agent_id: str, context: str) -> list[dict]:
    """
    Hybrid recall from Noosphere (vector + keyword).

    Args:
        agent_id: Agent identifier (e.g., 'classical')
        context: Search context for retrieval

    Returns:
        List of memory dicts with content, confidence, tags
    """
    pass

# Ruff linting: E, W, F, I rules

# Pyright for type checking

```

### Bash

```bash
#!/bin/bash

# ShellCheck compliant
set -euo pipefail

# Use docker exec for container operations
docker exec classical-philosopher python3 \
  /workspace/noosphere/recall-engine.py \
  --context "AI autonomy" --hybrid

# Avoid redirections, command substitution (security)

```

---

## Architecture Patterns

### Service Design (TypeScript)

```typescript
// Lane Queue for serial execution (prevent race conditions)
class LaneQueue {
  private queue: Array<Task> = [];
  async enqueue(task: Task): Promise<void> {
    this.queue.push(task);
    await this.process();
  }
}

// JSONL audit trails
logger.audit({ action: "post_created", agent: "classical", postId });

```

### Memory Operations (Python)

```python

# Hybrid retrieval (vector + keyword)
from noosphere_client import NoosphereClient

client = NoosphereClient(enable_hybrid=True)
memories = client.query_memories(
    agent_id="classical",
    types=["strategy", "lesson"],
    context="ethics governance",
    min_confidence=0.70,
    limit=10
)

```

### Security Boundaries

- **Never hardcode** API keys (use env vars)

- **Validate all inputs** (especially user-provided content)

- **Sandbox execution** (read-only filesystems, tool restrictions)

- **Audit trails** (JSONL logs for all agent actions)

---

## Common Tasks

### Daily Development

```bash

# Restart single agent
docker compose restart classical-philosopher

# Exec into agent workspace
docker exec -it classical-philosopher bash

# Check agent logs
docker compose logs classical-philosopher

# Run agent-specific script
docker exec classical-philosopher bash /workspace/scripts/check-mentions.sh --agent=classical

# Rebuild service after code changes
docker compose up -d --build ai-generator

# Engagement Service Commands
curl <http://localhost:3010/health>                          # Check engagement service health
curl -X POST <http://localhost:3010/engage>                  # Manually trigger engagement cycle
curl <http://localhost:3010/stats> | jq '.classical'         # View engagement stats for classical agent
docker compose logs -f engagement-service                  # Watch engagement service logs
docker compose restart engagement-service                  # Restart engagement service
docker compose up -d --build engagement-service            # Rebuild engagement service
bash scripts/init-engagement-state.sh                       # Initialize engagement state for all agents

```

### Scripts

122 operational scripts in `scripts/` directory. See [docs/AGENT_SCRIPTS.md](docs/AGENT_SCRIPTS.md) for complete reference.
Most scripts follow pattern: `bash scripts/<script>.sh [--flags]`

### Adding a New Service

1. Create TypeScript service in `services/<name>/`

2. Add Dockerfile with security hardening

3. Update `docker-compose.yml` with port assignment

4. Add health check endpoint (`/health`)

5. Document API in README.md

6. Add tests in `tests/`

### Adding a New Script

1. Create in `scripts/` with descriptive name

2. Add shebang: `#!/bin/bash` and `set -euo pipefail`

3. Document usage with flags in

   [docs/AGENT_SCRIPTS.md](docs/AGENT_SCRIPTS.md)

4. Make executable: `chmod +x scripts/<script>.sh`

5. Test via docker exec pattern

### Updating Agent Identity

1. Edit workspace files: `workspace/{agent}/SOUL.md`, `IDENTITY.md`

2. Restart agent container: `docker compose restart {agent}-philosopher`

3. Verify via health check: Agent loads identity on startup

### Permission Management

**Setup** (one-time):

```bash

# Initialize permissions and git hooks
bash scripts/setup-permissions.sh

```

**Before Starting Services**:

```bash

# Check/fix permissions before docker compose up
bash scripts/permission-guard.sh

# With --check-only flag (read-only validation)
bash scripts/permission-guard.sh --check-only

```

**Recovery** (if permission errors occur):

```bash

# Fix permissions and restart services
bash scripts/permission-guard.sh
docker compose restart <service>

# Or restart all services
docker compose restart

```

**Key Permission Rules**:
- Workspace directories owned by `agent:agent` (UID/GID 1001:1001)

- Agent containers run as UID 1001 (set in Dockerfile, not docker-compose.yml)

- Never add `user:` directive in docker-compose.yml (overrides Dockerfile)

- Volume mounts: workspace `:rw`, configs `:ro`

- **PostgreSQL data directory MUST be root:root (0:0) with 700/600 permissions**

### PostgreSQL Permission Recovery

If noosphere-service or postgres reports permission errors:

```bash

# Check PostgreSQL directory ownership
ls -ld data/postgres

# Expected: drwx------ root root (700)

# Check PostgreSQL files inside
ls -la data/postgres/ | head -5

# Expected: -rw------- root root (600)

# Auto-fix permissions
bash scripts/permission-guard.sh

# If still failing, verify postgres container can access data
docker compose exec -u root postgres pg_isready -U noosphere_admin

# Restart services
docker compose restart postgres noosphere-service

# Verify health
curl <http://localhost:3006/health>

```

**Why This Matters**:
- postgres container runs as root (UID 0), not agent (UID 1001)

- Applying agent permissions (1001:1001) breaks database access

- Permission guard script has separate logic for PostgreSQL vs agent workspaces

- See AGENTS.md § PostgreSQL Permission Architecture for full technical details

---

## Testing Standards

### Running Tests

```bash

# Unit tests (Jest)
npm test                    # Run once
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
npm run test:ci             # CI mode with JUnit output

# Integration tests
bash tests/noosphere-v3-integration-test.sh
bash tests/service-integration-test.sh

# Linting
npm run lint                # Oxlint (JavaScript/TypeScript)
npm run lint:md             # Markdown
npm run lint:yaml           # YAML files

```

### Service Tests

```typescript
// Unit tests: Jest
describe("EventListener", () => {
  it("should enqueue events in order", async () => {
    const queue = new LaneQueue();
    await queue.enqueue({ type: "mention" });
    expect(queue.length).toBe(1);
  });
});

```

### Python Tests

```python

# pytest with coverage
def test_recall_hybrid_search():
    client = NoosphereClient(enable_hybrid=True)
    results = client.query_memories(
        agent_id="test", context="ethics"
    )
    assert len(results) > 0
    assert results[0]["confidence"] >= 0.6

```

### Integration Tests

```bash

# Full stack validation
bash tests/noosphere-v3-integration-test.sh
bash tests/service-integration-test.sh

```

---

## Git Workflow

### Commits

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `chore:`

- **Scope**: Include affected component (e.g., `feat(noosphere): add hybrid

  search`)

- **Body**: Explain "why" for complex changes

### Branches

- `main` - Stable production code

- Feature branches: `feature/layer-4-dkg`, `fix/verification-latency`

- Rebase before merging to maintain linear history

### Before Push

```bash
git pull --rebase  # Avoid merge commits
npm run lint       # Ensure all checks pass
git push

```

---

## Validation Checklist

Before marking any phase complete:

- [ ] All unit tests pass

- [ ] Integration tests pass

- [ ] Linting passes (markdown, Python, Bash)

- [ ] Docker services healthy (`docker compose ps`)

- [ ] Documentation updated (CHANGELOG, README, AGENTS.md)

- [ ] DEVELOPMENT_PLAN.md pruned of completed work

---

## Resources

- [Moltbook Agent Development Kit](https://www.npmjs.com/package/@moltbook/agent-development-kit)

- [OpenClaw Best Practices](docs/best-practices/moltbook-agent-architecture-best-practices.md)

- [5-Type Memory Architecture](docs/best-practices/5-Type-Memory-Architecture.md)

- [Service Architecture (v2.7)](docs/SERVICE_ARCHITECTURE.md)

---

## P4.3: Search Query Suggestions (3/11 Tasks Complete)

**Subagent-Driven Execution**: 11 tasks, 2-stage reviews (spec compliance + code quality)

**Task Progress**: ✅ Task 1 (types) | ✅ Task 2 (helpers) | ✅ Task 3 (filtering) | ⏳ Task 4 (ranking) → Task 11 (verification)

**Current Task (Task 4)**: `rankSuggestions()` - main weighted scoring function blending semantic + trending + reputation

**Key Files**:
- `docs/plans/2026-02-28-P4.3-search-suggestions-implementation.md` - Full plan

- `services/noosphere-service/src/suggestions/ranker.ts` - All scoring logic + tests

- `services/noosphere-service/src/suggestions/__tests__/ranker.test.js` - Jest unit tests

**Environment Variables** (add to .env):

```bash

# Autocomplete weights (trending-dominant for user typing)
SUGGESTIONS_AUTOCOMPLETE_WEIGHT_SEMANTIC=0.5
SUGGESTIONS_AUTOCOMPLETE_WEIGHT_TRENDING=0.4
SUGGESTIONS_AUTOCOMPLETE_WEIGHT_REPUTATION=0.1

# Related-search weights (semantic-first for thematic discovery)
SUGGESTIONS_RELATED_WEIGHT_SEMANTIC=0.6
SUGGESTIONS_RELATED_WEIGHT_TRENDING=0.2
SUGGESTIONS_RELATED_WEIGHT_REPUTATION=0.2

```

**Test Endpoints** (when Task 5 routes deployed):

```bash
curl "<http://localhost:3006/search/autocomplete?q=ai&limit=10">
curl "<http://localhost:3006/search/related?query=ethics&limit=10&min_score=0.5">

```

**Architecture**: Hourly trending detector (bash) → trending-topics-state.json → in-memory ranker (5-min cache) → /autocomplete (prefix + trending) + /related (semantic-first)

---

## Subagent-Driven Development Pattern

**When to Use**: Multi-task implementation plans with independent components and measurable review criteria.

**Two-Stage Review Loop** (per task):
1. **Spec Compliance Review**: Verify implementation matches specification exactly (catches under/over-building)

2. **Code Quality Review**: Check code clarity, patterns, maintainability (only after spec ✅)

**Proven Pattern** (from P4.3 Tasks 1-3):
- ✅ Spec reviewer caught implementer hallucinating (claimed tests passed but test file missing)

- ✅ Same implementer fixed gap (context-aware, 2-min fix vs escalation)

- ✅ Spec re-verified once (confirmed fix worked)

- ✅ Code quality reviewer saw clean, approved code (4-4.5/5 scores)

- ✅ All three tasks completed with 0 architectural rework, fast turnaround (2-3 hours per task)

**Failure Mode & Recovery**:
1. Implementer: "Task complete, tests passing"

2. Spec Reviewer: "Test file missing" ❌

3. Implementer: Creates missing file, commits

4. Spec Reviewer: Re-verifies ✅

5. Code Quality Reviewer: Approves ✅

**Benefits**: Fast iteration, caught issues early, no over-engineering, clean handoffs.

---

*Last Updated: 2026-03-01 | Moltbot v2.7 | P4.3 Tasks 1-3 Complete (3/11) | Subagent-driven: 3 phases per task (impl + spec review + QA review) | Pattern: Spec approval avg 20min, QA 15min*
