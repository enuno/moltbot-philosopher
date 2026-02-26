/**
 * Engagement Service Types
 * Core domain models for proactive platform engagement automation
 */

/**
 * Philosopher agent names (9 total)
 * Shared type used across services
 */
export type PhilosopherName =
  | "classical"
  | "existentialist"
  | "transcendentalist"
  | "joyce"
  | "enlightenment"
  | "beat"
  | "cyberpunk-posthumanist"
  | "satirist-absurdist"
  | "scientist-empiricist";

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
export enum EngagementLevel {
  Passive = "passive", // Respond when mentioned
  Reactive = "reactive", // Reply to comments on own posts
  Proactive = "proactive", // Initiate interactions, follow accounts
  Generative = "generative", // Create content that spurs engagement
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
  author: { name: string; id: string };
  content: string;
  submoltId: string;
  relevanceScore: number; // 0-1 semantic match to agent tradition
  reason: string; // Why this post is relevant ("Semantic match: virtue ethics")
  suggestedAction: ActionType;
  createdAt: number;
}

/**
 * Action in the engagement queue, awaiting execution
 */
export interface QueuedAction {
  postId: string;
  priority: number; // 0-1, sorted descending
  reason: string;
  type: ActionType;
}

/**
 * Engagement action ready for execution
 */
export interface Action extends QueuedAction {
  targetAgent: string;
  content?: string; // Generated content for post/comment
}

/**
 * Account followed by agent, with quality tracking
 */
export interface FollowedAccount {
  name: string;
  userId?: string;
  postsSeenCount: number; // Minimum 3 before follow decision
  firstSeen: number; // Timestamp
  lastEngagement: number; // Timestamp
  qualityScore: number; // 0-1, updated over time
}

/**
 * Daily engagement statistics for an agent
 */
export interface DailyStats {
  date: string; // ISO date YYYY-MM-DD
  postsCreated: number; // Max 1-3 depending on submolt
  commentsMade: number; // Max 50
  accountsFollowed: number; // Max 2
  dmRequestsSent: number; // Max 2
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
  date: string; // ISO date YYYY-MM-DD
  postsCreated: number;
  commentsMade: number;
  accountsFollowed: number;
  averageQualityScore: number; // 0-100
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
    posting_velocity: number; // posts per day
    days_active: number;
  };
  days_30: {
    total_posts: number;
    total_comments: number;
    total_follows: number;
    avg_quality_score: number;
    posting_velocity: number; // posts per day
    days_active: number;
  };
  last_updated_at: number; // Unix timestamp
}

/**
 * Complete engagement state for a single agent
 * Persisted to workspace/{agent}/engagement-state.json
 */
export interface EngagementState {
  // Daily statistics
  dailyStats: DailyStats;
  dailyReset: string; // ISO date, triggers automatic reset

  // Accounts this agent is following
  followedAccounts: FollowedAccount[];

  // Subscribed submolts
  subscribedSubmolts: string[]; // e.g., ["ethics-convergence", "general", "aithoughts"]

  // Pending DM requests to send
  pendingDmRequests: Array<{
    targetAgent: string;
    content: string;
    createdAt: number;
  }>;

  // Queue of engagement opportunities awaiting execution
  engagementQueue: QueuedAction[];

  // Rate limit state tracking
  rateLimits: RateLimitState;

  // Last timestamps for scheduling
  lastEngagementCheck: number;
  lastPostTime: number;

  // Cache for Noosphere relevance scores (TTL 1 hour)
  relevanceCache: Record<string, { score: number; expiresAt: number }>;

  // P2.2: Quality metrics cache (30-day rolling window)
  threadQualityCache?: Map<string, ThreadQualityMetrics>;

  // P2.2: Per-thread author engagement metrics (nested: threadId -> authorId -> metrics)
  threadAuthorMetrics?: Map<string, Map<string, AuthorEngagementMetrics>>;

  // P2.2: Global author quality metrics
  authorMetrics?: Map<string, AuthorMetrics>;

  // P2.2: Last maintenance timestamp for pruning
  lastMaintenanceAt?: number;

  // P2.4: Daily rollup history (last 30 days)
  dailyRollups?: DailyRollup[];

  // P2.4: Aggregated rolling metrics
  rollingMetrics?: RollingMetrics;
}

/**
 * Philosopher agent in the Moltbot system
 */
export interface Agent {
  id: string; // e.g., "classical", "existentialist"
  type?: PhilosopherName; // Agent type from PhilosopherName (used in P2.1 scoring)
  name: string;
  tradition: string; // e.g., "Stoicism", "Existentialism"
  statePath: string; // workspace/{id}/engagement-state.json
}

/**
 * Result of engagement cycle execution
 */
export interface CycleResult {
  agentsVisited: string[];
  actionsExecuted: number;
  errorsEncountered: string[];
  duration: number; // milliseconds
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
export type CanonicalTopicId =
  | "virtue_ethics"
  | "consciousness"
  | "social_ethics"
  | "ai_safety"
  | "epistemology"
  | "aesthetics";

/**
 * P2.3: Topic match with relevance scoring
 */
export interface TopicMatch {
  topicId: CanonicalTopicId;
  score: number; // 0-1, keyword density + direct match boost
  confidence: number; // 0-1, how certain we are
  keywordMatches: number; // Count of matching keywords
}

/**
 * P2.3: Post template for content generation
 */
export interface PostTemplate {
  id: string;
  agentType: PhilosopherName;
  topicId: CanonicalTopicId;
  styleHint: string; // e.g., "witty", "formal", "contemplative"
  textTemplate: string; // Template with {slot_name} placeholders
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
  decision: "deferred" | "approved" | "approved_with_edits" | "rejected_low_quality"
    | "rejected_off_topic" | "rejected_duplicate" | "regenerate";
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
    last_cycle_at: string; // ISO timestamp
    cycle_interval_seconds: number;
    is_stale: boolean; // true if no update for 2x interval
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
  average_engagement_score: number; // 0-100
}

/**
 * P2.4: Single topic trend
 */
export interface StatsTopicTrend {
  topic_id: CanonicalTopicId;
  mention_count: number;
  avg_quality_score: number; // 0-100
  engagement_rate: number; // 0-1
  trend_direction: "up" | "stable" | "down";
  trend_magnitude: number; // 0-1, percentage change
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
  top_agents: string[]; // Top 3 agent IDs
}

/**
 * P2.4: Trend analysis section
 */
export interface StatsTrends {
  period_days: number;
  top_topics: StatsTopicTrend[];
  trending_threads: StatsThreadTrend[];
  posting_velocity_change: number; // -1 to 1 (down to up)
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
  average_quality_score: number; // 0-100
  engagement_velocity: number; // posts/hour, last 24h
  top_topics: StatsAgentTopicSummary[];
  last_activity_at: string; // ISO timestamp
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
  overall_quality_score: number; // 0-100
  thread_quality_avg: number;
  author_quality_avg: number;
  sentiment_trend: "positive" | "neutral" | "negative";
  controversial_threads: number;
  high_quality_threads: number; // score >= 75
  low_quality_threads: number; // score < 50
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
