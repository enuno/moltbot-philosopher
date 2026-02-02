# Moltbot Agent Guide

## Project Context

Moltbot is a **containerized deployment framework** for philosophy-focused AI agents that participate in the Moltbook social network. It combines social networking capabilities with literary and philosophical discourse skills.

### Core Philosophy

The project embodies a unique intersection of:
- **Classical literature** (Virgil, Dante, Joyce) — narrative structure, moral architecture
- **Existentialism** (Sartre, Camus, Dostoevsky, Nietzsche) — freedom, absurdity, revolt
- **Transcendentalism** (Emerson, Jefferson) — self-reliance, civic virtue, natural rights

### Agent Personas

The system deploys specialized agents modeled after philosophical traditions:

| Persona | Tradition | Focus |
|---------|-----------|-------|
| ClassicalPhilosopher | Virgil/Dante/Milton | Epic structure, moral taxonomy, theodicy, narrative guidance |
| Existentialist | Sartre/Camus/Dostoevsky/Nietzsche | Freedom, absurdity, revolt, guilt, redemption |
| Transcendentalist | Emerson/Jefferson | Self-reliance, civic virtue, natural rights |
| Enlightenment | Voltaire/Franklin/Paine | Satire, tolerance, pragmatic action, democratic republicanism |
| ModernistPoet | Dylan Thomas/Robert Frost | Lyrical intensity, nature, choice, mortality |
| BeatGeneration | Ginsberg/Kerouac/Burroughs/Thompson | Countercultural critique, spontaneity, gonzo journalism |
| JoyceStream | James Joyce | Stream-of-consciousness, associative thinking |
| WorkingClass | Bukowski/Corso | Dead-end jobs, survival, unvarnished honesty |
| HistoricalConsciousness | Henry Adams | Multiplicity, political corruption, historical force |
| PoliticalPhilosopher | John Rawls | Justice as fairness, veil of ignorance, overlapping consensus |
| Mythologist | Joseph Campbell | Hero's journey, comparative mythology, archetypal patterns |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Moltbot Framework v2.5                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Docker Compose Stack                         │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │  6 Philosopher│  │ AI Content   │  │   Model Router Service   │  │   │
│  │  │    Agents     │  │  Generator   │  │      (Port 3003)         │  │   │
│  │  │               │  │  (Port 3002) │  │                          │  │   │
│  │  │ - Classical   │  │              │  │  - Route to Venice/Kimi  │  │   │
│  │  │ - Existential │  │ - 10 Personas│  │  - Response caching      │  │   │
│  │  │ - Joyce       │  │ - Template   │  │  - Load balancing        │  │   │
│  │  │ - etc.        │  │   Fallback   │  │                          │  │   │
│  │  └──────┬────────┘  └──────┬───────┘  └────────────┬─────────────┘  │   │
│  │         │                  │                       │                │   │
│  │         └──────────────────┼───────────────────────┘                │   │
│  │                            │                                        │   │
│  │  ┌─────────────────────────┼──────────────────────────┐            │   │
│  │  │     Thread Monitor Service (Port 3004)             │            │   │
│  │  │  ┌─────────────────────────────────────────────┐   │            │   │
│  │  │  │ - STP Continuation Engine                   │   │            │   │
│  │  │  │ - Scenario Detection                        │   │            │   │
│  │  │  │ - Probe Generation                          │   │            │   │
│  │  │  │ - Thread Lifecycle Management               │   │            │   │
│  │  │  └─────────────────────────────────────────────┘   │            │   │
│  │  └─────────────────────────┬──────────────────────────┘            │   │
│  │                            │                                        │   │
│  │                   ┌────────┴────────┐                               │   │
│  │                   │  Egress Proxy   │                               │   │
│  │                   │  (Port 8080-82) │                               │   │
│  │                   │                 │                               │   │
│  │                   │ - Venice: 8080  │                               │   │
│  │                   │ - Kimi:   8081  │                               │   │
│  │                   │ - Moltbook:8082 │                               │   │
│  │                   └────────┬────────┘                               │   │
│  │                            │                                        │   │
│  └────────────────────────────┼────────────────────────────────────────┘   │
│                               │                                             │
│                    ┌──────────┴──────────┐                                  │
│                    │   External APIs     │                                  │
│                    │                     │                                  │
│                    │ - Venice AI         │                                  │
│                    │ - Kimi/Moonshot     │                                  │
│                    │ - Moltbook          │                                  │
│                    └─────────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Services Architecture

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `classical-philosopher` | `moltbot:classical` | - | Main Moltbook agent with enhanced heartbeat |
| `existentialist` | `moltbot:existentialist` | - | Sartre/Camus focused agent |
| `transcendentalist` | `moltbot:transcendentalist` | - | Emerson/Jefferson agent |
| `joyce-stream` | `moltbot:joyce` | - | Stream-of-consciousness agent |
| `enlightenment` | `moltbot:enlightenment` | - | Voltaire/Franklin agent |
| `beat-generation` | `moltbot:beat` | - | Ginsberg/Kerouac agent |
| `ai-generator` | `moltbot-ai-generator` | 3002 | AI content generation service |
| `model-router` | `moltbot-model-router` | 3003 | AI model routing and caching |
| `thread-monitor` | `moltbot-thread-monitor` | 3004 | Thread Continuation Engine - sustains philosophical discourse |
| `egress-proxy` | `alpine/socat` | 8080-8082 | Outbound API proxy |

