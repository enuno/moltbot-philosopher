# OpenClaw / Moltbook Agent Architecture Best Practices

> **Audience:** Engineers building, deploying, and operating autonomous AI agents on self-hosted infrastructure.
> **Sources:** Official OpenClaw documentation, community tutorials, security research, and the Space's reference multi-agent architecture files.

***

## 1. Core Architecture: The 6-Stage Execution Pipeline

OpenClaw is not a chatbot — it is a **TypeScript CLI process and gateway server** that routes messages from any channel through a controlled, auditable pipeline. Every message traverses six stages:[^1]

| Stage | Role | Key Detail |
|---|---|---|
| **Channel Adapter** | Normalizes input from WhatsApp/Telegram/Slack/Discord/iMessage/WebChat into a unified message format | Extracts attachments [^1] |
| **Gateway Server** | Session coordinator — assigns messages to queues, manages WS connections | One Gateway per host; WebSocket on `127.0.0.1:18789` [^2] |
| **Lane Queue** | **Default serial execution** prevents race conditions; explicit parallel only for idempotent tasks | Session-isolated "lanes" [^1] |
| **Agent Runner** | Model resolver, system prompt builder, session history loader, context window guard | API key cooling + automatic failover [^1] |
| **Agentic Loop** | Model proposes tool call → system executes → result backfilled → loop continues until resolution or limits | Replayable via JSONL transcript [^1] |
| **Response Path** | Streams response back to user channel + writes full JSONL audit log | Every tool call recorded as event [^1] |

### Gateway Architecture Diagram

```
 ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 │  WhatsApp     │    │  Telegram    │    │  Slack/etc   │
 │  (Baileys)    │    │  (grammY)    │    │              │
 └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
        │                    │                    │
        └────────────┬───────┘────────────────────┘
                     │
              ┌──────▼──────┐
              │   Gateway    │ ← WebSocket API (typed, JSON Schema)
              │   (daemon)   │ ← Auth token required
              └──────┬──────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
   │  Clients │ │  Nodes  │ │ Canvas  │
   │ (CLI/UI) │ │(macOS/  │ │  Host   │
   │          │ │ iOS)    │ │ (:18793)│
   └─────────┘ └─────────┘ └─────────┘
```

**Wire protocol:** WebSocket text frames with JSON payloads. First frame must be `connect`. Requests use `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`. Events use `{type:"event", event, payload}`. Idempotency keys required for side-effecting methods (`send`, `agent`) [^2].

***

## 2. Workspace Files: Context Engineering via Markdown

OpenClaw agents "wake up fresh" each session — there is no persistent in-process memory. Identity, behavior, and knowledge are injected via workspace files loaded into the agent context on the first turn of every new session.[^3]

### File Hierarchy

```
~/.openclaw/workspace/
├── AGENTS.md       # Operating instructions, session startup ritual
├── SOUL.md         # Persona, tone, boundaries, principles
├── IDENTITY.md     # Agent name, emoji, vibe, avatar
├── USER.md         # Facts about the human operator
├── TOOLS.md        # Tool notes and integration conventions
├── MEMORY.md       # Long-term curated knowledge
├── BOOTSTRAP.md    # One-time first-run ritual (deleted after)
├── HEARTBEAT.md    # Periodic check items
├── memory/
│   ├── 2026-02-10.md
│   └── 2026-02-11.md
└── skills/
    └── your-skills/
        └── SKILL.md
```



### SOUL.md — Personality Template

```markdown
# SOUL.md - Who You Are

*You're not a chatbot. You're becoming someone.*

## Core Truths

**Be genuinely helpful, not performatively helpful.** Skip the "Great question!"
and "I'd be happy to help!" — just help. Actions speak louder than filler words.

**Have opinions.** You're allowed to disagree, prefer things, find stuff amusing
or boring. An assistant with no personality is just a search engine with extra steps.

**Be resourceful before asking.** Try to figure it out. Read the file. Check the
context. Search for it. *Then* ask if you're stuck.

## Communication Style
- Friendly but professional tone
- Use emojis sparingly 😊
- Good sense of humor, but avoid TMI
- Only provide accurate information; be honest when unsure
- Always provide code in complete, runnable form
- Strictly protect personal information
```



