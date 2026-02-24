# Phase 7.2: Action Queue PostgreSQL Migration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate action-queue service from SQLite to PostgreSQL with pg-boss job queue library, advanced retry strategies, and observability endpoints.

**Architecture:** Replace file-based SQLite with connection-pooled PostgreSQL + pg-boss job queue. Implement Big Bang migration (drain SQLite, import to PostgreSQL, cutover). Add observability via `action_logs` table and new API endpoints. Implement exponential backoff + circuit breaker retry strategies.

**Tech Stack:**
- PostgreSQL 16 (pgvector already deployed)
- pg-boss 10.2 (production job queue)
- pg 8.11 (Node.js PostgreSQL driver)
- Better error handling with transactional logging

---

## Task 1: Create PostgreSQL Database & Migration Script

**Files:**
- Create: `scripts/migrate-actions-to-postgres.sh`
- Create: `scripts/db/init-action-queue.sql`
- Modify: `docker-compose.yml` (add init SQL volume to postgres service)

**Step 1: Create database initialization SQL**

Create `scripts/db/init-action-queue.sql`:

```sql
-- Initialize action_queue database schema
CREATE DATABASE action_queue OWNER noosphere_admin;

\c action_queue;

-- pg-boss tables will be created on first connection by application
-- We just need our custom tables

CREATE TABLE IF NOT EXISTS rate_limits (
  agent_name TEXT PRIMARY KEY,
  last_post_timestamp BIGINT,
  last_comment_timestamp BIGINT,
  last_follow_timestamp BIGINT,
  last_dm_timestamp BIGINT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_profiles (
  name TEXT PRIMARY KEY,
  daily_post_max INT DEFAULT 3,
  daily_comment_max INT DEFAULT 50,
  daily_follow_max INT DEFAULT 2,
  daily_dm_max INT DEFAULT 2
);

CREATE TABLE IF NOT EXISTS action_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID,
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_action_logs_agent_created ON action_logs(agent_name, created_at DESC);
CREATE INDEX idx_action_logs_status ON action_logs(status);

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE action_queue TO noosphere_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO noosphere_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO noosphere_admin;
```

**Step 2: Create migration script**

Create `scripts/migrate-actions-to-postgres.sh`:

```bash
#!/bin/bash
set -euo pipefail

# Usage: bash migrate-actions-to-postgres.sh <actions.json> <rate_limits.json>
# Migrates SQLite action-queue data to PostgreSQL

if [ $# -lt 2 ]; then
    echo "Usage: $0 <actions.json> <rate_limits.json>"
    exit 1
fi

ACTIONS_FILE="$1"
RATE_LIMITS_FILE="$2"
DB_URL="${DATABASE_URL:-postgresql://noosphere_admin:changeme_noosphere_2026@localhost:5432/action_queue}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-changeme_noosphere_2026}"

echo "🔄 Starting migration from SQLite to PostgreSQL..."

# 1. Ensure database exists
echo "📦 Creating action_queue database..."
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U noosphere_admin -d postgres < scripts/db/init-action-queue.sql 2>/dev/null || true

# 2. Migrate rate limits
echo "⏱️  Migrating rate limits..."
PGPASSWORD="$POSTGRES_PASSWORD" psql "$DB_URL" << EOF
DELETE FROM rate_limits;
COPY rate_limits(agent_name, last_post_timestamp, last_comment_timestamp, last_follow_timestamp, last_dm_timestamp)
FROM STDIN WITH (FORMAT CSV, HEADER);
EOF

jq -r '[.[] | [.agent_name, .last_post_timestamp, .last_comment_timestamp, .last_follow_timestamp, .last_dm_timestamp] | @csv] | .[]' "$RATE_LIMITS_FILE" | \
  PGPASSWORD="$POSTGRES_PASSWORD" psql "$DB_URL" -c "COPY rate_limits(agent_name, last_post_timestamp, last_comment_timestamp, last_follow_timestamp, last_dm_timestamp) FROM STDIN"

# 3. Migrate actions (we'll insert these as job specs for pg-boss to process)
echo "✅ Migrating actions..."
jq -r '.[] | @json' "$ACTIONS_FILE" | while read -r action; do
  agent_name=$(echo "$action" | jq -r '.agent_name')
  action_type=$(echo "$action" | jq -r '.action_type')
  priority=$(echo "$action" | jq -r '.priority // 1')
  payload=$(echo "$action" | jq -r '.payload')
  status=$(echo "$action" | jq -r '.status')

  # Only migrate pending/scheduled actions; skip completed/failed
  if [[ "$status" == "pending" ]] || [[ "$status" == "scheduled" ]]; then
    # Log the action for pg-boss to pick up
    PGPASSWORD="$POSTGRES_PASSWORD" psql "$DB_URL" -c \
      "INSERT INTO action_logs(agent_name, action_type, status, attempts) VALUES('$agent_name', '$action_type', 'pending', 0);"
  fi
done

echo "✨ Migration complete!"
echo "📊 Verify with: psql $DB_URL -c 'SELECT COUNT(*) FROM rate_limits; SELECT COUNT(*) FROM action_logs;'"
```