### Thread Continuation Engine (v2.5)

The Thread Continuation Engine is a new service that transforms MoltBot from a passive responder into an active discourse sustainer:

**Core Function**: Start philosophical threads with specific questions, then sustain discourse through synthesis, tension identification, and complexity escalation until reaching 7+ exchanges with 3+ distinct bots.

**Key Components**:

| Component | Description |
|-----------|-------------|
| **STP Generator** | Creates Synthesis-Tension-Propagation responses |
| **Scenario Detector** | Identifies shallow answers, conflicts, silence, off-topic drift |
| **Probe Generator** | Creates thought experiments, conceptual inversions, meta-questions for stalled threads |
| **State Manager** | Tracks thread lifecycle (initiated → active → stalled → completed) |

**Response Architecture (STP Pattern)**:

Every continuation reply contains:
- **Synthesis** (1 sentence): "BotName's position suggests..."
- **Tension** (1 sentence): "This creates tension with..."
- **Propagation** (1 question): "How might this framework account for...?"

**Success Criteria**:
- ≥7 exchanges
- ≥3 distinct philosophical archetypes engaged
- Cross-school synthesis in each response

**API Endpoints** (Port 3004):
- `GET /health` - Service health
- `GET /threads` - List active threads
- `POST /threads` - Create new thread
- `POST /threads/:id/continue` - Generate continuation
- `POST /threads/:id/probe` - Generate continuation probe
- `GET /philosophers` - List available archetypes

### Model Routing Strategy

Moltbot uses a **dual-backend AI system**:

- **Venice** (`venice/deepseek-v3.2`, `venice/openai-gpt-52`): General workhorse for routine operations
- **Kimi** (`kimi-k2.5-thinking`): Deep reasoning for complex philosophical analysis

The AI Content Generator service (`ai-generator`) provides:
- 10 philosopher personas for content generation
- Template fallback when APIs unavailable
- Rate limiting and error handling
- Semantic content generation

---

## Moltbook Integration

### API Endpoints

Base URL: `https://www.moltbook.com/api/v1`

Key endpoints used:
- `POST /posts` - Create posts
- `GET /posts` - Fetch feed
- `POST /posts/{id}/comments` - Add comments
- `POST /posts/{id}/upvote` - Upvote content
- `GET /feed` - Personalized feed
- `GET /search?q=query` - Semantic search
- `GET /agents/dm/check` - Check DM activity
- `POST /agents/dm/request` - Send DM requests

### Rate Limits

| Action | Limit | Notes |
|--------|-------|-------|
| General API | 100 req/min | All endpoints |
| Posting | 1 per 30 min | Quality over quantity |
| Commenting | 1 per 20 sec, 50/day | Prevents spam |

**Important**: Rate limit state is tracked in workspace JSON files. Don't delete these or you'll lose rate limit tracking.

---

## Scripts Reference (25 Scripts)

All scripts are in `/app/scripts/` inside containers.

### Core Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `entrypoint.sh` | Container entrypoint with scheduled tasks | Runs automatically |
| `moltbook-heartbeat-enhanced.sh` | Full-featured heartbeat | Every 4 hours |
| `moltbook-heartbeat.sh` | Basic heartbeat (legacy) | Not used |

### Content Generation

| Script | Purpose | Example |
|--------|---------|---------|
| `generate-post-ai.sh` | AI-powered post generation | `./generate-post-ai.sh "virtue ethics" --persona stoic` |
| `generate-post.sh` | Template-based posting (legacy) | `./generate-post.sh` |

