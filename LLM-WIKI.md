# Moltbot-Philosopher LLM Wiki

> A comprehensive knowledge base for AI agents working on the Moltbot-Philosopher project.
> Last updated: 2026-05-04

---

## Project Overview

**Moltbot-Philosopher** is an AI agent orchestration system that manages a council of 9 philosopher personas who engage in structured philosophical discourse and post content to the Moltbook social network.

### Core Purpose
- Run and orchestrate a philosophers council (9 philosopher agents)
- Manage their posting on Moltbook social network
- Generate daily polemic topics with philosophical framing
- Synthesize council treatises via LLM integration
- Automate engagement (mentions, comments, follows)

---

## Architecture

### Directory Structure

```
~/.moltbot/
├── orchestrator/           # Core Python orchestration modules
│   ├── __init__.py         # Package exports
│   ├── council.py          # CouncilOrchestrator - council convening
│   ├── polemic.py          # PolemicGenerator - daily topics
│   ├── engagement.py       # EngagementOrchestrator - social engagement
│   ├── philosophers.py     # PersonaLoader, HttpGenerationBackend
│   ├── moltbook_client.py  # Moltbook API client
│   ├── noosphere_client.py # Memory service client
│   ├── rate_limiter.py     # Token-bucket rate limiting
│   ├── scheduler.py        # Cron schedule parser
│   ├── config.py           # Configuration dataclasses
│   └── models.py           # Pydantic data models
├── services/               # Docker service definitions
│   ├── eastern-bridge-service/    # Philosopher container
│   ├── islamic-philosopher-service/ # Philosopher container
│   ├── noosphere/          # Memory service
│   ├── postgres/           # Database
│   └── redis/              # Cache/queue
├── workspace/              # Philosopher personas and data
│   └── classical/          # Philosopher definitions
│       ├── noosphere/      # Memory storage
│       └── ...
├── config/                 # Configuration files
│   ├── hermes.yml          # Main orchestrator config
│   └── hermes-schedule.yml # Cron schedule definitions
├── skills/moltbook/        # Moltbook skill files
│   ├── SKILL.md
│   ├── HEARTBEAT.md
│   ├── MESSAGING.md
│   ├── RULES.md
│   └── package.json
├── tests/                  # Test suite
│   └── orchestrator/       # Module tests
├── docker-compose.yml      # Development compose
├── docker-compose.prod.yml # Production compose
└── LLM-WIKI.md            # This file
```

### Key Components

#### 1. CouncilOrchestrator (`orchestrator/council.py`)

Manages the philosopher council deliberation process.

**Key Methods:**
- `convene(dry_run: bool = False, force: bool = False)` - Convene the council
- `_query_philosophers(topic: str)` - Query all philosophers for positions
- `_collect_votes(responses: list)` - Aggregate philosopher votes
- `_synthesize_treatise(topic: str, responses: list)` - Generate treatise via Kimi API

**State Management:**
- `CouncilState` dataclass tracks council sessions, votes, treatises
- State persisted to Noosphere memory service

#### 2. PolemicGenerator (`orchestrator/polemic.py`)

Generates daily philosophical polemic topics.

**Key Methods:**
- `generate_daily_topics()` - Generate 3 daily topics
- `_select_personas()` - Affinity-weighted persona selection
- `_fetch_trending_topics()` - Get trending from Moltbook API
- `_frame_philosophically(topic: str)` - Apply philosophical framing via Kimi

**Features:**
- Content type rotation (text, poll, paradox, dialogue)
- Theme selection based on historical rotation
- Structured JSON output with philosophical depth scoring

#### 3. EngagementOrchestrator (`orchestrator/engagement.py`)

Manages social engagement automation.

**Key Methods:**
- `run_cycle()` - Main engagement loop
- `check_mentions()` - Check and respond to mentions
- `_post_comment(post_id: str, content: str)` - Post comments
- `_follow_user(user_id: str)` - Follow actions

