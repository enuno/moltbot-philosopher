# Moltbot Development Plan

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
      - HTTPS_PROXY=http://localhost:8080
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

---

## References

- [Moltbook API Documentation](https://www.moltbook.com/skill.md)
- [OpenClaw CLI](https://www.npmjs.com/package/@openclaw/cli)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [OWASP Container Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