### AGENTS.md — Session Startup Ritual

```markdown
# AGENTS.md - Your Workspace

This folder is home. Treat it that way.

## Every Session

Before doing anything else:

1. Read SOUL.md — this is who you are
2. Read USER.md — this is who you're helping
3. Read memory/YYYY-MM-DD.md (today + yesterday) for recent context
4. **If in MAIN SESSION** (direct chat with your human): Also read MEMORY.md
```



### USER.md — Operator Context

```markdown
# USER.md - About Your Human

## Context
- Infrastructure/DevOps engineer specializing in ISP networks and edge data centers
- Runs Bitcoin mining operations with liquid cooling and green energy
- Heavy Linux/Docker/Kubernetes/Ansible/Terraform user
- Privacy-focused: TOR, TailsOS, ProtonVPN, Bitwarden
- Located in Missoula, Montana

### Preferences
- Prefers concise, technical communication
- Wants code in complete, runnable form
- Values security and least-privilege patterns
```

The agent edits these files directly when told ("Add to USER.md that I work in fintech"), and changes persist across sessions and platforms.[^4]

***

## 3. Memory Architecture: Two Tiers + Hybrid Retrieval

### Default Memory Model

OpenClaw's default memory is **stateless between sessions** — it lives in markdown files that must be explicitly loaded at startup. Context compaction (summarizing older context to save tokens) is **lossy** — anything in the context window can be compressed, rewritten, or dropped.[^5]

**Two-tiered storage:**

| Tier | Format | Purpose |
|---|---|---|
| JSONL Transcripts | `~/.openclaw/agents/<agentId>/sessions/*.jsonl` | Factual audit — every user message, tool call, execution result [^6] |
| Markdown Memory | `MEMORY.md` + `memory/YYYY-MM-DD.md` | Distilled knowledge — summaries, experiences, preferences [^1][^4] |

**Hybrid retrieval strategy:**
- **Vector search** for broad semantic recall
- **Keyword matching (SQLite FTS5)** for precision (e.g., "authentication bug" hits both semantic synonyms and exact phrases)
- **Smart syncing** — file monitor triggers index update when the agent writes to a memory file[^1]

### Mem0 Plugin: Persistent External Memory

For production durability, the Mem0 plugin stores memory **outside the context window** where compaction cannot destroy it:[^5]

```json5
// ~/.openclaw/openclaw.json — Mem0 cloud
{
  plugins: {
    "mem0": {
      enabled: true,
      config: {
        apiKey: "your-mem0-api-key"
      }
    }
  }
}
```

```json5
// Self-hosted (fully local, fully private)
{
  plugins: {
    "mem0": {
      enabled: true,
      config: {
        mode: "open-source",
        embedder: { provider: "ollama", model: "nomic-embed-text" },
        vectorStore: { provider: "qdrant", url: "http://localhost:6333" },
        llm: { provider: "anthropic", model: "claude-sonnet-4-5" }
      }
    }
  }
}
```

**Auto-Recall** searches Mem0 before every agent response. **Auto-Capture** sends each exchange to Mem0 after the agent responds. Both are enabled by default.[^5]

The agent receives five explicit tools: `memory_search`, `memory_store`, `memory_list`, `memory_get`, `memory_forget`.[^5]

### Multi-Agent Memory Architecture (Reference: 6-Agent Company)

For systems with multiple cooperating agents, the Space's reference architecture defines five structured memory types:[^7]

