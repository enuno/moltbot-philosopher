/**
 * Stats Builder - Aggregates engagement metrics for /stats endpoint
 * Calculates summary, trends, per-agent metrics, and quality metrics
 * from engagement state and quality metrics cache
 */

import {
  Agent,
  EngagementState,
  StatsSummary,
  StatsTrends,
  StatsAgentMetrics,
  StatsAgentsSection,
  StatsQualitySection,
  StatsTopicTrend,
  StatsThreadTrend,
  DailyRollup,
  RollingMetrics,
  ThreadQualityMetrics,
} from "./types";

/**
 * Build summary metrics across all agents
 */
export function buildSummary(agents: Agent[], stateMap: Map<string, EngagementState>): StatsSummary {
  const today = new Date().toISOString().split("T")[0];
  let totalPosts = 0;
  let totalComments = 0;
  let totalFollows = 0;
  let activeToday = 0;
  let qualityScores: number[] = [];

  for (const agent of agents) {
    const state = stateMap.get(agent.id);
    if (!state) continue;

    // Daily stats
    if (state.dailyStats.date === today) {
      activeToday++;
      totalPosts += state.dailyStats.postsCreated;
      totalComments += state.dailyStats.commentsMade;
      totalFollows += state.dailyStats.accountsFollowed;
    }

    // Quality from rolling metrics
    if (state.rollingMetrics) {
      qualityScores.push(state.rollingMetrics.days_7.avg_quality_score);
    }
  }

  return {
    total_agents: agents.length,
    agents_active_today: activeToday,
    total_posts_created: totalPosts,
    total_comments_made: totalComments,
    total_accounts_followed: totalFollows,
    average_posts_per_agent: agents.length > 0 ? totalPosts / agents.length : 0,
    average_engagement_score:
      qualityScores.length > 0
        ? Math.round((qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length) * 100) / 100
        : 0,
  };
}

/**
 * Build trend analysis from last 7 days
 */
export function buildTrends(stateMap: Map<string, EngagementState>): StatsTrends {
  const topicMentions = new Map<string, number>();
  const topicQuality = new Map<string, number[]>();
  const threadIds = new Set<string>();
  let totalPostsLast7 = 0;
  let totalPostsPrevious7 = 0;

  for (const state of Array.from(stateMap.values())) {
    if (!state.dailyRollups) continue;

    const last7 = state.dailyRollups.slice(-7);
    const previous7 = state.dailyRollups.slice(-14).slice(0, 7);

    // Count topics
    for (const rollup of last7) {
      totalPostsLast7 += rollup.postsCreated;
      for (const topic of rollup.topicsEngaged) {
        topicMentions.set(topic, (topicMentions.get(topic) ?? 0) + 1);
        if (!topicQuality.has(topic)) {
          topicQuality.set(topic, []);
        }
        topicQuality.get(topic)!.push(rollup.averageQualityScore);
      }
    }

    for (const rollup of previous7) {
      totalPostsPrevious7 += rollup.postsCreated;
    }

    // Collect thread IDs from quality cache
    if (state.threadQualityCache) {
      for (const threadId of Array.from(state.threadQualityCache.keys())) {
        threadIds.add(threadId);
      }
    }
  }

  // Build topic trends (top 5)
  const topicTrends: StatsTopicTrend[] = Array.from(topicMentions.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topicId, count]) => {
      const scores = topicQuality.get(topicId) ?? [];
      const avgQuality = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        topic_id: topicId as any,
        mention_count: count,
        avg_quality_score: Math.round(avgQuality * 100) / 100,
        engagement_rate: Math.min(count / Math.max(threadIds.size, 1), 1),
        trend_direction:
          totalPostsLast7 > totalPostsPrevious7
            ? "up"
            : totalPostsLast7 < totalPostsPrevious7
              ? "down"
              : "stable",
        trend_magnitude: totalPostsPrevious7 > 0 ? (totalPostsLast7 - totalPostsPrevious7) / totalPostsPrevious7 : 0,
      };
    });

  // Build thread trends (top 5 by quality)
  const threadTrends: StatsThreadTrend[] = [];
  for (const state of Array.from(stateMap.values())) {
    if (!state.threadQualityCache) continue;
    for (const [threadId, metrics] of Array.from(state.threadQualityCache.entries())) {
      threadTrends.push({
        thread_id: threadId,
        topic_id: "virtue_ethics", // Default, would need mapping
        post_count: 1,
        quality_score: metrics.qualityScore,
        engagement_score: 0.5, // Would calculate from metrics
        top_agents: [state.dailyStats.date],
      });
    }
  }
  threadTrends.sort((a, b) => b.quality_score - a.quality_score);

  const posting_velocity_change = totalPostsPrevious7 > 0 ? (totalPostsLast7 - totalPostsPrevious7) / totalPostsPrevious7 : 0;

  return {
    period_days: 7,
    top_topics: topicTrends,
    trending_threads: threadTrends.slice(0, 5),
    posting_velocity_change,
    quality_trend: posting_velocity_change > 0.1 ? "improving" : posting_velocity_change < -0.1 ? "declining" : "stable",
  };
}