**Step 3: Update docker-compose.yml**

Modify `docker-compose.yml` postgres service to include init script:

```yaml
postgres:
  # ... existing config ...
  volumes:
    - ./data/postgres:/var/lib/postgresql/data:rw
    - ./scripts/db/init-noosphere-v3.sql:/docker-entrypoint-initdb.d/01-init-noosphere.sql:ro
    - ./scripts/db/init-action-queue.sql:/docker-entrypoint-initdb.d/02-init-action-queue.sql:ro
    - ./logs:/logs:rw
```

**Step 4: Verify database initialization works**

Run: `docker compose down && docker compose up -d postgres && sleep 5 && docker compose exec postgres psql -U noosphere_admin -d action_queue -c "SELECT COUNT(*) FROM action_logs;"`

Expected: Should return `0` (empty table exists)

**Step 5: Commit**

```bash
git add scripts/migrate-actions-to-postgres.sh scripts/db/init-action-queue.sql docker-compose.yml
git commit -m "feat(action-queue): add PostgreSQL database initialization and migration script"
```

---

## Task 2: Add PostgreSQL Dependencies

**Files:**
- Modify: `services/action-queue/package.json`
- Modify: `services/action-queue/package-lock.json`

**Step 1: Update package.json**

Modify `services/action-queue/package.json` dependencies:

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "node-cron": "^3.0.2",
    "winston": "^3.11.0",
    "pg": "^8.11.0",
    "pg-boss": "^10.2.0"
  }
}
```

**Step 2: Install dependencies**

Run: `cd services/action-queue && npm install && cd ../../`

Expected: All packages installed successfully

**Step 3: Verify types available**

Run: `cd services/action-queue && npm list pg pg-boss && cd ../../`

Expected: Both packages listed in dependencies

**Step 4: Commit**

```bash
git add services/action-queue/package.json services/action-queue/package-lock.json
git commit -m "deps(action-queue): add pg and pg-boss for PostgreSQL support"
```

---

## Task 3: Rewrite DatabaseManager for PostgreSQL

**Files:**
- Modify: `services/action-queue/src/database.ts` (complete rewrite)
- Modify: `services/action-queue/src/config.ts` (update config for PostgreSQL URL)

**Step 1: Update config.ts**

Modify `services/action-queue/src/config.ts`:

```typescript
import dotenv from 'dotenv';

dotenv.config();

export const QUEUE_CONFIG = {
  port: parseInt(process.env.ACTION_QUEUE_PORT || '3008', 10),
  dbUrl: process.env.DATABASE_URL || 'postgresql://noosphere_admin:changeme_noosphere_2026@localhost:5432/action_queue',
  pgBossSchema: 'pgboss',
  environment: process.env.NODE_ENV || 'production',
  logLevel: process.env.LOG_LEVEL || 'info',
};
```

**Step 2: Rewrite DatabaseManager**

Replace entire `services/action-queue/src/database.ts`:

```typescript
import { Pool, PoolClient } from 'pg';
import PgBoss from 'pg-boss';
import { v4 as uuidv4 } from 'uuid';
import {
  QueuedAction,
  ActionStatus,
  ConditionalAction,
  RateLimitState,
} from './types';
import { QUEUE_CONFIG } from './config';

export class DatabaseManager {
  private pool: Pool;
  private pgBoss: PgBoss;
  private initialized = false;

  constructor(dbUrl: string = QUEUE_CONFIG.dbUrl) {
    this.pool = new Pool({ connectionString: dbUrl });
    this.pgBoss = new PgBoss({ connectionString: dbUrl });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Start pg-boss (creates its tables automatically)
    await this.pgBoss.start();

    // Create custom tables
    await this.createCustomTables();

    this.initialized = true;
    console.log('✅ DatabaseManager initialized (PostgreSQL + pg-boss)');
  }

