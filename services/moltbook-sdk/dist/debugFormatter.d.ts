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
    baseScore: number;
    finalScore: number;
    factors: {
        recency: {
            multiplier: number;
            contribution: number;
            contributionPercent: number;
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
    totalChange: number;
    totalChangePercent: number;
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
export declare function calculateBreakdown(result: ScoringResult): DebugBreakdown;
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
export declare function formatDebugBreakdown(result: ScoringResult): string;
/**
 * Format a multi-line debug breakdown for CLI display.
 *
 * Pretty-printed format with aligned columns, showing scores at each
 * transformation stage. Suitable for terminal output and detailed logging.
 *
 * Example output:
 * ```
 * Post: abc123
 * Semantic (base):     0.7500
 * After Recency:       0.6900  (-8.0%)
 * After Reputation:    0.7590  (+10.0%)
 * After FollowBoost:   0.9488  (+25.0%)
 * ─────────────────────────────
 * Final Score:         0.9488
 * Total Change:        +0.1988 (+26.5%)
 * ```
 *
 * @param result - ScoringResult with debug enabled
 * @returns Multi-line formatted string for CLI display
 */
export declare function formatDebugBreakdownMultiline(result: ScoringResult): string;
/**
 * Format debug breakdown as structured JSON.
 *
 * Returns the DebugBreakdown object as a JSON string. Suitable for
 * API responses, data interchange, and structured logging systems.
 *
 * @param result - ScoringResult with debug enabled
 * @returns JSON string of DebugBreakdown object
 */
export declare function formatDebugBreakdownJSON(result: ScoringResult): string;
/**
 * Format multiple debug breakdowns in a compact batch format.
 *
 * Compares multiple results side-by-side in a compact comma-separated
 * format. Useful for comparing scoring results across multiple posts.
 *
 * Example output:
 * ```
 * Post abc | Sem: 0.7500 | Rec: -8.0% | Rep: +10.0% | Fol: +25.0% → 0.9488
 * Post def | Sem: 0.8200 | Rec: -5.2% | Rep: +8.5% | Fol: +15.0% → 0.9550
 * Post ghi | Sem: 0.6100 | Rec: -10.1% | Rep: +12.0% | Fol: +20.0% → 0.7256
 * ```
 *
 * @param results - Array of ScoringResult objects with debug enabled
 * @returns Single string with one result per line, compact format
 */
export declare function formatDebugBreakdownBatch(results: ScoringResult[]): string;
//# sourceMappingURL=debugFormatter.d.ts.map