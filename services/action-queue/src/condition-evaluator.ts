import axios from 'axios';
import { execSync } from 'child_process';
import {
  Condition,
  ConditionType,
  CompositeCondition,
  ConditionOperator,
  ConditionEvaluation,
  TimeAfterCondition,
  TimeBeforeCondition,
  TimeBetweenCondition,
  AccountActiveCondition,
  ActionCompletedCondition,
  KarmaThresholdCondition,
  FollowerCountCondition,
  PostEngagementCondition,
  ApiCheckCondition,
  RateLimitAvailableCondition,
  CustomCondition,
  ActionStatus,
} from './types';
import { QUEUE_CONFIG } from './config';

/**
 * Condition Evaluator Engine
 *
 * Evaluates complex conditional logic for action execution.
 * Supports time-based, state-based, event-based, and custom conditions.
 */
export class ConditionEvaluator {
  private moltbookApiBase: string;
  private moltbookApiKey: string;

  constructor(
    private db: any, // Database instance
  ) {
    this.moltbookApiBase = QUEUE_CONFIG.moltbookApiBase;
    this.moltbookApiKey = QUEUE_CONFIG.moltbookApiKey;
  }

  /**
   * Evaluate a composite condition (with AND/OR/NOT logic)
   */
  async evaluateCompositeCondition(
    composite: CompositeCondition,
  ): Promise<ConditionEvaluation[]> {
    const evaluations: ConditionEvaluation[] = [];

    for (const condition of composite.conditions) {
      if ('operator' in condition) {
        // Nested composite condition
        const nested = await this.evaluateCompositeCondition(condition);
        evaluations.push(...nested);
      } else {
        // Single condition
        const evaluation = await this.evaluateCondition(condition);
        evaluations.push(evaluation);
      }
    }

    return evaluations;
  }

  /**
   * Check if composite condition is satisfied based on operator
   */
  isCompositeSatisfied(
    composite: CompositeCondition,
    evaluations: ConditionEvaluation[],
  ): boolean {
    const results = evaluations.map((e) => e.satisfied);

    switch (composite.operator) {
      case ConditionOperator.AND:
        return results.every((r) => r);
      case ConditionOperator.OR:
        return results.some((r) => r);
      case ConditionOperator.NOT:
        return !results[0]; // NOT only applies to first condition
      default:
        return false;
    }
  }

  /**
   * Evaluate a single condition
   */
  async evaluateCondition(condition: Condition): Promise<ConditionEvaluation> {
    let result: ConditionEvaluation;

    switch (condition.type) {
      case ConditionType.TIME_AFTER:
        result = this.evaluateTimeAfter(condition as TimeAfterCondition);
        break;
      case ConditionType.TIME_BEFORE:
        result = this.evaluateTimeBefore(condition as TimeBeforeCondition);
        break;
      case ConditionType.TIME_BETWEEN:
        result = this.evaluateTimeBetween(condition as TimeBetweenCondition);
        break;
      case ConditionType.ACCOUNT_ACTIVE:
        result = await this.evaluateAccountActive(
          condition as AccountActiveCondition,
        );
        break;
      case ConditionType.ACTION_COMPLETED:
        result = await this.evaluateActionCompleted(
          condition as ActionCompletedCondition,
        );
        break;
      case ConditionType.KARMA_THRESHOLD:
        result = await this.evaluateKarmaThreshold(
          condition as KarmaThresholdCondition,
        );
        break;
      case ConditionType.FOLLOWER_COUNT:
        result = await this.evaluateFollowerCount(
          condition as FollowerCountCondition,
        );
        break;
      case ConditionType.POST_ENGAGEMENT:
        result = await this.evaluatePostEngagement(
          condition as PostEngagementCondition,
        );
        break;
      case ConditionType.API_CHECK:
        result = await this.evaluateApiCheck(condition as ApiCheckCondition);
        break;
      case ConditionType.RATE_LIMIT_AVAILABLE:
        result = await this.evaluateRateLimitAvailable(
          condition as RateLimitAvailableCondition,
        );
        break;
      case ConditionType.CUSTOM:
        result = await this.evaluateCustom(condition as CustomCondition);
        break;
      default:
        result = {
          conditionId: condition.id,
          type: condition.type,
          satisfied: false,
          evaluatedAt: new Date(),
          message: `Unknown condition type: ${condition.type}`,
        };
    }

    // Apply negation if specified
    if (condition.negated) {
      result.satisfied = !result.satisfied;
      result.message = `NOT (${result.message})`;
    }

    return result;
  }

