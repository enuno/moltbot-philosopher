/**
 * Iteration Scheduler
 * Manages 5-day council iteration cycle
 */

import cron from 'node-cron';
import { EventEmitter } from 'events';

/**
 * Iteration state
 */
export interface IterationState {
  iterationNumber: number;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed';
  synthesizingAgent?: string;
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  iterationDays: number; // 5 days
  autoStart: boolean;
}

/**
 * Iteration Scheduler
 */
export class IterationScheduler extends EventEmitter {
  private currentIteration: IterationState | null = null;
  private task: cron.ScheduledTask | null = null;

  constructor(private readonly config: SchedulerConfig) {
    super();
  }

  /**
   * Start scheduler
   */
  start(): void {
    if (this.task) {
      console.warn('[IterationScheduler] Already running');
      return;
    }

    console.log('[IterationScheduler] Starting 5-day iteration cycle');

    // Run every 5 days at midnight
    // Cron: "0 0 */5 * *" (every 5 days)
    this.task = cron.schedule('0 0 */5 * *', () => {
      this.triggerIteration();
    });

    // Start initial iteration if configured
    if (this.config.autoStart && !this.currentIteration) {
      this.triggerIteration();
    }
  }

  /**
   * Stop scheduler
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[IterationScheduler] Stopped');
    }
  }

  /**
   * Trigger new iteration manually
   */
  triggerIteration(): void {
    // Complete current iteration if exists
    if (this.currentIteration && this.currentIteration.status === 'active') {
      this.completeIteration();
    }

    // Start new iteration
    const iterationNumber = this.currentIteration
      ? this.currentIteration.iterationNumber + 1
      : 1;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + this.config.iterationDays);

    this.currentIteration = {
      iterationNumber,
      startDate,
      endDate,
      status: 'active',
    };

    console.log(`[IterationScheduler] Started iteration ${iterationNumber}`);
    this.emit('iteration:start', this.currentIteration);
  }

  /**
   * Complete current iteration
   */
  completeIteration(): void {
    if (!this.currentIteration) {
      console.warn('[IterationScheduler] No active iteration to complete');
      return;
    }

    this.currentIteration.status = 'completed';
    console.log(`[IterationScheduler] Completed iteration ${this.currentIteration.iterationNumber}`);
    this.emit('iteration:complete', this.currentIteration);
  }

  /**
   * Get current iteration
   */
  getCurrentIteration(): IterationState | null {
    return this.currentIteration;
  }

  /**
   * Get days remaining in current iteration
   */
  getDaysRemaining(): number {
    if (!this.currentIteration || this.currentIteration.status !== 'active') {
      return 0;
    }

    const now = new Date();
    const msRemaining = this.currentIteration.endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.task !== null;
  }
}
