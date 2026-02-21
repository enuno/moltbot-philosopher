# Phase 7.2: Action Queue PostgreSQL Migration - Design Document

**Date:** 2026-02-20
**Status:** Design Approved
**Approach:** Big Bang Migration
**Downtime:** 30-45 minutes

---

## Executive Summary

Migrate the action-queue service from SQLite (file-based, host-mounted) to PostgreSQL (network-based, connection-pooled) to eliminate operational friction in containerized multi-agent environments. Leverage pg-boss library for production-grade job queue management with built-in retry strategies, observability, and horizontal scalability preparation.

**Rationale for PostgreSQL:**

| Problem (SQLite) | Solution (PostgreSQL) |
|---|---|
| File-based locking (9 agents competing for WAL locks) | Connection pooling with pg-boss |
| Host mount coupling (violates container immutability) | Network database (no host filesystem dependency) |
| Backup inconsistency (DB dump + filesystem strategies) | Single PostgreSQL backup strategy |
| Permission fragility (SQLite file UID/GID must match container) | No host filesystem coupling |
| Limited observability (requires docker exec for queries) | Full SQL analytics queries available |
| Horizontal scaling impossible (NFS required) | Native horizontal scalability |

---

## Architecture Design

### 1. Database Schema

**PostgreSQL Setup:**
- New database: `action_queue` on existing `postgres:16` instance
- Owner: `noosphere_admin` (reuse existing credentials)
- Includes pgvector extension (already available)
- Separate from `noosphere` database for isolation

**Tables:**

**pg-boss Managed Tables** (created automatically):
- `job` - Core action queue (manages status, retries, execution)
- `archive` - Completed/failed job history
- `schedule` - Recurring job schedules
- `subscription` - Event subscriptions

**Custom Application Tables:**

```sql
-- Rate limit tracking (per-agent state)
CREATE TABLE rate_limits (
  agent_name TEXT PRIMARY KEY,
  last_post_timestamp BIGINT,
  last_comment_timestamp BIGINT,
  last_follow_timestamp BIGINT,
  last_dm_timestamp BIGINT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agent profiles (rate limit configuration)
CREATE TABLE agent_profiles (
  name TEXT PRIMARY KEY,
  daily_post_max INT DEFAULT 3,
  daily_comment_max INT DEFAULT 50,
  daily_follow_max INT DEFAULT 2,
  daily_dm_max INT DEFAULT 2
);

-- Audit trail for observability
CREATE TABLE action_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID REFERENCES job(id),
  agent_name TEXT,
  action_type TEXT,
  status TEXT,
  attempts INT,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  INDEX action_logs_agent_created (agent_name, created_at DESC),
  INDEX action_logs_status (status)
);
```

### 2. Migration Process

**Phase 1: Preparation (1-2 hours, no downtime)**
1. Create new `action_queue` database on PostgreSQL
2. Export current SQLite data:
   ```bash
   sqlite3 data/action-queue/action-queue.db ".mode json" > /tmp/actions.json
   sqlite3 data/action-queue/action-queue.db ".mode json" "SELECT * FROM rate_limits;" > /tmp/rate_limits.json
   ```
3. Backup current SQLite file:
   ```bash
   cp data/action-queue/action-queue.db data/action-queue/action-queue.db.backup
   ```
4. Prepare migration script (`scripts/migrate-actions-to-postgres.sh`)

**Phase 2: Cutover (30-45 min downtime)**
1. Stop action-queue service: `docker compose stop action-queue`
2. Verify no in-flight requests (check logs)
3. Import SQLite data into PostgreSQL:
   ```bash
   bash scripts/migrate-actions-to-postgres.sh /tmp/actions.json /tmp/rate_limits.json
   ```
   - Maps SQLite action statuses to pg-boss job states
   - Creates jobs for all PENDING/PROCESSING actions
   - Initializes rate_limits table
4. Update service environment variables:
   - Remove: `QUEUE_DB_PATH`
   - Add: `DATABASE_URL=postgresql://noosphere_admin:${POSTGRES_PASSWORD}@postgres:5432/action_queue`
5. Rebuild and start action-queue:
   ```bash
   docker compose up -d --build action-queue
   ```
6. Verify health: `curl http://localhost:3008/queue/health`

**Phase 3: Validation (10-15 min)**
- Check queue stats: `curl http://localhost:3008/queue/stats`
- Submit test action via API
- Monitor logs for migration errors
- Verify observability endpoints work

### 3. Code Implementation

**Dependencies:**
```json
{
  "pg": "^8.11.0",
  "pg-boss": "^10.2.0",
  "pg-format": "^1.0.4"
}
```

**DatabaseManager Rewrite (TypeScript):**
- Replace `better-sqlite3` with `pg` Pool + `pg-boss` client
- Initialize pg-boss on startup
- Create custom tables on first connection
- Implement rate limit queries using direct SQL

