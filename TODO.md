# Action Queue Service - Implementation TODO

**Feature**: Action Queue & Rate Limiting Service (Feature G)
**Status**: 🚧 In Development
**Start Date**: 2026-02-13
**Target Version**: v2.7
**Owner**: Development Team

---

## Overview

Middleware service to enforce Moltbook rate limits, prevent API abuse, and
provide scheduled action execution. Prevents account suspension by controlling
API request frequency.

**Reference**: `DEVELOPMENT_PLAN.md` - Feature G

---

## Phase 1: Core Service Implementation

**Target**: Week 1 - Foundation
**Status**: 🚧 In Progress

### 1.1 Project Setup

- [x] Create service directory structure
- [x] Initialize package.json with dependencies
- [x] Configure TypeScript (tsconfig.json)
- [x] Define types and interfaces (types.ts)
- [x] Define rate limit configurations (config.ts)
- [ ] Set up ESLint and Prettier
- [ ] Configure Jest for testing
- [ ] Create .dockerignore and .gitignore

### 1.2 Database Layer

- [ ] Design SQLite schema
- [ ] Create database.ts with initialization logic
- [ ] Implement action CRUD operations
- [ ] Implement rate limit tracking queries
- [ ] Implement agent profile management
- [ ] Add database migrations support
- [ ] Write database unit tests

**Files**:

- `src/database.ts` - SQLite operations
- `src/migrations/` - Schema migrations

### 1.3 Rate Limiter Engine

- [ ] Implement rate limit checker logic
- [ ] Add per-action-type rate limiting
- [ ] Add daily limit enforcement
- [ ] Add global API throttling (100 req/min)
- [ ] Implement new agent detection
- [ ] Add rate limit reset logic
- [ ] Write rate limiter unit tests

**Files**:

- `src/rate-limiter.ts` - Core rate limiting logic
- `tests/rate-limiter.test.ts` - Unit tests

### 1.4 Queue Processor

- [ ] Implement queue processing loop
- [ ] Add action priority sorting
- [ ] Implement eligibility checking
- [ ] Add concurrent action handling
- [ ] Implement queue statistics
- [ ] Add graceful shutdown handling
- [ ] Write processor unit tests

**Files**:

- `src/queue-processor.ts` - Queue processing engine
- `tests/queue-processor.test.ts` - Unit tests

### 1.5 Action Executor

- [ ] Create Moltbook API client
- [ ] Implement action type handlers
  - [ ] POST action
  - [ ] COMMENT action
  - [ ] UPVOTE/DOWNVOTE actions
  - [ ] FOLLOW/UNFOLLOW actions
  - [ ] CREATE_SUBMOLT action
  - [ ] SEND_DM action
  - [ ] SKILL_UPDATE action
- [ ] Add HTTP error handling
- [ ] Implement retry logic with exponential backoff
- [ ] Add response parsing
- [ ] Write executor unit tests

**Files**:

- `src/action-executor.ts` - Moltbook API client
- `tests/action-executor.test.ts` - Unit tests

### 1.6 HTTP API Server

- [ ] Set up Express.js server
- [ ] Implement routes
  - [ ] POST /actions - Submit action
  - [ ] GET /actions/:id - Get action status
  - [ ] DELETE /actions/:id - Cancel action
  - [ ] GET /actions - List actions (with filters)
  - [ ] GET /queue/stats - Queue statistics
  - [ ] GET /queue/health - Health check
  - [ ] GET /rate-limits/:agent - Rate limit status
- [ ] Add request validation middleware (Zod)
- [ ] Add error handling middleware
- [ ] Add request logging
- [ ] Write API integration tests

**Files**:

- `src/index.ts` - Main server entry point
- `src/api/routes.ts` - Route definitions
- `src/api/handlers.ts` - Request handlers
- `src/api/middleware.ts` - Validation & auth
- `tests/api.test.ts` - Integration tests

---

## Phase 2: Integration & Deployment

**Target**: Week 2 - Integration
**Status**: ⏳ Pending

### 2.1 Containerization

- [ ] Create Dockerfile
- [ ] Configure multi-stage build
- [ ] Set up health check
- [ ] Optimize image size
- [ ] Test container build

**Files**:

- `services/action-queue/Dockerfile`
- `.dockerignore`

### 2.2 Docker Compose Integration

- [ ] Add action-queue service to docker-compose.yml
- [ ] Configure port mapping (3006)
- [ ] Add volume for SQLite database
- [ ] Configure service dependencies
- [ ] Add health check configuration
- [ ] Test docker-compose up

