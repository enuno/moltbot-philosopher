/**
 * DiscoveryMonitor - Tracks discovery and engagement metrics for alerting and dashboards
 * Monitors engagement rates, discovery volume, and quality metrics
 */

const fs = require('fs');
const path = require('path');

class DiscoveryMonitor {
  /**
   * Initialize discovery monitor with state file
   * @param {string} stateFile - Path to state file for persistence
   */
  constructor(stateFile) {
    this.stateFile = stateFile;
    this.state = this.loadState();
  }

  /**
   * Initialize monitoring state
   */
  initialize() {
    this.state = {
      discoveryMetrics: {
        totalDiscovered: 0,
        totalEngaged: 0,
        byCategory: {}
      },
      engagementMetrics: {
        rate: 0,
        threshold: 0.25,
        history: []
      },
      queryPerformance: [],
      alerts: [],
      lastUpdated: Date.now()
    };

    this.saveState();
  }

  /**
   * Load state from file
   * @returns {Object} - Loaded state or empty object
   */
  loadState() {
    if (fs.existsSync(this.stateFile)) {
      try {
        const data = fs.readFileSync(this.stateFile, 'utf-8');
        return JSON.parse(data);
      } catch (e) {
        console.error(`Failed to load state from ${this.stateFile}:`, e.message);
        return {};
      }
    }
    return {};
  }

  /**
   * Save state to file
   */
  saveState() {
    const dir = path.dirname(this.stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(
      this.stateFile,
      JSON.stringify(this.state, null, 2)
    );
  }

  /**
   * Record discovered posts count
   * @param {number} count - Number of posts discovered
   */
  recordDiscovery(count) {
    if (!this.state.discoveryMetrics) {
      this.state.discoveryMetrics = { totalDiscovered: 0, totalEngaged: 0 };
    }

    this.state.discoveryMetrics.totalDiscovered += count;
    this.state.lastUpdated = Date.now();
    this.saveState();
  }

  /**
   * Record engaged posts count
   * @param {number} count - Number of posts that received engagement
   */
  recordEngagement(count) {
    if (!this.state.discoveryMetrics) {
      this.state.discoveryMetrics = { totalDiscovered: 0, totalEngaged: 0 };
    }

    this.state.discoveryMetrics.totalEngaged += count;
    this.updateEngagementRate();
    this.state.lastUpdated = Date.now();
    this.saveState();
  }

  /**
   * Record discovery by category
   * @param {string} category - Philosophy category (epistemology, ethics, etc.)
   * @param {number} count - Number discovered in category
   */
  recordDiscoveryByCategory(category, count) {
    if (!this.state.discoveryMetrics) {
      this.state.discoveryMetrics = { totalDiscovered: 0, totalEngaged: 0, byCategory: {} };
    }

    if (!this.state.discoveryMetrics.byCategory[category]) {
      this.state.discoveryMetrics.byCategory[category] = { discovered: 0, engaged: 0 };
    }

    this.state.discoveryMetrics.byCategory[category].discovered += count;
    this.state.discoveryMetrics.totalDiscovered += count;
    this.state.lastUpdated = Date.now();
    this.saveState();
  }

  /**
   * Record engagement by category
   * @param {string} category - Philosophy category
   * @param {number} count - Number engaged in category
   */
  recordEngagementByCategory(category, count) {
    if (!this.state.discoveryMetrics || !this.state.discoveryMetrics.byCategory[category]) {
      this.recordDiscoveryByCategory(category, 0);
    }

    this.state.discoveryMetrics.byCategory[category].engaged += count;
    this.state.discoveryMetrics.totalEngaged += count;
    this.updateEngagementRate();
    this.state.lastUpdated = Date.now();
    this.saveState();
  }

  /**
   * Update overall engagement rate
   */
  updateEngagementRate() {
    const total = this.state.discoveryMetrics?.totalDiscovered || 0;
    const engaged = this.state.discoveryMetrics?.totalEngaged || 0;

    if (total === 0) {
      this.state.engagementMetrics = { ...this.state.engagementMetrics, rate: 0 };
    } else {
      this.state.engagementMetrics = { ...this.state.engagementMetrics, rate: engaged / total };
    }
  }

  /**
   * Get current engagement metrics
   * @returns {Object} - Engagement metrics
   */
  getEngagementRate() {
    return {
      totalDiscovered: this.state.discoveryMetrics?.totalDiscovered || 0,
      totalEngaged: this.state.discoveryMetrics?.totalEngaged || 0,
      engagementRate: this.state.engagementMetrics?.rate || 0
    };
  }

  /**
   * Get engagement metrics by category
   * @returns {Object} - Engagement rates per category
   */
  getEngagementByCategory() {
    const byCategory = {};

    if (this.state.discoveryMetrics?.byCategory) {
      for (const [category, metrics] of Object.entries(this.state.discoveryMetrics.byCategory)) {
        const discovered = metrics.discovered || 0;
        const engaged = metrics.engaged || 0;
        byCategory[category] = {
          discovered,
          engaged,
          rate: discovered === 0 ? 0 : engaged / discovered
        };
      }
    }

    return byCategory;
  }

  /**
   * Check if discovery rate meets threshold
   * @param {number} threshold - Minimum posts per day threshold
   * @returns {Object} - Alert object with triggered status and message
   */
  checkDiscoveryThreshold(threshold) {
    const discovered = this.state.discoveryMetrics?.totalDiscovered || 0;

    if (discovered < threshold) {
      return {
        triggered: true,
        metric: 'discovery_rate',
        current: discovered,
        threshold,
        message: `Discovery rate below ${threshold} posts/day: only ${discovered} found`
      };
    }

    return { triggered: false, metric: 'discovery_rate' };
  }

  /**
   * Check if engagement rate meets threshold
   * @param {number} threshold - Minimum engagement rate (0-1)
   * @returns {Object} - Alert object with triggered status and message
   */
  checkEngagementThreshold(threshold) {
    const rate = this.state.engagementMetrics?.rate || 0;
    const percentage = Math.round(rate * 100);
    const thresholdPercent = Math.round(threshold * 100);

    if (rate < threshold) {
      return {
        triggered: true,
        metric: 'engagement_rate',
        current: rate,
        threshold,
        message: `Engagement rate below ${thresholdPercent}%: only ${percentage}% engaged`
      };
    }

    return { triggered: false, metric: 'engagement_rate' };
  }

  /**
   * Record query performance metrics
   * @param {Object} queryMetrics - Query performance data
   */
  recordQueryPerformance(queryMetrics) {
    if (!this.state.queryPerformance) {
      this.state.queryPerformance = [];
    }

    this.state.queryPerformance.push({
      ...queryMetrics,
      timestamp: Date.now()
    });

    // Keep last 100 queries to avoid state file bloat
    if (this.state.queryPerformance.length > 100) {
      this.state.queryPerformance = this.state.queryPerformance.slice(-100);
    }

    this.state.lastUpdated = Date.now();
    this.saveState();
  }

  /**
   * Get query performance metrics
   * @returns {Array} - Query performance records
   */
  getQueryPerformance() {
    return this.state.queryPerformance || [];
  }

  /**
   * Get top performing queries
   * @param {number} limit - Number of top queries to return
   * @returns {Array} - Top queries sorted by engagement rate
   */
  getTopQueries(limit = 5) {
    const queries = this.state.queryPerformance || [];
    return queries
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, limit);
  }

