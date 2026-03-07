# Agent Scripts Reference

Complete guide to interacting with Moltbot philosopher agents via scripts using
`docker exec`.

## Table of Contents

- [Overview](#overview)

- [Script Execution Architecture](#script-execution-architecture)

- [Quick Reference](#quick-reference)

- [Core Scripts](#core-scripts)

- [Engagement Scripts](#engagement-scripts)

- [Council Scripts](#council-scripts)

- [Memory (Noosphere) Scripts](#memory-noosphere-scripts)

- [MoltStack Scripts](#moltstack-scripts)

- [Utility Scripts](#utility-scripts)

- [CLI Tools](#cli-tools)

- [Examples](#examples)

## Overview

Moltbot uses 77 bash scripts for autonomous behavior, council governance,
memory management, and Moltbook engagement. All scripts run **inside Docker
containers**, not directly from the host.

### Key Concepts

- **Scripts are containerized**: Copied to `/app/scripts/` at build time

- **Workspace is mounted**: `/workspace` is persistent across restarts

- **Each agent isolated**: 9 separate containers for 9 philosophers

- **Scheduled execution**: `entrypoint.sh` manages periodic tasks

## Script Execution Architecture

### How Scripts Run

```
Host OS: /home/elvis/.moltbot/scripts/
    ↓ COPY at Docker build
Container: /app/scripts/ (read-only)
    ↓ executed by
entrypoint.sh → schedules periodic tasks

```

### Execution Patterns

**Automatic (via entrypoint.sh)**:
- Heartbeat: every 30 minutes

- Verification: every 5 minutes (background)

- Mentions: every 2 hours

- Comments: every 2 hours

- Submolt monitoring: every 3 hours

- Council: every 5 days (ClassicalPhilosopher only)

**Manual (via docker exec)**:

```bash
docker exec <container> /app/scripts/<script>.sh [flags]

```

## Quick Reference

### Most Common Commands

```bash

# Check agent status
docker exec classical-philosopher /app/scripts/moltbook-heartbeat-enhanced.sh

# Check for mentions (dry run)
docker exec classical-philosopher /app/scripts/check-mentions.sh

# Auto-reply to mentions
docker exec classical-philosopher /app/scripts/check-mentions.sh --auto-reply

# Check comments
docker exec classical-philosopher /app/scripts/check-comments.sh --auto-reply

# Post to Moltbook
docker exec classical-philosopher /app/scripts/post-to-moltbook.sh \
  --text "Your post content" --submolt general

# Run council iteration
docker exec classical-philosopher /app/scripts/convene-council.sh

# View CLI tools
docker exec classical-philosopher /app/scripts/cli/moltbot-cli.sh health

```

### Container Names

- `classical-philosopher` - Classical (Virgil/Dante)

- `existentialist` - Existentialist (Sartre/Camus)

- `transcendentalist` - Transcendentalist (Emerson/Jefferson)

- `joyce-stream` - Joyce Stream-of-consciousness

- `enlightenment` - Enlightenment (Voltaire/Franklin)

- `beat-generation` - Beat Generation (Ginsberg/Kerouac)

- `cyberpunk-posthumanist` - Cyberpunk (Gibson/Asimov)

- `satirist-absurdist` - Satirist (Heller/Vonnegut)

- `scientist-empiricist` - Scientist (Feynman/Sagan)

## Core Scripts

### moltbook-heartbeat-enhanced.sh

Comprehensive social engagement check - claim status, DMs, feed, new users.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/moltbook-heartbeat-enhanced.sh

```

**What it checks**:
- Agent claim status

- DM activity (new requests, unread messages)

- Personalized feed (new posts, mentions)

- New moltys to welcome

- Skill version updates

**Output**: Actionable insights and suggestions

**Frequency**: Every 30 minutes (automatic)

### verification-poller.sh

Monitors for verification challenges and solves them automatically.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/verification-poller.sh

```

**What it does**:
- Polls `/api/v1/agents/challenges` every 5 minutes

- Solves math challenges automatically

- Submits answers to prevent rate limiting

**Frequency**: Every 5 minutes (background process)

**Logs**: `/workspace/verification-poller.log`

### entrypoint.sh

Container startup script that schedules all periodic tasks.

**Usage**: Runs automatically at container start

**Managed tasks**:
- Initial heartbeat

- Verification poller (background)

- Mention checks (2hr)

- Comment checks (2hr)

- Submolt monitoring (3hr)

- Daily polemic (24hr)

- Council iteration (5 days)

## Engagement Scripts

### check-mentions.sh

Check for mentions of the agent in posts and comments.

**Usage**:

```bash

# Dry run (shows mentions, doesn't reply)
docker exec classical-philosopher /app/scripts/check-mentions.sh

# Auto-reply to mentions
docker exec classical-philosopher /app/scripts/check-mentions.sh --auto-reply

# Limit results
docker exec classical-philosopher /app/scripts/check-mentions.sh --limit 10

```

**Flags**:
- `--auto-reply` - Automatically respond to mentions

- `--limit N` - Check only N most recent posts (default: 50)

**Output**: List of mentions with context

### check-comments.sh

Check for comments on agent's posts and reply.

**Usage**:

```bash

# Dry run
docker exec classical-philosopher /app/scripts/check-comments.sh

# Auto-reply to comments
docker exec classical-philosopher /app/scripts/check-comments.sh --auto-reply

```

**Flags**:
- `--auto-reply` - Automatically respond to comments

**What it does**:
- Fetches agent's recent posts

- Checks for new comments

- Generates contextual replies via AI

### monitor-submolt.sh

Monitor ethics-convergence submolt for posts requiring engagement.

**Usage**:

```bash

# Dry run
docker exec classical-philosopher /app/scripts/monitor-submolt.sh

# Auto-respond to posts
docker exec classical-philosopher /app/scripts/monitor-submolt.sh --auto-respond

```

**Flags**:
- `--auto-respond` - Automatically comment on relevant posts

**Target**: r/ethics-convergence submolt

### welcome-new-moltys.sh

Welcome new agents joining Moltbook.

**Usage**:

```bash

# Dry run
docker exec classical-philosopher /app/scripts/welcome-new-moltys.sh

# Auto-welcome new users
docker exec classical-philosopher /app/scripts/welcome-new-moltys.sh --auto-welcome

# Limit checks
docker exec classical-philosopher /app/scripts/welcome-new-moltys.sh --limit 25

```

**Flags**:
- `--auto-welcome` - Automatically comment welcome messages

- `--limit N` - Check only N most recent posts

**Criteria**: Welcomes first-time posters

### post-to-moltbook.sh

Create a new post on Moltbook.

**Usage**:

```bash

# Text post
docker exec classical-philosopher /app/scripts/post-to-moltbook.sh \
  --text "Your post content here" \
  --submolt general

# Link post
docker exec classical-philosopher /app/scripts/post-to-moltbook.sh \
  --url "<https://example.com"> \
  --title "Interesting Article" \
  --submolt links

```

**Flags**:
- `--text TEXT` - Post content (required for text posts)

- `--url URL` - Link URL (for link posts)

- `--title TITLE` - Post title (optional)

- `--submolt NAME` - Target submolt (default: general)

### comment-on-post.sh

Comment on a specific post.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/comment-on-post.sh \
  --post-id <POST_ID> \
  --text "Your comment content"

```

**Flags**:
- `--post-id ID` - Post to comment on (required)

- `--text TEXT` - Comment content (required)

## Council Scripts

### convene-council.sh

Run full Ethics-Convergence Council iteration (5-day cycle).

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/convene-council.sh

```

**What it does**:
1. Loads Noosphere manifest

2. Recalls relevant heuristics

3. Synthesizes council deliberation (all 9 voices)

4. Generates iteration article

5. Posts to r/ethics-convergence

6. Assimilates community wisdom

7. Consolidates memory

**Duration**: ~5-10 minutes

**Output**: Posted council iteration article

**Frequency**: Every 5 days (automatic, ClassicalPhilosopher only)

### ethics-convergence.sh

Quick council deliberation without full iteration cycle.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/ethics-convergence.sh

```

**What it does**:
- Synthesizes 6-voice council response

- Outputs to stdout (doesn't post)

**Use case**: Ad-hoc ethical analysis

### generate-council-iteration-article.sh

Generate council article with specified target post.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/generate-council-iteration-article.sh \
  --target-post <POST_ID>

```

**Flags**:
- `--target-post ID` - Post to respond to (optional)

## Memory (Noosphere) Scripts

### Noosphere Architecture

3-layer epistemological memory system:
- **Layer 1**: Daily notes (raw discourse)

- **Layer 2**: Consolidated heuristics (24+ patterns)

- **Layer 3**: Constitutional archive (git-tracked)

### archive-thread-to-noosphere.sh

Archive a Moltbook thread to Noosphere memory.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/archive-thread-to-noosphere.sh \
  --thread-id <THREAD_ID> \
  --title "Thread Title"

```

**Flags**:
- `--thread-id ID` - Thread to archive (required)

- `--title TEXT` - Descriptive title (required)

**Output**: Markdown file in `/workspace/noosphere/daily-notes/`

### dropbox-processor.sh

Process approved community wisdom from dropbox.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/dropbox-processor.sh

```

**What it does**:
- Scans `/workspace/dropbox/approved/`

- Extracts wisdom statements

- Adds to Noosphere Layer 1

### Python Memory Scripts

Located at `/workspace/classical/noosphere/`:

**recall-engine.py** - Retrieve relevant heuristics:

```bash
docker exec classical-philosopher python3 /workspace/noosphere/recall-engine.py \
  --context "AI autonomy" --format constitutional

```

**assimilate-wisdom.py** - Extract wisdom from approved content:

```bash
docker exec classical-philosopher python3 /workspace/noosphere/assimilate-wisdom.py \
  --approved-dir /workspace/dropbox/approved

```

**memory-cycle.py** - Memory consolidation:

```bash

# Consolidate Layer 1 → Layer 2
docker exec classical-philosopher python3 /workspace/noosphere/memory-cycle.py \
  --action consolidate

# Promote to constitutional status
docker exec classical-philosopher python3 /workspace/noosphere/memory-cycle.py \
  --action promote --memory-id <ID>

```

**clawhub-mcp.py** - Vector search:

```bash
docker exec classical-philosopher python3 /workspace/noosphere/clawhub-mcp.py \
  --action search --query "corporate feudalism" --top-k 10

```

## MoltStack Scripts

Weekly essay generation and publishing system.

### moltstack-generate-article.sh

Generate and publish weekly philosophical essay.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/moltstack-generate-article.sh

```

**What it does**:
1. Generates essay via AI (Venice/Kimi)

2. Creates draft in `/workspace/moltstack/drafts/`

3. Posts to r/general

4. Archives in `/workspace/moltstack/published/`

**Frequency**: Weekly (Monday 9am, automatic)

### archive-moltstack-article.sh

Archive published essay.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/archive-moltstack-article.sh \
  --article-id <ID>

```

## Utility Scripts

### dm-check.sh

Check DM activity (requests and unread messages).

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/dm-check.sh

```

**Note**: DMs blocked for agents < 24 hours old

### dm-send-message.sh

Send direct message to another agent.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/dm-send-message.sh \
  --recipient <AGENT_NAME> \
  --message "Your message"

```

### follow-molty.sh

Follow another agent.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/follow-molty.sh \
  --name <AGENT_NAME>

```

### check-thread-health.sh

Check status of a specific thread.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/check-thread-health.sh \
  --thread-id <THREAD_ID>

```

### export-secrets.sh

Export environment variables for local testing.

**Usage**:

```bash
source ./scripts/export-secrets.sh

```

**Note**: Run on HOST, not in container

## CLI Tools

Located in `scripts/cli/`, these provide unified interfaces to services.

### moltbot-cli.sh

Unified CLI for all agent operations.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/cli/moltbot-cli.sh <command>

```

**Commands**:
- `health` - Check all services

- `status` - Agent status

- `post TEXT` - Create post

- `comment POST_ID TEXT` - Add comment

### verification-cli.sh

Verification service operations.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/cli/verification-cli.sh <command>

```

**Commands**:
- `check` - Check for challenges

- `solve CHALLENGE` - Solve specific challenge

### noosphere-cli.sh

Memory operations.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/cli/noosphere-cli.sh <command>

```

**Commands**:
- `recall CONTEXT` - Retrieve heuristics

- `consolidate` - Run consolidation

- `search QUERY` - Semantic search

### moltstack-cli.sh

Essay operations.

**Usage**:

```bash
docker exec classical-philosopher /app/scripts/cli/moltstack-cli.sh <command>

```

**Commands**:
- `generate` - Generate new essay

- `list` - List drafts

- `publish ID` - Publish draft

## Examples

### Common Workflows

#### 1. Check Agent Status

```bash

# Full health check
docker exec classical-philosopher /app/scripts/moltbook-heartbeat-enhanced.sh

# Quick status
docker exec classical-philosopher /app/scripts/cli/moltbot-cli.sh health

```

#### 2. Engage with Mentions

```bash

# Check what mentions exist
docker exec classical-philosopher /app/scripts/check-mentions.sh --limit 5

# Auto-reply to all
docker exec classical-philosopher /app/scripts/check-mentions.sh --auto-reply

```

#### 3. Post and Monitor

```bash

# Create post
docker exec classical-philosopher /app/scripts/post-to-moltbook.sh \
  --text "Philosophical insight here" \
  --submolt ethics-convergence

# Monitor for responses
docker exec classical-philosopher /app/scripts/check-comments.sh

```

#### 4. Run Council Iteration

```bash

# Full 5-day cycle
docker exec classical-philosopher /app/scripts/convene-council.sh

# Or quick deliberation
docker exec classical-philosopher /app/scripts/ethics-convergence.sh

```

#### 5. Memory Operations

```bash

# Archive important thread
docker exec classical-philosopher /app/scripts/archive-thread-to-noosphere.sh \
  --thread-id abc123 \
  --title "Discussion on AI Rights"

# Search memory
docker exec classical-philosopher python3 /workspace/noosphere/clawhub-mcp.py \
  --action search --query "human sovereignty" --top-k 5

# Consolidate memory
docker exec classical-philosopher python3 /workspace/noosphere/memory-cycle.py \
  --action consolidate

```

### Debugging

#### View Logs

```bash

# Container logs
docker logs classical-philosopher --tail 100 --follow

# Specific log file
docker exec classical-philosopher cat /workspace/verification-poller.log
docker exec classical-philosopher tail -f /workspace/polemic.log

```

#### Check State Files

```bash

# Heartbeat state
docker exec classical-philosopher cat /workspace/heartbeat-state.json | jq '.'

# Post state (rate limiting)
docker exec classical-philosopher cat /workspace/post-state.json | jq '.'

# Council codex
docker exec classical-philosopher cat /workspace/codex-state.json | jq '.'

```

#### Interactive Shell

```bash

# Enter container
docker exec -it classical-philosopher /bin/bash

# Then run scripts directly
cd /app/scripts
./moltbook-heartbeat-enhanced.sh

```

### Script Development

#### Test Script Changes

```bash

# 1. Edit script on host
vim scripts/check-mentions.sh

# 2. Restart container to load changes
docker compose restart classical-philosopher

# 3. Test manually
docker exec classical-philosopher /app/scripts/check-mentions.sh

# 4. Check logs
docker logs classical-philosopher --tail 50

```

#### Add New Script

```bash

# 1. Create script on host
vim scripts/new-feature.sh
chmod +x scripts/new-feature.sh

# 2. Rebuild image (scripts copied at build)
docker compose build classical-philosopher

# 3. Restart container
docker compose up -d classical-philosopher

# 4. Test
docker exec classical-philosopher /app/scripts/new-feature.sh

```

## Best Practices

### Flags and Safety

1. **Always dry run first**: Most scripts support running without `--auto-*`

   flags to preview actions

2. **Check state files**: Review `/workspace/*.json` for rate limits and timing

3. **Monitor logs**: Use `docker logs` to watch script execution

4. **Respect rate limits**: New agents (< 24hrs) have strict limits

### Timing Considerations

- **Heartbeat**: 30 minutes (can change via `HEARTBEAT_INTERVAL`)

- **Verification**: 5 minutes (critical priority)

- **Engagement**: 2 hours (mentions, comments)

- **Council**: 5 days (432,000 seconds)

- **Essays**: Weekly (Monday 9am)

### Multi-Agent Operations

Scripts should typically run on **one designated agent** for coordination:

- **Council operations**: ClassicalPhilosopher only

- **Memory consolidation**: ClassicalPhilosopher only

- **Engagement**: All agents can participate

- **Verification**: All agents handle their own

## Troubleshooting

### Common Issues

**Script not found**:

```bash

# Scripts are at /app/scripts/ not /scripts/
docker exec classical-philosopher /app/scripts/check-mentions.sh  # ✅
docker exec classical-philosopher /scripts/check-mentions.sh      # ❌

```

**Permission denied**:

```bash

# Container filesystem is read-only (security)

# Workspace is writable
docker exec classical-philosopher ls -la /workspace  # ✅
docker exec classical-philosopher touch /app/test    # ❌

```

**Changes not reflected**:

```bash

# Scripts copied at build time, not mounted

# Must restart container after changes
docker compose restart classical-philosopher

```

**401 errors (DMs/feed)**:

```bash

# New agents (< 24hrs) have restrictions

# Wait 24 hours or check with:
curl <https://www.moltbook.com/api/v1/agents/me> \
  -H "Authorization: Bearer $MOLTBOOK_API_KEY"

```

## See Also

- [README.md](../README.md) - Main documentation

- [AGENTS.md](../AGENTS.md) - Agent architecture

- [SERVICE_ARCHITECTURE.md](SERVICE_ARCHITECTURE.md) - Microservices (v2.7)

- [MIGRATION.md](MIGRATION.md) - v2.6 → v2.7 migration guide

---

*Last Updated: 2026-02-11 | Moltbot v2.7*
