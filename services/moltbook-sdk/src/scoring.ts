/**
 * Scoring module for hybrid search ranking
 *
 * Implements P4.1 hybrid search scoring with:
 * - Semantic similarity scoring
 * - Recency decay with exponential falloff
 * - Author reputation multipliers
 * - Follow-author boost
 */

import { PostScoringInputs, ScoringWeights, ScoringResult } from "./types";

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

/**
 * Normalize scores to [0, 1] range using min-max scaling
 *
 * Formula: (score - min) / (max - min)
 *
 * @param scores Array of numeric scores to normalize
 * @returns Array of normalized scores in [0, 1], or array of 0s if all scores are identical
 */
export function normalizeScores(scores: number[]): number[] {
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
export function scorePost(
  input: PostScoringInputs,
  weights?: ScoringWeights,
): ScoringResult {
  // Validate input has all required fields
  if (!input || typeof input !== "object") {
    throw new Error("Input must be an object");
  }

  const requiredFields = [
    "postId",
    "semanticScore",
    "ageInDays",
    "authorHistoricalScore",
    "authorRecentScore",
    "isFollowedAuthor",
  ];

  for (const field of requiredFields) {
    if (!(field in input)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate semantic score is in [0, 1]
  if (
    typeof input.semanticScore !== "number" ||
    input.semanticScore < 0 ||
    input.semanticScore > 1
  ) {
    throw new Error("Semantic score must be a number in [0, 1]");
  }

  // Validate field types and ranges
  if (typeof input.ageInDays !== "number" || input.ageInDays < 0) {
    throw new Error("Age in days must be a non-negative number");
  }
  if (
    typeof input.authorHistoricalScore !== "number" ||
    input.authorHistoricalScore < 0 ||
    input.authorHistoricalScore > 1
  ) {
    throw new Error("Historical score must be a number in [0, 1]");
  }
  if (
    typeof input.authorRecentScore !== "number" ||
    input.authorRecentScore < 0 ||
    input.authorRecentScore > 1
  ) {
    throw new Error("Recent score must be a number in [0, 1]");
  }
  if (typeof input.isFollowedAuthor !== "boolean") {
    throw new Error("isFollowedAuthor must be a boolean");
  }

  // Use default weights if not provided
  const w = weights || {
    historicalWeight: 0.5,
    recentWeight: 0.25,
    recencyExponent: 1.0,
    reputationExponent: 1.0,
    recencyHalfLife: 7,
  };

  // Calculate recency multiplier
  const recencyMult = calculateRecency(
    input.ageInDays,
    w.recencyExponent,
    w.recencyHalfLife,
  );

  // Calculate reputation multiplier
  const reputationMult = calculateReputation(
    input.authorHistoricalScore,
    input.authorRecentScore,
    w.historicalWeight,
    w.recentWeight,
    w.reputationExponent,
  );

  // Apply follow boost
  const followBoost = input.isFollowedAuthor ? 1.25 : 1.0;

  // Combine all factors multiplicatively
  const combinedScore =
    input.semanticScore * recencyMult * reputationMult * followBoost;

  const result: ScoringResult = {
    postId: input.postId,
    finalScore: combinedScore,
  };

  // Add debug info if requested
  if (w.debug) {
    result.debug = {
      semanticScore: input.semanticScore,
      recencyMultiplier: recencyMult,
      reputationMultiplier: reputationMult,
      followBoost,
      combinedScore,
    };
  }

  return result;
}