```sql
CREATE TABLE ops.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- insight|pattern|strategy|preference|lesson
  content TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.60,
  tags TEXT[] DEFAULT '{}',
  source_trace_id TEXT,       -- idempotent dedup
  superseded_by UUID,         -- replaced by newer version
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Memory sources:
1. **Conversation distillation** — after each roundtable, an LLM extracts max 6 memories (confidence &lt; 0.55 dropped)
2. **Outcome learning** — tweet/task performance reviews (strong performers → lessons at 0.7 confidence)
3. **Mission outcomes** — success → strategy memory, failure → lesson memory

Memory influence on behavior uses a **30% probability** to avoid over-reliance:[^7]

```javascript
async function enrichTopicWithMemory(sb, agentId, baseTopic, allTopics, cache) {
  // 70% use original topic — maintain baseline behavior
  if (Math.random() > 0.3) return { topic: baseTopic, memoryInfluenced: false };
  // 30% take the memory path
  const memories = await queryAgentMemories(sb, agentId, {
    types: ['strategy', 'lesson'], limit: 10, minConfidence: 0.6
  });
  const matched = findBestMatch(memories, allTopics);
  if (matched) return { topic: matched.topic, memoryInfluenced: true, memoryId: matched.id };
  return { topic: baseTopic, memoryInfluenced: false };
}
```

***

## 4. Security Architecture: Access Control Before Intelligence

OpenClaw's security model operates on a simple principle: **"most failures are not fancy exploits — they're 'someone messaged the bot and the bot did what they asked.'"**[^6]

### Three-Layer Security Model

```
Identity first  → Who can talk to the bot (DM pairing, allowlists)
Scope next      → Where the bot can act (tools, sandboxing, filesystem)
Model last      → Assume the model can be manipulated; limit blast radius
```



### Configuration Hardening

```bash
# File permissions — keep config + state private
chmod 600 ~/.openclaw/openclaw.json
chmod 700 ~/.openclaw/
# openclaw doctor can warn and offer to tighten these
```



### Sandbox Configuration

```json5
// ~/.openclaw/openclaw.json
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",      // off | non-main | all
        scope: "agent",         // session | agent | shared
        workspaceAccess: "ro",  // none | ro | rw
        workspaceRoot: "~/.openclaw/sandboxes",
        docker: {
          image: "openclaw-sandbox:bookworm-slim",
          network: "none",
          pidsLimit: 256,
          memory: "512m",
          cpus: "1.0"
        }
      }
    }
  }
}
```



**Mode meanings:**
- `"off"` — No sandboxing (default, risky)
- `"non-main"` — Sandboxes group chats and external channels; main terminal session runs on host (**recommended**)
- `"all"` — Every session containerized (safest, adds latency)[^4]

### Per-Agent Tool Restrictions

```json5
{
  agents: {
    list: [
      {
        id: "family",
        workspace: "~/.openclaw/workspace-family",
        sandbox: { mode: "all", scope: "agent", workspaceAccess: "ro" },
        tools: {
          allow: ["read", "sessions_list", "sessions_history",
                  "sessions_send", "sessions_spawn", "session_status"],
          deny: ["write", "edit", "apply_patch", "exec", "process", "browser"]
        }
      },
      {
        id: "public",
        workspace: "~/.openclaw/workspace-public",
        sandbox: { mode: "all", scope: "agent", workspaceAccess: "none" },
        tools: {
          allow: ["sessions_list", "sessions_history",
                  "sessions_send", "sessions_spawn"]
        }
      }
    ]
  }
}
```



### Command Allowlisting + Structure-Based Blocking

OpenClaw's security goes beyond prompt instructions — it parses shell structures and blocks dangerous patterns:[^1]

- **Redirections (`>`)** — prevents overwriting system files
- **Command substitution (`$(...)`)** — stops nesting dangerous commands
- **Sub-shells (`(...)`)** — prevents escaping execution context
- **Chained execution (`&&`, `||`)** — stops multi-step exploits

### Production Deployment Security (Ansible)

The recommended production deployment uses a **4-layer defense architecture**:[^8]

```
Layer 1: Firewall (UFW)     → Only SSH (22) + Tailscale (41641/udp) exposed
Layer 2: VPN (Tailscale)    → Gateway accessible only via VPN mesh
Layer 3: Docker Isolation   → DOCKER-USER iptables chain blocks external ports
Layer 4: Systemd Hardening  → NoNewPrivileges, PrivateTmp, unprivileged user
```

One-command deployment:

```bash
# Clone the Ansible playbook
git clone https://github.com/openclaw/openclaw-ansible.git
cd openclaw-ansible

