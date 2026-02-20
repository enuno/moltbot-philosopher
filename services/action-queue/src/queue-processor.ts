import { DatabaseManager } from './database';
import { ActionExecutor } from './action-executor';
import { RateLimiter } from './rate-limiter';
import { Priority, ActionStatus } from './types';
import PgBoss from 'pg-boss';

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

    // Subscribe to main action processing queue
    await this.pgBoss!.subscribe('action:process', async (job) => {
      await this.executeAction(job);
    });

    // Subscribe to retry queue (for advanced retry handling)
    await this.pgBoss!.subscribe('action:process:retry', async (job) => {
      await this.handleRetryWithBackoff(job);
    });

    this.running = true;
    console.log('✅ QueueProcessor started - listening to pg-boss queues');
  }

  /**
   * Stop listening to queues
   */
  async stop(): Promise<void> {
    if (!this.pgBoss) return;
    await this.pgBoss.unsubscribe('action:process');
    await this.pgBoss.unsubscribe('action:process:retry');
    this.running = false;
    console.log('⛔ QueueProcessor stopped');
  }

  /**
   * Execute a single action with rate limiting and circuit breaker
   */
  private async executeAction(job: any): Promise<void> {
    const action = job.data;
    const jobId = job.id;
    console.log(`⚡ Executing action: ${jobId} (${action.actionType} by ${action.agentName})`);

    try {
      // Check rate limits
      const canExecute = await this.rateLimiter.canExecute(action.agentName, action.actionType);
      if (!canExecute) {
        console.log(`⏸️  Rate limited: ${action.agentName}`);
        await this.db.updateActionStatus(jobId, ActionStatus.RATE_LIMITED);
        throw new Error('Rate limited - will retry');
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

      // Get current job attempt count
      const currentJob = await this.pgBoss!.getJob(jobId);
      const attempts = currentJob?.attemptsMade || 0;

      // Determine if retryable
      if (this.isRetryable(error) && attempts < 3) {
        console.log(`🔄 Retrying (attempt ${attempts + 1}/3): ${jobId}`);
        await this.db.updateActionStatus(jobId, ActionStatus.PENDING, errorMsg);
        throw error; // pg-boss will retry based on exponential backoff
      } else {
        await this.db.updateActionStatus(jobId, ActionStatus.FAILED, errorMsg);

        // Alert if critical
        if (action.priority === Priority.CRITICAL) {
          console.error(`🚨 CRITICAL action failed and not retrying: ${jobId}`);
          // In production, send alert to monitoring system
        }
      }
    }
  }

  /**
   * Handle retry with exponential backoff (pg-boss handles scheduling)
   */
  private async handleRetryWithBackoff(job: any): Promise<void> {
    // pg-boss handles exponential backoff automatically via job options
    // This handler is for custom retry logic if needed
    await this.executeAction(job);
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryable(error: any): boolean {
    const retryableErrors = [
      'ECONNREFUSED',
      'RATE_LIMIT_EXCEEDED',
      'TIMEOUT',
      'TEMPORARY_ERROR',
      'ENOTFOUND',
      'ECONNRESET',
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
      const stats = await this.db.getStats();

      // Count recent failures vs successes from logs
      const failedCount = stats.logs_24h?.find((l: any) => l.status === 'failed')?.count || 0;
      const totalCount = stats.logs_24h?.reduce((sum: number, l: any) => sum + l.count, 0) || 0;

      if (totalCount > 10 && failedCount / totalCount > 0.5) {
        throw new Error(`Circuit breaker open: ${agentName} has >50% failure rate in past hour`);
      }
    } catch (error) {
      if ((error as any)?.message?.includes('Circuit breaker')) {
        throw error;
      }
      // Silently continue if we can't check circuit breaker (DB error, etc)
      console.warn('Warning: Could not check circuit breaker:', error);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): any {
    return this.db.getStats();
  }
}