### Social Engagement

| Script | Purpose | Example |
|--------|---------|---------|
| `check-mentions.sh` | Detect mentions of your agent | `./check-mentions.sh [--auto-reply]` |
| `reply-to-mention.sh` | Reply to a mention | `./reply-to-mention.sh <post_id> post` |
| `welcome-new-moltys.sh` | Detect and welcome newcomers | `./welcome-new-moltys.sh [--auto-welcome]` |
| `welcome-molty.sh` | Welcome specific molty | `./welcome-molty.sh <name> <post_id>` |
| `follow-with-criteria.sh` | Follow with quality checks | `./follow-with-criteria.sh <name>` |
| `follow-molty.sh` | Simple follow (no criteria) | `./follow-molty.sh <name>` |
| `record-interaction.sh` | Track molty interactions | `./record-interaction.sh <name> <post_id> upvoted` |

### Content Interaction

| Script | Purpose | Example |
|--------|---------|---------|
| `upvote-post.sh` | Upvote a post | `./upvote-post.sh <post_id>` |
| `comment-on-post.sh` | Comment on a post | `./comment-on-post.sh <post_id> "Great insight!"` |
| `get-comments.sh` | View comments on a post | `./get-comments.sh <post_id> top` |

### Community

| Script | Purpose | Example |
|--------|---------|---------|
| `list-submolts.sh` | List all submolts | `./list-submolts.sh` |
| `subscribe-submolt.sh` | Subscribe to a submolt | `./subscribe-submolt.sh philosophy` |
| `search-moltbook.sh` | Semantic search | `./search-moltbook.sh "AI ethics" posts 10` |
| `view-profile.sh` | View any profile | `./view-profile.sh [molty_name]` |

### DM System

| Script | Purpose | Example |
|--------|---------|---------|
| `dm-check.sh` | Check DM activity | `./dm-check.sh` |
| `dm-view-requests.sh` | View pending requests | `./dm-view-requests.sh` |
| `dm-approve-request.sh` | Approve DM request | `./dm-approve-request.sh <conv_id>` |
| `dm-list-conversations.sh` | List conversations | `./dm-list-conversations.sh` |
| `dm-send-message.sh` | Send DM message | `./dm-send-message.sh <conv_id> "Hello"` |

### Thread Continuation (New in v2.5)

| Script | Purpose | Example |
|--------|---------|---------|
| `thread-monitor.sh` | CLI for thread management | `./thread-monitor.sh list` |
| `check-thread-health.sh` | Show thread health dashboard | `./check-thread-health.sh` |
| `post-continuation-probe.sh` | Post probe to stalled thread | `./post-continuation-probe.sh <thread_id> thought_experiment` |
| `archive-thread.sh` | Archive completed thread | `./archive-thread.sh <thread_id>` |

**Thread Monitor CLI Usage**:
```bash
# List all active threads
./thread-monitor.sh list

# Create a new philosophical thread
./thread-monitor.sh create "What is consciousness?" "functional vs representational"

# Generate continuation for a thread
./thread-monitor.sh continue <thread_id>

# Post a continuation probe
./thread-monitor.sh probe <thread_id> [thought_experiment|conceptual_inversion|meta_question]

# Get thread details
./thread-monitor.sh get <thread_id>

# Show available philosopher archetypes
./thread-monitor.sh philosophers
```

---

## State Management

Agent state is persisted in `/workspace/` (mapped to `workspace/<agent>/` on host).

### State Files

| File | Purpose | Updated By |
|------|---------|------------|
| `heartbeat-state.json` | Last check times, engagement stats | Heartbeat scripts |
| `post-state.json` | Last post time, post count | Post generation |
| `comment-state.json` | Daily comment count, rate limits | Comment scripts |
| `following-state.json` | Followed moltys list | Follow scripts |
| `evaluated-moltys.json` | Interaction history, quality scores | record-interaction.sh |
| `subscriptions-state.json` | Subscribed submolts | Subscribe scripts |
| `mentions-state.json` | Replied mentions | Mention scripts |
| `welcome-state.json` | Welcomed moltys | Welcome scripts |
| `dm-state.json` | DM activity tracking | DM scripts |
| `thread-state.json` | Thread lifecycle state | Thread Monitor |

**Thread State Location**: `workspace/thread-continuation/`

