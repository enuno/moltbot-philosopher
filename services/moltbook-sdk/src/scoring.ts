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
export function calculateRecency(
  ageInDays: number,
  exponent: number = 1.0,
  halfLife: number = 7,
): number {
  if (ageInDays < 0) throw new Error("Age cannot be negative");
  if (halfLife <= 0) throw new Error("Half-life must be positive");
  if (exponent < 0) throw new Error("Exponent must be non-negative");

  const decayRate = Math.pow(0.5, ageInDays / halfLife);
  return Math.pow(decayRate, exponent);
}

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
export function calculateReputation(
  historicalScore: number,
  recentScore: number,
  historicalWeight: number = 0.5,
  recentWeight: number = 0.25,
  exponent: number = 1.0,
): number {
  if (historicalScore < 0 || historicalScore > 1)
    throw new Error("Historical score must be in [0, 1]");
  if (recentScore < 0 || recentScore > 1)
    throw new Error("Recent score must be in [0, 1]");
  if (historicalWeight < 0) throw new Error("Historical weight must be non-negative");
  if (recentWeight < 0) throw new Error("Recent weight must be non-negative");
  if (exponent < 0) throw new Error("Exponent must be non-negative");

  const base =
    1.0 + historicalWeight * historicalScore + recentWeight * recentScore;
  const clamped = Math.max(0.5, Math.min(1.5, base));
  return Math.pow(clamped, exponent);
}
