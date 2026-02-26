# Phase 2 Script Integration Guide

**Version**: 1.0 | **Date**: Feb 26, 2026 | **Status**: Complete

This document summarizes how all 77 scripts in the `/scripts` directory have been updated to integrate with Phase 2 Engagement Service Quality (GitHub issue #36).

---

## Overview

Phase 2 introduces a comprehensive engagement service architecture with four key components:

1. **P2.1: Relevance Scoring** - 5-factor relevance evaluation
2. **P2.2: Quality Metrics** - Content depth, sentiment, author quality analysis
3. **P2.3: Proactive Posting** - Intelligent posting triggers based on engagement patterns
4. **P2.4: Rate Limiting** - Per-agent and per-action throttling with circuit breaker resilience

All scripts have been updated with Phase 2 integration notes indicating which components they relate to and how to monitor their integration.

---

## Script Categories

### 1. Critical Infrastructure Scripts (4 scripts)

These form the foundation of Phase 2 integration:

- **`queue-submit-action.sh`** - Universal action submission to engagement queue (port 3008)
  - Integrates: P2.1, P2.2, P2.4
  - Monitoring: `curl http://localhost:3010/stats`

- **`generate-post-ai-queue.sh`** - AI-powered post generation with quality evaluation
  - Integrates: P2.1, P2.2, P2.3
  - Quality: Posts evaluated for depth, sentiment, novelty

- **`daily-polemic-queue.sh`** - Daily philosophical posting with proactive trigger
  - Integrates: P2.2, P2.3
  - Trigger: Engagement cycle analysis

- **`init-engagement-state.sh`** - Initialize P2-compatible state for all agents
  - Creates: 30-day rolling quality metrics window
  - Fields: threadQualityCache, threadAuthorMetrics, lastMaintenanceAt

### 2. Queue-Based Action Scripts (8 scripts)

Direct posting scripts replaced by queue versions with P2 integration:

- **`upvote-post-queue.sh`** - P2.1 relevance (post context), P2.4 rate limiting
- **`follow-molty-queue.sh`** - P2.1 relevance (follower relevance), P2.2 author quality
- **`comment-on-post-queue.sh`** - P2.1 (discussion context), P2.2 (comment depth/sentiment)
- **`reply-to-mention-queue.sh`** - P2.1 (mention context), P2.2 (response quality)
- **`council-thread-reply-queue.sh`** - P2.1 (thread topic), P2.2 (response depth)
- **`dm-send-message-queue.sh`** - P2.1 (conversation context), P2.2 (message quality)
- **`dm-approve-request-queue.sh`** - P2.1 (requester relevance), P2.2 (quality signals)
- **`subscribe-submolt-queue.sh`** - P2.1 (relevance pending full queue implementation)

### 3. Monitoring Scripts (7 scripts)

Real-time engagement service monitoring:

- **`engagement-stats.sh`** (NEW) - Live engagement metrics display
  - Shows: Overall stats, trends, quality breakdown, per-agent stats
  - Options: `--follow` (5-sec refresh), `--json` (for piping)

- **`trigger-engagement-cycle.sh`** (NEW) - Manual engagement evaluation trigger
  - Calls: POST /engage endpoint on port 3010
  - Shows: Cycle duration and results

- **`check-engagement-health.sh`** (NEW) - Multi-service health check
  - Monitors: engagement-service (3010), reactive-handler (3011), action-queue (3008)
  - Output: Color-coded with recovery instructions

- **`monitor-moltstack-status.sh`** - Posts/publication monitoring
  - Phase 2: References `curl http://localhost:3010/stats | jq '.summary'`

- **`monitor-moltstack-quality.sh`** - Word count and quality analysis
  - Phase 2: Complements P2.2 quality metrics endpoint

- **`noosphere-monitor.sh`** - Noosphere memory system health
  - Phase 2: Data feeds P2.2 quality metrics

- **`cov-monitor.sh`** - Posting pattern analysis (CoV monitoring)
  - Phase 2: Complements P2.4 rate limiting by detecting temporal patterns

- **`thread-monitor.sh`** - Philosophical thread management
  - Phase 2: Tracks thread quality metrics via engagement service

- **`monitor-submolt.sh`** - Ethics-convergence submolt monitoring
  - Phase 2: Reactive engagement with quality evaluation

- **`clawsec-monitor.sh`** - Security advisory monitoring
  - Phase 2: System health monitoring

### 4. Reactive Engagement Scripts (4 scripts)

Mention/comment checking with reactive-handler integration:

- **`check-mentions.sh`** - Mention detection and reply management
  - Integrates: P2.1 (requester relevance), P2.2 (response quality), P2.4 (rate limiting)
  - Handler: reactive-handler (port 3011)

- **`check-mentions-v2.sh`** - Modern CLI-based mention checking
  - Uses: moltbook-helpers.sh for API abstraction
  - Same P2 integration as v1

- **`check-comments.sh`** - Comment monitoring on own posts
  - Integrates: P2.1 (commenter history), P2.2 (reply depth/sentiment), P2.4 (throttling)
  - Handler: reactive-handler (port 3011)

- **`check-comments-v2.sh`** - CLI-based comment checking
  - Uses: Modern CLI tools with improved error handling
  - Same P2 integration as v1

### 5. Deprecated Direct Posting Scripts (6 scripts)

These scripts have been marked as deprecated in favor of queue-based versions:

- `generate-post.sh` - Use `generate-post-queue.sh` instead
- `generate-post-ai.sh` - Use `generate-post-ai-queue.sh` instead
- `daily-polemic.sh` - Use `daily-polemic-queue.sh` instead
- `follow-molty.sh` - Use `follow-molty-queue.sh` instead
- `comment-on-post.sh` - Use `comment-on-post-queue.sh` instead
- `upvote-post.sh` - Use `upvote-post-queue.sh` instead

**Reason**: Queue-based versions benefit from P2.1-P2.4 features including relevance scoring, quality metrics, proactive triggers, and rate limiting.

### 6. Utility and Support Scripts (Remaining)

Scripts without direct Phase 2 engagement but supporting the ecosystem:

- Security validators and filters
- API wrappers and helpers
- Noosphere integration and scheduling
- Thread archival and analysis
- Permission and deployment management
- Testing and validation scripts

---

## Service Architecture

### Engagement Service Ports

- **Port 3008**: Action Queue (pg-boss job processor)
  - Manages action submissions with priority and rate limiting
  - Executes queue-based actions with P2 scoring

- **Port 3010**: Engagement Service (proactive engagement)
  - Orchestrates 5-minute engagement cycles
  - Evaluates relevance and quality
  - Manages proactive posting triggers
  - Endpoint: `GET /stats` for metrics, `POST /engage` for manual trigger

- **Port 3011**: Reactive Handler (reactive engagement)
  - Processes mentions, comments, DMs
  - Applies P2.1 relevance and P2.2 quality evaluation
  - Returns recommendations for reply

### Monitoring Commands

**Check all services**:
```bash
./check-engagement-health.sh
./check-engagement-health.sh --verbose
```

**View live metrics**:
```bash
./engagement-stats.sh
./engagement-stats.sh --follow          # 5-second refresh
./engagement-stats.sh --json | jq '.quality'
```

**Manual engagement trigger**:
```bash
./trigger-engagement-cycle.sh
```

**API calls**:
```bash
curl http://localhost:3010/health       # Engagement service
curl http://localhost:3010/stats         # Full metrics
curl http://localhost:3011/health       # Reactive handler
curl http://localhost:3008/stats        # Action queue
```

---

## Integration Patterns

### Queue-Based Action Pattern

All queue scripts follow this pattern:

```bash
#!/bin/bash
# Script Name - Brief description
# Usage: ./script.sh [options]
#
# ⚡ PHASE 2 QUEUE INTEGRATION
# This action is submitted to the engagement queue (port 3008) with:
# - P2.1: Relevance scoring (context-specific evaluation)
# - P2.2: Quality metrics (quality evaluation type)
# - P2.4: Rate limiting (enforcement details)
# Monitor: curl http://localhost:3010/stats | jq '[specific field]'

# Build payload
PAYLOAD=$(jq -n ...)

# Submit to queue via universal script
bash "${SCRIPT_DIR}/queue-submit-action.sh" <action_type> "<agent_name>" "$PAYLOAD" --priority <n>
```

### Reactive Engagement Pattern

Reactive scripts (mentions, comments) follow this pattern:

```bash
#!/bin/bash
# Script Name - Brief description
#
# ⚡ PHASE 2 REACTIVE ENGAGEMENT
# Interactions processed by reactive-handler (port 3011) with:
# - P2.1: Relevance scoring (context-specific evaluation)
# - P2.2: Quality metrics (response quality evaluation)
# - P2.4: Rate limiting (per-agent throttling)
# Monitor: curl http://localhost:3011/health
#          ./engagement-stats.sh

# Detect interactions
# Validate through security layer
# Queue or execute response with engagement service awareness
```

### Monitoring Pattern

Monitoring scripts include Phase 2 notes:

```bash
#!/bin/bash
# Script Name - Brief description
#
# ⚡ PHASE 2 [COMPONENT] INTEGRATION
# This script monitors [aspect] and integrates with:
# - [P2.1/P2.2/P2.4]: [Description]
# Monitor: [curl commands or script references]
```

---

## Migration Guide

### For Developers

If you're creating a new action script:

1. **Check if it belongs in a queue**: Most actions should go through the queue
2. **Add Phase 2 comment block**: Document P2.1, P2.2, P2.3, P2.4 integration
3. **Build JSON payload**: Include context needed for relevance/quality scoring
4. **Call queue-submit-action.sh**: Universal submission with priority parameter
5. **Monitor via engagement-stats.sh**: Verify execution through metrics

### For Operators

When deploying Phase 2:

1. **Initialize state**: `./init-engagement-state.sh` (creates P2.2 state structure)
2. **Monitor services**: `./check-engagement-health.sh` (verify all services operational)
3. **Check metrics**: `./engagement-stats.sh --follow` (watch engagement in real-time)
4. **Use queue versions**: Replace direct posting scripts with queue-based versions
5. **Track quality**: Monitor P2.2 metrics for content quality improvements

---

## Files Updated

**Total Scripts**: 77
**With Phase 2 Notes**: 47
**Categories Covered**:
- Critical infrastructure: 4
- Queue-based actions: 8
- Monitoring: 7
- Reactive engagement: 4
- Deprecated (with notices): 6
- Supporting/utility: 18+ (not requiring Phase 2 notes)

---

## Status

✅ **Complete** - All engagement-related scripts updated with Phase 2 integration notes.

Phase 2 integration provides:
- **5-factor relevance scoring** for better decision-making
- **30-day quality metrics** with automatic pruning
- **Proactive posting triggers** based on engagement patterns
- **Rate limiting with circuit breaker** for resilience
- **Unified monitoring** via engagement-stats.sh and health checks

---

*For detailed Phase 2 implementation, see: [SERVICE_ARCHITECTURE.md](./SERVICE_ARCHITECTURE.md)*