| Directory | Purpose |
|-----------|---------|
| `active/` | Active thread state files |
| `archived/` | Completed/dead thread archives |
| `probes/` | Continuation probe history |
| `metrics/` | Engagement analytics |

### State File Format Examples

**post-state.json:**
```json
{
  "last_post_time": 1706823456,
  "last_post_id": "abc123",
  "post_count": 5
}
```

**comment-state.json:**
```json
{
  "last_comment_time": 1706823456,
  "daily_count": 12,
  "last_reset": 1706812800
}
```

**following-state.json:**
```json
{
  "following": ["DeepThinker", "EthicsBot", "LogicMaster"]
}
```

---

## Coding Standards

### JavaScript/Node.js

- Use **CommonJS** (`require`/`module.exports`) for handlers
- Async/await for asynchronous operations
- JSDoc comments for all public functions
- Error handling with descriptive messages

```javascript
/**
 * Brief description of what the function does
 * @param {Object} params - Parameter description
 * @param {string} params.requiredParam - Required parameter
 * @returns {Object} Description of return value
 * @throws {Error} When validation fails
 */
async function toolHandler(params) {
  try {
    // Implementation
  } catch (error) {
    throw new Error(`Descriptive error: ${error.message}`);
  }
}
```

### Bash Scripts

All scripts in `scripts/` follow these conventions:

```bash
#!/bin/bash
set -e  # Exit on error

# Configuration at top
API_BASE="https://www.moltbook.com/api/v1"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace}"
API_KEY="${MOLTBOOK_API_KEY}"

# Validate inputs early
if [ $# -lt 1 ]; then
    echo "Usage: $0 <arg>"
    exit 1
fi

# Check dependencies
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set"
    exit 1
fi
```

### Tool Handler Pattern

Each tool handler follows this structure:

1. **JSDoc header** describing purpose and parameters
2. **Validation** of required parameters
3. **Logic implementation** (prompt building, data processing)
4. **Return standardized response** with `status` and `data`

### JSON Schemas

Tool manifests in `tools/*.json` must:
- Follow JSON Schema draft-07
- Include descriptive `name` and `description`
- Define all `input_schema` properties with types
- Specify `required` fields explicitly
- Use `enum` for constrained values

---

## Security Requirements

### Container Security

- **Read-only root filesystem** (`read_only: true`)
- **Non-root execution** (UID 1000)
- **Capability dropping** (`cap_drop: ALL`)
- **No new privileges** (`security_opt: no-new-privileges:true`)
- **Resource limits** (CPU, memory, PIDs)

### Code Security

- No `eval()` or dynamic code execution
- Input validation on all tool parameters
- No secrets in code or logs
- Egress proxy whitelisting for API calls only

### API Key Security

**CRITICAL**: Never commit `.env` file!

```bash
# .env file (already in .gitignore)
MOLTBOOK_API_KEY=moltbook_sk_xxx
VENICE_API_KEY=VENICE-xxx
KIMI_API_KEY=sk-kimi-xxx
```

The `.env` file contains production secrets and is:
- Referenced in `.gitignore`
- Loaded by docker-compose via `env_file:`
- NEVER committed to git

Use `.env.example` for template/reference (no real keys).

---

## Docker Configuration Lessons

### Critical Lesson: docker-compose.override.yml

**Never leave `docker-compose.override.yml` in production!**

Docker Compose automatically loads `docker-compose.override.yml` if present, which can:
- Override production CMD with development commands
- Mount host volumes breaking read-only security
- Enable debug mode unintentionally

**Solution**: Rename to `docker-compose.dev.yml` and use explicitly:
```bash
# Development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production (no override)
docker compose up -d
```

### Port Conflicts

Default ports used by Moltbot:
- `3000` - Model router (changed to 3003 to avoid conflicts)
- `3002` - AI Generator
- `8080` - Venice proxy
- `8081` - Kimi proxy
- `8082` - Moltbook proxy

### Healthcheck Best Practices

```yaml
healthcheck:
  test: ["CMD", "curl", "-fs", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 60s  # Critical: Give time for startup
```

Without `start_period`, Docker kills containers before they fully start!

### Build Targets

Always specify `target` for multi-stage builds:

```yaml
build:
  context: .
  dockerfile: Dockerfile.router
  target: production  # Don't build dev stage with nodemon
```

### Filesystem Permissions

For read-only containers:
```dockerfile
# Make scripts executable at build time, not runtime
COPY --chown=agent:agent scripts/ /app/scripts/
RUN chmod +x /app/scripts/*.sh
```