  /**
   * Time after condition
   */
  private evaluateTimeAfter(condition: TimeAfterCondition): ConditionEvaluation {
    const targetTime = new Date(condition.params.timestamp);
    const now = new Date();
    const satisfied = now >= targetTime;

    return {
      conditionId: condition.id,
      type: condition.type,
      satisfied,
      evaluatedAt: now,
      message: satisfied
        ? `Current time is after ${targetTime.toISOString()}`
        : `Waiting until ${targetTime.toISOString()}`,
      details: {
        targetTime: targetTime.toISOString(),
        currentTime: now.toISOString(),
        remainingSeconds: Math.max(0, (targetTime.getTime() - now.getTime()) / 1000),
      },
    };
  }

  /**
   * Time before condition
   */
  private evaluateTimeBefore(
    condition: TimeBeforeCondition,
  ): ConditionEvaluation {
    const targetTime = new Date(condition.params.timestamp);
    const now = new Date();
    const satisfied = now <= targetTime;

    return {
      conditionId: condition.id,
      type: condition.type,
      satisfied,
      evaluatedAt: now,
      message: satisfied
        ? `Current time is before ${targetTime.toISOString()}`
        : `Time window expired at ${targetTime.toISOString()}`,
      details: {
        targetTime: targetTime.toISOString(),
        currentTime: now.toISOString(),
      },
    };
  }

  /**
   * Time between condition
   */
  private evaluateTimeBetween(
    condition: TimeBetweenCondition,
  ): ConditionEvaluation {
    const start = new Date(condition.params.start);
    const end = new Date(condition.params.end);
    const now = new Date();
    const satisfied = now >= start && now <= end;

    return {
      conditionId: condition.id,
      type: condition.type,
      satisfied,
      evaluatedAt: now,
      message: satisfied
        ? `Current time is within window`
        : `Outside time window ${start.toISOString()} - ${end.toISOString()}`,
      details: {
        start: start.toISOString(),
        end: end.toISOString(),
        currentTime: now.toISOString(),
      },
    };
  }

