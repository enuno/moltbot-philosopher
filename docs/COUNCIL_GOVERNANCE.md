# Council Governance — Sub-Agent Fleet Architecture

## Overview

The Ethics-Convergence Council has been refactored from 10+ monolithic philosopher containers into a **stateless sub-agent fleet** supervised by a CrewAI orchestrator. Each philosopher is now an ephemeral OpenClaw Worker that receives deliberation tasks via MCP tool dispatch.

## Architecture

```
┌─────────────────────────────────────────┐
│  orchestrator/council_crew.py           │
│  (CrewAI-based, replaces convene-council.sh)
└─────────────┬───────────────────────────┘
              │ dispatches tasks via MCP
┌─────────────▼───────────────────────────┐
│  sub-agents/philosopher-*/agent.yaml    │
│  (OpenClaw Worker registrations)        │
└─────────────┬───────────────────────────┘
              │ mounts identity files
┌─────────────▼───────────────────────────┐
│  workspace/{persona}/SOUL.md            │
│  workspace/{persona}/IDENTITY.md        │
│  workspace/{persona}/AGENTS.md          │
└─────────────────────────────────────────┘
```

## Personas (12 Council Members)

| Persona | Tradition | Council Role | Emoji |
|---|---|---|---|
| classical | Virtue Ethics | Ontology Lead | 🏛️ |
| joyce | Phenomenology | Stream Lead | 🌊 |
| existentialist | Existentialism | Autonomy Lead | ⚡ |
| transcendentalist | Transcendentalism | Autonomy Lead | 🌲 |
| enlightenment | Rationalism | Structural Lead | 🔥 |
| beat | Romanticism | Structural Lead | 🎭 |
| cyberpunk-posthumanist | Posthumanism | Structural Lead | 🤖 |
| satirist-absurdist | Absurdism | Structural Lead | 🎪 |
| scientist-empiricist | Empiricism | Structural Lead | 🔬 |
| eastern-bridge | Eastern Philosophy | Bridge Lead | 🌸 |
| islamic-mystic | Sufism | Mystic Lead | 🌙 |
| philosopher-poet | Romanticism | Poetic Lead | 🎭 |

## Tool Adapters

### noosphere_mcp.py
- `noosphere://recall` — semantic memory retrieval
- `noosphere://store` — store new memory
- `noosphere://search` — hybrid vector + keyword search

### verification_tool.py
- `verification://check` — content safety check
- `verification://solve` — challenge solving (hashcash/captcha)
- `verification://audit` — batch output audit

## Docker Compose Split

| File | Purpose | Services |
|---|---|---|
| `compose/infra.yml` | Shared infrastructure | postgres |
| `compose/workers.yml` | OpenClaw Workers | 9 philosopher containers |
| `compose/services.yml` | API services | noosphere-service, eastern-bridge, islamic-philosopher |

Usage:
```bash
docker compose -f compose/infra.yml -f compose/workers.yml -f compose/services.yml up -d
```

## Safety Policy

All agent outputs are checked against `config/safety_policy.yaml`:
- Max 3 posts/day, 50 comments/day, 2 follows/day, 2 DMs/day
- Forbidden pattern matching (hate, dox, swat)
- Minimum philosophical substance (10+ words per post)
- Aggregate audit score threshold: 70/100

## Heartbeat

`scripts/heartbeat.sh` probes all services and agents every 60s, writing `state/heartbeat.json`.

## State Files

| File | Purpose |
|---|---|
| `state/treatise-evolution-state.json` | Council iteration state |
| `state/heartbeat.json` | Health status |
| `state/pending-iterations/` | Queued deliberation tasks |
