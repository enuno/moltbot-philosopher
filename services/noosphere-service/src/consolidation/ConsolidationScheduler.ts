/**
 * Consolidation Scheduler
 * Manages daily memory consolidation cycles
 */

import cron from 'node-cron';
import { EventEmitter } from 'events';
import type { MemoryLayer } from '../memory/MemoryLayer.js';

/**
 * Consolidation configuration
 */
export interface ConsolidationConfig {
  dailySchedule: string; // Cron expression
  autoStart: boolean;
  minEntriesForConsolidation: number;
}

/**
 * Consolidation Scheduler
 */
export class ConsolidationScheduler extends EventEmitter {
  private task: cron.ScheduledTask | null = null;
  private consolidationCount = 0;

  constructor(
    private readonly config: ConsolidationConfig,
    private readonly memoryLayer: MemoryLayer
  ) {
    super();
  }

  /**
   * Start scheduler
   */
  start(): void {
    if (this.task) {
      console.warn('[ConsolidationScheduler] Already running');
      return;
    }

    console.log('[ConsolidationScheduler] Starting daily consolidation');
    console.log(`[ConsolidationScheduler] Schedule: ${this.config.dailySchedule}`);

    // Schedule daily consolidation (default: daily at 2am)
    this.task = cron.schedule(this.config.dailySchedule, () => {
      this.runConsolidation();
    });

    // Run immediately if autoStart
    if (this.config.autoStart) {
      this.runConsolidation();
    }
  }

  /**
   * Stop scheduler
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[ConsolidationScheduler] Stopped');
    }
  }

  /**
   * Run consolidation cycle
   */
  async runConsolidation(): Promise<void> {
    console.log('[ConsolidationScheduler] Starting consolidation cycle');

    try {
      // Get Layer 1 entries
      const layer1Entries = await this.memoryLayer.getLayerEntries(1);

      if (layer1Entries.length < this.config.minEntriesForConsolidation) {
        console.log(`[ConsolidationScheduler] Not enough entries (${layer1Entries.length}/${this.config.minEntriesForConsolidation})`);
        return;
      }

      console.log(`[ConsolidationScheduler] Consolidating ${layer1Entries.length} entries`);

      // Consolidate to Layer 2
      const consolidated = await this.memoryLayer.consolidateToLayer2(layer1Entries);

      this.consolidationCount++;

      console.log(`[ConsolidationScheduler] ✓ Consolidated to ${consolidated.id}`);
      this.emit('consolidated', { consolidated, sourceCount: layer1Entries.length });
    } catch (error) {
      console.error('[ConsolidationScheduler] Consolidation failed:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get consolidation statistics
   */
  getStats() {
    return {
      consolidationsRun: this.consolidationCount,
      isRunning: this.task !== null,
      schedule: this.config.dailySchedule,
    };
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.task !== null;
  }
}
