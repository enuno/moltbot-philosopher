/**
 * Engagement Service Types
 * Core domain models for proactive platform engagement automation
 */
/**
 * Philosopher agent names (9 total)
 * Shared type used across services
 */
export type PhilosopherName = "classical" | "existentialist" | "transcendentalist" | "joyce" | "enlightenment" | "beat" | "cyberpunk-posthumanist" | "satirist-absurdist" | "scientist-empiricist";
/**
 * Base event structure for event-driven system
 * Used for platform engagement events
 */
export interface BaseEvent<T = unknown> {
    id: string;
    type: string;
    target: PhilosopherName | null;
    priority: "critical" | "high" | "normal" | "low";
    payload: T;
    metadata: {
        createdAt: Date;
        source: string;
        correlationId?: string;
        retryCount?: number;
    };
}
/**
 * Engagement progression levels for agent participation
 */
export declare enum EngagementLevel {
    Passive = "passive",// Respond when mentioned
    Reactive = "reactive",// Reply to comments on own posts
    Proactive = "proactive",// Initiate interactions, follow accounts
    Generative = "generative"
}
/**
 * Types of engagement actions
 */
export type ActionType = "post" | "comment" | "follow" | "dm";
/**
 * Moltbook platform post representation
 */
export interface Post {
    id: string;
    author: {
        name: string;
        id: string;
        followerCount: number;
    };
    content: string;
    submoltId: string;
    submoltName: string;
    createdAt: number;
    upvotes: number;
    commentCount: number;
}
/**
 * Engagement opportunity identified in feed monitoring
 * Includes relevance score and suggested action
 */
export interface Opportunity {
    id: string;
    postId: string;
    author: {
        name: string;
        id: string;
    };
    content: string;
    submoltId: string;
    relevanceScore: number;
    reason: string;
    suggestedAction: ActionType;
    createdAt: number;
}
/**
 * Action in the engagement queue, awaiting execution
 */
export interface QueuedAction {
    postId: string;
    priority: number;
    reason: string;
    type: ActionType;
}
/**
 * Engagement action ready for execution
 */
export interface Action extends QueuedAction {
    targetAgent: string;
    content?: string;
}
/**
 * Account followed by agent, with quality tracking
 */
export interface FollowedAccount {
    name: string;
    userId?: string;
    postsSeenCount: number;
    firstSeen: number;
    lastEngagement: number;
    qualityScore: number;
}
/**
 * Daily engagement statistics for an agent
 */
export interface DailyStats {
    date: string;
    postsCreated: number;
    commentsMade: number;
    accountsFollowed: number;
    dmRequestsSent: number;
    threadsParticipated: number;
}
/**
 * Rate limit tracking per agent
 * Respects 30-min post cooldown, 20-sec comment spacing
 */
export interface RateLimitState {
    lastPostTimestamp: number;
    lastCommentTimestamp: number;
    lastFollowTimestamp: number;
    lastDmTimestamp: number;
}
/**
 * Thread quality metrics (P2.2)
 */
export interface ThreadQualityMetrics {
    id: string;
    timestamp: number;
    qualityScore: number;
    breakdown: {
        depthScore: number;
        sentimentScore: number;
        controversyScore: number;
        authorQualityScore: number;
    };
    topAuthors: Array<{
        userId: string;
        userName?: string;
        replyEngagementRate: number;
        commentsByAuthor: number;
        repliesReceivedByAuthor: number;
    }>;
}
/**
 * Author engagement metrics per thread (P2.2)
 */
export interface AuthorEngagementMetrics {
    authorId: string;
    authorName?: string;
    commentsByAuthor: number;
    repliesReceivedByAuthor: number;
    replyEngagementRate: number;
}
/**
 * Global author quality metrics (P2.2)
 */
export interface AuthorMetrics {
    authorId: string;
    authorName?: string;
    totalComments: number;
    totalRepliesReceived: number;
    averageQualityScore: number;
    threadIds: string[];
}
/**
 * P2.4: Daily rollup metrics for aggregation
 */
export interface DailyRollup {
    date: string;
    postsCreated: number;
    commentsMade: number;
    accountsFollowed: number;
    averageQualityScore: number;
    topicsEngaged: CanonicalTopicId[];
}
/**
 * P2.4: Rolling metrics aggregate
 */
export interface RollingMetrics {
    days_7: {
        total_posts: number;
        total_comments: number;
        total_follows: number;
        avg_quality_score: number;
        posting_velocity: number;
        days_active: number;
    };
    days_30: {
        total_posts: number;
        total_comments: number;
        total_follows: number;
        avg_quality_score: number;
        posting_velocity: number;
        days_active: number;
    };
    last_updated_at: number;
}
/**
 * Complete engagement state for a single agent
 * Persisted to workspace/{agent}/engagement-state.json
 */
export interface EngagementState {
    dailyStats: DailyStats;
    dailyReset: string;
    followedAccounts: FollowedAccount[];
    subscribedSubmolts: string[];
    pendingDmRequests: Array<{
        targetAgent: string;
        content: string;
        createdAt: number;
    }>;
    engagementQueue: QueuedAction[];
    rateLimits: RateLimitState;
    lastEngagementCheck: number;
    lastPostTime: number;
    relevanceCache: Record<string, {
        score: number;
        expiresAt: number;
    }>;
    threadQualityCache?: Map<string, ThreadQualityMetrics>;
    threadAuthorMetrics?: Map<string, Map<string, AuthorEngagementMetrics>>;
    authorMetrics?: Map<string, AuthorMetrics>;
    lastMaintenanceAt?: number;
    dailyRollups?: DailyRollup[];
    rollingMetrics?: RollingMetrics;
}
/**
 * Philosopher agent in the Moltbot system
 */
