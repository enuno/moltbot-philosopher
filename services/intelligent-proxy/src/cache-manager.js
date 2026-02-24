/**
 * CacheManager
 *
 * Implements graduated TTL caching strategy for challenge solutions.
 *
 * TTL Tiers:
 * - ≥ 0.95 confidence: 7 days
 * - 0.80-0.94: 3 days
 * - 0.60-0.79: 24 hours
 * - < 0.60 (failed): 12 hours
 */

class CacheManager {
  static TTL_TIERS = {
    HIGH: { confidence: 0.95, ttlDays: 7 },
    MEDIUM: { confidence: 0.80, ttlDays: 3 },
    LOW: { confidence: 0.60, ttlDays: 1 },
    FAILED: { confidence: 0, ttlHours: 12 }
  };

  static MS_PER_DAY = 24 * 60 * 60 * 1000;
  static MS_PER_HOUR = 60 * 60 * 1000;

  constructor() {
    this.cache = new Map(); // Map<challenge, { solution, expiresAt, ttl }>
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Calculate TTL in milliseconds based on confidence score
   * @param {number} confidence - Confidence score 0-1
   * @returns {number} TTL in milliseconds
   */
  _calculateTTL(confidence) {
    const { HIGH, MEDIUM, LOW, FAILED } = CacheManager.TTL_TIERS;

    if (confidence >= HIGH.confidence) return HIGH.ttlDays * CacheManager.MS_PER_DAY;
    if (confidence >= MEDIUM.confidence)
      return MEDIUM.ttlDays * CacheManager.MS_PER_DAY;
    if (confidence >= LOW.confidence) return LOW.ttlDays * CacheManager.MS_PER_DAY;
    return FAILED.ttlHours * CacheManager.MS_PER_HOUR;
  }

  /**
   * Cache a solution with graduated TTL
   * @param {string} challenge - Challenge text
   * @param {object} solution - Solution object with confidence score
   * @param {number} ttlMs - Optional override TTL in milliseconds
   */
  set(challenge, solution, ttlMs) {
    const ttl =
      ttlMs !== undefined ? ttlMs : this._calculateTTL(solution.confidence || 0);
    const expiresAt = Date.now() + ttl;

    this.cache.set(challenge, {
      solution,
      expiresAt,
      ttl
    });
  }

  /**
   * Retrieve cached solution if not expired
   * @param {string} challenge - Challenge text
   * @returns {object|null} Solution or null if expired/missing
   */
  get(challenge) {
    const entry = this.cache.get(challenge);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(challenge);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.solution;
  }

  /**
   * Get TTL for a cached challenge
   * @param {string} challenge - Challenge text
   * @returns {number} TTL in milliseconds
   */
  getTTL(challenge) {
    const entry = this.cache.get(challenge);
    return entry ? entry.ttl : 0;
  }

  /**
   * Invalidate a cache entry
   * @param {string} challenge - Challenge text
   */
  invalidate(challenge) {
    this.cache.delete(challenge);
  }

  /**
   * Get cache statistics
   * @returns {object} Stats object
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    // Calculate average confidence from cache
    let totalConfidence = 0;
    let count = 0;
    for (const entry of this.cache.values()) {
      if (entry.solution.confidence !== undefined) {
        totalConfidence += entry.solution.confidence;
        count++;
      }
    }

    return {
      totalEntries: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      averageConfidence: count > 0 ? totalConfidence / count : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = { hits: 0, misses: 0 };
  }
}

module.exports = CacheManager;
