/**
 * ModelSelector
 *
 * Selects the best model for a challenge based on complexity and performance history.
 *
 * Model Hierarchy:
 * - Venice (cheap, $0.0001): Best for LOW complexity, cost-sensitive scenarios
 * - Kimi (balanced, $0.0008): Best for MEDIUM complexity, balanced cost/performance
 * - OpenRouter (powerful, $0.002): Best for HIGH complexity, when accuracy matters
 *
 * Strategy:
 * 1. Find affordable models within budget ($0.002 per challenge)
 * 2. Score each model based on historical success rate for this complexity
 * 3. Apply adaptive weighting: boost models with recent successes
 * 4. When scores are similar (within margin), prefer cheaper model
 */

class ModelSelector {
  // Model costs in USD per API call
  static MODEL_COSTS = {
    venice: 0.0001,
    kimi: 0.0008,
    openrouter: 0.002
  };

  // Fallback chain if primary model fails
  static FALLBACK_CHAIN = ['venice', 'kimi', 'openrouter'];

  // Performance scores within this margin are considered equal
  static MARGIN_OF_ERROR = 0.01; // 1% difference

  // Maximum boost for recent successes (percentage points)
  static RECENT_SUCCESS_MAX_BOOST = 0.15;

  // Maximum number of recent successes before reaching max boost
  static RECENT_SUCCESS_CAP = 5;

  constructor() {
    this.modelCosts = ModelSelector.MODEL_COSTS;
    this.modelChain = ModelSelector.FALLBACK_CHAIN;
    this.marginOfError = ModelSelector.MARGIN_OF_ERROR;
  }

  /**
   * Select the best model for a challenge
   * @param {string} challenge - The challenge text
   * @param {object} performanceData - Historical performance { model: { complexity: { successRate, count } } }
   * @param {object} recentSuccesses - Recent successes for adaptive weighting (optional)
   * @returns {{ model: string, successRate: number, reason: string }}
   */
  selectModel(challenge, performanceData = {}, recentSuccesses = {}) {
    // Step 1: Infer challenge complexity
    const complexity = this._inferComplexity(challenge);

    // Step 2: Filter models by budget ($0.002 per challenge)
    const affordable = this.getAffordableModels(0.002, this.modelCosts);

    // Step 3: Score each affordable model based on performance history + recent success
    const modelScores = {};
    let bestScore = -1;
    let bestModel = 'venice'; // Default fallback (cheapest)

    for (const model of affordable) {
      const score = this._calculateModelScore(
        model,
        complexity,
        performanceData,
        recentSuccesses
      );
      modelScores[model] = score;

      // Track highest-scoring model
      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }

    // Step 4: Apply cost optimization for similar-performing models
    // If multiple models score within margin of error, prefer cheaper option
    const scoreThreshold = bestScore - this.marginOfError;
    const similarPerformers = affordable.filter(m => {
      return modelScores[m] >= scoreThreshold && modelScores[m] > 0;
    });

    // Only prefer cheaper if: multiple similar options AND confidence not extremely high
    if (similarPerformers.length > 1 && bestScore < 0.9) {
      bestModel = similarPerformers.reduce((cheapest, current) =>
        this.modelCosts[current] < this.modelCosts[cheapest] ? current : cheapest
      );
    }

    // Step 5: Prepare result with success rate and explanation
    const successRate = performanceData[bestModel]?.[complexity]?.successRate || 0.5;
    const reason = this._selectReason(bestModel, complexity, performanceData);

    return { model: bestModel, successRate, reason };
  }

  /**
   * Get models within cost budget
   */
  getAffordableModels(budget, costs = this.modelCosts) {
    return Object.keys(costs).filter(model => costs[model] <= budget);
  }

  /**
   * Get fallback model in chain
   */
  getFallback(currentModel, modelChain = this.modelChain) {
    const index = modelChain.indexOf(currentModel);
    if (index === -1 || index === modelChain.length - 1) {
      return null; // No fallback
    }
    return modelChain[index + 1];
  }

  /**
   * Calculate score for a model on a specific complexity level
   * Score = Historical success rate + adaptive boost from recent successes
   * @private
   */
  _calculateModelScore(model, complexity, performanceData, recentSuccesses) {
    // Start with baseline or actual historical success rate
    let score = 0.5; // Default baseline if no history
    const perfData = performanceData[model]?.[complexity];
    if (perfData?.successRate !== undefined) {
      score = perfData.successRate;
    }

    // Apply adaptive boost for recent successes (up to MAX_BOOST)
    const recentCount = recentSuccesses[model]?.[complexity] || 0;
    if (recentCount > 0) {
      const boost = Math.min(
        (recentCount / ModelSelector.RECENT_SUCCESS_CAP) * ModelSelector.RECENT_SUCCESS_MAX_BOOST,
        ModelSelector.RECENT_SUCCESS_MAX_BOOST
      );
      score += boost;
    }

    // Clamp to valid range [0, 1]
    return Math.min(score, 1);
  }

  _selectReason(model, complexity, performanceData) {
    const perfData = performanceData[model]?.[complexity];

    if (!perfData || perfData.count < 1) {
      return model === 'venice' ? 'insufficient_data' : 'default_fallback';
    }

    if (perfData.successRate > 0.8) {
      return 'highest_success_rate';
    }

    if (perfData.count >= 3) {
      return 'proven_performer';
    }

    return 'best_available';
  }

  _inferComplexity(challenge) {
    // Simple heuristic: detailed implementation in ComplexityAnalyzer
    const symbolDensity = (challenge.match(/[^a-z0-9\s]/gi) || []).length / challenge.length;
    const caseChanges = (challenge.match(/[a-z][A-Z]|[A-Z][a-z]/g) || []).length;

    if (symbolDensity > 0.15 || caseChanges > challenge.length * 0.1) {
      return 'HIGH';
    }
    if (symbolDensity > 0.05 || caseChanges > challenge.length * 0.02) {
      return 'MEDIUM';
    }
    return 'LOW';
  }
}

module.exports = ModelSelector;
