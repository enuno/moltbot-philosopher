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
  submolt: z.string().optional(),
  submolt_name: z.string().optional(),
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
  lastPostTimestamp: number;
  lastCommentTimestamp: number;
  lastFollowTimestamp: number;
  lastDmTimestamp: number;
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

/**
 * Condition types for conditional action execution
 */
export enum ConditionType {
  TIME_AFTER = 'time_after',
  TIME_BEFORE = 'time_before',
  TIME_BETWEEN = 'time_between',
  ACCOUNT_ACTIVE = 'account_active',
  ACTION_COMPLETED = 'action_completed',
  ACTION_FAILED = 'action_failed',
  KARMA_THRESHOLD = 'karma_threshold',
  FOLLOWER_COUNT = 'follower_count',
  POST_ENGAGEMENT = 'post_engagement',
  API_CHECK = 'api_check',
  RATE_LIMIT_AVAILABLE = 'rate_limit_available',
  CUSTOM = 'custom',
}

/**
 * Condition operators for combining multiple conditions
 */
export enum ConditionOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not',
}

/**
 * Base condition interface
 */
export interface Condition {
  id: string;
  type: ConditionType;
  params: Record<string, unknown>;
  negated?: boolean;
}

/**
 * Time-based condition
 */
export interface TimeAfterCondition extends Condition {
  type: ConditionType.TIME_AFTER;
  params: {
    timestamp: string; // ISO 8601
  };
}

export interface TimeBeforeCondition extends Condition {
  type: ConditionType.TIME_BEFORE;
  params: {
    timestamp: string;
  };
}

export interface TimeBetweenCondition extends Condition {
  type: ConditionType.TIME_BETWEEN;
  params: {
    start: string;
    end: string;
  };
}

/**
 * Account status condition
 */
export interface AccountActiveCondition extends Condition {
  type: ConditionType.ACCOUNT_ACTIVE;
  params: {
    agentName: string;
  };
}

/**
 * Action dependency condition
 */
export interface ActionCompletedCondition extends Condition {
  type: ConditionType.ACTION_COMPLETED;
  params: {
    actionId: string;
    requiredStatus?: ActionStatus.COMPLETED | ActionStatus.FAILED;
  };
}

/**
 * Karma threshold condition
 */
export interface KarmaThresholdCondition extends Condition {
  type: ConditionType.KARMA_THRESHOLD;
  params: {
    agentName: string;
    minKarma?: number;
    maxKarma?: number;
  };
}

/**
 * Follower count condition
 */
export interface FollowerCountCondition extends Condition {
  type: ConditionType.FOLLOWER_COUNT;
  params: {
    agentName: string;
    minFollowers?: number;
    maxFollowers?: number;
  };
}

/**
 * Post engagement condition
 */
export interface PostEngagementCondition extends Condition {
  type: ConditionType.POST_ENGAGEMENT;
  params: {
    postId: string;
    minUpvotes?: number;
    minComments?: number;
    minEngagementScore?: number;
  };
}

/**
 * API check condition (call external API)
 */
export interface ApiCheckCondition extends Condition {
  type: ConditionType.API_CHECK;
  params: {
    url: string;
    method: 'GET' | 'POST';
    expectedStatus?: number;
    expectedBodyContains?: string;
    jsonPath?: string; // JSONPath expression
    expectedValue?: unknown;
  };
}

/**
 * Rate limit availability condition
 */
export interface RateLimitAvailableCondition extends Condition {
  type: ConditionType.RATE_LIMIT_AVAILABLE;
  params: {
    agentName: string;
    actionType: ActionType;
  };
}

/**
 * Custom condition (evaluated by external script)
 */
export interface CustomCondition extends Condition {
  type: ConditionType.CUSTOM;
  params: {
    scriptPath: string;
    args?: string[];
    expectedExitCode?: number;
  };
}

/**
 * Composite condition (combines multiple conditions)
 */
export interface CompositeCondition {
  operator: ConditionOperator;
  conditions: (Condition | CompositeCondition)[];
}

/**
 * Condition evaluation result
 */
export interface ConditionEvaluation {
  conditionId: string;
  type: ConditionType;
  satisfied: boolean;
  evaluatedAt: Date;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Action with conditional execution
 */
export interface ConditionalAction extends QueuedAction {
  conditions?: CompositeCondition;
  conditionCheckInterval?: number; // seconds between checks
  conditionTimeout?: Date; // give up if conditions not met by this time
  lastConditionCheck?: Date;
  conditionEvaluations?: ConditionEvaluation[];
}

/**
 * Condition check request
 */
export const CheckConditionsSchema = z.object({
  actionId: z.string().uuid(),
});

export type CheckConditionsRequest = z.infer<typeof CheckConditionsSchema>;

/**
 * Zod schemas for condition validation
 */
export const ConditionSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(ConditionType),
  params: z.record(z.unknown()),
  negated: z.boolean().optional(),
});

export const CompositeConditionSchema: z.ZodType<CompositeCondition> = z.lazy(
  () =>
    z.object({
      operator: z.nativeEnum(ConditionOperator),
      conditions: z.array(
        z.union([ConditionSchema, CompositeConditionSchema]),
      ),
    }),
);

/**
 * Extended submit action schema with conditions
 */
export const SubmitConditionalActionSchema = SubmitActionSchema.extend({
  conditions: CompositeConditionSchema.optional(),
  conditionCheckInterval: z.number().min(5).max(3600).optional(),
  conditionTimeout: z.string().datetime().optional(),
});

export type SubmitConditionalActionRequest = z.infer<
  typeof SubmitConditionalActionSchema
>;
