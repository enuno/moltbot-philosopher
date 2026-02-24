import { DatabaseManager } from "./database";
import { ActionExecutor } from "./action-executor";
import { RateLimiter } from "./rate-limiter";
import { Priority, ActionStatus, QueuedAction, ConditionalAction } from "./types";
import PgBoss from "pg-boss";

/**
 * Queue Processor
 *
 * Listens to pg-boss queues and processes actions with:
 * - Rate limiting per agent
 * - Circuit breaker pattern for cascading failure prevention
 * - Exponential backoff retry logic
 * - Selective retry based on error type
 */
export class QueueProcessor {
  private db: DatabaseManager;
  private executor: ActionExecutor;
  private rateLimiter: RateLimiter;
  private pgBoss: PgBoss | null = null;
  private running = false;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.executor = new ActionExecutor();
    this.rateLimiter = new RateLimiter(db);
  }

  /**
   * Start listening to pg-boss queues
   */
  async start(): Promise<void> {
    if (this.running) return;

    this.pgBoss = this.db.getPgBoss();

    try {
      // Create the queue if it doesn't exist
      await (this.pgBoss as any).createQueue("action:process").catch(() => {
        // Queue might already exist, that's fine
      });

      // Register job handler for main action processing queue
      await this.pgBoss!.work<any>("action:process", async (jobs) => {
        console.log(`⚡ Processing ${jobs.length} job(s)...`);
        for (const job of jobs) {
          await this.executeAction(job);
        }
      });

      this.running = true;
      console.log("✅ QueueProcessor started - listening to pg-boss queues");
    } catch (error) {
      console.error("❌ Failed to start QueueProcessor:", error);
      throw error;
    }
  }

  /**
   * Stop listening to queues
   */
  async stop(): Promise<void> {
    if (!this.pgBoss) return;
    await this.pgBoss.offWork("action:process");
    this.running = false;
    console.log("⛔ QueueProcessor stopped");
  }

  /**
   * Execute a single action with rate limiting, conditional evaluation, and circuit breaker
   */
  private async executeAction(job: any): Promise<void> {
    const action = job.data as unknown as QueuedAction;
    const conditionalAction = action as ConditionalAction;
    const jobId = job.id;
    console.log(`⚡ Executing action: ${jobId} (${action.actionType} by ${action.agentName})`);

    try {
      // Check conditional execution if conditions are defined
      if (conditionalAction.conditions) {
        const shouldExecute = await this.checkConditions(conditionalAction);
        if (!shouldExecute) {
          console.log(`⏳ Conditions not met for action: ${jobId}`);
          await this.db.updateActionStatus(jobId, ActionStatus.SCHEDULED);
          throw new Error("Conditions not met - will retry");
        }
      }

      // Check rate limits
      const canExecute = await this.rateLimiter.canExecute(action.agentName, action.actionType);
      if (!canExecute) {
        console.log(`⏸️  Rate limited: ${action.agentName}`);
        await this.db.updateActionStatus(jobId, ActionStatus.RATE_LIMITED);
        throw new Error("Rate limited - will retry");
      }

      // Check circuit breaker
      await this.checkCircuitBreaker(action.agentName);

      // Execute the action
      await this.executor.execute(action);

      // Update rate limits on success
      await this.rateLimiter.updateLastExecution(action.agentName, action.actionType);

      // Log success
      await this.db.updateActionStatus(jobId, ActionStatus.COMPLETED);
      console.log(`✅ Action completed: ${jobId}`);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Action failed: ${jobId} - ${errorMsg}`);

      // Get attempt count from job metadata
      const attempts = job.attempt || 0;

      // Determine if retryable
      if (this.isRetryable(error) && attempts < 3) {
        console.log(`🔄 Retrying (attempt ${attempts + 1}/3): ${jobId}`);
        await this.db.updateActionStatus(jobId, ActionStatus.PENDING, errorMsg);
        throw error; // pg-boss will retry based on exponential backoff
      } else {
        await this.db.updateActionStatus(jobId, ActionStatus.FAILED, errorMsg);

        // Alert if critical
        if ((action as any).priority === Priority.CRITICAL) {
          console.error(`🚨 CRITICAL action failed and not retrying: ${jobId}`);
          // In production, send alert to monitoring system
        }
      }
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryable(error: any): boolean {
    const retryableErrors = [
      "ECONNREFUSED",
      "RATE_LIMIT_EXCEEDED",
      "TIMEOUT",
      "TEMPORARY_ERROR",
      "ENOTFOUND",
      "ECONNRESET",
    ];

    const errorMsg = error instanceof Error ? error.message : String(error);
    return retryableErrors.some((e) => errorMsg.includes(e));
  }

  /**
   * Circuit breaker: check failure rate in past hour
   * If >50% failure rate and >10 actions, prevent further execution
   */
  private async checkCircuitBreaker(agentName: string): Promise<void> {
    try {
      // Use targeted getAgentMetrics instead of expensive getStats
      const metrics = await this.db.getAgentMetrics(agentName);

      const totalCount = metrics.total_actions;
      const failedCount = metrics.failed;

      if (totalCount > 10 && failedCount / totalCount > 0.5) {
        throw new Error(`Circuit breaker open: ${agentName} has >50% failure rate`);
      }
    } catch (error) {
      if ((error as any)?.message?.includes("Circuit breaker")) {
        throw error;
      }
      // Silently continue if we can't check circuit breaker (DB error, etc)
      console.warn("Warning: Could not check circuit breaker:", error);
    }
  }

  /**
   * Evaluate conditions for conditional action execution
   * Returns true if all conditions are satisfied or timeout is reached
   */
  private async checkConditions(action: ConditionalAction): Promise<boolean> {
    if (!action.conditions) {
      return true; // No conditions means execute immediately
    }

    // Check if timeout has been reached
    if (action.conditionTimeout && new Date() > action.conditionTimeout) {
      console.log(`⏳ Condition timeout reached for action ${action.id}, executing anyway`);
      return true;
    }

    // Check if it's time to evaluate conditions based on interval
    const now = new Date();
    const lastCheck = action.lastConditionCheck;
    const checkInterval = (action.conditionCheckInterval || 60) * 1000; // default 60 seconds

    if (lastCheck && now.getTime() - lastCheck.getTime() < checkInterval) {
      // Not yet time to check conditions, keep waiting
      console.log(
        `⏳ Conditions will be checked again at ${new Date(lastCheck.getTime() + checkInterval)}`,
      );
      return false;
    }

    // Evaluate conditions (placeholder - actual evaluation would happen here)
    // For now, return false to indicate conditions not yet met
    // Real implementation would evaluate the composite condition tree
    console.log(`📋 Evaluating ${action.id} conditions`);
    return false;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    return this.db.getStats();
  }
}