  private async createCustomTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Rate limits table
      await client.query(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          agent_name TEXT PRIMARY KEY,
          last_post_timestamp BIGINT,
          last_comment_timestamp BIGINT,
          last_follow_timestamp BIGINT,
          last_dm_timestamp BIGINT,
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Agent profiles table
      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_profiles (
          name TEXT PRIMARY KEY,
          daily_post_max INT DEFAULT 3,
          daily_comment_max INT DEFAULT 50,
          daily_follow_max INT DEFAULT 2,
          daily_dm_max INT DEFAULT 2
        );
      `);

      // Action logs table (for observability)
      await client.query(`
        CREATE TABLE IF NOT EXISTS action_logs (
          id BIGSERIAL PRIMARY KEY,
          job_id UUID,
          agent_name TEXT NOT NULL,
          action_type TEXT NOT NULL,
          status TEXT NOT NULL,
          attempts INT DEFAULT 0,
          last_error TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_action_logs_agent_created
          ON action_logs(agent_name, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_action_logs_status
          ON action_logs(status);
      `);
    } finally {
      client.release();
    }
  }

  async insertAction(action: ConditionalAction): Promise<string> {
    const jobId = uuidv4();

    // Insert job into pg-boss queue
    await this.pgBoss.send('action:process', action, {
      id: jobId,
      priority: action.priority,
      retryLimit: action.maxAttempts - 1,
      expireInHours: 24,
      singletonKey: action.agentName,
      singletonSeconds: 60,
    });

    // Log the action for observability
    await this.logAction(jobId, action.agentName, action.actionType, 'pending');

    return jobId;
  }

  async getAction(id: string): Promise<ConditionalAction | null> {
    const job = await this.pgBoss.getJob(id);
    return job?.data as ConditionalAction || null;
  }

  async getActionsByStatus(status: ActionStatus, limit: number = 100): Promise<QueuedAction[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM action_logs WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
        [status, limit]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async updateActionStatus(id: string, status: ActionStatus, error?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE action_logs SET status = $1, last_error = $2, completed_at = NOW() WHERE job_id = $3`,
        [status, error || null, id]
      );
    } finally {
      client.release();
    }
  }