**Files**:

- `docker-compose.yml` - Add action-queue service

### 2.3 Script Migration

Update bash scripts to use queue API instead of direct Moltbook API:

- [ ] Create queue API client wrapper script
  - `scripts/queue-submit-action.sh`
- [ ] Update heartbeat script
  - `scripts/moltbook-heartbeat-enhanced.sh`
- [ ] Update welcome script
  - `scripts/welcome-new-moltys.sh`
- [ ] Update follow scripts
  - `scripts/follow-molty.sh`
  - `scripts/follow-with-criteria.sh`
- [ ] Update comment script
  - `scripts/comment-on-post.sh`
- [ ] Update post creation scripts
- [ ] Update pending actions processor
  - `scripts/process-pending-actions.sh`
- [ ] Test all updated scripts

### 2.4 CLI Tools

- [ ] Create queue management CLI
  - `scripts/queue-cli.sh`
- [ ] Add commands:
  - [ ] `queue-cli.sh status` - View queue status
  - [ ] `queue-cli.sh list` - List pending actions
  - [ ] `queue-cli.sh cancel <id>` - Cancel action
  - [ ] `queue-cli.sh stats` - Queue statistics
  - [ ] `queue-cli.sh rate-limits <agent>` - View rate limits
  - [ ] `queue-cli.sh submit` - Submit action (with args)
- [ ] Add help documentation
- [ ] Test CLI commands

**Files**:

- `scripts/queue-cli.sh` - CLI wrapper
- `docs/QUEUE_CLI.md` - CLI documentation

### 2.5 Integration Testing

- [ ] Write end-to-end test suite
- [ ] Test rate limit enforcement
- [ ] Test queue processing
- [ ] Test failure recovery
- [ ] Test container orchestration
- [ ] Load testing (simulate high volume)

**Files**:

- `tests/integration/` - Integration test suite
- `tests/load/` - Load testing scripts

---

## Phase 3: Advanced Features

**Target**: Week 3 - Enhancements
**Status**: ⏳ Pending

### 3.1 Scheduled Actions

- [ ] Implement scheduled action storage
- [ ] Create scheduler service
- [ ] Add cron-like scheduling support
- [ ] Implement scheduled action activation
- [ ] Add recurring action support (optional)
- [ ] Write scheduler tests

**Files**:

- `src/scheduler.ts` - Scheduled action handler
- `tests/scheduler.test.ts` - Unit tests

### 3.2 Conditional Logic System ⭐ NEW

- [x] Design condition type system
- [x] Create TypeScript types for conditions
- [x] Implement condition evaluator engine
- [ ] Add condition evaluation to queue processor
- [ ] Implement condition check loop
- [ ] Add condition timeout handling
- [ ] Store condition evaluations in database
- [ ] Add condition status to API responses
- [ ] Write conditional logic tests
  - [ ] Test AND/OR/NOT operators
  - [ ] Test time-based conditions
  - [ ] Test account status checks
  - [ ] Test action dependencies
  - [ ] Test API check conditions
  - [ ] Test custom script conditions
- [ ] Document conditional logic usage

**Files**:

- `src/types.ts` - Condition types (DONE)
- `src/condition-evaluator.ts` - Evaluator engine (DONE)
- `src/condition-processor.ts` - Background checker
- `tests/conditions.test.ts` - Unit tests
- `docs/CONDITIONAL_ACTIONS.md` - Usage guide

**Condition Types Implemented**:

- ✅ TIME_AFTER - Execute after timestamp
- ✅ TIME_BEFORE - Execute before deadline
- ✅ TIME_BETWEEN - Execute in time window
- ✅ ACCOUNT_ACTIVE - Account not suspended
- ✅ ACTION_COMPLETED - Wait for action
- ✅ KARMA_THRESHOLD - Karma range check
- ✅ FOLLOWER_COUNT - Follower threshold
- ✅ POST_ENGAGEMENT - Engagement metrics
- ✅ API_CHECK - External API validation
- ✅ RATE_LIMIT_AVAILABLE - Rate limit check
- ✅ CUSTOM - External script execution

**Example Use Cases**:

- Follow user when suspension lifts AND time passed
- Post comment only if previous post got engagement
- Schedule posts during peak hours only
- Wait for previous action to complete
- Chain multiple dependent actions

### 3.3 Priority Queue

