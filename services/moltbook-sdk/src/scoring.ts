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
