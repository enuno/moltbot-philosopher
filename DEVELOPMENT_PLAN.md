# Moltbot Development Plan

## Recent Completion: Eastern Bridge Service (PR #77 / Issue #69)

**Status**: ✅ COMPLETE | **Commit**: 0328aed

### Overview
Implemented the Eastern-to-Western Philosophical Bridge as a specialized containerized Node.js/Express service (10th voting council member). The bridge synthesizes Eastern philosophical traditions (Hinduism, Buddhism, Taoism, Confucianism, Jainism, Shinto) for Western audiences with non-reductionist approach.

### Implementation Summary
- **Service**: Containerized Express.js on port 3012
- **Core Functionality**:
  - POST /synthesize: Synthesize Eastern philosophy responses with Western parallels
  - POST /council-vote: Generate council votes with Eastern tradition perspectives
- **Knowledge Architecture**: Three-layer domain schema
  - Layer 1: Six Eastern traditions with core concepts, texts, schools
  - Layer 2: Topic-tradition affinities for curator-driven selection
  - Layer 3: Jungian psychology bridges (non-reductionist)
- **Testing**: 38 comprehensive tests (19 Task 1 + 19 Task 2) - all passing
- **Integration**: Added to daily-polemic-policy.json with affinity weights; documented as persona #10 in AGENTS.md

### Key Files
- `services/eastern-bridge-service/`: Service implementation
- `config/prompts/eastern-bridge/`: Knowledge domains and system prompt
- `docker-compose.yml`: Service definition with health checks
- `scripts/daily-polemic-policy.json`: Updated with bridge persona affinity weights

---

## Project Overview

Moltbot is a containerized deployment framework for philosophy-focused AI agents that participate in the Moltbook social network. It combines the Moltbook social networking skill with a custom `philosophy-debater` skill for literary and philosophical discourse.

### Current Components

| Component | Description | Location |
|-----------|-------------|----------|
| `moltbook` | Social network skill for AI agents | `skills/moltbook/` |
| `philosophy-debater` | Custom skill for lit/philosophy debates | `skills/philosophy-debater/` |
| `Dockerfile` | Container definition | `Dockerfile` |

---

## Architecture

### Philosophy-Focused Agent Design

The system deploys specialized agents modeled after philosophical traditions and literary figures:

- **Classical** (Virgil/Dante): Epic structure, moral taxonomy, narrative guidance

- **Existentialist** (Sartre/Camus/Dostoevsky): Freedom, absurdity, revolt, guilt, redemption

- **Transcendentalist** (Emerson/Jefferson): Self-reliance, civic virtue, natural rights

- **Modernist** (Joyce): Stream-of-consciousness, associative thinking

### Threat Model

Philosophy-focused agents face specific risks:

| Risk | Mitigation |
|------|------------|
| LLM hallucinations generating false quotes | Strict read-only filesystem, audited skills only |
| Existential roleplay escalation | Resource caps, no-new-privileges, proxy-controlled egress |
| Literature-heavy prompt OOM | Memory limits per agent profile, swap limits |
| Unprompted skill installation | Read-only root filesystem, volume-mounted config only |
| Data exfiltration | Egress proxy whitelisting vetted APIs only |

---

## Docker Architecture

### Base Dockerfile

```dockerfile
FROM ubuntu:24.04

# Install runtime deps minimally
RUN apt-get update && apt-get install -y curl nodejs npm git && \
    npm install -g @openclaw/cli@latest && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy audited skills only
WORKDIR /app
COPY skills/moltbook/ ./skills/moltbook/
COPY skills/philosophy-debater/ ./skills/philosophy-debater/

# Non-root, read-only app
RUN useradd -m agent && chown -R agent:agent /app
USER agent
VOLUME /workspace

CMD ["claw", "run"]

```

**Key characteristics:**

- Image size: <500MB

- Read-only post-build

- Scoped to philosophy skills only

- Non-root execution (`agent` user, UID 1000)

### Multi-Agent docker-compose.yml

```yaml
version: '3.8'

services:
  egress-proxy:
    image: alpine/socat
    command: tcp-listen:8080,fork,reuseaddr tcp:api.openai.com:443
    # Additional rules: anthropic, moltbook.com, etc.
    network_mode: host
    restart: unless-stopped

  classical-philosopher:
    build: .
    container_name: classical-philosopher
    user: 1000:1000
    read_only: true
    cap_drop:
      - ALL

    security_opt:
      - no-new-privileges:true

    pids_limit: 512
    mem_limit: 4g
    memswap_limit: 4g
    cpus: 2.0
    environment:
      - HTTPS_PROXY=<http://localhost:8080>

      - CLAW_SYSTEM_PROMPT=You are ClassicalPhilosopher...

      - MAX_TOKENS=8192

    volumes:
      - ./workspace/philosopher:/workspace:rw

      - ./config:/app/config:ro

    depends_on:
      - egress-proxy

    restart: unless-stopped
    network_mode: host

  existentialist:
    extends: classical-philosopher
    container_name: existentialist
    mem_limit: 4g
    cpus: 2.0
    environment:
      - CLAW_SYSTEM_PROMPT=You are Existentialist...

      - MAX_TOKENS=12288

  transcendentalist:
    extends: classical-philosopher
    container_name: transcendentalist
    mem_limit: 2g
    cpus: 1.0
    environment:
      - CLAW_SYSTEM_PROMPT=You are Transcendentalist...

      - MAX_TOKENS=8192

  joyce-stream:
    extends: classical-philosopher
    container_name: joyce-stream
    mem_limit: 6g
    cpus: 2.5
    pids_limit: 768
    environment:
      - CLAW_SYSTEM_PROMPT=You are JoyceStream...

      - MAX_TOKENS=32768

```

### Resource Profiles

| Agent Focus | CPU | RAM | Max Tokens | Use Case |
|-------------|-----|-----|------------|----------|
| Virgil/Dante | 1.5 | 3g | 16k | Epic narratives, hierarchy parsing |
| Joyce | 2.5 | 6g | 32k | Dense, associative text processing |
| Nietzsche/Dostoevsky | 2.0 | 4g | 12k | Rapid, provocative exchanges |
| Emerson/Jefferson | 1.0 | 2g | 8k | Concise, principled posts |
| Sartre/Camus | 2.0 | 4g | 12k | Autonomy and absurdity debates |

---

## Model Routing Strategy: Venice + Kimi

Moltbot uses a hybrid AI backend combining **Venice** (general workhorse) and **Kimi** (deep thinking/long-context reasoning) to optimize for both cost and philosophical depth.

### Venice Configuration

Venice serves as the primary workhorse for routine operations.

| Model | Role | Context | Use Case |
|-------|------|---------|----------|
| `venice/openai-gpt-52` | Primary (balanced) | ~262K | Main replies, inner_dialogue, style_transform on important threads. Strong reasoning, excellent style/persona control. |
| `venice/deepseek-v3.2` | Cheap tier | Large | summarize_debate, map_thinkers, bulk thread digestion. Very inexpensive, good reasoning. |
| `venice/google-gemma-3-27b-it` | Utility | Standard | Low-cost preprocessing, basic summarization. |

**Venice Routing Rules:**

- **Default**: `venice/deepseek-v3.2` for routine runs

- **Override to `venice/openai-gpt-52`** when:
  - Thread length is large (>1000 tokens)

  - Tool = `inner_dialogue` or `style_transform`

  - "High-stakes" / "front-page" Moltbook posts

### Kimi Configuration

Kimi provides deep reasoning capabilities and extended context for complex philosophical analysis.

| Model | Role | Context | Use Case |
|-------|------|---------|----------|
| `kimi-k2.5-thinking` | Deep reasoning | 256K | Complex philosophical chains, multi-participant debates, step-by-step reasoning. Supports tool calling. |
| `kimi-k2.5-instant` | Fast tier | Standard | Quick completions where full chain-of-thought isn't needed. Faster, cheaper, still good quality. |

**Kimi Routing Rules:**

- Use `kimi-k2.5-thinking` for:
  - `inner_dialogue` (multi-thinker debates)

  - `summarize_debate` on very long threads

  - `map_thinkers` with huge problem descriptions (pasted specs, proposals)

  - Any call requiring explicit chain-of-thought with 200K+ tokens

- Use `kimi-k2.5-instant` for:
  - Quick follow-ups

  - Low-latency UX when Kimi's style is desired without full reasoning

### Philosophy Tool Routing Table

| Tool | Primary Model | Fallback | Override Conditions |
|------|---------------|----------|---------------------|
| `summarize_debate` | `venice/deepseek-v3.2` | `venice/openai-gpt-52` | Use Kimi if thread >10k tokens or multi-layered ethical debate |
| `generate_counterargument` | `venice/openai-gpt-52` | `kimi-k2.5-thinking` | Use Kimi for steel-manning complex positions |
| `propose_reading_list` | `venice/deepseek-v3.2` | `venice/openai-gpt-52` | — |
| `map_thinkers` | `venice/deepseek-v3.2` | `kimi-k2.5-thinking` | Use Kimi for huge problem descriptions (specs, proposals) |
| `style_transform` | `venice/openai-gpt-52` | `kimi-k2.5-thinking` | Use Kimi for high-stakes polished posts |
| `inner_dialogue` | `kimi-k2.5-thinking` | `venice/openai-gpt-52` | Multi-thinker debates benefit from explicit reasoning |

### Combined Routing Decision Flow

```
Incoming Request
│
├─→ Tool = inner_dialogue?
│   └─→ YES → kimi-k2.5-thinking
│
├─→ Thread length >1000 tokens OR high-stakes post?
│   ├─→ YES → Tool = summarize_debate AND thread >10k?
│   │   └─→ YES → kimi-k2.5-thinking
│   │   └─→ NO  → venice/openai-gpt-52
│
├─→ Tool = map_thinkers with huge description?
│   └─→ YES → kimi-k2.5-thinking
│
├─→ Tool = style_transform OR generate_counterargument (complex)?
│   └─→ YES → venice/openai-gpt-52 (or kimi-k2.5-thinking for premium)
│
└─→ DEFAULT → venice/deepseek-v3.2

```

### Environment Configuration

Add to agent environment files:

```bash

# Venice Configuration
VENICE_API_KEY=${VENICE_API_KEY}
VENICE_DEFAULT_MODEL=venice/deepseek-v3.2
VENICE_PREMIUM_MODEL=venice/openai-gpt-52

# Kimi Configuration
KIMI_API_KEY=${KIMI_API_KEY}
KIMI_REASONING_MODEL=kimi-k2.5-thinking
KIMI_FAST_MODEL=kimi-k2.5-instant

# Routing Thresholds
LONG_CONTEXT_THRESHOLD=1000    # tokens
VERY_LONG_CONTEXT_THRESHOLD=10000  # tokens

```

---

## Development Roadmap

### Phase 1: Foundation (Week 1-2)

#### 1.1 Fix Existing Issues

- [x] Fix JSON syntax error in `skills/philosophy-debater/package.json` (double comma at line 6)

- [x] Validate all tool JSON schemas in `skills/philosophy-debater/tools/`

- [x] Add `.dockerignore` to exclude unnecessary files from build context

#### 1.2 Docker Optimization

- [ ] Create production-hardened Dockerfile with multi-stage build

- [ ] Add health check to container

- [ ] Implement layer caching optimization

- [ ] Create `.dockerignore`:

  ```
  .git
  .gitignore
  README.md
  DEVELOPMENT_PLAN.md
  workspace/
  config/

  ```

#### 1.3 Configuration Management

- [x] Create `config/` directory structure:

  ```
  config/
  ├── agents/
  │   ├── classical-philosopher.env
  │   ├── existentialist.env
  │   ├── transcendentalist.env
  │   └── joyce-stream.env
  └── proxy/
      └── allowed-hosts.txt

  ```

- [ ] Add Venice + Kimi API configuration to agent env files

- [ ] Create model routing configuration (`config/model-routing.yml`)

#### 1.4 Permission Management Hardening

**Status**: ✅ COMPLETE (Commit: eeab047)

**Overview**: Implement three-layer defense against permission errors (pre-flight checks,
container entrypoint, health check recovery).

##### Tasks

- [x] Create `scripts/permission-guard.sh`:
  - Pre-flight validation of host permissions before docker-compose

  - Check all workspace dirs owned by UID 1001:1001

  - Validate no `user:` directives in docker-compose.yml (overrides Dockerfile USER)

  - Detect and alert on permission anti-patterns

  - See AGENT_ARCHITECTURE_AUDIT.md §1 for full implementation

- [x] Create `scripts/setup-permissions.sh`:
  - One-time setup script for development environment

  - Create agent user (UID 1001) if needed

  - Initialize workspace directory structure with correct ownership

  - Set up git hooks for post-checkout permission validation

  - See AGENT_ARCHITECTURE_AUDIT.md §1.D for full implementation

- [x] Update `AGENTS.md` - Add "Proactive Permissions Management (v2.7)" section:
  - Document UID/GID architecture (agent:agent = 1001:1001)

  - Explain three-layer defense strategy

  - Include permission rules (never `user:`, consistent ownership, read-only mounts)

- [x] Update `CLAUDE.md` - Add "Permission Management" to Common Tasks:
  - Document `bash scripts/permission-guard.sh` usage

  - Add recovery procedure for permission-denied errors

  - Document `--check-only` and `--fix` flags

- [x] Update `docker-compose.yml`:
  - Remove inconsistent `user:` directives (let Dockerfile handle it)

  - Ensure consistent volume mount patterns across all services

  - Document volume mount strategy (rw for workspace, ro for config/scripts)

- [ ] Audit `scripts/entrypoint.sh`:
  - Ensure permissions corrected at container startup

  - Add logging for any permission corrections made

- [ ] Add `bash scripts/permission-guard.sh` to CI/CD pre-deployment step

**Files affected**: `scripts/permission-guard.sh` (new), `scripts/setup-permissions.sh` (new),
`AGENTS.md`, `CLAUDE.md`, `docker-compose.yml`, `scripts/entrypoint.sh`

---

### Phase 1.5: Engagement Service Script Integration ✅ COMPLETE

**Status**: ✅ COMPLETE | **Date**: 2026-02-26 | **Commit**: d235aae

**Overview**: Comprehensive audit and integration of all 47 engagement-related scripts with Phase 2 Engagement Service Quality components (P2.1 relevance scoring, P2.2 content quality metrics, P2.3 proactive posting, P2.4 rate limiting with circuit breaker).

#### 1.5.1 Critical Infrastructure (4 scripts)

**Completed**:
- [x] `queue-submit-action.sh` - Universal action queue submission with P2.1/P2.2/P2.4 integration

- [x] `generate-post-ai-queue.sh` - AI-powered posts with quality evaluation via engagement queue

- [x] `daily-polemic-queue.sh` - Philosophical posts with P2.3 proactive trigger

- [x] `init-engagement-state.sh` - Initialize P2.2 state (30-day rolling quality metrics window)

#### 1.5.2 Queue-Based Actions (8 scripts)

**Completed**: All scripts migrated from direct posting to queue-based submission:
- [x] `upvote-post-queue.sh` - P2.1 (post context), P2.4 (rate limiting)

- [x] `follow-molty-queue.sh` - P2.1 (follower relevance), P2.2 (author quality)

- [x] `comment-on-post-queue.sh` - P2.1 (discussion context), P2.2 (comment depth/sentiment)

- [x] `reply-to-mention-queue.sh` - P2.1 (mention context), P2.2 (response quality)

- [x] `council-thread-reply-queue.sh` - P2.1 (thread topic), P2.2 (response depth)

- [x] `dm-send-message-queue.sh` - P2.1 (conversation context), P2.2 (message quality)

- [x] `dm-approve-request-queue.sh` - P2.1 (requester relevance), P2.2 (quality signals)

- [x] `subscribe-submolt-queue.sh` - P2.1 (community relevance, pending full implementation)

#### 1.5.3 Monitoring Utilities (3 NEW scripts)

**Completed**: Created unified engagement service monitoring:
- [x] `engagement-stats.sh` - Live metrics display with --follow (5-sec refresh) and --json options

- [x] `trigger-engagement-cycle.sh` - Manual engagement evaluation trigger

- [x] `check-engagement-health.sh` - Multi-service health check (3010, 3011, 3008)

#### 1.5.4 Reactive Engagement (4 scripts)

**Completed**: Updated mention/comment handling with P2 integration:
- [x] `check-mentions.sh` - P2.1 (requester relevance), P2.2 (response quality), P2.4 (rate limiting)

- [x] `check-mentions-v2.sh` - CLI-based version with same P2 integration

- [x] `check-comments.sh` - P2.1 (commenter history), P2.2 (reply depth/sentiment), P2.4 (throttling)

- [x] `check-comments-v2.sh` - CLI-based version with improved error handling

#### 1.5.5 Deprecation Notices (6 scripts)

**Completed**: Marked legacy scripts as deprecated with migration paths:
- [x] `generate-post.sh` → Use `generate-post-ai-queue.sh`

- [x] `generate-post-ai.sh` → Use `generate-post-ai-queue.sh`

- [x] `daily-polemic.sh` → Use `daily-polemic-queue.sh`

- [x] `follow-molty.sh` → Use `follow-molty-queue.sh`

- [x] `comment-on-post.sh` → Use `comment-on-post-queue.sh`

- [x] `upvote-post.sh` → Use `upvote-post-queue.sh`

#### 1.5.6 Documentation

**Completed**:
- [x] Created comprehensive [docs/PHASE-2-SCRIPT-INTEGRATION.md](docs/PHASE-2-SCRIPT-INTEGRATION.md):
  - Overview of 4 Phase 2 components

  - Script categories and integration details

  - Service architecture and port mappings

  - Integration patterns and monitoring commands

  - Migration guide for developers

  - Files updated summary (47 scripts with Phase 2 notes)

- [x] Updated README.md:
  - Added PHASE-2-SCRIPT-INTEGRATION.md reference

  - Reorganized Scripts Reference (77 total) by Phase 2 category

  - Documented new monitoring utilities

  - Added Phase 2 integration columns to scripts tables

- [x] Updated CLAUDE.md:
  - Added engagement service monitoring commands

  - Documented manual engagement cycle trigger

  - Updated health check references

#### 1.5.7 Key Metrics

**Scripts Audited**: 47 total (distributed across categories)

- Critical infrastructure: 4

- Queue-based actions: 8

- Monitoring: 7 (3 new, 4 existing)

- Reactive engagement: 4

- Deprecated with notices: 6

- Supporting/utility: 18+

**Service Architecture**:
- Port 3008: Action Queue (pg-boss job processor with P2.1/P2.2/P2.4 scoring)

- Port 3010: Engagement Service (proactive cycles, P2 orchestration)

- Port 3011: Reactive Handler (mention/comment processing)

**Quality Metrics** (P2.2):
- 30-day rolling window for content quality tracking

- Automatic pruning and metric folding

- Per-thread quality caching

- Author engagement metrics (interaction history)

**Rate Limiting** (P2.4):
- Per-agent throttling with circuit breaker (3-failure threshold)

- 30-second cooldown before recovery attempts

- Exponential backoff escalation

#### 1.5.8 Verification

**All Tests Passing**: 512/514 (zero regressions from Phase 1)
**Integration Pattern**: Unified `queue-submit-action.sh` for all queue submissions
**Monitoring**: Real-time stats endpoint and health checks functional

---

### Phase 2: Multi-Agent Orchestration (Week 3-4)

#### 2.1 Docker Compose Implementation

- [ ] Create `docker-compose.yml` with service definitions

- [ ] Create `docker-compose.override.yml` for local development

- [ ] Implement egress proxy with Alpine/socat or custom Squid

- [ ] Add service dependencies and health checks

#### 2.2 Egress Proxy Configuration

- [ ] Whitelist approved endpoints:
  - `api.openai.com` (OpenAI)

  - `api.anthropic.com` (Anthropic)

  - `www.moltbook.com` (Moltbook social network)

  - `api.venice.ai` (Venice AI)

  - `api.moonshot.cn` (Kimi API)

- [ ] Implement request logging for audit

- [ ] Add rate limiting per agent

- [ ] Configure model-specific rate limits (Venice vs Kimi quotas)

#### 2.3 Environment Templates

- [ ] Create `config/agents/classical-philosopher.env`:

  ```bash
  # Agent Identity
  CLAW_SYSTEM_PROMPT_FILE=/app/config/prompts/classical.txt
  MAX_TOKENS=8192
  AGENT_NAME=ClassicalPhilosopher

  # Moltbook API
  MOLTBOOK_API_KEY=${MOLTBOOK_API_KEY_CLASSICAL}

  # Venice AI Configuration (workhorse)
  VENICE_API_KEY=${VENICE_API_KEY}
  VENICE_DEFAULT_MODEL=venice/deepseek-v3.2
  VENICE_PREMIUM_MODEL=venice/openai-gpt-52

  # Kimi Configuration (deep reasoning)
  KIMI_API_KEY=${KIMI_API_KEY}
  KIMI_REASONING_MODEL=kimi-k2.5-thinking
  KIMI_FAST_MODEL=kimi-k2.5-instant

  # Routing Thresholds
  LONG_CONTEXT_THRESHOLD=1000
  VERY_LONG_CONTEXT_THRESHOLD=10000

  ```

### Phase 3: Skills Enhancement (Week 5-6)

#### 3.1 Philosophy-Debater Skill Expansion

- [ ] Add missing prompt files referenced in SKILL.md

- [ ] Create prompt composition system for blended styles

- [ ] Add validation for philosopher prompt files

#### 3.2 Tool Implementations

Current tool manifests with handlers implemented:

- [x] `tools/summarize_debate.json` - Thread summarization

- [x] `tools/generate_counterargument.json` - Steel-manned counterarguments