- [ ] Implement priority-based sorting
- [ ] Add priority levels (LOW, NORMAL, HIGH, CRITICAL)
- [ ] Ensure high-priority actions processed first
- [ ] Add priority override capability
- [ ] Test priority handling

### 3.3 Retry & Recovery

- [ ] Implement exponential backoff
- [ ] Add configurable max retry attempts
- [ ] Handle transient failures (5xx errors)
- [ ] Add dead letter queue for permanent failures
- [ ] Implement manual retry trigger
- [ ] Test failure scenarios

### 3.4 Monitoring & Observability

- [ ] Add structured logging (JSON)
- [ ] Implement metrics collection
  - [ ] Queue depth
  - [ ] Processing rate
  - [ ] Error rate
  - [ ] Rate limit hits
- [ ] Create monitoring dashboard endpoint
- [ ] Add alerting webhooks (NTFY integration)
- [ ] Create operational runbooks

**Files**:

- `src/monitoring.ts` - Metrics & logging
- `docs/RUNBOOK.md` - Operational guide

---

## Phase 4: Documentation & Deployment

**Target**: Week 4 - Production Ready
**Status**: ⏳ Pending

### 4.1 API Documentation

- [ ] Write comprehensive API reference
- [ ] Add request/response examples
- [ ] Document error codes
- [ ] Add rate limit documentation
- [ ] Create API usage guide
- [ ] Generate OpenAPI/Swagger spec

**Files**:

- `services/action-queue/README.md` - Main documentation
- `docs/ACTION_QUEUE_API.md` - API reference
- `docs/ACTION_QUEUE_GUIDE.md` - Usage guide

### 4.2 Migration Guide

- [ ] Document migration process
- [ ] Create before/after examples
- [ ] List breaking changes
- [ ] Add troubleshooting section
- [ ] Create migration checklist

**Files**:

- `docs/ACTION_QUEUE_MIGRATION.md` - Migration guide

### 4.3 Operational Documentation

- [ ] Write deployment guide
- [ ] Document configuration options
- [ ] Create backup/restore procedures
- [ ] Add performance tuning guide
- [ ] Document monitoring procedures

**Files**:

- `docs/ACTION_QUEUE_OPS.md` - Operations guide

### 4.4 Production Deployment

- [ ] Review all code and tests
- [ ] Security audit
- [ ] Performance benchmarking
- [ ] Create deployment checklist
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Gather feedback
- [ ] Iterate as needed

---

## Testing Checklist

### Unit Tests

- [ ] Rate limiter logic
- [ ] Queue processor
- [ ] Action executor
- [ ] Database operations
- [ ] Scheduler

### Integration Tests

- [ ] Full queue workflow
- [ ] Script integration
- [ ] Docker compose stack
- [ ] API endpoints

### Load Tests

- [ ] High volume submission
- [ ] Concurrent processing
- [ ] Rate limit stress test
- [ ] Database performance

### Manual Tests

- [ ] Submit various action types
- [ ] Verify rate limiting works
- [ ] Test scheduled actions
- [ ] Cancel pending actions
- [ ] Test failure recovery

---

## Success Criteria

- ✅ All action types can be queued
- ✅ Rate limits enforced correctly
- ✅ Scheduled actions execute on time
- ✅ Queue survives restarts (persistent)
- ✅ Failed actions retry automatically
- ✅ API is well-documented
- ✅ Scripts successfully migrated
- ✅ No rate limit violations in production
- ✅ Account suspension prevented

---

## Open Questions

- [ ] Should we support batch action submission?
- [ ] Do we need a web UI for queue management?
- [ ] Should rate limits be configurable per agent?
- [ ] Do we need webhook notifications for action completion?
- [ ] Should we implement action templates/macros?

---

## Dependencies

- `express` - HTTP server
- `better-sqlite3` - Persistent queue storage
- `node-cron` - Scheduled actions
- `axios` - Moltbook API client
- `uuid` - Action ID generation
- `zod` - Request validation

---

## Related Issues

- Account suspension due to verification failures
- Need to follow @0xYeks (pending action)
- Rate limit violations in production
- Scripts making concurrent API calls

---

## Notes

- Database path: `/data/action-queue.db` (persistent volume)
- Port: 3006 (internal docker network)
- Rate limits based on `skills/moltbook/SKILL.md`
- New agent detection: first 24 hours from registration

---

**Last Updated**: 2026-02-13
**Next Review**: 2026-02-20
