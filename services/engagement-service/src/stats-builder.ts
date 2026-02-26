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
 * Handles missing/undefined states gracefully
 */
export function buildSummary(agents: Agent[], stateMap: Map<string, EngagementState>): StatsSummary {
  try {
    const today = new Date().toISOString().split("T")[0];
    let totalPosts = 0;
    let totalComments = 0;
    let totalFollows = 0;
    let activeToday = 0;
    let qualityScores: number[] = [];

    for (const agent of agents || []) {
      try {
        const state = stateMap?.get(agent.id);
        if (!state) continue;

        // Daily stats with fallback
        const dailyStats = state.dailyStats || { date: "", postsCreated: 0, commentsMade: 0, accountsFollowed: 0, dmRequestsSent: 0, threadsParticipated: 0 };
        if (dailyStats.date === today) {
          activeToday++;
          totalPosts += dailyStats.postsCreated || 0;
          totalComments += dailyStats.commentsMade || 0;
          totalFollows += dailyStats.accountsFollowed || 0;
        }

        // Quality from rolling metrics with validation
        if (state.rollingMetrics?.days_7?.avg_quality_score !== undefined) {
          const score = Math.max(0, Math.min(100, state.rollingMetrics.days_7.avg_quality_score));
          qualityScores.push(score);
        }
      } catch (e) {
        // Skip individual agent if error, continue processing others
        console.warn(`Error processing agent ${agent.id}:`, e);
      }
    }

    return {
      total_agents: agents?.length || 0,
      agents_active_today: Math.max(0, activeToday),
      total_posts_created: Math.max(0, totalPosts),
      total_comments_made: Math.max(0, totalComments),
      total_accounts_followed: Math.max(0, totalFollows),
      average_posts_per_agent: agents && agents.length > 0 ? Math.max(0, totalPosts / agents.length) : 0,
      average_engagement_score:
        qualityScores.length > 0
          ? Math.round((qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length) * 100) / 100
          : 0,
    };
  } catch (error) {
    console.error("Error building summary:", error);
    return {
      total_agents: agents?.length || 0,
      agents_active_today: 0,
      total_posts_created: 0,
      total_comments_made: 0,
      total_accounts_followed: 0,
      average_posts_per_agent: 0,
      average_engagement_score: 0,
    };
  }
}

/**
 * Build trend analysis from last 7 days
 * Safely handles missing rollups and quality caches
 */