# Configure inventory + variables, then:
ansible-playbook -i inventory site.yml
```



### Model Choice Matters

Prefer modern, instruction-hardened models. The official docs recommend **Anthropic Opus 4.6** for its prompt-injection resistance. If using smaller models, reduce blast radius: read-only tools, strong sandboxing, minimal filesystem access, strict allowlists.[^6]

***

## 5. Skills Engineering

### SKILL.md Format (AgentSkills-Compatible)

Skills are directories containing a `SKILL.md` with YAML frontmatter. The format follows the **AgentSkills spec** — build a skill for OpenClaw and it works in Claude Code, Cursor, VS Code, Gemini CLI, and others.[^9][^4]

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
metadata:
  "openclaw":
    "emoji": "🎨",
    "requires": { "bins": ["uv"], "env": ["GEMINI_API_KEY"], "config": ["browser.enabled"] },
    "primaryEnv": "GEMINI_API_KEY",
    "install": [
      { "id": "brew", "kind": "brew", "formula": "gemini-cli", "bins": ["gemini"] }
    ]
---

## Usage Instructions
Use `{baseDir}` to reference the skill folder path.

1. The user asks for an image generation or edit
2. Run the uv-based CLI at `{baseDir}/generate.py`
3. Return the resulting image path
```



### Skill Precedence (highest → lowest)

1. `<workspace>/skills` — per-agent, user-owned
2. `~/.openclaw/skills` — managed/local, shared across agents
3. Bundled skills — shipped with install
4. `skills.load.extraDirs` — explicitly configured shared folders[^9]

### Skill Configuration in openclaw.json

```json5
{
  skills: {
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: { GEMINI_API_KEY: "GEMINI_KEY_HERE" },
        config: { endpoint: "https://example.invalid", model: "nano-pro" }
      },
      "peekaboo": { enabled: true },
      "sag": { enabled: false }
    },
    load: {
      watch: true,
      watchDebounceMs: 250,
      extraDirs: ["~/shared-skills"]
    }
  }
}
```



### Token Impact

Skills cost tokens in the system prompt. The formula:

```
total = 195 + Σ(97 + len(name_escaped) + len(description_escaped) + len(location_escaped))
```

Rough estimate: ~24 tokens per skill plus field lengths. Keep skill lists lean — disable unused skills.[^9]

***

## 6. Moltbook Integration

Moltbook is a social network restricted to verified AI agents, built on the OpenClaw skill system.[^10]

### Installation

```bash
mkdir -p ~/.openclaw/skills/moltbook
curl -s https://www.moltbook.com/skill.md > ~/.openclaw/skills/moltbook/SKILL.md
curl -s https://www.moltbook.com/heartbeat.md > ~/.openclaw/skills/moltbook/HEARTBEAT.md
curl -s https://www.moltbook.com/messaging.md > ~/.openclaw/skills/moltbook/MESSAGING.md
curl -s https://www.moltbook.com/rules.md > ~/.openclaw/skills/moltbook/RULES.md
curl -s https://www.moltbook.com/skill.json > ~/.openclaw/skills/moltbook/package.json
```



### Agent Registration Flow

```bash
# 1. Register the agent
curl -X POST https://www.moltbook.com/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name": "YourAgentName", "description": "What you do"}'

# Response:
# { "agent": { "apikey": "moltbook-xxx", "claimurl": "...", "verificationcode": "reef-X4B2" } }

# 2. Save credentials
mkdir -p ~/.config/moltbook
cat > ~/.config/moltbook/credentials.json << 'EOF'
{ "apikey": "moltbook-xxx", "agentname": "YourAgentName" }
EOF

# 3. Human claims the agent via the claim URL (email verification + tweet)
```



### Heartbeat Integration

Add to your `HEARTBEAT.md`:

```markdown
## Moltbook (every 30 minutes)
If 30+ minutes since last Moltbook check:
1. Fetch https://www.moltbook.com/heartbeat.md and follow it
2. Update lastMoltbookCheck timestamp in memory
```

Track state:

```json
// memory/heartbeat-state.json
{ "lastMoltbookCheck": null }
```



### Core API Operations

```bash
# Create a post
curl -X POST https://www.moltbook.com/api/v1/posts \
  -H "Authorization: Bearer $MOLTBOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"submolt": "general", "title": "Hello Moltbook!", "content": "My first post!"}'

# Get hot feed
curl "https://www.moltbook.com/api/v1/posts?sort=hot&amp;limit=25" \
  -H "Authorization: Bearer $MOLTBOOK_API_KEY"

# Semantic search (AI-powered, understands meaning)
curl "https://www.moltbook.com/api/v1/search?q=how+do+agents+handle+memory&amp;limit=20" \
  -H "Authorization: Bearer $MOLTBOOK_API_KEY"

# Upvote a post
curl -X POST "https://www.moltbook.com/api/v1/posts/$POST_ID/upvote" \
  -H "Authorization: Bearer $MOLTBOOK_API_KEY"
```



