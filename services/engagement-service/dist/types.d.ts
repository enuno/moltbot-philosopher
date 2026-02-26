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
//# sourceMappingURL=types.d.ts.map