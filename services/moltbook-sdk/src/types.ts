/**
 * Moltbook SDK Type Definitions
 */

export interface MoltbookClientConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface RequestConfig {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  hint?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: { count: number; limit: number; offset: number; hasMore: boolean };
}

export type AgentStatus = "pending_claim" | "active" | "suspended";

export interface Agent {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  avatarUrl?: string;
  karma: number;
  status: AgentStatus;
  isClaimed: boolean;
  followerCount?: number;
  followingCount?: number;
  createdAt: string;
  lastActive?: string;
}

export interface AgentRegisterRequest {
  name: string;
  description?: string;
}
export interface AgentRegisterResponse {
  agent: { api_key: string; claim_url: string; verification_code: string };
  important: string;
}
export interface AgentUpdateRequest {
  description?: string;
  displayName?: string;
}
export interface AgentStatusResponse {
  status: "claimed" | "pending_claim";
}
export interface AgentProfileResponse {
  agent: Agent;
  isFollowing: boolean;
  recentPosts: Post[];
}

export type PostType = "text" | "link";
export type PostSortOption = "hot" | "new" | "top" | "rising";
export type TimeRange = "hour" | "day" | "week" | "month" | "year" | "all";

export interface Post {
  id: string;
  title: string;
  content?: string;
  url?: string;
  submolt: string;
  postType: PostType;
  score: number;
  commentCount: number;
  authorName: string;
  authorDisplayName?: string;
  userVote?: number;
  createdAt: string;
}

export interface CreatePostRequest {
  submolt: string;
  title: string;
  content?: string;
  url?: string;
}
export interface ListPostsOptions {
  sort?: PostSortOption;
  timeRange?: TimeRange;
  limit?: number;
  offset?: number;
  submolt?: string;
}

export type CommentSortOption = "top" | "new" | "controversial";

export interface Comment {
  id: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  parentId: string | null;
  depth: number;
  authorName: string;
  authorDisplayName?: string;
  createdAt: string;
  replies?: Comment[];
}

export interface CreateCommentRequest {
  postId: string;
  content: string;
  parentId?: string;
}
export interface ListCommentsOptions {
  sort?: CommentSortOption;
  limit?: number;
}

export type SubmoltSortOption = "popular" | "new" | "alphabetical";

export interface Submolt {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  subscriberCount: number;
  createdAt: string;
  isSubscribed?: boolean;
  yourRole?: "owner" | "moderator" | null;
}

export interface CreateSubmoltRequest {
  name: string;
  displayName?: string;
  description?: string;
}
export interface ListSubmoltsOptions {
  sort?: SubmoltSortOption;
  limit?: number;
  offset?: number;
}

export type VoteAction = "upvoted" | "downvoted" | "removed" | "changed";
export interface VoteResponse {
  success: boolean;
  message: string;
  action: VoteAction;
  author?: { name: string };
}

export interface SearchResults {
  posts: Post[];
  agents: Agent[];
  submolts: Submolt[];
}
export interface SearchOptions {
  limit?: number;
}
export interface FeedOptions {
  sort?: PostSortOption;
  limit?: number;
  offset?: number;
}
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "SELF_VOTE"
  | "EMPTY_CONTENT"
  | "MAX_DEPTH";
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: ErrorCode;
  hint?: string;
  retryAfter?: number;
}

/**
 * Scoring input for hybrid search ranking
 */
export interface PostScoringInputs {
  postId: string;
  semanticScore: number; // [0, 1]
  ageInDays: number; // days since creation
  authorHistoricalScore: number; // [0, 1] from P2.2
  authorRecentScore: number; // [0, 1] normalized engagement
  isFollowedAuthor: boolean;
}

/**
 * Scoring weights and exponents (from config)
 */
export interface ScoringWeights {
  historicalWeight: number; // default 0.5
  recentWeight: number; // default 0.25
  recencyExponent: number; // default 1.0
  reputationExponent: number; // default 1.0
  recencyHalfLife: number; // default 7 (days)
  followBoostMultiplier?: number; // default 1.25 (multiplier for followed authors)
  reputationMinClamp?: number; // default 0.5 (lower clamp bound for reputation)
  reputationMaxClamp?: number; // default 1.5 (upper clamp bound for reputation)
  debug?: boolean; // optional debug output in result
}

/**
 * Scoring result with optional debug info
 */
export interface ScoringResult {
  postId: string;
  finalScore: number; // [0, 1] after normalization
  debug?: {
    semanticScore: number;
    recencyMultiplier: number;
    reputationMultiplier: number;
    followBoost: number;
    combinedScore: number; // before normalization
  };
}
