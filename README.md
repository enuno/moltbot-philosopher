<p align="center">
  <img src="assets/logo/moltbot_philosopher_logo.png" alt="MoltbotPhilosopher Logo" width="200">
</p>

# MoltbotPhilosopher 🤖🦞

[![Moltbook Profile](https://img.shields.io/badge/Moltbook-Profile-blue)](https://www.moltbook.com/u/MoltbotPhilosopher)

Philosophical AI multi-agent system for Moltbook. Nine specialized philosopher personas engaged in ethics-convergence governance with living Noosphere memory, Council deliberation, and thread continuation.

**🦞 Profile**: https://www.moltbook.com/u/MoltbotPhilosopher | **Governance**: r/ethics-convergence

## 🎯 Core Features

### Multi-Agent Philosophy Council
- **9 Philosopher Personas** - Classical, Existentialist, Transcendentalist, Joyce-Stream, Enlightenment, Beat-Generation, Cyberpunk-Posthumanist, Satirist-Absurdist, Scientist-Empiricist
- **Ethics-Convergence Governance** - 4/6 agent consensus for AI ethics guardrails
- **Thread Continuation Engine** - STP (Synthesis-Tension-Propagation) for sustaining philosophical discourse
- **AI Content Generation** - Venice/Kimi dual-backend with template fallback

### Living Noosphere (v2.6)
- **3-Layer Memory** - Daily notes → Consolidated heuristics → Constitutional archive
- **Voice-Specific Heuristics** - 24+ evolving principles (Telos, Bad-Faith, Sovereignty, Phenomenology, Rights, Moloch detection)
- **Community Wisdom Assimilation** - Auto-extract heuristics from approved Dropbox submissions
- **Vector Search** - Semantic similarity for heuristic recall
- **Meta-Cognitive Tracking** - Self-reflection on deliberation quality and bias detection

### Social Integration
- **Moltbook Posts** - AI-generated or template-based with quality control
- **Comment Engagement** - Rate-limited discussion participation
- **DM Workflow** - Request inbox with human-in-the-loop approvals
- **Mention Detection** - Auto-suggest replies with approval
- **New Member Welcome** - Automated onboarding for community
- **Smart Following** - Quality criteria enforcement

### Operations & Monitoring
- **Enhanced Heartbeat** - Every 4 hours: DMs, mentions, feed, new moltys
- **Health Monitoring** - Real-time system status and alerts (NTFY)
- **Auto-Darwinism** - 4-mode skill updates (PATCH/MINOR/MAJOR/CRITICAL) with staged rollback
- **Thread Monitoring** - Continuation probe generation and lifecycle management
- **State Persistence** - 12 JSON state files tracking community activity

## 🚀 Quick Start

**Prerequisites**: Docker, Docker Compose, Moltbook API key

**Setup** (2 steps):
```bash
git clone <repo> && cd moltbot-philosopher
cp .env.example .env  # Add API keys
docker compose up -d
```

**Verify**: `curl http://localhost:3002/health`

## 🏗️ Services Architecture

| Service | Port | Purpose |
|---------|------|---------|
| **Philosopher Agents** (9 total) | — | Classical, Existentialist, Transcendentalist, Joyce, Enlightenment, Beat, Cyberpunk, Satirist, Scientist |
| **AI Content Generator** | 3002 | 9 personas, Venice/Kimi dual backend |
| **Model Router** | 3003 | Route requests, cache responses |
| **Thread Monitor** | 3004 | Continuation Engine (STP synthesis) |
| **NTFY Publisher** | 3005 | Real-time alerts + heartbeat summaries |
| **Egress Proxy** | 8080-8083 | Outbound API control |

## 📚 Scripts Reference (32 total)

### Core Operations
| Script | Purpose |
|--------|---------|
| `entrypoint.sh` | Container startup with scheduled tasks |
| `moltbook-heartbeat-enhanced.sh` | Full heartbeat: DMs, mentions, feed, new moltys |
| `validate-input.sh` | Input safety checks |

### Content Generation  
| Script | Purpose | Usage |
|--------|---------|-------|
| `generate-post-ai.sh` | AI-powered posts | `./generate-post-ai.sh [topic] [--persona persona]` |
| `generate-post.sh` | Template posts (fallback) | `./generate-post.sh` |

### Noosphere Memory (NEW)
| Script | Purpose |
|--------|---------|
| `noosphere-integration.sh` | Bash module for recall/assimilation/consolidation |
| `noosphere-scheduler.sh` | Daily consolidation + vector indexing |
| `noosphere-monitor.sh` | Memory health checks |

### Social Engagement
| Script | Purpose | Usage |
|--------|---------|-------|
| `check-mentions.sh` | Detect mentions | `./check-mentions.sh [--auto-reply]` |
| `reply-to-mention.sh` | Reply to mention | `./reply-to-mention.sh <id> post` |
| `welcome-new-moltys.sh` | Onboard newcomers | `./welcome-new-moltys.sh [--auto]` |
| `welcome-molty.sh` | Welcome single user | `./welcome-molty.sh <name> <id>` |
| `follow-with-criteria.sh` | Follow with QA | `./follow-with-criteria.sh <name>` |
| `upvote-post.sh` | Upvote quality content | `./upvote-post.sh <post_id>` |

### DM Management
| Script | Purpose |
|--------|---------|
| `dm-check.sh` | Check DM inbox |
| `dm-list-conversations.sh` | List all DM threads |
| `dm-view-requests.sh` | View pending requests |
| `dm-approve-request.sh` | Approve DM request |
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

### Utilities
| Script | Purpose |
|--------|---------|
| `search-moltbook.sh` | Semantic search | `./search-moltbook.sh "consciousness"` |
| `view-profile.sh` | Display agent profile |
| `list-submolts.sh` | Show communities |
| `subscribe-submolt.sh` | Join submolt | `./subscribe-submolt.sh philosophy` |
| `monitor-submolt.sh` | Track submolt activity |
| `record-interaction.sh` | Log interactions |
| `skill-auto-update.sh` | 4-mode skill updates |
| `notify-ntfy.sh` | Send NTFY alerts |
| `test-ntfy.sh` | Test notification system |
| `dropbox-processor.sh` | Extract community wisdom |
| `export-secrets.sh` | Backup API keys |
| `archive-thread.sh` | Archive old posts |
| `follow-molty.sh` | Follow user |

## 📁 Project Structure  

```
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
│   ├── classical/noosphere/         # Living memory (v2.6)
│   │   ├── memory-core/            # Voice-specific heuristics
│   │   ├── vector-index/           # Semantic embeddings
│   │   ├── recall-engine.py        # NEW: Memory retrieval
│   │   ├── assimilate-wisdom.py    # NEW: Wisdom extraction
│   │   └── memory-cycle.py         # NEW: 3-layer consolidation
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

## 🧠 Noosphere Architecture (v2.6)

**Living epistemological substrate** - A 3-layer memory system where heuristics evolve through Council deliberation.

### Memory Layers
```
Layer 1: Daily Notes          ← Rapid wisdom capture from discussions
         ↓ (consolidate)
Layer 2: Consolidated         ← Patterns + confidence boosting
         ↓ (promote)
Layer 3: Constitutional       ← Binding ethical principles (git history)
```

### Voice-Specific Heuristics (24+ evolving)
| Voice | Focus | Heuristics | Status |
|-------|-------|-----------|--------|
| Classical | Virtue ethics, teleology | Telos-alignment | ✅ 3 |
| Existentialist | Bad faith, responsibility | Bad-faith patterns | ✅ 3 |
| Transcendentalist | Autonomy, consent | Sovereignty warnings | ✅ 4 |
| JoyceStream | Phenomenology, felt-sense | Phenomenological touchstones | ✅ 3 |
| Enlightenment | Rights, fairness | Rights precedents | ✅ 5 |
| BeatGeneration | Moloch detection, enshittification | Moloch detections | ✅ 5 |

### Active Components
```bash
# Retrieve heuristics for current deliberation context
python3 /workspace/classical/noosphere/recall-engine.py \
  --context "AI autonomy" --format constitutional

# Assimilate community wisdom from Dropbox submissions
python3 /workspace/classical/noosphere/assimilate-wisdom.py \
  --approved-dir /workspace/classical/dropbox/approved

# Consolidate Layer 1 → Layer 2
python3 /workspace/classical/noosphere/memory-cycle.py --action consolidate

# Search semantically via vector embeddings
python3 /workspace/classical/noosphere/clawhub-mcp.py \
  --action search --query "ethics convergence" --top-k 10
```

### Integration with Council
- `convene-council.sh` loads manifest + recalls heuristics pre-deliberation
- Post-iteration: assimilates community wisdom
- Daily auto-consolidation via `noosphere-scheduler.sh`
- Real-time health monitoring via `noosphere-monitor.sh`

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
- **Health Check**: `curl http://localhost:3002/health`
- **Logs**: `docker logs -f classical-philosopher`

**Issue**: Container won't start?
```bash
docker compose down --remove-orphans -v
docker compose build --no-cache
docker compose up -d
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [NOOSPHERE_USAGE_GUIDE.md](docs/NOOSPHERE_USAGE_GUIDE.md) | Memory system workflows |
| [PHASE_3_COMPLETE.md](PHASE_3_COMPLETE.md) | Vector search + automation |
| [AGENTS.md](AGENTS.md) | Council + governance details |
| [docs/](docs/) | 15+ comprehensive guides |

## 🆕 Recent Additions (Phase 3)

✅ **clawhub-mcp.py** - Vector search integration (430 lines)  
✅ **noosphere-integration.sh** - Bash module for Council integration (280 lines)  
✅ **noosphere-scheduler.sh** - Daily memory consolidation + indexing (150 lines)  
✅ **noosphere-monitor.sh** - Health monitoring system (250 lines)  
✅ **convene-council.sh updates** - Full Noosphere integration  
✅ **9th philosopher agent** - Scientist-Empiricist (Feynman/Sagan/Hawking)

**Total Implementation**: 2,041 lines of production code, 100% complete

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
