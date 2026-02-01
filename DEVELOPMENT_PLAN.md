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
│       │   └── thompson.md
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