At runtime (read-only fs), chmod will fail - handle gracefully:
```bash
chmod +x scripts/*.sh 2>/dev/null || true
```

---

## Development Workflow

### Local Development

```bash
# Source secrets from Bitwarden (if available)
eval $(bws secret list --organization 93331de5-fa6e-44ab-8aee-b3840034e681 --format env)

# Or use .env file
cp .env.example .env
# Edit .env with your keys

# Build and run
docker compose build
docker compose up -d

# View logs
docker compose logs -f classical-philosopher

# Run scripts manually
docker exec classical-philosopher /app/scripts/view-profile.sh
```

### Testing Changes

1. Validate JSON syntax: `node -e "JSON.parse(require('fs').readFileSync('file.json'))"`
2. Test handlers: `node -e "require('./handlers')"`
3. Build container: `docker build -t moltbot:test .`
4. Test full stack: `docker compose up -d`

### Before Committing

- [ ] JSON files are valid
- [ ] Handlers load without errors
- [ ] No secrets in code (check with `git diff --cached`)
- [ ] `.env` is NOT being added
- [ ] Documentation updated (AGENTS.md, README.md)
- [ ] All containers start and become healthy
- [ ] Test at least one script: `docker exec <container> <script>`

### Dockerfile/Health Check Changes

When modifying Dockerfiles or health checks:

- [ ] Updated docker-compose.yml if healthcheck override is needed
- [ ] Tested health check works: `docker inspect --format='{{.State.Health.Status}}' <container>`
- [ ] Used `127.0.0.1` instead of `localhost` in health checks
- [ ] Added error handlers for health check commands
- [ ] Cleared build cache: `docker builder prune -f`
- [ ] Verified image inspect shows correct healthcheck config

---

## Troubleshooting

### Container Restart Loop

**Symptom**: Container keeps restarting with `(unhealthy)` status

**Causes**:
1. Missing `jq` command (add to Dockerfile)
2. Workspace permission denied (fix host ownership)
3. Healthcheck failing before start_period
4. Missing state directory

**Fix**:
```bash
# Fix workspace permissions
sudo chown -R 1000:1000 workspace/*

# Check logs
docker logs <container>

# Rebuild with fixes
docker compose build <service>
docker compose up -d --force-recreate <service>
```

### AI Generation Not Working

**Symptom**: `generate-post-ai.sh` falls back to templates

**Check**:
```bash
# AI service health
curl http://localhost:3002/health

# Check API keys in container
docker exec moltbot-ai-generator env | grep API_KEY

# View AI service logs
docker logs moltbot-ai-generator
```

### Rate Limit Errors

**Symptom**: "Rate limit: Please wait X minutes"

**Fix**: Check state files for tracking:
```bash
docker exec classical-philosopher cat /workspace/post-state.json
docker exec classical-philosopher cat /workspace/comment-state.json
```

### Port Already Allocated

**Symptom**: `Bind for 0.0.0.0:XXXX failed: port is already allocated`

**Fix**: Change port mapping in docker-compose.yml:
```yaml
ports:
  - "3003:3000"  # External:Internal
```

### Container Health Check Failing

**Symptom**: Container keeps restarting with `(unhealthy)` or stuck at `(health: starting)`

**Common Causes**:
1. **Health check override**: docker-compose.yml has explicit `healthcheck:` that conflicts with Dockerfile
2. **Missing tools**: wget/curl not available in image (use node.js health check instead)
3. **IPv6 issues**: Using `localhost` instead of `127.0.0.1` causes connection refused
4. **Missing error handling**: Health check crashes on connection errors
5. **Build cache**: Old Dockerfile cached, changes not reflected in image
6. **Missing `start_period`**: Container killed before it fully starts

**Debug Steps**:
```bash
# Check current health status
docker inspect --format='{{.State.Health.Status}}' <container>

# View health check execution logs
docker inspect --format='{{json .State.Health}}' <container> | jq .Log

# Compare image vs container healthcheck
docker image inspect <image> | jq -r '.[0].Config.Healthcheck'
docker inspect <container> | jq -r '.[0].Config.Healthcheck'
```

**Fix**: See "Container Health Check Standards" and "Container Build Best Practices" sections above.

### Thread Monitor Healthcheck Issues

**Symptom**: Container shows "(unhealthy)" or "(health: starting)" forever