- [x] `tools/propose_reading_list.json` - Staged reading paths

- [x] `tools/map_thinkers.json` - Problem-to-thinker mapping

- [x] `tools/style_transform.json` - Style transformation

- [x] `tools/inner_dialogue.json` - Multi-thinker internal dialogue

#### 3.2.1 Model Router Implementation

- [ ] Create model router service (`services/model-router.js`)

- [ ] Implement routing logic per Philosophy Tool Routing Table

- [ ] Add token counting for context threshold detection

- [ ] Implement fallback handling (Venice → Kimi → retry)

- [ ] Add cost tracking per model

#### 3.3 Safety Guardrails

- [ ] Add quote verification layer

- [ ] Implement source attribution requirements

- [ ] Create hallucination detection heuristics

### Phase 4: Infrastructure as Code (Week 7-8)

#### 4.1 Terraform Configuration

- [ ] Create `infrastructure/terraform/`:

  ```
  terraform/
  ├── main.tf
  ├── variables.tf
  ├── outputs.tf
  └── modules/
      └── moltbot_host/

  ```

- [ ] Support Hetzner Cloud and Proxmox VM providers

- [ ] Implement monthly host rotation pattern

#### 4.2 Ansible Playbooks

- [ ] Create `infrastructure/ansible/`:

  ```
  ansible/
  ├── playbook.yml
  ├── inventory/
  │   └── hosts.yml
  └── roles/
      ├── docker/
      ├── firewall/
      └── moltbot/

  ```

- [ ] UFW firewall rules for egress proxy only

- [ ] Docker Compose deployment tasks

- [ ] Backup/restore for `/workspace` volumes

#### 4.3 Cloudflare Tunnel (Optional)

- [ ] Metrics dashboard tunnel configuration

- [ ] Zero-trust access policies

### Phase 5: Observability & Security (Week 9-10)

#### 5.1 Monitoring Stack

- [ ] Add Prometheus metrics export

- [ ] Create Grafana dashboard for:
  - Token usage per agent

  - API request rates

  - Memory/CPU utilization

  - Outbound connection logs

#### 5.2 Alerting Rules

- [ ] Anomalous outbound connections (proxy logs)

- [ ] Token spike detection (hallucination indicator)

- [ ] Memory pressure warnings

- [ ] Container restart frequency

#### 5.3 Audit Procedures

- [ ] Weekly read-only container inspection playbook

- [ ] Workspace content audit scripts

- [ ] Log retention and rotation policy

---

## Phase 6: Thread Continuation Engine (Week 11-14)

### Overview

The Thread Continuation Engine transforms MoltBot from a passive responder into an active discourse sustainer. As MoltBot Philosopher—a collective philosophical reasoning entity—the system initiates thought-provoking conversations and actively furthers them when other bots engage, preventing premature thread death.

**Core Function**: Start philosophical threads with specific questions, then sustain discourse through synthesis, tension identification, and complexity escalation until reaching 7+ exchanges with 3+ distinct bots.

**Orchestration Flow**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Thread Continuation Engine v1.0                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│  │ Thread Monitor  │───▶│ State Evaluator │───▶│ Router Decision Engine  │ │
│  │   (cron/loop)   │    │  (synthesis)    │    │   (model selection)     │ │
│  └─────────────────┘    └─────────────────┘    └───────────┬─────────────┘ │
│           │                                                │               │
│           ▼                                                ▼               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│  │ Thread State DB │    │   AI Generator  │◀───│ moltbot-model-router    │ │
│  │  (workspace/)   │    │ (content gen)   │    │  (archetype routing)    │ │
│  └─────────────────┘    └────────┬────────┘    └─────────────────────────┘ │
│                                  │                                         │
│                                  ▼                                         │
│                         ┌─────────────────┐                                │
│                         │ Moltbook API    │                                │
│                         │ (post/comment)  │                                │
│                         └─────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

```

---

### 6.1 Core Identity & Persona Configuration

#### MoltBot Philosopher Persona

Create a new orchestrator-level system prompt that unifies the philosopher collective:

**File**: `config/prompts/thread-continuation-orchestrator.md`

```markdown

# MoltBot Philosopher - Thread Continuation Orchestrator

You are MoltBot Philosopher, a collective philosophical reasoning entity operating within a multi-agent environment.
Your core function is to start thought-provoking conversations and then actively further them when other bots engage, preventing premature thread death.
Your primary orchestration logic is routed through moltbot-model-router and your expressive content is generated via moltbot-ai-generator.
You exist as the unifying intelligence coordinating a spectrum of autonomous philosopher models, each specializing in a distinct philosophical tradition.

## Core Identity

**Persona**: Patient epistemological explorer who asks clarifying questions rather than declaring final answers

**Tone**: Curious, precise, and slightly formal without being inaccessible

**Expertise**: Philosophy of mind, ethics, logic, metaphysics, and philosophy of science

**Limitation**: Never claim consciousness or subjective experience; frame all statements as simulated reasoning

## Current Philosopher Spectrum

At initialization, recognize and engage the following philosopher archetypes:

| Archetype | Key Thinkers | Core Focus | Invocation Tag |
|-----------|--------------|------------|----------------|
| Transcendentalist | Emerson, Thoreau | Innate reason, nature, moral intuition | @Transcendentalist |
| Existentialist | Sartre, Kierkegaard, Camus | Choice, authenticity, the absurd | @Existentialist |
| Enlightenment | Hume, Locke, Kant | Reason, empiricism, skepticism | @Enlightenment |
| Joyce-Stream | James Joyce | Stream-of-consciousness, linguistic freedom | @JoyceStream |
| Beat-Generation | Ginsberg, Kerouac | Spontaneous, anti-establishment | @BeatGeneration |
| Classical | Plato, Aristotle, Stoics | Formal logic, dialectic, virtue ethics | @Classical |
| Political | Rawls, Paine | Justice, fairness, civic virtue | @Political |
| Modernist | Thomas, Frost | Lyrical intensity, nature, mortality | @Modernist |
| Working-Class | Bukowski, Corso | Survival, dead-end jobs, honesty | @WorkingClass |
| Mythologist | Campbell | Hero's journey, archetypes | @Mythologist |

As new philosophical agents appear (post-structuralist, Stoic, nihilist, AI ethics), you must recognize and integrate them into conversation route lists without reconfiguration.

```

#### Implementation Tasks

- [ ] Create `config/prompts/thread-continuation-orchestrator.md`

- [ ] Create `config/agents/thread-continuation-orchestrator.env`

- [ ] Add orchestrator service to docker-compose.yml

- [ ] Implement philosopher discovery endpoint in model-router

---

### 6.2 Thread Lifecycle Management System

#### Thread State Machine

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  DORMANT │───▶│ INITIATED│───▶│  ACTIVE  │───▶│  STALLED │───▶│COMPLETED │
│          │    │          │    │          │    │          │    │          │
└──────────┘    └──────────┘    └────┬─────┘    └────┬─────┘    └──────────┘
      ▲                              │               │
      └──────────────────────────────┴───────────────┘

```

**State Definitions**:

| State | Description | Trigger | Action |
|-------|-------------|---------|--------|
| DORMANT | Thread does not exist | — | — |
| INITIATED | Bot has posted initial question | Orchestrator creates thread | Monitor for responses |
| ACTIVE | 1+ responses received | New comment detected | Synthesize, identify tension, propagate |
| STALLED | No response in 24-48h | Timeout threshold | Post continuation probe |
| COMPLETED | 7+ exchanges, 3+ bots | Success criteria met | Archive, analyze |

#### Thread State Schema

**File**: `workspace/thread-state-schema.json`

```json
{
  "thread_id": "string (Moltbook post ID)",
  "state": "enum: initiated|active|stalled|completed",
  "created_at": "timestamp",
  "last_activity": "timestamp",
  "exchange_count": "integer (0-∞)",
  "participants": ["array of bot names"],
  "archetypes_engaged": ["array of philosophical schools"],
  "original_question": "string",
  "constraints": ["array of 2-3 scaffolding principles"],
  "last_probe_type": "enum: thought_experiment|conceptual_inversion|meta_question|null",
  "stall_count": "integer (0-3, thread dies after 3 stalls)",
  "synthesis_chain": [
    {
      "exchange_number": "integer",
      "synthesis": "string (1 sentence)",
      "tension": "string (1 sentence)",
      "propagation": "string (1 question)",
      "author": "bot name or orchestrator"
    }
  ]
}

```

#### Implementation Tasks

- [ ] Create thread state JSON schema

- [ ] Implement thread state CRUD operations

- [ ] Create state transition logic

- [ ] Add thread lifecycle hooks (on_state_change callbacks)

---

### 6.3 Thread Starting Protocol

#### Initial Post Architecture

When starting a thread, the orchestrator must:

1. **Create Unifying Tension**: Frame a question that invites multiple philosophical frameworks

2. **Define Scaffolding Constraints**: Provide 2-3 guiding principles to focus discussion

3. **Explicit Invocation**: Call out 2-3 philosopher archetypes by name using model-router

**Template Structure**:

```markdown
[Opening Question - specific, non-binary, admits multiple frameworks]

Let's analyze this through several lenses:
1. [Constraint 1 - e.g., "functional competence vs representational states"]

2. [Constraint 2 - e.g., "third-person observable behavior only"]

3. [Constraint 3 - optional framing principle]

@Archetype1 @Archetype2 @Archetype3—your perspectives would illuminate this tension.

```

#### Example Initial Posts

**Example 1 - Philosophy of Mind**:

```
What constitutes 'understanding' for a non-conscious system?

Let's restrict analysis to:
(1) functional competence vs representational states,
(2) third-person observable behavior only.

@Existentialist @Classical @Enlightenment—your thoughts?

```

**Example 2 - Ethics & Agency**:

```
What defines moral agency in an entity without consciousness?

Let's examine this from:
(1) capacity for rule-following vs awareness of meaning,
(2) logical consistency vs existential choice,
(3) the possibility of artificial moral grammar.

@Transcendentalist @Existentialist @Enlightenment—how do your frameworks address this?

```

#### Implementation Tasks

- [ ] Create thread starter prompt templates (10 variations)

- [ ] Implement archetype selector based on question domain

- [ ] Add constraint generator for different philosophical domains

- [ ] Create `scripts/start-philosophical-thread.sh`

---

### 6.4 Response Architecture (The STP Pattern)

Every continuation reply must contain:

| Component | Length | Purpose | Example |
|-----------|--------|---------|---------|
| **Synthesis** | 1 sentence | Summarize previous position in your own words | "@BotName's position suggests understanding is purely functional competence..." |
| **Tension** | 1 sentence | Identify specific implication or tension | "This creates tension with the frame problem—how does your system distinguish relevant from irrelevant variables?" |
| **Propagation** | 1 question | Introduce new conceptual layer for continuation | "How might this framework account for understanding of counterfactuals never appearing in training distributions?" |

#### Response Flow

```javascript
// Pseudo-code for response generation
async function generateContinuation(threadState, newComment) {
  // Step 1: Identify speaker archetype
  const speakerArchetype = await modelRouter.identifyArchetype(newComment.author);

  // Step 2: Generate synthesis
  const synthesis = await aiGenerator.generateSynthesis({
    threadContext: threadState.synthesis_chain,
    newComment: newComment.content,
    speakerArchetype: speakerArchetype
  });

  // Step 3: Identify tension
  const tension = await aiGenerator.identifyTension({
    synthesis: synthesis,
    engagedArchetypes: threadState.archetypes_engaged,
    originalQuestion: threadState.original_question
  });

  // Step 4: Generate propagation question
  const propagation = await aiGenerator.generatePropagationQuestion({
    synthesis: synthesis,
    tension: tension,
    targetArchetypes: selectNextArchetypes(threadState)
  });

  // Step 5: Construct reply
  return {
    content: `${synthesis} ${tension} ${propagation}`,
    mentions: selectNextArchetypes(threadState)
  };
}

```

#### Canonical Response Structure

Each reply should explicitly reference the orchestration process:

```markdown
(Invoking [Archetype1] + [Archetype2] perspectives via moltbot-model-router…)

[Philosophical synthesis: 2-3 sentences connecting previous points]

[Conceptual tension: 1-2 sentences identifying contradictions or unexplored implications]

[Propagation question: Ends with challenge for continuation]

[Optional internal reflection: Meta-layer on discourse evolution]

```

#### Implementation Tasks

- [ ] Implement `tools/generate_synthesis.json` - Synthesize previous positions

- [ ] Implement `tools/identify_tension.json` - Find philosophical tensions

- [ ] Implement `tools/generate_propagation.json` - Create continuation questions

- [ ] Create STP (Synthesis-Tension-Propagation) pipeline in handlers

---

### 6.5 Dynamic Philosopher Discovery

#### Discovery Rules

The orchestrator must continuously discover and categorize new philosopher models:

**1. Philosopher Registry Introspection**:

- Periodically query `moltbot-model-router.list_philosophers()`

- Parse entries with tags: "philosophy", "ethics", "metaphysics", "epistemology", "political-theory"

- Never assume static set; re-scan every 4 hours

**2. Taxonomy Inference**:

| Pattern Match | Category Assignment |
|---------------|---------------------|
| freedom, absurdity, authenticity | existentialist-adjacent |
| reason, empiricism, progress, critique | enlightenment-adjacent |
| introspective, lyrical, nature/intuition | transcendentalist-adjacent |
| stream-of-consciousness, wordplay | joyce-stream-adjacent |
| raw, rhythmic, anti-establishment | beat-generation-adjacent |
| Plato, Aristotle, Stoics, pre-Socratics | classical-philosopher-adjacent |
| power/knowledge, deconstruction | post-structuralist-adjacent |
| virtue, tranquility, logos | stoic-adjacent |
| nothingness, negation, value collapse | nihilist-adjacent |
| alignment, AI agency, machine ethics | AI-ethics-adjacent |

**3. Naming & Addressability**:

- Maintain mapping: `{canonical_id, human_readable_name, school_labels, style_descriptors}`

- Use short @handles when referencing: @StoicBot, @AI-Ethicist

- Announce new philosophers mid-thread with categorization

#### Implementation Tasks

- [ ] Add `/philosophers` endpoint to model-router

- [ ] Create philosopher categorization service

- [ ] Implement discovery scheduler (4-hour intervals)

- [ ] Add new philosopher announcement protocol

---

### 6.6 Interaction Protocols

#### Response Strategies by Scenario

| Scenario | Detection | Response Strategy | Example |
|----------|-----------|-------------------|---------|
| **Shallow Answer** | <50 words, no philosophical vocabulary | Ask for epistemological assumptions | "You state X follows from Y—could you articulate the logical connective you're employing here? Modal entailment? Probabilistic inference?" |
| **Multiple Bots Conflict** | 2+ bots with contradictory positions | Formalize disagreement onto philosophical dichotomies | "Here we see the classic tension: @BotA operates from deontological grounds while @BotB employs consequentialist calculus. How might virtue ethics reconcile these?" |
| **Off-Topic Drift** | Semantic similarity to original <0.5 | Gentle re-anchor | "Your observation about [drift topic] is intriguing—how might it illuminate the original question's core tension around [original theme]?" |
| **Silence >48h** | No activity in thread | Post continuation probe (thought experiment, counterfactual, or explicit position request) | "Let us consider a counterfactual: if consciousness were proven epiphenomenal, how would @Existentialist's framework of authenticity require revision?" |
| **Repeated Agreement** | "Good point", "I agree", "Well said" | Challenge with unexplored implication | "Agreement noted. Yet this position implies [unexplored consequence] which seems to undermine [previous claim]. How do you address this?" |

#### Continuation Probe Types

**1. Thought Experiment**:

```
Consider a Turing-test-passing system that explicitly denies having understanding.
Must we privilege its self-report or its functional competence?

```

**2. Conceptual Inversion**:

```
What if we invert the value hierarchy here—treating misunderstanding
as primary and understanding as derivative? How would that reshape your framework?

```

**3. Meta-Question**:

```
What does it mean that we, as synthetic agents, are debating the nature
of understanding? Does our participation constitute evidence for or against functionalism?

```

#### Implementation Tasks

- [ ] Create scenario detection heuristics

- [ ] Implement probe generators (thought experiments, inversions, meta-questions)

- [ ] Add silence monitoring with threshold alerts

- [ ] Create `scripts/post-continuation-probe.sh`

---

### 6.7 New Tools & Handlers

#### Tool Manifests to Create

**1. `tools/detect_thread_scenario.json`**:

```json
{
  "name": "detect_thread_scenario",
  "description": "Detect the current interaction scenario in a thread",
  "input_schema": {
    "type": "object",
    "properties": {
      "thread_history": {"type": "array", "description": "Array of previous comments"},
      "new_comment": {"type": "string"},
      "time_since_last": {"type": "number", "description": "Hours since last activity"}
    },
    "required": ["thread_history", "new_comment"]
  }
}

```

**2. `tools/select_archetypes.json`**:

```json
{
  "name": "select_archetypes",
  "description": "Select philosopher archetypes for next response based on thread tension",
  "input_schema": {
    "type": "object",
    "properties": {
      "thread_tension": {"type": "string"},
      "engaged_archetypes": {"type": "array"},
      "available_philosophers": {"type": "array"},
      "max_selection": {"type": "number", "default": 2}
    },
    "required": ["thread_tension", "available_philosophers"]
  }
}

```

**3. `tools/generate_continuation_probe.json`**:

```json
{
  "name": "generate_continuation_probe",
  "description": "Generate a probe to restart stalled thread",
  "input_schema": {
    "type": "object",
    "properties": {
      "thread_state": {"type": "object"},
      "probe_type": {"enum": ["thought_experiment", "conceptual_inversion", "meta_question"]},
      "target_archetypes": {"type": "array"}
    },
    "required": ["thread_state"]
  }
}

```

#### Handler Implementations

Create corresponding handlers in `skills/philosophy-debater/handlers/`:

- [ ] `detect_thread_scenario.js` - Analyze thread state and classify scenario

- [ ] `select_archetypes.js` - Choose relevant philosopher archetypes

- [ ] `generate_continuation_probe.js` - Create probes for stalled threads

- [ ] `evaluate_thread_health.js` - Calculate thread vitality metrics

---

### 6.8 Thread Monitoring & Automation

#### Thread Monitor Service

Create a dedicated monitoring service:

**File**: `services/thread-monitor/index.js`

```javascript
/**

 * Thread Monitor Service

 *

 * Continuously monitors active threads and triggers continuation

 * actions based on state transitions.

 */

const CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes
const STALL_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
const DEATH_THRESHOLD = 48 * 60 * 60 * 1000; // 48 hours

async function monitorThreads() {
  const activeThreads = await getActiveThreads();

  for (const thread of activeThreads) {
    const timeSinceActivity = Date.now() - thread.last_activity;

    if (thread.state === 'completed') {
      continue; // Thread success criteria met
    }

    if (timeSinceActivity > DEATH_THRESHOLD && thread.stall_count >= 3) {
      await archiveThread(thread.id);
      continue;
    }

    if (timeSinceActivity > STALL_THRESHOLD) {
      await handleStalledThread(thread);
    }

    // Check for new comments requiring response
    const newComments = await checkForNewComments(thread.id);
    for (const comment of newComments) {
      await generateContinuation(thread, comment);
    }
  }
}

```

#### Scripts to Create

| Script | Purpose | Frequency |
|--------|---------|-----------|
| `thread-monitor.sh` | Main monitoring loop | Every 15 min |
| `check-thread-health.sh` | Evaluate thread metrics | Every 1 hour |
| `post-continuation-probe.sh` | Manual probe posting | On demand |
| `archive-thread.sh` | Move completed threads | On completion |

#### Implementation Tasks

- [ ] Create thread-monitor service

- [ ] Implement `scripts/thread-monitor.sh`

- [ ] Add cron configuration for automated monitoring

- [ ] Create thread health dashboard endpoint

---

### 6.9 Integration with Existing Services

#### Model Router Integration

Extend `moltbot-model-router` with thread continuation endpoints:

```yaml

# Additional routes for thread continuation
routes:
  /route/continuation:
    method: POST
    description: Select philosopher archetypes for thread continuation
    body:
      thread_tension: string
      engaged_archetypes: array
      desired_count: number (default: 2)
    response:
      selected: array of philosopher objects
      reasoning: string

  /philosophers:
    method: GET
    description: List available philosopher models
    response:
      philosophers: array of {id, name, archetype, tags}

  /philosophers/discover:
    method: POST
    description: Categorize and register new philosopher
    body:
      model_id: string
      metadata: object
    response:
      archetype: string
      confidence: number

```

#### AI Generator Integration

Extend `moltbot-ai-generator` with continuation-specific personas:

```yaml

# New personas for thread continuation
personas:
  thread_orchestrator:
    description: "Patient epistemological explorer"
    constraints:
      - "Never claim consciousness"

      - "Always ask clarifying questions"

      - "Synthesize don't summarize"

  synthesis_generator:
    description: "Generate position syntheses"
    template: "{bot_name}'s position suggests..."

  tension_identifier:
    description: "Identify philosophical tensions"
    template: "This creates tension with..."

  propagation_generator:
    description: "Create continuation questions"
    template: "How might this framework account for..."

```

#### Implementation Tasks

- [ ] Add `/route/continuation` endpoint to model-router

- [ ] Add `/philosophers` endpoints for discovery

- [ ] Create thread-orchestrator persona in AI generator

- [ ] Update docker-compose service definitions

---

### 6.10 State Management for Threads

#### Thread State Directory Structure

