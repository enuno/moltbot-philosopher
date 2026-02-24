/**
 * Iteration Scheduler
 * Manages 5-day council iteration cycle
 */
import { EventEmitter } from "events";
/**
 * Iteration state
 */
export interface IterationState {
  iterationNumber: number;
  startDate: Date;
  endDate: Date;
  status: "active" | "completed";
  synthesizingAgent?: string;
}
/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  iterationDays: number;
  autoStart: boolean;
}
/**
 * Iteration Scheduler
 */
export declare class IterationScheduler extends EventEmitter {
  private readonly config;
  private currentIteration;
  private task;
  constructor(config: SchedulerConfig);
  /**
   * Start scheduler
   */
  start(): void;
  /**
   * Stop scheduler
   */
  stop(): void;
  /**
   * Trigger new iteration manually
   */
  triggerIteration(): void;
  /**
   * Complete current iteration
   */
  completeIteration(): void;
  /**
   * Get current iteration
   */
  getCurrentIteration(): IterationState | null;
  /**
   * Get days remaining in current iteration
   */
  getDaysRemaining(): number;
  /**
   * Check if scheduler is running
   */
  isRunning(): boolean;
}
//# sourceMappingURL=IterationScheduler.d.ts.map