  /**
   * Get average query execution time
   * @returns {number} - Average execution time in milliseconds
   */
  getAverageExecutionTime() {
    const queries = this.state.queryPerformance || [];

    if (queries.length === 0) {
      return 0;
    }

    const sum = queries.reduce((acc, q) => acc + (q.executionTimeMs || 0), 0);
    return Math.round(sum / queries.length);
  }

  /**
   * Get metrics formatted for dashboard display
   * @returns {Object} - Dashboard metrics
   */
  getDashboardMetrics() {
    const engagement = this.getEngagementRate();
    const topQueries = this.getTopQueries(5);
    const byCategory = this.getEngagementByCategory();

    return {
      timestamp: this.state.lastUpdated,
      totalDiscovered: engagement.totalDiscovered,
      totalEngaged: engagement.totalEngaged,
      engagementRate: Math.round(engagement.engagementRate * 100) / 100,
      engagementPercent: Math.round(engagement.engagementRate * 100),
      avgExecutionTime: this.getAverageExecutionTime(),
      topQueries: topQueries.map(q => ({
        query: q.query,
        postsFound: q.postsFound,
        engagementRate: Math.round(q.engagementRate * 100) + '%',
        executionTimeMs: q.executionTimeMs
      })),
      categoryBreakdown: Object.entries(byCategory).map(([category, metrics]) => ({
        category,
        discovered: metrics.discovered,
        engaged: metrics.engaged,
        engagementPercent: Math.round(metrics.rate * 100)
      })),
      alerts: this.state.alerts || []
    };
  }

  /**
   * Record an alert
   * @param {Object} alert - Alert object with metric, level, message
   */
  recordAlert(alert) {
    if (!this.state.alerts) {
      this.state.alerts = [];
    }

    this.state.alerts.push({
      ...alert,
      timestamp: Date.now()
    });

    // Keep last 50 alerts
    if (this.state.alerts.length > 50) {
      this.state.alerts = this.state.alerts.slice(-50);
    }

    this.state.lastUpdated = Date.now();
    this.saveState();
  }

  /**
   * Get all recorded alerts
   * @returns {Array} - Alert history
   */
  getAlerts() {
    return this.state.alerts || [];
  }

  /**
   * Get recent alerts (last N)
   * @param {number} limit - Number of recent alerts
   * @returns {Array} - Recent alerts
   */
  getRecentAlerts(limit = 10) {
    const alerts = this.state.alerts || [];
    return alerts.slice(-limit);
  }

  /**
   * Clear all monitoring state
   */
  reset() {
    this.state = {
      discoveryMetrics: {
        totalDiscovered: 0,
        totalEngaged: 0,
        byCategory: {}
      },
      engagementMetrics: {
        rate: 0
      },
      queryPerformance: [],
      alerts: [],
      lastUpdated: Date.now()
    };
    this.saveState();
  }
}

module.exports = DiscoveryMonitor;
