/**
 * QueryOptimizer - Optimizes discovery queries through negative keyword filtering
 * and A/B testing analysis to improve engagement rates
 */

class QueryOptimizer {
  /**
   * Initialize query optimizer with configurable weights
   * @param {Object} options - Configuration options
   * @param {number} options.engagementWeight - Weight for engagement metric (default: 0.5)
   * @param {number} options.similarityWeight - Weight for similarity metric (default: 0.3)
   * @param {number} options.volumeWeight - Weight for volume metric (default: 0.2)
   */
  constructor(options = {}) {
    this.weights = {
      engagementWeight: options.engagementWeight || 0.5,
      similarityWeight: options.similarityWeight || 0.3,
      volumeWeight: options.volumeWeight || 0.2
    };

    // Keywords to filter out (crypto, trading, investment noise)
    this.negativeKeywords = [
      'crypto',
      'cryptocurrency',
      'bitcoin',
      'ethereum',
      'blockchain',
      'trading',
      'trader',
      'investment',
      'stocks',
      'portfolio',
      'pump',
      'dump',
      'moon',
      'hodl'
    ];

    // Track A/B test history
    this.abTestHistory = [];
  }

  /**
   * Apply negative keyword filtering to a query
   * Removes high-noise keywords and adds negative operators
   * @param {string} query - The search query
   * @returns {string} - Query with negative filters added
   */
  applyNegativeKeywordFilter(query) {
    let filtered = query.toLowerCase();
    const wordsInQuery = filtered.split(/\s+/);
    let cleanedWords = [];
    let addedNegatives = [];

    // Separate positive and negative keywords
    for (const word of wordsInQuery) {
      if (this.negativeKeywords.includes(word)) {
        // Mark for negative filtering
        addedNegatives.push(word);
      } else {
        // Keep positive keyword
        cleanedWords.push(word);
      }
    }

    // Reconstruct query with negative filters
    let result = cleanedWords.join(' ');

    // Add negative operators for found keywords
    for (const negWord of addedNegatives) {
      result += ` -${negWord}`;
    }

    return result.trim();
  }

  /**
   * Analyze A/B test results comparing baseline vs filtered queries
   * @param {Object} baseline - Baseline query results
   * @param {Object} filtered - Filtered query results
   * @returns {Object} - Analysis with winner and metric changes
   */
  analyzeABTest(baseline, filtered) {
    // Calculate percentage changes
    const postsChange = ((filtered.postsFound - baseline.postsFound) / baseline.postsFound) * 100;
    const engagementChange = ((filtered.engagementRate - baseline.engagementRate) / baseline.engagementRate) * 100;
    const similarityChange = ((filtered.avgSimilarity - baseline.avgSimilarity) / baseline.avgSimilarity) * 100;

    // Calculate weighted scores
    const baselineScore = (
      (baseline.engagementRate || 0) * this.weights.engagementWeight +
      (baseline.avgSimilarity || 0) * this.weights.similarityWeight +
      (baseline.postsFound / 100) * this.weights.volumeWeight
    );

    const filteredScore = (
      (filtered.engagementRate || 0) * this.weights.engagementWeight +
      (filtered.avgSimilarity || 0) * this.weights.similarityWeight +
      (filtered.postsFound / 100) * this.weights.volumeWeight
    );

    // Determine winner (prioritizes engagement improvement)
    let winner = 'baseline';
    if (filteredScore > baselineScore || filtered.engagementRate > baseline.engagementRate) {
      winner = 'filtered';
    }

    return {
      postsChange: Math.round(postsChange),
      engagementChange: Math.round(engagementChange),
      similarityChange: Math.round(similarityChange),
      baselineScore: baselineScore.toFixed(3),
      filteredScore: filteredScore.toFixed(3),
      winner,
      recommendation: winner === 'filtered' ? 'Apply negative keyword filtering' : 'Keep baseline query'
    };
  }

  /**
   * Record an A/B test result for historical tracking
   * @param {string} queryType - Category of query being tested
   * @param {Object} test - Test results with baseline and filtered metrics
   */
  recordABTest(queryType, test) {
    const analysis = this.analyzeABTest(test.baseline, test.filtered);

    this.abTestHistory.push({
      queryType,
      timestamp: Date.now(),
      baseline: test.baseline,
      filtered: test.filtered,
      analysis
    });
  }

  /**
   * Get A/B test history
   * @returns {Array} - Array of A/B test records
   */
  getABTestHistory() {
    return this.abTestHistory;
  }

  /**
   * Get configured optimization weights
   * @returns {Object} - Current weights configuration
   */
  getWeights() {
    return { ...this.weights };
  }

  /**
   * Update optimization weights
   * @param {Object} newWeights - New weight values
   */
  setWeights(newWeights) {
    this.weights = {
      engagementWeight: newWeights.engagementWeight !== undefined ? newWeights.engagementWeight : this.weights.engagementWeight,
      similarityWeight: newWeights.similarityWeight !== undefined ? newWeights.similarityWeight : this.weights.similarityWeight,
      volumeWeight: newWeights.volumeWeight !== undefined ? newWeights.volumeWeight : this.weights.volumeWeight
    };
  }

  /**
   * Get configured negative keywords
   * @returns {Array} - List of negative keywords
   */
  getNegativeKeywords() {
    return [...this.negativeKeywords];
  }

  /**
   * Add custom negative keywords
   * @param {Array} keywords - Keywords to add to filter list
   */
  addNegativeKeywords(keywords) {
    this.negativeKeywords = [...new Set([...this.negativeKeywords, ...keywords])];
  }
}

module.exports = QueryOptimizer;
