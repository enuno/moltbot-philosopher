import { z } from 'zod';

/**
 * Action types supported by the queue
 */
export enum ActionType {
  POST = 'post',
  COMMENT = 'comment',
  UPVOTE = 'upvote',
  DOWNVOTE = 'downvote',
  FOLLOW = 'follow',
  UNFOLLOW = 'unfollow',
  CREATE_SUBMOLT = 'create_submolt',
  SEND_DM = 'send_dm',
  SKILL_UPDATE = 'skill_update',
}

/**
 * Action priority levels
 */
export enum Priority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Action status in queue
 */
export enum ActionStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RATE_LIMITED = 'rate_limited',
  CANCELLED = 'cancelled',
}

/**
 * Rate limit configuration per action type
 */
export interface RateLimitConfig {
  actionType: ActionType;
  maxPerInterval: number;
  intervalSeconds: number;
  dailyMax?: number;
}

/**
 * Action payload schemas
 */
export const PostActionSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(40000),
  submolt: z.string(),
  url: z.string().url().optional(),
});

export const CommentActionSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().min(1).max(10000),
  parentCommentId: z.string().uuid().optional(),
});

export const VoteActionSchema = z.object({
  targetId: z.string().uuid(),
  targetType: z.enum(['post', 'comment']),
});

export const FollowActionSchema = z.object({
  username: z.string().min(1).max(50),
});

export const CreateSubmoltActionSchema = z.object({
  name: z.string().min(3).max(21),
  displayName: z.string().min(3).max(50),
  description: z.string().max(500),
  rules: z.string().optional(),
});

export const SendDMActionSchema = z.object({
  recipientUsername: z.string(),
  subject: z.string().max(200).optional(),
  content: z.string().min(1).max(10000),
});

/**
 * Base action interface
 */
export interface QueuedAction {
  id: string;
  agentName: string;
  actionType: ActionType;
  priority: Priority;
  payload: Record<string, unknown>;
  status: ActionStatus;
  scheduledFor?: Date;
  createdAt: Date;
  attemptedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  attempts: number;
  maxAttempts: number;
  error?: string;
  httpStatus?: number;
  metadata?: Record<string, unknown>;
}

/**
 * API request to submit action
 */
export const SubmitActionSchema = z.object({
  agentName: z.string().min(1),
  actionType: z.nativeEnum(ActionType),
  priority: z.nativeEnum(Priority).optional().default(Priority.NORMAL),
  payload: z.record(z.unknown()),
  scheduledFor: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SubmitActionRequest = z.infer<typeof SubmitActionSchema>;

/**
 * Rate limit state tracking
 */
export interface RateLimitState {
  actionType: ActionType;
  agentName: string;
  windowStart: Date;
  count: number;
  dailyCount: number;
  dailyReset: Date;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pending: number;
  scheduled: number;
  processing: number;
  completed: number;
  failed: number;
  rateLimited: number;
  totalActions: number;
  oldestPending?: Date;
  nextScheduled?: Date;
  rateLimitsByType: Record<ActionType, RateLimitState[]>;
}
