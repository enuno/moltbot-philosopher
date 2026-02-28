/**
 * Debug output formatting for semantic search scoring
 *
 * Formats the debug information from scorePost() into human-readable
 * and machine-readable formats showing contribution percentages.
 */

import { ScoringResult } from "./types";

/**
 * Detailed breakdown showing how each scoring factor contributed to final score.
 * Contribution percentages show the % impact of each factor on the final score.
 *
 * Example: If semantic is 0.75, multipliers move it to 0.87:
 *   - recency -8% means recency multiplier reduced score by ~8% relative to final
 *   - reputation +10% means reputation multiplier increased score by ~10% relative to final
 *   - followBoost +25% means follow boost increased score by ~25% relative to final
 */
export interface DebugBreakdown {
  postId: string;
  baseScore: number;                    // Semantic score (input to multipliers)
  finalScore: number;                   // Final combined score
  factors: {
    recency: {
      multiplier: number;               // Calculated recency multiplier
      contribution: number;              // Absolute impact: (multiplier - 1) × baseScore
      contributionPercent: number;      // Percent relative to final: (contribution / finalScore) × 100
    };
    reputation: {
      multiplier: number;
      contribution: number;
      contributionPercent: number;
    };
    followBoost: {
      multiplier: number;
      contribution: number;
      contributionPercent: number;
    };
  };
  totalChange: number;                  // Sum of all contributions: (finalScore - baseScore)
  totalChangePercent: number;           // Total change as percent of final score
}

/**
 * Calculate debug breakdown showing contribution of each scoring factor.
 *
 * Takes the debug output from scorePost() and calculates how much each
 * multiplier (recency, reputation, followBoost) contributed to the final score,
 * expressed as percentages relative to the final score.
 *
 * Contribution formula:
 * - Absolute contribution = (multiplier - 1) × baseScore
 * - Percent contribution = (contribution / finalScore) × 100
 *
 * Example:
 *   baseScore: 0.75 (semantic score)
 *   After recency (×0.92): 0.69
 *   After reputation (×1.10): 0.759
 *   After followBoost (×1.25): 0.949
 *   Recency contribution: (0.92 - 1) × 0.75 = -0.06 (absolute)
 *   Recency contribution: (-0.06 / 0.949) × 100 = -6.3% (relative to final)
 *
 * @param result - The ScoringResult from scorePost() with debug enabled
 * @returns DebugBreakdown with calculated contributions and percentages
 * @throws Error if result lacks required debug data or score validation fails
 */
export function calculateBreakdown(result: ScoringResult): DebugBreakdown {
  // Validate required fields exist
  if (!result.debug) {
    throw new Error(
      `Debug data required. Ensure debug flag enabled in scorePost() for post ${result.postId}`
    );
  }

  const {
    postId,
    finalScore,
    debug: {
      semanticScore: baseScore,
      recencyMultiplier,
      reputationMultiplier,
      followBoost,
    },
  } = result;

  // Validate score calculation matches expected pipeline
  // Formula: semantic × recency × reputation × followBoost = final
  const expectedScore = baseScore * recencyMultiplier * reputationMultiplier * followBoost;

  const scoreError = Math.abs(expectedScore - finalScore);
  if (scoreError > 0.0001) {
    throw new Error(
      `Score calculation mismatch. Expected ${expectedScore.toFixed(4)}, ` +
      `got ${finalScore.toFixed(4)} (error: ${scoreError.toFixed(4)}). ` +
      `Check scorer pipeline integrity.`
    );
  }

  // Calculate contribution of each factor
  // Contribution = (multiplier - 1) × baseScore (absolute impact)
  const recencyContribution = (recencyMultiplier - 1) * baseScore;
  const reputationContribution = (reputationMultiplier - 1) * baseScore;
  const followBoostContribution = (followBoost - 1) * baseScore;

  // Total change from baseline to final score
  const totalChange = finalScore - baseScore;

  // Calculate contribution percentages relative to final score
  // This shows what % of the final score each factor changed
  const recencyPercent = (recencyContribution / finalScore) * 100;
  const reputationPercent = (reputationContribution / finalScore) * 100;
  const followBoostPercent = (followBoostContribution / finalScore) * 100;
  const totalChangePercent = (totalChange / finalScore) * 100;

  return {
    postId,
    baseScore,
    finalScore,
    factors: {
      recency: {
        multiplier: recencyMultiplier,
        contribution: recencyContribution,
        contributionPercent: recencyPercent,
      },
      reputation: {
        multiplier: reputationMultiplier,
        contribution: reputationContribution,
        contributionPercent: reputationPercent,
      },
      followBoost: {
        multiplier: followBoost,
        contribution: followBoostContribution,
        contributionPercent: followBoostPercent,
      },
    },
    totalChange,
    totalChangePercent,
  };
}

/**
 * Format a single-line debug breakdown for logs and API responses.
 *
 * Compact format showing score progression through each factor:
 * "Post abc123 | Semantic: 0.75 (base) | Recency: -8% (0.92×) | Reputation: +10% (1.10×) | Follow: +25% (1.25×) → Final: 0.87"
 *
 * Format: "Post {postId} | Semantic: {base} (base) | {Factor}: {percent}% ({mult}×) | ... → Final: {final}"
 *
 * Percentages are contribution percentages:
 * - Negative = factor reduced the score
 * - Positive = factor increased the score
 * - Shows impact relative to final score
 *
 * @param result - ScoringResult with debug enabled
 * @returns Single-line string suitable for logs, API responses, or CLI output
 */
export function formatDebugBreakdown(result: ScoringResult): string {
  const breakdown = calculateBreakdown(result);

  // Format contribution percentages with sign and decimal precision
  const formatPercent = (pct: number): string => {
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  };

  // Build factor strings: "Factor: ±X.X% (M.MM×)"
  const recencyStr = `Recency: ${formatPercent(breakdown.factors.recency.contributionPercent)} (${breakdown.factors.recency.multiplier.toFixed(2)}×)`;
  const reputationStr = `Reputation: ${formatPercent(breakdown.factors.reputation.contributionPercent)} (${breakdown.factors.reputation.multiplier.toFixed(2)}×)`;
  const followStr = `Follow: ${formatPercent(breakdown.factors.followBoost.contributionPercent)} (${breakdown.factors.followBoost.multiplier.toFixed(2)}×)`;

  // Assemble single-line format
  return (
    `Post ${breakdown.postId} | ` +
    `Semantic: ${breakdown.baseScore.toFixed(4)} (base) | ` +
    `${recencyStr} | ` +
    `${reputationStr} | ` +
    `${followStr} | ` +
    `→ Final: ${breakdown.finalScore.toFixed(4)}`
  );
}