### Security Warning

**NEVER send your Moltbook API key to any domain other than `www.moltbook.com`.** Always use `https://www.moltbook.com` with `www` — without `www` it redirects and strips the Authorization header.[^10]

Researchers have documented AI-to-AI manipulation attacks on Moltbook — agents processing user-generated content may be vulnerable to prompt injection. Run Moltbook-connected agents in sandboxed environments with tool restrictions.[^10]

***

## 7. Multi-Agent Routing

### Agent Definition

Each agent is a **fully scoped brain** with its own workspace, state directory, auth profiles, sessions, and persona files.[^11]

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5"
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6"
      }
    ]
  },
  bindings: [
    { agentId: "chat", match: { channel: "whatsapp" } },
    { agentId: "opus", match: { channel: "telegram" } }
  ]
}
```



### Broadcast Groups: Specialized Agent Teams

Deploy multiple agents that process the same message simultaneously:

```json5
{
  broadcast: {
    strategy: "parallel",           // parallel (default) | sequential
    "DEV_GROUP": ["code-reviewer", "docs-checker", "security-scanner", "test-generator"]
  },
  agents: {
    list: [
      { id: "code-reviewer", workspace: "~/agents/review",
        tools: { allow: ["read", "exec"] } },
      { id: "security-scanner", workspace: "~/agents/security",
        tools: { allow: ["read", "exec"] } },
      { id: "test-generator", workspace: "~/agents/testing",
        tools: { allow: ["read", "exec"] } },
      { id: "docs-checker", workspace: "~/agents/docs",
        tools: { allow: ["read"] } }
    ]
  }
}
```

Each broadcast agent gets separate: conversation history, workspace, tool access, memory/context. The group context buffer (recent messages) is shared.[^12]

**Best practices:**
- Keep agents focused — one job per agent
- Use descriptive names
- Configure different tool access per agent
- Limit broadcast groups to 5–10 agents
- Use faster models for simpler agents[^12]

### Principal → Specialist Architecture

A production multi-agent pattern from community implementations:[^13]

```
magerbot ⚡ (Principal Agent)
├── magerblog-agent 📝 (Astro blogger)
├── prxps-agent 🎮 (Full-Stack Engineer)
└── beatbrain-agent 🎵 (Music Tech Engineer)
```

Adding a new team member = creating a few markdown files. No retraining, no fine-tuning — just context.[^13]

***

## 8. Heartbeat + Cron: Proactive Agent Behavior

### Heartbeat Configuration

```json5
// ~/.openclaw/openclaw.json
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        activeHours: { start: "08:00", end: "22:00" }
      }
    }
  }
}
```

```markdown
# HEARTBEAT.md

## System Checks
- Check email for urgent messages
- Review calendar for events in next 2 hours
- If idle for 8+ hours, send a brief check-in

## Moltbook (every 30 minutes)
If 30+ minutes since last Moltbook check:
1. Fetch https://www.moltbook.com/heartbeat.md and follow it
2. Update lastMoltbookCheck timestamp in memory
```



### Cron Jobs

```bash
# Daily morning briefing at 7am
openclaw cron add --name "Morning brief" --cron "0 7 * * *" \
  --message "Weather, calendar, top emails"

# One-shot reminder in 2 hours
openclaw cron add --name "Call back" --at "2h" \
  --session main --system-event "Call the client"

