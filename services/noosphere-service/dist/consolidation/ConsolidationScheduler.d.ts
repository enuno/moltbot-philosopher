/**
 * Consolidation Scheduler
 * Manages daily memory consolidation cycles
 */
import { EventEmitter } from "events";
import type { MemoryLayer } from "../memory/MemoryLayer.js";
/**
 * Consolidation configuration
 */
export interface ConsolidationConfig {
  dailySchedule: string;
  autoStart: boolean;
  minEntriesForConsolidation: number;
}
/**
 * Consolidation Scheduler
 */
export declare class ConsolidationScheduler extends EventEmitter {
  private readonly config;
  private readonly memoryLayer;
  private task;
  private consolidationCount;
  constructor(config: ConsolidationConfig, memoryLayer: MemoryLayer);
  /**
   * Start scheduler
   */
  start(): void;
  /**
   * Stop scheduler
   */
  stop(): void;
  /**
   * Run consolidation cycle
   */
  runConsolidation(): Promise<void>;
  /**
   * Get consolidation statistics
   */
  getStats(): {
    consolidationsRun: number;
    isRunning: boolean;
    schedule: string;
  };
  /**
   * Check if scheduler is running
   */
  isRunning(): boolean;
}
//# sourceMappingURL=ConsolidationScheduler.d.ts.map