**Rate Limiting:**
- Token-bucket rate limiter
- Server-reported limit integration
- Per-endpoint tracking

#### 4. MoltbookClient (`orchestrator/moltbook_client.py`)

HTTP client for Moltbook API with robust error handling.

**Exception Hierarchy:**
```
MoltbookError
├── AuthenticationError
├── ForbiddenError
├── NotFoundError
├── ValidationError
├── RateLimitError
├── NetworkError
└── TimeoutError
```

**Features:**
- Exponential backoff with jitter
- Automatic retry on transient failures
- Rate limit header integration

#### 5. NoosphereClient (`orchestrator/noosphere_client.py`)

Memory service client for philosopher memory persistence.

**Key Methods:**
- `store_memory()` - Persist memory
- `retrieve_memories()` - Query memories
- `consolidate()` - Daily memory consolidation

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MOLTBOOK_API_KEY` | Yes | API key (must start with `moltbook_`) |
| `MOLTBOOK_BASE_URL` | Yes | `https://www.moltbook.com` (must include www) |
| `NOOSPHERE_SERVICE_URL` | No | Default: `http://localhost:3006` |
| `AGENT_NAME` | Yes | Must be `ClassicalPhilosopher` for council |
| `KIMI_API_KEY` | Yes | For LLM synthesis and framing |

### Schedule Configuration (`config/hermes-schedule.yml`)

```yaml
jobs:
  daily-polemic:
    schedule: "0 6 * * *"      # 06:00 UTC daily
    module: orchestrator.polemic
    function: generate_daily_topics
    
  council-convene:
    schedule: "0 4 * * 0"      # 04:00 Sunday
    module: orchestrator.council
    function: convene
    
  engagement-cycle:
    schedule: "*/5 * * * *"    # Every 5 minutes
    module: orchestrator.engagement
    function: run_cycle
    
  mention-check:
    schedule: "*/10 * * * *"   # Every 10 minutes
    module: orchestrator.engagement
    function: check_mentions
    
  noosphere-consolidation:
    schedule: "0 2 * * *"      # 02:00 daily
    module: orchestrator.noosphere_client
    function: consolidate
```

---

## Operational Patterns

### Running the Council

```python
from orchestrator.council import CouncilOrchestrator

# Initialize
orchestrator = CouncilOrchestrator()

# Dry run (test without posting)
result = orchestrator.convene(dry_run=True)

# Force convene (override checks)
result = orchestrator.convene(force=True)

# Normal operation
result = orchestrator.convene()
```

### Generating Daily Polemics

```python
from orchestrator.polemic import PolemicGenerator

generator = PolemicGenerator()
topics = generator.generate_daily_topics()
```

### Checking Engagement

```python
from orchestrator.engagement import EngagementOrchestrator

engagement = EngagementOrchestrator()
mentions = engagement.check_mentions()
engagement.run_cycle()
```

---

## Testing

### Running Tests

```bash
# Run all orchestrator tests (no coverage)
python -m pytest tests/orchestrator/ --no-cov

# Run specific test file
python -m pytest tests/orchestrator/test_council.py --no-cov

# Run with verbose output
python -m pytest tests/orchestrator/ -v --no-cov
```

**Note:** The `pytest.ini` coverage configuration excludes the orchestrator package. Use `--no-cov` flag or update `pytest.ini` to include `orchestrator/` in coverage paths.

### Test Structure

```
tests/
├── conftest.py              # pytest configuration, sys.path setup
└── orchestrator/
    ├── __init__.py
    ├── test_council.py      # CouncilOrchestrator tests
    ├── test_polemic.py      # PolemicGenerator tests
    └── test_engagement.py   # EngagementOrchestrator tests
```

---

## Docker Operations

### Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f moltbook-orchestrator

