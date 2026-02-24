import { Pool, PoolClient } from "pg";
import PgBoss from "pg-boss";
import { v4 as uuidv4 } from "uuid";
import { QueuedAction, ActionStatus, ConditionalAction, RateLimitState } from "./types";
import { QUEUE_CONFIG } from "./config";

/**
 * Job history record with execution details
 */
export interface JobHistory {
  job_id: string;
  agent_name: string;
  action_type: string;
  status: string;
  attempts: number;
  created_at: Date;
  completed_at: Date | null;
  last_error: string | null;
  latency_seconds: number | null;
}

/**
 * Agent metrics including success rates and rate limits
 */
export interface AgentMetrics {
  agent_name: string;
  total_actions: number;
  completed: number;
  failed: number;
  pending: number;
  rate_limits: RateLimitState;
  last_action_at: Date | null;
  success_rate: number;
}

/**
 * Database Manager for Action Queue
 *
 * Handles PostgreSQL operations using pg-boss for:
 * - Actions queue (job management)
 * - Rate limit tracking
 * - Agent profiles
 * - Action logs (observability)
 */
export class DatabaseManager {
  private pool: Pool;
  private pgBoss: PgBoss;
  private initialized = false;

  constructor(dbUrl: string = QUEUE_CONFIG.dbUrl) {
    this.pool = new Pool({ connectionString: dbUrl });
    this.pgBoss = new PgBoss({ connectionString: dbUrl });
  }

  /**
   * Initialize database and pg-boss
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Start pg-boss (creates its tables automatically)
      await this.pgBoss.start();

      // Create custom tables
      await this.createCustomTables();

      this.initialized = true;
      console.log("✅ DatabaseManager initialized (PostgreSQL + pg-boss)");
    } catch (error) {
      console.error("❌ Failed to initialize DatabaseManager:", error);
      throw error;
    }
  }

  /**
   * Create custom application tables (rate_limits, agent_profiles, action_logs)
   */
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

  /**
   * Insert action into queue (pg-boss managed)
   */
  async insertAction(action: ConditionalAction): Promise<string> {
    const jobId = action.id || uuidv4();

    try {
      console.log(`📤 Attempting to send job to pg-boss: ${jobId}`, {
        queue: "action:process",
        agentName: action.agentName,
        actionType: action.actionType,
      });

      // Insert job into pg-boss queue
      const sendResult = await this.pgBoss.send("action:process", action, {
        id: jobId,
        priority: action.priority,
        retryLimit: action.maxAttempts - 1,
        singletonKey: action.agentName,
        singletonSeconds: 60,
      });

      console.log(`✅ Job sent to pg-boss:`, { jobId, sendResult });

      // Log the action for observability
      await this.logAction(jobId, action.agentName, action.actionType, "pending");

      return jobId;
    } catch (error) {
      console.error("Failed to insert action:", error);
      throw error;
    }
  }

