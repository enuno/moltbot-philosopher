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
