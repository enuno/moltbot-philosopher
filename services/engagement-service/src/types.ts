/**
 * Engagement Service Types
 * Core domain models for proactive platform engagement automation
 */

/**
 * Engagement progression levels for agent participation
 */
export enum EngagementLevel {
  Passive = 'passive',      // Respond when mentioned
  Reactive = 'reactive',    // Reply to comments on own posts
  Proactive = 'proactive',  // Initiate interactions, follow accounts
  Generative = 'generative' // Create content that spurs engagement
}

/**
 * Types of engagement actions
 */
export type ActionType = 'post' | 'comment' | 'follow' | 'dm';

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
  relevanceCache: Map<string, { score: number; expiresAt: number }>;
}

/**
 * Philosopher agent in the Moltbot system
 */
export interface Agent {
  id: string; // e.g., "classical", "existentialist"
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
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCycleTime?: number;
  errors?: string[];
}
