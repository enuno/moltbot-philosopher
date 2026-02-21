import { DatabaseManager } from './database';
import { ActionType, RateLimitState } from './types';
import { RATE_LIMITS } from './config';

/**
 * Rate Limiter
 *
 * Enforces per-agent rate limits by tracking last execution timestamps
 * Uses in-memory cache (60s TTL) for performance with PostgreSQL as source of truth
 */
export class RateLimiter {
  private db: DatabaseManager;

  // In-memory cache for performance (invalidate every 60s)
  private cache = new Map<string, RateLimitState>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 60000; // 60 seconds

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  /**
   * Check if an action can execute based on rate limits
   * Uses rate limit configuration from config.ts
   */
  async canExecute(agentName: string, actionType: ActionType): Promise<boolean> {
    const limits = await this.getRateLimitState(agentName);
    const now = Math.floor(Date.now() / 1000); // unix timestamp in seconds
    const config = RATE_LIMITS[actionType];

    if (!config) {
      // No rate limit config for this action type, allow execution
      return true;
    }

    // Get the appropriate timestamp for this action type
    let lastTimestamp = 0;
    switch (actionType) {
      case ActionType.POST:
        lastTimestamp = limits.lastPostTimestamp;
        break;
      case ActionType.COMMENT:
        lastTimestamp = limits.lastCommentTimestamp;
        break;
      case ActionType.FOLLOW:
      case ActionType.UNFOLLOW:
        lastTimestamp = limits.lastFollowTimestamp;
        break;
      case ActionType.SEND_DM:
        lastTimestamp = limits.lastDmTimestamp;
        break;
      case ActionType.UPVOTE:
      case ActionType.DOWNVOTE:
      case ActionType.CREATE_SUBMOLT:
      case ActionType.SKILL_UPDATE:
        // These use lastPostTimestamp as default for now
        lastTimestamp = limits.lastPostTimestamp;
        break;
      default:
        return true;
    }

    // Check if enough time has passed since last execution
    const timeSinceLastExecution = now - lastTimestamp;
    return timeSinceLastExecution > config.intervalSeconds;
  }

  /**
   * Update last execution time for an action type
   */
  async updateLastExecution(agentName: string, actionType: ActionType): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const limits = await this.getRateLimitState(agentName);

    switch (actionType) {
      case ActionType.POST:
        limits.lastPostTimestamp = now;
        break;
      case ActionType.COMMENT:
        limits.lastCommentTimestamp = now;
        break;
      case ActionType.FOLLOW:
        limits.lastFollowTimestamp = now;
        break;
      case ActionType.SEND_DM:
        limits.lastDmTimestamp = now;
        break;
    }

    await this.db.updateRateLimit(agentName, limits);
    this.invalidateCache(agentName);
  }

  /**
   * Get rate limit state for agent (with caching)
   */
  private async getRateLimitState(agentName: string): Promise<RateLimitState> {
    // Check cache first
    if (this.cache.has(agentName)) {
      const expiry = this.cacheExpiry.get(agentName) || 0;
      if (expiry > Date.now()) {
        return this.cache.get(agentName)!;
      }
    }

    // Fetch from database
    const limits = await this.db.getRateLimit(agentName);
    this.cache.set(agentName, limits);
    this.cacheExpiry.set(agentName, Date.now() + this.CACHE_TTL);

    return limits;
  }

  /**
   * Invalidate cache for an agent
   */
  private invalidateCache(agentName: string): void {
    this.cache.delete(agentName);
    this.cacheExpiry.delete(agentName);
  }

  /**
   * Get status of cached limits
   */
  getStatus(agentName: string): any {
    const cached = this.cache.get(agentName);
    return cached || { cached: false };
  }
}
