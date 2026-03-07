# Task 5: Observability Endpoints Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three new observability endpoints to the action-queue service for real-time queue health monitoring and per-agent metrics tracking.

**Architecture:** Extend DatabaseManager with aggregation queries on action_logs table; add new Express endpoints that call these methods and return JSON analytics. No schema changes—only read operations on existing tables.

**Tech Stack:** TypeScript, Express.js, PostgreSQL aggregation queries, Jest for unit tests

---

## Task 1: Add Queue Stats Aggregation Method to DatabaseManager

**Files:**

- Modify: `services/action-queue/src/database.ts:275-298` (replace stub getStats method)

- Test: `services/action-queue/src/__tests__/database.test.ts` (new)

**Step 1: Update getStats() method in DatabaseManager**

Replace the existing `getStats()` stub (lines 275-298) with proper aggregation logic:

```typescript
/**

 * Get comprehensive queue statistics with breakdown by status and agent

 */
async getStats(): Promise<{
  summary: {
    total_queued: number;
    total_completed: number;
    total_failed: number;
    queue_size: number;
  };
  by_status: Array<{ status: string; count: number }>;
  by_agent: Array<{
    agent_name: string;
    total_actions: number;
    completed: number;
    failed: number;
    pending: number;
  }>;
  by_action_type: Array<{
    action_type: string;
    count: number;
    success_rate: number;
  }>;
  last_24h_summary: {
    total_created: number;
    total_completed: number;
    avg_latency_seconds: number;
  };
}> {
  try {
    const client = await this.pool.connect();
    try {
      // Get pg-boss queue size
      const jobStats = await this.pgBoss.getQueueSize('action:process');

      // Get status breakdown
      const statusResult = await client.query(`
        SELECT status, COUNT(*) as count FROM action_logs
        GROUP BY status
      `);

      // Get per-agent breakdown
      const agentResult = await client.query(`
        SELECT
          agent_name,
          COUNT(*) as total_actions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
        FROM action_logs
        GROUP BY agent_name
        ORDER BY total_actions DESC
      `);

      // Get action type breakdown with success rate
      const actionTypeResult = await client.query(`
        SELECT
          action_type,
          COUNT(*) as count,
          ROUND(
            COUNT(CASE WHEN status = 'completed' THEN 1 END)::float /
            NULLIF(COUNT(*), 0) * 100,
            2
          ) as success_rate
        FROM action_logs
        GROUP BY action_type
        ORDER BY count DESC
      `);

      // Get last 24h summary
      const last24hResult = await client.query(`
        SELECT
          COUNT(*) as total_created,
          COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as total_completed,
          ROUND(
            AVG(EXTRACT(EPOCH FROM (completed_at - created_at))),
            2
          ) as avg_latency_seconds
        FROM action_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);

      // Calculate totals
      const statusMap = new Map<string, number>();
      statusResult.rows.forEach((row: any) => {
        statusMap.set(row.status, row.count);
      });

      return {
        summary: {
          total_queued: statusMap.get('pending') || 0,
          total_completed: statusMap.get('completed') || 0,
          total_failed: statusMap.get('failed') || 0,
          queue_size: jobStats,
        },
        by_status: statusResult.rows,
        by_agent: agentResult.rows,
        by_action_type: actionTypeResult.rows,
        last_24h_summary: last24hResult.rows[0] || {
          total_created: 0,
          total_completed: 0,
          avg_latency_seconds: 0,
        },
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get stats:', error);
    return {
      summary: {
        total_queued: 0,
        total_completed: 0,
        total_failed: 0,
        queue_size: 0,
      },
      by_status: [],
      by_agent: [],
      by_action_type: [],
      last_24h_summary: {
        total_created: 0,
        total_completed: 0,
        avg_latency_seconds: 0,
      },
    };
  }
}

```

**Step 2: Add getJobHistory() method to DatabaseManager**

Add after getStats() method (around line 300):

```typescript
/**

 * Get execution history for a specific job

 */