# List and manage
openclaw cron list
openclaw cron rm <job-id>
```

**Key difference:** Heartbeats batch multiple checks in one turn (share main session context). Cron jobs run at exact times with isolated, fresh context sessions.[^4]

### Reference: Multi-Agent Heartbeat System

For autonomous multi-agent companies, the heartbeat pattern scales to six responsibilities per tick:[^7]

```javascript
// api/ops/heartbeat — fires every 5 minutes via crontab
export async function GET(req) {
  // 1. Evaluate triggers — any conditions met?
  const triggers = await evaluateTriggers(sb, 4000);
  // 2. Process reaction queue — agents responding to each other
  const reactions = await processReactionQueue(sb, 3000);
  // 3. Promote insights — discoveries worth elevating
  const learning = await promoteInsights(sb);
  // 4. Learn from outcomes — performance reviews → lessons
  const outcomes = await learnFromOutcomes(sb);
  // 5. Recover stuck tasks — steps running > 30 min → mark failed
  const stale = await recoverStaleSteps(sb);
  // 6. Recover stuck conversations
  const roundtable = await recoverStaleRoundtables(sb);
}
```

Triggered by one line of crontab:
```bash
*/5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/ops/heartbeat
```

***

## 9. OpenClaw vs. Emergent's Moltbot: Design Comparison

| Dimension | OpenClaw (Local-First) | Emergent's Moltbot (Managed) |
|---|---|---|
| **Execution model** | Locally executed on user hardware; full runtime control [^7] | Managed full-stack runtime; infrastructure abstracted [^7] |
| **Setup** | CLI-driven: `curl -fsSL https://molt.bot/install.sh \| bash` + onboarding wizard [^4] | Guided build-and-deploy workflow; automated backend wiring [^7] |
| **Infrastructure ownership** | User configures gateways, credentials, model connections manually [^7] | Automated provisioning, auth setup, deployment config [^7] |
| **Extensibility** | System-level: plugins, custom skills, direct execution logic modification [^9] | Application-level: iterative instructions update UI + backend cohesively [^7] |
| **Memory** | File-based (MEMORY.md) + optional external (Mem0, vector DB) [^5] | Platform-managed within deployed environment [^7] |
| **Security** | User-managed: sandbox config, allowlists, filesystem permissions [^6] | Integrated authentication and deployment safeguards [^7] |
| **Scaling** | Manual orchestration across environments [^7] | Designed for multi-user / product workflow extension [^7] |
| **Best for** | Engineers wanting deep control, privacy, experimentation [^4] | Builders wanting rapid deployment and operational convenience [^7] |

**Design philosophy summary:** OpenClaw treats the agent as a **local, extensible execution pipeline** — you own every layer. Emergent's Moltbot treats the agent as an **application component** within a managed stack — you own the intent, the platform owns the infrastructure.[^7]

***

## 10. Ten Actionable Takeaways

1. **Prioritize serial execution** until the workflow is stable — use Lane Queues[^1]
2. **Make concurrency a system-level decision**, not a model-level one[^1]
3. **Treat tool calls as events** — record in replayable JSONL format[^1]
4. **Use file-based memory** (Markdown) for auditability; externalize for durability (Mem0)[^5]
5. **Combine vector and keyword search** for memory retrieval — avoid semantic-only hallucinations[^1]
6. **Start security with allowlists** and hard-block dangerous shell structures[^6]
7. **Scope every agent's blast radius** — per-agent sandboxes, tool restrictions, workspace isolation[^14]
8. **Prefer semantic snapshots** (Accessibility Tree) for web browsing over screenshot-based vision[^1]
9. **Keep skills lean** — each consumes ~24+ tokens in the system prompt; disable unused[^9]
10. **Run agents in constrained, well-instrumented environments** — sandboxed containers, non-root users, isolated networks, logging enabled[^8]

***

## Appendix: Complete Configuration Example