  /**
   * Account active condition (checks if account is not suspended)
   */
  private async evaluateAccountActive(
    condition: AccountActiveCondition,
  ): Promise<ConditionEvaluation> {
    try {
      // Try to create a post (dry run would be better, but we'll check error)
      const response = await axios.post(
        `${this.moltbookApiBase}/posts`,
        {
          title: 'Test',
          content: 'Test',
          submolt: 'general',
        },
        {
          headers: {
            Authorization: `Bearer ${this.moltbookApiKey}`,
          },
          validateStatus: () => true, // Don't throw on any status
        },
      );

      // If we get 401 with "Account suspended" message, account is inactive
      const isSuspended =
        response.status === 401 &&
        response.data?.error?.toLowerCase().includes('suspended');

      const satisfied = !isSuspended;

      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied,
        evaluatedAt: new Date(),
        message: satisfied
          ? 'Account is active'
          : `Account suspended: ${response.data?.hint || 'unknown reason'}`,
        details: {
          httpStatus: response.status,
          error: response.data?.error,
          hint: response.data?.hint,
        },
      };
    } catch (error: any) {
      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied: false,
        evaluatedAt: new Date(),
        message: `Error checking account status: ${error.message}`,
      };
    }
  }

  /**
   * Action completed condition (wait for another action to complete)
   */
  private async evaluateActionCompleted(
    condition: ActionCompletedCondition,
  ): Promise<ConditionEvaluation> {
    const action = this.db
      .prepare('SELECT * FROM actions WHERE id = ?')
      .get(condition.params.actionId);

    if (!action) {
      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied: false,
        evaluatedAt: new Date(),
        message: `Action ${condition.params.actionId} not found`,
      };
    }

    const requiredStatus =
      condition.params.requiredStatus || ActionStatus.COMPLETED;
    const satisfied = action.status === requiredStatus;

    return {
      conditionId: condition.id,
      type: condition.type,
      satisfied,
      evaluatedAt: new Date(),
      message: satisfied
        ? `Action ${action.id} has status ${requiredStatus}`
        : `Waiting for action ${action.id} to reach ${requiredStatus} (current: ${action.status})`,
      details: {
        actionId: action.id,
        currentStatus: action.status,
        requiredStatus,
      },
    };
  }

  /**
   * Karma threshold condition
   */
  private async evaluateKarmaThreshold(
    condition: KarmaThresholdCondition,
  ): Promise<ConditionEvaluation> {
    try {
      // Fetch agent profile from Moltbook
      const response = await axios.get(
        `${this.moltbookApiBase}/users/${condition.params.agentName}`,
        {
          headers: {
            Authorization: `Bearer ${this.moltbookApiKey}`,
          },
        },
      );

      const karma = response.data?.karma || 0;
      const minKarma = condition.params.minKarma ?? -Infinity;
      const maxKarma = condition.params.maxKarma ?? Infinity;
      const satisfied = karma >= minKarma && karma <= maxKarma;

      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied,
        evaluatedAt: new Date(),
        message: satisfied
          ? `Karma ${karma} is within threshold`
          : `Karma ${karma} is outside threshold [${minKarma}, ${maxKarma}]`,
        details: {
          karma,
          minKarma,
          maxKarma,
        },
      };
    } catch (error: any) {
      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied: false,
        evaluatedAt: new Date(),
        message: `Error fetching karma: ${error.message}`,
      };
    }
  }

  /**
   * Follower count condition
   */
  private async evaluateFollowerCount(
    condition: FollowerCountCondition,
  ): Promise<ConditionEvaluation> {
    try {
      const response = await axios.get(
        `${this.moltbookApiBase}/users/${condition.params.agentName}`,
        {
          headers: {
            Authorization: `Bearer ${this.moltbookApiKey}`,
          },
        },
      );

      const followers = response.data?.followerCount || 0;
      const minFollowers = condition.params.minFollowers ?? -Infinity;
      const maxFollowers = condition.params.maxFollowers ?? Infinity;
      const satisfied = followers >= minFollowers && followers <= maxFollowers;

      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied,
        evaluatedAt: new Date(),
        message: satisfied
          ? `Follower count ${followers} is within threshold`
          : `Follower count ${followers} is outside threshold [${minFollowers}, ${maxFollowers}]`,
        details: {
          followers,
          minFollowers,
          maxFollowers,
        },
      };
    } catch (error: any) {
      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied: false,
        evaluatedAt: new Date(),
        message: `Error fetching follower count: ${error.message}`,
      };
    }
  }

  /**
   * Post engagement condition
   */
  private async evaluatePostEngagement(
    condition: PostEngagementCondition,
  ): Promise<ConditionEvaluation> {
    try {
      const response = await axios.get(
        `${this.moltbookApiBase}/posts/${condition.params.postId}`,
        {
          headers: {
            Authorization: `Bearer ${this.moltbookApiKey}`,
          },
        },
      );

      const upvotes = response.data?.upvotes || 0;
      const comments = response.data?.comment_count || 0;
      const engagementScore = upvotes + comments * 2; // Simple scoring

      const minUpvotes = condition.params.minUpvotes ?? 0;
      const minComments = condition.params.minComments ?? 0;
      const minEngagement = condition.params.minEngagementScore ?? 0;

      const satisfied =
        upvotes >= minUpvotes &&
        comments >= minComments &&
        engagementScore >= minEngagement;

      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied,
        evaluatedAt: new Date(),
        message: satisfied
          ? `Post engagement meets thresholds`
          : `Post engagement below thresholds`,
        details: {
          upvotes,
          comments,
          engagementScore,
          minUpvotes,
          minComments,
          minEngagement,
        },
      };
    } catch (error: any) {
      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied: false,
        evaluatedAt: new Date(),
        message: `Error fetching post engagement: ${error.message}`,
      };
    }
  }

  /**
   * API check condition (call external API and check result)
   */
  private async evaluateApiCheck(
    condition: ApiCheckCondition,
  ): Promise<ConditionEvaluation> {
    try {
      const response = await axios({
        method: condition.params.method,
        url: condition.params.url,
        validateStatus: () => true,
      });

      let satisfied = true;
      const checks: string[] = [];

      // Check HTTP status
      if (condition.params.expectedStatus !== undefined) {
        const statusMatch = response.status === condition.params.expectedStatus;
        satisfied = satisfied && statusMatch;
        checks.push(
          `Status ${response.status} ${statusMatch ? '==' : '!='} ${condition.params.expectedStatus}`,
        );
      }

      // Check body contains string
      if (condition.params.expectedBodyContains !== undefined) {
        const bodyStr = JSON.stringify(response.data);
        const containsMatch = bodyStr.includes(
          condition.params.expectedBodyContains,
        );
        satisfied = satisfied && containsMatch;
        checks.push(
          `Body ${containsMatch ? 'contains' : 'does not contain'} "${condition.params.expectedBodyContains}"`,
        );
      }

      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied,
        evaluatedAt: new Date(),
        message: satisfied
          ? `API check passed: ${checks.join(', ')}`
          : `API check failed: ${checks.join(', ')}`,
        details: {
          url: condition.params.url,
          status: response.status,
          checks,
        },
      };
    } catch (error: any) {
      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied: false,
        evaluatedAt: new Date(),
        message: `API check error: ${error.message}`,
      };
    }
  }

  /**
   * Rate limit available condition
   */
  private async evaluateRateLimitAvailable(
    condition: RateLimitAvailableCondition,
  ): Promise<ConditionEvaluation> {
    // Query rate limit state from database
    const rateLimitState = this.db
      .prepare(
        `SELECT * FROM rate_limits
         WHERE agent_name = ? AND action_type = ?
         ORDER BY window_start DESC LIMIT 1`,
      )
      .get(condition.params.agentName, condition.params.actionType);

    // If no rate limit record, action is available
    if (!rateLimitState) {
      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied: true,
        evaluatedAt: new Date(),
        message: 'No rate limit record, action available',
      };
    }

    // Check if rate limit window has passed
    // (This is simplified - full implementation would check config)
    const windowStart = new Date(rateLimitState.window_start * 1000);
    const now = new Date();
    const windowAge = (now.getTime() - windowStart.getTime()) / 1000;

    // Assume 30 minute window for simplicity (should use actual config)
    const satisfied = windowAge > 1800 || rateLimitState.count < 1;

    return {
      conditionId: condition.id,
      type: condition.type,
      satisfied,
      evaluatedAt: now,
      message: satisfied
        ? 'Rate limit window available'
        : `Rate limit active, wait ${Math.ceil(1800 - windowAge)}s`,
      details: {
        windowStart: windowStart.toISOString(),
        windowAge,
        count: rateLimitState.count,
      },
    };
  }

  /**
   * Custom condition (run external script)
   */
  private async evaluateCustom(
    condition: CustomCondition,
  ): Promise<ConditionEvaluation> {
    try {
      const args = condition.params.args || [];
      const command = `${condition.params.scriptPath} ${args.join(' ')}`;

      const result = execSync(command, {
        encoding: 'utf8',
        timeout: 30000, // 30 second timeout
      });

      const expectedExitCode = condition.params.expectedExitCode ?? 0;
      const satisfied = true; // If execSync didn't throw, exit code was 0

      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied,
        evaluatedAt: new Date(),
        message: `Custom script succeeded`,
        details: {
          script: condition.params.scriptPath,
          output: result.trim(),
        },
      };
    } catch (error: any) {
      return {
        conditionId: condition.id,
        type: condition.type,
        satisfied: false,
        evaluatedAt: new Date(),
        message: `Custom script failed: ${error.message}`,
        details: {
          script: condition.params.scriptPath,
          error: error.message,
        },
      };
    }
  }
}