  /**
   * Get action by ID from action_logs
   */
  async getAction(id: string): Promise<ConditionalAction | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`SELECT * FROM action_logs WHERE job_id = $1`, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      // Convert action_logs row to ConditionalAction
      const row = result.rows[0];
      return {
        id: row.job_id,
        agentName: row.agent_name,
        actionType: row.action_type,
        priority: 1, // Default priority (not tracked in logs)
        payload: {},
        status: row.status,
        createdAt: new Date(row.created_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        attempts: row.attempts || 0,
        maxAttempts: 3,
        error: row.last_error || undefined,
      } as ConditionalAction;
    } catch (error) {
      console.error("Failed to get action:", error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Get actions by status from action_logs
   */
  async getActionsByStatus(status: ActionStatus, limit: number = 100): Promise<QueuedAction[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM action_logs WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
        [status, limit],
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Update action status in action_logs
   */
  async updateActionStatus(id: string, status: ActionStatus, error?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE action_logs SET status = $1, last_error = $2, completed_at = NOW() WHERE job_id = $3`,
        [status, error || null, id],
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get rate limit state for an agent
   */
  async getRateLimit(agentName: string): Promise<RateLimitState> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`SELECT * FROM rate_limits WHERE agent_name = $1`, [
        agentName,
      ]);

      if (result.rows.length === 0) {
        // Initialize new rate limit
        await client.query(
          `INSERT INTO rate_limits(agent_name) VALUES($1) ON CONFLICT DO NOTHING`,
          [agentName],
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

  /**
   * Update rate limit state for an agent
   */
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
        [
          agentName,
          state.lastPostTimestamp,
          state.lastCommentTimestamp,
          state.lastFollowTimestamp,
          state.lastDmTimestamp,
        ],
      );
    } finally {
      client.release();
    }
  }

  /**
   * Log action to action_logs table for observability
   */
  private async logAction(
    jobId: string,
    agentName: string,
    actionType: string,
    status: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO action_logs(job_id, agent_name, action_type, status) VALUES($1, $2, $3, $4)`,
        [jobId, agentName, actionType, status],
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get comprehensive queue statistics with aggregations
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
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      // Get queue size from pg-boss
      const queueSize = await this.pgBoss.getQueueSize("action:process");

      // Query 1: Status breakdown
      const statusResult = await client.query(`
        SELECT status, COUNT(*) as count FROM action_logs
        GROUP BY status
      `);

      // Query 2: Per-agent breakdown
      const agentResult = await client.query(`
        SELECT
          agent_name,
          COUNT(*) as total_actions,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
        FROM action_logs
        GROUP BY agent_name
      `);

      // Query 3: Action type breakdown with success rates
      const actionTypeResult = await client.query(`
        SELECT
          action_type,
          COUNT(*) as count,
          ROUND(
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::numeric /
            COUNT(*)::numeric * 100, 2
          ) as success_rate
        FROM action_logs
        GROUP BY action_type
      `);

      // Query 4: Last 24h summary
      const last24hResult = await client.query(`
        SELECT
          COUNT(*) as total_created,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as total_completed,
          ROUND(
            AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))::numeric, 2
          ) as avg_latency_seconds
        FROM action_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);

      // Calculate summary counts
      const statusMap = new Map<string, number>();
      statusResult.rows.forEach((row: any) => {
        statusMap.set(row.status, parseInt(row.count));
      });

      const summary = {
        total_queued: statusMap.get("pending") || 0,
        total_completed: statusMap.get("completed") || 0,
        total_failed: statusMap.get("failed") || 0,
        queue_size: queueSize,
      };

      return {
        summary,
        by_status: statusResult.rows.map((row: any) => ({
          status: row.status,
          count: parseInt(row.count),
        })),
        by_agent: agentResult.rows.map((row: any) => ({
          agent_name: row.agent_name,
          total_actions: parseInt(row.total_actions),
          completed: parseInt(row.completed) || 0,
          failed: parseInt(row.failed) || 0,
          pending: parseInt(row.pending) || 0,
        })),
        by_action_type: actionTypeResult.rows.map((row: any) => ({
          action_type: row.action_type,
          count: parseInt(row.count),
          success_rate: parseFloat(row.success_rate) || 0,
        })),
        last_24h_summary: {
          total_created: parseInt(last24hResult.rows[0]?.total_created) || 0,
          total_completed: parseInt(last24hResult.rows[0]?.total_completed) || 0,
          avg_latency_seconds: parseFloat(last24hResult.rows[0]?.avg_latency_seconds) || 0,
        },
      };
    } catch (error) {
      console.error("Failed to get stats:", error);
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
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Get job execution history with latency calculation
   */
  async getJobHistory(jobId: string): Promise<JobHistory> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `
        SELECT
          job_id,
          agent_name,
          action_type,
          status,
          attempts,
          created_at,
          completed_at,
          last_error,
          EXTRACT(EPOCH FROM (completed_at - created_at)) as latency_seconds
        FROM action_logs
        WHERE job_id = $1
      `,
        [jobId],
      );

      if (result.rows.length === 0) {
        throw new Error(`Job not found: ${jobId}`);
      }

      const row = result.rows[0];
      return {
        job_id: row.job_id,
        agent_name: row.agent_name,
        action_type: row.action_type,
        status: row.status,
        attempts: row.attempts,
        created_at: row.created_at,
        completed_at: row.completed_at,
        last_error: row.last_error,
        latency_seconds: row.latency_seconds ? parseFloat(row.latency_seconds) : null,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get agent metrics including success rates and rate limit state
   */
  async getAgentMetrics(agentName: string): Promise<AgentMetrics> {
    const client = await this.pool.connect();
    try {
      // Query action counts
      const result = await client.query(
        `
        SELECT
          COUNT(*) as total_actions,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          MAX(created_at) as last_action_at
        FROM action_logs
        WHERE agent_name = $1
      `,
        [agentName],
      );

      const row = result.rows[0];
      const total = parseInt(row.total_actions) || 0;
      const completed = parseInt(row.completed) || 0;
      const successRate = total > 0 ? Math.round((completed / total) * 100 * 100) / 100 : 0;

      // Get rate limit state
      let rateLimits: RateLimitState;
      try {
        rateLimits = await this.getRateLimit(agentName);
      } catch (error) {
        console.error(`Failed to get rate limits for ${agentName}:`, error);
        rateLimits = {
          lastPostTimestamp: 0,
          lastCommentTimestamp: 0,
          lastFollowTimestamp: 0,
          lastDmTimestamp: 0,
        };
      }

      return {
        agent_name: agentName,
        total_actions: total,
        completed: completed,
        failed: parseInt(row.failed) || 0,
        pending: parseInt(row.pending) || 0,
        rate_limits: rateLimits,
        last_action_at: row.last_action_at,
        success_rate: successRate,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    try {
      await this.pgBoss.stop();
      await this.pool.end();
      console.log("✅ DatabaseManager closed");
    } catch (error) {
      console.error("Error closing DatabaseManager:", error);
    }
  }

  /**
   * Cancel an action by ID
   */
  async cancelAction(id: string, reason: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE action_logs SET status = $1, last_error = $2, completed_at = NOW() WHERE job_id = $3`,
        [ActionStatus.CANCELLED, reason, id],
      );

      // Also cancel the job in pg-boss
      try {
        await this.pgBoss.cancel("action:process", id);
      } catch (_) {
        // Job may not exist in pg-boss, that's okay
      }
    } finally {
      client.release();
    }
  }

  /**
   * Get condition evaluations for an action (placeholder for future implementation)
   */
  async getConditionEvaluations(_actionId: string): Promise<any[]> {
    // This will be implemented when condition evaluation tracking is added to the database schema
    return [];
  }

  /**
   * Expose pg-boss for queue subscription in queue-processor
   */
  getPgBoss(): PgBoss {
    return this.pgBoss;
  }
}