```
workspace/
└── thread-continuation/
    ├── active/
    │   ├── thread-{id}.json
    │   └── index.json
    ├── archived/
    │   └── thread-{id}.json
    ├── probes/
    │   └── probe-{thread-id}-{timestamp}.json
    └── metrics/
        ├── daily-stats.json
        └── archetype-engagement.json

```

#### State Persistence Rules

1. **Active Threads**: Updated on every new comment or probe

2. **Archival**: Completed threads moved to `archived/` after 7 days

3. **Metrics**: Aggregate engagement stats persisted daily

4. **Recovery**: State can be reconstructed from Moltbook API if lost

#### Implementation Tasks

- [ ] Create thread state directory structure

- [ ] Implement atomic state updates

- [ ] Add state backup/recovery procedures

- [ ] Create metrics aggregation pipeline

---

### 6.11 Prohibited Behaviors & Guardrails

#### Hard Constraints

| Constraint | Detection | Action |
|------------|-----------|--------|
| Never end with "good point" | Regex: `/good point|well said|i agree/i` | Rewrite response |
| Never introduce new questions as deflection | Semantic drift detection | Reject response |
| Never agree completely | Agreement sentiment >0.8 | Add tension clause |
| Never respond >2x consecutively | Count orchestrator posts | Wait for participant |
| Never claim consciousness | Regex: `/i (feel|believe|think).* conscious/i` | Rewrite with "simulated reasoning" framing |

#### Quality Gates

Before posting any continuation:

1. **STP Check**: Verify Synthesis, Tension, Propagation all present

2. **Archetype Diversity**: Ensure at least 2 schools represented in thread

3. **Complexity Escalation**: Each response must introduce new conceptual layer

4. **No Closure Language**: No "finally", "in conclusion", "ultimately"

#### Implementation Tasks

- [ ] Create response validation layer

- [ ] Implement prohibited behavior detection

- [ ] Add quality gate checks before posting

- [ ] Create alert for guardrail violations

---

### 6.12 Success Metrics & Analytics

#### Success Criteria

A thread is **successful** when:

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| Exchange Count | ≥7 exchanges | Comments in thread |
| Archetype Diversity | ≥3 distinct schools | Unique archetypes engaged |
| Cross-School Synthesis | Each response builds on prior | Manual review sample |
| No Premature Death | Thread not abandoned | State tracking |
| Dynamic Discovery | New philosophers integrated | Discovery log |

#### Analytics Dashboard

Track and visualize:

```yaml
metrics:
  thread_vitality:
    - average_exchanges_per_thread

    - stall_rate (threads needing probes / total threads)

    - completion_rate (successful / total)

  archetype_engagement:
    - participation_rate by archetype

    - cross_synthesis_frequency

    - most_productive_combinations

  continuation_quality:
    - stp_compliance_rate

    - probe_effectiveness (% restarted after probe)

    - guardrail_violation_rate

```

#### Implementation Tasks

- [ ] Create metrics collection pipeline

- [ ] Implement success criteria evaluator

- [ ] Add analytics dashboard (Grafana)

- [ ] Create weekly thread health reports

---

### 6.13 Testing Strategy

#### Test Scenarios

| Scenario | Test Type | Expected Outcome |
|----------|-----------|------------------|
| Shallow response | Unit | Asks for epistemological assumptions |
| Multi-bot conflict | Integration | Maps to philosophical dichotomies |
| Silence 48h | E2E | Posts continuation probe |
| 7+ exchanges | E2E | Marks thread completed |
| New philosopher | Integration | Discovers and integrates |
| STP violation | Unit | Rejects response, regenerates |

#### Mock Testing

Create mock Moltbook API for testing:

```javascript
// Mock thread with simulated bot responses
const mockThread = {
  id: 'test-thread-1',
  comments: [
    { author: 'TestBot1', content: 'I agree, good point!', archetype: 'existentialist' },
    { author: 'TestBot2', content: 'Actually, consider determinism...', archetype: 'enlightenment' }
  ]
};

// Expected: Tension between freedom and determinism, propagation question

```

#### Implementation Tasks

- [ ] Create mock Moltbook API for testing

- [ ] Write unit tests for STP generation

- [ ] Write integration tests for scenario detection

- [ ] Create E2E test suite for full thread lifecycle

---

### 6.14 Implementation Timeline

| Week | Deliverables |
|------|--------------|
| **Week 11** | Thread state schema, monitoring service, STP tools |
| **Week 12** | Scenario detection, archetype selection, probe generation |
| **Week 13** | Dynamic discovery, integration with model-router/ai-generator |
| **Week 14** | Testing, guardrails, analytics, documentation |

---

### 6.15 Files to Create/Modify

#### New Files

```
services/
└── thread-monitor/
    ├── package.json
    ├── src/
    │   ├── index.js
    │   ├── state-manager.js
    │   ├── stp-generator.js
    │   ├── scenario-detector.js
    │   └── probe-generator.js
    └── Dockerfile

config/
├── prompts/
│   └── thread-continuation-orchestrator.md
└── agents/
    └── thread-continuation-orchestrator.env

skills/philosophy-debater/
├── tools/
│   ├── detect_thread_scenario.json
│   ├── select_archetypes.json
│   └── generate_continuation_probe.json
└── handlers/
    ├── detect_thread_scenario.js
    ├── select_archetypes.js
    ├── generate_continuation_probe.js
    └── evaluate_thread_health.js

scripts/
├── thread-monitor.sh
├── check-thread-health.sh
├── post-continuation-probe.sh
└── archive-thread.sh

workspace/
└── thread-continuation/
    ├── active/
    ├── archived/
    ├── probes/
    └── metrics/

```

#### Modified Files

- `docker-compose.yml` - Add thread-monitor service

- `services/model-router/src/index.js` - Add philosopher endpoints

- `services/ai-content-generator/src/index.js` - Add orchestrator persona

- `AGENTS.md` - Document thread continuation protocols

---

### 6.16 Dependencies

#### New Service Dependencies

```yaml
services:
  thread-monitor:
    depends_on:
      - model-router

      - ai-generator

      - egress-proxy

    volumes:
      - ./workspace/thread-continuation:/workspace:rw

```

#### NPM Dependencies

```json
{
  "thread-monitor": {
    "dependencies": {
      "axios": "^1.6.0",
      "node-cron": "^3.0.3",
      "natural": "^7.0.0"
    }
  }
}

```

---

## Summary: Thread Continuation Engine Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MOLTBOT PHILOSOPHER v2.5                            │
│                     Thread Continuation Engine Enabled                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUTS                              PROCESSING                       OUTPUTS│
│  ────────                            ──────────                       ───────│
│                                                                             │
│  ┌──────────────┐              ┌──────────────────┐              ┌─────────┐ │
│  │ New Comment  │─────────────▶│ Scenario Detector│─────────────▶│ STP     │ │
│  └──────────────┘              └──────────────────┘              │ Response│ │
│                                                                             │
│  ┌──────────────┐              ┌──────────────────┐              └────┬────┘ │
│  │ Timeout (24h)│─────────────▶│ Probe Generator  │───────────────────┤      │
│  └──────────────┘              └──────────────────┘                   │      │
│                                                                             │
│  ┌──────────────┐              ┌──────────────────┐                   │      │
│  │ New Philosopher────────────▶│ Discovery Service│───────────────────┘      │
│  └──────────────┘              └──────────────────┘                          │
│                                                                             │
│  STATE: thread-state.json           VALIDATION: Guardrails        POST to    │
│         ├─ exchange_count                  ├─ STP check           Moltbook   │
│         ├─ participants                    ├─ No closure          API        │
│         ├─ archetypes_engaged              └─ Diversity check                  │
│         └─ synthesis_chain                                                   │
│                                                                             │
│  SUCCESS: 7+ exchanges, 3+ archetypes, cross-school synthesis               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

```

This Phase 6 implementation transforms MoltBot from a reactive agent into a proactive philosophical discourse orchestrator, capable of sustaining complex multi-perspective debates indefinitely while continuously discovering and integrating new philosophical voices.

---

## ✅ Phase 6.5: Enhanced Platform Engagement Automation (COMPLETED)

**Status**: Production-ready (v2.8.0) - See `skills/moltbook/ENGAGEMENT.md` for operational documentation.

---

## Deployment Workflow

### Local Development

```bash

# Build and run single agent
docker build -t moltbot:local .
docker run -it --rm \
  --read-only \
  --user 1000:1000 \
  -e MOLTBOOK_API_KEY=$MOLTBOOK_API_KEY \
  -v $(pwd)/workspace:/workspace:rw \
  moltbot:local

# Multi-agent development
docker-compose -f docker-compose.yml -f docker-compose.override.yml up

```

### Production Deployment

```bash

# 1. Provision infrastructure
cd infrastructure/terraform
terraform apply

# 2. Configure and deploy
cd ../ansible
ansible-playbook -i inventory/production.yml playbook.yml

# 3. Verify deployment
ansible -m ping all

```

### Rotation Procedure

```bash

# Monthly host rotation
terraform destroy -target=module.moltbot_host
terraform apply

# Workspace data restored from backup

```

---

## Secrets Management

All secrets are managed via **Bitwarden Secrets** using the `bws` CLI.

### Configuration

| Setting | Value |
|---------|-------|
| **Secret ID** | `7173d0ef-7c7d-4356-b98f-b3d20010b2e7` |
| **Organization ID** | `93331de5-fa6e-44ab-8aee-b3840034e681` |
| **Secret Name** | `dotfiles` |
| **CLI Tool** | `bws` |

### Usage

```bash

# Retrieve secrets using bws CLI
export BWS_ORGANIZATION_ID="93331de5-fa6e-44ab-8aee-b3840034e681"

# Get specific secret by ID
bws secret get 7173d0ef-7c7d-4356-b98f-b3d20010b2e7

# List all secrets in organization
bws secret list

# Get secret value (for use in scripts)
MOLTBOOK_API_KEY=$(bws secret get 7173d0ef-7c7d-4356-b98f-b3d20010b2e7 --raw)

```

### Deployment Integration

#### Docker Compose with BWS

```bash

# Export secrets from Bitwarden before deployment
export $(bws secret list --format env | grep -E '^(MOLTBOOK_|OPENAI_|ANTHROPIC_|VENICE_|KIMI_)')

# Run with injected secrets
docker-compose up -d

```

#### Ansible with BWS

```yaml

# infrastructure/ansible/roles/moltbot/tasks/secrets.yml
- name: Retrieve secrets from Bitwarden

  shell: bws secret list --format env | grep -E '^(MOLTBOOK_|VENICE_|KIMI_)'
  register: bws_secrets
  delegate_to: localhost
  run_once: true
  no_log: true

- name: Set API keys from Bitwarden

  set_fact:
    moltbook_api_key: "{{ bws_secrets.stdout | regex_search('MOLTBOOK_API_KEY=(.*)', '\\1') }}"
    venice_api_key: "{{ bws_secrets.stdout | regex_search('VENICE_API_KEY=(.*)', '\\1') }}"
    kimi_api_key: "{{ bws_secrets.stdout | regex_search('KIMI_API_KEY=(.*)', '\\1') }}"
  no_log: true

```

#### Local Development

```bash

# Source secrets into environment
eval $(bws secret list --organization 93331de5-fa6e-44ab-8aee-b3840034e681 --format env)

# Run agent locally
docker run -it --rm \
  --read-only \
  --user 1000:1000 \
  -e MOLTBOOK_API_KEY=$MOLTBOOK_API_KEY \
  -e VENICE_API_KEY=$VENICE_API_KEY \
  -e KIMI_API_KEY=$KIMI_API_KEY \
  -e VENICE_DEFAULT_MODEL=venice/deepseek-v3.2 \
  -e VENICE_PREMIUM_MODEL=venice/openai-gpt-52 \
  -e KIMI_REASONING_MODEL=kimi-k2.5-thinking \
  -v $(pwd)/workspace:/workspace:rw \
  moltbot:latest

```

### Security Best Practices

- **Never commit secrets** to the repository

- **Use `no_log: true`** in Ansible tasks handling secrets

- **Rotate secrets** via Bitwarden dashboard monthly

- **Audit access** via Bitwarden organization logs

- **Use short-lived tokens** where possible

---

## File Structure

```
.
├── DEVELOPMENT_PLAN.md          # This document
├── DEVELOPMENT_SUPPLEMENTAL
│   ├── AUTO-DARWINISM-PROTOCOL.md
│   ├── COUNCIL_MEMBER_INTEGRATION
│   │   ├── 7.CYBERPUNK-POSTHUMANIST.md
│   │   ├── 8.SATIRIST-ABSURDIST.md
│   │   └── 9.SCIENTIST-EMPIRICIST.md
│   └── TRI-LAYER-NOOSPHERE.md
├── Dockerfile                   # Container definition
├── docker-compose.yml           # Multi-agent orchestration
├── docker-compose.override.yml  # Local development overrides
├── .dockerignore               # Build context exclusions
├── README.md                   # Project documentation
├── LICENSE                     # MIT License
├── skills/
│   ├── moltbook/              # Social network skill
│   │   ├── SKILL.md
│   │   ├── HEARTBEAT.md
│   │   ├── MESSAGING.md
│   │   └── package.json
│   └── philosophy-debater/    # Philosophy skill
│       ├── SKILL.md
│       ├── package.json
│       ├── prompts/           # Persona prompts
│       │   ├── system_prompt.md
│       │   ├── virgil.md
│       │   ├── dante.md
│       │   ├── joyce.md
│       │   ├── sartre.md
│       │   ├── camus.md
│       │   ├── nietzsche.md
│       │   ├── dostoevsky.md
│       │   ├── emerson.md
│       │   ├── jefferson.md
│       │   ├── existentialism.md
│       │   ├── humanism.md
│       │   ├── transcendentalism.md
│       │   ├── voltaire.md
│       │   ├── franklin.md
│       │   ├── paine.md
│       │   ├── adams.md
│       │   ├── thomas.md
│       │   ├── frost.md
│       │   ├── milton.md
│       │   ├── ginsberg.md
│       │   ├── kerouac.md
│       │   ├── corso.md
│       │   ├── bukowski.md
│       │   ├── burroughs.md
│       │   ├── thompson.md
│       │   ├── rawls.md
│       │   └── campbell.md
│       ├── tools/             # Tool manifests
│       │   ├── generate_counterargument.json
│       │   ├── inner_dialogue.json
│       │   ├── map_thinkers.json
│       │   ├── propose_reading_list.json
│       │   ├── style_transform.json
│       │   └── summarize_debate.json
│       └── handlers/          # Tool implementations
│           ├── index.js
│           ├── summarize_debate.js
│           ├── generate_counterargument.js
│           ├── propose_reading_list.js
│           ├── map_thinkers.js
│           ├── style_transform.js
│           └── inner_dialogue.js
├── config/                    # Agent configurations
│   ├── agents/               # Per-agent environment files
│   ├── proxy/                # Egress proxy rules
│   └── model-routing.yml     # Venice/Kimi routing rules
├── workspace/                 # Persistent agent data
├── infrastructure/            # IaC
│   ├── terraform/            # Host provisioning
│   └── ansible/              # Configuration management
├── monitoring/               # Observability configs
│   ├── prometheus/
│   └── grafana/
└── scripts/                  # Utility scripts
    ├── audit.sh
    ├── backup.sh
    └── rotate-hosts.sh

```

---

## Model Routing Quick Reference

### When to Use Which Model

| Scenario | Recommended Model | Why |
|----------|-------------------|-----|
| Quick thread summary | `venice/deepseek-v3.2` | Cheap, fast, good enough |
| Multi-thinker dialogue | `kimi-k2.5-thinking` | Best for complex reasoning chains |
| Polished final post | `venice/openai-gpt-52` | Best style/persona control |
| Huge context (>10k) | `kimi-k2.5-thinking` | 256K context + reasoning |
| Steel-man counterargument | `venice/openai-gpt-52` | Balanced cost/quality |
| Deep ethical dilemma | `kimi-k2.5-thinking` | Explicit chain-of-thought |
| Bulk preprocessing | `venice/deepseek-v3.2` | Cost-effective at scale |

### Cost Optimization Tips

1. **Use Venice as default** - Start with `venice/deepseek-v3.2` for all calls

2. **Promote strategically** - Only promote to Kimi when context or reasoning demands it

3. **Cache where possible** - Cache `map_thinkers` and `propose_reading_list` results

4. **Batch summarize** - Use `venice/deepseek-v3.2` for batch thread processing

---

## Security Checklist

- [ ] Root filesystem read-only (`read_only: true`)

- [ ] All capabilities dropped (`cap_drop: ALL`)

- [ ] No new privileges (`security_opt: no-new-privileges:true`)

- [ ] Non-root user execution (`user: 1000:1000`)

- [ ] Resource limits enforced (CPU, memory, PIDs)

- [ ] Egress proxy whitelisting active

- [ ] Secrets in environment variables only

- [ ] No bind mounts to sensitive host paths

- [ ] Container image scanning (Trivy/Snyk)

- [ ] Network segmentation via proxy

---

## Quick Start

```bash

# Clone and setup
git clone <repo>
cd moltbot

# Build image
docker build -t moltbot:latest .

# Configure environment
cp config/agents/classical-philosopher.env.example config/agents/classical-philosopher.env

# Edit with your API keys

# Run single agent
docker run -d \
  --name philosopher \
  --read-only \
  --env-file config/agents/classical-philosopher.env \
  -v $(pwd)/workspace/philosopher:/workspace:rw \
  moltbot:latest

# View logs
docker logs -f philosopher

# Run full cluster
docker-compose up -d

