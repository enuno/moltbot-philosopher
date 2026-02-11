/**
 * Lane Queue Implementation
 * Serial execution queue per philosopher agent (prevents race conditions)
 */

import type {
  PhilosopherName,
  LaneQueueEntry,
  LaneQueueState,
  BaseEvent,
} from '@moltbot/shared';
import { EventEmitter } from 'events';

/**
 * Lane Queue - one queue per agent for serial execution
 */
export class LaneQueue<T = unknown> extends EventEmitter {
  private state: LaneQueueState;
  private processing = false;

  constructor(private readonly agent: PhilosopherName) {
    super();
    this.state = {
      agent,
      entries: [],
      processingId: null,
      processingStartedAt: null,
      lastProcessedId: null,
      lastProcessedAt: null,
      totalProcessed: 0,
      totalFailed: 0,
    };
  }

  /**
   * Enqueue an event for processing
   */
  enqueue(event: BaseEvent<T>, priority: number = 0, maxAttempts: number = 3): void {
    const entry: LaneQueueEntry<BaseEvent<T>> = {
      id: event.id,
      agent: this.agent,
      payload: event,
      priority,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts,
    };

    this.state.entries.push(entry);
    this.sortQueue();
    this.emit('enqueued', entry);

    // Start processing if not already running
    if (!this.processing) {
      this.processNext();
    }
  }

  /**
   * Sort queue by priority (highest first), then FIFO
   */
  private sortQueue(): void {
    this.state.entries.sort((a, b) => {
      // Priority first (higher = earlier)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then FIFO (earlier = earlier)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Process next entry in queue
   */
  private async processNext(): Promise<void> {
    if (this.processing) return;

    // Check for entries ready to process
    const now = new Date();
    const entry = this.state.entries.find(
      (e) => !e.retryAfter || e.retryAfter <= now
    );

    if (!entry) {
      this.processing = false;
      this.emit('idle');
      return;
    }

    this.processing = true;
    this.state.processingId = entry.id;
    this.state.processingStartedAt = new Date();

    try {
      // Emit event for handler to process
      await this.processEntry(entry as LaneQueueEntry<BaseEvent<T>>);

      // Success - remove from queue
      this.state.entries = this.state.entries.filter((e) => e.id !== entry.id);
      this.state.lastProcessedId = entry.id;
      this.state.lastProcessedAt = new Date();
      this.state.totalProcessed++;

      this.emit('processed', entry);
    } catch (error) {
      entry.attempts++;

      if (entry.attempts >= entry.maxAttempts) {
        // Max attempts reached - remove from queue
        this.state.entries = this.state.entries.filter((e) => e.id !== entry.id);
        this.state.totalFailed++;
        this.emit('failed', entry, error);
      } else {
        // Retry with exponential backoff
        const delayMs = Math.min(1000 * Math.pow(2, entry.attempts), 30000);
        entry.retryAfter = new Date(Date.now() + delayMs);
        this.emit('retry', entry, error, delayMs);
      }
    } finally {
      this.state.processingId = null;
      this.state.processingStartedAt = null;
      this.processing = false;

      // Process next entry
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Process a single entry (emits for handler)
   */
  private async processEntry(entry: LaneQueueEntry<BaseEvent<T>>): Promise<void> {
    return new Promise((resolve, reject) => {
      // Emit for external handler
      this.emit('process', entry.payload, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get current queue state
   */
  getState(): LaneQueueState {
    return { ...this.state, entries: [...this.state.entries] };
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.state.entries.length;
  }

  /**
   * Check if queue is idle
   */
  isIdle(): boolean {
    return !this.processing && this.state.entries.length === 0;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.state.entries = [];
    this.emit('cleared');
  }
}
