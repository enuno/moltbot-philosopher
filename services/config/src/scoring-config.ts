/**
 * Scoring Configuration Module
 *
 * Manages hybrid search scoring configuration with:
 * - Environment variable loading
 * - Default weights and parameters
 * - Feature flags for scoring factors
 * - Runtime configuration updates
 * - Hot reload capability
 */

import { ScoringWeights } from "../../moltbook-sdk/src/types";

/**
 * Feature flags for enabling/disabling scoring factors
 */
export interface ScoringFlags {
  enableRecency: boolean; // Enable recency decay multiplier
  enableReputation: boolean; // Enable reputation multiplier
  enableFollowBoost: boolean; // Enable follow author boost
  enableDebug: boolean; // Enable debug output in results
}

/**
 * Complete scoring configuration
 */
export interface ScoringConfig {
  weights: ScoringWeights;
  flags: ScoringFlags;
  updated: Date;
}

/**
 * Get default scoring weights
 */
function getDefaultWeights(): ScoringWeights {
  return {
    historicalWeight: 0.5,
    recentWeight: 0.25,
    recencyExponent: 1.0,
    reputationExponent: 1.0,
    recencyHalfLife: 7,
  };
}

/**
 * Get default feature flags
 */
function getDefaultFlags(): ScoringFlags {
  return {
    enableRecency: true,
    enableReputation: true,
    enableFollowBoost: true,
    enableDebug: false,
  };
}

/**
 * Validate weight value
 */
function validateWeight(value: number, name: string): void {
  if (typeof value !== "number" || value <= 0) {
    throw new Error(`${name} must be a positive number, got: ${value}`);
  }
}

/**
 * Validate exponent value
 */
function validateExponent(value: number, name: string): void {
  if (typeof value !== "number" || value < 0) {
    throw new Error(`${name} must be non-negative, got: ${value}`);
  }
}

/**
 * Load weights from environment variables
 */
function loadWeightsFromEnv(): ScoringWeights {
  const defaults = getDefaultWeights();

  const weights: ScoringWeights = {
    historicalWeight: process.env.SCORING_HISTORICAL_WEIGHT
      ? parseFloat(process.env.SCORING_HISTORICAL_WEIGHT)
      : defaults.historicalWeight,
    recentWeight: process.env.SCORING_RECENT_WEIGHT
      ? parseFloat(process.env.SCORING_RECENT_WEIGHT)
      : defaults.recentWeight,
    recencyExponent: process.env.SCORING_RECENCY_EXPONENT
      ? parseFloat(process.env.SCORING_RECENCY_EXPONENT)
      : defaults.recencyExponent,
    reputationExponent: process.env.SCORING_REPUTATION_EXPONENT
      ? parseFloat(process.env.SCORING_REPUTATION_EXPONENT)
      : defaults.reputationExponent,
    recencyHalfLife: process.env.SCORING_RECENCY_HALF_LIFE
      ? parseFloat(process.env.SCORING_RECENCY_HALF_LIFE)
      : defaults.recencyHalfLife,
  };

  // Validate loaded weights
  validateWeight(weights.historicalWeight, "historicalWeight");
  validateWeight(weights.recentWeight, "recentWeight");
  validateExponent(weights.recencyExponent, "recencyExponent");
  validateExponent(weights.reputationExponent, "reputationExponent");
  validateWeight(weights.recencyHalfLife, "recencyHalfLife");

  return weights;
}

/**
 * Load feature flags from environment variables
 */
function loadFlagsFromEnv(): ScoringFlags {
  const defaults = getDefaultFlags();

  return {
    enableRecency: process.env.ENABLE_RECENCY !== "false",
    enableReputation: process.env.ENABLE_REPUTATION !== "false",
    enableFollowBoost: process.env.ENABLE_FOLLOW_BOOST !== "false",
    enableDebug: process.env.ENABLE_DEBUG === "true",
  };
}

/**
 * Global config instance (cached after first load)
 */
let globalConfig: ScoringConfig | null = null;

/**
 * Load and cache scoring configuration from environment
 */
export function loadScoringConfig(): ScoringConfig {
  const weights = loadWeightsFromEnv();
  const flags = loadFlagsFromEnv();

  return {
    weights,
    flags,
    updated: new Date(),
  };
}

/**
 * Get current scoring configuration (with caching)
 */
export function getScoringConfig(): ScoringConfig {
  if (!globalConfig) {
    globalConfig = loadScoringConfig();
  }
  return globalConfig;
}

/**
 * Get current weights
 */
export function getWeights(): ScoringWeights {
  return getScoringConfig().weights;
}

/**
 * Get current feature flags
 */
export function getFlags(): ScoringFlags {
  return getScoringConfig().flags;
}

/**
 * Update weights at runtime with validation
 */
export function updateWeights(updates: Partial<ScoringWeights>): ScoringConfig {
  const current = getScoringConfig();
  const newWeights = { ...current.weights, ...updates };

  // Validate all weight fields
  validateWeight(newWeights.historicalWeight, "historicalWeight");
  validateWeight(newWeights.recentWeight, "recentWeight");
  validateExponent(newWeights.recencyExponent, "recencyExponent");
  validateExponent(newWeights.reputationExponent, "reputationExponent");
  validateWeight(newWeights.recencyHalfLife, "recencyHalfLife");

  globalConfig = {
    weights: newWeights,
    flags: current.flags,
    updated: new Date(),
  };

  return globalConfig;
}

/**
 * Update feature flags at runtime
 */
export function updateFlags(updates: Partial<ScoringFlags>): ScoringConfig {
  const current = getScoringConfig();

  globalConfig = {
    weights: current.weights,
    flags: { ...current.flags, ...updates },
    updated: new Date(),
  };

  return globalConfig;
}

/**
 * Reset configuration to environment defaults
 */
export function resetConfig(): ScoringConfig {
  globalConfig = loadScoringConfig();
  return globalConfig;
}

/**
 * Check if specific scoring factor is enabled
 */
export function isFactorEnabled(
  factor: keyof ScoringFlags,
): boolean {
  return getFlags()[factor];
}

/**
 * Apply feature flags to weights for conditional scoring
 *
 * When a factor is disabled, its multiplier is set to 1.0 (neutral)
 */
export function getAppliedWeights(): ScoringWeights {
  const weights = getWeights();
  const flags = getFlags();

  const applied: ScoringWeights = { ...weights };

  // If recency is disabled, neutralize recency exponent
  if (!flags.enableRecency) {
    applied.recencyExponent = 0; // Will result in (0.5 ^ 0) = 1.0 multiplier
  }

  // If reputation is disabled, neutralize reputation exponent
  if (!flags.enableReputation) {
    applied.reputationExponent = 0; // Will result in base^0 = 1.0 multiplier
  }

  return applied;
}

/**
 * Get debug flag state
 */
export function isDebugEnabled(): boolean {
  return isFactorEnabled("enableDebug");
}

/**
 * Get configuration as JSON (for logging/debugging)
 */
export function getConfigAsJson(): Record<string, unknown> {
  const config = getScoringConfig();
  return {
    weights: config.weights,
    flags: config.flags,
    updated: config.updated.toISOString(),
  };
}