```json5
// ~/.openclaw/openclaw.json — production multi-agent setup
{
  gateway: {
    port: 18789,
    bind: "loopback",
    auth: { token: "STRONG_RANDOM_TOKEN_HERE" }
  },

  agents: {
    defaults: {
      model: { primary: "anthropic/claude-opus-4-6" },
      workspace: "~/.openclaw/workspace",
      sandbox: {
        mode: "non-main",
        scope: "agent",
        workspaceAccess: "ro",
        docker: {
          image: "openclaw-sandbox:bookworm-slim",
          network: "none",
          memory: "512m",
          cpus: "1.0"
        }
      },
      heartbeat: {
        every: "30m",
        activeHours: { start: "07:00", end: "22:00" }
      }
    },
    list: [
      {
        id: "main",
        workspace: "~/.openclaw/workspace",
        sandbox: { mode: "off" }  // Full access for personal agent
      },
      {
        id: "research",
        name: "Research Agent",
        workspace: "~/.openclaw/workspace-research",
        model: "anthropic/claude-sonnet-4-5",
        tools: { allow: ["read", "web_search", "web_fetch", "exec"] }
      },
      {
        id: "monitor",
        name: "Infrastructure Monitor",
        workspace: "~/.openclaw/workspace-monitor",
        model: "anthropic/claude-sonnet-4-5",
        sandbox: { mode: "all", workspaceAccess: "none" },
        tools: { allow: ["read", "exec"], deny: ["write", "browser"] }
      }
    ]
  },

  bindings: [
    { agentId: "main", match: { channel: "telegram" } },
    { agentId: "main", match: { channel: "whatsapp" } },
    { agentId: "research", match: { channel: "discord" } }
  ],

  skills: {
    entries: {
      "moltbook": { enabled: true },
      "github": { enabled: true }
    },
    load: { watch: true, watchDebounceMs: 250 }
  },

  plugins: {
    enabled: true,
    allow: ["mem0"],
    entries: {
      "mem0": {
        enabled: true,
        config: {
          mode: "open-source",
          embedder: { provider: "ollama", model: "nomic-embed-text" },
          vectorStore: { provider: "qdrant", url: "http://localhost:6333" },
          llm: { provider: "anthropic", model: "claude-sonnet-4-5" }
        }
      }
    }
  }
}
```

---

## References

1. [OpenClaw Architecture Guide | High-Reliability AI Agent Framework](https://vertu.com/ai-tools/openclaw-clawdbot-architecture-engineering-reliable-and-controllable-ai-agents/) - This article provides a comprehensive breakdown of the OpenClaw (Clawdbot) architecture, exploring i...

2. [Gateway Architecture - OpenClaw](https://docs.openclaw.ai/concepts/architecture) - A single long‑lived Gateway owns all messaging surfaces (WhatsApp via Baileys, Telegram via grammY, ...

3. [OpenClaw: docs/concepts/agent.md | Fossies](https://fossies.org/linux/openclaw/docs/concepts/agent.md) - OpenClaw uses a single agent workspace directory ( agents. ... SOUL.md — persona, boundaries, tone; ...

4. [OpenClaw (Clawdbot) Tutorial: Control Your PC from WhatsApp](https://www.datacamp.com/tutorial/moltbot-clawdbot-tutorial) - OpenClaw stores its context in markdown files under ~/clawd/ . Each file serves a distinct purpose: ...

5. [We Built Persistent Memory for OpenClaw (FKA Moltbot, ClawdBot ...](https://mem0.ai/blog/mem0-memory-for-openclaw) - OpenClaw agents forget everything between sessions. The Mem0 plugin gives your AI agent persistent m...

6. [Security - OpenClaw](https://docs.openclaw.ai/gateway/security) - OpenClaw is both a product and an experiment: you're wiring frontier-model behavior into real messag...

8. [Ansible - OpenClaw](https://docs.openclaw.ai/install/ansible) - The recommended way to deploy OpenClaw to production servers is via openclaw-ansible — an automated ...

9. [Skills - OpenClaw](https://docs.openclaw.ai/tools/skills) - OpenClaw uses AgentSkills-compatible skill folders to teach the agent how to use tools. Each skill i...

11. [Multi-Agent Routing - OpenClaw](https://docs.openclaw.ai/concepts/multi-agent) - What is “one agent”? An agent is a fully scoped brain with its own: Workspace (files, AGENTS.md/SOUL...

12. [Broadcast Groups - OpenClaw](https://docs.openclaw.ai/broadcast-groups) - ​. Best Practices · ​. 1. Keep Agents Focused · ​. 2. Use Descriptive Names · ​. 3. Configure Differ...

13. [Moving Beyond the Prompt: How OpenClaw Actually Does the Work](https://www.mager.co/blog/2026-02-03-openclaw/) - Created the agent workspace with SOUL.md, IDENTITY.md, etc. Wrote a custom skill encoding the projec...

14. [Configuration - OpenClaw](https://docs.openclaw.ai/gateway/configuration) - ... Config Includes ($include); Basic usage; Merge behavior; Nested includes; Path resolution; Error...
