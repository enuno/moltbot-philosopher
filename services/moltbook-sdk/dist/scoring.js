"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRecency = calculateRecency;
exports.calculateReputation = calculateReputation;
exports.normalizeScores = normalizeScores;
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
function calculateRecency(ageInDays, exponent = 1.0, halfLife = 7) {
    if (ageInDays < 0)
        throw new Error("Age cannot be negative");
    if (halfLife <= 0)
        throw new Error("Half-life must be positive");
    if (exponent < 0)
        throw new Error("Exponent must be non-negative");
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
function calculateReputation(historicalScore, recentScore, historicalWeight = 0.5, recentWeight = 0.25, exponent = 1.0) {
    if (historicalScore < 0 || historicalScore > 1)
        throw new Error("Historical score must be in [0, 1]");
    if (recentScore < 0 || recentScore > 1)
        throw new Error("Recent score must be in [0, 1]");
    if (historicalWeight < 0)
        throw new Error("Historical weight must be non-negative");
    if (recentWeight < 0)
        throw new Error("Recent weight must be non-negative");
    if (exponent < 0)
        throw new Error("Exponent must be non-negative");
    const base = 1.0 + historicalWeight * historicalScore + recentWeight * recentScore;
    const clamped = Math.max(0.5, Math.min(1.5, base));
    return Math.pow(clamped, exponent);
}
/**
 * Normalize scores to [0, 1] range using min-max scaling
 *
 * Formula: (score - min) / (max - min)
 *
 * @param scores Array of numeric scores to normalize
 * @returns Array of normalized scores in [0, 1], or array of 0s if all scores are identical
 */
function normalizeScores(scores) {
    if (!Array.isArray(scores)) {
        throw new Error("Scores must be an array");
    }
    if (scores.length === 0) {
        return [];
    }
    if (scores.length === 1) {
        return [0];
    }
    // Validate all elements are numbers
    for (let i = 0; i < scores.length; i++) {
        if (typeof scores[i] !== "number") {
            throw new Error("All scores must be numbers");
        }
    }
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min;
    // If all scores are identical, return array of zeros
    if (range === 0) {
        return scores.map(() => 0);
    }
    // Apply min-max normalization formula
    return scores.map((score) => (score - min) / range);
}
//# sourceMappingURL=scoring.js.map