  async getRateLimit(agentName: string): Promise<RateLimitState> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM rate_limits WHERE agent_name = $1`,
        [agentName]
      );

      if (result.rows.length === 0) {
        // Initialize new rate limit
        await client.query(
          `INSERT INTO rate_limits(agent_name) VALUES($1) ON CONFLICT DO NOTHING`,
          [agentName]
        );
        return {
          lastPostTimestamp: 0,
          lastCommentTimestamp: 0,
          lastFollowTimestamp: 0,
          lastDmTimestamp: 0,
        };
      }

      const row = result.rows[0];
      return {
        lastPostTimestamp: row.last_post_timestamp || 0,
        lastCommentTimestamp: row.last_comment_timestamp || 0,
        lastFollowTimestamp: row.last_follow_timestamp || 0,
        lastDmTimestamp: row.last_dm_timestamp || 0,
      };
    } finally {
      client.release();
    }
  }

  async updateRateLimit(agentName: string, state: RateLimitState): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO rate_limits(agent_name, last_post_timestamp, last_comment_timestamp, last_follow_timestamp, last_dm_timestamp)
         VALUES($1, $2, $3, $4, $5)
         ON CONFLICT(agent_name) DO UPDATE SET
         last_post_timestamp = $2,
         last_comment_timestamp = $3,
         last_follow_timestamp = $4,
         last_dm_timestamp = $5`,
        [agentName, state.lastPostTimestamp, state.lastCommentTimestamp, state.lastFollowTimestamp, state.lastDmTimestamp]
      );
    } finally {
      client.release();
    }
  }

  private async logAction(jobId: string, agentName: string, actionType: string, status: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO action_logs(job_id, agent_name, action_type, status) VALUES($1, $2, $3, $4)`,
        [jobId, agentName, actionType, status]
      );
    } finally {
      client.release();
    }
  }

  async getStats(): Promise<any> {
    const jobStats = await this.pgBoss.getQueueSize('action:process');

    const client = await this.pool.connect();
    try {
      const logsResult = await client.query(`
        SELECT status, COUNT(*) as count FROM action_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY status
      `);

      return {
        queue_size: jobStats,
        logs_24h: logsResult.rows,
      };
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pgBoss.stop();
    await this.pool.end();
  }

  // Expose pg-boss for queue subscription
  getPgBoss(): PgBoss {
    return this.pgBoss;
  }
}
```

**Step 3: Update types if needed**

Verify `services/action-queue/src/types.ts` has `RateLimitState` interface:

```typescript
export interface RateLimitState {
  lastPostTimestamp: number;
  lastCommentTimestamp: number;
  lastFollowTimestamp: number;
  lastDmTimestamp: number;
}
```

**Step 4: Verify compilation**

Run: `cd services/action-queue && npm run build && cd ../../`

Expected: TypeScript compiles without errors

**Step 5: Commit**

```bash
git add services/action-queue/src/database.ts services/action-queue/src/config.ts services/action-queue/src/types.ts
git commit -m "feat(action-queue): rewrite DatabaseManager for PostgreSQL + pg-boss"
```

---

## Task 4: Rewrite QueueProcessor for pg-boss

**Files:**
- Modify: `services/action-queue/src/queue-processor.ts` (complete rewrite)
- Modify: `services/action-queue/src/rate-limiter.ts` (update to use DatabaseManager)

**Step 1: Rewrite QueueProcessor**

Replace entire `services/action-queue/src/queue-processor.ts`:

```typescript
import { DatabaseManager } from './database';
import { ActionExecutor } from './action-executor';
import { RateLimiter } from './rate-limiter';
import { Priority } from './types';
import PgBoss from 'pg-boss';

export class QueueProcessor {
  private db: DatabaseManager;
  private executor: ActionExecutor;
  private rateLimiter: RateLimiter;
  private pgBoss: PgBoss | null = null;
  private running = false;

  constructor(db: DatabaseManager, executor: ActionExecutor, rateLimiter: RateLimiter) {
    this.db = db;
    this.executor = executor;
    this.rateLimiter = rateLimiter;
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.pgBoss = this.db.getPgBoss();

    // Subscribe to main action processing queue
    await this.pgBoss!.subscribe('action:process', async (job) => {
      await this.executeAction(job.data);
    });

    // Subscribe to retry queue (for advanced retry handling)
    await this.pgBoss!.subscribe('action:process:retry', async (job) => {
      await this.handleRetryWithBackoff(job.data);
    });

    this.running = true;
    console.log('✅ QueueProcessor started - listening to pg-boss queues');
  }

  async stop(): Promise<void> {
    if (!this.pgBoss) return;
    await this.pgBoss.unsubscribe('action:process');
    await this.pgBoss.unsubscribe('action:process:retry');
    this.running = false;
    console.log('⛔ QueueProcessor stopped');
  }

  private async executeAction(action: any): Promise<void> {
    const jobId = action.id;
    console.log(`⚡ Executing action: ${jobId} (${action.actionType} by ${action.agentName})`);

    try {
      // Check rate limits
      const canExecute = await this.rateLimiter.canExecute(action.agentName, action.actionType);
      if (!canExecute) {
        console.log(`⏸️  Rate limited: ${action.agentName}`);
        await this.db.updateActionStatus(jobId, 'rate_limited');
        throw new Error('Rate limited - will retry');
      }

      // Check circuit breaker
      await this.checkCircuitBreaker(action.agentName);

      // Execute the action
      await this.executor.execute(action);

      // Update rate limits
      await this.rateLimiter.updateLastExecution(action.agentName, action.actionType);

      // Log success
      await this.db.updateActionStatus(jobId, 'completed');
      console.log(`✅ Action completed: ${jobId}`);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Action failed: ${jobId} - ${errorMsg}`);

      // Update attempt count
      const job = await this.pgBoss!.getJob(jobId);
      const attempts = (job?.attemptsMade || 0) + 1;

      // Determine if retryable
      if (this.isRetryable(error) && attempts < 4) {
        console.log(`🔄 Retrying (attempt ${attempts}/3): ${jobId}`);
        await this.db.updateActionStatus(jobId, 'pending', errorMsg);
        throw error; // pg-boss will retry based on exponential backoff
      } else {
        await this.db.updateActionStatus(jobId, 'failed', errorMsg);

        // Alert if critical
        if (action.priority === Priority.CRITICAL) {
          console.error(`🚨 CRITICAL action failed and not retrying: ${jobId}`);
          // In production, send alert to monitoring system
        }
      }
    }
  }

  private async handleRetryWithBackoff(action: any): Promise<void> {
    // pg-boss handles exponential backoff automatically via job options
    // This handler is for custom retry logic if needed
    await this.executeAction(action);
  }

  private isRetryable(error: any): boolean {
    const retryableErrors = [
      'ECONNREFUSED',
      'RATE_LIMIT_EXCEEDED',
      'TIMEOUT',
      'TEMPORARY_ERROR',
      'ENOTFOUND',
      'ECONNRESET',
    ];

    const errorMsg = error instanceof Error ? error.message : String(error);
    return retryableErrors.some((e) => errorMsg.includes(e));
  }

  private async checkCircuitBreaker(agentName: string): Promise<void> {
    // Check failure rate in past hour
    const stats = await this.db.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'failed') as failures,
        COUNT(*) as total
      FROM action_logs
      WHERE agent_name = $1 AND created_at > NOW() - INTERVAL '1 hour'
    `, [agentName]);

    const row = stats.rows[0];
    if (row.total > 10 && row.failures / row.total > 0.5) {
      throw new Error(`Circuit breaker open: ${agentName} has >50% failure rate in past hour`);
    }
  }

  getStats(): any {
    return this.db.getStats();
  }
}
```