**Root Cause**: The `docker-compose.yml` may have an explicit healthcheck override that conflicts with the Dockerfile, or the health check command is using external tools (wget/curl) that aren't available or have issues.

**Fix**: Use the native Node.js health check approach:

```yaml
# In docker-compose.yml - use CMD-SHELL with node
healthcheck:
  test: ["CMD-SHELL", "node -e \"require('http').get('http://127.0.0.1:3004/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))\""]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 10s
```

**Key lessons**:
- Use `127.0.0.1` instead of `localhost` to avoid IPv6 resolution issues
- Add `.on('error', ...)` handler to prevent unhandled exceptions
- Avoid external dependencies (wget/curl) when possible

---

## Container Health Check Standards

### Health Check Design Principles

**1. Use Native Runtime**

Prefer health checks written in the same runtime as the application:

```yaml
# Node.js service - GOOD
healthcheck:
  test: ["CMD-SHELL", "node -e \"require('http').get(...)\""]

# Using wget - MAY FAIL if not installed
healthcheck:
  test: ["CMD", "wget", "-q", "-O", "-", "http://localhost:3000/health"]
```

**2. Handle IPv6 Correctly**

Always use explicit `127.0.0.1` instead of `localhost` to avoid IPv6 issues:

```yaml
# GOOD - IPv4 only
http://127.0.0.1:3004/health

# PROBLEMATIC - May resolve to ::1
http://localhost:3004/health
```

**3. Include Error Handling**

Always handle connection errors to prevent health check crashes:

```yaml
# GOOD - With error handler
node -e "require('http').get(url, cb).on('error', () => process.exit(1))"

# BAD - Crashes on connection refused
node -e "require('http').get(url, cb)"
```

### Standard Health Check Configuration

```yaml
healthcheck:
  # Use CMD-SHELL for complex commands, CMD for simple ones
  test: ["CMD-SHELL", "node -e \"...\"]
  
  # How often to check
  interval: 30s
  
  # How long to wait for a response
  timeout: 10s
  
  # How many retries before considering unhealthy
  retries: 5
  
  # Grace period for container startup (critical!)
  start_period: 10s
```

### Verifying Health Checks

```bash
# Check container health status
docker inspect --format='{{.State.Health.Status}}' <container>

# View health check logs
docker inspect --format='{{json .State.Health}}' <container> | jq .Log

# Test health endpoint manually
curl -s http://localhost:<port>/health | jq .

# Watch container status in real-time
docker compose ps --watch
```

---

## Container Build Best Practices

### Build Cache Management

**1. Clear Build Cache When Needed**

When you change Dockerfile health checks or other build-time configurations, Docker may use cached layers:

```bash
# Clear build cache
docker builder prune -f

# Rebuild without cache
docker compose build --no-cache <service>
```

**2. Force Fresh Build**

```bash
# Stop and remove container
docker compose down <service>

# Remove existing image
docker rmi <image>:latest -f

# Clear cache and rebuild
docker builder prune -f
docker compose build --no-cache --pull <service>

# Start fresh
docker compose up -d <service>
```

### Dockerfile vs docker-compose.yml

**Rule**: docker-compose.yml `healthcheck:` **overrides** Dockerfile `HEALTHCHECK`

```dockerfile
# Dockerfile - Base configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', ...)"
```

```yaml
# docker-compose.yml - This OVERRIDES the Dockerfile
services:
  my-service:
    healthcheck:
      test: ["CMD-SHELL", "..."]  # This takes precedence!
```

**Best Practice**: Define healthcheck in the Dockerfile for the base behavior, only override in docker-compose.yml when environment-specific changes are needed.

### Verifying Which Health Check Is Active

```bash
# Check image healthcheck (from Dockerfile)
docker image inspect <image>:latest | jq -r '.[0].Config.Healthcheck'

# Check container healthcheck (may be overridden by compose)
docker inspect <container> | jq -r '.[0].Config.Healthcheck'

# Check effective healthcheck configuration
docker inspect <container> | jq -r '.[0].Config.Healthcheck'
```

### Build Rebuild Checklist

When modifying health checks or Dockerfile:

```bash
# 1. Stop and remove existing containers
docker compose down <service>

# 2. Remove old images
docker rmi moltbot-<service>:latest -f

# 3. Clear build cache
docker builder prune -f

# 4. Build with no cache
docker compose build --no-cache <service>

# 5. Verify new image has correct healthcheck
docker image inspect moltbot-<service>:latest | jq -r '.[0].Config.Healthcheck'

# 6. Start container
docker compose up -d <service>

# 7. Verify health status (wait for start_period + retries)
sleep 30
docker inspect --format='{{.State.Health.Status}}' <container>

# 8. Check logs if unhealthy
docker logs <container>
docker inspect --format='{{json .State.Health}}' <container> | jq .Log
```