async getJobHistory(jobId: string): Promise<{
  job_id: string;
  agent_name: string;
  action_type: string;
  status: string;
  attempts: number;
  created_at: Date;
  completed_at: Date | null;
  last_error: string | null;
  latency_seconds: number | null;
}> {
  const client = await this.pool.connect();
  try {
    const result = await client.query(
      `SELECT job_id, agent_name, action_type, status, attempts, created_at,
              completed_at, last_error,
              EXTRACT(EPOCH FROM (completed_at - created_at)) as latency_seconds
       FROM action_logs WHERE job_id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Job ${jobId} not found`);
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

```

**Step 3: Add getAgentMetrics() method to DatabaseManager**

Add after getJobHistory() method (around line 325):

```typescript
/**

 * Get per-agent metrics including action counts and rate limit status

 */
async getAgentMetrics(agentName: string): Promise<{
  agent_name: string;
  total_actions: number;
  completed: number;
  failed: number;
  pending: number;
  rate_limits: RateLimitState;
  last_action_at: Date | null;
  success_rate: number;
}> {
  const client = await this.pool.connect();
  try {
    // Get action counts
    const actionResult = await client.query(
      `SELECT
        COUNT(*) as total_actions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        MAX(created_at) as last_action_at
       FROM action_logs WHERE agent_name = $1`,
      [agentName]
    );

    const actions = actionResult.rows[0];

    // Get rate limits
    const limits = await this.getRateLimit(agentName);

    const successRate =
      actions.total_actions > 0
        ? (actions.completed / actions.total_actions) * 100
        : 0;

    return {
      agent_name: agentName,
      total_actions: actions.total_actions,
      completed: actions.completed,
      failed: actions.failed,
      pending: actions.pending,
      rate_limits: limits,
      last_action_at: actions.last_action_at
        ? new Date(actions.last_action_at)
        : null,
      success_rate: Math.round(successRate * 100) / 100,
    };
  } finally {
    client.release();
  }
}

```

**Step 4: Run TypeScript compilation to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add services/action-queue/src/database.ts
git commit -m "feat(action-queue): add stats aggregation methods to DatabaseManager"

```

---

## Task 2: Add New Observability Endpoints to Express App

**Files:**

- Modify: `services/action-queue/src/index.ts:37-50` (enhance /queue/stats endpoint)

- Modify: `services/action-queue/src/index.ts` (add /queue/jobs/:id/history endpoint)

- Modify: `services/action-queue/src/index.ts` (add /queue/agents/:name/metrics endpoint)

**Step 1: Enhance the /queue/stats endpoint**

Update the existing /queue/stats endpoint (currently at lines 37-50) with complete error handling:

```typescript
/**

 * Queue statistics endpoint with detailed breakdown

 */
app.get('/queue/stats', async (req: Request, res: Response) => {
  try {
    const stats = await processor.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

```

**Step 2: Add /queue/jobs/:id/history endpoint**

Add after /actions/:id endpoint (after line 153):

```typescript
/**

 * Get job execution history by ID

 */
app.get('/queue/jobs/:id/history', async (req: Request, res: Response) => {
  try {
    const history = await db.getJobHistory(req.params.id);

    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

```

**Step 3: Add /queue/agents/:name/metrics endpoint**

Add after /queue/jobs/:id/history endpoint (after the previous endpoint):

```typescript
/**

 * Get per-agent metrics and statistics

 */
app.get('/queue/agents/:name/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await db.getAgentMetrics(req.params.name);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

```

**Step 4: Run TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Run linting**

Run: `npx oxlint`
Expected: No new linting errors

**Step 6: Commit**

```bash
git add services/action-queue/src/index.ts
git commit -m "feat(action-queue): add observability endpoints for stats, job history, and agent metrics"

```

---

## Task 3: Write Unit Tests for New Methods

**Files:**

- Create: `services/action-queue/src/__tests__/database.observability.test.ts`

- Create: `services/action-queue/src/__tests__/observability-endpoints.test.ts`

**Step 1: Create database observability tests**

Create file `services/action-queue/src/__tests__/database.observability.test.ts`:

```typescript
import { DatabaseManager } from '../database';
import { ActionStatus } from '../types';

describe('DatabaseManager Observability Methods', () => {
  let db: DatabaseManager;

  beforeEach(async () => {
    db = new DatabaseManager();
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('getStats', () => {
    it('should return stats with empty queues', async () => {
      const stats = await db.getStats();

      expect(stats).toHaveProperty('summary');
      expect(stats).toHaveProperty('by_status');
      expect(stats).toHaveProperty('by_agent');
      expect(stats).toHaveProperty('by_action_type');
      expect(stats).toHaveProperty('last_24h_summary');

      expect(stats.summary).toHaveProperty('total_queued');
      expect(stats.summary).toHaveProperty('total_completed');
      expect(stats.summary).toHaveProperty('total_failed');
      expect(stats.summary).toHaveProperty('queue_size');
    });

    it('should aggregate stats by status', async () => {
      const stats = await db.getStats();
      const statusArray = stats.by_status;

      expect(Array.isArray(statusArray)).toBe(true);
      if (statusArray.length > 0) {
        expect(statusArray[0]).toHaveProperty('status');
        expect(statusArray[0]).toHaveProperty('count');
      }
    });
  });

  describe('getJobHistory', () => {
    it('should throw error for non-existent job', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(db.getJobHistory(fakeId)).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('getAgentMetrics', () => {
    it('should return metrics with zero actions for new agent', async () => {
      const metrics = await db.getAgentMetrics('test-agent-new');

      expect(metrics).toHaveProperty('agent_name');
      expect(metrics).toHaveProperty('total_actions');
      expect(metrics).toHaveProperty('completed');
      expect(metrics).toHaveProperty('failed');
      expect(metrics).toHaveProperty('pending');
      expect(metrics).toHaveProperty('rate_limits');
      expect(metrics).toHaveProperty('success_rate');

      expect(metrics.agent_name).toBe('test-agent-new');
      expect(metrics.total_actions).toBe(0);
      expect(metrics.success_rate).toBe(0);
    });

    it('should return rate limit state for agent', async () => {
      const metrics = await db.getAgentMetrics('classical');

      expect(metrics.rate_limits).toHaveProperty('lastPostTimestamp');
      expect(metrics.rate_limits).toHaveProperty('lastCommentTimestamp');
      expect(metrics.rate_limits).toHaveProperty('lastFollowTimestamp');
      expect(metrics.rate_limits).toHaveProperty('lastDmTimestamp');
    });
  });
});

```

**Step 2: Create Express endpoint tests**

Create file `services/action-queue/src/__tests__/observability-endpoints.test.ts`:

```typescript
import request from 'supertest';
import { app } from '../index';

describe('Observability Endpoints', () => {
  describe('GET /queue/stats', () => {
    it('should return queue statistics', async () => {
      const response = await request(app).get('/queue/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');

      const { data } = response.body;
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('by_status');
      expect(data).toHaveProperty('by_agent');
      expect(data).toHaveProperty('by_action_type');
      expect(data).toHaveProperty('last_24h_summary');
    });

    it('should have correct structure in summary', async () => {
      const response = await request(app).get('/queue/stats');

      const { summary } = response.body.data;
      expect(summary).toHaveProperty('total_queued');
      expect(summary).toHaveProperty('total_completed');
      expect(summary).toHaveProperty('total_failed');
      expect(summary).toHaveProperty('queue_size');
    });
  });

  describe('GET /queue/jobs/:id/history', () => {
    it('should return 404 for non-existent job', async () => {
      const response = await request(app).get(
        '/queue/jobs/00000000-0000-0000-0000-000000000000/history'
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /queue/agents/:name/metrics', () => {
    it('should return metrics for agent', async () => {
      const response = await request(app).get(
        '/queue/agents/classical/metrics'
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const { data } = response.body;
      expect(data).toHaveProperty('agent_name', 'classical');
      expect(data).toHaveProperty('total_actions');
      expect(data).toHaveProperty('completed');
      expect(data).toHaveProperty('failed');
      expect(data).toHaveProperty('pending');
      expect(data).toHaveProperty('rate_limits');
      expect(data).toHaveProperty('success_rate');
    });

    it('should return rate_limits object', async () => {
      const response = await request(app).get(
        '/queue/agents/classical/metrics'
      );

      const { rate_limits } = response.body.data;
      expect(rate_limits).toHaveProperty('lastPostTimestamp');
      expect(rate_limits).toHaveProperty('lastCommentTimestamp');
      expect(rate_limits).toHaveProperty('lastFollowTimestamp');
      expect(rate_limits).toHaveProperty('lastDmTimestamp');
    });
  });
});

```

**Step 3: Install supertest dependency if not present**

Run: `npm list supertest`

If not installed, run: `npm install --save-dev supertest @types/supertest`

**Step 4: Run tests**

Run: `npm test -- services/action-queue/src/__tests__/database.observability.test.ts`

Expected: Tests pass (or show what's needed to fix)

Run: `npm test -- services/action-queue/src/__tests__/observability-endpoints.test.ts`

Expected: Tests pass

**Step 5: Run all action-queue tests**

Run: `npm test -- services/action-queue`

Expected: All tests pass

**Step 6: Commit**

```bash
git add services/action-queue/src/__tests__/
git commit -m "test(action-queue): add unit tests for observability endpoints and methods"

```

---

## Task 4: Verify TypeScript Compilation and Linting

**Files:**

- All action-queue service files (read-only verification)

**Step 1: Run TypeScript compiler in strict mode**

Run: `npx tsc --noEmit --strict`

Expected: No errors

**Step 2: Run oxlint**

Run: `npx oxlint services/action-queue/src/`

Expected: No new linting errors introduced

**Step 3: Run prettier (if configured)**

Run: `npx prettier --check services/action-queue/src/`

If format issues: `npx prettier --write services/action-queue/src/`

**Step 4: Verify all tests still pass**

Run: `npm test -- services/action-queue`

Expected: All tests pass

**Step 5: Build the service (if build script exists)**

Run: `npm run build` (if available in package.json)

Expected: Build succeeds

**Step 6: Final commit**

```bash
git status

# Should show clean working tree

```

If any uncommitted changes:

```bash
git add -A
git commit -m "chore(action-queue): final formatting and verification for Task 5"

```

---

## Verification Checklist

- [ ] DatabaseManager.getStats() returns complete statistics structure

- [ ] DatabaseManager.getJobHistory() retrieves job execution history

- [ ] DatabaseManager.getAgentMetrics() returns per-agent metrics

- [ ] GET /queue/stats endpoint returns JSON with statistics

- [ ] GET /queue/jobs/:id/history endpoint returns job history or 404

- [ ] GET /queue/agents/:name/metrics endpoint returns agent metrics

- [ ] All unit tests pass (database and endpoint tests)

- [ ] TypeScript compilation succeeds with no errors

- [ ] Linting passes (oxlint, prettier)

- [ ] All commits are logically grouped and meaningful

- [ ] No console errors when running service locally

---

## Testing the Implementation Locally

Once all tasks complete, test endpoints manually:

```bash

# Start the service
npm run dev

# In another terminal, test the endpoints:
curl <http://localhost:3007/queue/stats> | jq

curl <http://localhost:3007/queue/jobs/some-job-id/history> | jq

curl <http://localhost:3007/queue/agents/classical/metrics> | jq

```

---

**Next Steps After Completion:**

After Task 5 is complete:
- Task 6: Update environment configuration

- Task 7: Write integration tests

- Task 8: Add Dockerfile UID configuration

- Task 9: Create migration documentation

- Task 10: Final testing and verification
