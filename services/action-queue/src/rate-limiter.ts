import { DatabaseManager } from './database';
import { ActionType, QueuedAction } from './types';
import {
  RATE_LIMITS,
  NEW_AGENT_RATE_LIMITS,
  GLOBAL_API_LIMIT,
  getRateLimitsForAgent,
} from './config';

/**
 * Rate Limiter Engine
 *
 * Enforces Moltbook API rate limits based on SKILL.md rules:
 * - Per-action-type limits (posts, comments, follows, etc.)
 * - Daily limits
 * - Global API throttling (100 req/min)
 * - Different limits for new agents (first 24 hours)
 */
export class RateLimiter {
  // API-confirmed daily blocks: key = "agentName:actionType", value = block expiry (next midnight UTC)
  private apiDailyBlocks: Map<string, Date> = new Map();

  constructor(private db: DatabaseManager) {}

  /**
   * Sync rate limit state from a 429 API response body.
   *
   * Moltbook 429 responses include `daily_remaining` in the body. When the API
   * confirms 0 remaining, we block locally until next midnight UTC rather than
   * relying solely on our local counter (which may drift).
   */
  syncFromApiResponse(
    agentName: string,
    actionType: ActionType,
    dailyRemaining: number,
  ): void {
    if (dailyRemaining === 0) {
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);
      this.apiDailyBlocks.set(`${agentName}:${actionType}`, tomorrow);
      console.debug(
        `[RateLimiter] API confirmed daily limit for ${actionType} on ${agentName} - blocked until ${tomorrow.toISOString()}`,
      );
    }
  }

  /**
   * Check if action can proceed without violating rate limits
   */
  async isAllowed(action: QueuedAction): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const { agentName, actionType } = action;

    // Check API-confirmed daily block (from 429 response body)
    const blockKey = `${agentName}:${actionType}`;
    const blockUntil = this.apiDailyBlocks.get(blockKey);
    if (blockUntil && new Date() < blockUntil) {
      const retryAfter = Math.ceil((blockUntil.getTime() - Date.now()) / 1000);
      return {
        allowed: false,
        reason: `Daily limit reached (API confirmed 0 remaining for ${actionType})`,
        retryAfter,
      };
    }

    // Check global API limit first
    const globalCheck = await this.checkGlobalLimit();
    if (!globalCheck.allowed) {
      return globalCheck;
    }

    // Get rate limit config for this agent/action
    const isNew = this.db.isNewAgent(agentName);
    const limits = getRateLimitsForAgent(agentName, isNew);
    const config = limits[actionType];

    if (!config) {
      return {
        allowed: false,
        reason: `No rate limit configuration for action type: ${actionType}`,
      };
    }

    // Check if action is blocked for new agents
    if (config.maxPerInterval === 0) {
      return {
        allowed: false,
        reason: `Action type ${actionType} is blocked for new agents`,
      };
    }

    // Check interval-based limit
    const intervalCheck = await this.checkIntervalLimit(
      agentName,
      actionType,
      config.maxPerInterval,
      config.intervalSeconds,
    );
    if (!intervalCheck.allowed) {
      return intervalCheck;
    }

    // Check daily limit
    if (config.dailyMax) {
      const dailyCheck = await this.checkDailyLimit(
        agentName,
        actionType,
        config.dailyMax,
      );
      if (!dailyCheck.allowed) {
        return dailyCheck;
      }
    }

    return { allowed: true };
  }

  /**
   * Check global API limit (100 requests per minute across all agents)
   */
  private async checkGlobalLimit(): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart =
      Math.floor(now / GLOBAL_API_LIMIT.intervalSeconds) *
      GLOBAL_API_LIMIT.intervalSeconds;

    // Count all actions in current window
    const stmt = this.db.getDb().prepare(`
      SELECT COUNT(*) as count
      FROM actions
      WHERE attempted_at >= ?
        AND status IN ('processing', 'completed')
    `);

    const result = stmt.get(windowStart) as any;
    const count = result?.count || 0;

    if (count >= GLOBAL_API_LIMIT.maxPerInterval) {
      const windowEnd = windowStart + GLOBAL_API_LIMIT.intervalSeconds;
      const retryAfter = windowEnd - now;

      return {
        allowed: false,
        reason: `Global API limit reached (${count}/${GLOBAL_API_LIMIT.maxPerInterval} requests in current minute)`,
        retryAfter,
      };
    }

    return { allowed: true };
  }

  /**
   * Check interval-based rate limit (e.g., 1 post per 30 minutes)
   */
  private async checkIntervalLimit(
    agentName: string,
    actionType: ActionType,
    maxPerInterval: number,
    intervalSeconds: number,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const state = this.db.getRateLimitState(agentName, actionType);

    if (!state) {
      // No previous actions, allowed
      return { allowed: true };
    }

    const now = new Date();
    const windowAge =
      (now.getTime() - state.windowStart.getTime()) / 1000;

    // If window has expired, allowed
    if (windowAge >= intervalSeconds) {
      return { allowed: true };
    }

    // Check if count within limit
    if (state.count < maxPerInterval) {
      return { allowed: true };
    }

    // Rate limited
    const retryAfter = Math.ceil(intervalSeconds - windowAge);
    return {
      allowed: false,
      reason: `Rate limit: ${maxPerInterval} ${actionType} per ${this.formatDuration(intervalSeconds)} (wait ${this.formatDuration(retryAfter)})`,
      retryAfter,
    };
  }

  /**
   * Check daily limit
   */
  private async checkDailyLimit(
    agentName: string,
    actionType: ActionType,
    dailyMax: number,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const state = this.db.getRateLimitState(agentName, actionType);

    if (!state) {
      return { allowed: true };
    }

    const now = new Date();

    // Check if daily reset has occurred
    if (now >= state.dailyReset) {
      return { allowed: true };
    }

    // Check daily count
    if (state.dailyCount < dailyMax) {
      return { allowed: true };
    }

    // Daily limit reached
    const retryAfter = Math.ceil(
      (state.dailyReset.getTime() - now.getTime()) / 1000,
    );

    return {
      allowed: false,
      reason: `Daily limit reached: ${state.dailyCount}/${dailyMax} ${actionType} today (resets in ${this.formatDuration(retryAfter)})`,
      retryAfter,
    };
  }

  /**
   * Record that an action was executed (for rate limiting)
   */
  recordAction(action: QueuedAction): void {
    const { agentName, actionType } = action;

    // Get appropriate config
    const isNew = this.db.isNewAgent(agentName);
    const limits = getRateLimitsForAgent(agentName, isNew);
    const config = limits[actionType];

    if (config) {
      this.db.recordRateLimit(
        agentName,
        actionType,
        config.intervalSeconds,
      );
    }

    // Update agent last activity
    this.db.upsertAgent(agentName, isNew);
  }

  /**
   * Get current rate limit status for an agent
   */
  getStatus(
    agentName: string,
  ): {
    agentName: string;
    isNewAgent: boolean;
    limits: Record<ActionType, any>;
  } {
    const isNew = this.db.isNewAgent(agentName);
    const limits = getRateLimitsForAgent(agentName, isNew);

    const status: any = {
      agentName,
      isNewAgent: isNew,
      limits: {},
    };

    // Get current state for each action type
    for (const actionType of Object.values(ActionType)) {
      const state = this.db.getRateLimitState(agentName, actionType);
      const config = limits[actionType];

      if (!config) continue;

      const now = new Date();
      let available = true;
      let nextAvailable: Date | null = null;

      if (state) {
        const windowAge =
          (now.getTime() - state.windowStart.getTime()) / 1000;

        // Check interval limit
        if (
          windowAge < config.intervalSeconds &&
          state.count >= config.maxPerInterval
        ) {
          available = false;
          nextAvailable = new Date(
            state.windowStart.getTime() + config.intervalSeconds * 1000,
          );
        }

        // Check daily limit
        if (
          config.dailyMax &&
          state.dailyCount >= config.dailyMax &&
          now < state.dailyReset
        ) {
          available = false;
          if (
            !nextAvailable ||
            state.dailyReset.getTime() > nextAvailable.getTime()
          ) {
            nextAvailable = state.dailyReset;
          }
        }
      }

      status.limits[actionType] = {
        config: {
          maxPerInterval: config.maxPerInterval,
          intervalSeconds: config.intervalSeconds,
          dailyMax: config.dailyMax,
        },
        current: state
          ? {
              count: state.count,
              windowStart: state.windowStart,
              dailyCount: state.dailyCount,
              dailyReset: state.dailyReset,
            }
          : null,
        available,
        nextAvailable,
      };
    }

    return status;
  }

  /**
   * Format duration in human-readable form
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      return `${Math.ceil(seconds / 60)}m`;
    } else if (seconds < 86400) {
      return `${Math.ceil(seconds / 3600)}h`;
    } else {
      return `${Math.ceil(seconds / 86400)}d`;
    }
  }

  /**
   * Clean up old rate limit records (maintenance)
   */
  cleanup(daysToKeep: number = 7): void {
    this.db.cleanupOldRateLimits(daysToKeep);
  }
}