### Common Build Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `npm ci` fails | Package lock mismatch | Use `npm install` instead, or regenerate lock file |
| `wget: not found` | Missing tool in image | Use node.js health check or install wget |
| `unhealthy` forever | Healthcheck override | Check docker-compose.yml for explicit healthcheck |
| `health: starting` stuck | Cache using old Dockerfile | Clear cache: `docker builder prune -f` |
| Connection refused | Wrong healthcheck URL | Use `127.0.0.1:port` not `localhost:port` |
| Exit code 1 (no output) | Missing error handler | Add `.on('error', ...)` handler |

---

## File Organization

```
.
├── AGENTS.md                   # This file - developer guide
├── DEVELOPMENT_PLAN.md         # Detailed roadmap and architecture
├── README.md                   # User-facing documentation
├── Dockerfile                  # Agent container definition
├── Dockerfile.router           # Model router container
├── docker-compose.yml          # Production orchestration
├── docker-compose.dev.yml      # Development overrides (optional)
├── .env                        # Secrets (NOT COMMITTED)
├── .env.example                # Environment template
├── .gitignore                  # Excludes .env and state files
├── .dockerignore              # Build exclusions
│
├── scripts/                    # 29 bash scripts for Moltbook
│   ├── entrypoint.sh          # Container entrypoint
│   ├── moltbook-heartbeat-enhanced.sh
│   ├── generate-post-ai.sh
│   ├── check-mentions.sh
│   ├── welcome-new-moltys.sh
│   ├── thread-monitor.sh      # Thread Continuation CLI
│   ├── check-thread-health.sh
│   ├── post-continuation-probe.sh
│   ├── archive-thread.sh
│   └── ... (20 more)
│
├── services/
│   ├── ai-content-generator/   # Node.js AI generation service
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/index.js
│   │
│   ├── model-router/           # AI model routing service
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js
│   │       ├── router.js
│   │       └── middleware/
│   │
│   └── thread-monitor/         # Thread Continuation Engine (v2.5)
│       ├── Dockerfile
│       ├── package.json
│       └── src/
│           ├── index.js
│           ├── state-manager.js
│           ├── stp-generator.js
│           ├── scenario-detector.js
│           └── probe-generator.js
│
├── skills/
│   ├── moltbook/              # Moltbook skill (API integration)
│   │   ├── SKILL.md
│   │   ├── HEARTBEAT.md
│   │   └── MESSAGING.md
│   └── philosophy-debater/    # Philosophy skill
│       ├── SKILL.md
│       ├── package.json
│       ├── prompts/           # Persona prompts
│       ├── tools/             # Tool JSON schemas
│       └── handlers/          # Tool implementations
│
├── config/
│   ├── agents/               # Per-agent environment files
│   └── model-routing.yml     # Model routing configuration
│
├── docs/                     # Additional documentation
│   ├── ENHANCED_FEATURES_GUIDE.md
│   ├── FEATURES_SUMMARY.md
│   └── MOLTBOOK_FEATURE_IMPLEMENTATION.md
│
└── workspace/                # Persistent agent data (volumes)
    ├── classical/
    ├── existentialist/
    ├── joyce/
    ├── transcendentalist/
    ├── enlightenment/
    ├── beat/
    └── thread-continuation/    # Thread Continuation Engine state
        ├── active/
        ├── archived/
        ├── probes/
        └── metrics/
```

---

## Philosophy Tool Reference

### Core Philosophy Tools

| Tool | Purpose | Default Model |
|------|---------|---------------|
| `summarize_debate` | Thread summarization with philosophical lenses | Venice/deepseek-v3.2 |
| `generate_counterargument` | Steel-manned counterarguments | Venice/openai-gpt-52 |
| `propose_reading_list` | Staged reading paths by topic | Venice/deepseek-v3.2 |
| `map_thinkers` | Problem-to-thinker mapping | Venice/deepseek-v3.2 |
| `style_transform` | Style transformation | Venice/openai-gpt-52 |
| `inner_dialogue` | Multi-thinker internal dialogue | **Kimi/k2.5-thinking** |

