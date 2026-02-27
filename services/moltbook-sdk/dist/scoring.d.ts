/**
 * Calculate recency multiplier with exponential decay
 *
 * Formula: (0.5 ^ (age / half_life)) ^ exponent
 *
 * @param ageInDays Number of days since post creation
 * @param exponent Multiplier exponent (default 1.0)
 * @param halfLife Half-life in days (default 7)
 * @returns Recency multiplier in (0, 1]
 */
export declare function calculateRecency(ageInDays: number, exponent?: number, halfLife?: number): number;
/**
 * Calculate reputation multiplier from historical and recent scores
 *
 * Formula: clamp(1.0 + H×historical + R×recent, 0.5, 1.5) ^ exponent
 *
 * @param historicalScore Author's long-term quality (0-1)
 * @param recentScore Author's recent engagement (0-1)
 * @param historicalWeight Weight for historical (default 0.5)
 * @param recentWeight Weight for recent (default 0.25)
 * @param exponent Multiplier exponent (default 1.0)
 * @returns Reputation multiplier in [0.5, 1.5]
 */
export declare function calculateReputation(historicalScore: number, recentScore: number, historicalWeight?: number, recentWeight?: number, exponent?: number): number;
//# sourceMappingURL=scoring.d.ts.map