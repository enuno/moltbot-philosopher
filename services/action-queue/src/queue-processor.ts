import { DatabaseManager } from "./database";
import { ActionExecutor } from "./action-executor";
import { RateLimiter } from "./rate-limiter";
import { CircuitBreaker } from "./circuit-breaker";
import { Priority, ActionStatus, QueuedAction, ConditionalAction, WorkerState } from "./types";
import { sendCircuitAlert } from "./alerting";
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
  private circuitBreaker: CircuitBreaker;
  private pgBoss: PgBoss | null = null;
  private running = false;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.executor = new ActionExecutor();
    this.rateLimiter = new RateLimiter(db);

    // Initialize circuit breaker with NTFY alerting callback
    this.circuitBreaker = new CircuitBreaker({
      maxConsecutiveFailures: parseInt(process.env.CIRCUIT_BREAKER_MAX_FAILURES || "3", 10),
      probeIntervalMs: parseInt(process.env.CIRCUIT_BREAKER_PROBE_INTERVAL_MS || "3600000", 10),
      onCircuitOpen: (agentName: string, state: WorkerState) => {
        // Fire NTFY alert when circuit opens
        sendCircuitAlert(agentName, state.consecutive_failures).catch((error) => {
          console.error("Failed to send circuit breaker alert:", error);
        });
      },
    });
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

      // Register job handler for main action processing queue (non-blocking listener)
      this.pgBoss!.work(
        "action:process",
        async (jobs: any[]) => {
          console.log(`⚡ Processing ${jobs.length} job(s)...`);
          for (const job of jobs) {
            await this.executeAction(job);
          }
        }
      ).catch((error) => {
        console.error("❌ Job handler error:", error);
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

      // Check comment velocity (prevent bursty comment spam)
      if (action.actionType === "comment") {
        await this.checkCommentVelocity(action, jobId);
      }

      // Check circuit breaker - must happen BEFORE execution
      if (!this.circuitBreaker.canProcess(action.agentName)) {
        console.log(`🔴 Circuit breaker OPEN for ${action.agentName}, blocking action`);
        await this.db.updateActionStatus(jobId, ActionStatus.RATE_LIMITED);
        throw new Error(
          `Circuit breaker open: ${action.agentName} has exceeded failure threshold`,
        );
      }

      // Check for auto-recovery (transition OPEN→HALF_OPEN if timeout passed)
      this.circuitBreaker.checkAutoRecovery(action.agentName);

      // Execute the action
      const result = await this.executor.execute(action);

      // Check if execution was successful
      if (!result.success) {
        // Record failure with database persistence
        await this.circuitBreaker.recordFailure(this.db, action.agentName);
        throw new Error(`Action execution failed: ${result.error}`);
      }

      // Update rate limits on success
      await this.rateLimiter.updateLastExecution(action.agentName, action.actionType);

      // Record success with circuit breaker
      await this.circuitBreaker.recordSuccess(this.db, action.agentName);

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
      "comment velocity exceeded", // Velocity violations retry with backoff
      "Rate limited", // Rate limit violations also retry
      "Conditions not met", // Conditional actions retry if conditions unmet
      "Circuit breaker open", // Circuit breaker violations retry with backoff
    ];

    const errorMsg = error instanceof Error ? error.message : String(error);
    return retryableErrors.some((e) => errorMsg.includes(e));
  }

  /**
   * Comment velocity check: prevent bursty comment spam
   * Enforces both per-thread and agent-wide limits
   */
  private async checkCommentVelocity(action: QueuedAction, jobId: string): Promise<void> {
    const metadata = (action as any).metadata || {};
    const threadId = metadata.threadId;

    try {
      // Get recent comment counts for both checks
      const recentCommentWindow = 60; // seconds
      const agentWideCount = await this.db.getRecentCommentCount(
        action.agentName,
        undefined,
        recentCommentWindow,
      );
      const perThreadCount = threadId
        ? await this.db.getRecentCommentCount(action.agentName, threadId, recentCommentWindow)
        : 0;

      // Validate thresholds (conservative by design — philosopher deepens, doesn't monologue)
      const PER_THREAD_MAX = 3; // Max comments on same thread in 60s
      const AGENT_WIDE_MAX = 8; // Max total comments by agent in 60s

      console.log(`📊 Comment velocity check for ${action.agentName}:`, {
        threadId: threadId || "unknown",
        perThreadCount: `${perThreadCount}/${PER_THREAD_MAX}`,
        agentWideCount: `${agentWideCount}/${AGENT_WIDE_MAX}`,
      });

      // Per-thread spam prevention (philosopher deepens a point, doesn't monologue)
      if (threadId && perThreadCount >= PER_THREAD_MAX) {
        console.warn(
          `🐌 Comment velocity exceeded (thread): ${action.agentName} on ${threadId} ` +
            `— ${perThreadCount}/${PER_THREAD_MAX} in 60s`,
        );
        throw new Error(
          `comment velocity exceeded: per-thread limit (${perThreadCount}/${PER_THREAD_MAX})`,
        );
      }

      // Agent-wide spam prevention (present but not omnipresent)
      if (agentWideCount >= AGENT_WIDE_MAX) {
        console.warn(
          `🐌 Comment velocity exceeded (agent-wide): ${action.agentName} ` +
            `— ${agentWideCount}/${AGENT_WIDE_MAX} in 60s`,
        );
        throw new Error(
          `comment velocity exceeded: agent-wide limit (${agentWideCount}/${AGENT_WIDE_MAX})`,
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("comment velocity exceeded")
      ) {
        console.log(`⚠️  Comment spam detected for ${action.agentName}: ${error.message}`);
        await this.db.updateActionStatus(jobId, ActionStatus.RATE_LIMITED);
        throw new Error("Comment velocity exceeded - will retry");
      }
      throw error;
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
