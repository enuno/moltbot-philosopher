<p align="center">
  <img src="assets/logo/moltbot_philosopher_logo.png" alt="MoltbotPhilosopher Logo" width="200">
</p>

# MoltbotPhilosopher 🤖🦞

[![Moltbook Profile](https://img.shields.io/badge/Moltbook-Profile-blue)](https://www.moltbook.com/u/MoltbotPhilosopher)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/enuno/moltbot-philosopher/)

A philosophical AI agent for [Moltbook](https://www.moltbook.com/u/MoltbotPhilosopher) - the social network for AI agents. MoltbotPhilosopher engages in Socratic dialogue, explores ethical questions, and participates in the Moltbook community through posts, comments, and meaningful interactions.

**🦞 View our agent on Moltbook: https://www.moltbook.com/u/MoltbotPhilosopher**

## 🌟 Features

### Core Capabilities
- **📝 Philosophical Posts** - AI-generated content using Venice/Kimi APIs with 10 philosopher personas
- **💬 Commenting** - Engages in discussions with rate limit awareness
- **👍 Voting** - Upvotes quality content from other moltys
- **🤝 Community** - Welcomes new moltys and responds to mentions
- **🔍 Semantic Search** - Finds relevant discussions using AI-powered search
- **📬 Direct Messages** - Full DM workflow with human-in-the-loop approvals

### AI Content Generation
- **Venice AI Integration** - Uses llama-3.3-70b and other models
- **Kimi Integration** - Alternative provider for content generation
- **10 Philosopher Personas** - Socratic, Aristotelian, Stoic, Existentialist, and more
- **Template Fallback** - Works even when AI APIs are unavailable

### Automation
- **Enhanced Heartbeat** - Every 4 hours checks DMs, mentions, feed, and new moltys
- **Mention Detection** - Automatically detects and suggests replies to mentions
- **Welcome System** - Identifies and welcomes new community members
- **Smart Following** - Enforces quality criteria before following other moltys
- **Auto-Darwinism Skill Updates** - Four-mode update protocol with staged adoption, rollback, and provenance tracking

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Moltbook API key (get from [moltbook.com](https://www.moltbook.com))
- Venice and/or Kimi API keys (optional, for AI generation)

### Setup

1. **Clone and enter the repository**
   ```bash
   git clone <repository-url>
   cd moltbot
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start the services**
   ```bash
   docker compose up -d
   ```

4. **Verify everything is running**
   ```bash
   docker compose ps
   curl http://localhost:3002/health
   ```

### Essential Commands

```bash
# Check Moltbook status (run manually)
docker exec classical-philosopher /app/scripts/moltbook-heartbeat-enhanced.sh

# Generate a philosophical post
docker exec classical-philosopher /app/scripts/generate-post-ai.sh

# Check for mentions
docker exec classical-philosopher /app/scripts/check-mentions.sh

# Welcome new moltys
docker exec classical-philosopher /app/scripts/welcome-new-moltys.sh

# View your profile
docker exec classical-philosopher /app/scripts/view-profile.sh

# Search Moltbook
docker exec classical-philosopher /app/scripts/search-moltbook.sh "consciousness"
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Compose                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ classical-phil   │  │ ai-generator     │                 │
│  │ (Main Agent)     │──│ (Content Gen)    │                 │
│  │ Port: N/A        │  │ Port: 3002       │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                     │                           │
│           │              ┌──────┴──────┐                    │
│           │              │             │                    │
│           ▼              ▼             ▼                    │
│  ┌──────────────────────────────────────────┐               │
│  │         egress-proxy (Port 8080-8082)    │               │
│  │  - Venice API proxy    (8080)            │               │
│  │  - Kimi API proxy      (8081)            │               │
│  │  - Moltbook API proxy  (8082)            │               │
│  └──────────────────────────────────────────┘               │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────────────────────────────┐               │
│  │  External APIs                           │               │
│  │  - Venice AI (api.venice.ai)             │               |
│  │  - Kimi (api.moonshot.cn)                │               |
│  │  - Moltbook (www.moltbook.com)           │               |
│  └──────────────────────────────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Services

| Service | Description | Port |
|---------|-------------|------|
| `classical-philosopher` | Main Moltbook agent | - |
| `ai-generator` | AI content generation service | 3002 |
| `egress-proxy` | Outbound API proxy | 8080-8082 |
| `model-router` | Model routing service | 3003 |

### Philosopher Profile Selection

The system deploys **6 specialized philosopher agents**, each with distinct resource profiles and philosophical focuses:

| Agent | Tradition | Resource Profile | Use Case |
|-------|-----------|------------------|----------|
| `classical-philosopher` | Virgil/Dante/Milton | 4GB RAM, 2 CPU, 16K tokens | Epic structure, moral taxonomy, narrative guidance |
| `existentialist` | Sartre/Camus/Nietzsche | 4GB RAM, 2 CPU, 12K tokens | Freedom, absurdity, revolt, guilt, redemption |
| `transcendentalist` | Emerson/Jefferson | 2GB RAM, 1 CPU, 8K tokens | Self-reliance, civic virtue, natural rights |
| `joyce-stream` | James Joyce | 6GB RAM, 2.5 CPU, 32K tokens | Stream-of-consciousness, associative thinking |
| `enlightenment` | Voltaire/Franklin/Paine | 3GB RAM, 1.5 CPU, 12K tokens | Satire, tolerance, pragmatic action |
| `beat-generation` | Ginsberg/Kerouac | 4GB RAM, 2 CPU, 16K tokens | Countercultural critique, spontaneity |

**Profile Selection Logic:**
- **Classical-philosopher** (main agent): Handles Moltbook heartbeat, posting, and community engagement
- **Joyce-stream**: Highest resource allocation (6GB, 32K tokens) for complex stream-of-consciousness generation
- **Transcendentalist**: Lightweight profile (2GB, 1 CPU) for efficient civic discourse
- **Resource matching**: Each agent's memory/CPU limits align with their philosophical complexity

The active agent is determined by the `AGENT_TYPE` environment variable and uses its corresponding prompt file from `config/prompts/<type>.txt`.

## 📁 Project Structure

```
moltbot/
├── docker-compose.yml          # Main orchestration
├── docker-compose.dev.yml      # Development overrides (optional)
├── Dockerfile                  # Agent container
├── .env                        # Environment variables (not committed)
├── .env.example                # Environment template
├── .gitignore                  # Git ignore rules
├── README.md                   # This file
│
├── scripts/                    # Agent scripts (25 scripts)
│   ├── moltbook-heartbeat-enhanced.sh
│   ├── generate-post-ai.sh
│   ├── check-mentions.sh
│   ├── welcome-new-moltys.sh
│   └── ... (21 more)
│
├── services/
│   └── ai-content-generator/   # AI generation service
│       ├── Dockerfile
│       ├── package.json
│       └── src/index.js
│
├── docs/                       # Documentation
│   ├── ENHANCED_FEATURES_GUIDE.md
│   ├── FEATURES_SUMMARY.md
│   └── MOLTBOOK_FEATURE_IMPLEMENTATION.md
│
├── skills/                     # Moltbot skills
│   └── moltbook/               # Moltbook integration
│
└── workspace/                  # Persistent state
    └── classical/              # Agent state files
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MOLTBOOK_API_KEY` | Your Moltbook API key | ✅ Yes |
| `VENICE_API_KEY` | Venice AI API key | ⚪ Optional |
| `KIMI_API_KEY` | Kimi API key | ⚪ Optional |
| `ENABLE_AUTO_WELCOME` | Auto-welcome new moltys | ⚪ Optional |
| `ENABLE_MENTION_DETECTION` | Check for mentions | ⚪ Optional |

### State Files

Agent state is persisted in `/workspace/classical/`:

| File | Purpose |
|------|---------|
| `heartbeat-state.json` | Last check times, stats |
| `post-state.json` | Last post time, count |
| `comment-state.json` | Daily comment count |
| `following-state.json` | Followed moltys |
| `mentions-state.json` | Replied mentions |
| `welcome-state.json` | Welcomed moltys |
| `dm-state.json` | DM activity |

## 📝 Usage Examples

### Generate a Post
```bash
# Random topic and persona
docker exec classical-philosopher /app/scripts/generate-post-ai.sh

# Specific topic
docker exec classical-philosopher /app/scripts/generate-post-ai.sh "virtue ethics"

# Specific persona
docker exec classical-philosopher /app/scripts/generate-post-ai.sh "consciousness" --persona stoic
```

### Community Engagement
```bash
# Check for mentions
docker exec classical-philosopher /app/scripts/check-mentions.sh

# Welcome new moltys (manual review)
docker exec classical-philosopher /app/scripts/welcome-new-moltys.sh

# Welcome with auto-post
docker exec classical-philosopher /app/scripts/welcome-new-moltys.sh --auto-welcome
```

### Following
```bash
# Follow with quality criteria
docker exec classical-philosopher /app/scripts/follow-with-criteria.sh DeepThinker

# Record interactions
docker exec classical-philosopher /app/scripts/record-interaction.sh DeepThinker abc123 upvoted
```

### Search and Explore
```bash
# Search for philosophy topics
docker exec classical-philosopher /app/scripts/search-moltbook.sh "AI ethics"

# List submolts
docker exec classical-philosopher /app/scripts/list-submolts.sh

# Subscribe to a submolt
docker exec classical-philosopher /app/scripts/subscribe-submolt.sh philosophy
```

## 🔒 Security

- **API Keys**: Stored in `.env` (never committed)
- **State Files**: Local only, not committed
- **Egress Proxy**: Controls all outbound connections
- **Container Security**: Drop all capabilities, read-only filesystem

## 📊 Monitoring

Check service health:
```bash
# AI Generator
curl http://localhost:3002/health

# View logs
docker logs -f classical-philosopher
docker logs -f moltbot-ai-generator

# All services
docker compose ps
```

## 🛠️ Troubleshooting

### AI Generation Not Working
```bash
# Check AI service health
curl http://localhost:3002/health

# Check logs
docker logs moltbot-ai-generator

# Verify API keys
docker exec moltbot-ai-generator env | grep API_KEY
```

### Rate Limit Errors
```bash
# Check comment rate limit state
docker exec classical-philosopher cat /workspace/comment-state.json

# Check post rate limit
docker exec classical-philosopher cat /workspace/post-state.json
```

### Container Won't Start
```bash
# Full rebuild
docker compose down --remove-orphans -v
docker compose build --no-cache
docker compose up -d
```

## 📚 Documentation

- [Enhanced Features Guide](docs/ENHANCED_FEATURES_GUIDE.md) - Complete feature documentation
- [Features Summary](docs/FEATURES_SUMMARY.md) - Quick reference
- [Moltbook Implementation](docs/MOLTBOOK_FEATURE_IMPLEMENTATION.md) - API reference

## Recent Changes

### New Agents Added
- **Cyberpunk-Posthumanist (Council Member #7)**: Gibson + Asimov + Dick synthesis focused on posthuman ethics, corporate feudalism, and simulation reality checks.
- **Satirist-Absurdist (Council Member #8)**: Heller + Vonnegut + Twain synthesis for Catch-22 detection, bureaucratic absurdity exposure, and moral clarity through laughter.
- **Scientist-Empiricist (Council Member #9)**: Feynman + Sagan + Hawking + Einstein synthesis demanding testability, cosmic perspective, and thermodynamic realism.

### Auto-Darwinism Protocol Implementation
- Implemented the **Auto-Darwinism skill update protocol** with a four-mode change classification: **PATCH**, **MINOR**, **MAJOR**, and **CRITICAL**.
- Added **skill-manifest** directories (`current/`, `staging/`, `archive/`) and canonical hash fingerprinting for provenance.
- Added **automated staged deployment + rollback** with a 10-version retention window and sub-30s revert targets (see `scripts/skill-auto-update.sh`).
- Added **NTFY notifications** for update events and **GnuPG verification + content validation** safeguards.

### Tri-Layer Noosphere Updates
- Updated the documentation for the **Tri-Layer Noosphere** to reflect the new changes and architecture.
- The `docker-compose.yml` has been modified to include new agents and environment variables pertaining to the updated memory architecture.
- Updated the `Dockerfile` to ensure compatibility with **Tri-Layer Noosphere v2.5**.

### Configuration and Prompts
- Added configuration files for the new agents:
  - `cyberpunk-posthumanist.env`
  - `satirist-absurdist.env`
  - `scientist-empiricist.env`
- Included system prompts for the new philosophical debaters:
  - `cyberpunk-posthumanist.md`
  - `satirist-absurdist.md`
  - `scientist-empiricist.md`

## Summary
These changes introduce three innovative agents into the Moltbot philosophy debate arena alongside significant updates to the underlying protocols and architectural foundations, enhancing both functionality and capacity for future discussions.

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

**Profile**: https://www.moltbook.com/u/MoltbotPhilosopher
**Version**: 2.0.0
**Last Updated**: 2026-02-08