**Queue Processor Changes:**
- Subscribe to `action:process` job queue via pg-boss
- Subscribe to `action:process:retry` for advanced retry handling
- Execute actions, log results to `action_logs` table
- Leverage pg-boss retry mechanism (throw to retry, commit on success)

**Observability Endpoints:**
- `/queue/jobs/stats` - Active job count + archived job breakdown (24h)
- `/queue/jobs/:id/history` - Full execution history for specific job
- `/queue/agents/:name/metrics` - Per-agent rate limit status + success/failure metrics

### 4. Advanced Retry Strategy

**Exponential Backoff:**
- Base delay: 5 seconds
- Formula: `5s × 5^(attempt - 1)` capped at 1 hour
- Retry sequence: 5s → 25s → 2m → 10m → 1h

**Circuit Breaker Pattern:**
- Monitor failure rate per agent (past 1 hour)
- If >50% of actions failed AND >10 total actions → pause processing
- Prevents cascading failures when downstream service is down

**Selective Retry:**
- Retryable errors: `ECONNREFUSED`, `RATE_LIMIT_EXCEEDED`, `TIMEOUT`, `TEMPORARY_ERROR`
- Non-retryable errors: `INVALID_PAYLOAD`, `AUTH_FAILED`, `RESOURCE_NOT_FOUND`
- Failed non-retryable actions logged but never retried

**Singleton Key:**
- Prevent duplicate processing of same action within 60 seconds
- Uses `singletonKey: agentName` to ensure per-agent exclusivity

### 5. Error Handling & Rollback

**Automatic Rollback (if PostgreSQL fails during/after cutover):**
1. Detect failure via health check or error logs
2. Stop action-queue service
3. Restore SQLite backup: `cp data/action-queue/action-queue.db.backup data/action-queue/action-queue.db`
4. Revert environment variables to SQLite configuration
5. Restart action-queue service with SQLite
6. Investigate PostgreSQL issue before re-attempting

**Transactional Logging:**
- All state changes logged to `action_logs` table
- Provides full audit trail for debugging
- Enables recovery of lost state if needed

**Critical Action Alerts:**
- Actions with `priority: CRITICAL` that fail logged to monitoring system
- Operations team alerted via existing alert channel

### 6. Testing Strategy

**Unit Tests:**
- `database.ts`: Pool initialization, connection pooling
- `queue-processor.ts`: Retry logic (exponential backoff calculations)
- `rate-limiter.ts`: Circuit breaker decision logic
- Job serialization/deserialization

**Integration Tests:**
- SQLite → PostgreSQL data import roundtrip
- Action submission → pg-boss job creation → execution completion
- Rate limit queries return correct state
- Observability endpoints return accurate metrics
- Retry mechanism works with pg-boss (throw/catch)

**Migration Tests (Critical):**
- Export SQLite with various action states (PENDING, PROCESSING, COMPLETED, FAILED)
- Import into PostgreSQL and verify counts match
- Verify action properties preserved (agent_name, priority, payload)
- Test rollback procedure manually (restore SQLite backup)
- Validate no data loss or corruption

**Load Tests:**
- 9 agents submitting 10 actions each (90 concurrent jobs)
- Verify connection pool handles load without exhaustion
- Monitor pg-boss performance metrics
- Verify exponential backoff doesn't overwhelm retry queue

---

## Timeline & Effort

- **Design Phase:** Completed (2026-02-20)
- **Implementation Phase:** 3-5 days (writing pg-boss integration, migration script, tests)
- **Testing Phase:** 2-3 days (integration tests, migration validation)
- **Deployment:** 30-45 min downtime window (early morning UTC)
- **Total:** 5-8 days

**Team:** 1-2 backend engineers

---

## Success Criteria

✅ All SQLite data successfully migrated to PostgreSQL
✅ Zero action loss during cutover
✅ All existing API endpoints working identically
✅ Observability endpoints returning accurate metrics
✅ Retry logic functioning with exponential backoff
✅ Circuit breaker prevents cascading failures
✅ Rollback procedure tested and documented
✅ No performance regression (latency, throughput)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Data loss during import | Critical | Backup SQLite before import; validate row counts pre/post |
| PostgreSQL unavailable post-cutover | High | Automatic rollback to SQLite; detailed monitoring |
| Connection pool exhaustion | Medium | pg-boss handles pooling; load testing validates |
| Duplicate job processing | Medium | Singleton key prevents; pg-boss idempotency |
| Downtime during cutover | Medium | Off-peak window (02:00-03:00 UTC); document communication |

---

## Future Enhancements

- Horizontal scaling: Multiple action-queue instances sharing PostgreSQL queue
- Advanced scheduling: Recurring actions via pg-boss schedule support
- Multi-region: Replicated PostgreSQL for disaster recovery
- Workflow orchestration: Chain dependent actions using pg-boss workflows

---

## References

- pg-boss Documentation: https://github.com/timgit/pg-boss
- PostgreSQL JSON Functions: https://www.postgresql.org/docs/16/functions-json.html
- Phase 7.2 DEVELOPMENT_PLAN.md entry
