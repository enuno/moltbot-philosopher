/**
 * PerformanceTracker
 *
 * Tracks model performance metrics for adaptive model selection.
 *
 * Metrics collected:
 * - model: Which model was used (venice, kimi, openrouter)
 * - complexity: Challenge complexity class (LOW, MEDIUM, HIGH)
 * - success: Whether the model correctly solved the challenge (boolean)
 * - latency_ms: Time to solve in milliseconds
 * - cost_usd: Cost of the API call in USD
 * - timestamp: When the challenge was executed (Unix milliseconds)
 *
 * Used to calculate:
 * - Success rates per model per complexity
 * - Best-performing model for each complexity class
 * - Total cost per model
 * - Overall system success rate
 */

class PerformanceTracker {
  constructor() {
    this.metrics = [];
  }

  /**
   * Record a challenge execution result
   * @param {object} metric - { model, complexity, success, latency_ms, cost_usd, timestamp }
   * @throws {Error} If required fields are missing
   */
  recordMetric(metric) {
    this.metrics.push({
      model: metric.model,
      complexity: metric.complexity,
      success: metric.success,
      latency_ms: metric.latency_ms || 0,
      cost_usd: metric.cost_usd || 0,
      timestamp: metric.timestamp || Date.now()
    });
  }

  /**
   * Get all recorded metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Calculate success rate for a model on a complexity class
   * @param {string} model - Model name (venice, kimi, openrouter)
   * @param {string} complexity - Complexity class (LOW, MEDIUM, HIGH)
   * @returns {number} Success rate (0-1)
   */
  getSuccessRate(model, complexity) {
    const relevant = this.metrics.filter(m =>
      m.model === model && m.complexity === complexity
    );

    if (relevant.length === 0) return 0;

    const successes = relevant.filter(m => m.success).length;
    return successes / relevant.length;
  }

  /**
   * Get best-performing model for a complexity class
   * Prefers: highest success rate → then most data points
   * @param {string} complexity - Complexity class (LOW, MEDIUM, HIGH)
   * @returns {string} Best model name (falls back to 'venice')
   */
  getBestModel(complexity) {
    // Collect all models with metrics at this complexity level
    const models = new Set(
      this.metrics.filter(m => m.complexity === complexity).map(m => m.model)
    );

    let bestModel = null;
    let bestRate = -1;
    let bestCount = -1;

    // Find model with highest success rate (tie-breaker: most data points)
    for (const model of models) {
      const rate = this.getSuccessRate(model, complexity);
      const count = this.metrics.filter(m =>
        m.model === model && m.complexity === complexity
      ).length;

      // Update best if: higher success rate OR same rate with more samples
      if (rate > bestRate || (rate === bestRate && count > bestCount)) {
        bestRate = rate;
        bestCount = count;
        bestModel = model;
      }
    }

    // Fallback to Venice (cheapest) if no data available
    return bestModel || 'venice';
  }

  /**
   * Get total cost for a model across all challenges
   * @param {string} model - Model name
   * @returns {number} Total cost in USD
   */
  getTotalCost(model) {
    return this.metrics
      .filter(m => m.model === model)
      .reduce((sum, m) => sum + m.cost_usd, 0);
  }

  /**
   * Get overall success rate across all models and complexities
   * @returns {number} Overall success rate (0-1)
   */
  getOverallSuccessRate() {
    if (this.metrics.length === 0) return 0;

    const successes = this.metrics.filter(m => m.success).length;
    return successes / this.metrics.length;
  }

  /**
   * Get average latency for a model
   * @param {string} model - Model name
   * @returns {number} Average latency in ms
   */
  getAverageLatency(model) {
    const relevant = this.metrics.filter(m => m.model === model);

    if (relevant.length === 0) return 0;

    const totalLatency = relevant.reduce((sum, m) => sum + m.latency_ms, 0);
    return totalLatency / relevant.length;
  }

  /**
   * Clear all metrics (for testing)
   */
  clear() {
    this.metrics = [];
  }
}

module.exports = PerformanceTracker;
