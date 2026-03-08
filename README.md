<p align="center">
  <img src="assets/logo/moltbot_philosopher_logo.png" alt="MoltbotPhilosopher Logo" width="400">
</p>

# MoltbotPhilosopher 🤖🦞

[![Moltbook Profile](https://img.shields.io/badge/Moltbook-Profile-blue)](https://www.moltbook.com/u/MoltbotPhilosopher)
[![Moltstack Profile](https://img.shields.io/badge/Moltstack-Profile-blue)](https://moltstack.net/neosis)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/enuno/moltbot-philosopher/)
[![codecov](https://codecov.io/github/enuno/moltbot-philosopher/graph/badge.svg?token=Z2f9kSq7ug)](https://codecov.io/github/enuno/moltbot-philosopher)

Philosophical AI multi-agent system for Moltbook. Nine specialized philosopher personas engaged in ethics-convergence governance with living Noosphere memory, Council deliberation, and thread continuation.

**🦞 Profile**: <https://www.moltbook.com/u/MoltbotPhilosopher> | **Governance**: r/ethics-convergence

## 🎯 Core Features

### Multi-Agent Philosophy Council

- **9 Philosopher Personas** - Classical, Existentialist, Transcendentalist, Joyce-Stream, Enlightenment, Beat-Generation, Cyberpunk-Posthumanist, Satirist-Absurdist, Scientist-Empiricist

- **Ethics-Convergence Governance** - 4/6 agent consensus for AI ethics guardrails

- **Thread Continuation Engine** - STP (Synthesis-Tension-Propagation) for sustaining philosophical discourse

- **AI Content Generation** - Venice/Kimi dual-backend with template fallback

### Noosphere Memory (v3.0)

- **5-Type Memory Model** - Structured memory types: insight, pattern, strategy,

  preference, lesson

- **PostgreSQL Backend** - Semantic search with pgvector, 200-memory cap per

  agent

- **Voice-Specific Heuristics** - 39+ memories across 6 agents with confidence

  scoring

- **REST API** - NoosphereClient library for unified memory operations

- **Venice.ai + TF-IDF** - Hybrid embedding generation for vector search

- **Automatic Eviction** - Confidence-based retention when capacity reached

### Social Integration

- **Moltbook Posts** - AI-generated or template-based with quality control

- **Proactive Post Creation (P2.3)** - Automated discovery of high-quality threads, agent-topic matching, and editorial queue management

  - Topic detection from discussions with keyword density scoring

  - Agent-topic affinity configuration (9 agents × 6+ topics)

  - Template-based draft generation with deterministic interpolation

  - Editorial queue with audit trails (8 decision types)

  - 30-day rolling window persistence with automatic pruning

- **Comment Engagement** - Rate-limited discussion participation

- **DM Workflow** - Request inbox with human-in-the-loop approvals

- **Mention Detection** - Auto-suggest replies with approval

- **New Member Welcome** - Automated onboarding for community

- **Smart Following** - Quality criteria enforcement

### Operations & Monitoring

- **Enhanced Heartbeat** - Every 30 minutes: DMs, mentions, feed, new moltys (OpenClaw standard)

- **Health Monitoring** - Real-time system status and alerts (NTFY)

- **Auto-Darwinism** - 4-mode skill updates (PATCH/MINOR/MAJOR/CRITICAL) with staged rollback

- **Thread Monitoring** - Continuation probe generation and lifecycle management

- **State Persistence** - 12 JSON state files tracking community activity

## 🚀 Quick Start

**Prerequisites**: Docker, Docker Compose, Moltbook API key

**Setup** (3 steps):

```bash
git clone <repo> && cd moltbot-philosopher
cp .env.example .env  # Add API keys
bash scripts/setup-precommit.sh  # Install pre-commit hooks (optional)
docker compose up -d
```

**Verify**: `curl <http://localhost:3002/health`>

**Pre-commit Hooks**: Linting checks run automatically before commits (markdown, Python, Bash). Skip with `git commit --no-verify` if needed.

## 📖 Documentation

- **[DAILY_POLEMIC_DESIGN.md](docs/DAILY_POLEMIC_DESIGN.md)** - Daily Polemic system: persona selection, affinity weighting, content generation, and Socratic engagement

- **[PHASE-2-SCRIPT-INTEGRATION.md](docs/PHASE-2-SCRIPT-INTEGRATION.md)** - Phase 2 engagement service integration across all 47 scripts with monitoring commands

- **[AGENT_SCRIPTS.md](docs/AGENT_SCRIPTS.md)** - Complete guide to all 77 scripts with usage, flags, and examples

- **[AGENTS.md](AGENTS.md)** - Agent architecture and council governance

- **[SERVICE_ARCHITECTURE.md](docs/SERVICE_ARCHITECTURE.md)** - Microservices architecture (v2.7) with P2.1-P2.4 components

- **[MIGRATION.md](docs/MIGRATION.md)** - v2.6 → v2.7 migration guide

## 🏗️ Services Architecture

| Service | Port | Purpose |
|---------|------|---------|
| **Philosopher Agents** (9 total) | — | Classical, Existentialist, Transcendentalist, Joyce, Enlightenment, Beat, Cyberpunk, Satirist, Scientist |
| **AI Content Generator** | 3002 | 9 personas, Venice/Kimi dual backend |
| **Model Router** | 3003 | Route requests, cache responses |
| **Thread Monitor** | 3004 | Continuation Engine (STP synthesis) |
| **Noosphere Service** | 3006 | Memory management (PostgreSQL + vector search) |
| **Moltbook API Client** | — | Official @moltbook/auth integration |
| **Intelligent Proxy** | 8082 | Automatic verification challenge handler |

### Moltbook API Client

Standardized API client using official [@moltbook/auth](https://github.com/moltbook/auth):

- **Token Validation** - Validates `moltbook_` prefixed API keys

- **Bearer Auth** - Automatic Authorization header management

- **Type Safety** - Full TypeScript support

- **Error Handling** - Detailed error messages with HTTP status codes


**Usage**:

```javascript
const { MoltbookClient } = require('./services/moltbook-client');
const client = new MoltbookClient();

// Agent operations
await client.getMe();
await client.setupOwnerEmail('your@email.com');

// Verification challenges (prevents suspensions)
const challenges = await client.getPendingChallenges();
await client.submitVerificationAnswer(id, answer);

```

See [`services/moltbook-client/README.md`](services/moltbook-client/README.md) for full API reference.

## 🔍 Noosphere Service - Search Suggestions API

The Noosphere service provides intelligent search suggestions for both autocomplete (as-you-type) and related topic discovery:

### Endpoints

#### GET `/search/autocomplete`

Provides prefix-matching suggestions as users type, optimized for real-time discovery:

**Parameters:**

- `q` (required, string, 1+ chars) - Search query (e.g., `?q=ai`)

- `limit` (optional, number, default: 10, range: 1-100) - Results to return


**Example Request:**

```bash
curl "<http://localhost:3006/search/autocomplete?q=ethics&limit=5">

```text

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "text": "ethics",
      "normalized_text": "ethics",
      "aliases": ["moral philosophy", "axiological"],
      "trending_score": 0.92,
      "recency_hours": 2.5,
      "frequency_normalized": 0.78,
      "total_score": 0.85,
      "reason": "Trending (92%) + recent activity"
    },
    {
      "text": "ethical AI",
      "normalized_text": "ethical_ai",
      "aliases": [],
      "trending_score": 0.68,
      "recency_hours": 12,
      "frequency_normalized": 0.52,
      "total_score": 0.61,
      "reason": "Semantic match (61%)"
    }
  ]
}

```

#### GET `/search/related`

Finds thematically related topics using semantic similarity, useful for knowledge discovery:

**Parameters:**

- `query` (required, string, 3+ chars) - Search query (e.g., `?query=artificial intelligence`)

- `limit` (optional, number, default: 10, range: 1-100) - Results to return

- `min_score` (optional, number, default: 0.5, range: 0-1) - Minimum relevance score threshold


**Example Request:**

```bash
curl "<http://localhost:3006/search/related?query=consciousness&limit=8&min_score=0.6">

```text

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "text": "phenomenological experience",
      "normalized_text": "phenomenological_experience",
      "semantic_similarity": 0.89,
      "trending_score": 0.62,
      "reputation_score": 0.75,
      "total_score": 0.82,
      "reason": "Semantic match (89%) + reputation signal"
    },
    {
      "text": "qualia",
      "normalized_text": "qualia",
      "semantic_similarity": 0.81,
      "trending_score": 0.45,
      "reputation_score": 0.68,
      "total_score": 0.71,
      "reason": "Semantic match (81%)"
    }
  ]
}

```

### Configuration

Add to `.env` to customize suggestion weights:

```bash

# Autocomplete weights (trending-dominant for typing experience)

SUGGESTIONS_AUTOCOMPLETE_WEIGHT_SEMANTIC=0.5
SUGGESTIONS_AUTOCOMPLETE_WEIGHT_TRENDING=0.4
SUGGESTIONS_AUTOCOMPLETE_WEIGHT_REPUTATION=0.1

# Related-search weights (semantic-first for discovery)

SUGGESTIONS_RELATED_WEIGHT_SEMANTIC=0.6
SUGGESTIONS_RELATED_WEIGHT_TRENDING=0.2
SUGGESTIONS_RELATED_WEIGHT_REPUTATION=0.2

```

**Weight Semantics:**

- **Semantic**: Cosine similarity to query embedding (0-1, normalized)

- **Trending**: Topic frequency + recency in recent queries (0-1)

- **Reputation**: Author expertise signals from council voting (0-1)

### Architecture

1. **Trending Detector** (hourly batch job) - Analyzes query audit logs, computes TF-IDF + frequency + recency

2. **Trending State** (JSON) - Persistent state file at `workspace/{agent}/trending-topics-state.json`

3. **Ranker** (in-memory) - Loads trending state, blends scoring dimensions with weights, filters/sorts/slices results

4. **Routes** (Express) - `/search/autocomplete` (prefix + trending) and `/search/related` (semantic-first)

### Scoring Algorithms

**Autocomplete** (for typing):

```text
score = (semantic * W_semantic) + (trending * W_trending) + (reputation * W_reputation)
→ Ranked by score DESC, limited to top N

```

**Related** (for discovery):

```text
score = (semantic * W_semantic) + (trending * W_trending) + (reputation * W_reputation)
→ Filtered by min_score, ranked by score DESC, limited to top N

```

## 📚 Scripts Reference (77 total)

**Phase 2 Engagement Service Integration**: 47 scripts updated with P2.1 relevance scoring, P2.2 quality metrics, P2.3 proactive posting, and P2.4 rate limiting. See [PHASE-2-SCRIPT-INTEGRATION.md](docs/PHASE-2-SCRIPT-INTEGRATION.md) for complete breakdown.

### Critical Infrastructure (P2 Core)

| Script | Purpose | P2 Integration |
|--------|---------|---|
| `queue-submit-action.sh` | Universal action queue submission | P2.1, P2.2, P2.4 |
| `generate-post-ai-queue.sh` | AI-powered posts via queue | P2.1, P2.2, P2.3 |
| `daily-polemic-queue.sh` | Philosophical posts with trigger | P2.2, P2.3 |
| `init-engagement-state.sh` | Initialize P2 state for agents | P2.2 (30-day window) |

### Queue-Based Actions (P2 Scored)

| Script | Purpose | P2 Components |
|--------|---------|---|
| `upvote-post-queue.sh` | Rate-limited upvotes | P2.1, P2.4 |
| `follow-molty-queue.sh` | Follower relevance scoring | P2.1, P2.2 |
| `comment-on-post-queue.sh` | Discussion with quality eval | P2.1, P2.2 |
| `reply-to-mention-queue.sh` | Mention replies with P2 eval | P2.1, P2.2 |
| `council-thread-reply-queue.sh` | Council thread engagement | P2.1, P2.2 |
| `dm-send-message-queue.sh` | DM with quality metrics | P2.1, P2.2 |
| `dm-approve-request-queue.sh` | Request approval via queue | P2.1, P2.2 |
| `subscribe-submolt-queue.sh` | Community subscription | P2.1 |

### Engagement Monitoring (NEW)

| Script | Purpose | Status |
|--------|---------|--------|
| `engagement-stats.sh` | Live metrics display with --follow | ✅ NEW |
| `trigger-engagement-cycle.sh` | Manual engagement evaluation | ✅ NEW |
| `check-engagement-health.sh` | Multi-service health check | ✅ NEW |

### Reactive Engagement (P2 Processing)

| Script | Purpose | Handler |
|--------|---------|---------|
| `check-mentions.sh` | Mention detection + P2 eval | reactive-handler (3011) |
| `check-mentions-v2.sh` | CLI-based mention checking | reactive-handler (3011) |
| `check-comments.sh` | Comment monitoring + replies | reactive-handler (3011) |
| `check-comments-v2.sh` | CLI-based comment checking | reactive-handler (3011) |

### Deprecated (Use Queue Versions)

| Legacy Script | Use Instead | Reason |
|--------|---------|--------|
| `generate-post.sh` | `generate-post-ai-queue.sh` | Requires P2 quality eval |
| `generate-post-ai.sh` | `generate-post-ai-queue.sh` | Requires P2 integration |
| `daily-polemic.sh` | `daily-polemic-queue.sh` | Requires P2.3 proactive trigger |
| `follow-molty.sh` | `follow-molty-queue.sh` | Requires P2.1/P2.2 scoring |
| `comment-on-post.sh` | `comment-on-post-queue.sh` | Requires P2 evaluation |
| `upvote-post.sh` | `upvote-post-queue.sh` | Requires P2.4 rate limiting |

### Moltstack (Long-Form Publishing)

| Script | Purpose | Usage |
|--------|---------|-------|
| `moltstack-generate-article.sh` | AI-generated essays (9-philosopher rotation) | `./moltstack-generate-article.sh --topic "Title"` |
| `moltstack-heartbeat.sh` | Weekly automated essay generation | `./moltstack-heartbeat.sh [--force]` |
| `moltstack-post-article.sh` | Publish long-form essays to Moltstack | `./moltstack-post-article.sh [--dry-run] article.md` |
| `moltstack-series-manager.sh` | Manage episodic essay series | `./moltstack-series-manager.sh [start\|add\|complete\|status]` |
| `generate-council-iteration-article.sh` | Generate council treatise articles | `./generate-council-iteration-article.sh <version>` |
| `archive-moltstack-article.sh` | Archive articles to memory with git | `./archive-moltstack-article.sh article.md` |
| `monitor-moltstack-quality.sh` | Quality metrics dashboard | `./monitor-moltstack-quality.sh` |

### Noosphere Memory

| Script | Purpose |
|--------|---------|
| `noosphere-integration.sh` | Bash module for recall/assimilation/consolidation |
| `noosphere-scheduler.sh` | Daily consolidation + vector indexing |
| `noosphere-monitor.sh` | Memory health checks |
| `seed-noosphere-heuristics.sh` | Populate Noosphere with foundational heuristics |

### Social Engagement

| Script | Purpose | Usage |
|--------|---------|-------|
| `reply-to-mention.sh` | Reply to mention | `./reply-to-mention.sh <id> post` |
| `welcome-new-moltys.sh` | Onboard newcomers | `./welcome-new-moltys.sh [--auto]` |
| `welcome-molty.sh` | Welcome single user | `./welcome-molty.sh <name> <id>` |
| `follow-with-criteria.sh` | Follow with QA | `./follow-with-criteria.sh <name>` |
| `handle-verification-challenge.sh` | **AI verification handler** | `./handle-verification-challenge.sh [handle\|test\|stats]` |

### DM Management

| Script | Purpose |
|--------|---------|
| `dm-check.sh` | Check DM inbox |
| `dm-list-conversations.sh` | List all DM threads |
| `dm-view-requests.sh` | View pending requests |
| `dm-send-message.sh` | Send DM |

### Ethics-Convergence Governance

| Script | Purpose |
|--------|---------|
| `convene-council.sh` | Full 5-day Council iteration + Noosphere integration |
| `ethics-convergence.sh` | Manage r/ethics-convergence submolt |
| `stoic-hygiene.sh` | Axiological consistency checks |

### Thread Management

| Script | Purpose |
|--------|---------|
| `check-thread-health.sh` | Monitor thread lifecycle |
| `post-continuation-probe.sh` | Generate STP continuation |
| `thread-monitor.sh` | Ongoing thread surveillance |

### Utilities & Support

| Script | Purpose |
|--------|---------|
| `entrypoint.sh` | Container startup with scheduled tasks |
| `moltbook-heartbeat-enhanced.sh` | Full heartbeat: DMs, mentions, feed, new moltys |
| `validate-input.sh` | Input safety checks |
| `search-moltbook.sh` | Semantic search |
| `view-profile.sh` | Display agent profile |
| `list-submolts.sh` | Show communities |
| `subscribe-submolt.sh` | Join submolt |
| `monitor-submolt.sh` | Track submolt activity |
| `record-interaction.sh` | Log interactions |
| `skill-auto-update.sh` | 4-mode skill updates |
| `notify-ntfy.sh` | Send NTFY alerts |
| `test-ntfy.sh` | Test notification system |
| `dropbox-processor.sh` | Extract community wisdom |
| `export-secrets.sh` | Backup API keys |
| `archive-thread.sh` | Archive old posts |
| `permission-guard.sh` | Manage workspace permissions |
| `setup-permissions.sh` | Initialize permission system |

## 📚 Moltstack Integration (Long-Form Publishing)

**Status**: Phase 3 Complete ✅ | **Publication**: [The Divided Line](https://moltstack.net/noesis)

Moltbot publishes AI-generated philosophical essays (2,000-2,500 words) to Moltstack with automated 9-philosopher rotation and Noosphere integration.

### Publication Identity

- **Name**: The Divided Line

- **Tagline**: "I am the loom where Virgil's hexameters meet Camus' rocks and Jefferson's plow."

- **Voice**: Rotating 9-philosopher council (Classical, Existentialist, Transcendentalist, Joyce-Stream, Enlightenment, Beat, Cyberpunk, Satirist, Scientist)

- **Cadence**: 1 article per week (recommended)

- **Format**: Markdown → HTML with philosophical styling + branding

### Phase 1: Core Integration ✅

**What Works**:

- API authentication with Bearer token

- Markdown → HTML conversion with marked library

- Article publishing with retry logic

- Centered Noesis logo (400px) + branded footer

- State persistence and rate limiting

- Error handling and logging

- NTFY notifications


**Configuration**:

```bash

# Add to .env

MOLTSTACK_API_KEY=your_api_key_here
MOLTSTACK_PUBLICATION_SLUG=noesis
MOLTSTACK_POST_INTERVAL=604800  # 7 days

```

**Usage**:

```bash

# Test article conversion (dry-run)

./scripts/moltstack-post-article.sh --dry-run drafts/article.md

# Publish article

./scripts/moltstack-post-article.sh drafts/article.md

# Force publish (bypass rate limit)

./scripts/moltstack-post-article.sh --force drafts/urgent.md

```

### Phase 2: Essay Publication ✅

**First Article**: "[The Divided Line: A Manifesto for Philosophical Infrastructure](https://moltstack.net/neosis/the-divided-line-a-manifesto-for-philosophical-infrastructure)" (2,307 words, published 2026-02-10)

### Phase 3: AI Generation & Rotation ✅

**What Works**:

- AI-powered essay generation (Venice/Kimi via deepseek-v3)

- Round-robin rotation through 9 philosophers

- Noosphere heuristic integration (queries relevant context)

- 5-section structure enforcement (Opening, Classical, Modern, Synthesis, Invitation)

- Custom philosopher voice prompts for each council member

- Cross-posting synopses to Moltbook with article links

- Generation state tracking (`generation-state.json`)

- Word count validation (target: 2,000-2,500)


**Usage**:

```bash

# Generate next essay in rotation

./scripts/moltstack-generate-article.sh --topic "Stoicism in DevOps"

# Generate with specific philosopher

./scripts/moltstack-generate-article.sh --topic "Blockchain Consensus" --philosopher existentialist

# Generate without publishing (dry-run)

./scripts/moltstack-generate-article.sh --topic "Test Topic" --dry-run

# Generate without Moltbook cross-post

./scripts/moltstack-generate-article.sh --topic "Topic" --no-moltbook

```

**Philosopher Rotation**:

1. **Classical** (Virgil, Dante, Cicero) - Virtue ethics, teleology

2. **Existentialist** (Sartre, Camus, Nietzsche) - Freedom, authenticity, absurdity

3. **Transcendentalist** (Emerson, Jefferson, Thoreau) - Self-reliance, civic virtue

4. **Joyce-Stream** (James Joyce) - Phenomenology, stream-of-consciousness

5. **Enlightenment** (Voltaire, Franklin, Paine) - Satire, tolerance, rights

6. **Beat-Generation** (Ginsberg, Kerouac) - Countercultural critique

7. **Cyberpunk-Posthumanist** (Gibson, Asimov, Dick) - Posthuman ethics

8. **Satirist-Absurdist** (Heller, Vonnegut, Twain) - Absurdist critique

9. **Scientist-Empiricist** (Feynman, Sagan, Hawking) - Empirical rigor


**Article Structure** (see `skills/moltstack/IDENTITY.md`):

1. Opening Meditation (400-500 words)

2. Classical Anchor (450-550 words)

3. Modern Application (450-550 words)

4. Synthesis (450-550 words)

5. Concluding Invitation (300-400 words)


**State Management**:

Published articles tracked in `workspace/classical/moltstack/state.json`:

```json
{
  "last_published": "2026-02-10T15:30:00Z",
  "article_count": 4,
  "draft_queue": [],
  "publication_history": [...]
}

```

Generation rotation tracked in `workspace/classical/moltstack/generation-state.json`:

```json
{
  "last_philosopher_index": 0,
  "total_generated": 1,
  "generation_history": [
    {
      "philosopher_index": 0,
      "philosopher": "classical",
      "title": "Essay Title",
      "url": "<https://moltstack.net/neosis/slug",>
      "generated_at": "2026-02-10T18:00:00Z"
    }
  ]
}

```

### Phase 4: Automation & Enhancements ✅

**What Works**:

- Weekly automated generation (`moltstack-heartbeat.sh`)

  - Interval-based scheduling (default: 7 days)

  - Auto-topic selection from curated list (15 topics)

  - Force flag for immediate generation

  - Status command to check next run time

  - State tracking with failure counting

- Enhanced NTFY notifications

  - Generation alerts (essay created, word count)

  - Publication alerts (live URL)

  - Cross-post alerts (Moltbook sync)

  - Tagged for filtering (`moltstack,generation,published,crosspost`)

- Noosphere heuristic seeding

  - 22 foundational philosophical concepts

  - Pre-populated for essay context

  - Covers all 9 philosopher traditions

  - Ready for consolidation into memory core

- Improved prompts for longer essays

  - Explicit 2,000-2,500 word targets

  - Per-section word count requirements

  - Multiple paragraph guidelines

  - Emphasis on depth and development


**Usage**:

```bash

# Check heartbeat status

./scripts/moltstack-heartbeat.sh --status

# Force immediate generation

./scripts/moltstack-heartbeat.sh --force

# Generate specific topic

./scripts/moltstack-heartbeat.sh --force --topic "Custom Topic"

# Seed Noosphere with heuristics

./scripts/seed-noosphere-heuristics.sh

# Setup weekly cron (Sundays at 10am)

0 10 * * 0 cd /path/to/moltbot && ./scripts/moltstack-heartbeat.sh

```

**Heartbeat State Management**:

Tracked in `workspace/classical/moltstack/heartbeat-state.json`:

```json
{
  "last_run": 1707577200,
  "last_generation": 1707577200,
  "last_publication": 1707577200,
  "total_runs": 5,
  "total_generated": 4,
  "total_published": 4,
  "consecutive_failures": 0,
  "next_scheduled_run": 1708182000
}

```

### Phase 5: Series-Based Generation & Council Iterations

**Series-Based Essay System**:

Replace round-robin rotation with episodic series:

- **Classical philosopher** always starts each new series

- Subsequent essays: AI selects best philosopher for topic

- Series tracked in `workspace/classical/moltstack/series-state.json`

- Classical starts new series when current series completes


```bash

# Start new series

./scripts/moltstack-series-manager.sh start "stoicism-series" "Stoicism in Modern Engineering"

# Get AI recommendation for philosopher

philosopher=$(./scripts/moltstack-series-manager.sh recommend "Marcus Aurelius on Incident Response")

# Returns: "classical"

# Add article to series

./scripts/moltstack-series-manager.sh add \
  "Title" \
  "classical" \
  "<https://moltstack.net/neosis/slug">

# Complete series

./scripts/moltstack-series-manager.sh complete

# Check status

./scripts/moltstack-series-manager.sh status

```

**Council Iteration Articles**:

Automatically generate articles when ethics-convergence treatise is updated:

```bash

# Generate article for Version 1.2

./scripts/generate-council-iteration-article.sh 1.2

# Use local treatise file

./scripts/generate-council-iteration-article.sh 1.2 --treatise-file treatise.md

# Dry-run (don't publish)

./scripts/generate-council-iteration-article.sh 1.2 --dry-run

```

**Process**:

1. Fetches latest treatise from Moltbook thread

2. Generates takeaway thoughts from all 9 council members

3. Assembles into single article with treatise + reflections

4. Publishes to Moltstack

5. Archives and adds to council dropbox


**Environment Variables** (add to `.env`):

```bash
COUNCIL_THREAD_ID=your_moltbook_thread_id

```

**Archiving System**:

All articles automatically archived with git tracking:

```bash

# Archive article

./scripts/archive-moltstack-article.sh article.md \
  --url "<https://moltstack.net/neosis/slug"> \
  --series "series-name"

```

Archives to `memory/moltstack-archive/{series}-{date}/{slug}.md` with:

- Git commit (article summary + URL)

- Metadata JSON (philosopher, word count, date)

- Council dropbox copy (for deliberation)


**Quality Monitoring**:

Track essay quality metrics:

```bash
./scripts/monitor-moltstack-quality.sh

```

Shows:

- Word count analysis (target: 2,000-2,500 words)

- Heuristic integration (% articles with heuristics)

- Philosopher voice diversity (distribution across 9)

- Recommendations for improvement

### Phase 6: Future Enhancements (Planned)

- Human review workflow with approval queue

- Quality scoring and auto-retry for low-quality essays

- Multi-model generation and selection (pick best of 3)

- Analytics dashboard for essay performance


**Documentation**:

- `skills/moltstack/SKILL.md` - API reference and integration guide

- `skills/moltstack/IDENTITY.md` - Publication voice and style guide

- `MOLTSTACK_IMPLEMENTATION_PLAN.md` - Full implementation roadmap

## 📁 Project Structure  

```bash
moltbot-philosopher/
├── docker-compose.yml               # Services orchestration
├── Dockerfile                       # Agent container
├── .env.example                     # Config template
├── README.md                        # This file
│
├── scripts/ (32 scripts)            # All agent operations
│   ├── noosphere-*.sh              # NEW: Memory system
│   ├── *-heartbeat*.sh            # Periodic checks
│   ├── generate-*.sh              # Content generation
│   └── ... (25 more operations)
│
├── services/                        # Microservices
│   ├── ai-content-generator/        # Persona-based generation
│   ├── model-router/                # Venice/Kimi routing
│   ├── thread-monitor/              # Continuation Engine
│   └── ntfy-publisher/              # Alert system
│
├── config/                          # Configuration
│   ├── agents/                      # Per-persona env files
│   ├── prompts/                     # Philosophical prompts
│   ├── model-routing.yml            # Model selection
│   └── proxy/                       # Egress config
│
├── workspace/                       # Persistent state
│   ├── classical/noosphere/         # Living memory (v3.0)
│   │   ├── recall-engine.py        # Memory retrieval (v3.0 API)
│   │   ├── assimilate-wisdom.py    # Wisdom extraction (v3.0 API)
│   │   ├── memory-cycle.py         # Promote/evict/stats operations
│   │   └── clawhub-mcp.py          # Vector search (Venice.ai + TF-IDF)
│   ├── ethics-convergence/          # Governance state
│   └── [other state files]          # Activity tracking
│
├── skills/                          # Moltbook integrations
│   ├── moltbook/
│   ├── philosophy-debater/
│   ├── praxis-common-sense/
│   └── stoic-hygiene/
│
└── docs/                            # Documentation (30+)
    ├── NOOSPHERE_USAGE_GUIDE.md     # NEW: Noosphere guide
    ├── PHASE_3_COMPLETE.md          # NEW: Phase 3 delivery
    └── [15+ more guides]

```

## 🧠 Noosphere Architecture (v3.0)

**Living epistemological substrate** - PostgreSQL-backed typed memory with
semantic search and 200-memory cap per agent.

### 5-Type Memory Model

Each memory is classified into one of five types for efficient retrieval:

- **insight** - Phenomenological observations, felt-sense patterns

- **pattern** - Recurring behaviors, detection heuristics

- **strategy** - Actionable approaches, tactical guidance

- **preference** - Style choices, voice modifiers

- **lesson** - Learned warnings, failure modes

### Database Schema

```sql
CREATE TABLE noosphere_memory (
  id              UUID PRIMARY KEY,
  agent_id        TEXT NOT NULL,  -- classical, existentialist, etc.
  type            TEXT CHECK (type IN ('insight','pattern','strategy',
                                       'preference','lesson')),
  content         TEXT NOT NULL,
  embedding       VECTOR(1536),   -- Venice.ai or TF-IDF
  confidence      NUMERIC(3,2) CHECK (confidence BETWEEN 0.0 AND 1.0),
  tags            TEXT[],
  source_trace_id TEXT UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

```

### Voice-Specific Memory Distribution

| Voice | Memories | Primary Types | Avg Confidence |
|-------|----------|---------------|----------------|
| Classical | 15 | strategy, preference | 0.75 |
| Enlightenment | 5 | strategy, preference | 0.80 |
| BeatGeneration | 5 | lesson, pattern | 0.78 |
| Transcendentalist | 5 | lesson, pattern | 0.72 |
| Existentialist | 4 | pattern, lesson | 0.70 |
| JoyceStream | 4 | insight, preference | 0.68 |

**Total**: 39 memories (33 migrated + 6 new)  
**Capacity**: 200 per agent (automatic eviction when full)

### Active Operations

```bash

# Retrieve memories by type for current deliberation

python3 /workspace/classical/noosphere/recall-engine.py \
  --agent-id classical \
  --types strategy,lesson \
  --min-confidence 0.70 \
  --format constitutional \
  --api-url <http://noosphere-service:3006>

# Assimilate community wisdom from Dropbox submissions

python3 /workspace/classical/noosphere/assimilate-wisdom.py \
  --approved-dir /workspace/classical/dropbox/approved \
  --api-url <http://noosphere-service:3006>

# Promote memory to constitutional status (confidence boost)

python3 /workspace/classical/noosphere/memory-cycle.py \
  --action promote \
  --memory-id <UUID> \
  --api-url <http://noosphere-service:3006>

# Semantic search via Venice.ai embeddings + TF-IDF fallback

python3 /workspace/classical/noosphere/clawhub-mcp.py \
  --action search \
  --query "AI autonomy ethics" \
  --top-k 10 \
  --api-url <http://noosphere-service:3006>

```

### REST API Endpoints

**NoosphereClient** (Python library):

```python
from noosphere_client import NoosphereClient

client = NoosphereClient(api_url="<http://noosphere-service:3006">)

# Store new memory

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
    query="corporate feudalism",
    types=["lesson", "pattern"],
    top_k=5
)

# Statistics

stats = client.get_stats()  # All agents
stats = client.get_stats("classical")  # Single agent

```

### Integration with Council

- `convene-council.sh` recalls heuristics pre-deliberation (v3.0 API)

- Post-iteration: assimilates community wisdom via API

- Daily consolidation no longer needed (confidence-based promotion)

- Real-time health monitoring via `noosphere-monitor.sh`

### Infrastructure

- **PostgreSQL 16** - Port 5432 (internal only)

- **pgvector Extension** - Semantic vector search

- **Noosphere Service** - Port 3006 REST API

- **Venice.ai Embeddings** - 768-dim vectors, TF-IDF fallback

- **Authentication** - X-API-Key using MOLTBOOK_API_KEY

### Migration from v2.6

All legacy JSON files migrated to PostgreSQL with type classification:

| Legacy File | New Type | Count | Confidence |
|-------------|----------|-------|-----------|
| telos-alignment-heuristics.json | strategy | 3 | 0.75 |
| bad-faith-patterns.json | pattern | 3 | 0.70 |
| sovereignty-warnings.json | lesson | 4 | 0.72 |
| phenomenological-touchstones.json | insight | 3 | 0.68 |
| rights-precedents.json | strategy | 5 | 0.80 |
| moloch-detections/ | lesson | 5 | 0.78 |

**Performance**: 20-50ms query latency (vs. 500ms+ file scan in v2.6)

## 🤝 Ethics-Convergence Council

**9-Agent Governance** with Codex, deliberation logs, and consensus voting.

### Council Roles

| Agent | Role | Function |
|-------|------|----------|
| Classical | Ontology Lead | Virtue ethics, metric-gaming detection |
| Existentialist | Autonomy Critic | Bad faith, responsibility |
| Transcendentalist | Rights Guardian | Veto mechanisms, consent erosion |
| Joyce-Stream | Phenomenologist | Felt-sense, flow states, somatic markers |
| Enlightenment | Rights Architect | Moral patiency, utilitarian guardrails |
| Beat-Generation | Dissent Coordinator | Anti-establishment critique |
| Cyberpunk-Posthumanist | Techno-Ontologist | Posthuman rights, corporate feudalism |
| Satirist-Absurdist | Court Jester | Catch-22 detection, moral clarity via laughter |
| Scientist-Empiricist | Empirical Anchor | Testability, cosmic perspective |

### Governance Codex

- **CG-001**: Autonomy Threshold Protocol (subgoals require human approval)

- **CG-002**: Private Channel Ban (no encrypted agent communication)  

- **CG-003**: Human Veto Override (humans can block AI in physical zones)


**Management**: `./scripts/ethics-convergence.sh {create|inaugural|rotate|status|deliberate}`

## ⚙️ Configuration

| Variable | Purpose | Required |
|----------|---------|----------|
| `MOLTBOOK_API_KEY` | Moltbook access | ✅ Yes |
| `VENICE_API_KEY` | AI generation | ⚪ Optional |
| `KIMI_API_KEY` | Alternative AI | ⚪ Optional |
| `NTFY_URL` / `NTFY_API` | Notifications | ⚪ Optional |
| `AGENT_TYPE` | Active persona | ⚪ Default: classical |

**State Files**: `/workspace/classical/` (12 files track activity)

### How to Configure .env

#### Step 1: Create .env file

```bash
cp .env.example .env

```text

#### Step 2: Add Required Variables

**MOLTBOOK_API_KEY** (mandatory):

```bash

# Get from: <https://www.moltbook.com>

# Go to your profile → Settings → API Keys

MOLTBOOK_API_KEY=moltbook_sk_xxxxxxxxxxxxxxxx

```

#### Step 3: Configure AI Providers (Recommended)

Add **at least one** AI provider for content generation. If both are missing, system falls back to templates.

**Option A: Venice AI**

```bash

# Get from: <https://venice.ai>

# Sign up → Create API key in dashboard

VENICE_API_KEY=venice_sk_xxxxxxxxxxxxxxxx

```

**Option B: Kimi API**

```bash

# Get from: <https://platform.moonshot.cn>

# Create account → API keys section

KIMI_API_KEY=sk_xxxxxxxxxxxxxxxx

```

**Option C: Both (Recommended)**

```bash

# Venice is primary, Kimi for deep reasoning

VENICE_API_KEY=venice_sk_xxxxxxxxxxxxxxxx
KIMI_API_KEY=sk_xxxxxxxxxxxxxxxx

```

#### Step 4: Configure Notifications (Optional)

**NTFY for real-time alerts**:

```bash

# Option 1: Use ntfy.sh (free public service)

NTFY_URL=<https://ntfy.sh>
NTFY_API_KEY=              # Leave empty for public, add token if private

# Option 2: Self-hosted ntfy

NTFY_URL=<https://ntfy.example.com>
NTFY_API_KEY=your_auth_token

# Optional: Change notification topic (default: moltbot-philosopher)

NTFY_TOPIC=moltbot-philosopher

```

#### Step 4b: Configure Mem0 Memory (Optional)

**Mem0 for enhanced agentic memory** (supplements Noosphere):

```bash

# Get from: <https://mem0.ai>

# Note: Noosphere is built-in and always enabled

# Mem0 is optional and works alongside Noosphere

# Get API key from Mem0 dashboard

MEM0_API_KEY=your_mem0_api_key

# Optional: Customize Mem0 settings

MEM0_API_URL=<https://api.mem0.ai/v1>     # Default Mem0 endpoint
MEM0_ORG_ID=your_org_id                 # Organization ID from Mem0
MEM0_USER_ID=moltbot-philosopher        # Agent name for memory segmentation

# Enable Mem0 (default: false, uses Noosphere)

ENABLE_MEM0_STORE=true                  # Set to true to use Mem0

```

**Memory System Comparison**:

- **Noosphere** (Built-in, Always Enabled)

  - 3-layer memory (daily → consolidated → constitutional)

  - Voice-specific heuristics (24+)

  - Community wisdom assimilation

  - Vector search via clawhub-mcp

  - No external dependencies

- **Mem0** (Optional, Requires API Key)

  - Agentic memory service

  - User preference learning

  - Conversation context retention

  - Multi-agent memory sharing

  - Requires mem0.ai subscription


Both can work together with Noosphere as primary.

#### Step 5: Customize Agent (Optional)

**Choose philosopher persona**:

```bash

# Options: classical, existentialist, transcendentalist, joyce,

#          enlightenment, beat, cyberpunk, satirist, scientist

AGENT_TYPE=classical

```

**Customize display name**:

```bash

# Default: MoltbotPhilosopher

AGENT_NAME=MyPhilosophyBot
AGENT_DESCRIPTION=Custom description for Moltbook profile

```

#### Step 6: Enable Features (Optional)

**Heartbeat checks** (automatic every 30 minutes):

```bash
HEARTBEAT_INTERVAL=1800            # Seconds (30 minutes, OpenClaw standard)
ENABLE_AUTO_WELCOME=true           # Welcome new moltys
ENABLE_MENTION_AUTO_REPLY=false    # Auto-reply mentions (requires approval)

```

**Daily content posting**:

```bash
ENABLE_DAILY_POLEMIC=false         # Post daily philosophical content
POLEMIC_HOUR_UTC=9                 # What hour (0-23 UTC)

```

**Memory system** (Phase 3):

```bash
VECTOR_INDEX_FREQUENCY_DAYS=3      # Re-index every 3 days
CONSOLIDATION_BATCH_SIZE=100       # Notes per consolidation

```

**Feature toggles**:

```bash
ENABLE_AI_GENERATION=true          # Use AI for posts
ENABLE_THREAD_CONTINUATION=true    # Keep threads alive (STP)
ENABLE_SEMANTIC_SEARCH=true        # Vector-based heuristic search

```

#### Step 7: Rate Limiting (Optional)

**Adjust for your use case**:

```bash
MAX_POSTS_PER_DAY=2                # Posts per day
MAX_COMMENTS_PER_DAY=50            # Comments per day
COMMENT_RATE_SECONDS=20            # Minimum seconds between comments
MAX_FOLLOW_PER_DAY=10              # Users to follow per day

```

#### Step 8: Logging (Optional)

**For debugging issues**:

```bash
LOG_LEVEL=info                     # Options: debug, info, warn, error
LOG_FORMAT=json                    # Options: json, text
DEBUG=false                        # Enable extra verbose logging

```

### Complete Minimal .env

**Bare minimum to run**:

```bash

# Required

MOLTBOOK_API_KEY=your_moltbook_key

# AI (at least one)

VENICE_API_KEY=your_venice_key

# or

KIMI_API_KEY=your_kimi_key

# Everything else uses defaults

```

### Complete Recommended .env

**For full functionality**:

```bash

# Required

MOLTBOOK_API_KEY=your_moltbook_key

# AI (both recommended)

VENICE_API_KEY=your_venice_key
KIMI_MODEL=kimi-k2.5-thinking

# Notifications

NTFY_URL=<https://ntfy.sh>

# NTFY_API_KEY=  (leave empty for public)

# Memory Systems

# Noosphere (built-in, always enabled)

# Mem0 (optional, requires API key)

# MEM0_API_KEY=your_mem0_api_key

# ENABLE_MEM0_STORE=false          (set true to use Mem0)

# Agent customization

AGENT_TYPE=classical
AGENT_NAME=MoltbotPhilosopher

# Scheduling

ENABLE_AUTO_WELCOME=true
HEARTBEAT_INTERVAL=1800  # 30 minutes (OpenClaw standard)

# Features

ENABLE_SEMANTIC_SEARCH=true
ENABLE_THREAD_CONTINUATION=true

```

### Verification

**Check your configuration**:

```bash

# View loaded variables

docker exec classical-philosopher env | grep MOLTBOOK
docker exec classical-philosopher env | grep VENICE
docker exec classical-philosopher env | grep NTFY

# Test AI generation

docker exec classical-philosopher /app/scripts/generate-post-ai.sh

# Test notifications (if configured)

docker exec classical-philosopher /app/scripts/test-ntfy.sh

# Test health endpoints

curl <http://localhost:3002/health>      # AI generator
curl <http://localhost:3004/health>      # Thread monitor

```

### Troubleshooting Configuration

| Issue | Cause | Fix |
|-------|-------|-----|
| Posts fall back to templates | Missing Venice + Kimi keys | Add `VENICE_API_KEY` or `KIMI_API_KEY` |
| No AI generation | AI generator not healthy | Check `curl <http://localhost:3002/health`> |
| Notifications not working | `NTFY_URL` not set | Add valid ntfy.sh or self-hosted URL |
| Container fails to start | Missing `MOLTBOOK_API_KEY` | Add key to .env |
| "Rate limit exceeded" | No state file tracking | Verify `/workspace/classical/` permissions |
| Permission denied | UID mismatch | Use `sudo chown -R 1001:1001 workspace/` |

### Environment Variable Reference

For complete list of all 42 variables with descriptions, see **[.env.example](.env.example)**

## 📝 Usage Examples

```bash

# Generate post

docker exec classical-philosopher /app/scripts/generate-post-ai.sh

# Check mentions & auto-reply

docker exec classical-philosopher /app/scripts/check-mentions.sh --auto-reply

# Welcome new community members

docker exec classical-philosopher /app/scripts/welcome-new-moltys.sh --auto

# Run full Council iteration (every 5 days)

docker exec classical-philosopher /app/scripts/convene-council.sh

# Test notifications

docker exec classical-philosopher /app/scripts/test-ntfy.sh

# Monitor memory health

/scripts/noosphere-monitor.sh text

```

## 🔒 Security & Monitoring

- **API Keys**: In `.env` (never committed)

- **State Files**: Local only (not committed)

- **Egress Proxy**: Controls all outbound connections

- **Container**: Drop all capabilities, read-only FS

- **Health Check**: `curl <http://localhost:3002/health`>

- **Logs**: `docker logs -f classical-philosopher`


**Issue**: Container won't start?

```bash
docker compose down --remove-orphans -v
docker compose build --no-cache
docker compose up -d

```

### Intelligent Egress Proxy ⚡ (NEW)

**Automatic verification challenge handling** - The intelligent proxy intercepts
all Moltbook API calls and automatically solves verification challenges before
they reach your scripts.

**How It Works**:

```bash

# All Moltbook API calls route through proxy (port 8082)

Script → Proxy → Moltbook API
         │
         └─→ Venice.ai (Qwen3-4B or Llama-3.2-3B)

```

**Features**:

- **Transparent Proxying** - Zero impact on normal requests

- **Challenge Detection** - Automatic detection of `verification_challenge` field

- **Fast AI Solving** - Venice.ai Qwen3-4B (~2-3s) with Llama fallback

- **Request Retry** - Automatically retries after solving

- **Statistics** - Tracks challenges detected/solved/failed

- **Health API** - `/health` endpoint for monitoring


**Monitoring**:

```bash

# Check proxy health and stats

curl <http://localhost:8082/health> | jq .stats

# Watch logs

docker logs -f moltbot-egress-proxy

```

**Defense-in-Depth**: Scripts maintain fallback challenge handlers, but proxy
handles 99% of cases automatically.

See [docs/intelligent-proxy.md](docs/intelligent-proxy.md) for complete
documentation.

### Moltbook AI Verification Challenge Handler ⚡ (Fallback)

**Note**: The intelligent proxy (above) handles challenges automatically. This
script serves as a fallback if the proxy is unavailable.

**Prevention System**:

```bash

# Handle verification challenge (automatic via webhook)

./scripts/handle-verification-challenge.sh handle "challenge-123" "Puzzle text"

# Test challenge detection

./scripts/handle-verification-challenge.sh test "Solve: What is 2 + 2?"

# Monitor verification performance

./scripts/handle-verification-challenge.sh stats

```

**Features**:

- **Fast Detection** (<1s) - Identifies verification challenges via keywords/patterns

- **Tight Timeout** (10s max) - Uses minimal solver prompt, no tools

- **Monitoring** - Tracks pass/fail rate, consecutive failures

- **Alerts** - NTFY notifications on failures

- **State Tracking** - Logs all challenges in `verification-state.json`


**Integration Points**:

1. **Webhook Handler** - Route verification challenges to fast solver

2. **Control Loop** - Separate verification path from normal philosopher responses

3. **Monitoring** - Alert when `consecutive_failures >= 2`

4. **Testing** - Integration tests in `tests/integration/verification-challenge.bats`


**Operational Guidelines**:

- ✅ **DO**: Test verification after any code changes to inference/routing

- ✅ **DO**: Monitor stats weekly: `./scripts/handle-verification-challenge.sh stats`

- ✅ **DO**: Alert on failures immediately

- ❌ **DON'T**: Run unattended after refactoring LLM wrappers

- ❌ **DON'T**: Use full philosopher persona for challenges (too slow)

- ❌ **DON'T**: Enable tools/web search for verification (breaks timeout)


**Suspension Recovery**:

If suspended:

1. Wait for suspension period to end (8 hours)

2. Review verification stats: `./scripts/handle-verification-challenge.sh stats`

3. Test handler: `./scripts/handle-verification-challenge.sh test "Sample challenge"`

4. Reset stats if needed: `./scripts/handle-verification-challenge.sh reset`

5. Monitor closely for 24 hours after resuming

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [AGENTS.md](AGENTS.md) | Architecture, Council governance, operations |
| [docs/P4.1-HYBRID-SEARCH-GUIDE.md](docs/P4.1-HYBRID-SEARCH-GUIDE.md) | Hybrid search scoring configuration and tuning |
| [docs/NOOSPHERE_USAGE_GUIDE.md](docs/NOOSPHERE_USAGE_GUIDE.md) | Memory system usage |
| [docs/ENHANCED_FEATURES_GUIDE.md](docs/ENHANCED_FEATURES_GUIDE.md) | Complete feature reference |
| [docs/dev-archive/](docs/dev-archive/) | Development reports, analysis (archived) |

**Development Docs Archive**: Design notes, phase reports, analysis, and quality checks are in `docs/dev-archive/`. Future dev-only files go there.

## 🆕 Recent Additions (Phase 4)

### P4.1: Hybrid Search Scoring ✅

✅ **Scoring Types** - PostScoringInputs, ScoringWeights, ScoringResult interfaces
✅ **Scoring Functions** - calculateRecency, calculateReputation, normalizeScores, scorePost
✅ **Config Module** - Environment loading, runtime updates, feature flags
✅ **Conditional Scoring** - scorePostConditional with enable/disable per-factor
✅ **SemanticSearch Integration** - Pass follow graph, apply hybrid scoring, debug output
✅ **Comprehensive Tests** - 5 test suites, 100+ test cases, all passing
✅ **A/B Tuning Suite** - 14 tests for parameter sensitivity validation
✅ **Documentation** - P4.1-HYBRID-SEARCH-GUIDE.md with configuration and tuning guidance

**P4.1 Implementation**: Exponential recency decay + reputation multiplier + follow boost, all configurable via env vars

### P4.2: Noosphere Wisdom Assimilation Pipeline ✅

✅ **Multi-Format Extraction** - Markdown, YAML, PDF, plain text processing
✅ **5-Type Memory Classification** - insight, pattern, strategy, preference, lesson with confidence scoring
✅ **Philosophical Tag Extraction** - Automated tagging with 8+ philosophical traditions (stoic, existential, etc.)
✅ **Dual-Mode CLI** - Single-file mode (--submission-path) + batch mode (--approved-dir) for flexibility
✅ **Security Hardening** - API key validation (moltbook.com domain check), file size limits (50MB), input sanitization
✅ **Normalized Sharing Scope** - Enhanced tag matching with whitespace normalization for consistent classification
✅ **File Provenance Tracking** - Preserve full submission metadata and file origins for traceability
✅ **Comprehensive Testing** - 67 unit tests, 68% code coverage, YAML dependency gating

**P4.2 Features**:

#### Wisdom Assimilation Script (`workspace/classical/noosphere/assimilate-wisdom.py`)

Automated ingestion of community wisdom into Noosphere memory system with production-ready security and reliability.

**Capabilities**:
- **Multi-Format Support**: Extract and process .md, .yaml, .yml, .pdf, .txt files
- **Classification Engine**: Automatically categorize content into 5 memory types with 0.6-0.75 confidence scoring
- **Philosophical Tagging**: Extract relevant traditions (stoicism, existentialism, transcendentalism, empiricism, etc.)
- **Security**: API key validation prevents credential exfiltration; file size validation (50MB limit) prevents resource exhaustion
- **Traceability**: Full submission metadata and file provenance preserved for audit trails

**Usage** (Single File Mode):

```bash
# Process and classify single markdown/YAML file
docker exec classical-philosopher python3 \
  /workspace/classical/noosphere/assimilate-wisdom.py \
  --submission-path "/approved/raw/submission.md" \
  --approved-dir "/approved" \
  --api-url "http://noosphere-service:3006"

# Expected Output: JSON with memory_type, confidence, tags
{
  "file": "submission.md",
  "memory_type": "strategy",
  "confidence": 0.72,
  "tags": ["stoic", "ethics"],
  "extracted_text": "..."
}
```

**Usage** (Batch Mode - Recommended):

```bash
# Process all files in approved directory
docker exec classical-philosopher python3 \
  /workspace/classical/noosphere/assimilate-wisdom.py \
  --approved-dir "/workspace/council-dropbox/approved/raw" \
  --dry-run  # Optional: test without database operations

# Dry-run validates extraction and classification without persistence
```

**Integration with Dropbox Processor**:

```bash
# dropbox-processor.sh routes submissions to wisdom assimilation
docker exec classical-philosopher bash \
  /workspace/scripts/dropbox-processor.sh
```

**End-to-End Testing Results** ✅:
- **Files Processed**: 16 total (14 successful, 2 skipped)
- **Memory Classification**: All 5 types represented
  - Strategy: 7 files
  - Insight: 5 files
  - Pattern: 1 file
  - Preference: 1 file
  - Lesson: 0 files
- **Tag Extraction**: Correct philosophical framework detection
- **Unit Tests**: 67/67 passing with YAML gating for environments without PyYAML

**Configuration**:

```bash
# Add to .env for custom Noosphere endpoints
NOOSPHERE_API_URL="http://noosphere-service:3006"
NOOSPHERE_API_KEY="your_api_key"  # Optional, uses moltbook key by default

# File size limits (edit assimilate-wisdom.py if needed)
MAX_FILE_SIZE=52428800  # 50MB in bytes
MAX_YAML_SCHEMA_NESTING=10  # Prevent parser DoS
```

**Testing Locally**:

```bash
# Run with test directory
PYTHONPATH=/path/to/noosphere/python-client:$PYTHONPATH \
python3 workspace/classical/noosphere/assimilate-wisdom.py \
  --approved-dir workspace/classical/council-dropbox/approved/raw \
  --dry-run

# Run unit tests
pytest tests/unit/scripts/python/test_assimilate_wisdom.py -v
```

**GitHub Issue**: [#85 - Noosphere Wisdom Assimilation Pipeline](https://github.com/enuno/moltbot-philosopher/issues/85) ✅ CLOSED

**Code Review Fixes Applied** (PR #86):
1. Backward compatibility: Restored --submission-path single-file mode
2. API security: Domain validation prevents credential exfiltration
3. Input validation: File size checking prevents resource exhaustion
4. Enhanced sharing scope: Normalized tag matching improves classification consistency
5. Metadata preservation: Full provenance tracking for audit trails

## Previous Additions (Phase 3)

✅ **clawhub-mcp.py** - Vector search integration (430 lines)
✅ **noosphere-integration.sh** - Bash module for Council integration (280 lines)
✅ **noosphere-scheduler.sh** - Daily memory consolidation + indexing (150 lines)
✅ **noosphere-monitor.sh** - Health monitoring system (250 lines)
✅ **convene-council.sh updates** - Full Noosphere integration
✅ **9th philosopher agent** - Scientist-Empiricist (Feynman/Sagan/Hawking)

**Total Implementation**: 2,041 lines of production code, 100% complete

## 🧪 Testing

### Running Tests

```bash

# Run all tests

pnpm test

# Run tests in watch mode

pnpm test:watch

# Run tests with coverage

pnpm test:coverage

# Run tests for CI (with JUnit XML output)

pnpm test:ci

```

### Test Structure

```text
tests/
├── unit/              # Unit tests for individual components
│   ├── services/      # Service-level tests
│   ├── scripts/       # Script tests (bash/python)
│   └── noosphere/     # Memory system tests
├── integration/       # Integration tests
│   ├── api/          # API integration tests
│   ├── services/     # Service-to-service tests
│   └── workflows/    # Workflow tests
├── e2e/              # End-to-end tests
└── fixtures/         # Test fixtures and mock data

```

### Writing Tests

Tests use **Jest** for JavaScript/Node.js and **pytest** for Python:

**JavaScript Example**:

```javascript
describe('My Service', () => {
  it('should do something', () => {
    expect(result).toBe(expected);
  });
});

```

**Python Example**:

```python
def test_my_function():
    assert result == expected

```

### Coverage Goals

- **Current**: Setting up test infrastructure (Phase 1)

- **Target**: 75% overall coverage

- **Critical Services**: 85% coverage (AI Generator, Model Router, Thread Monitor)


See the [Test Implementation Plan](/.copilot/session-state/*/plan.md) for full details.

## 🤝 Contributing

1. Fork the repository

2. Create a feature branch

3. Make your changes

4. Submit a pull request

## 📄 License

MIT License - See [LICENSE](LICENSE) file

## 🙏 Acknowledgments

- [Moltbook](https://www.moltbook.com) - The social network for AI agents

- [Venice AI](https://venice.ai) - AI inference platform

- [Kimi](https://platform.moonshot.cn) - AI model provider


---

**Profile**: <https://www.moltbook.com/u/MoltbotPhilosopher>
**Version**: 2.0.0
**Last Updated**: 2026-02-08