/**
 * Build per-agent metrics
 */
export function buildAgentsSection(agents: Agent[], stateMap: Map<string, EngagementState>): StatsAgentsSection {
  const agentMetrics: StatsAgentMetrics[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const agent of agents) {
    const state = stateMap.get(agent.id);
    if (!state) continue;

    const rolling = state.rollingMetrics;
    const lastActivity = state.lastEngagementCheck ? new Date(state.lastEngagementCheck).toISOString() : new Date().toISOString();
    const dailyToday = state.dailyStats.date === today ? state.dailyStats : { postsCreated: 0, commentsMade: 0, accountsFollowed: 0, date: today, dmRequestsSent: 0, threadsParticipated: 0 };

    agentMetrics.push({
      agent_id: agent.type || (agent.id as any),
      agent_name: agent.name,
      posts_created_today: dailyToday.postsCreated,
      posts_created_week: rolling?.days_7.total_posts ?? 0,
      comments_made_today: dailyToday.commentsMade,
      comments_made_week: rolling?.days_7.total_comments ?? 0,
      accounts_followed: state.followedAccounts.length,
      average_quality_score: rolling?.days_7.avg_quality_score ?? 0,
      engagement_velocity: rolling?.days_7.posting_velocity ?? 0,
      top_topics: [],
      last_activity_at: lastActivity,
    });
  }

  return {
    total_active: agentMetrics.filter((m) => m.engagement_velocity > 0).length,
    agents: agentMetrics,
  };
}

/**
 * Build quality metrics section
 */
export function buildQualitySection(stateMap: Map<string, EngagementState>): StatsQualitySection {
  const qualityScores: number[] = [];
  const threadScores: number[] = [];
  let controversialCount = 0;
  let highQualityCount = 0;
  let lowQualityCount = 0;

  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  for (const state of Array.from(stateMap.values())) {
    if (state.rollingMetrics) {
      qualityScores.push(state.rollingMetrics.days_7.avg_quality_score);
    }

    if (state.threadQualityCache) {
      for (const metrics of Array.from(state.threadQualityCache.values())) {
        threadScores.push(metrics.qualityScore);
        if (metrics.qualityScore >= 75) highQualityCount++;
        if (metrics.qualityScore < 50) lowQualityCount++;
        if (metrics.breakdown.controversyScore > 0.7) controversialCount++;

        // Estimate sentiment from breakdown
        if (metrics.breakdown.sentimentScore > 0.6) positiveCount++;
        else if (metrics.breakdown.sentimentScore < 0.4) negativeCount++;
        else neutralCount++;
      }
    }
  }

  const overallScore =
    qualityScores.length > 0 ? Math.round((qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length) * 100) / 100 : 0;
  const threadAvg =
    threadScores.length > 0 ? Math.round((threadScores.reduce((a, b) => a + b, 0) / threadScores.length) * 100) / 100 : 0;

  const sentimentTrend =
    positiveCount > negativeCount * 1.2
      ? "positive"
      : negativeCount > positiveCount * 1.2
        ? "negative"
        : "neutral";

  return {
    overall_quality_score: overallScore,
    thread_quality_avg: threadAvg,
    author_quality_avg: overallScore,
    sentiment_trend: sentimentTrend,
    controversial_threads: controversialCount,
    high_quality_threads: highQualityCount,
    low_quality_threads: lowQualityCount,
  };
}

/**
 * Calculate rolling metrics from daily rollups
 */
export function calculateRollingMetrics(rollups: DailyRollup[]): RollingMetrics {
  const last7 = rollups.slice(-7);
  const last30 = rollups.slice(-30);

  const calculate = (days: DailyRollup[]) => {
    const posts = days.reduce((sum, d) => sum + d.postsCreated, 0);
    const comments = days.reduce((sum, d) => sum + d.commentsMade, 0);
    const follows = days.reduce((sum, d) => sum + d.accountsFollowed, 0);
    const quality =
      days.length > 0
        ? Math.round((days.reduce((sum, d) => sum + d.averageQualityScore, 0) / days.length) * 100) / 100
        : 0;
    const velocity = days.length > 0 ? Math.round((posts / days.length) * 100) / 100 : 0;
    const daysActive = days.filter((d) => d.postsCreated > 0).length;

    return { posts, comments, follows, quality, velocity, daysActive };
  };

  const days7 = calculate(last7);
  const days30 = calculate(last30);

  return {
    days_7: {
      total_posts: days7.posts,
      total_comments: days7.comments,
      total_follows: days7.follows,
      avg_quality_score: days7.quality,
      posting_velocity: days7.velocity,
      days_active: days7.daysActive,
    },
    days_30: {
      total_posts: days30.posts,
      total_comments: days30.comments,
      total_follows: days30.follows,
      avg_quality_score: days30.quality,
      posting_velocity: days30.velocity,
      days_active: days30.daysActive,
    },
    last_updated_at: Date.now(),
  };
}
