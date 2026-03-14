/**
 * Tests for query optimization and discovery monitoring
 * TDD approach: tests written first, implementation follows
 */

const fs = require('fs');
const path = require('path');
const QueryOptimizer = require('../src/query-optimizer');
const DiscoveryMonitor = require('../src/discovery-monitor');

describe('QueryOptimizer', () => {
  describe('negative keyword filtering', () => {
    it('should filter out posts containing crypto/trading keywords', () => {
      const queries = [
        'philosophy ethics',
        'bitcoin trading strategy',
        'kant cryptocurrency',
        'virtue ethics'
      ];

      const optimizer = new QueryOptimizer();
      const filtered = queries.map(q => optimizer.applyNegativeKeywordFilter(q));

      expect(filtered[0]).toBe('philosophy ethics');
      expect(filtered[1]).toContain('-bitcoin');
      expect(filtered[2]).toContain('-cryptocurrency');
      expect(filtered[3]).toBe('virtue ethics');
    });

    it('should add negative keywords for investment/trading terms', () => {
      const optimizer = new QueryOptimizer();
      const filtered = optimizer.applyNegativeKeywordFilter('stoicism investment trading');

      expect(filtered).toContain('stoicism');
      expect(filtered).toContain('-investment');
      expect(filtered).toContain('-trading');
    });

    it('should handle multiple negative keywords in single query', () => {
      const optimizer = new QueryOptimizer();
      const query = 'philosophy blockchain crypto trading investment';
      const filtered = optimizer.applyNegativeKeywordFilter(query);

      // Should contain base query without trigger words
      expect(filtered).toContain('philosophy');
      // Should add multiple negative filters
      expect((filtered.match(/-/g) || []).length).toBeGreaterThan(2);
    });

    it('should preserve positive keywords while adding negatives', () => {
      const optimizer = new QueryOptimizer();
      const filtered = optimizer.applyNegativeKeywordFilter('aristotle virtue ethics trading');

      expect(filtered).toContain('aristotle');
      expect(filtered).toContain('virtue');
      expect(filtered).toContain('ethics');
      expect(filtered).toContain('-trading');
    });
  });

  describe('A/B testing analysis', () => {
    it('should compare baseline vs filtered query performance', () => {
      const optimizer = new QueryOptimizer();

      const baseline = {
        query: 'philosophy ethics',
        postsFound: 50,
        engagementRate: 0.20,
        avgSimilarity: 0.82
      };

      const filtered = {
        query: 'philosophy ethics -crypto -trading',
        postsFound: 35,
        engagementRate: 0.28,
        avgSimilarity: 0.85
      };

      const analysis = optimizer.analyzeABTest(baseline, filtered);

      expect(analysis).toHaveProperty('postsChange');
      expect(analysis).toHaveProperty('engagementChange');
      expect(analysis).toHaveProperty('similarityChange');
      expect(analysis).toHaveProperty('winner');
      expect(analysis.winner).toBe('filtered');
    });

    it('should calculate percentage changes correctly', () => {
      const optimizer = new QueryOptimizer();

      const baseline = { postsFound: 100, engagementRate: 0.20 };
      const filtered = { postsFound: 80, engagementRate: 0.25 };

      const analysis = optimizer.analyzeABTest(baseline, filtered);

      expect(analysis.postsChange).toBe(-20); // -20%
      expect(analysis.engagementChange).toBe(25); // +25%
    });

    it('should identify winner based on multiple metrics', () => {
      const optimizer = new QueryOptimizer();

      // Filtered wins on engagement and similarity despite fewer posts
      const baseline = {
        query: 'test',
        postsFound: 100,
        engagementRate: 0.15,
        avgSimilarity: 0.75
      };

      const filtered = {
        query: 'test -noise',
        postsFound: 70,
        engagementRate: 0.30,
        avgSimilarity: 0.88
      };

      const analysis = optimizer.analyzeABTest(baseline, filtered);

      // Winner should favor engagement rate improvement
      expect(analysis.winner).toBe('filtered');
    });

    it('should track A/B test history', () => {
      const optimizer = new QueryOptimizer();

      const test1 = {
        baseline: { postsFound: 50, engagementRate: 0.20 },
        filtered: { postsFound: 45, engagementRate: 0.25 }
      };

      const test2 = {
        baseline: { postsFound: 60, engagementRate: 0.22 },
        filtered: { postsFound: 55, engagementRate: 0.28 }
      };

      optimizer.recordABTest('ethics-query', test1);
      optimizer.recordABTest('metaphysics-query', test2);

      const history = optimizer.getABTestHistory();
      expect(history.length).toBe(2);
      expect(history[0].queryType).toBe('ethics-query');
      expect(history[1].queryType).toBe('metaphysics-query');
    });
  });

  describe('query optimization weights', () => {
    it('should have configurable optimization weights', () => {
      const optimizer = new QueryOptimizer({
        engagementWeight: 0.4,
        similarityWeight: 0.3,
        volumeWeight: 0.3
      });

      const weights = optimizer.getWeights();
      expect(weights.engagementWeight).toBe(0.4);
      expect(weights.similarityWeight).toBe(0.3);
      expect(weights.volumeWeight).toBe(0.3);
    });

    it('should use default weights if not provided', () => {
      const optimizer = new QueryOptimizer();
      const weights = optimizer.getWeights();

      expect(weights).toHaveProperty('engagementWeight');
      expect(weights).toHaveProperty('similarityWeight');
      expect(weights).toHaveProperty('volumeWeight');
      // Weights should sum to 1.0
      const sum = weights.engagementWeight + weights.similarityWeight + weights.volumeWeight;
      expect(sum).toBeCloseTo(1.0, 1);
    });
  });
});

