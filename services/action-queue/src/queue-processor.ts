import { DatabaseManager } from './database';
import { RateLimiter } from './rate-limiter';
import { ActionExecutor } from './action-executor';
import { ConditionEvaluator } from './condition-evaluator';
import { CircuitBreaker } from './circuit-breaker';
import { ActionStatus, ConditionalAction } from './types';
import { QUEUE_CONFIG } from './config';

/**
 * Queue Processor
 *
 * Main processing loop that:
 * 1. Checks conditional actions
 * 2. Processes pending actions
 * 3. Enforces rate limits
 * 4. Handles retries
 */
export class QueueProcessor {
  private db: DatabaseManager;
  private rateLimiter: RateLimiter;
  private executor: ActionExecutor;
  private conditionEvaluator: ConditionEvaluator;
  private circuitBreaker: CircuitBreaker;
  private processingInterval: NodeJS.Timeout | null = null;
  private conditionCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.rateLimiter = new RateLimiter(db);
    this.executor = new ActionExecutor();
    this.conditionEvaluator = new ConditionEvaluator(db.getDb());
    this.circuitBreaker = new CircuitBreaker({
      maxConsecutiveFailures: 3,
      onTripped: (failures) => {
        console.error(
          `🚨 Circuit breaker tripped after ${failures} consecutive failures - disabling worker`,
        );
        // NTFY alert would be sent here if NTFY_URL is configured
        const ntfyUrl = process.env.NTFY_URL;
        if (ntfyUrl) {
          // Fire-and-forget NTFY alert; import fetch is available in Node 18+
          fetch(ntfyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: `Action queue circuit breaker tripped after ${failures} failures. Worker disabled. Manual reset required.`,
          }).catch(() => {/* NTFY alert failure is non-fatal */});
        }
      },
    });
  }

  /**
   * Start the queue processor
   */
  start(): void {
    console.log('🚀 Starting queue processor...');

    // Main processing loop - every 5 seconds
    this.processingInterval = setInterval(
      () => this.processQueue(),
      QUEUE_CONFIG.processingInterval * 1000,
    );

    // Condition check loop - every 30 seconds
    this.conditionCheckInterval = setInterval(
      () => this.checkConditionalActions(),
      QUEUE_CONFIG.scheduledCheckInterval * 1000,
    );

    // Scheduled action activation loop - every 5 seconds (same cadence as processing)
    // Transitions status='scheduled' → 'pending' when scheduledFor time arrives
    setInterval(
      () => this.activateScheduledActions(),
      QUEUE_CONFIG.processingInterval * 1000,
    );

    // Initial runs
    this.activateScheduledActions();
    this.processQueue();
    this.checkConditionalActions();

    console.log('✅ Queue processor started');
  }

  /**
   * Stop the queue processor
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping queue processor...');
    this.isShuttingDown = true;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.conditionCheckInterval) {
      clearInterval(this.conditionCheckInterval);
    }

    console.log('✅ Queue processor stopped');
  }

  /**
   * Main queue processing loop
   */
  private async processQueue(): Promise<void> {
    if (this.isShuttingDown) return;

    // Circuit breaker: skip processing when tripped to avoid cascading failures
    if (this.circuitBreaker.isTripped) {
      console.debug('⚡ Circuit breaker open - skipping queue processing');
      return;
    }

    try {
      const action = this.db.getNextAction();
      if (!action) return; // No actions to process

      console.log(`📋 Processing action ${action.id} (${action.actionType})`);

      // Check rate limits
      const rateLimitCheck = await this.rateLimiter.isAllowed(action);
      if (!rateLimitCheck.allowed) {
        console.log(
          `⏱️  Action ${action.id} rate limited: ${rateLimitCheck.reason}`,
        );

        // If we know when it can be retried, schedule it for then
        if (rateLimitCheck.retryAfter) {
          const scheduledFor = new Date(
            Date.now() + rateLimitCheck.retryAfter * 1000,
          );
          console.log(
            `⏰ Action ${action.id} scheduled for retry at ${scheduledFor.toISOString()}`,
          );
          this.db.updateActionStatus(action.id, ActionStatus.SCHEDULED);
          this.db.updateScheduledFor(action.id, scheduledFor);
        } else {
          this.db.updateActionStatus(action.id, ActionStatus.RATE_LIMITED);
        }

        return;
      }

      // Mark as processing
      this.db.updateActionStatus(action.id, ActionStatus.PROCESSING);
      this.db.incrementAttempts(action.id);

      // Execute the action
      const result = await this.executor.execute(action);

      if (result.success) {
        // Success!
        console.log(`✅ Action ${action.id} completed successfully`);
        this.db.updateActionStatus(action.id, ActionStatus.COMPLETED);

        // Record rate limit usage and reset circuit breaker
        this.rateLimiter.recordAction(action);
        this.circuitBreaker.recordSuccess();
      } else {
        // Sync daily limit from API 429 response body if available
        if (result.dailyRemaining !== undefined) {
          this.rateLimiter.syncFromApiResponse(
            action.agentName,
            action.actionType,
            result.dailyRemaining,
          );
        }

        // Rate limit failures are expected behavior - don't count against circuit breaker
        const isRateLimit = result.httpStatus === 429;
        if (!isRateLimit) {
          this.circuitBreaker.recordFailure();
        }

        // Failed
        console.log(`❌ Action ${action.id} failed: ${result.error}`);

        // Check if we should retry
        const canRetry =
          action.attempts < action.maxAttempts &&
          this.executor.isRetryable(result.httpStatus);

        if (canRetry) {
          // Calculate exponential backoff
          const backoffSeconds = this.calculateBackoff(action.attempts);
          const scheduledFor = new Date(Date.now() + backoffSeconds * 1000);

          console.log(
            `🔄 Will retry action ${action.id} in ${backoffSeconds}s (attempt ${action.attempts + 1}/${action.maxAttempts})`,
          );

          // Schedule retry: set status=scheduled and record the future time.
          // activateScheduledActions() will flip it back to pending when ready.
          this.db.updateActionStatus(action.id, ActionStatus.SCHEDULED);
          this.db.updateScheduledFor(action.id, scheduledFor);
        } else {
          // Permanent failure
          console.log(`💀 Action ${action.id} permanently failed`);
          this.db.updateActionStatus(
            action.id,
            ActionStatus.FAILED,
            result.error,
            result.httpStatus,
          );
        }
      }
    } catch (error: any) {
      console.error('Error in queue processor:', error);
    }
  }

  /**
   * Activate time-based scheduled actions whose scheduled_for time has arrived.
   * This handles both retry backoff and rate-limit deferrals (no conditions).
   */
  private activateScheduledActions(): void {
    if (this.isShuttingDown) return;

    try {
      const activated = this.db.activateReadyScheduledActions();
      if (activated > 0) {
        console.log(`⏰ Activated ${activated} scheduled action(s)`);
      }
    } catch (error: any) {
      console.error('Error activating scheduled actions:', error);
    }
  }

  /**
   * Check conditional actions and activate when conditions met
   */
  private async checkConditionalActions(): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      const actions = this.db.getConditionalActionsDueForCheck();
      if (actions.length === 0) return;

      console.log(
        `🔍 Checking conditions for ${actions.length} action(s)...`,
      );

      for (const action of actions) {
        await this.checkActionConditions(action);
      }
    } catch (error: any) {
      console.error('Error checking conditional actions:', error);
    }
  }

  /**
   * Check conditions for a single action
   */
  private async checkActionConditions(
    action: ConditionalAction,
  ): Promise<void> {
    if (!action.conditions) return;

    try {
      // Check if timeout expired
      if (action.conditionTimeout && new Date() > action.conditionTimeout) {
        console.log(
          `⏰ Action ${action.id} condition timeout expired, cancelling`,
        );
        this.db.cancelAction(action.id, 'Condition timeout expired');
        return;
      }

      // Evaluate all conditions
      const evaluations =
        await this.conditionEvaluator.evaluateCompositeCondition(
          action.conditions,
        );

      // Store evaluations
      for (const evaluation of evaluations) {
        this.db.storeConditionEvaluation(action.id, evaluation);
      }

      // Check if all conditions satisfied
      const satisfied = this.conditionEvaluator.isCompositeSatisfied(
        action.conditions,
        evaluations,
      );

      // Update last check time
      this.db.updateLastConditionCheck(action.id);

      if (satisfied) {
        console.log(
          `✅ Action ${action.id} conditions satisfied, activating`,
        );
        this.db.updateActionStatus(action.id, ActionStatus.PENDING);
      } else {
        const unsatisfied = evaluations
          .filter((e) => !e.satisfied)
          .map((e) => e.message)
          .join(', ');
        console.log(
          `⏳ Action ${action.id} conditions not yet met: ${unsatisfied}`,
        );
      }
    } catch (error: any) {
      console.error(
        `Error checking conditions for action ${action.id}:`,
        error,
      );
    }
  }

  /**
   * Calculate exponential backoff for retries
   */
  private calculateBackoff(attempts: number): number {
    const baseDelay = 60; // 1 minute
    const maxDelay = 3600; // 1 hour
    const delay =
      baseDelay * Math.pow(QUEUE_CONFIG.retryBackoffMultiplier, attempts);
    return Math.min(delay, maxDelay);
  }

  /**
   * Get processor statistics
   */
  getStats(): any {
    return this.db.getStats();
  }

  /**
   * Trigger manual processing (for testing/debugging)
   */
  async processSingle(): Promise<void> {
    await this.processQueue();
  }

  /**
   * Trigger manual condition check (for testing/debugging)
   */
  async checkConditionsSingle(): Promise<void> {
    await this.checkConditionalActions();
  }
}