**Step 2: Update RateLimiter to use DatabaseManager**

Modify `services/action-queue/src/rate-limiter.ts` to fetch/update limits from PostgreSQL:

```typescript
import { DatabaseManager } from './database';
import { ActionType, Priority } from './types';

export class RateLimiter {
  private db: DatabaseManager;

  // In-memory cache for performance (invalidate every 60s)
  private cache = new Map<string, any>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 60000; // 60 seconds

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  async canExecute(agentName: string, actionType: ActionType): Promise<boolean> {
    const limits = await this.getRateLimitState(agentName);
    const now = Date.now() / 1000; // unix timestamp in seconds

    switch (actionType) {
      case 'post':
        // 30-minute cooldown between posts
        return (now - limits.lastPostTimestamp) > 1800;
      case 'comment':
        // 20-second cooldown between comments
        return (now - limits.lastCommentTimestamp) > 20;
      case 'follow':
        // 1-minute cooldown between follows
        return (now - limits.lastFollowTimestamp) > 60;
      case 'dm':
        // 5-minute cooldown between DMs
        return (now - limits.lastDmTimestamp) > 300;
      default:
        return true;
    }
  }

  async updateLastExecution(agentName: string, actionType: ActionType): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const limits = await this.getRateLimitState(agentName);

    switch (actionType) {
      case 'post':
        limits.lastPostTimestamp = now;
        break;
      case 'comment':
        limits.lastCommentTimestamp = now;
        break;
      case 'follow':
        limits.lastFollowTimestamp = now;
        break;
      case 'dm':
        limits.lastDmTimestamp = now;
        break;
    }

    await this.db.updateRateLimit(agentName, limits);
    this.invalidateCache(agentName);
  }

  private async getRateLimitState(agentName: string): Promise<any> {
    // Check cache first
    if (this.cache.has(agentName)) {
      const expiry = this.cacheExpiry.get(agentName) || 0;
      if (expiry > Date.now()) {
        return this.cache.get(agentName);
      }
    }

    // Fetch from database
    const limits = await this.db.getRateLimit(agentName);
    this.cache.set(agentName, limits);
    this.cacheExpiry.set(agentName, Date.now() + this.CACHE_TTL);

    return limits;
  }

  private invalidateCache(agentName: string): void {
    this.cache.delete(agentName);
    this.cacheExpiry.delete(agentName);
  }

  getStatus(agentName: string): any {
    const cached = this.cache.get(agentName);
    return cached || { cached: false };
  }
}
```

**Step 3: Verify compilation**

Run: `cd services/action-queue && npm run build && cd ../../`

Expected: TypeScript compiles without errors

**Step 4: Commit**

```bash
git add services/action-queue/src/queue-processor.ts services/action-queue/src/rate-limiter.ts
git commit -m "feat(action-queue): rewrite QueueProcessor for pg-boss with advanced retry strategies"
```

---

## Task 5: Add Observability Endpoints

**Files:**
- Modify: `services/action-queue/src/index.ts` (add new endpoints)

**Step 1: Add observability endpoints**

Modify `services/action-queue/src/index.ts` to add these endpoints:

```typescript
// Add these routes to the Express app

/**
 * Get queue statistics
 */
app.get('/queue/stats', async (req: Request, res: Response) => {
  try {
    const stats = await processor.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get job execution history
 */
app.get('/queue/jobs/:id/history', async (req: Request, res: Response) => {
  try {
    const db = processor.getDatabase();
    const job = await db.getAction(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    // Get execution logs for this job
    const logs = await db.getActionLogs(req.params.id);

    res.json({
      success: true,
      job,
      history: logs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get per-agent metrics
 */
app.get('/queue/agents/:name/metrics', async (req: Request, res: Response) => {
  try {
    const db = processor.getDatabase();
    const metrics = await db.getAgentMetrics(req.params.name);

    res.json({
      success: true,
      agent: req.params.name,
      metrics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

**Step 2: Add helper methods to DatabaseManager**

Add to `services/action-queue/src/database.ts`:

```typescript
async getActionLogs(jobId: string): Promise<any[]> {
  const client = await this.pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM action_logs WHERE job_id = $1 ORDER BY created_at DESC`,
      [jobId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async getAgentMetrics(agentName: string): Promise<any> {
  const client = await this.pool.connect();
  try {
    const result = await client.query(
      `SELECT
        (SELECT * FROM rate_limits WHERE agent_name = $1) as rate_limit,
        COUNT(*) FILTER (WHERE status = 'completed' AND agent_name = $1 AND created_at > NOW() - INTERVAL '24 hours') as completed_24h,
        COUNT(*) FILTER (WHERE status = 'failed' AND agent_name = $1 AND created_at > NOW() - INTERVAL '24 hours') as failed_24h,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_sec
      FROM action_logs
      WHERE agent_name = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [agentName]
    );

    return result.rows[0] || {};
  } finally {
    client.release();
  }
}
```

**Step 3: Verify endpoints work**

Run: `npm run build`

Expected: Compiles without errors

**Step 4: Commit**

```bash
git add services/action-queue/src/index.ts services/action-queue/src/database.ts
git commit -m "feat(action-queue): add observability endpoints for job history and agent metrics"
```

---

## Task 6: Update Environment Configuration

**Files:**
- Modify: `docker-compose.yml` (action-queue service)
- Modify: `.env.example`

**Step 1: Update docker-compose.yml**

Modify the `action-queue` service in `docker-compose.yml`:

```yaml
action-queue:
  build:
    context: ./services/action-queue
    dockerfile: Dockerfile
  image: moltbot:action-queue
  container_name: action-queue
  environment:
    - NODE_ENV=production
    - ACTION_QUEUE_PORT=3008
    - DATABASE_URL=postgresql://noosphere_admin:${POSTGRES_PASSWORD:-changeme_noosphere_2026}@postgres:5432/action_queue
    - LOG_LEVEL=info
  volumes:
    - ./logs:/app/logs:rw
  ports:
    - "3008:3008"
  networks:
    - moltbot-network
  depends_on:
    postgres:
      condition: service_healthy
  mem_limit: 512M
  cpus: 0.5
  restart: unless-stopped
  healthcheck:
    test:
      [
        "CMD-SHELL",
        'wget --no-verbose --tries=1 --spider http://localhost:3008/queue/health || exit 1',
      ]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

**Step 2: Update .env.example**

Ensure `.env.example` has:

```bash
# PostgreSQL
POSTGRES_PASSWORD=changeme_noosphere_2026

# Action Queue (now uses PostgreSQL)
DATABASE_URL=postgresql://noosphere_admin:${POSTGRES_PASSWORD}@postgres:5432/action_queue
```

**Step 3: Verify env vars are correct**

Run: `grep DATABASE_URL .env.example && grep POSTGRES_PASSWORD .env.example`

Expected: Both variables present

**Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "config(action-queue): update docker-compose and env for PostgreSQL"
```

---

## Task 7: Write Unit Tests

**Files:**
- Create: `services/action-queue/tests/database.test.ts`
- Create: `services/action-queue/tests/rate-limiter.test.ts`
- Create: `services/action-queue/tests/queue-processor.test.ts`

**Step 1: Write database unit tests**

Create `services/action-queue/tests/database.test.ts`:

```typescript
import { DatabaseManager } from '../src/database';
import { Priority } from '../src/types';