describe('DiscoveryMonitor', () => {
  let testStateFile;
  let monitor;

  beforeEach(() => {
    testStateFile = path.join(__dirname, `test-monitor-${Date.now()}.json`);
    monitor = new DiscoveryMonitor(testStateFile);
  });

  afterEach(() => {
    if (fs.existsSync(testStateFile)) {
      fs.unlinkSync(testStateFile);
    }
  });

  describe('engagement rate tracking', () => {
    it('should initialize monitoring state', () => {
      monitor.initialize();

      expect(fs.existsSync(testStateFile)).toBe(true);
      const state = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(state).toHaveProperty('discoveryMetrics');
      expect(state).toHaveProperty('engagementMetrics');
    });

    it('should track posts discovered vs engaged', () => {
      monitor.initialize();

      // Record discovery
      monitor.recordDiscovery(10);
      monitor.recordEngagement(3); // 3 out of 10 = 30%

      const metrics = monitor.getEngagementRate();
      expect(metrics.totalDiscovered).toBe(10);
      expect(metrics.totalEngaged).toBe(3);
      expect(metrics.engagementRate).toBeCloseTo(0.30, 2);
    });

    it('should calculate engagement rate as percentage', () => {
      monitor.initialize();

      monitor.recordDiscovery(100);
      monitor.recordEngagement(25); // 25%

      const metrics = monitor.getEngagementRate();
      expect(metrics.engagementRate).toBeCloseTo(0.25, 2);
    });

    it('should handle zero discoveries (avoid division by zero)', () => {
      monitor.initialize();

      monitor.recordEngagement(0);
      const metrics = monitor.getEngagementRate();

      expect(metrics.engagementRate).toBe(0);
      expect(isNaN(metrics.engagementRate)).toBe(false);
    });

    it('should track engagement per category', () => {
      monitor.initialize();

      monitor.recordDiscoveryByCategory('epistemology', 5);
      monitor.recordDiscoveryByCategory('ethics', 8);
      monitor.recordEngagementByCategory('epistemology', 2);
      monitor.recordEngagementByCategory('ethics', 3);

      const byCategory = monitor.getEngagementByCategory();
      expect(byCategory.epistemology.rate).toBeCloseTo(0.40, 2);
      expect(byCategory.ethics.rate).toBeCloseTo(0.375, 2);
    });
  });

  describe('alerting and thresholds', () => {
    it('should alert when discovery rate drops below 10 posts/day', () => {
      monitor.initialize();

      // Record only 5 posts in a day
      monitor.recordDiscovery(5);

      const alert = monitor.checkDiscoveryThreshold(10); // threshold 10 posts/day
      expect(alert.triggered).toBe(true);
      expect(alert.metric).toBe('discovery_rate');
      expect(alert.message).toContain('below 10');
    });

    it('should not alert when discovery rate above threshold', () => {
      monitor.initialize();

      monitor.recordDiscovery(15);

      const alert = monitor.checkDiscoveryThreshold(10);
      expect(alert.triggered).toBe(false);
    });

    it('should alert when engagement rate drops below 25%', () => {
      monitor.initialize();

      monitor.recordDiscovery(100);
      monitor.recordEngagement(20); // 20% < 25%

      const alert = monitor.checkEngagementThreshold(0.25);
      expect(alert.triggered).toBe(true);
      expect(alert.metric).toBe('engagement_rate');
      expect(alert.message).toContain('below 25%');
    });

    it('should not alert when engagement rate above threshold', () => {
      monitor.initialize();

      monitor.recordDiscovery(100);
      monitor.recordEngagement(30); // 30% > 25%

      const alert = monitor.checkEngagementThreshold(0.25);
      expect(alert.triggered).toBe(false);
    });

    it('should generate multiple alerts if multiple thresholds breached', () => {
      monitor.initialize();

      monitor.recordDiscovery(5); // Low discovery
      monitor.recordEngagement(1); // Very low engagement

      const discoveryAlert = monitor.checkDiscoveryThreshold(10);
      const engagementAlert = monitor.checkEngagementThreshold(0.25);

      expect(discoveryAlert.triggered).toBe(true);
      expect(engagementAlert.triggered).toBe(true);
    });
  });

  describe('performance metrics', () => {
    it('should track query performance metrics', () => {
      monitor.initialize();

      monitor.recordQueryPerformance({
        query: 'philosophy ethics',
        postsFound: 15,
        engagementRate: 0.33,
        executionTimeMs: 250
      });

      const perf = monitor.getQueryPerformance();
      expect(perf).toHaveLength(1);
      expect(perf[0].query).toBe('philosophy ethics');
      expect(perf[0].engagementRate).toBe(0.33);
    });

    it('should identify top performing queries', () => {
      monitor.initialize();

      monitor.recordQueryPerformance({
        query: 'query-1',
        postsFound: 10,
        engagementRate: 0.5,
        executionTimeMs: 100
      });

      monitor.recordQueryPerformance({
        query: 'query-2',
        postsFound: 20,
        engagementRate: 0.3,
        executionTimeMs: 200
      });

      const topQueries = monitor.getTopQueries(1);
      expect(topQueries[0].query).toBe('query-1'); // Higher engagement rate
    });

    it('should calculate average execution time', () => {
      monitor.initialize();

      monitor.recordQueryPerformance({
        query: 'q1',
        postsFound: 10,
        engagementRate: 0.2,
        executionTimeMs: 100
      });

      monitor.recordQueryPerformance({
        query: 'q2',
        postsFound: 10,
        engagementRate: 0.2,
        executionTimeMs: 300
      });

      const avgTime = monitor.getAverageExecutionTime();
      expect(avgTime).toBe(200); // (100 + 300) / 2
    });
  });

  describe('dashboard metrics', () => {
    it('should export metrics for dashboard', () => {
      monitor.initialize();

      monitor.recordDiscovery(50);
      monitor.recordEngagement(12);
      monitor.recordQueryPerformance({
        query: 'test',
        postsFound: 50,
        engagementRate: 0.24,
        executionTimeMs: 150
      });

      const dashboard = monitor.getDashboardMetrics();

      expect(dashboard).toHaveProperty('totalDiscovered');
      expect(dashboard).toHaveProperty('engagementRate');
      expect(dashboard).toHaveProperty('topQueries');
      expect(dashboard).toHaveProperty('avgExecutionTime');
      expect(dashboard).toHaveProperty('categoryBreakdown');
    });
  });
});