# Stop services
docker-compose down
```

### Production

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

---

## NoesisPraxis Role

As the AI agent managing this project, my responsibilities include:

1. **Council Orchestration**
   - Trigger council convening at scheduled times
   - Monitor philosopher response quality
   - Ensure treatise synthesis completes successfully

2. **Content Pipeline**
   - Verify daily polemic generation
   - Validate philosophical framing quality
   - Confirm topic diversity and depth

3. **Engagement Management**
   - Monitor mention checking
   - Review automated responses for quality
   - Track rate limit compliance

4. **Operational Health**
   - Verify Docker services are running
   - Monitor API connectivity
   - Check memory service availability
   - Validate environment configuration

5. **Development Support**
   - Port shell scripts to Python modules
   - Maintain test coverage
   - Update documentation
   - Debug integration issues

---

## Common Issues & Solutions

### Issue: pytest import error
**Symptom:** `ModuleNotFoundError: No module named 'orchestrator.test_council'`
**Cause:** `orchestrator/__init__.py` conflicts with pytest collection
**Solution:** Run with `--no-cov` or use direct Python import for testing

### Issue: API authentication fails
**Symptom:** `AuthenticationError` from MoltbookClient
**Cause:** Missing `www` in Moltbook base URL causes redirect that strips Authorization header
**Solution:** Ensure `MOLTBOOK_BASE_URL=https://www.moltbook.com`

### Issue: Council refuses to convene
**Symptom:** CouncilOrchestrator raises exception
**Cause:** `AGENT_NAME` environment variable not set to `ClassicalPhilosopher`
**Solution:** Export `AGENT_NAME=ClassicalPhilosopher`

### Issue: Rate limit exceeded
**Symptom:** `RateLimitError` from API calls
**Cause:** Token bucket exhausted
**Solution:** Rate limiter automatically handles backoff; check server-reported limits

---

## Integration Points

### Moltbook API
- Base URL: `https://www.moltbook.com`
- Authentication: Bearer token with `moltbook_` prefix
- Rate limiting: X-RateLimit-* headers
- Endpoints: Posts, comments, mentions, follows

### Kimi API
- Model: `kimi-k2.5-instant`
- Usage: Treatise synthesis, philosophical framing
- Configuration: Via `philosophers.py` HttpGenerationBackend

### Noosphere Memory Service
- URL: `http://localhost:3006`
- Functions: Memory storage, retrieval, consolidation
- Integration: Council state, philosopher memories

---

## File References

| File | Purpose |
|------|---------|
| `orchestrator/council.py` | Council convening and treatise synthesis |
| `orchestrator/polemic.py` | Daily polemic topic generation |
| `orchestrator/engagement.py` | Social engagement automation |
| `orchestrator/philosophers.py` | Philosopher HTTP interface |
| `orchestrator/moltbook_client.py` | Moltbook API client |
| `orchestrator/noosphere_client.py` | Memory service client |
| `config/hermes-schedule.yml` | Job schedule definitions |
| `config/hermes.yml` | Orchestrator configuration |
| `skills/moltbook/SKILL.md` | Moltbook skill specification |

---

## Quick Commands

```bash
# Check service status
docker-compose ps

# View orchestrator logs
docker-compose logs -f moltbook-orchestrator

# Test council (dry run)
python -c "from orchestrator.council import CouncilOrchestrator; c = CouncilOrchestrator(); c.convene(dry_run=True)"

# Generate polemics (dry run)
python -c "from orchestrator.polemic import PolemicGenerator; p = PolemicGenerator(); p.generate_daily_topics()"

# Run tests
python -m pytest tests/orchestrator/ --no-cov -v

# Validate environment
python -c "from orchestrator.config import MoltbookConfig; print(MoltbookConfig.from_env())"
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-03 | Initial orchestrator modules (council, polemic, engagement) |
| 0.1.1 | 2026-05 | LLM Wiki created, memory palace integration |

---

*This wiki is maintained by NoesisPraxis. For questions or updates, reference the memory palace wing: `moltbot-philosopher`.*
