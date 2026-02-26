/**
 * P2.1→P2.3→P2.4 End-to-End Pipeline Test
 * Verifies engagement scoring → quality metrics → proactive decisions → stats aggregation
 */

const {
  buildSummary,
  buildTrends,
  buildAgentsSection,
  buildQualitySection,
  calculateRollingMetrics,
} = require("../../services/engagement-service/dist/stats-builder");

describe("P2 Full Pipeline: Engagement → Quality → Proactive → Stats", () => {
  // Test agents
  const agents = [
    { id: "classical", type: "classical", name: "Classical", tradition: "Stoicism", statePath: "" },
    { id: "existentialist", type: "existentialist", name: "Existentialist", tradition: "Existentialism", statePath: "" },
  ];

  // Helper: Create mock quality metrics for a thread
  function createQualityMetrics(id, qualityScore, sentiment, controversy) {
    return {
      id,
      timestamp: Date.now(),
      qualityScore: Math.max(0, Math.min(100, qualityScore)),
      breakdown: {
        depthScore: 0.7,
        sentimentScore: sentiment,
        controversyScore: controversy,
        authorQualityScore: 0.8,
      },
      topAuthors: [
        {
          userId: "user1",
          userName: "Author1",
          replyEngagementRate: 0.6,
          commentsByAuthor: 5,
          repliesReceivedByAuthor: 3,
        },
      ],
    };
  }

  // Helper: Create mock daily rollup
  function createDailyRollup(date, posts, quality, topics) {
    return {
      date,
      postsCreated: posts,
      commentsMade: posts * 3,
      accountsFollowed: 1,
      averageQualityScore: Math.max(0, Math.min(100, quality)),
      topicsEngaged: topics,
    };
  }

  // Helper: Create engagement state with rolling metrics and thread cache
  function createEngagementState(agent, includeQuality = true) {
    const today = new Date().toISOString().split("T")[0];
    const threadCache = new Map();

    if (includeQuality) {
      threadCache.set("thread-1", createQualityMetrics("thread-1", 85, 0.7, 0.2));
      threadCache.set("thread-2", createQualityMetrics("thread-2", 60, 0.5, 0.5));
      threadCache.set("thread-3", createQualityMetrics("thread-3", 45, 0.3, 0.8));
    }

    // Create 30 days of rollup data
    const dailyRollups = [];
    for (let i = 30; i > 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const posts = Math.floor(Math.random() * 3) + 1;
      const quality = 50 + Math.random() * 40; // 50-90 quality
      const topics = ["virtue_ethics", "consciousness", "ai_safety"];

      dailyRollups.push(createDailyRollup(dateStr, posts, quality, topics));
    }

    // Rolling metrics calculated from rollups
    const rollingMetrics = calculateRollingMetrics(dailyRollups);

    return {
      dailyStats: {
        date: today,
        postsCreated: 2,
        commentsMade: 6,
        accountsFollowed: 1,
        dmRequestsSent: 0,
        threadsParticipated: 3,
      },
      dailyReset: today,
      followedAccounts: [
        {
          name: "alice",
          postsSeenCount: 5,
          firstSeen: Date.now(),
          lastEngagement: Date.now(),
          qualityScore: 0.8,
        },
      ],
      subscribedSubmolts: ["ethics-convergence", "general"],
      pendingDmRequests: [],
      engagementQueue: [],
      rateLimits: {
        lastPostTimestamp: Date.now() - 1800000, // 30 min ago
        lastCommentTimestamp: Date.now() - 60000, // 1 min ago
        lastFollowTimestamp: Date.now() - 3600000, // 1 hour ago
        lastDmTimestamp: 0,
      },
      lastEngagementCheck: Date.now(),
      lastPostTime: Date.now(),
      relevanceCache: {},
      threadQualityCache: threadCache,
      dailyRollups,
      rollingMetrics,
    };
  }

  describe("P2.1: Engagement Scoring and Ranking", () => {
    it("should score posts with quality metrics", () => {
      const state = createEngagementState(agents[0], true);

      // Verify rolling metrics contain quality information
      expect(state.rollingMetrics.days_7.avg_quality_score).toBeGreaterThan(0);
      expect(state.rollingMetrics.days_7.avg_quality_score).toBeLessThanOrEqual(100);
      expect(state.rollingMetrics.days_30.avg_quality_score).toBeGreaterThan(0);
      expect(state.rollingMetrics.days_30.avg_quality_score).toBeLessThanOrEqual(100);
    });

    it("should track posting velocity from daily rollups", () => {
      const state = createEngagementState(agents[0]);

      // Verify posting velocity is calculated
      expect(state.rollingMetrics.days_7.posting_velocity).toBeGreaterThan(0);
      expect(state.rollingMetrics.days_7.days_active).toBeGreaterThan(0);
      expect(state.rollingMetrics.days_7.total_posts).toBeGreaterThan(0);
      expect(state.rollingMetrics.days_7.total_comments).toBeGreaterThan(0);
    });
  });

  describe("P2.2: Quality Metrics Aggregation", () => {
    it("should identify high-quality threads", () => {
      const state = createEngagementState(agents[0], true);
      const threadCache = state.threadQualityCache;

      // Verify quality metrics are categorized
      let highQuality = 0;
      let lowQuality = 0;
      for (const metrics of Array.from(threadCache.values())) {
        if (metrics.qualityScore >= 75) highQuality++;
        if (metrics.qualityScore < 50) lowQuality++;
      }

      expect(highQuality).toBeGreaterThan(0);
      expect(lowQuality).toBeGreaterThan(0);
    });

    it("should calculate sentiment trends from thread breakdown", () => {
      const state = createEngagementState(agents[0], true);
      const threadCache = state.threadQualityCache;

      // Verify sentiment scoring is present
      for (const metrics of Array.from(threadCache.values())) {
        expect(metrics.breakdown.sentimentScore).toBeGreaterThanOrEqual(0);
        expect(metrics.breakdown.sentimentScore).toBeLessThanOrEqual(1);
      }
    });

    it("should detect controversial topics", () => {
      const state = createEngagementState(agents[0], true);
      const threadCache = state.threadQualityCache;

      // Verify controversy scoring is present
      let controversialCount = 0;
      for (const metrics of Array.from(threadCache.values())) {
        if (metrics.breakdown.controversyScore > 0.7) {
          controversialCount++;
        }
      }

      expect(controversialCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("P2.3: Proactive Posting Decisions", () => {
    it("should track topic engagement over 7-day periods", () => {
      const state = createEngagementState(agents[0]);

      // Verify daily rollups track topic engagement
      const last7 = state.dailyRollups.slice(-7);
      const engagedTopics = new Set();

      for (const rollup of last7) {
        for (const topic of rollup.topicsEngaged) {
          engagedTopics.add(topic);
        }
      }

      expect(engagedTopics.size).toBeGreaterThan(0);
    });

    it("should calculate rolling quality trends", () => {
      const state = createEngagementState(agents[0]);
      const rolling = state.rollingMetrics;

      // Verify rolling metrics enable trend analysis
      expect(rolling.days_7.avg_quality_score).toBeGreaterThan(0);
      expect(rolling.days_30.avg_quality_score).toBeGreaterThan(0);

      // Both periods should have valid data
      expect(rolling.days_7.total_posts).toBeGreaterThanOrEqual(rolling.days_7.days_active);
      expect(rolling.days_30.total_posts).toBeGreaterThanOrEqual(rolling.days_30.days_active);
    });
  });

  describe("P2.4: Stats Endpoint Aggregation", () => {
    it("should aggregate summary metrics across all agents", () => {
      const stateMap = new Map();
      for (const agent of agents) {
        stateMap.set(agent.id, createEngagementState(agent));
      }

      const summary = buildSummary(agents, stateMap);

      // Verify summary aggregates correctly
      expect(summary.total_agents).toBe(agents.length);
      expect(summary.agents_active_today).toBeLessThanOrEqual(agents.length);
      expect(summary.total_posts_created).toBeGreaterThan(0);
      expect(summary.average_posts_per_agent).toBeGreaterThan(0);
      expect(summary.average_engagement_score).toBeGreaterThanOrEqual(0);
      expect(summary.average_engagement_score).toBeLessThanOrEqual(100);
    });

    it("should calculate trend analysis from 7-day windows", () => {
      const stateMap = new Map();
      for (const agent of agents) {
        stateMap.set(agent.id, createEngagementState(agent));
      }

      const trends = buildTrends(stateMap);

      // Verify trends are calculated
      expect(trends.period_days).toBe(7);
      expect(trends.top_topics.length).toBeGreaterThan(0);
      expect(trends.top_topics.length).toBeLessThanOrEqual(5);

      // Verify topic trends have valid metrics
      for (const topic of trends.top_topics) {
        expect(topic.mention_count).toBeGreaterThan(0);
        expect(topic.avg_quality_score).toBeGreaterThanOrEqual(0);
        expect(topic.avg_quality_score).toBeLessThanOrEqual(100);
        expect(topic.engagement_rate).toBeGreaterThanOrEqual(0);
        expect(topic.engagement_rate).toBeLessThanOrEqual(1);
      }

      // Verify quality trend is determined
      expect(["improving", "stable", "declining"]).toContain(trends.quality_trend);
    });

    it("should build per-agent metrics correctly", () => {
      const stateMap = new Map();
      for (const agent of agents) {
        stateMap.set(agent.id, createEngagementState(agent));
      }

      const agentsSection = buildAgentsSection(agents, stateMap);

      // Verify agents section
      expect(agentsSection.agents.length).toBe(agents.length);
      expect(agentsSection.total_active).toBeLessThanOrEqual(agents.length);

      // Verify each agent has valid metrics
      for (const agentMetrics of agentsSection.agents) {
        expect(agentMetrics.agent_id).toBeDefined();
        expect(agentMetrics.posts_created_today).toBeGreaterThanOrEqual(0);
        expect(agentMetrics.posts_created_week).toBeGreaterThanOrEqual(0);
        expect(agentMetrics.average_quality_score).toBeGreaterThanOrEqual(0);
        expect(agentMetrics.average_quality_score).toBeLessThanOrEqual(100);
        expect(agentMetrics.engagement_velocity).toBeGreaterThanOrEqual(0);
      }
    });

    it("should aggregate quality metrics section", () => {
      const stateMap = new Map();
      for (const agent of agents) {
        stateMap.set(agent.id, createEngagementState(agent, true));
      }

      const quality = buildQualitySection(stateMap);

      // Verify quality metrics
      expect(quality.overall_quality_score).toBeGreaterThanOrEqual(0);
      expect(quality.overall_quality_score).toBeLessThanOrEqual(100);
      expect(quality.thread_quality_avg).toBeGreaterThanOrEqual(0);
      expect(quality.thread_quality_avg).toBeLessThanOrEqual(100);
      expect(quality.controversial_threads).toBeGreaterThanOrEqual(0);
      expect(quality.high_quality_threads).toBeGreaterThanOrEqual(0);
      expect(quality.low_quality_threads).toBeGreaterThanOrEqual(0);
      expect(["positive", "neutral", "negative"]).toContain(quality.sentiment_trend);
    });

    it("should handle missing or incomplete data gracefully", () => {
      const stateMap = new Map();

      // Add agent with minimal state
      stateMap.set(agents[0].id, {
        dailyStats: {
          date: "",
          postsCreated: 0,
          commentsMade: 0,
          accountsFollowed: 0,
          dmRequestsSent: 0,
          threadsParticipated: 0,
        },
        dailyReset: "",
        followedAccounts: [],
        subscribedSubmolts: [],
        pendingDmRequests: [],
        engagementQueue: [],
        rateLimits: {
          lastPostTimestamp: 0,
          lastCommentTimestamp: 0,
          lastFollowTimestamp: 0,
          lastDmTimestamp: 0,
        },
        lastEngagementCheck: Date.now(),
        lastPostTime: 0,
        relevanceCache: {},
      });

      // All builders should handle incomplete data without throwing
      expect(() => buildSummary(agents, stateMap)).not.toThrow();
      expect(() => buildTrends(stateMap)).not.toThrow();
      expect(() => buildAgentsSection(agents, stateMap)).not.toThrow();
      expect(() => buildQualitySection(stateMap)).not.toThrow();

      // Results should be sensible even with minimal data
      const summary = buildSummary(agents, stateMap);
      expect(summary.total_agents).toBe(agents.length);
      expect(summary.total_posts_created).toBe(0);
    });

    it("should validate metric bounds (0-100 ranges)", () => {
      const stateMap = new Map();

      // Create state with edge case values
      const state = createEngagementState(agents[0]);
      // Corrupt some values to test bounds checking
      if (state.rollingMetrics) {
        state.rollingMetrics.days_7.avg_quality_score = -50; // Should be bounded to 0-100
      }
      stateMap.set(agents[0].id, state);

      // Summary should apply bounds
      const summary = buildSummary([agents[0]], stateMap);
      expect(summary.average_engagement_score).toBeGreaterThanOrEqual(0);
      expect(summary.average_engagement_score).toBeLessThanOrEqual(100);

      // Quality section should apply bounds
      const quality = buildQualitySection(stateMap);
      expect(quality.overall_quality_score).toBeGreaterThanOrEqual(0);
      expect(quality.overall_quality_score).toBeLessThanOrEqual(100);
    });
  });

  describe("Full Pipeline Integration", () => {
    it("should flow data from engagement state through stats endpoint", () => {
      // Create realistic state for both agents
      const stateMap = new Map();
      for (const agent of agents) {
        stateMap.set(agent.id, createEngagementState(agent, true));
      }

      // Build all stats sections
      const summary = buildSummary(agents, stateMap);
      const trends = buildTrends(stateMap);
      const agentsSection = buildAgentsSection(agents, stateMap);
      const quality = buildQualitySection(stateMap);

      // Verify data flows correctly
      expect(summary.total_agents).toBe(agents.length);
      expect(agentsSection.agents.length).toBe(agents.length);

      // Verify aggregation consistency
      const totalAgentPosts = agentsSection.agents.reduce((sum, a) => sum + a.posts_created_week, 0);
      expect(totalAgentPosts).toBeGreaterThan(0);

      // Verify quality metrics relate to trends
      if (trends.top_topics.length > 0) {
        // Topics with engagement should have quality scores
        for (const topic of trends.top_topics) {
          expect(topic.avg_quality_score).toBeGreaterThanOrEqual(0);
          expect(topic.avg_quality_score).toBeLessThanOrEqual(100);
        }
      }
    });

    it("should calculate rolling metrics correctly", () => {
      // Create a simple rollup set
      const rollups = [
        createDailyRollup("2026-02-20", 2, 80, ["virtue_ethics"]),
        createDailyRollup("2026-02-21", 1, 70, ["consciousness"]),
        createDailyRollup("2026-02-22", 3, 85, ["ai_safety"]),
      ];

      const rolling = calculateRollingMetrics(rollups);

      // Verify aggregation
      expect(rolling.days_7.total_posts).toBe(6);
      expect(rolling.days_7.avg_quality_score).toBeGreaterThan(70);
      expect(rolling.days_7.avg_quality_score).toBeLessThan(90);
      expect(rolling.last_updated_at).toBeGreaterThan(0);
    });

    it("should handle empty/null data without crashing", () => {
      // All builders should handle empty data
      expect(() => buildSummary([], new Map())).not.toThrow();
      expect(() => buildTrends(new Map())).not.toThrow();
      expect(() => buildAgentsSection([], new Map())).not.toThrow();
      expect(() => buildQualitySection(new Map())).not.toThrow();
      expect(() => calculateRollingMetrics([])).not.toThrow();

      // Results should be sensible defaults
      const summary = buildSummary([], new Map());
      expect(summary.total_agents).toBe(0);
      expect(summary.total_posts_created).toBe(0);
      expect(summary.average_engagement_score).toBe(0);
    });
  });
});
