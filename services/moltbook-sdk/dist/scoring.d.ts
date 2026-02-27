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
/**
 * Normalize scores to [0, 1] range using min-max scaling
 *
 * Formula: (score - min) / (max - min)
 *
 * @param scores Array of numeric scores to normalize
 * @returns Array of normalized scores in [0, 1], or array of 0s if all scores are identical
 */
export declare function normalizeScores(scores: number[]): number[];
/**
 * Main orchestrator function combining all scoring factors multiplicatively
 *
 * Formula: final_score = semantic × M_recency × M_reputation × F
 *
 * where:
 *   M_recency = (0.5 ^ (age / half_life)) ^ exponent
 *   M_reputation = clamp(1.0 + H×hist + R×recent, 0.5, 1.5) ^ exponent
 *   F = 1.25 (if followed) or 1.0 (else)
 *
 * @param input PostScoringInputs with all required fields
 * @param weights Optional ScoringWeights (uses defaults if omitted)
 * @returns ScoringResult with finalScore and optional debug info
 */
export declare function scorePost(input: any, weights?: any): any;
//# sourceMappingURL=scoring.d.ts.map