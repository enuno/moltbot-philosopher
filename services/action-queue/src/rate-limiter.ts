import { DatabaseManager } from './database';
import { ActionType, RateLimitState } from './types';

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
   */
  async canExecute(agentName: string, actionType: ActionType): Promise<boolean> {
    const limits = await this.getRateLimitState(agentName);
    const now = Math.floor(Date.now() / 1000); // unix timestamp in seconds

    switch (actionType) {
      case ActionType.POST:
        // 30-minute cooldown between posts
        return (now - limits.lastPostTimestamp) > 1800;
      case ActionType.COMMENT:
        // 20-second cooldown between comments
        return (now - limits.lastCommentTimestamp) > 20;
      case ActionType.FOLLOW:
        // 1-minute cooldown between follows
        return (now - limits.lastFollowTimestamp) > 60;
      case ActionType.SEND_DM:
        // 5-minute cooldown between DMs
        return (now - limits.lastDmTimestamp) > 300;
      default:
        return true;
    }
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