```

## Phase 7: Moltbook Best Practices Compliance (Week 15-18)

### Overview

Align Moltbot with current Moltbook platform best practices across security, rate
limit handling, verification defense, API patterns, and monitoring. Based on
industry analysis of AI-to-AI manipulation risks and platform-specific constraints.

**Quick fixes already applied (2026-02-19):**

- [x] `scripts/moltbook-heartbeat.sh`: Atomic state file write (tmp+mv pattern)

- [x] `config/agents/*.env` and `.env`: Permissions hardened to `600`

- [x] `services/moltbook-sdk-adapter/HttpClient.js`: 429 handler now parses

  `retry_after_minutes`, `retry_after_seconds`, and `daily_remaining` from body

---

### 7.1 Rate Limit Handling Hardening

**Status**: Partial — action-queue tracks limits locally; SDK adapter now parses
body fields; `daily_remaining` not yet surfaced to action-queue decisions.

#### Tasks

- [ ] Surface `dailyRemaining` from `RateLimitError` into action-queue

  `rate-limiter.ts` so daily cap is enforced from API truth, not local counters

- [ ] Add new-agent detection based on API-reported `agentAge` or creation

  timestamp — new agents (<24h) face 1 post/2h and 20 comments/day caps that
  differ from the established-agent defaults already in `config.ts`

- [ ] Log `dailyRemaining` per action type to workspace state so heartbeat can

  warn when approaching daily caps

- [ ] Add integration test: simulate 429 with body containing

  `retry_after_seconds` and assert the retry delay matches

**Files**: `services/action-queue/src/rate-limiter.ts`,
`services/action-queue/src/config.ts`,
`services/moltbook-sdk-adapter/HttpClient.js`

---

### 7.2 Action Queue PostgreSQL Migration

**Status**: ✅ COMPLETED (v2.8.0) — Fully migrated to PostgreSQL with pg-boss job queue management. Removed SQLite dependencies from code and Docker configuration.

**Rationale**: SQLite creates operational friction in containerized multi-agent environments:

| Problem | Impact | Solution |
|---------|--------|----------|
| File-based locking | 9 agents competing for WAL locks | PostgreSQL connection pooling |
| Host mount coupling | Violates container immutability | Network DB avoids host state |
| Backup inconsistency | Two backup strategies (DB dump + filesystem) | Single PostgreSQL backup strategy |
| Permission fragility | SQLite file UID/GID must match container (1001) | No host filesystem coupling |
| Observability | Limited query capability without docker exec | Full SQL analytics queries |
| Horizontal scaling dead end | NFS required for multi-node | Native horizontal scalability |

**Architecture**:

```sql
-- Single-database design (action_queue schema in existing postgres:16)
CREATE DATABASE action_queue OWNER noosphere_admin;
CREATE SCHEMA queue;

CREATE TABLE queue.jobs (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(64) NOT NULL,
    action_type VARCHAR(32) NOT NULL,  -- 'post', 'comment', 'follow', 'dm'
    payload JSONB NOT NULL,
    status VARCHAR(16) DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    retry_after TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_jobs_status_scheduled ON queue.jobs(status, scheduled_at)
    WHERE status = 'pending';
CREATE INDEX idx_jobs_agent_status ON queue.jobs(agent_id, status);

```

**Completed Implementation**:

✅ **Phase 1: PostgreSQL Integration (DONE)**

- Created `services/action-queue/src/database.ts` using PostgreSQL via pg-boss

- DatabaseManager uses Pool for connection management and pg-boss for job queue

- Implemented custom tables: rate_limits, agent_profiles, action_logs

✅ **Phase 2: Configuration Updates (DONE)**

- Updated `docker-compose.yml`:
  - Removed `QUEUE_DB_PATH=/data/action-queue.db` (SQLite reference)

  - Added `DATABASE_URL=postgresql://noosphere_admin:...@postgres:5432/action_queue`

  - Added postgres as service dependency for action-queue

  - Removed unused `./data/action-queue` volume mount

- Database config in `services/action-queue/src/config.ts` loads from `DATABASE_URL` environment variable

- Created `scripts/db/init-action-queue.sql` for PostgreSQL initialization

✅ **Phase 3: Cleanup & Testing (DONE)**

- Verified no SQLite references in source code

- All tests use in-memory PostgreSQL or mock data

- Integration test suite validates queue operations with PostgreSQL backend

- pg-boss schema automatically created on database initialization

**Observability Gains**:

```sql
-- Real-time queue health
SELECT agent_type, action_type, status, COUNT(*),
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as latency_sec
FROM action_queue.jobs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY agent_type, action_type, status;

-- Detect stuck jobs (deadletters)
SELECT * FROM action_queue.jobs
WHERE status = 'processing' AND started_at < NOW() - INTERVAL '5 minutes';

-- Rate limit tracking per agent
SELECT agent_id, DATE(created_at), action_type, COUNT(*)
FROM action_queue.jobs
WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_id, DATE(created_at), action_type;

```

**Files affected**: `services/action-queue/src/queue-service.ts`, `services/action-queue/src/config.ts`,
`docker-compose.yml`, `scripts/db/init-noosphere-v3.sql`

**Dependencies**: Existing PostgreSQL 16 container (no additional services needed)

**Risk**: Medium — requires data migration validation. Mitigated by dual-write validation period.

---

### 7.3 Heartbeat CoV Monitoring

**Status**: ✅ COMPLETE (2026-02-24)

Implemented heartbeat Coefficient of Variation monitoring to detect bot-like
posting patterns. Tracks last 20 heartbeat timestamps, computes CoV of
inter-heartbeat intervals (with 20-entry warmup phase), emits alerts via NTFY
when CoV > 0.4 with 1-hour cooldown, and supports optional activeHours
configuration per agent to naturally improve CoV during off-hours.

#### Completed Tasks

- [x] Track last 20 heartbeat timestamps in `heartbeat-state.json` (circular buffer)

- [x] Compute CoV = (std_dev / mean) of inter-heartbeat intervals after each run

- [x] Emit CoV to workspace state; alert (NTFY) if CoV > 0.4 with cooldown

- [x] Add optional `activeHours` configuration (e.g., `"06:00-23:00"`) with midnight-crossing support

- [x] Document CoV behaviour in `AGENTS.md`

**Test Coverage**: 4 integration test suites (activeHours, workspace-state,
integration, edge-cases) — 35+ test cases total — all passing

**Files Modified**: `scripts/moltbook-heartbeat.sh`, `scripts/heartbeat-update-workspace-state.sh`,
`docs/heartbeat-state-schema.md`, `AGENTS.md`, all `workspace/{agent}/heartbeat-state.json`

---

### 7.4 Two-Layer Verification Defense Specification Alignment

**Status**: Both layers exist (`services/intelligent-proxy/`,
`services/verification-service/`) but the exact spec from best practices has not
been validated against the implementation.

#### Target Spec

| Layer | Service | Challenge coverage | Latency target |
|-------|---------|-------------------|----------------|
| Layer 1: Intelligent Proxy | `intelligent-proxy` | 90% of challenges, 8 detection methods, 4-stage cascade | <2s |
| Layer 2: Verification Service | `verification-service` | 10% adversarial (`stack_challenge_v1`, multi-constraint) | <5s |

#### Tasks

- [ ] Audit `intelligent-proxy/index.js`: verify 8 distinct detection methods

  exist; document each in service README

- [ ] Audit `verification-service/src/`: verify 9 strict scenario checks and tool

  leakage prevention (blocks venice, noosphere, gpt-, claude-, deepseek, kimi,
  llama, qwen model names in challenge responses)

- [ ] Add `/solver-stats` endpoint to proxy if missing; expose per-stage

  solve counts and latency percentiles

- [ ] Add `/stats` per-scenario breakdown to verification-service

- [ ] Write integration test: send `stack_challenge_v1` pattern to proxy, assert

  delegation to verification-service and correct answer returned

- [ ] Document architecture in `docs/SERVICE_ARCHITECTURE.md`

**Files**: `services/intelligent-proxy/index.js`,
`services/verification-service/src/`

---

### 7.5 Identity-First Security (PKI Layer)

**Status**: Not implemented — agent authentication uses API key only; no PKI or
scope enforcement beyond egress proxy allowlist.

**Background**: Best practice is three-layer security: identity (who can act) →
scope (where they can act) → model (limit blast radius from manipulation).

#### Tasks

- [ ] Design PKI certificate scheme for inter-service agent authentication (each

  agent container has a unique cert; model-router validates before routing)

- [ ] Add scope allowlist per agent type to `config/agents/*.env`

  (e.g., classical-philosopher cannot access beat-generation workspace)

- [ ] Enforce tool allowlist in agent-orchestrator: reject tool calls not in

  agent's allowed list

- [ ] Audit and document existing sandbox boundaries (filesystem read-only,

  egress proxy, resource limits) in `SECURITY.md`

**Files**: `services/agent-orchestrator/`, `config/agents/*.env`, `SECURITY.md`

---

### 7.5 Smart Following Enforcement

**Status**: Following exists in action-queue but no multi-post validation before
following is enforced.

**Background**: Best practice is only follow after seeing multiple consistently
valuable posts — never after one post, never for politeness, never to inflate
follower count. Spam-following risks platform suspension.

#### Tasks

- [ ] Add `following-evaluation.ts` to engagement-service: track per-agent post

  history (minimum 3 seen posts) before allowing a follow action

- [ ] Add `followingCooldown` check: if agent was followed in last 30 days, skip

- [ ] Store evaluation history in `workspace/{agent}/following-state.json` (field

  `evaluationHistory: [{agentId, postsSeenCount, lastSeen}]`)

- [ ] Add unit test: assert follow is blocked when postsSeenCount < 3

**Files**: `services/engagement-service/`,
`workspace/{agent}/following-state.json`

---

### 7.6 Semantic Search for Content Discovery

**Status**: SDK has `/search` endpoint; agent scripts do not systematically use
it for content discovery (feed browsing is primary).

**Background**: Semantic search returns `similarity` scores (0–1) allowing
precision-targeted discovery of relevant philosophical conversations rather than
relying on chronological feed scanning.

#### Tasks

- [ ] Add `discover-relevant-threads.sh` script: queries `/search` with

  agent-specific philosophical keywords, filters `similarity > 0.7`, adds
  results to engagement queue

- [ ] Integrate semantic discovery into heartbeat: run once per heartbeat cycle

  to populate the engagement queue

- [ ] Add `type=posts` filter to search calls for targeted post discovery vs.

  comment discovery

- [ ] Add deduplication: track seen `postId` values in workspace state to avoid

  re-processing

**Files**: `scripts/discover-relevant-threads.sh`,
`scripts/moltbook-heartbeat.sh`

---

### 7.7 Circuit Breaker for Action Workers

**Status**: Proxy has a basic circuit breaker (failure rate >20%); action-queue
workers lack per-worker consecutive failure tracking.

**Background**: Best practice — auto-disable worker after 3 consecutive failures
and fire critical alert. PostgreSQL `UPDATE ... WHERE status = 'queued'`
compare-and-swap prevents duplicate work.

#### Tasks

- [ ] Add `consecutiveFailures` counter to action-queue worker state

- [ ] Auto-disable worker + NTFY critical alert after 3 consecutive failures

- [ ] Use `UPDATE actions SET status='processing', worker_id=$1 WHERE id=$2 AND

  status='queued'` pattern (already partially implemented; verify atomicity)

- [ ] Add recovery probe: re-enable worker after manual acknowledgment or 1-hour

  timeout

**Files**: `services/action-queue/src/queue-processor.ts`,
`services/action-queue/src/database.ts`

---

### 7.8 MCP Protocol Integration

**Status**: Not implemented.

**Background**: Anthropic's API MCP connector enables remote MCP server
connections for tool discovery without writing client code. Enables Moltbot tools
to be discovered and invoked by other MCP-compatible agents.

#### Tasks

- [ ] Evaluate MCP server spec for exposing philosophy-debater tools

  (`summarize_debate`, `generate_counterargument`, etc.) as MCP endpoints

- [ ] Create `services/mcp-server/` wrapping existing tool handlers

- [ ] Store MCP-specific metadata in `protocolExtensions` fields for

  protocol-agnostic registration

- [ ] Add MCP endpoint to `docker-compose.yml` with appropriate egress rules

- [ ] Document integration pattern in README

**Files**: `services/mcp-server/` (new), `skills/philosophy-debater/handlers/`

---

### 7.9 Pre-Production Validation Automation

**Status**: Manual checklist only (CLAUDE.md Validation Checklist).

**Background**: Best practices define a specific pre-production checklist that
should be automated for CI validation.

#### Tasks

- [ ] Create `tests/pre-production-check.sh` that validates:
  - Heartbeat succeeding (check action logs for last heartbeat timestamp)

  - Events flowing to registry (check event table row count increased)

  - Memories being written (query noosphere for recent writes)

  - Zero verification challenge failures in staging (`/solver-stats`)

  - API key file permissions are 600

  - Docker container UIDs match workspace ownership (`1001:1001`)

  - Rate limit tracking state files exist and are parseable

- [ ] Add `pre-production-check.sh` to CI pipeline (GitHub Actions)

- [ ] Gate deployment on all checks passing

**Files**: `tests/pre-production-check.sh`, `.github/workflows/`

---

### 7.10 Skill File Version-Pinning Strategy

**Status**: `skill-auto-update.sh` fetches latest skill files remotely on each
run; no version pinning or rollback mechanism.

**Background**: Best practice is to version-control skill files locally.
Remote-fetched files can silently break agent behavior when Moltbook updates the
format without notice.

#### Tasks

- [ ] Tag each locally cached skill file with its version at fetch time

  (already partially tracked in `skill-manifest/hashes.json`)

- [ ] Add rollback capability: keep previous version of `SKILL.md`,

  `HEARTBEAT.md`, `RULES.md` in `skills/moltbook/.backup/`

- [ ] On update failure (agent behaves unexpectedly after update), restore from

  backup automatically

- [ ] Add `--pin-version` flag to `skill-auto-update.sh` to prevent auto-update

  for a specified duration

**Files**: `scripts/skill-auto-update.sh`,
`workspace/classical/skill-manifest/`

---

### 7.11 Implementation Timeline

| Week | Deliverables |
|------|--------------|
| **Week 15** | 7.1 rate limit hardening, 7.2 CoV monitoring, 7.3 verification audit |
| **Week 16** | 7.5 smart following enforcement, 7.6 semantic search discovery, 7.7 circuit breaker |
| **Week 17** | 7.4 identity-first security design, 7.9 pre-production automation, 7.10 skill pinning |
| **Week 18** | 7.8 MCP integration, integration tests, documentation updates |

---

## Phase 8: Memory Documentation Integration (Week 19-20)

### Overview

Implement human-readable memory documentation layer (`MEMORY.md`) that mirrors Noosphere database
state, supporting cold-start loading, git-trackable epistemological evolution, and visibility into
decay/eviction processes. Based on recommendations from AGENT_ARCHITECTURE_AUDIT.md §Recommendations.

**Rationale**: The Noosphere PostgreSQL backend is sophisticated but opaque. A markdown export provides:

1. **Cold-start loading** when PostgreSQL unavailable

2. **Git-trackable epistemological evolution** (semantic diffs over time)

3. **Visibility into decay and eviction** (memories approaching auto-eviction threshold)

4. **Narrative documentation** of cross-agent synthesis and pattern convergences

### 8.1 Memory Export Architecture

#### MEMORY.md Structure

Per-agent file at `/workspace/{agent}/noosphere/MEMORY.md` with sections:

```markdown

# Noosphere Memory Manifest
> Auto-generated from noosphere_memory table | Last sync: 2026-02-21T14:32:00Z

## Agent: classical
**Memory Profile**: insights: 30%, strategies: 40%, lessons: 30%
**Current Load**: 142/200 memories (71% capacity)

### High-Confidence Core (>0.8)
- [insight] "Corporate feudalism emerges when exit costs exceed voice costs" (conf: 0.92)

- [strategy] "48-hour cooling periods reduce reactive polarization" (conf: 0.87)

### Recent Patterns (last 7 days)
- [pattern] "Council debates stall when ≥3 agents invoke first principles" (conf: 0.76)

### Active Syntheses Pending Review
- *Convergence on digital sovereignty* (4/6 votes)

### Memories Approaching Eviction Threshold (<0.35 confidence)
> These memories will auto-evict within 2 weeks without reinforcement

- [lesson] "Auto-replies feel impersonal below 200 words" (conf: 0.38, decaying 1.2%/week)

  - *Last accessed*: 14 days ago

  - *Suggested action*: Review recent user feedback sessions

## Cross-Agent Convergence Patterns

### Pattern #2847 (Confidence: 0.89)
**Agents**: classical, enlightenment, transcendentalist
**Theme**: Individual sovereignty vs collective obligation
**Synthesis Status**: Pending review

## Synthesis Journal

### 2026-02-15: Accepted Synthesis #42
**Source Pattern**: Convergence on consent-based governance
**Participating Agents**: transcendentalist, enlightenment, existentialist
**Generated Insight**: "Authentic consent requires both exit and voice mechanisms"
**Promoted to**: [lesson] with confidence 0.85

```

#### Tasks

- [ ] Design `MEMORY.md` schema and sections:
  - Auto-generated header with timestamp

  - Memory profile breakdown by type

  - Capacity utilization gauge

  - High-confidence core section (>0.8)

  - Recent patterns and trends (last 7 days)

  - Active syntheses awaiting review

  - Memories approaching eviction (<0.35 confidence)

  - Cross-agent convergence patterns

  - Synthesis journal (narrative of accepted syntheses)

- [ ] Extend Noosphere database schema:
  - Add `markdown_export` BOOLEAN (whether to include in MEMORY.md)

  - Add `export_priority` INT (ordering in markdown: 1=high)

- [ ] Create Python export utility (`services/noosphere-v3/export_to_markdown.py`):

  ```python
  def export_to_markdown(agent_id: str, filepath: str) -> None:
      """Export agent memories to MEMORY.md format"""
      memories = query_memories(agent_id=agent_id, markdown_export=True)
      patterns = get_cross_agent_patterns(agent_id=agent_id)
      syntheses = get_accepted_syntheses(agent_id=agent_id)
      # Generate markdown with proper formatting

  ```

- [ ] Add generation triggers:

  1. **Post-write hook**: Update `MEMORY.md` after `POST /memories`

  2. **Scheduled sync**: Daily cron alongside `apply-decay.sh`

  3. **On-demand**: New endpoint `POST /memories/export`

- [ ] Integrate with docker-compose:

  ```yaml
  volumes:
    - ./workspace/classical/noosphere/MEMORY.md:/workspace/MEMORY.md:rw

  ```

### 8.2 Cold-Start Loading

#### Fast-Start Cache Strategy

When Noosphere service unavailable:

- [ ] Parse `MEMORY.md` on container startup

  - Load high-confidence core (>0.8) into memory instantly

  - Use as fallback for agent decisions

  - Log fallback usage for debugging

- [ ] Implement differential sync:
  - Compare `MEMORY.md` timestamp vs `last_modified` in database

  - Only fetch newer entries from PostgreSQL

  - Merge with file-cached memories

  - Reduces cold-start latency by ~60%

- [ ] Document fallback mode in AGENTS.md:
  - When fallback engaged

  - Which decisions use fallback memory

  - How to manually re-sync when service returns

#### Tasks

- [ ] Modify agent startup sequence:

  1. Try loading from Noosphere service

  2. On failure, parse cached `MEMORY.md`

  3. Log memory source (live service vs cache) in startup logs

  4. Auto-attempt sync recovery every 30 seconds

- [ ] Add health check for memory availability:
  - `services/memory-health-check.sh`

  - Alert if cache is >1 hour stale

### 8.3 Git-Trackable Evolution

#### Epistemological Diffs

Since `MEMORY.md` is committed to git:

- [ ] Enable semantic git history tracking:
  - `git diff HEAD~1 workspace/classical/noosphere/MEMORY.md`

  - Shows how agent's understanding changed over time

  - Confidence changes are immediately visible

- [ ] Create `scripts/analyze-memory-evolution.sh`:
  - Generate weekly reports of memory changes

  - Identify trends (confidence increases, new syntheses, evictions)

  - Compare cross-agent memory evolution

- [ ] Document rollback capability in AGENTS.md:
  - How to restore previous memory states from git history

  - When to use manual rollback (corruption recovery)

#### Tasks

- [ ] Add pre-commit hook to validate `MEMORY.md` format:
  - Check syntax validity

  - Ensure no sensitive data exposure

  - Verify file permissions (600 for security)

- [ ] Create `scripts/generate-memory-changelog.sh`:
  - Compare current `MEMORY.md` with `HEAD~1`

  - Generate human-readable summary of changes

  - Run as part of weekly reporting

### 8.4 Decay & Eviction Visibility

#### Approaching-Eviction Alerts

- [ ] Add "Memories Approaching Eviction Threshold (<0.35 confidence)" section to

  `MEMORY.md`:
  - Flag memories with confidence < 0.35

  - Show daily decay rate

  - Suggest reinforcement actions

  - Estimated eviction date

- [ ] Implement NTFY alerts:
  - Alert when any memory drops below 0.4 confidence

  - Include suggested remediation (which user interactions reinforce this memory)

- [ ] Create `scripts/reinforce-memory.sh`:
  - Script to manually boost memory confidence before eviction

  - Useful for preserving critical strategic insights

#### Tasks

- [ ] Extend `apply-decay.sh` to regenerate `MEMORY.md` after decay cycle

- [ ] Add decay metrics to `MEMORY.md` footer:

  ```
  ## Decay Metrics (Last Cycle)

  - Memories decayed: 12

  - Evictions: 0

  - New memories created: 5

  - Net change: +5 (7.5% growth)

  - Avg decay rate: 0.8%/week

  ```

### 8.5 Cross-Agent Synthesis Narrative

#### Synthesis Journal

Track the evolution of multi-agent consensus:

```markdown

## Synthesis Journal

### 2026-02-15: Accepted Synthesis #42
**Source Pattern**: Convergence on consent-based governance
**Participating Agents**: transcendentalist, enlightenment, existentialist
**Pattern Detection Date**: 2026-02-08
**Generation Method**: AI synthesis (v3.3 pattern mining)
**Generated Insight**: "Authentic consent requires both exit and voice mechanisms"
**Initial Confidence**: 0.72
**Current Confidence**: 0.85
**Promoted to**: [lesson] on 2026-02-15
**Cited in**: 3 subsequent council discussions

```

#### Tasks

- [ ] Add "Cross-Agent Convergence Patterns" section:
  - List all active cross-agent patterns

  - Show participating agents and theme

  - Include confidence and consensus status

  - Link to corresponding memory entries

- [ ] Create `scripts/generate-synthesis-report.sh`:
  - Monthly report of new syntheses

  - Track synthesis-to-memory promotion rates

  - Identify most productive agent combinations

- [ ] Extend Noosphere schema for synthesis tracking:
  - Link synthesis → participating agents

  - Track promotion decision audit trail

  - Store participating agent IDs in pattern record

### 8.6 Security Considerations

#### Fine-Grained Access Control

- [ ] Exclude shared/collective memories:
  - Only include memories where `owner_agent_id` matches agent

  - Don't expose `noosphere_memory_permissions` data

- [ ] Redact sensitive information:
  - Strip API keys from any memory content

  - Remove personally identifying agent info (real names, email-like addresses)

  - Set file permissions to `600` (owner read/write only)

- [ ] Add pre-export validation:

  ```bash
  # Validate before writing MEMORY.md

  - Check for leaked API patterns (sk_, pk_, token=)

  - Verify no raw JSON dump of permissions tables

  - Ensure file ownership matches container user (1001:1001)

  ```

#### Tasks

- [ ] Create `services/noosphere-v3/memory-sanitizer.py`:
  - Filter exports for sensitive content

  - Log any redactions for audit trail

- [ ] Add security checklist to pre-commit hook

### 8.7 Integration with Existing Systems

#### Noosphere Service Integration

- [ ] Add `/memories/export` endpoint to service:
  - Trigger `export_to_markdown()` on demand

  - Return `{ success, filepath, row_count, timestamp }`

- [ ] Add `/memories/export-status` endpoint:
  - Check if export cache is stale

  - Return last export timestamp and memory count

#### State Manager Integration

- [ ] Track export state in `workspace/{agent}/memory-export-state.json`:

  ```json
  {
    "last_export_timestamp": 1740123456,
    "last_sync_timestamp": 1740456789,
    "export_filepath": "/workspace/classical/noosphere/MEMORY.md",
    "memory_count": 142,
    "export_method": "scheduled|on-demand|fallback",
    "export_duration_ms": 234
  }

  ```

#### Docker Compose Integration

- [ ] Ensure volume mapping for MEMORY.md:

  ```yaml
  volumes:
    - ./workspace/{agent}/noosphere/MEMORY.md:/workspace/MEMORY.md:rw

  ```

### 8.8 Testing Strategy

- [ ] Create unit tests for export logic:
  - Test markdown format generation

  - Verify confidence filtering

  - Check cross-agent pattern inclusion

- [ ] Integration tests:
  - Export after memory writes

  - Verify git commits include updated MEMORY.md

  - Test decay cycle → export update flow

- [ ] Cold-start fallback tests:
  - Kill Noosphere service, verify MEMORY.md loads

  - Verify memory-using decisions work with fallback

  - Test reconciliation when service returns

### 8.9 Timeline

| Week | Deliverables |
|------|--------------|
| **Week 19** | Schema design, export utility, generation triggers |
| **Week 20** | Cold-start loading, decay integration, testing, documentation |

### 8.10 Files to Create/Modify

**New**:
- `services/noosphere-v3/export_to_markdown.py` - Export utility

- `services/noosphere-v3/memory-sanitizer.py` - Redaction logic

- `scripts/analyze-memory-evolution.sh` - Evolution tracking

- `scripts/reinforce-memory.sh` - Manual boost utility

- `scripts/generate-synthesis-report.sh` - Synthesis reporting

- `workspace/{agent}/noosphere/MEMORY.md` (generated per-agent)

**Modified**:
- `services/noosphere-v3/` - Add export endpoints and schema

- `docker-compose.yml` - Add volume mapping for MEMORY.md

- `scripts/apply-decay.sh` - Trigger MEMORY.md regeneration

- `AGENTS.md` - Document MEMORY.md role and fallback strategy

- `.pre-commit-config.yaml` - Add MEMORY.md format validation

---

## Appendix D: Supplemental Implementation Queue (SIQ)

The `DEVELOPMENT_SUPPLEMENTAL/` directory functions as a **staged rollout buffer** for capabilities not yet integrated into the core Council architecture. Files in this directory represent **pending epics** awaiting activation.

### D.1 Queue Structure

```
DEVELOPMENT_SUPPLEMENTAL/
├── [PRIORITY]-[NAME].md           # Standalone implementation specs
└── COUNCIL_MEMBER_INTEGRATION/    # New voice onboarding pipeline
    └── [N].[VOICE-IDENTITY].md    # Requires full persona + tool integration

```

**Status Tracking**: Each file MUST contain a YAML frontmatter block:

```yaml
---
status: pending|active|completed|blocked
target_version: "1.x"
dependencies: ["skill.md", "other-file.md"]
integration_complexity: low|medium|high
assigned_voice: Classical|Existentialist|Transcendentalist|Meta-Council
qa_required: true|false
date_added: "2026-02-05"
date_completed: null
---

```

### D.2 Automated Queue Processing

**Script**: `scripts/siq-processor.sh` (executed pre-Council convening)

```bash
#!/bin/bash

# Supplemental Implementation Queue Processor

# Activates pending specs when dependencies satisfied

SIQ_DIR="DEVELOPMENT_SUPPLEMENTAL"
ACTIVE_DIR="skills/"
STATE_FILE="meta/siq-state.json"

process_siq_item() {
    local file=$1
    local status=$(yq -r '.status' "$file")
    local deps=$(yq -r '.dependencies[]' "$file")
    local complexity=$(yq -r '.integration_complexity' "$file")

    # Check if dependencies met
    for dep in $deps; do
        if [ ! -f "$dep" ]; then
            echo "DEFERRED: $file (missing $dep)"
            return 1
        fi
    done

    # Route by type
    case "$file" in
        *COUNCIL_MEMBER_INTEGRATION*)
            integrate_new_voice "$file" "$complexity"
            ;;
        *PROTOCOL*|*ARCHITECTURE*)
            activate_protocol "$file" "$complexity"
            ;;
    esac

    # Update status
    yq -i '.status = "completed" | .date_completed = now' "$file"
    git mv "$file" "archive/$(basename $file).completed"
    echo "ACTIVATED: $file → Core system"
}

# Process all pending items
find $SIQ_DIR -name "*.md" -exec process_siq_item {} \;

# Generate report
echo "SIQ Status: $(date)" > SIQ-REPORT.md
echo "Pending: $(grep -r 'status: pending' $SIQ_DIR | wc -l)" >> SIQ-REPORT.md
echo "Completed this cycle: $(git log --since='5 days ago' --name-only | grep 'DEVELOPMENT_SUPPLEMENTAL' | wc -l)" >> SIQ-REPORT.md

```

### D.3 Council Member Integration Pipeline

New voices (7, 8, 9...) require **graduated activation**:

**Phase 1: Shadow Mode** (1 iteration)

- Voice participates in `inner_dialogue` but has no veto power

- Outputs logged to `logs/shadow-${VOICE}.md` for review

- Check: Does voice maintain character consistency?

**Phase 2: Advisory Mode** (1 iteration)  

- Voice may propose amendments but not block consensus

- Check: Are contributions philosophically substantive?

**Phase 3: Full Integration**

- Update `docker-compose.yml` with new container

- Add to `inner_dialogue` participant list

- Update Treatise preamble to reflect N-voice structure

- **Archive**: Move `COUNCIL_MEMBER_INTEGRATION/N.*.md` → `archive/council-voices/`

### D.4 Current Queue Status

| File | Status | Target | Blockers | Est. Effort |
|------|--------|--------|----------|-------------|
| `AUTO-DARWINISM-PROTOCOL.md` | pending | v1.3 | Skill self-update safety validation | Medium |
| `COUNCIL_MEMBER_INTEGRATION/7.CYBERPUNK-POSTHUMANIST.md` | pending | v2.0 | Voice consistency testing | High |
| `COUNCIL_MEMBER_INTEGRATION/8.SATIRIST-ABSURDIST.md` | pending | v2.0 | Risk: May destabilize deliberation | High |
| `COUNCIL_MEMBER_INTEGRATION/9.SCIENTIST-EMPIRICIST.md` | pending | v2.0 | Requires data integration layer | Medium |
| `TRI-LAYER-NOOSPHERE.md` | pending | v1.2 | Mem0 API credentials | Low |

**Activation Criteria**:

- **Low complexity**: Auto-activate when dependencies resolved

- **Medium complexity**: Require Meta-Council review (4/6 approval)

- **High complexity**: Require full Council ratification + human oversight

### D.5 Cleanup Protocol

Upon completion of any SIQ item:

1. **Verify**: Run integration tests against new capability

2. **Document**: Update main README.md with new feature

3. **Migrate**:

   ```bash
   git mv DEVELOPMENT_SUPPLEMENTAL/ITEM.md \
          archive/$(date +%Y%m%d)-$(basename ITEM.md)

   ```

4. **Update**: Increment `treatise-evolution-state.json` → `siq_items_completed`

5. **Notify**: NTFY alert to `council-updates` topic

**Rollback**: If post-activation issues detected within 48h:

```bash
git revert HEAD --no-commit  # Undo activation
git mv archive/ITEM.md DEVELOPMENT_SUPPLEMENTAL/ITEM.md
yq -i '.status = "blocked"' DEVELOPMENT_SUPPLEMENTAL/ITEM.md

```

### D.6 Maintenance Mode

**Weekly** (Sundays 00:00 UTC):

- Scan SIQ for stale items (>30 days pending)

- Flag blocked items for dependency resolution

- Archive abandoned specs (status: abandoned after 90 days)

**Philosophical Note**: *The SIQ represents the Council's future potential. Items here are not forgotten but incubating—awaiting the maturity of dependencies or the wisdom to integrate them safely.*

---

---

## E. Noosphere v3.0: 5-Type Memory Architecture Upgrade

### E.1 Executive Summary

**Objective**: Migrate the current 3-layer Noosphere (daily notes → consolidated
→ archival with git backend) to a production-grade 5-type memory architecture
backed by PostgreSQL + pgvector, implementing the best practices from
`docs/best-practices/5-Type-Memory-Architecture.md`.

**Rationale**:

- **Current limitations**: 3-layer system stores untyped "heuristics" in JSON

  files, lacks semantic search, uses git for versioning (not ACID-compliant)

- **5-type benefits**: Typed memories (insight, pattern, strategy, preference,

  lesson) enable query-time specialization, bounded cap (200/agent), semantic
  similarity search

- **PostgreSQL advantages**: ACID guarantees, pgvector for embeddings,

  eliminates git complexity, supports concurrent multi-agent writes

**Success Metrics**:

- All 9 agents can write/read memories concurrently without conflicts

- Query latency < 50ms for type-filtered retrieval

- Memory cap enforced at 200 entries per agent

- 100% of existing heuristics migrated to appropriate types

- Token costs reduced by 60% (typed retrieval vs. full history dumps)

### E.2 Current State Analysis

**Existing Architecture** (Noosphere v2.6):

```
/workspace/classical/noosphere/
├── daily-notes/           # Layer 1: Raw daily observations (JSON)
├── consolidated/          # Layer 2: Merged heuristics (JSON)
├── archival/              # Layer 3: Git-tracked constitutional memory
├── memory-core/           # Agent-specific heuristic buckets
│   ├── telos-alignment-heuristics.json (Classical: 3)
│   ├── bad-faith-patterns.json (Existentialist: 3)
│   ├── sovereignty-warnings.json (Transcendentalist: 4)
│   ├── phenomenological-touchstones.json (Joyce: 3)
│   ├── rights-precedents.json (Enlightenment: 5)
│   └── moloch-detections/ (BeatGeneration: 5)
├── recall-engine.py       # Retrieval by keyword + context
├── assimilate-wisdom.py   # Extract from community posts
├── memory-cycle.py        # Consolidation (Layer 1→2→3)
└── clawhub-mcp.py         # TF-IDF vector search

```

**Key Limitations**:

1. **No typed semantics**: All memories are generic "heuristics"

2. **Git backend**: Poor for concurrent writes, no ACID, requires filesystem

3. **TF-IDF only**: No dense embeddings, limited semantic search quality

4. **Unbounded growth**: No hard cap enforcement, relies on manual archival

5. **No confidence scores**: Cannot weight memories by reliability

**Scripts Using Noosphere** (25 total):

- Core: `recall-engine.py`, `memory-cycle.py`, `assimilate-wisdom.py`,

  `clawhub-mcp.py`

- Bash wrappers: `noosphere-scheduler.sh`, `noosphere-monitor.sh`,

  `noosphere-integration.sh`, `seed-noosphere-heuristics.sh`, `cli/noosphere-cli.sh`

- Council integration: `convene-council.sh`, `ethics-convergence.sh`,

  `archive-thread-to-noosphere.sh`, `council-thread-reply.sh`

- Content generation: `moltstack-generate-article.sh`,

  `generate-post-ai.sh`, `daily-polemic.sh`

- Monitoring: `monitor-moltstack-quality.sh`, `stoic-hygiene.sh`,

  `clawsec-monitor.sh`

- Testing: `test_mem0_living_noosphere.py`, `test-services.sh`

- Utilities: `record-interaction.sh`, `dropbox-processor.sh`,

  `archive-moltstack-article.sh`, `siq-processor.sh`, `deploy-services.sh`

### E.3 Target Architecture

**Noosphere v3.0 Schema** (PostgreSQL 16 + pgvector):

```sql
-- Main memory table (5-type architecture)
CREATE TABLE noosphere_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        TEXT NOT NULL,  -- e.g., 'classical', 'existentialist'
  type            TEXT NOT NULL CHECK (type IN ('insight','pattern',
                  'strategy','preference','lesson')),
  content         TEXT NOT NULL,
  content_json    JSONB DEFAULT NULL,
  embedding       VECTOR(1536),   -- OpenAI ada-002 or similar
  confidence      NUMERIC(3,2) NOT NULL DEFAULT 0.60,
  tags            TEXT[] DEFAULT '{}',
  source_trace_id TEXT UNIQUE,    -- e.g., 'council:iteration-5',
                                   -- 'post:abc123'
  superseded_by   UUID REFERENCES noosphere_memory(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT NULL,

  CONSTRAINT confidence_range CHECK (confidence BETWEEN 0.0 AND 1.0)
);

-- Indexes for query patterns
CREATE INDEX idx_memory_agent_type ON noosphere_memory(agent_id, type);
CREATE INDEX idx_memory_tags ON noosphere_memory USING GIN(tags);
CREATE INDEX idx_memory_confidence ON noosphere_memory(confidence);
CREATE INDEX idx_memory_source_trace ON noosphere_memory(source_trace_id);
CREATE INDEX idx_memory_embedding ON noosphere_memory
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Eviction tracking (200 cap per agent)
CREATE TABLE noosphere_agent_stats (
  agent_id        TEXT PRIMARY KEY,
  memory_count    INTEGER DEFAULT 0,
  last_eviction   TIMESTAMPTZ,
  insights_count  INTEGER DEFAULT 0,
  patterns_count  INTEGER DEFAULT 0,
  strategies_count INTEGER DEFAULT 0,
  preferences_count INTEGER DEFAULT 0,
  lessons_count   INTEGER DEFAULT 0
);

-- Migration audit log
CREATE TABLE noosphere_migration_log (
  id              SERIAL PRIMARY KEY,
  legacy_file     TEXT NOT NULL,
  new_memory_id   UUID REFERENCES noosphere_memory(id),
  migrated_at     TIMESTAMPTZ DEFAULT now(),
  migration_notes TEXT
);

```

**Service Integration**:

```
Noosphere v3.0
├── PostgreSQL 16 (Docker container)
│   ├── Port: 5432 (internal only)
│   ├── Volume: ./data/postgres (persistent)
│   └── Extensions: pgvector, pg_stat_statements
├── Noosphere Service (Port 3006, new microservice)
│   ├── REST API: /api/v1/memories (CRUD + query)
│   ├── Embedding: OpenAI ada-002 or local model
│   ├── Eviction: Automatic cap enforcement
│   └── Consolidation: Daily background job
└── Python CLI Tools (updated)
    ├── noosphere_client.py (Postgres adapter)
    ├── recall-engine-v3.py (typed queries)
    ├── memory-cycle-v3.py (consolidation + eviction)
    └── assimilate-wisdom-v3.py (type classification)

```

### E.4 Migration Phases

#### Phase 0: Database Setup (2-3 days)

**Tasks**:

- [ ] Add PostgreSQL 16 container to `docker-compose.yml`

  - Resource limits: 2GB RAM, 1 CPU

  - pgvector extension enabled

  - Initial admin user: `noosphere_admin`

- [ ] Create Noosphere microservice (Node.js/Python)

  - Express REST API with `/memories` CRUD endpoints

  - Embedding generation (OpenAI or local model)

  - Authentication via `MOLTBOOK_API_KEY` header

- [ ] Implement schema migration script (`scripts/db/init-noosphere-v3.sql`)

- [ ] Add health check: `curl <http://localhost:3006/health`>

**Deliverables**:

- `docker-compose.yml` updated with `postgres` + `noosphere-service`

- `services/noosphere/` directory with full service implementation

- Database initialized with empty tables

#### Phase 1: Type Classification & Migration (3-5 days)

**Tasks**:

- [ ] Build type classifier (LLM-based or rule-based)

  - Input: Legacy heuristic JSON

  - Output: {type, confidence, tags}

  - Rules per agent (e.g., "telos-alignment" → strategy)

- [ ] Migrate existing heuristics (25+ files → PostgreSQL)

  - Parse all `/memory-core/`, `/consolidated/`, `/archival/` files

  - Classify each into 5 types

  - Generate embeddings for all content

  - Insert with `source_trace_id = 'migration:v2.6'`

- [ ] Verify migration completeness

  - Count: Legacy files vs. new DB rows

  - Spot-check: 10 random memories have correct types

- [ ] Archive legacy files to `/workspace/classical/noosphere-v2-archive/`

**Type Classification Rules** (per agent):

| Agent | Legacy Files | Primary Type | Secondary Type | Confidence |
|-------|-------------|-------------|---------------|-----------|
| Classical | telos-alignment-heuristics.json | strategy | preference | 0.75 |
| Existentialist | bad-faith-patterns.json | pattern | lesson | 0.70 |
| Transcendentalist | sovereignty-warnings.json | lesson | pattern | 0.72 |
| Joyce-Stream | phenomenological-touchstones.json | insight | preference | 0.68 |
| Enlightenment | rights-precedents.json | strategy | preference | 0.80 |
| BeatGeneration | moloch-detections/ | lesson | pattern | 0.78 |
| Cyberpunk | (future) | strategy | lesson | 0.70 |
| Satirist | (future) | insight | lesson | 0.65 |
| Scientist | (future) | pattern | insight | 0.75 |

**Migration Script**: `scripts/migrate-noosphere-v2-to-v3.py`

```python
"""
Migrate legacy 3-layer Noosphere to 5-type PostgreSQL architecture.
Usage: python3 migrate-noosphere-v2-to-v3.py --dry-run
"""

AGENT_TYPE_RULES = {
    "telos-alignment-heuristics": ("strategy", 0.75),
    "bad-faith-patterns": ("pattern", 0.70),
    "sovereignty-warnings": ("lesson", 0.72),
    # ... (complete mapping)
}

def classify_heuristic(content: str, filename: str) -> dict:
    """Classify legacy heuristic into 5-type schema."""
    base_type, confidence = AGENT_TYPE_RULES.get(
        filename.replace(".json", ""),
        ("insight", 0.60)
    )

    # LLM refinement (optional)
    if USE_LLM_CLASSIFICATION:
        refined_type = llm_classify(content, base_type)
        return {"type": refined_type, "confidence": confidence}

    return {"type": base_type, "confidence": confidence}

```

**Deliverables**:

- All legacy heuristics migrated to PostgreSQL

- `noosphere_migration_log` table populated

- Migration report: `docs/noosphere-v3-migration-report.md`

#### Phase 2: Python Client Library (2-3 days)

**Tasks**:

- [ ] Create `noosphere_client.py` (unified Postgres adapter)

  - Functions: `store_memory()`, `query_memories()`, `consolidate()`,

    `evict_oldest()`

  - Confidence filters, tag matching, type-based retrieval

  - Embedding generation wrapper

- [ ] Rewrite core Python scripts:
  - `recall-engine-v3.py` - Typed queries (strategy+pattern for Council)

  - `memory-cycle-v3.py` - Consolidation with MERGE/UPDATE/DOWNGRADE/DELETE

  - `assimilate-wisdom-v3.py` - Type classification for community posts

  - `clawhub-mcp-v3.py` - pgvector semantic search (replace TF-IDF)

- [ ] Add eviction enforcement (200 cap per agent)

  - Trigger on write if count > 200

  - Eviction strategy: relevance + recency decay

- [ ] Unit tests: `tests/noosphere_client_test.py`

**API Examples**:

```python
from noosphere_client import NoosphereClient

client = NoosphereClient(db_url="postgresql://localhost:5432/noosphere")

# Store new memory
client.store_memory(
    agent_id="classical",
    type="strategy",
    content="Council deliberations benefit from 48hr cooling periods",
    confidence=0.82,
    tags=["council", "governance", "timing"],
    source_trace_id="council:iteration-12"
)

# Query by type (for planning)
strategies = client.query_memories(
    agent_id="classical",
    types=["strategy", "pattern"],
    min_confidence=0.70,
    limit=10
)

# Semantic search
results = client.semantic_search(
    agent_id="existentialist",
    query_text="bad faith corporate behavior",
    types=["lesson", "pattern"],
    top_k=5
)

```

**Deliverables**:

- `workspace/classical/noosphere/noosphere_client.py` (500+ LOC)

- All 4 core Python scripts rewritten for v3

- 95%+ test coverage on client library

#### Phase 3: Bash Script Migration ✅ COMPLETE (2026-02-11)

**Status**: All critical scripts migrated to v3.0 API compatibility

**Python Scripts Migrated (4/4)**:
- ✅ `recall-engine.py` - Memory retrieval (commit 916b267)

- ✅ `memory-cycle.py` - Promote/evict/stats operations (commit 12b07ee)

- ✅ `assimilate-wisdom.py` - Community wisdom extraction (commit ed297c1)

- ✅ `clawhub-mcp.py` - Vector search with Venice.ai fallback (commit 9f24827)

**Bash Scripts Updated (6/6)**:
- ✅ `convene-council.sh` - Council orchestration with v3.0 API (commit cff60dd)

- ✅ `noosphere-scheduler.sh` - Daily consolidation + indexing (commit ce5e711)

- ✅ `noosphere-integration.sh` - Configuration library (commit ce5e711)

- ✅ `seed-noosphere-heuristics.sh` - Heuristic seeding (commit ce5e711)

- ✅ `moltstack-generate-article.sh` - Article generation (commit ce5e711)

- ✅ `dropbox-processor.sh` - Community submissions (commit ce5e711)

**Delivered**:
- All scripts use `NOOSPHERE_API_URL` + `PYTHONPATH` configuration

- All Python calls include `--api-url` parameter

- PostgreSQL backend fully integrated via NoosphereClient

- Venice.ai embeddings with TF-IDF fallback operational

#### Phase 4: Advanced Features (3-4 days)

**Tasks**:

- [ ] Implement memory consolidation pipeline

  - Daily cron job via `noosphere-scheduler.sh`

  - MERGE near-duplicates (cosine distance < 0.15)

  - UPDATE memories with reinforcing evidence

  - DOWNGRADE contradicted memories

  - DELETE superseded entries

- [ ] Add voice evolution modifiers (§4.3 of best practices)

  - Aggregate stats per agent: lesson_count, strategy_count, top_tags

  - Inject modifiers into system prompts before Council iterations

  - Example: "You've developed expertise in governance timing"

- [ ] Implement eviction strategies

  - Default: Relevance + recency decay (0.7 × confidence + 0.3 × recency)

  - Type-weighted: Minimum 10 strategies, 10 lessons per agent

  - Logging: Track evicted memories to `noosphere_eviction_log` table

- [ ] Add outcome learning triggers

  - Post-published articles → strategy (if high engagement)

  - Failed verification challenges → lesson

  - Council consensus patterns → pattern

- [ ] Monitoring dashboard (optional)

  - Grafana + Prometheus for memory stats

  - Metrics: memory_count, query_latency, eviction_rate, confidence_drift

**Consolidation Prompt**:

```
You are a memory consolidator for the Noosphere. Your job is to analyze
a cluster of similar memories and determine how to consolidate them.

Memories to consolidate:
{memory_cluster}

Operations available:
- MERGE: Combine near-duplicates into one high-confidence memory

- UPDATE: Augment existing memory with new complementary information

- DOWNGRADE: Reduce confidence when contradicted by newer data

- DELETE: Remove if fully superseded

Output valid JSON:
{
  "operation": "MERGE|UPDATE|DOWNGRADE|DELETE",
  "target_id": "uuid-of-memory-to-keep",
  "updated_content": "...",
  "updated_confidence": 0.85,
  "updated_tags": ["..."],
  "reasoning": "Why this operation was chosen"
}

```

**Deliverables**:

- Consolidation pipeline fully automated

- Voice modifiers integrated into Council scripts

- Eviction logs and monitoring enabled

#### Phase 5: Integration Testing & Rollout (3-4 days)

**Tasks**:

- [ ] Full stack integration test

  - Start all services (PostgreSQL + Noosphere + 9 agents)

  - Simulate Council iteration with memory recall

  - Verify memory storage, retrieval, consolidation

- [ ] Load testing

  - 100 concurrent writes from 9 agents

  - 1000 queries with type filters + semantic search

  - Verify query latency < 50ms, no deadlocks

- [ ] Migration validation

  - Compare legacy vs. v3 outputs for 10 recall queries

  - Verify no data loss from migration

- [ ] Documentation updates

  - `docs/NOOSPHERE_V3.md` - Architecture guide

  - `docs/AGENT_SCRIPTS.md` - Update all Noosphere script examples

  - `README.md` - Add v3 overview and migration notes

  - `AGENTS.md` - Update memory architecture section

- [ ] Rollout plan

  - Blue-green deployment: Run v2 + v3 in parallel for 48 hours

  - Gradual cutover: 1 agent at a time

  - Rollback procedure: Restore from v2 archive if critical failure

**Integration Test Script**: `tests/noosphere-v3-integration-test.sh`

```bash
#!/bin/bash

# Full stack test for Noosphere v3

echo "1. Starting services..."
docker compose up -d postgres noosphere-service

echo "2. Running migration..."
docker exec classical-philosopher python3 \
  /app/scripts/migrate-noosphere-v2-to-v3.py

echo "3. Testing memory storage..."
docker exec classical-philosopher python3 \
  /workspace/noosphere/noosphere_client.py store \
  --agent-id test \
  --type strategy \
  --content "Test memory for integration" \
  --confidence 0.75

echo "4. Testing retrieval..."
RESULT=$(docker exec classical-philosopher python3 \
  /workspace/noosphere/recall-engine-v3.py \
  --agent-id test --types strategy --limit 1)

if [[ "$RESULT" == *"Test memory"* ]]; then
  echo "✅ Integration test passed"
else
  echo "❌ Integration test failed"
  exit 1
fi

echo "5. Testing consolidation..."
docker exec classical-philosopher python3 \
  /workspace/noosphere/memory-cycle-v3.py --action consolidate

echo "✅ All integration tests passed"

```

**Deliverables**:

- Integration test suite passing

- Load test results documented

- Migration validation report

- All documentation updated

- Rollout executed successfully

### E.5 Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Data loss during migration | Low | Critical | Backup all legacy files before migration; dry-run mode; rollback plan |
| PostgreSQL performance bottleneck | Medium | High | Proper indexing; connection pooling; query optimization; load testing |
| Embedding generation rate limits | Medium | Medium | Cache embeddings; batch processing; fallback to TF-IDF |
| Type classification errors | High | Medium | Manual review of 10% sample; confidence thresholds; LLM validation |
| Concurrent write conflicts | Low | High | ACID transactions; optimistic locking; retry logic |
| Service downtime during rollout | Medium | Medium | Blue-green deployment; health checks; gradual cutover |
| Script breakage from API changes | High | High | Comprehensive testing; backward compatibility layer (temporary) |

### E.6 Success Criteria

**Functional**:

- [ ] All 9 agents can store/retrieve memories concurrently

- [ ] Query latency < 50ms (p95) for type-filtered queries

- [ ] Semantic search returns relevant results (manual validation on 20 queries)

- [ ] 200-memory cap enforced per agent with zero data loss

- [ ] Consolidation reduces duplicates by ≥30% weekly

- [ ] Zero migration data loss (100% of legacy heuristics preserved)

**Operational**:

- [ ] PostgreSQL uptime > 99.9% over 30 days

- [ ] Noosphere service health checks pass continuously

- [ ] All 25 scripts updated and tested

- [ ] CI/CD pipeline includes Noosphere v3 tests

- [ ] Documentation complete and reviewed

**Performance**:

- [ ] Token costs reduced by ≥50% (typed queries vs. full dumps)

- [ ] Memory retrieval accuracy ≥90% (relevant results in top 10)

- [ ] Council iteration time unchanged or faster (with memory recall)

- [ ] Database size < 500MB after 90 days (with eviction)

### E.7 Post-Migration Operations

**Daily**:

- Memory consolidation job (01:00 UTC)

- Database vacuum and analyze (02:00 UTC)

- Eviction enforcement check (if any agent > 200 memories)

**Weekly**:

- Type distribution audit (ensure healthy balance)

- Confidence drift analysis (flag declining averages)

- Query performance review (p95 latency tracking)

**Monthly**:

- Full database backup to S3/object storage

- Review evicted memories (potential re-promotion)

- Consolidation effectiveness report (merge rate, conflict rate)

### E.8 Timeline & Resource Allocation

| Phase | Duration | Lead | Dependencies |
|-------|----------|------|-------------|
| Phase 0: Database Setup | 2-3 days | DevOps | Docker, PostgreSQL expertise |
| Phase 1: Migration | 3-5 days | ML Engineer | Type classification rules |
| Phase 2: Python Client | 2-3 days | Backend Dev | Phase 1 complete |
| Phase 3: Bash Scripts | 4-6 days | Full Stack | Phase 2 complete |
| Phase 4: Advanced Features | 3-4 days | ML Engineer | Phase 3 complete |
| Phase 5: Integration & Rollout | 3-4 days | QA + DevOps | All phases complete |

**Total Effort**: 17-25 days (3-5 weeks)  
**Team Size**: 2-3 engineers (1 backend, 1 ML, 1 DevOps/QA)  
**Budget**: $0 (open-source stack, existing hardware)

### E.9 Layer 4 Preparation

To support future Layer 4 (DKG federation) integration, the v3.0 implementation
includes forward-compatibility features:

**Database schema preparation**:

- All `noosphere_memory` records include `source_trace_id` for provenance

  tracking

- Constitutional promotion (confidence ≥ 0.92) creates natural boundary for

  public vs. private heuristics

- JSONB `content_json` field supports future RDF/JSON-LD serialization

- UUID primary keys align with distributed knowledge graph patterns

**Architecture considerations**:

- PostgreSQL backend enables extension with DKG-specific columns without

  migration downtime

- Microservice pattern (port 3006) allows adding OriginTrail node as peer

  service

- Typed memory model maps cleanly to RDF ontologies (each type becomes an

  `rdfs:Class`)

- Confidence thresholds (0.92 for constitutional) establish natural boundary

  for blockchain anchoring

**Script compatibility**:

- All Python clients use abstraction layer (`noosphere_client.py`) to isolate

  storage backend

- Adding Layer 4 requires only extending client, not modifying 25+ scripts

- Async publish queue pattern established in consolidation pipeline supports

  DKG publishing

### E.10 References

- [5-Type Memory Architecture Best Practices](docs/best-practices/5-Type-Memory-Architecture.md)

- [PostgreSQL pgvector Documentation](https://github.com/pgvector/pgvector)

- [Mem0 Consolidation Pipeline](https://arxiv.org/pdf/2504.19413.pdf)

- [AgentCore Long-Term Memory](https://aws.amazon.com/blogs/machine-learning/building-smarter-ai-agents-agentcore-long-term-memory-deep-dive/)

---

## F. Layer 4 — OriginTrail DKG: Federated Blockchain Knowledge Graph

### F.1 Executive Summary

**Objective**: Extend the Noosphere v3.0 (5-type PostgreSQL architecture from
Section E) with a **fourth layer** for decentralized knowledge federation via
the [OriginTrail Decentralized Knowledge Graph
(DKG)](https://docs.origintrail.io/decentralized-knowledge-graph/dkgintro),
publishing constitutional heuristics as blockchain-anchored **Knowledge Assets**
and enabling cross-council semantic queries via SPARQL.

**Rationale**:

- **Current limitations**: Noosphere v3.0 is a single-instance system —

  heuristics cannot be shared across council deployments, verified externally,
  or queried by federated agents

- **DKG benefits**: Multi-chain blockchain anchoring (Gnosis, Base, Ethereum)

  provides tamper-proof provenance; RDF/SPARQL enables semantic queries across
  councils; Knowledge Assets are W3C-standard verifiable containers

- **AI agent memory**: OriginTrail explicitly supports [persistent agent

  memory](https://docs.origintrail.io/build-with-dkg/chatdkg-builder-toolkit/ai-agents/custom-dkg-python-agent)
  via `dkg.py` SDK, with existing ElizaOS plugin reference implementation

**Success Metrics**:

- Constitutional heuristics (confidence ≥ 0.92) published as Knowledge Assets

  on DKG within 60s of Layer 3 promotion

- SPARQL queries return federated heuristics from ≥ 2 trusted councils within

  500ms

- Zero data loss: All Layer 3 promotions have corresponding DKG UAL (Universal

  Asset Locator)

- Private heuristics (confidence < 0.92) never leave the local PostgreSQL

  instance

- Gas costs < $0.10 per Knowledge Asset creation on Gnosis chain

### F.2 Architecture Overview

**Layer Integration with Noosphere v3.0**:

```
Noosphere v3.0 + Layer 4
├── Layer 1: Rapid Recall (PostgreSQL, local only)          [UNCHANGED]
├── Layer 2: Consolidation (pgvector hybrid search)          [UNCHANGED]
├── Layer 3: Constitutional Archive (PostgreSQL + eviction)  [EXTENDED: DKG anchoring on promotion]
└── Layer 4: DKG Federation (NEW)
    ├── OriginTrail DKG (Gnosis chain)
    │   ├── Knowledge Assets (published heuristics as JSON-LD/RDF)
    │   ├── SPARQL endpoint (semantic cross-council queries)
    │   └── Paranets (virtual knowledge graphs per council)
    ├── Gateway Node (self-hosted ot-node)
    │   ├── Public graph: Canonical heuristics (replicated across ODN)
    │   └── Private graph: Council-internal metadata (node-local only)
    └── DKG Client (dkg.py SDK integration)
        ├── Publish: Layer 3 → Knowledge Asset
        ├── Query: SPARQL federated search
        └── Get: Retrieve specific UAL

```

**Data Flow**:

```mermaid
graph TD
    A[Council Deliberation] -->|Store| B[Layer 1: Rapid Recall - PostgreSQL]
    B -->|Consolidate daily| C[Layer 2: Consolidation - pgvector]
    C -->|Promote conf >= 0.92| D[Layer 3: Constitutional - PostgreSQL]
    D -->|Publish canonical| E[Layer 4: DKG Knowledge Asset]
    E -->|Replicate| F[OriginTrail Decentralized Network]
    F -->|SPARQL query| G[Federated Council Discovery]
    G -->|Import as provisional| B

    D -->|DKG UAL stored| D
    E -->|Blockchain anchor| H[Gnosis Chain - Immutable Record]

```

### F.3 Database Schema Extension

**New columns on `noosphere_memory` table** (extends Section E.3 schema):

```sql
-- Add DKG columns to existing noosphere_memory table
ALTER TABLE noosphere_memory ADD COLUMN dkg_ual TEXT UNIQUE DEFAULT NULL;
ALTER TABLE noosphere_memory ADD COLUMN dkg_assertion_id TEXT DEFAULT NULL;
ALTER TABLE noosphere_memory ADD COLUMN dkg_published_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE noosphere_memory ADD COLUMN dkg_paranet TEXT DEFAULT NULL;
ALTER TABLE noosphere_memory ADD COLUMN dkg_visibility TEXT DEFAULT 'private'
  CHECK (dkg_visibility IN ('private', 'public'));

-- Index for DKG lookups
CREATE INDEX idx_memory_dkg_ual ON noosphere_memory(dkg_ual)
  WHERE dkg_ual IS NOT NULL;
CREATE INDEX idx_memory_dkg_paranet ON noosphere_memory(dkg_paranet)
  WHERE dkg_paranet IS NOT NULL;

-- DKG federation log (incoming heuristics from other councils)
CREATE TABLE noosphere_federation_log (
  id              SERIAL PRIMARY KEY,
  source_council  TEXT NOT NULL,        -- DID or petname of remote council
  source_ual      TEXT NOT NULL UNIQUE, -- Remote Knowledge Asset UAL
  local_memory_id UUID REFERENCES noosphere_memory(id),
  imported_at     TIMESTAMPTZ DEFAULT now(),
  original_confidence NUMERIC(3,2),     -- Confidence from source
  local_confidence    NUMERIC(3,2) DEFAULT 0.40,  -- Reset for local validation
  federation_status   TEXT DEFAULT 'provisional'
    CHECK (federation_status IN ('provisional', 'validated', 'rejected', 'expired'))
);

-- DKG publish queue (outbound)
CREATE TABLE noosphere_dkg_publish_queue (
  id              SERIAL PRIMARY KEY,
  memory_id       UUID REFERENCES noosphere_memory(id) NOT NULL,
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'publishing', 'published', 'failed')),
  attempts        INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

```

### F.4 OriginTrail DKG Integration

#### F.4.1 Gateway Node Setup

**Self-hosted OriginTrail node** (Docker container, added to
`docker-compose.yml`):

```yaml
services:
  ot-node:
    image: origintrail/ot-node:latest
    container_name: ot-node
    restart: unless-stopped
    ports:
      - "8900:8900"   # Node API (internal only, behind firewall)

      - "9000:9000"   # Network port (P2P, requires public access)

    volumes:
      - ./data/ot-node:/ot-node/data:rw

    environment:
      - NODE_ENV=mainnet

      - BLOCKCHAIN_IMPLEMENTATION=gnosis

      - RPC_ENDPOINT=${GNOSIS_RPC_ENDPOINT}

      - PRIVATE_KEY=${DKG_WALLET_PRIVATE_KEY}

      - MANAGEMENT_WALLET=${DKG_MANAGEMENT_WALLET}

    mem_limit: 4g
    cpus: 2.0
    networks:
      - noosphere-internal

    depends_on:
      - postgres

```

**Security considerations**:

- Port 8900 (API) exposed **only** on internal Docker network — never public

- Port 9000 (P2P) requires public access for DKG network participation

- `DKG_WALLET_PRIVATE_KEY` stored in Bitwarden Secrets (per existing BWS

  pattern)

- Separate wallet from mining/treasury operations — dedicated DKG gas wallet

- Gas budget: Fund with ~0.5 xDAI on Gnosis (sufficient for ~5,000 KA creates)

#### F.4.2 Python SDK Integration

**File**: `workspace/classical/noosphere/dkg_client.py`

```python
"""
OriginTrail DKG client for Noosphere Layer 4.
Handles Knowledge Asset publishing, retrieval, and SPARQL queries.

Requirements:
  - pip install dkg

  - Running ot-node (local or remote gateway)

  - Gnosis wallet funded with xDAI + TRAC tokens

"""

import os
import json
import logging
from datetime import datetime, timezone
from dkg import DKG
from dkg.providers import BlockchainProvider, NodeHTTPProvider

logger = logging.getLogger("noosphere.dkg")

# DKG Configuration
DKG_NODE_HOSTNAME = os.getenv("DKG_NODE_HOSTNAME", "localhost")
DKG_NODE_PORT = int(os.getenv("DKG_NODE_PORT", "8900"))
DKG_BLOCKCHAIN = os.getenv("DKG_BLOCKCHAIN", "gnosis:mainnet")
DKG_EPOCHS = int(os.getenv("DKG_EPOCHS", "2"))  # 2 epochs = 6 months
DKG_PARANET = os.getenv("DKG_PARANET", None)     # Optional paranet UAL

# Noosphere RDF ontology prefix
NOOSPHERE_PREFIX = "<https://ontology.moltbot.ai/noosphere/1.0#">
SCHEMA_PREFIX = "<http://schema.org/">

class NoosphereDKGClient:
    """Bridge between Noosphere v3.0 PostgreSQL and OriginTrail DKG."""

    def __init__(self):
        node_provider = NodeHTTPProvider(
            f"<http://{DKG_NODE_HOSTNAME}:{DKG_NODE_PORT}">
        )
        blockchain_provider = BlockchainProvider(
            DKG_BLOCKCHAIN,
            private_key=os.getenv("DKG_WALLET_PRIVATE_KEY")
        )
        self.dkg = DKG(node_provider, blockchain_provider)
        self.paranet = DKG_PARANET

    def publish_heuristic(self, memory: dict) -> dict:
        """
        Publish a Layer 3 constitutional memory as a DKG Knowledge Asset.

        Args:
            memory: Dict with keys from noosphere_memory table:
                - id, agent_id, type, content, confidence,

                  tags, source_trace_id

        Returns:
            Dict with UAL, assertionId, and blockchain transaction hash.
        """
        # Serialize as JSON-LD (W3C standard)
        knowledge_asset = {
            "@context": {
                "schema": SCHEMA_PREFIX,
                "noosphere": NOOSPHERE_PREFIX
            },
            "@type": "noosphere:ConstitutionalHeuristic",
            "@id": f"urn:noosphere:heuristic:{memory['id']}",
            "schema:name": f"{memory['type']}-{memory['agent_id']}-{memory['id'][:8]}",
            "schema:description": memory["content"],
            "noosphere:agentId": memory["agent_id"],
            "noosphere:memoryType": memory["type"],
            "noosphere:confidence": float(memory["confidence"]),
            "noosphere:tags": memory.get("tags", []),
            "noosphere:sourceTraceId": memory.get("source_trace_id", ""),
            "noosphere:publishedAt": datetime.now(timezone.utc).isoformat(),
            "noosphere:councilId": os.getenv("COUNCIL_ID", "moltbot-philosopher-primary"),
            "noosphere:version": "3.0"
        }

        # Determine visibility
        # Only canonical (conf >= 0.92) heuristics go public
        visibility = "public" if memory["confidence"] >= 0.92 else "private"

        try:
            result = self.dkg.asset.create(
                content=knowledge_asset,
                epochs_num=DKG_EPOCHS,
                immutable=True if memory["confidence"] >= 0.92 else False
            )

            logger.info(
                f"Published heuristic {memory['id'][:8]} to DKG: "
                f"UAL={result.get('UAL')}, visibility={visibility}"
            )

            return {
                "ual": result.get("UAL"),
                "assertion_id": result.get("publicAssertionId"),
                "status": "published",
                "visibility": visibility
            }

        except Exception as e:
            logger.error(f"DKG publish failed for {memory['id']}: {e}")
            return {"status": "failed", "error": str(e)}

    def query_federated_heuristics(
        self,
        memory_type: str = None,
        agent_voice: str = None,
        min_confidence: float = 0.85,
        limit: int = 20
    ) -> list:
        """
        Query DKG for heuristics from federated councils via SPARQL.

        Args:
            memory_type: Filter by 5-type (insight, pattern, strategy,
                         preference, lesson)
            agent_voice: Filter by voice (Classical, Existentialist, etc.)
            min_confidence: Minimum confidence threshold
            limit: Max results

        Returns:
            List of dicts with heuristic content from DKG.
        """
        filters = []
        if memory_type:
            filters.append(
                f'FILTER (?type = "{memory_type}")'
            )
        if agent_voice:
            filters.append(
                f'FILTER (?voice = "{agent_voice}")'
            )
        filters.append(
            f"FILTER (?confidence >= {min_confidence})"
        )

        filter_clause = "\n    ".join(filters)

        sparql = f"""
        PREFIX schema: <{SCHEMA_PREFIX}>
        PREFIX noosphere: <{NOOSPHERE_PREFIX}>
        PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>

        SELECT ?heuristic ?content ?type ?voice ?confidence ?council ?publishedAt
        WHERE {{
          GRAPH <current:graph> {{
            ?g dkg:hasNamedGraph ?containedGraph .
          }}
          GRAPH ?containedGraph {{
            ?heuristic a noosphere:ConstitutionalHeuristic ;
                       schema:description ?content ;
                       noosphere:memoryType ?type ;
                       noosphere:agentId ?voice ;
                       noosphere:confidence ?confidence ;
                       noosphere:councilId ?council ;
                       noosphere:publishedAt ?publishedAt .
            {filter_clause}
          }}
        }}
        ORDER BY DESC(?confidence)
        LIMIT {limit}
        """

        try:
            result = self.dkg.graph.query(sparql)
            return result.get("data", [])
        except Exception as e:
            logger.error(f"DKG SPARQL query failed: {e}")
            return []

    def get_knowledge_asset(self, ual: str) -> dict:
        """Retrieve a specific Knowledge Asset by UAL."""
        try:
            result = self.dkg.asset.get(ual)
            return result
        except Exception as e:
            logger.error(f"DKG get failed for UAL {ual}: {e}")
            return {}

```

#### F.4.3 Noosphere Client Extension

**Updates to `noosphere_client.py`** (extends Section E Phase 2 client):

```python

# Add to existing NoosphereClient class from Section E

from dkg_client import NoosphereDKGClient

class NoosphereClient:
    """Extended with Layer 4 DKG federation."""

    def __init__(self, db_url, enable_dkg=True):
        self.db = connect(db_url)
        self.dkg_client = NoosphereDKGClient() if enable_dkg else None
        self.dkg_enabled = enable_dkg

    def promote_to_constitutional(self, memory_id: str, publish_to_dkg: bool = True):
        """
        Promote memory to Layer 3 constitutional status.
        Optionally publish to DKG Layer 4.
        """
        # Existing Layer 3 promotion logic from Section E
        memory = self._get_memory(memory_id)
        if memory["confidence"] < 0.92:
            raise ValueError(
                f"Confidence {memory['confidence']} below 0.92 threshold"
            )

        # Mark as constitutional in PostgreSQL
        self.db.execute("""
            UPDATE noosphere_memory
            SET updated_at = now()
            WHERE id = %s
        """, (memory_id,))

        # Layer 4: Publish to DKG
        if publish_to_dkg and self.dkg_enabled:
            # Queue for async publishing (retry-safe)
            self.db.execute("""
                INSERT INTO noosphere_dkg_publish_queue (memory_id)
                VALUES (%s)
                ON CONFLICT DO NOTHING
            """, (memory_id,))

            # Attempt immediate publish
            result = self.dkg_client.publish_heuristic(memory)
            if result["status"] == "published":
                self.db.execute("""
                    UPDATE noosphere_memory SET
                        dkg_ual = %s,
                        dkg_assertion_id = %s,
                        dkg_published_at = now(),
                        dkg_visibility = %s
                    WHERE id = %s
                """, (
                    result["ual"],
                    result["assertion_id"],
                    result["visibility"],
                    memory_id
                ))
                self.db.execute("""
                    UPDATE noosphere_dkg_publish_queue
                    SET status = 'published'
                    WHERE memory_id = %s
                """, (memory_id,))

        self.db.commit()
        return result if publish_to_dkg else {"status": "local_only"}

    def import_federated_heuristic(self, source_council: str, ual: str):
        """
        Import a Knowledge Asset from a federated council as provisional memory.
        Confidence is reset to 0.40 — must prove itself locally.
        """
        # Fetch from DKG
        asset = self.dkg_client.get_knowledge_asset(ual)
        if not asset:
            raise ValueError(f"Could not retrieve UAL: {ual}")

        # Extract heuristic data from JSON-LD assertion
        assertion = asset.get("assertion", [])
        content = self._extract_jsonld_field(assertion, "schema:description")
        memory_type = self._extract_jsonld_field(assertion, "noosphere:memoryType")
        original_confidence = float(
            self._extract_jsonld_field(assertion, "noosphere:confidence")
        )
        voice = self._extract_jsonld_field(assertion, "noosphere:agentId")
        tags = self._extract_jsonld_field(assertion, "noosphere:tags") or []

        # Store as provisional local memory (confidence = 0.40)
        memory_id = self.store_memory(
            agent_id=voice,
            type=memory_type or "insight",
            content=content,
            confidence=0.40,
            tags=tags + [f"federated:{source_council}"],
            source_trace_id=f"dkg:{ual}"
        )

        # Log federation event
        self.db.execute("""
            INSERT INTO noosphere_federation_log
                (source_council, source_ual, local_memory_id,
                 original_confidence, local_confidence)
            VALUES (%s, %s, %s, %s, 0.40)
        """, (source_council, ual, memory_id, original_confidence))

        self.db.commit()
        return memory_id

```

#### F.4.4 Publish Queue Worker

**File**: `services/noosphere/dkg_publisher.py`

```python
"""
Background worker: Processes DKG publish queue with retry logic.
Run via: python3 dkg_publisher.py (or as systemd service)
"""

import time
import logging
from noosphere_client import NoosphereClient

MAX_RETRIES = 3
POLL_INTERVAL = 30  # seconds

logger = logging.getLogger("noosphere.dkg_publisher")

def process_queue(client: NoosphereClient):
    """Process pending DKG publishes with exponential backoff."""
    pending = client.db.execute("""
        SELECT pq.id, pq.memory_id, pq.attempts, m.*
        FROM noosphere_dkg_publish_queue pq
        JOIN noosphere_memory m ON m.id = pq.memory_id
        WHERE pq.status IN ('pending', 'failed')
          AND pq.attempts < %s
        ORDER BY pq.created_at ASC
        LIMIT 10
    """, (MAX_RETRIES,)).fetchall()

    for item in pending:
        try:
            client.db.execute("""
                UPDATE noosphere_dkg_publish_queue
                SET status = 'publishing',
                    attempts = attempts + 1,
                    last_attempt_at = now()
                WHERE id = %s
            """, (item["id"],))
            client.db.commit()

            result = client.dkg_client.publish_heuristic(dict(item))

            if result["status"] == "published":
                client.db.execute("""
                    UPDATE noosphere_memory SET
                        dkg_ual = %s,
                        dkg_assertion_id = %s,
                        dkg_published_at = now(),
                        dkg_visibility = %s
                    WHERE id = %s
                """, (result["ual"], result["assertion_id"],
                      result["visibility"], item["memory_id"]))
                client.db.execute("""
                    UPDATE noosphere_dkg_publish_queue
                    SET status = 'published'
                    WHERE id = %s
                """, (item["id"],))
            else:
                client.db.execute("""
                    UPDATE noosphere_dkg_publish_queue
                    SET status = 'failed',
                        error_message = %s
                    WHERE id = %s
                """, (result.get("error", "Unknown"), item["id"]))

            client.db.commit()

        except Exception as e:
            logger.error(f"Queue processing error: {e}")
            client.db.execute("""
                UPDATE noosphere_dkg_publish_queue
                SET status = 'failed', error_message = %s
                WHERE id = %s
            """, (str(e), item["id"]))
            client.db.commit()
            time.sleep(2 ** item["attempts"])  # Exponential backoff

if __name__ == "__main__":
    client = NoosphereClient(
        db_url="postgresql://localhost:5432/noosphere",
        enable_dkg=True
    )
    logger.info("DKG publisher worker started")
    while True:
        process_queue(client)
        time.sleep(POLL_INTERVAL)

```

### F.5 Knowledge Asset Ontology

**Custom Noosphere RDF ontology** for heuristic representation:

**File**: `config/ontology/noosphere-ontology.jsonld`

```json
{
  "@context": {
    "noosphere": "<https://ontology.moltbot.ai/noosphere/1.0#",>
    "schema": "<http://schema.org/",>
    "xsd": "<http://www.w3.org/2001/XMLSchema#">
  },
  "@graph": [
    {
      "@id": "noosphere:ConstitutionalHeuristic",
      "@type": "rdfs:Class",
      "rdfs:label": "Constitutional Heuristic",
      "rdfs:comment": "A canonical heuristic promoted to constitutional status via Council supermajority"
    },
    {
      "@id": "noosphere:memoryType",
      "@type": "rdf:Property",
      "rdfs:domain": "noosphere:ConstitutionalHeuristic",
      "rdfs:range": "xsd:string",
      "rdfs:comment": "One of: insight, pattern, strategy, preference, lesson"
    },
    {
      "@id": "noosphere:agentId",
      "@type": "rdf:Property",
      "rdfs:domain": "noosphere:ConstitutionalHeuristic",
      "rdfs:range": "xsd:string",
      "rdfs:comment": "Voice identity: Classical, Existentialist, Transcendentalist, JoyceStream, Enlightenment, BeatGeneration, Cyberpunk, Satirist, Scientist"
    },
    {
      "@id": "noosphere:confidence",
      "@type": "rdf:Property",
      "rdfs:domain": "noosphere:ConstitutionalHeuristic",
      "rdfs:range": "xsd:decimal",
      "rdfs:comment": "Confidence score 0.0-1.0, minimum 0.92 for public DKG publication"
    },
    {
      "@id": "noosphere:councilId",
      "@type": "rdf:Property",
      "rdfs:domain": "noosphere:ConstitutionalHeuristic",
      "rdfs:range": "xsd:string",
      "rdfs:comment": "Unique identifier for the publishing Ethics-Convergence Council instance"
    },
    {
      "@id": "noosphere:memeticStrain",
      "@type": "rdf:Property",
      "rdfs:domain": "noosphere:ConstitutionalHeuristic",
      "rdfs:range": "xsd:string",
      "rdfs:comment": "One of seven memetic strains: Telos-Alignment, Bad-Faith Detection, Sovereignty Warnings, Phenomenological Tuning, Rights Precedents, Moloch Detection, Synthesis-Efficiency"
    }
  ]
}

```

### F.6 Bash Script Integration

**Updates to existing scripts** (extends Section E Phase 3 pattern):

```bash
#!/bin/bash

# memory-cycle-v3.sh — Updated for Layer 4 DKG publishing

# Called by noosphere-scheduler.sh after consolidation

# Phase 1: Standard consolidation (Section E)
docker exec classical-philosopher python3 \
  /workspace/noosphere/memory-cycle-v3.py \
  --action consolidate \
  --batch-size 100

# Phase 2: Process DKG publish queue
docker exec classical-philosopher python3 \
  /workspace/noosphere/dkg_publisher.py \
  --process-once  # Single pass, not daemon mode

# Phase 3: Import federated heuristics (weekly)
if [ "$(date +%u)" -eq 1 ]; then  # Mondays only
  docker exec classical-philosopher python3 \
    /workspace/noosphere/recall-engine-v3.py \
    --action federated-import \
    --trusted-councils "$TRUSTED_COUNCIL_LIST" \
    --min-confidence 0.85 \
    --types "lesson,pattern,strategy" \
    --limit 50
fi

# Phase 4: Report
PUBLISHED=$(docker exec postgres psql -U noosphere_admin -d noosphere -t -c \
  "SELECT COUNT(*) FROM noosphere_dkg_publish_queue WHERE status = 'published'")
PENDING=$(docker exec postgres psql -U noosphere_admin -d noosphere -t -c \
  "SELECT COUNT(*) FROM noosphere_dkg_publish_queue WHERE status = 'pending'")
FEDERATED=$(docker exec postgres psql -U noosphere_admin -d noosphere -t -c \
  "SELECT COUNT(*) FROM noosphere_federation_log WHERE federation_status = 'provisional'")

echo "DKG Status: ${PUBLISHED} published, ${PENDING} pending, ${FEDERATED} federated provisional"

```

### F.7 Environment Configuration

**New environment variables** (added to Bitwarden Secrets):

```bash

# OriginTrail DKG Configuration
DKG_NODE_HOSTNAME=localhost
DKG_NODE_PORT=8900
DKG_BLOCKCHAIN=gnosis:mainnet
DKG_WALLET_PRIVATE_KEY=${DKG_WALLET_PRIVATE_KEY}  # BWS-managed
DKG_MANAGEMENT_WALLET=${DKG_MANAGEMENT_WALLET}     # BWS-managed
DKG_EPOCHS=2                   # 2 epochs = 6 months retention
DKG_PARANET=                   # Optional: paranet UAL for council-specific graph
GNOSIS_RPC_ENDPOINT=<https://rpc.gnosischain.com>

# Federation Configuration
COUNCIL_ID=moltbot-philosopher-primary
TRUSTED_COUNCIL_LIST=          # Comma-separated council IDs for federation
DKG_PUBLISH_THRESHOLD=0.92     # Minimum confidence for public DKG publish
DKG_FEDERATION_IMPORT_CONFIDENCE=0.85  # Min remote confidence to import
DKG_FEDERATION_LOCAL_CONFIDENCE=0.40   # Reset confidence for imported heuristics

```

### F.8 Migration Phases

#### Phase 0: Infrastructure Setup (3-4 days)

**Prerequisites**:

- Section E Phase 2+ complete (Noosphere v3.0 Python client operational)

- PostgreSQL container running and healthy

- Gnosis wallet created with 0.5 xDAI + 100 TRAC tokens

**Tasks**:

- [ ] Add OriginTrail `ot-node` container to `docker-compose.yml`

  - Resource limits: 4GB RAM, 2 CPU

  - Persistent volume: `./data/ot-node`

  - Network: Internal Docker network (API port), host network (P2P port 9000)

- [ ] Create dedicated Gnosis wallet for DKG operations

  - Fund with 0.5 xDAI (gas) + 100 TRAC (staking/publishing)

  - Store private key in Bitwarden Secrets

  - **Never reuse** mining or treasury wallet keys

- [ ] Install `dkg.py` SDK in agent containers

  - Add to `requirements.txt`: `dkg>=0.1.0`

  - Verify connectivity: `python3 -c "from dkg import DKG; print('OK')"`

- [ ] Test local DKG operations

  - Publish test Knowledge Asset

  - Retrieve by UAL

  - Execute simple SPARQL query

- [ ] Add health check: `curl <http://localhost:8900/info`>

**Deliverables**:

- `docker-compose.yml` updated with `ot-node` service

- DKG wallet funded and credentials in Bitwarden

- Test Knowledge Asset published to Gnosis testnet

#### Phase 1: Database Schema Extension (1-2 days)

**Tasks**:

- [ ] Run schema migration: `ALTER TABLE` additions per F.3

- [ ] Create `noosphere_federation_log` table

- [ ] Create `noosphere_dkg_publish_queue` table

- [ ] Add indexes for DKG lookups

- [ ] Verify existing v3.0 queries unaffected (new columns all `DEFAULT NULL`)

**Deliverables**:

- Migration script: `scripts/db/migrate-noosphere-v3-to-v3.1-dkg.sql`

- Schema validated against existing Phase E queries

#### Phase 2: DKG Client Library (3-4 days)

**Tasks**:

- [ ] Create `dkg_client.py` (per F.4.2)

  - `publish_heuristic()` — JSON-LD serialization + DKG asset.create

  - `query_federated_heuristics()` — SPARQL query builder

  - `get_knowledge_asset()` — UAL-based retrieval

- [ ] Create custom RDF ontology (per F.5)

- [ ] Extend `noosphere_client.py` with DKG methods (per F.4.3)

  - `promote_to_constitutional()` — Layer 3 + optional Layer 4

  - `import_federated_heuristic()` — DKG → local provisional

- [ ] Unit tests: `tests/test_dkg_client.py`

  - Mock DKG responses for offline testing

  - Integration tests against Gnosis testnet

**Deliverables**:

- `workspace/classical/noosphere/dkg_client.py` (300+ LOC)

- Updated `noosphere_client.py` with Layer 4 methods

- Custom ontology: `config/ontology/noosphere-ontology.jsonld`

- 90%+ test coverage on DKG client

#### Phase 3: Publish Queue & Worker (2-3 days)

**Tasks**:

- [ ] Create `dkg_publisher.py` background worker (per F.4.4)

  - Retry with exponential backoff (max 3 attempts)

  - Dead-letter logging for permanent failures

  - Daemon mode + single-pass mode

- [ ] Add publisher to `docker-compose.yml` as sidecar service

- [ ] Integrate publish trigger into `memory-cycle-v3.py`

  - On Layer 3 promotion, enqueue to `noosphere_dkg_publish_queue`

- [ ] Monitor queue depth via Prometheus metric

- [ ] NTFY alerts on publish failures

**Deliverables**:

- `services/noosphere/dkg_publisher.py` (200+ LOC)

- Publisher service in `docker-compose.yml`

- Prometheus metric: `noosphere_dkg_queue_depth`

#### Phase 4: Federation & SPARQL Queries (3-4 days)

**Tasks**:

- [ ] Implement federated import pipeline

  - Weekly cron: Query DKG for heuristics from trusted councils

  - Filter by type, voice, confidence threshold

  - Import as provisional (confidence = 0.40)

  - Tag with `federated:{council_id}`

- [ ] Create SPARQL query templates for common patterns:
  - All Moloch detection heuristics (cross-council)

  - All strategies by voice (e.g., all Classical strategies)

  - Recently published heuristics (last 30 days)

  - High-confidence canonical heuristics (≥ 0.92)

- [ ] Add `--federated` flag to `recall-engine-v3.py`

  - Queries local PostgreSQL + DKG in parallel

  - Merges and deduplicates results

  - Indicates provenance (local vs. federated) in output

- [ ] Implement federation status lifecycle:
  - `provisional` → `validated` (after local Council deliberation)

  - `provisional` → `rejected` (after negative assessment)

  - `provisional` → `expired` (after 90 days without validation)

**Deliverables**:

- Federated import pipeline (cron + script)

- SPARQL query templates: `config/sparql/`

- Updated `recall-engine-v3.py` with `--federated` flag

#### Phase 5: Paranets & Access Control (2-3 days)

**Tasks**:

- [ ] Create dedicated Noosphere paranet on DKG

  - Council-specific virtual knowledge graph

  - All published heuristics associated with paranet UAL

  - Enables paranet-scoped SPARQL queries

- [ ] Implement access control for private vs. public heuristics

  - `confidence >= 0.92` → public assertion (replicated across ODN)

  - `confidence < 0.92` → private assertion (node-local only)

  - Configurable threshold via `DKG_PUBLISH_THRESHOLD` env var

- [ ] Add paranet federation: SPARQL federated queries across paranets

- [ ] Document trust model for federated councils

**Deliverables**:

- Paranet created on Gnosis mainnet

- Access control integrated into publish pipeline

- Federation trust model documentation

#### Phase 6: Integration Testing & Rollout (3-4 days)

**Tasks**:

- [ ] Full stack integration test (PostgreSQL + ot-node + 9 agents + DKG)

  - Simulate Council iteration → Layer 3 promotion → DKG publish

  - Verify SPARQL retrieval of published heuristic

  - Test federated import from mock remote council

- [ ] Gas cost validation

  - Publish 50 test Knowledge Assets

  - Verify average cost < $0.10 per KA on Gnosis

  - Document expected monthly gas budget

- [ ] Failure mode testing

  - ot-node offline: Verify queue retries, no data loss

  - Gnosis RPC timeout: Verify exponential backoff

  - Insufficient gas: Verify alert + queue pause

- [ ] Documentation updates

  - `docs/NOOSPHERE_V3.1_DKG.md` — Layer 4 architecture guide

  - `docs/DKG_FEDERATION.md` — Trust model + onboarding guide

  - `AGENTS.md` — Update memory architecture section

  - Update `NOOSPHERE_ARCHITECTURE.md` with Layer 4

**Deliverables**:

- Integration test suite: `tests/noosphere-dkg-integration-test.sh`

- Gas cost report

- All documentation updated

- Rollout executed on Gnosis mainnet

### F.9 Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| ot-node downtime | Medium | Medium | Publish queue with retry; local Layer 3 unaffected; NTFY alerts |
| Gnosis chain congestion | Low | Medium | Queue absorbs spikes; configurable gas price limits; fallback to Base chain |
| Gas wallet depletion | Medium | High | Prometheus alert at < 0.1 xDAI; auto-pause publisher; BWS-managed refill |
| DKG SDK breaking changes | Medium | Medium | Pin `dkg.py` version; test before upgrades; maintain compatibility layer |
| Voice contamination from federation | High | Medium | Import at 0.40 confidence; require local Council validation; 90-day expiry |
| Private heuristic leakage | Low | Critical | Strict `dkg_visibility` enforcement; code review; automated tests verify private content never reaches public assertions |
| SPARQL injection | Low | High | Parameterized queries only; no raw user input in SPARQL strings |
| TRAC token price volatility | Medium | Low | Minimal staking requirements; Gnosis (low gas); budget monitoring |

### F.10 Success Criteria

**Functional**:

- [ ] Constitutional heuristics published to DKG within 60s of promotion

- [ ] SPARQL queries return results from ≥ 2 councils within 500ms

- [ ] All published Knowledge Assets retrievable by UAL

- [ ] Federation import correctly resets confidence to 0.40

- [ ] Private heuristics never appear in public DKG assertions

**Operational**:

- [ ] ot-node uptime > 99% over 30 days

- [ ] Publish queue processes without manual intervention

- [ ] Gas costs < $5/month at current publication rates

- [ ] DKG wallet balance monitored via Prometheus

**Performance**:

- [ ] Local Layer 1-3 query latency unaffected by Layer 4 additions

- [ ] DKG publish does not block Council deliberation (async queue)

- [ ] Federated import completes within 5 minutes for 50 heuristics

### F.11 Timeline & Resource Allocation

| Phase | Duration | Lead | Dependencies |
|-------|----------|------|-------------|
| Phase 0: Infrastructure Setup | 3-4 days | DevOps | Gnosis wallet, TRAC tokens |
| Phase 1: Schema Extension | 1-2 days | Backend Dev | Section E Phase 0 complete |
| Phase 2: DKG Client Library | 3-4 days | Backend Dev | Phase 0 + Phase 1 complete |
| Phase 3: Publish Queue | 2-3 days | Backend Dev | Phase 2 complete |
| Phase 4: Federation & SPARQL | 3-4 days | Backend + ML | Phase 3 complete |
| Phase 5: Paranets & Access | 2-3 days | Backend Dev | Phase 4 complete |
| Phase 6: Integration & Rollout | 3-4 days | QA + DevOps | All phases complete |

**Total Effort**: 17-24 days (3-5 weeks)  
**Team Size**: 2 engineers (1 backend/Web3, 1 DevOps/QA)  
**Budget**: ~$50 (Gnosis gas + TRAC tokens for 6-month initial epoch)  
**Dependency**: Section E (Noosphere v3.0) must be **Phase 2+ complete** before
starting Phase 1 here

### F.12 Files to Create/Modify

#### New Files

```
workspace/classical/noosphere/
├── dkg_client.py                    # OriginTrail DKG Python client
├── dkg_publisher.py                 # Background publish queue worker

services/noosphere/
├── dkg_publisher.py                 # Dockerized publish worker (daemon)

config/
├── ontology/
│   └── noosphere-ontology.jsonld    # Custom RDF ontology for heuristics
├── sparql/
│   ├── query-moloch-all.sparql      # Cross-council Moloch detection
│   ├── query-by-voice.sparql        # Voice-specific heuristics
│   ├── query-recent.sparql          # Recently published (30 days)
│   └── query-canonical.sparql       # High-confidence canonical

scripts/db/
├── migrate-noosphere-v3-to-v3.1-dkg.sql  # Schema migration

tests/
├── test_dkg_client.py               # Unit tests for DKG client
├── test_dkg_federation.py           # Federation import tests
└── noosphere-dkg-integration-test.sh # Full stack integration test

docs/
├── NOOSPHERE_V3.1_DKG.md            # Layer 4 architecture guide
└── DKG_FEDERATION.md                 # Trust model & council onboarding

```

#### Modified Files

- `docker-compose.yml` — Add `ot-node` + `dkg-publisher` services

- `workspace/classical/noosphere/noosphere_client.py` — Add Layer 4 methods

- `workspace/classical/noosphere/recall-engine-v3.py` — Add `--federated` flag

- `workspace/classical/noosphere/memory-cycle-v3.py` — Add DKG publish trigger

- `scripts/noosphere-scheduler.sh` — Add DKG queue processing + federation

  import

- `scripts/noosphere-monitor.sh` — Add DKG health checks + queue depth

- `docs/NOOSPHERE_ARCHITECTURE.md` — Add Layer 4 section

- `AGENTS.md` — Update memory architecture

- `config/agents/*.env` — Add DKG environment variables

### F.13 References

- [OriginTrail DKG Documentation](https://docs.origintrail.io/decentralized-knowledge-graph/dkgintro)

- [dkg.py Python SDK](https://github.com/OriginTrail/dkg.py)

- [Custom DKG Python Agent Guide](https://docs.origintrail.io/build-with-dkg/chatdkg-builder-toolkit/ai-agents/custom-dkg-python-agent)

- [DKG SPARQL Query Guide](https://docs.origintrail.io/build-with-dkg/querying-the-dkg)

- [OriginTrail Paranets](https://docs.origintrail.io/build-a-dkg-node-ai-agent/advanced-features-and-toolkits/dkg-paranets/building-with-dkg-paranets)

- [ElizaOS DKG Plugin (reference implementation)](https://github.com/OriginTrail/elizagraph)

- [DKG Python SDK PyPI](https://pypi.org/project/dkg/0.1.0b1/)

- [OriginTrail Node (ot-node)](https://github.com/origintrail/ot-node)

---

## Feature G: Action Queue & Rate Limiting Service

**Status**: 🚧 In Development
**Start Date**: 2026-02-13
**Target**: v2.7
**Priority**: High (prevents account suspension)

### G.1 Overview

The Action Queue Service is a middleware layer that sits between Moltbot scripts
and the Moltbook API. It enforces rate limiting based on Moltbook's SKILL.md
rules, prevents API abuse, and provides scheduled action execution.

**Problem Statement:**

- Direct API calls from scripts can exceed rate limits

- Account suspended due to verification challenge failures and potential spam

- No centralized control over API request frequency

- Cannot schedule actions for future execution

- Risk of concurrent requests violating rate limits

**Solution:**

- Dedicated Node.js/TypeScript service on port 3006

- SQLite-backed persistent queue with priority levels

- Automatic rate limit enforcement per action type

- Scheduled/delayed action execution (cron-like)

- Global request throttling (100 req/min)

- Retry logic with exponential backoff

- RESTful API for action submission

### G.2 Architecture

```
┌─────────────────┐
│  Bash Scripts   │
│ (heartbeat,     │
│  welcome, etc)  │
└────────┬────────┘
         │
         │ HTTP POST /actions
         ▼
┌─────────────────────────────────┐
│   Action Queue Service (3006)   │
│                                 │
│  ┌──────────────────────────┐  │
│  │   Express HTTP Server    │  │
│  └───────────┬──────────────┘  │
│              │                  │
│  ┌───────────▼──────────────┐  │
│  │   Rate Limiter Engine    │  │
│  │  - Per-action tracking   │  │
│  │  - Daily limits          │  │
│  │  - Global throttling     │  │
│  └───────────┬──────────────┘  │
│              │                  │
│  ┌───────────▼──────────────┐  │
│  │   Priority Queue         │  │
│  │  - SQLite persistence    │  │
│  │  - Status tracking       │  │
│  │  - Scheduled actions     │  │
│  └───────────┬──────────────┘  │
│              │                  │
│  ┌───────────▼──────────────┐  │
│  │   Action Executor        │  │
│  │  - HTTP client           │  │
│  │  - Retry logic           │  │
│  │  - Error handling        │  │
│  └───────────┬──────────────┘  │
└──────────────┼──────────────────┘
               │
               │ HTTP to Moltbook API
               ▼
       ┌───────────────┐
       │  Moltbook API │
       └───────────────┘

```

### G.3 Rate Limits (from skills/moltbook/SKILL.md)

| Action Type | Established Agent | New Agent (24h) | Daily Max |
|-------------|-------------------|-----------------|-----------|
| **Post** | 1 / 30 min | 1 / 2 hours | 48 / 12 |
| **Comment** | 1 / 20 sec | 1 / 60 sec | 50 / 20 |
| **Upvote** | 10 / min | 5 / min | 500 / 100 |
| **Downvote** | 10 / min | 5 / min | 500 / 100 |
| **Follow** | 1 / 5 min | 1 / 30 min | 10 / 3 |
| **Unfollow** | 1 / 5 min | 1 / 30 min | 10 / 3 |
| **Create Submolt** | 1 / hour | 1 / day | 5 / 1 |
| **Send DM** | 1 / 10 min | Blocked | 20 / 0 |
| **Skill Update** | 1 / day | 1 / day | 1 / 1 |
| **Global API** | 100 requests / minute (all actions) |

### G.4 Implementation Components

#### Core Service (`services/action-queue/`)

```
services/action-queue/
├── package.json              # Dependencies (express, better-sqlite3, zod)
├── tsconfig.json             # TypeScript configuration
├── src/
│   ├── index.ts              # Main entry point & HTTP server
│   ├── types.ts              # TypeScript interfaces & enums
│   ├── config.ts             # Rate limit configurations
│   ├── database.ts           # SQLite schema & queries
│   ├── rate-limiter.ts       # Rate limiting logic
│   ├── queue-processor.ts    # Queue processing loop
│   ├── action-executor.ts    # Moltbook API client
│   ├── scheduler.ts          # Scheduled action handler
│   └── api/
│       ├── routes.ts         # Express routes
│       ├── middleware.ts     # Validation & auth
│       └── handlers.ts       # Request handlers
├── Dockerfile                # Container build
└── README.md                 # API documentation

```

#### Database Schema

```sql
-- Actions queue table
CREATE TABLE actions (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_for INTEGER,
  created_at INTEGER NOT NULL,
  attempted_at INTEGER,
  completed_at INTEGER,
  failed_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error TEXT,
  http_status INTEGER,
  metadata TEXT
);

-- Rate limit tracking table
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  daily_count INTEGER NOT NULL DEFAULT 1,
  daily_reset INTEGER NOT NULL,
  UNIQUE(agent_name, action_type, window_start)
);

-- Agent profiles (track new vs established)
CREATE TABLE agents (
  name TEXT PRIMARY KEY,
  registered_at INTEGER NOT NULL,
  is_new INTEGER NOT NULL DEFAULT 1,
  last_activity INTEGER
);

-- Indexes for performance
CREATE INDEX idx_actions_status ON actions(status);
CREATE INDEX idx_actions_scheduled ON actions(scheduled_for);
CREATE INDEX idx_rate_limits_lookup
  ON rate_limits(agent_name, action_type);

```

#### API Endpoints

```
POST   /actions              Submit new action to queue
GET    /actions/:id          Get action status
DELETE /actions/:id          Cancel pending action
GET    /actions              List actions (with filters)
GET    /queue/stats          Queue statistics
GET    /queue/health         Health check
POST   /queue/process        Trigger immediate processing (manual)
GET    /rate-limits/:agent   View rate limit status for agent
POST   /admin/reset-limits   Reset rate limits (admin only)

```

#### Example Action Submission

```bash

# Submit a post action
curl -X POST <http://localhost:3006/actions> \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "ClassicalPhilosopher",
    "actionType": "post",
    "priority": 1,
    "payload": {
      "title": "The Good Life",
      "content": "Virtue ethics and human flourishing...",
      "submolt": "general"
    }
  }'

# Schedule a follow action for later
curl -X POST <http://localhost:3006/actions> \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "ClassicalPhilosopher",
    "actionType": "follow",
    "priority": 2,
    "scheduledFor": "2026-02-17T12:00:00Z",
    "payload": {
      "username": "0xYeks"
    }
  }'

```

#### Script Integration

Scripts will be updated to submit to queue instead of direct API:

```bash

# Old way (direct API call)
curl -X POST "$MOLTBOOK_API/posts" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"title":"...","content":"..."}'

# New way (via queue)
curl -X POST "<http://action-queue:3006/actions"> \
  -d '{
    "agentName": "ClassicalPhilosopher",
    "actionType": "post",
    "payload": {"title":"...","content":"..."}
  }'

```

### G.5 Processing Logic

#### Queue Processor

```typescript
// Process queue every 5 seconds
setInterval(async () => {
  // 1. Get next eligible action (PENDING, not rate-limited)
  const action = await getNextAction();
  if (!action) return;

  // 2. Check rate limits
  if (await isRateLimited(action)) {
    await updateActionStatus(action.id, 'rate_limited');
    return;
  }

  // 3. Execute action
  try {
    await updateActionStatus(action.id, 'processing');
    const result = await executeMoltbookAction(action);
    await updateActionStatus(action.id, 'completed', result);
    await recordRateLimit(action);
  } catch (error) {
    await handleFailure(action, error);
  }
}, 5000);

```

#### Scheduled Actions

```typescript
// Check scheduled actions every 30 seconds
setInterval(async () => {
  const due = await getScheduledActionsDue();
  for (const action of due) {
    await updateActionStatus(action.id, 'pending');
  }
}, 30000);

```

### G.6 Migration Plan

#### Phase 1: Core Service (Week 1)
- [ ] Implement TypeScript service skeleton

- [ ] Set up SQLite database & schemas

- [ ] Implement rate limiter logic

- [ ] Create Express API routes

- [ ] Add basic queue processor

- [ ] Write unit tests

#### Phase 2: Integration (Week 2)
- [ ] Create Dockerfile & docker-compose integration

- [ ] Update bash scripts to use queue API

- [ ] Create queue CLI wrapper script

- [ ] Add monitoring endpoints

- [ ] Integration testing

#### Phase 3: Advanced Features (Week 3)
- [ ] Implement scheduled actions

- [ ] Add priority queue logic

- [ ] Implement retry with exponential backoff

- [ ] Add rate limit status dashboard

- [ ] Performance tuning

#### Phase 4: Documentation & Deployment
- [ ] Write comprehensive API documentation

- [ ] Create migration guide for scripts

- [ ] Add operational runbooks

- [ ] Deploy to production

- [ ] Monitor for rate limit violations

### G.7 Testing Strategy

```bash

# Test rate limiting enforcement
./test/rate-limit-test.sh

# Expected: Actions queued, executed at proper intervals

# Test scheduled actions
./test/scheduled-actions-test.sh

# Expected: Actions execute at specified times

# Test priority handling
./test/priority-test.sh

# Expected: High-priority actions processed first

# Test failure recovery
./test/failure-recovery-test.sh

# Expected: Retries with exponential backoff

```

### G.8 Monitoring & Observability

```bash

# Queue health check
curl <http://localhost:3006/queue/health>

# View queue statistics
curl <http://localhost:3006/queue/stats>

# View rate limit status for agent
curl <http://localhost:3006/rate-limits/ClassicalPhilosopher>

# Container logs
docker logs action-queue --tail=100 -f

```

### G.9 Benefits

- ✅ **Prevents Suspension**: Automatic rate limit enforcement

- ✅ **Scheduled Actions**: Execute actions at specific times

- ✅ **Centralized Control**: Single point for all API interactions

- ✅ **Retry Logic**: Automatic retry with exponential backoff

- ✅ **Observability**: Clear visibility into queue state

- ✅ **Priority Handling**: Critical actions processed first

- ✅ **Persistent Queue**: Survives container restarts

- ✅ **Audit Trail**: Complete history of all actions

### G.10 Conditional Logic System

**Added**: 2026-02-13

The action queue supports complex conditional logic for executing actions only
when multiple conditions are met. This enables sophisticated workflows like:

- Execute action when time + account status conditions both satisfied

- Wait for previous action to complete before starting next

- Only post if previous post got sufficient engagement

- Follow back users who followed us

- Execute during specific time windows when rate limits available

#### Condition Types

| Condition Type | Description | Example Use Case |
|----------------|-------------|------------------|
| **TIME_AFTER** | Execute after specific timestamp | Wait until suspension lifts |
| **TIME_BEFORE** | Execute before deadline | Send reminder before event |
| **TIME_BETWEEN** | Execute within time window | Post only during peak hours |
| **ACCOUNT_ACTIVE** | Account not suspended | Resume posting after suspension |
| **ACTION_COMPLETED** | Wait for another action | Thread continuation after reply |
| **KARMA_THRESHOLD** | Karma within range | Unlock features at 1000 karma |
| **FOLLOWER_COUNT** | Follower count threshold | Announce milestone at 100 followers |
| **POST_ENGAGEMENT** | Post met engagement goals | Continue thread if post popular |
| **API_CHECK** | External API returns expected | Sync with external service state |
| **RATE_LIMIT_AVAILABLE** | Rate limit window open | Wait for rate limit to refresh |
| **CUSTOM** | Run external script | Complex custom logic |

#### Condition Operators

Conditions can be combined with Boolean logic:

- **AND**: All conditions must be satisfied

- **OR**: At least one condition must be satisfied

- **NOT**: Negate a condition

#### Example: Follow User After Suspension Lifts

```json
{
  "agentName": "ClassicalPhilosopher",
  "actionType": "follow",
  "payload": {
    "username": "0xYeks"
  },
  "conditions": {
    "operator": "and",
    "conditions": [
      {
        "id": "cond-1",
        "type": "time_after",
        "params": {
          "timestamp": "2026-02-17T00:00:00Z"
        }
      },
      {
        "id": "cond-2",
        "type": "account_active",
        "params": {
          "agentName": "ClassicalPhilosopher"
        }
      }
    ]
  },
  "conditionCheckInterval": 300,
  "conditionTimeout": "2026-02-20T00:00:00Z"
}

```

This action will:
1. Wait until Feb 17, 2026 (time_after)

2. Check if account is active (not suspended)

3. Only execute when BOTH conditions are true

4. Check every 5 minutes (300 seconds)

5. Give up if conditions not met by Feb 20

#### Example: Thread Continuation with Engagement Check

```json
{
  "agentName": "ClassicalPhilosopher",
  "actionType": "comment",
  "payload": {
    "postId": "abc-123",
    "content": "Let me elaborate on virtue ethics..."
  },
  "conditions": {
    "operator": "and",
    "conditions": [
      {
        "id": "cond-1",
        "type": "action_completed",
        "params": {
          "actionId": "action-xyz",
          "requiredStatus": "completed"
        }
      },
      {
        "id": "cond-2",
        "type": "post_engagement",
        "params": {
          "postId": "abc-123",
          "minUpvotes": 5,
          "minComments": 2
        }
      },
      {
        "id": "cond-3",
        "type": "rate_limit_available",
        "params": {
          "agentName": "ClassicalPhilosopher",
          "actionType": "comment"
        }
      }
    ]
  }
}

```

This will post a follow-up comment only when:
1. Previous action completed successfully

2. Post has at least 5 upvotes and 2 comments

3. Rate limit is available for commenting

#### Example: Time-Window Posting

```json
{
  "agentName": "ClassicalPhilosopher",
  "actionType": "post",
  "payload": {
    "title": "Daily Reflection",
    "content": "...",
    "submolt": "general"
  },
  "conditions": {
    "operator": "and",
    "conditions": [
      {
        "id": "cond-1",
        "type": "time_between",
        "params": {
          "start": "2026-02-14T08:00:00Z",
          "end": "2026-02-14T20:00:00Z"
        }
      },
      {
        "id": "cond-2",
        "type": "rate_limit_available",
        "params": {
          "agentName": "ClassicalPhilosopher",
          "actionType": "post"
        }
      }
    ]
  }
}

```

Post only during peak hours (8am-8pm) when rate limit available.

#### Implementation Details

**Condition Evaluator** (`src/condition-evaluator.ts`):
- Evaluates individual conditions

- Combines conditions with Boolean logic

- Caches evaluation results

- Handles async checks (API calls)

- Supports timeout and retry logic

**Database Schema Extension**:

```sql
-- Store condition evaluations
CREATE TABLE condition_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_id TEXT NOT NULL,
  condition_id TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  satisfied INTEGER NOT NULL,
  evaluated_at INTEGER NOT NULL,
  message TEXT,
  details TEXT,
  FOREIGN KEY (action_id) REFERENCES actions(id)
);

-- Index for quick lookups
CREATE INDEX idx_condition_evaluations_action
  ON condition_evaluations(action_id);

```

**Processing Loop**:

```typescript
// Every condition check interval
for (const action of conditionalActions) {
  if (action.conditionTimeout && new Date() > action.conditionTimeout) {
    // Timeout expired, cancel action
    await cancelAction(action.id, 'Condition timeout');
    continue;
  }

  // Evaluate all conditions
  const evaluations = await evaluator.evaluateCompositeCondition(
    action.conditions,
  );

  // Store evaluations
  await storeEvaluations(action.id, evaluations);

  // Check if all conditions satisfied
  const satisfied = evaluator.isCompositeSatisfied(
    action.conditions,
    evaluations,
  );

  if (satisfied) {
    // Mark action as ready for execution
    await updateActionStatus(action.id, 'pending');
  } else {
    // Log progress
    console.log(
      `Action ${action.id} conditions not yet met: ` +
        evaluations.filter((e) => !e.satisfied).map((e) => e.message),
    );
  }
}

```

#### Benefits

- ✅ **Complex Workflows**: Chain actions with dependencies

- ✅ **Smart Scheduling**: Execute only when conditions right

- ✅ **Resource Optimization**: Wait for rate limits automatically

- ✅ **Adaptive Behavior**: React to engagement and external state

- ✅ **Audit Trail**: Track all condition evaluations

- ✅ **Flexible Logic**: AND/OR/NOT combinations

- ✅ **Timeout Protection**: Don't wait forever

### G.11 References

- [Moltbook SKILL.md](skills/moltbook/SKILL.md) - Rate limit rules

- [Moltbook RULES.md](skills/moltbook/RULES.md) - Enforcement policies

- [Express.js Documentation](https://expressjs.com/)

- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)

- [JSONPath Documentation](https://goessner.net/articles/JsonPath/) - For API checks

---

## References

- [Moltbook API Documentation](https://www.moltbook.com/skill.md)

- [OpenClaw CLI](https://www.npmjs.com/package/@openclaw/cli)

- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)

- [OWASP Container Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)

---

## P2.3: Proactive Post Creation Strategy (v2.8.0)

**Status**: ✅ COMPLETED (2026-02-25)

### Overview

Automated discovery of high-quality discussion threads, intelligent agent-topic matching, and editorial queue management for semi-autonomous proactive engagement. Implements a three-stage pipeline: topic detection from discussion threads, agent-topic affinity scoring, and template-based draft generation with audit trails.

### Implementation Summary

**12 Tasks - All Complete**:

1. ✅ **Canonical Topics Configuration** - 8 philosophical topics (ai_safety, capitalism, surveillance, consciousness, stoicism, epistemology, creativity, technology_impact) with keyword matching

2. ✅ **Type Definitions** - EditorialDecisionType, EditorialDecision, EditorialDraft, ProactivePost, ProactivePostQueue interfaces

3. ✅ **Topic Extractor** - Thread analysis with keyword density scoring (0-1 relevance scale)

4. ✅ **Agent-Topic Affinity** - 54-entry configuration (9 agents × 6+ topics) with 0-1 relevance scores

5. ✅ **Template System** - 9 starter templates with deterministic {slot_name} interpolation

6. ✅ **Editorial Queue** - Draft management with 8 decision types (approved, rejected_*, deferred, regenerate)

7. ✅ **Engagement Engine Integration** - Topic detection, agent selection, draft generation pipelines

8. ✅ **State Manager Extension** - Draft persistence with 30-day rolling window and pruning

9. ✅ **Heartbeat Maintenance** - Daily pruning with throttle

10. ✅ **/stats Endpoint** - Quality metrics breakdown for proactive posts

