# Phase 7.6: Semantic Search for Content Discovery - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Enable agents to automatically discover relevant philosophical content via semantic search integrated into heartbeat with 10-20 quality posts/day discovery rate.

**Architecture:** A modular discovery system that (1) maintains a philosophical keyword taxonomy across 5 epistemological categories, (2) executes semantic search queries every 30 minutes via heartbeat integration, (3) deduplicates results against historical seen-posts, (4) optimizes queries via A/B testing with negative keyword filtering, and (5) monitors engagement metrics with performance alerting.

**Tech Stack:** Bash (discovery script, heartbeat integration), Node.js + TypeScript (tests), Noosphere semantic search (0.7+ similarity), JSON state files (deduplication tracking), Docker (containerized execution).

---

## Testing Plan

I will implement Phase 7.6 using strict TDD with the following testing approach:

### Task 1-2 Tests: Keyword Taxonomy & State Management
- Unit test verifying keyword taxonomy loads with 50+ terms across 5 categories
- Test ensuring seen-posts.json initialization and updates
- Test checking deduplication logic filters known posts
- Test validating keyword category distribution (no bias toward single category)

### Task 3 Tests: Discovery Script Core
- Integration test executing discover-relevant-threads.sh with mocked Noosphere responses
- Test verifying script returns 10 posts maximum per execution
- Test checking similarity threshold enforcement (0.7 minimum)
- Test validating JSON output structure and required fields

### Task 4 Tests: Heartbeat Integration
- Test verifying heartbeat calls discovery script every 30 minutes
- Test checking discovery execution doesn't block heartbeat completion
- Test ensuring discovery errors don't crash heartbeat
- Test validating discovery results appear in post queue for agents

### Task 5 Tests: Query Optimization & Monitoring
- A/B test comparing baseline queries vs negative keyword filtered queries
- Test measuring discovery latency (<3s requirement)
- Test tracking engagement rate with discovered posts (>25% target)
- Test validating alerting triggers when discovery rate drops below 10 posts/day

### Integration Testing
- End-to-end test: Run complete heartbeat → discovery → deduplication → queue flow
- Test validating discovered posts appear in agent engagement pipeline
- Test checking monitoring dashboard metrics update correctly

NOTE: I will write *all* tests before I add any implementation behavior. Tests will exercise the full discovery pipeline from keyword taxonomy through monitoring, treating the system as a blackbox.

---

## Task 1: Create Philosophical Keyword Taxonomy

**Files:**
- Create: `services/discovery-service/src/keyword-taxonomy.json`
- Create: `services/discovery-service/src/taxonomy-loader.js`
- Create: `services/discovery-service/tests/taxonomy-loader.test.js`

**Steps:** 
1. Write failing tests for taxonomy loading
2. Create taxonomy.json with 50+ keywords across 5 categories
3. Implement taxonomy-loader.js with validation functions
4. Verify all tests pass
5. Commit changes

---

## Task 2: Create Seen-Posts Deduplication State

**Files:**
- Create: `services/discovery-service/src/seen-posts-manager.js`
- Create: `services/discovery-service/tests/seen-posts-manager.test.js`

**Steps:**
1. Write failing tests for deduplication
2. Implement seen-posts-manager with add/check/prune functions
3. Support 30-day TTL and concurrent read safety
4. Verify all tests pass
5. Commit changes

---

## Task 3: Create Discovery Script Core

**Files:**
- Create: `scripts/discover-relevant-threads.sh`
- Create: `services/discovery-service/tests/discover-script.test.js`

**Steps:**
1. Write integration tests for discovery script
2. Implement bash script with Noosphere integration
3. Support dry-run mode for testing
4. Enforce 0.7 similarity threshold and max 10 posts
5. Track execution time (<3s target)
6. Verify all tests pass
7. Commit changes

---

## Task 4: Integrate Discovery into Heartbeat

**Files:**
- Modify: `scripts/daily-polemic-heartbeat.sh`
- Modify: `workspace/*/classical/skill-manifest/current/HEARTBEAT.md`
- Create: `services/discovery-service/tests/heartbeat-integration.test.js`

**Steps:**
1. Write tests for heartbeat integration
2. Add discovery execution every 30 minutes to heartbeat
3. Ensure non-blocking execution (errors logged, heartbeat continues)
4. Queue discovered posts for agent engagement
5. Update HEARTBEAT.md documentation
6. Verify all tests pass
7. Commit changes

---

## Task 5: Query Optimization & Monitoring

**Files:**
- Create: `services/discovery-service/src/query-optimizer.js`
- Create: `services/discovery-service/src/discovery-monitor.js`
- Create: `services/discovery-service/tests/query-optimization.test.js`
- Create: `workspace/discovery/metrics-dashboard.json`

**Steps:**
1. Write tests for query optimization
2. Implement query-optimizer with negative keyword filtering
3. Add A/B testing analysis framework
4. Implement discovery-monitor tracking engagement rate
5. Create alerting for <10 posts/day and <25% engagement
6. Create metrics dashboard JSON
7. Verify all tests pass
8. Commit changes

---

## Task 6: Update Documentation

**Files:**
- Create: `docs/DISCOVERY_ARCHITECTURE.md`
- Modify: `DEVELOPMENT_PLAN.md`
- Modify: `README.md`

**Steps:**
1. Create comprehensive DISCOVERY_ARCHITECTURE.md
2. Update DEVELOPMENT_PLAN.md with completion status
3. Add discovery features to README.md
4. Include success metrics and usage instructions
5. Commit all documentation changes

---

**Testing Details**

All tasks implement strict TDD:
- 26+ unit and integration tests covering all critical paths
- Tests verify behavior not implementation (blackbox approach)
- Tests validate keyword distribution, deduplication, latency, engagement metrics
- Integration tests verify end-to-end heartbeat + discovery + queue flow

**Implementation Details**

- **Keyword Taxonomy**: JSON-based, 50+ terms, 5 categories, balanced distribution
- **Deduplication**: JSON state file, postId → timestamp tracking, 30-day TTL
- **Discovery Script**: Bash, Noosphere integration, <3s execution
- **Heartbeat Integration**: Non-blocking, queues results to agent pipeline
- **Query Optimizer**: Negative keyword filtering (crypto, trading, investment)
- **Monitoring**: JSON metrics, alerting thresholds, dashboard config
- **Commits**: After each task, descriptive messages, atomic changes

**Questions**

1. Should deduplication window be configurable (currently 30 days fixed)?
2. Should A/B testing results automatically adjust query strategy?
3. Should discovery coordinate with Phase 7.5 trending topics?
4. Should engagement rate >25% be per-agent or aggregate?

---