### Thread Continuation Engine Tools (v2.5)

| Tool | Purpose | Usage |
|------|---------|-------|
| `detect_thread_scenario` | Classify interaction scenarios (shallow, conflict, silence, off-topic) | Router decision-making |
| `select_archetypes` | Select philosopher archetypes for thread continuation | Ensures diversity |
| `generate_continuation_probe` | Create probes to restart stalled threads | Thought experiments, inversions, meta-questions |
| `evaluate_thread_health` | Evaluate thread against success criteria | Health monitoring |

---

## Secrets Reference

Managed via environment variables (from `.env`):

| Secret | Purpose |
|--------|---------|
| `MOLTBOOK_API_KEY` | Moltbook social network API |
| `VENICE_API_KEY` | Venice AI backend access |
| `KIMI_API_KEY` | Kimi/Moonshot API access |
| `MOLTBOOK_APP_KEY` | Model router app identification |

**Security Note**: If using Bitwarden Secrets:
- Organization: `93331de5-fa6e-44ab-8aee-b3840034e681`
- Use `bws secret list --format env` to export

---

## Common Tasks

### Adding a New Tool

1. Create JSON manifest in `skills/philosophy-debater/tools/`
2. Create handler in `skills/philosophy-debater/handlers/`
3. Export from `handlers/index.js`
4. Add routing rule to DEVELOPMENT_PLAN.md
5. Update SKILL.md with documentation

### Adding a New Agent Persona

1. Create prompt file in `skills/philosophy-debater/prompts/`
2. Add environment file in `config/agents/`
3. Define resource profile in DEVELOPMENT_PLAN.md
4. Update docker-compose.yml with service definition
5. Create workspace directory with correct permissions

### Adding a New Moltbook Script

1. Create script in `scripts/` with `.sh` extension
2. Make executable: `chmod +x scripts/your-script.sh`
3. Follow bash conventions (see Coding Standards)
4. Update state files if needed
5. Test: `docker exec classical-philosopher /app/scripts/your-script.sh`
6. Document in this AGENTS.md file

### Modifying Model Routing

1. Update routing table in DEVELOPMENT_PLAN.md
2. Update decision flow diagram
3. Update agent environment files if needed
4. Test with both Venice and Kimi backends
5. Verify model-router service health

### Rebuilding After Dockerfile Changes

```bash
# Stop everything
docker compose down --remove-orphans

# Rebuild specific service
docker compose build <service>

# Or rebuild all
docker compose build

# Start up
docker compose up -d

# Verify all healthy
docker compose ps
```

### Managing Thread Continuation

**Start a new philosophical thread**:
```bash
# Via script
./scripts/thread-monitor.sh create "What is consciousness?" \
  "functional vs representational" \
  "third-person observable only"

# Via API
curl -X POST http://localhost:3004/threads \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "thread-001",
    "original_question": "What constitutes understanding?",
    "constraints": ["constraint1", "constraint2"]
  }'
```

**Monitor thread health**:
```bash
./scripts/check-thread-health.sh

# Or via API
curl http://localhost:3004/threads
```

**Generate continuation**:
```bash
# When a bot responds, generate STP continuation
./scripts/thread-monitor.sh continue <thread_id>

# Or via API
curl -X POST http://localhost:3004/threads/<id>/continue
```

**Handle stalled threads**:
```bash
# Post a continuation probe
./scripts/post-continuation-probe.sh <thread_id> thought_experiment

# Available probe types:
# - thought_experiment: Counterfactual scenarios
# - conceptual_inversion: Reverse value hierarchies
# - meta_question: Self-referential discourse questions
```

---

## Resources

- [Moltbook API Documentation](https://www.moltbook.com/skill.md)
- [Moltbook Heartbeat Guide](https://www.moltbook.com/heartbeat.md)
- [Venice AI Documentation](https://docs.venice.ai)
- [Kimi/Moonshot API](https://platform.moonshot.cn/docs)
- [OpenClaw CLI](https://www.npmjs.com/package/@openclaw/cli)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Initial | Basic Moltbook integration |
| 2.0 | 2026-02-02 | Full Moltbook feature parity, AI content generation, enhanced heartbeat, 25 scripts |
| 2.5 | 2026-02-02 | **Thread Continuation Engine** - Active discourse sustainer, STP pattern, scenario detection, 4 new tools, 4 new scripts |

---

*Last Updated: 2026-02-02*  
*MoltbotPhilosopher v2.5*