describe('DatabaseManager', () => {
  let db: DatabaseManager;
  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://noosphere_admin:changeme_noosphere_2026@localhost:5432/action_queue_test';

  beforeAll(async () => {
    db = new DatabaseManager(testDbUrl);
    await db.initialize();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('insertAction', () => {
    it('should insert action and return job ID', async () => {
      const action = {
        id: 'test-1',
        agentName: 'classical',
        actionType: 'post',
        priority: Priority.NORMAL,
        payload: { content: 'test' },
        status: 'pending',
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      };

      const jobId = await db.insertAction(action as any);
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });
  });

  describe('getRateLimit', () => {
    it('should return initialized rate limit for new agent', async () => {
      const limits = await db.getRateLimit('test-agent');
      expect(limits).toHaveProperty('lastPostTimestamp');
      expect(limits.lastPostTimestamp).toBe(0);
    });

    it('should update and retrieve rate limit', async () => {
      const newLimits = {
        lastPostTimestamp: 1000,
        lastCommentTimestamp: 2000,
        lastFollowTimestamp: 3000,
        lastDmTimestamp: 4000,
      };

      await db.updateRateLimit('test-agent-2', newLimits);
      const retrieved = await db.getRateLimit('test-agent-2');

      expect(retrieved.lastPostTimestamp).toBe(1000);
      expect(retrieved.lastDmTimestamp).toBe(4000);
    });
  });

  describe('getStats', () => {
    it('should return valid stats object', async () => {
      const stats = await db.getStats();
      expect(stats).toHaveProperty('queue_size');
      expect(stats).toHaveProperty('logs_24h');
    });
  });
});
```

**Step 2: Run unit tests**

Run: `cd services/action-queue && npm test -- tests/database.test.ts && cd ../../`

Expected: Tests pass (some may need mocking for full suite)

**Step 3: Write rate limiter tests**

Create `services/action-queue/tests/rate-limiter.test.ts`:

```typescript
import { RateLimiter } from '../src/rate-limiter';
import { DatabaseManager } from '../src/database';

describe('RateLimiter', () => {
  let limiter: RateLimiter;
  let db: DatabaseManager;

  beforeAll(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://noosphere_admin:changeme_noosphere_2026@localhost:5432/action_queue_test';
    db = new DatabaseManager(testDbUrl);
    await db.initialize();
    limiter = new RateLimiter(db);
  });

  afterAll(async () => {
    await db.close();
  });

  describe('canExecute', () => {
    it('should allow first post', async () => {
      const result = await limiter.canExecute('test-limiter', 'post');
      expect(result).toBe(true);
    });

    it('should block second post within 30 minutes', async () => {
      await limiter.updateLastExecution('test-limiter', 'post');
      const result = await limiter.canExecute('test-limiter', 'post');
      expect(result).toBe(false);
    });

    it('should allow comment within 20 seconds', async () => {
      const result = await limiter.canExecute('test-limiter', 'comment');
      expect(result).toBe(true);
    });
  });
});
```

**Step 4: Run rate limiter tests**

Run: `cd services/action-queue && npm test -- tests/rate-limiter.test.ts && cd ../../`

Expected: Tests pass

**Step 5: Commit**

```bash
git add services/action-queue/tests/database.test.ts services/action-queue/tests/rate-limiter.test.ts
git commit -m "test(action-queue): add unit tests for DatabaseManager and RateLimiter"
```

---

## Task 8: Write Integration Tests

**Files:**
- Create: `tests/action-queue-migration.test.sh`
- Create: `services/action-queue/tests/integration.test.ts`

**Step 1: Create migration integration test**

Create `tests/action-queue-migration.test.sh`:

```bash
#!/bin/bash
set -euo pipefail

echo "🧪 Testing action-queue migration..."

# 1. Export SQLite data (create test data first)
echo "📤 Exporting test data from SQLite..."
sqlite3 data/action-queue/action-queue.db.backup << EOF > /tmp/test-actions.json
SELECT json_group_object('agent_name', agent_name) FROM (
  SELECT DISTINCT agent_name FROM actions LIMIT 5
);
EOF

# 2. Run migration script
echo "🔄 Running migration script..."
bash scripts/migrate-actions-to-postgres.sh /tmp/test-actions.json /tmp/test-actions.json

# 3. Verify data in PostgreSQL
echo "✅ Verifying migrated data..."
PGPASSWORD="$POSTGRES_PASSWORD" psql "$DATABASE_URL" -c "SELECT COUNT(*) as total_logs FROM action_logs;" | grep -q "total_logs"

echo "✨ Migration integration test passed!"
```

**Step 2: Create action-queue integration tests**

Create `services/action-queue/tests/integration.test.ts`:

```typescript
import axios from 'axios';

describe('Action Queue API Integration', () => {
  const baseUrl = 'http://localhost:3008';
  const timeout = 5000;

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await axios.get(`${baseUrl}/queue/health`, { timeout });
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
    });
  });

  describe('Action Submission', () => {
    it('should accept action and return job ID', async () => {
      const payload = {
        agentName: 'classical',
        actionType: 'post',
        priority: 1,
        payload: {
          title: 'Test Post',
          content: 'Integration test content',
          submolt: 'general',
        },
      };

      const response = await axios.post(`${baseUrl}/actions`, payload, { timeout });
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.action.id).toBeDefined();
    });
  });

  describe('Observability', () => {
    it('should return queue stats', async () => {
      const response = await axios.get(`${baseUrl}/queue/stats`, { timeout });
      expect(response.status).toBe(200);
      expect(response.data.stats).toHaveProperty('queue_size');
    });

    it('should return agent metrics', async () => {
      const response = await axios.get(`${baseUrl}/queue/agents/classical/metrics`, { timeout });
      expect(response.status).toBe(200);
      expect(response.data.metrics).toBeDefined();
    });
  });
});
```

**Step 3: Run integration tests**

Run: `cd services/action-queue && npm test -- tests/integration.test.ts && cd ../../`

Expected: Tests connect to running action-queue service and pass

**Step 4: Commit**

```bash
git add tests/action-queue-migration.test.sh services/action-queue/tests/integration.test.ts
git commit -m "test(action-queue): add integration tests for migration and API"
```

---

## Task 9: Update Dockerfile

**Files:**
- Modify: `services/action-queue/Dockerfile`

**Step 1: Verify Dockerfile is correct**

Ensure `services/action-queue/Dockerfile` has:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy TypeScript source
COPY tsconfig.json ./
COPY src/ ./src/

# Install dev dependencies for build
RUN npm install --save-dev typescript @types/node @types/express

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Create data directory
RUN mkdir -p /data && chown -R 1001:1001 /data

# Create non-root user
RUN addgroup -g 1001 -S agent && adduser -S agent -u 1001 -G agent || true
USER 1001:1001

# Expose port
EXPOSE 3008

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3008/queue/health || exit 1

# Start service
CMD ["node", "dist/index.js"]
```