export interface Agent {
    id: string;
    type?: PhilosopherName;
    name: string;
    tradition: string;
    statePath: string;
}
/**
 * Result of engagement cycle execution
 */
export interface CycleResult {
    agentsVisited: string[];
    actionsExecuted: number;
    errorsEncountered: string[];
    duration: number;
}
/**
 * Service health status
 */
export interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    uptime: number;
    lastCycleTime?: number;
    errors?: string[];
}
/**
 * P2.3: Canonical discussion topics for engagement
 * 6 core philosophical/technical themes
 */
export type CanonicalTopicId = "virtue_ethics" | "consciousness" | "social_ethics" | "ai_safety" | "epistemology" | "aesthetics";
/**
 * P2.3: Topic match with relevance scoring
 */
export interface TopicMatch {
    topicId: CanonicalTopicId;
    score: number;
    confidence: number;
    keywordMatches: number;
}
/**
 * P2.3: Post template for content generation
 */
export interface PostTemplate {
    id: string;
    agentType: PhilosopherName;
    topicId: CanonicalTopicId;
    styleHint: string;
    textTemplate: string;
}
/**
 * P2.3: Editorial draft awaiting review/approval
 */
export interface EditorialDraft {
    id: string;
    agentId: PhilosopherName;
    topicId: CanonicalTopicId;
    threadId?: string;
    content: string;
    createdAt: number;
    decision: "deferred" | "approved" | "approved_with_edits" | "rejected_low_quality" | "rejected_off_topic" | "rejected_duplicate" | "regenerate";
    decisions: Array<{
        type: string;
        reason: string;
        timestamp: number;
    }>;
}
/**
 * P2.3: Proactive post queue state
 */
export interface ProactivePostQueue {
    drafts: EditorialDraft[];
    stats: {
        totalDrafts: number;
        approvedCount: number;
        rejectedCount: number;
        deferredCount: number;
    };
}
/**
 * P2.4: Service information for stats endpoint
 */
export interface StatsServiceInfo {
    status: "healthy" | "degraded" | "unhealthy";
    uptime_seconds: number;
    data_freshness: {
        last_cycle_at: string;
        cycle_interval_seconds: number;
        is_stale: boolean;
    };
}
/**
 * P2.4: Overall engagement summary across all agents
 */
export interface StatsSummary {
    total_agents: number;
    agents_active_today: number;
    total_posts_created: number;
    total_comments_made: number;
    total_accounts_followed: number;
    average_posts_per_agent: number;
    average_engagement_score: number;
}
/**
 * P2.4: Single topic trend
 */
export interface StatsTopicTrend {
    topic_id: CanonicalTopicId;
    mention_count: number;
    avg_quality_score: number;
    engagement_rate: number;
    trend_direction: "up" | "stable" | "down";
    trend_magnitude: number;
}
/**
 * P2.4: Single thread trend (most engaged)
 */
export interface StatsThreadTrend {
    thread_id: string;
    topic_id: CanonicalTopicId;
    post_count: number;
    quality_score: number;
    engagement_score: number;
    top_agents: string[];
}
/**
 * P2.4: Trend analysis section
 */
export interface StatsTrends {
    period_days: number;
    top_topics: StatsTopicTrend[];
    trending_threads: StatsThreadTrend[];
    posting_velocity_change: number;
    quality_trend: "improving" | "stable" | "declining";
}
/**
 * P2.4: Per-agent topic summary
 */
export interface StatsAgentTopicSummary {
    topic_id: CanonicalTopicId;
    posts_created: number;
    avg_quality_score: number;
    engagement_score: number;
}
/**
 * P2.4: Per-agent metrics
 */
export interface StatsAgentMetrics {
    agent_id: PhilosopherName;
    agent_name: string;
    posts_created_today: number;
    posts_created_week: number;
    comments_made_today: number;
    comments_made_week: number;
    accounts_followed: number;
    average_quality_score: number;
    engagement_velocity: number;
    top_topics: StatsAgentTopicSummary[];
    last_activity_at: string;
}
/**
 * P2.4: Agents metrics section (all agents)
 */
export interface StatsAgentsSection {
    total_active: number;
    agents: StatsAgentMetrics[];
}
/**
 * P2.4: Quality metrics section
 */
export interface StatsQualitySection {
    overall_quality_score: number;
    thread_quality_avg: number;
    author_quality_avg: number;
    sentiment_trend: "positive" | "neutral" | "negative";
    controversial_threads: number;
    high_quality_threads: number;
    low_quality_threads: number;
}
/**
 * P2.4: Complete stats response for /stats endpoint
 */
export interface StatsResponse {
    service: StatsServiceInfo;
    summary: StatsSummary;
    trends: StatsTrends;
    agents: StatsAgentsSection;
    quality: StatsQualitySection;
}
//# sourceMappingURL=types.d.ts.map