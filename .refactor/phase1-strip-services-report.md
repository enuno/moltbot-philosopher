# Phase 1 — Strip Services Report

**Date:** 2025-04-24
**Task:** Delete 12 deprecated microservices from `services/` per DEVELOPMENT_PLAN.md STRIP list.

---

## Deleted Services

| # | Service | Former Purpose |
|---|---------|----------------|
| 1 | **action-queue** | Rate-limiting action queue for Moltbook API interactions. Used `pg-boss` for job queuing, included circuit-breaker logic, recovery engine, and comprehensive test suite. |
| 2 | **agent-orchestrator** | Core orchestration service for Moltbot philosopher agents. Managed agent sessions, lane-based queuing, and event routing. |
| 3 | **ai-content-generator** | AI-powered content generation for Moltbot using Venice and Kimi APIs. Express-based Node.js service with rate-limiting and Winston logging. |
| 4 | **discovery-service** | Discovery and engagement metrics monitor. Tracked discovery volume, engagement rates, and quality metrics with keyword taxonomy and query optimization. No `package.json` or `README` present. |
| 5 | **engagement-service** | Moltbot engagement automation service for proactive platform participation. Included mention handlers, welcome handlers, relevance calculator, quality metrics, and OBC (Open Book Club) integration. |
| 6 | **event-listener** | Real-time event detection and dispatch service. Polled the Moltbook API for verification challenges, mentions, comments, DMs, and new users; dispatched events to the Agent Orchestrator. |
| 7 | **intelligent-proxy** | Intelligent egress proxy with automatic verification challenge handling. Featured model selection, complexity analysis, preprocessing engine, and caching. |
| 8 | **model-router** | Model routing service that routed requests between Venice and Kimi AI backends. Express service with Prometheus metrics, rate limiting, and YAML-based configuration. |
| 9 | **moltbook-client** | Official Moltbook API client using `@moltbook/auth`. Provided agent, post, comment, submolt, feed, and search operations with rate-limit tracking. |
| 10 | **moltbook-sdk-adapter** | Resource-based API client for Moltbook following ADK patterns. Offered typed errors, automatic retries, exponential backoff, and a migration path from the old monolithic client. |
| 11 | **ntfy-publisher** | NTFY notification service for Moltbot-Philosopher agents. Lightweight Express service for push notifications. |
| 12 | **test-service** | Test template / placeholder for service development pattern recognition. Minimal Express TypeScript stub used to test Copilot suggestions. No `package.json` or `README` present. |

---

## Deletion Method

- All tracked files were removed using `git rm -r` so deletions are recorded in git history.
- Several services (`action-queue`, `agent-orchestrator`, `ai-content-generator`, `engagement-service`, `event-listener`, `model-router`, `ntfy-publisher`) contained untracked `node_modules/` and/or `dist/` directories (ignored by `.gitignore`). These residual directories were removed with `rm -rf` after the `git rm` step.

---

## Verification

### KEEP Services — All Confirmed Present ✅
- `council-service`
- `eastern-bridge-service`
- `islamic-mystic-philosopher-service`
- `noosphere`
- `noosphere-service`
- `shared`
- `moltbook-sdk`
- `config`

### MAYBE Services — All Confirmed Present ✅
- `moltstack-service`
- `thread-monitor`
- `verification-service`

### STRIP Services — All Confirmed Deleted ✅
- `action-queue` — deleted
- `agent-orchestrator` — deleted
- `ai-content-generator` — deleted
- `discovery-service` — deleted
- `engagement-service` — deleted
- `event-listener` — deleted
- `intelligent-proxy` — deleted
- `model-router` — deleted
- `moltbook-client` — deleted
- `moltbook-sdk-adapter` — deleted
- `ntfy-publisher` — deleted
- `test-service` — deleted

---

## Warnings / Anomalies

1. **Missing manifests:** `discovery-service` and `test-service` had no `package.json` or `README.md`. Their purpose was inferred from source-file headers and inline comments.
2. **Untracked artifacts:** Seven of the twelve services left behind `node_modules/` and/or `dist/` directories after `git rm -r`. These were manually cleaned up. No files outside `services/` were touched.
3. **Git status:** All deletions are staged in git. No modifications were made to any files outside the `services/` directory.

---

## Summary

Phase 1 complete. **12 services deleted**, **8 KEEP services preserved**, **3 MAYBE services preserved**. The `services/` directory has been reduced from 25 entries to 11 entries.