export function buildTrends(stateMap: Map<string, EngagementState>): StatsTrends {
  try {
    const topicMentions = new Map<string, number>();
    const topicQuality = new Map<string, number[]>();
    const threadIds = new Set<string>();
    let totalPostsLast7 = 0;
    let totalPostsPrevious7 = 0;

    for (const state of Array.from(stateMap?.values() || [])) {
      try {
        if (!state?.dailyRollups || !Array.isArray(state.dailyRollups)) continue;

        const last7 = state.dailyRollups.slice(-7);
        const previous7 = state.dailyRollups.slice(-14).slice(0, 7);

        // Count topics with validation
        for (const rollup of last7 || []) {
          if (!rollup) continue;
          totalPostsLast7 += rollup.postsCreated || 0;
          for (const topic of rollup.topicsEngaged || []) {
            topicMentions.set(topic, (topicMentions.get(topic) ?? 0) + 1);
            if (!topicQuality.has(topic)) {
              topicQuality.set(topic, []);
            }
            const score = Math.max(0, Math.min(100, rollup.averageQualityScore || 0));
            topicQuality.get(topic)!.push(score);
          }
        }

        for (const rollup of previous7 || []) {
          if (!rollup) continue;
          totalPostsPrevious7 += rollup.postsCreated || 0;
        }

        // Collect thread IDs from quality cache with safety check
        if (state.threadQualityCache && typeof state.threadQualityCache.keys === 'function') {
          for (const threadId of Array.from(state.threadQualityCache.keys())) {
            if (threadId) threadIds.add(threadId);
          }
        }
      } catch (e) {
        console.warn("Error processing state in buildTrends:", e);
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
          mention_count: Math.max(0, count),
          avg_quality_score: Math.round(avgQuality * 100) / 100,
          engagement_rate: Math.min(1, Math.max(0, count / Math.max(threadIds.size, 1))),
          trend_direction:
            totalPostsLast7 > totalPostsPrevious7
              ? "up"
              : totalPostsLast7 < totalPostsPrevious7
                ? "down"
                : "stable",
          trend_magnitude: totalPostsPrevious7 > 0 ? Math.max(-1, Math.min(1, (totalPostsLast7 - totalPostsPrevious7) / totalPostsPrevious7)) : 0,
        };
      });

    // Build thread trends (top 5 by quality)
    const threadTrends: StatsThreadTrend[] = [];
    for (const [agentId, state] of Array.from(stateMap.entries())) {
      if (!state.threadQualityCache) continue;
      for (const [threadId, metrics] of Array.from(state.threadQualityCache.entries())) {
        // Calculate engagement score from author engagement metrics if available
        let engagementScore = 0.5;
        if (metrics.topAuthors && metrics.topAuthors.length > 0) {
          const avgReplyRate = metrics.topAuthors.reduce((sum, author) => sum + (author.replyEngagementRate || 0), 0) / metrics.topAuthors.length;
          engagementScore = Math.min(1, avgReplyRate);
        }

        // Infer topic from comment frequency and other signals
        let topicId: any = "virtue_ethics";
        if (metrics.breakdown?.sentimentScore > 0.7) {
          topicId = "consciousness";
        } else if (metrics.breakdown?.controversyScore > 0.6) {
          topicId = "ai_safety";
        }

        threadTrends.push({
          thread_id: threadId,
          topic_id: topicId,
          post_count: 1,
          quality_score: metrics.qualityScore,
          engagement_score: engagementScore,
          top_agents: [agentId],
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
  } catch (error) {
    console.error("Error building trends:", error);
    return {
      period_days: 7,
      top_topics: [],
      trending_threads: [],
      posting_velocity_change: 0,
      quality_trend: "stable",
    };
  }
}

/**
 * Build per-agent metrics
 * Safely handles missing states and metrics
 */
export function buildAgentsSection(agents: Agent[], stateMap: Map<string, EngagementState>): StatsAgentsSection {
  try {
    const agentMetrics: StatsAgentMetrics[] = [];
    const today = new Date().toISOString().split("T")[0];

    for (const agent of agents || []) {
      try {
        const state = stateMap?.get(agent.id);
        if (!state) continue;

        const rolling = state.rollingMetrics;
        const lastActivity = state.lastEngagementCheck
          ? new Date(state.lastEngagementCheck).toISOString()
          : new Date().toISOString();
        const dailyStats = state.dailyStats || { postsCreated: 0, commentsMade: 0, accountsFollowed: 0, date: "", dmRequestsSent: 0, threadsParticipated: 0 };
        const dailyToday = dailyStats.date === today ? dailyStats : { postsCreated: 0, commentsMade: 0, accountsFollowed: 0, date: today, dmRequestsSent: 0, threadsParticipated: 0 };

        // Extract agent's top topics from daily rollups
        const topicCounts = new Map<string, number>();
        if (state.dailyRollups) {
          for (const rollup of state.dailyRollups.slice(-7)) {
            for (const topic of rollup.topicsEngaged || []) {
              topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
            }
          }
        }
        const agentTopTopics = Array.from(topicCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([topic]) => topic);

        agentMetrics.push({
          agent_id: (agent.type || agent.id) as PhilosopherName,
          agent_name: agent.name || "Unknown",
          posts_created_today: Math.max(0, dailyToday.postsCreated || 0),
          posts_created_week: Math.max(0, rolling?.days_7.total_posts ?? 0),
          comments_made_today: Math.max(0, dailyToday.commentsMade || 0),
          comments_made_week: Math.max(0, rolling?.days_7.total_comments ?? 0),
          accounts_followed: Math.max(0, state.followedAccounts?.length || 0),
          average_quality_score: Math.max(0, Math.min(100, rolling?.days_7.avg_quality_score ?? 0)),
          engagement_velocity: Math.max(0, rolling?.days_7.posting_velocity ?? 0),
          top_topics: agentTopTopics,
          last_activity_at: lastActivity,
        });
      } catch (e) {
        console.warn(`Error building metrics for agent ${agent.id}:`, e);
      }
    }

    return {
      total_active: agentMetrics.filter((m) => m.engagement_velocity > 0).length,
      agents: agentMetrics,
    };
  } catch (error) {
    console.error("Error building agents section:", error);
    return {
      total_active: 0,
      agents: [],
    };
  }
}

/**
 * Build quality metrics section
 */
export function buildQualitySection(stateMap: Map<string, EngagementState>): StatsQualitySection {
  try {
    const qualityScores: number[] = [];
    const threadScores: number[] = [];
    let controversialCount = 0;
    let highQualityCount = 0;
    let lowQualityCount = 0;

    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    for (const state of Array.from(stateMap?.values() || [])) {
      try {
        if (state?.rollingMetrics?.days_7?.avg_quality_score !== undefined) {
          const score = Math.max(0, Math.min(100, state.rollingMetrics.days_7.avg_quality_score));
          qualityScores.push(score);
        }

        if (state?.threadQualityCache && typeof state.threadQualityCache.values === 'function') {
          for (const metrics of Array.from(state.threadQualityCache.values())) {
            if (!metrics) continue;
            const qualityScore = Math.max(0, Math.min(100, metrics.qualityScore || 0));
            threadScores.push(qualityScore);
            if (qualityScore >= 75) highQualityCount++;
            if (qualityScore < 50) lowQualityCount++;
            if (metrics.breakdown?.controversyScore > 0.7) controversialCount++;

            // Estimate sentiment from breakdown
            const sentimentScore = metrics.breakdown?.sentimentScore ?? 0.5;
            if (sentimentScore > 0.6) positiveCount++;
            else if (sentimentScore < 0.4) negativeCount++;
            else neutralCount++;
          }
        }
      } catch (e) {
        console.warn("Error processing state in buildQualitySection:", e);
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
      overall_quality_score: Math.max(0, Math.min(100, overallScore)),
      thread_quality_avg: Math.max(0, Math.min(100, threadAvg)),
      author_quality_avg: Math.max(0, Math.min(100, overallScore)),
      sentiment_trend: sentimentTrend,
      controversial_threads: Math.max(0, controversialCount),
      high_quality_threads: Math.max(0, highQualityCount),
      low_quality_threads: Math.max(0, lowQualityCount),
    };
  } catch (error) {
    console.error("Error building quality section:", error);
    return {
      overall_quality_score: 0,
      thread_quality_avg: 0,
      author_quality_avg: 0,
      sentiment_trend: "neutral",
      controversial_threads: 0,
      high_quality_threads: 0,
      low_quality_threads: 0,
    };
  }
}

/**
 * Calculate rolling metrics from daily rollups
 */
export function calculateRollingMetrics(rollups: DailyRollup[]): RollingMetrics {
  try {
    if (!Array.isArray(rollups)) {
      throw new Error("Invalid rollups parameter: expected array");
    }

    const last7 = rollups.slice(-7);
    const last30 = rollups.slice(-30);

    const calculate = (days: DailyRollup[]) => {
      try {
        const posts = days.reduce((sum, d) => sum + Math.max(0, d?.postsCreated || 0), 0);
        const comments = days.reduce((sum, d) => sum + Math.max(0, d?.commentsMade || 0), 0);
        const follows = days.reduce((sum, d) => sum + Math.max(0, d?.accountsFollowed || 0), 0);

        const quality =
          days.length > 0
            ? Math.round(
                (days.reduce((sum, d) => sum + Math.max(0, Math.min(100, d?.averageQualityScore || 0)), 0) /
                  days.length) *
                  100
              ) / 100
            : 0;

        const velocity = days.length > 0 ? Math.round((posts / days.length) * 100) / 100 : 0;
        const daysActive = days.filter((d) => d && d.postsCreated > 0).length;

        return {
          posts: Math.max(0, posts),
          comments: Math.max(0, comments),
          follows: Math.max(0, follows),
          quality: Math.max(0, Math.min(100, quality)),
          velocity: Math.max(0, velocity),
          daysActive: Math.max(0, daysActive),
        };
      } catch (e) {
        console.warn("Error in calculate helper:", e);
        return { posts: 0, comments: 0, follows: 0, quality: 0, velocity: 0, daysActive: 0 };
      }
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
  } catch (error) {
    console.error("Error calculating rolling metrics:", error);
    return {
      days_7: {
        total_posts: 0,
        total_comments: 0,
        total_follows: 0,
        avg_quality_score: 0,
        posting_velocity: 0,
        days_active: 0,
      },
      days_30: {
        total_posts: 0,
        total_comments: 0,
        total_follows: 0,
        avg_quality_score: 0,
        posting_velocity: 0,
        days_active: 0,
      },
      last_updated_at: Date.now(),
    };
  }
}
