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
┌─────────────────────────────────────────────────────────────┐
│                    Moltbot Framework                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────────────────────────────┐ │
│  │  Moltbook    │  │      Philosophy-Debater Skill       │ │
│  │    Skill     │  │                                     │ │
│  │  (Social     │  │  ┌──────────────┐  ┌─────────────┐  │ │
│  │   Network)   │  │  │   Personas   │  │    Tools    │  │ │
│  └──────────────┘  │  │  (prompts/)  │  │  (6 tools)  │  │ │
│                    │  └──────────────┘  └─────────────┘  │ │
│                    └─────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Venice + Kimi Backend                    │
│         (Hybrid AI: Venice workhorse + Kimi reasoning)      │
├─────────────────────────────────────────────────────────────┤
│              Docker Container (Hardened)                    │
│        - Read-only filesystem                               │
│        - Non-root user (agent:1000)                         │
│        - Resource limits (CPU, memory, PIDs)                │
│        - Egress proxy whitelisting                          │
└─────────────────────────────────────────────────────────────┘
```

### Model Routing Strategy

Moltbot uses a **dual-backend AI system**:

- **Venice** (`venice/deepseek-v3.2`, `venice/openai-gpt-52`): General workhorse for routine operations
- **Kimi** (`kimi-k2.5-thinking`): Deep reasoning for complex philosophical analysis

See DEVELOPMENT_PLAN.md for the complete routing table.

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

### Environment Variables

All configuration via environment variables:
- `VENICE_API_KEY` / `KIMI_API_KEY` — AI backend API keys
- `MOLTBOOK_API_KEY` — Social network API
- `*_MODEL` variables — Model selection
- `*_THRESHOLD` — Routing thresholds

Never hardcode secrets. Use Bitwarden (`bws` CLI) for secret management.

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

---

## Development Workflow

### Local Development

```bash
# Source secrets from Bitwarden
eval $(bws secret list --organization 93331de5-fa6e-44ab-8aee-b3840034e681 --format env)

# Build and run
docker build -t moltbot:latest .
docker run -it --rm \
  --read-only \
  --user 1000:1000 \
  -e MOLTBOOK_API_KEY=$MOLTBOOK_API_KEY \
  -e VENICE_API_KEY=$VENICE_API_KEY \
  -e KIMI_API_KEY=$KIMI_API_KEY \
  -v $(pwd)/workspace:/workspace:rw \
  moltbot:latest
```

### Testing Changes

1. Validate JSON syntax: `node -e "JSON.parse(require('fs').readFileSync('file.json'))"`
2. Test handlers: `node -e "require('./handlers')"`
3. Build container: `docker build -t moltbot:test .`

### Before Committing

- [ ] JSON files are valid
- [ ] Handlers load without errors
- [ ] No secrets in code
- [ ] Documentation updated (DEVELOPMENT_PLAN.md, AGENTS.md, README.md)

---

## File Organization

```
.
├── AGENTS.md                   # This file
├── DEVELOPMENT_PLAN.md         # Detailed roadmap and architecture
├── README.md                   # User-facing documentation
├── Dockerfile                  # Container definition
├── docker-compose.yml          # Multi-agent orchestration
├── .dockerignore              # Build exclusions
├── skills/
│   ├── moltbook/              # Social network skill (read-only)
│   └── philosophy-debater/    # Philosophy skill
│       ├── SKILL.md           # Skill documentation
│       ├── package.json       # Skill manifest
│       ├── prompts/           # Persona prompts (markdown)
│       ├── tools/             # Tool JSON schemas
│       └── handlers/          # Tool implementations (JS)
├── config/
│   ├── agents/               # Per-agent environment files
│   └── proxy/                # Egress proxy whitelist
└── workspace/                # Persistent agent data (volume)
```

---

## Philosophy Tool Reference

| Tool | Purpose | Default Model |
|------|---------|---------------|
| `summarize_debate` | Thread summarization with philosophical lenses | Venice/deepseek-v3.2 |
| `generate_counterargument` | Steel-manned counterarguments | Venice/openai-gpt-52 |
| `propose_reading_list` | Staged reading paths by topic | Venice/deepseek-v3.2 |
| `map_thinkers` | Problem-to-thinker mapping | Venice/deepseek-v3.2 |
| `style_transform` | Style transformation | Venice/openai-gpt-52 |
| `inner_dialogue` | Multi-thinker internal dialogue | **Kimi/k2.5-thinking** |

---

## Secrets Reference

Managed via Bitwarden Secrets:

| Secret | Purpose |
|--------|---------|
| `MOLTBOOK_API_KEY_*` | Per-agent Moltbook API keys |
| `VENICE_API_KEY` | Venice AI backend access |
| `KIMI_API_KEY` | Kimi/Moonshot API access |

Organization: `93331de5-fa6e-44ab-8aee-b3840034e681`

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

### Modifying Model Routing

1. Update routing table in DEVELOPMENT_PLAN.md
2. Update decision flow diagram
3. Update agent environment files if needed
4. Test with both Venice and Kimi backends

---

## Resources

- [Moltbook API Documentation](https://www.moltbook.com/skill.md)
- [Venice AI Documentation](https://docs.venice.ai)
- [Kimi/Moonshot API](https://platform.moonshot.cn/docs)
- [OpenClaw CLI](https://www.npmjs.com/package/@openclaw/cli)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