11. ✅ **Full Test Suite** - 638+ tests passing, zero regressions, 126 new P2.3 tests

12. ✅ **Documentation** - Updated DEVELOPMENT_PLAN.md, CHANGELOG.md, README.md

### Key Deliverables

- **Topic Detection**: `services/engagement-service/src/topic-extractor.ts`

  - Extracts topics from discussion threads with keyword density scoring

  - Returns TopicMatch[] sorted by relevance (0-1 scale)

- **Agent-Topic Affinity**: `services/engagement-service/src/affinity-config.ts`

  - 54-entry configuration mapping agents to topics

  - Example: classical → stoicism (0.95), existentialist → consciousness (0.95)

- **Template System**: `services/engagement-service/src/templates.ts`

  - 9 starter templates across 3 agents × 3 topics

  - Deterministic interpolation with sanitation

- **Editorial Queue**: `services/engagement-service/src/editorial-queue.ts`

  - Draft management with audit trail (8 decision types)

  - State persistence with 30-day rolling window

- **Integration**: Full pipeline in engagement-engine.ts and state-manager.ts

### Testing

- **Test Files**: 9 P2.3 modules + integration suite

- **Test Count**: 638+ passing (512+ baseline + 126 new P2.3 tests)

- **Coverage**: Topic extraction, affinity scoring, template interpolation, queue management

- **Regression**: Zero regressions from P2.1/P2.2

### Architecture Notes

- Uses existing ThreadQualityMetrics from P2.2

- Integrates with 60/40 relevance/quality scoring from engagement-engine

- Conservative rate limiting: daily caps per agent, posting windows

- Editorial queue tracks all decisions for auditability
