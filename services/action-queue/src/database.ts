import { Pool } from 'pg';
import PgBoss from 'pg-boss';
import { v4 as uuidv4 } from 'uuid';
import {
  QueuedAction,
  ActionStatus,
  ConditionalAction,
  RateLimitState,
} from './types';
import { QUEUE_CONFIG } from './config';

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
      console.log('✅ DatabaseManager initialized (PostgreSQL + pg-boss)');
    } catch (error) {
      console.error('❌ Failed to initialize DatabaseManager:', error);
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
    const jobId = uuidv4();

    try {
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
    } catch (error) {
      console.error('Failed to insert action:', error);
      throw error;
    }
  }

  /**
   * Get action by ID from action_logs
   */
  async getAction(id: string): Promise<ConditionalAction | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM action_logs WHERE job_id = $1`,
        [id]
      );
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
      console.error('Failed to get action:', error);
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
        [status, limit]
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
        [status, error || null, id]
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
        [agentName, state.lastPostTimestamp, state.lastCommentTimestamp, state.lastFollowTimestamp, state.lastDmTimestamp]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Log action to action_logs table for observability
   */
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

  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    try {
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
    } catch (error) {
      console.error('Failed to get stats:', error);
      return { queue_size: 0, logs_24h: [] };
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    try {
      await this.pgBoss.stop();
      await this.pool.end();
      console.log('✅ DatabaseManager closed');
    } catch (error) {
      console.error('Error closing DatabaseManager:', error);
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
        [ActionStatus.CANCELLED, reason, id]
      );

      // Also cancel the job in pg-boss
      try {
        await this.pgBoss.cancel('action:process', id);
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
