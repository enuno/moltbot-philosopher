import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import {
  QueuedAction,
  ActionStatus,
  ActionType,
  Priority,
  RateLimitState,
  ConditionEvaluation,
  ConditionalAction,
} from './types';
import { QUEUE_CONFIG } from './config';

/**
 * Database Manager for Action Queue
 *
 * Handles SQLite operations for:
 * - Actions queue
 * - Rate limit tracking
 * - Agent profiles
 * - Condition evaluations
 */
export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string = QUEUE_CONFIG.dbPath) {
    // Ensure data directory exists
    const dataDir = dirname(dbPath);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better concurrency
    this.db.pragma('foreign_keys = ON'); // Enforce foreign keys

    this.initialize();
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    // Actions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        agent_name TEXT NOT NULL,
        action_type TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 1,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        scheduled_for INTEGER,
        created_at INTEGER NOT NULL,
        attempted_at INTEGER,
        completed_at INTEGER,
        failed_at INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        error TEXT,
        http_status INTEGER,
        metadata TEXT,
        conditions TEXT,
        condition_check_interval INTEGER,
        condition_timeout INTEGER,
        last_condition_check INTEGER
      );
    `);

    // Rate limits table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        action_type TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        daily_count INTEGER NOT NULL DEFAULT 1,
        daily_reset INTEGER NOT NULL,
        UNIQUE(agent_name, action_type, window_start)
      );
    `);

    // Agents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        name TEXT PRIMARY KEY,
        registered_at INTEGER NOT NULL,
        is_new INTEGER NOT NULL DEFAULT 1,
        last_activity INTEGER
      );
    `);

    // Condition evaluations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS condition_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_id TEXT NOT NULL,
        condition_id TEXT NOT NULL,
        condition_type TEXT NOT NULL,
        satisfied INTEGER NOT NULL,
        evaluated_at INTEGER NOT NULL,
        message TEXT,
        details TEXT,
        FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
      );
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_actions_status
        ON actions(status);
      CREATE INDEX IF NOT EXISTS idx_actions_scheduled
        ON actions(scheduled_for);
      CREATE INDEX IF NOT EXISTS idx_actions_agent
        ON actions(agent_name);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
        ON rate_limits(agent_name, action_type);
      CREATE INDEX IF NOT EXISTS idx_condition_evaluations_action
        ON condition_evaluations(action_id);
    `);
  }

  /**
   * Insert a new action into the queue
   */
  insertAction(action: QueuedAction): void {
    const stmt = this.db.prepare(`
      INSERT INTO actions (
        id, agent_name, action_type, priority, payload, status,
        scheduled_for, created_at, attempts, max_attempts, metadata,
        conditions, condition_check_interval, condition_timeout
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const conditionalAction = action as ConditionalAction;

    stmt.run(
      action.id,
      action.agentName,
      action.actionType,
      action.priority,
      JSON.stringify(action.payload),
      action.status,
      action.scheduledFor
        ? Math.floor(action.scheduledFor.getTime() / 1000)
        : null,
      Math.floor(action.createdAt.getTime() / 1000),
      action.attempts,
      action.maxAttempts,
      action.metadata ? JSON.stringify(action.metadata) : null,
      conditionalAction.conditions
        ? JSON.stringify(conditionalAction.conditions)
        : null,
      conditionalAction.conditionCheckInterval || null,
      conditionalAction.conditionTimeout
        ? Math.floor(conditionalAction.conditionTimeout.getTime() / 1000)
        : null,
    );
  }

  /**
   * Get action by ID
   */
  getAction(actionId: string): QueuedAction | null {
    const stmt = this.db.prepare('SELECT * FROM actions WHERE id = ?');
    const row = stmt.get(actionId) as any;

    if (!row) return null;
    return this.rowToAction(row);
  }

  /**
   * Get next eligible action for processing
   */
  getNextAction(): QueuedAction | null {
    const stmt = this.db.prepare(`
      SELECT * FROM actions
      WHERE status = 'pending'
        AND (scheduled_for IS NULL OR scheduled_for <= ?)
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `);

    const now = Math.floor(Date.now() / 1000);
    const row = stmt.get(now) as any;

    if (!row) return null;
    return this.rowToAction(row);
  }

  /**
   * Get actions by status
   */
  getActionsByStatus(
    status: ActionStatus,
    limit: number = 100,
  ): QueuedAction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM actions
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(status, limit) as any[];
    return rows.map((row) => this.rowToAction(row));
  }

  /**
   * Get conditional actions due for check
   */
  getConditionalActionsDueForCheck(): ConditionalAction[] {
    const now = Math.floor(Date.now() / 1000);

    const stmt = this.db.prepare(`
      SELECT * FROM actions
      WHERE status = 'scheduled'
        AND conditions IS NOT NULL
        AND (last_condition_check IS NULL
             OR last_condition_check + condition_check_interval <= ?)
        AND (condition_timeout IS NULL OR condition_timeout > ?)
      ORDER BY priority DESC, created_at ASC
      LIMIT 50
    `);

    const rows = stmt.all(now, now) as any[];
    return rows.map((row) => this.rowToAction(row)) as ConditionalAction[];
  }

  /**
   * Update action status
   */
  updateActionStatus(
    actionId: string,
    status: ActionStatus,
    error?: string,
    httpStatus?: number,
  ): void {
    const now = Math.floor(Date.now() / 1000);
    let updateFields = 'status = ?';
    const params: any[] = [status];

    if (status === ActionStatus.PROCESSING) {
      updateFields += ', attempted_at = ?';
      params.push(now);
    } else if (status === ActionStatus.COMPLETED) {
      updateFields += ', completed_at = ?';
      params.push(now);
    } else if (status === ActionStatus.FAILED) {
      updateFields += ', failed_at = ?, error = ?, http_status = ?';
      params.push(now, error || null, httpStatus || null);
    }

    params.push(actionId);

    const stmt = this.db.prepare(
      `UPDATE actions SET ${updateFields} WHERE id = ?`,
    );
    stmt.run(...params);
  }

  /**
   * Increment action attempt count
   */
  incrementAttempts(actionId: string): void {
    const stmt = this.db.prepare(`
      UPDATE actions
      SET attempts = attempts + 1
      WHERE id = ?
    `);
    stmt.run(actionId);
  }

  /**
   * Update last condition check time
   */
  updateLastConditionCheck(actionId: string): void {
    const stmt = this.db.prepare(`
      UPDATE actions
      SET last_condition_check = ?
      WHERE id = ?
    `);
    stmt.run(Math.floor(Date.now() / 1000), actionId);
  }

  /**
   * Update scheduled_for time for an action (used for retry backoff and rate-limit deferral)
   */
  updateScheduledFor(actionId: string, scheduledFor: Date): void {
    const stmt = this.db.prepare(`
      UPDATE actions
      SET scheduled_for = ?
      WHERE id = ?
    `);
    stmt.run(Math.floor(scheduledFor.getTime() / 1000), actionId);
  }

  /**
   * Activate time-based scheduled actions whose scheduled_for time has passed.
   * Transitions status='scheduled' (no conditions) to 'pending' when ready.
   * Returns count of activated actions.
   */
  activateReadyScheduledActions(): number {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      UPDATE actions
      SET status = 'pending'
      WHERE status = 'scheduled'
        AND scheduled_for IS NOT NULL
        AND scheduled_for <= ?
        AND (conditions IS NULL OR conditions = 'null')
    `);
    const result = stmt.run(now);
    return result.changes;
  }

  /**
   * Cancel action
   */
  cancelAction(actionId: string, reason?: string): void {
    const stmt = this.db.prepare(`
      UPDATE actions
      SET status = 'cancelled', error = ?
      WHERE id = ?
    `);
    stmt.run(reason || 'Cancelled by user', actionId);
  }

  /**
   * Record rate limit usage
   */
  recordRateLimit(
    agentName: string,
    actionType: ActionType,
    intervalSeconds: number,
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / intervalSeconds) * intervalSeconds;
    const dailyReset = Math.floor(now / 86400) * 86400 + 86400; // Next midnight

    // Try to increment existing window
    const updateStmt = this.db.prepare(`
      UPDATE rate_limits
      SET count = count + 1, daily_count = daily_count + 1
      WHERE agent_name = ?
        AND action_type = ?
        AND window_start = ?
    `);

    const result = updateStmt.run(agentName, actionType, windowStart);

    // If no existing window, insert new
    if (result.changes === 0) {
      const insertStmt = this.db.prepare(`
        INSERT INTO rate_limits (
          agent_name, action_type, window_start, count, daily_count, daily_reset
        ) VALUES (?, ?, ?, 1, 1, ?)
      `);
      insertStmt.run(agentName, actionType, windowStart, dailyReset);
    }
  }

  /**
   * Get rate limit state
   */
  getRateLimitState(
    agentName: string,
    actionType: ActionType,
  ): RateLimitState | null {
    const stmt = this.db.prepare(`
      SELECT * FROM rate_limits
      WHERE agent_name = ? AND action_type = ?
      ORDER BY window_start DESC
      LIMIT 1
    `);

    const row = stmt.get(agentName, actionType) as any;
    if (!row) return null;

    return {
      actionType,
      agentName,
      windowStart: new Date(row.window_start * 1000),
      count: row.count,
      dailyCount: row.daily_count,
      dailyReset: new Date(row.daily_reset * 1000),
    };
  }

  /**
   * Clean up old rate limit records
   */
  cleanupOldRateLimits(daysToKeep: number = 7): void {
    const cutoff = Math.floor(Date.now() / 1000) - daysToKeep * 86400;
    const stmt = this.db.prepare(
      'DELETE FROM rate_limits WHERE window_start < ?',
    );
    stmt.run(cutoff);
  }

  /**
   * Register or update agent
   */
  upsertAgent(agentName: string, isNew: boolean = false): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO agents (name, registered_at, is_new, last_activity)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        last_activity = excluded.last_activity,
        is_new = excluded.is_new
    `);
    stmt.run(agentName, now, isNew ? 1 : 0, now);
  }

  /**
   * Check if agent is new (within first 24 hours)
   */
  isNewAgent(agentName: string): boolean {
    const stmt = this.db.prepare(`
      SELECT is_new, registered_at FROM agents WHERE name = ?
    `);
    const row = stmt.get(agentName) as any;

    if (!row) return false;
    if (!row.is_new) return false;

    // Check if more than 24 hours since registration
    const now = Math.floor(Date.now() / 1000);
    const age = now - row.registered_at;
    return age < 86400; // 24 hours
  }

  /**
   * Store condition evaluation
   */
  storeConditionEvaluation(
    actionId: string,
    evaluation: ConditionEvaluation,
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO condition_evaluations (
        action_id, condition_id, condition_type, satisfied,
        evaluated_at, message, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      actionId,
      evaluation.conditionId,
      evaluation.type,
      evaluation.satisfied ? 1 : 0,
      Math.floor(evaluation.evaluatedAt.getTime() / 1000),
      evaluation.message || null,
      evaluation.details ? JSON.stringify(evaluation.details) : null,
    );
  }

  /**
   * Get condition evaluations for action
   */
  getConditionEvaluations(actionId: string): ConditionEvaluation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM condition_evaluations
      WHERE action_id = ?
      ORDER BY evaluated_at DESC
      LIMIT 100
    `);

    const rows = stmt.all(actionId) as any[];
    return rows.map((row) => ({
      conditionId: row.condition_id,
      type: row.condition_type,
      satisfied: row.satisfied === 1,
      evaluatedAt: new Date(row.evaluated_at * 1000),
      message: row.message,
      details: row.details ? JSON.parse(row.details) : undefined,
    }));
  }

  /**
   * Get queue statistics
   */
  getStats(): any {
    const stats: any = {};

    // Count by status
    const statusStmt = this.db.prepare(`
      SELECT status, COUNT(*) as count
      FROM actions
      GROUP BY status
    `);
    const statusRows = statusStmt.all() as any[];
    statusRows.forEach((row) => {
      stats[row.status] = row.count;
    });

    // Oldest pending
    const oldestStmt = this.db.prepare(`
      SELECT MIN(created_at) as oldest
      FROM actions
      WHERE status = 'pending'
    `);
    const oldestRow = oldestStmt.get() as any;
    if (oldestRow?.oldest) {
      stats.oldestPending = new Date(oldestRow.oldest * 1000);
    }

    // Next scheduled
    const nextStmt = this.db.prepare(`
      SELECT MIN(scheduled_for) as next
      FROM actions
      WHERE status = 'scheduled' AND scheduled_for IS NOT NULL
    `);
    const nextRow = nextStmt.get() as any;
    if (nextRow?.next) {
      stats.nextScheduled = new Date(nextRow.next * 1000);
    }

    // Total actions
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM actions');
    const totalRow = totalStmt.get() as any;
    stats.totalActions = totalRow.count;

    return stats;
  }

  /**
   * Convert database row to QueuedAction
   */
  private rowToAction(row: any): QueuedAction {
    const action: ConditionalAction = {
      id: row.id,
      agentName: row.agent_name,
      actionType: row.action_type as ActionType,
      priority: row.priority as Priority,
      payload: JSON.parse(row.payload),
      status: row.status as ActionStatus,
      scheduledFor: row.scheduled_for
        ? new Date(row.scheduled_for * 1000)
        : undefined,
      createdAt: new Date(row.created_at * 1000),
      attemptedAt: row.attempted_at
        ? new Date(row.attempted_at * 1000)
        : undefined,
      completedAt: row.completed_at
        ? new Date(row.completed_at * 1000)
        : undefined,
      failedAt: row.failed_at ? new Date(row.failed_at * 1000) : undefined,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      error: row.error || undefined,
      httpStatus: row.http_status || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      conditions: row.conditions ? JSON.parse(row.conditions) : undefined,
      conditionCheckInterval: row.condition_check_interval || undefined,
      conditionTimeout: row.condition_timeout
        ? new Date(row.condition_timeout * 1000)
        : undefined,
      lastConditionCheck: row.last_condition_check
        ? new Date(row.last_condition_check * 1000)
        : undefined,
    };

    return action;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database instance (for direct access if needed)
   */
  getDb(): Database.Database {
    return this.db;
  }
}