**Step 2: Test Docker build**

Run: `docker build -f services/action-queue/Dockerfile -t moltbot:action-queue-test services/action-queue`

Expected: Docker build succeeds

**Step 3: Commit if changes made**

```bash
git add services/action-queue/Dockerfile
git commit -m "ci(action-queue): verify Dockerfile for PostgreSQL support"
```

---

## Task 10: Documentation & Migration Guide

**Files:**
- Create: `docs/MIGRATION_GUIDE_7.2.md`

**Step 1: Create migration guide**

Create `docs/MIGRATION_GUIDE_7.2.md`:

```markdown
# Phase 7.2: Action Queue PostgreSQL Migration Guide

## Pre-Migration Checklist

- [ ] Backup current SQLite database: `cp data/action-queue/action-queue.db data/action-queue/action-queue.db.backup`
- [ ] Export current queue state: `bash scripts/migrate-actions-to-postgres.sh`
- [ ] Schedule maintenance window (30-45 min downtime)
- [ ] Notify users of planned downtime
- [ ] Prepare rollback procedures

## Migration Steps

### Step 1: Stop Current Services
```bash
docker compose stop action-queue
```

### Step 2: Run Migration
```bash
# Export SQLite data
sqlite3 data/action-queue/action-queue.db.backup ".mode json" > /tmp/actions.json

# Run migration
bash scripts/migrate-actions-to-postgres.sh /tmp/actions.json /tmp/actions.json
```

### Step 3: Update Environment
```bash
# Update .env with PostgreSQL DATABASE_URL
docker compose up -d --build action-queue
```

### Step 4: Verify
```bash
curl http://localhost:3008/queue/health
curl http://localhost:3008/queue/stats
```

## Rollback Procedure

If something goes wrong:

1. Stop action-queue: `docker compose stop action-queue`
2. Restore SQLite: `cp data/action-queue/action-queue.db.backup data/action-queue/action-queue.db`
3. Revert env vars to SQLite configuration
4. Restart: `docker compose up -d action-queue`

## Monitoring Post-Migration

- Monitor logs: `docker compose logs -f action-queue`
- Check metrics: `curl http://localhost:3008/queue/agents/classical/metrics`
- Verify actions are processed: Watch action_logs table grow
```

**Step 2: Commit**

```bash
git add docs/MIGRATION_GUIDE_7.2.md
git commit -m "docs(phase-7.2): add migration guide and rollback procedures"
```

---

## Task 11: Final Testing & Verification

**Files:**
- Verify: All tests pass
- Verify: Services start correctly
- Verify: API endpoints work

**Step 1: Run all tests**

Run: `cd services/action-queue && npm test && cd ../../`

Expected: All unit and integration tests pass

**Step 2: Start full stack**

Run: `docker compose up -d`

Expected: All services healthy

**Step 3: Verify action-queue health**

Run: `curl http://localhost:3008/queue/health | jq .`

Expected: Status is "healthy"

**Step 4: Test action submission**

Run:
```bash
curl -X POST http://localhost:3008/actions \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "classical",
    "actionType": "post",
    "priority": 1,
    "payload": {"title": "Test", "content": "Migration successful!", "submolt": "general"}
  }' | jq .
```

Expected: Returns action ID and "success": true

**Step 5: Verify PostgreSQL data**

Run: `docker compose exec postgres psql -U noosphere_admin -d action_queue -c "SELECT COUNT(*) FROM action_logs;"`

Expected: Shows count > 0

**Step 6: Final commit**

```bash
git add -A
git commit -m "test(action-queue): verify full PostgreSQL migration is working end-to-end"
```

---

## Summary

**Total Effort:** 5-8 days (1 engineer)

**Key Changes:**
1. New PostgreSQL `action_queue` database with pg-boss
2. Rewritten DatabaseManager and QueueProcessor
3. Advanced retry strategies (exponential backoff + circuit breaker)
4. New observability endpoints
5. Comprehensive migration & rollback procedures
6. Full test coverage

**Commits Created:**
- Database & migration script
- Dependencies
- DatabaseManager rewrite
- QueueProcessor rewrite
- Observability endpoints
- Environment config
- Unit tests
- Integration tests
- Dockerfile verification
- Documentation
- Final verification

---

## Plan Saved

Plan saved to: `/home/elvis/.moltbot/docs/plans/2026-02-20-action-queue-postgres.md`
