/**
 * Lane Queue Implementation
 * Serial execution queue per philosopher agent (prevents race conditions)
 */
import type { PhilosopherName, LaneQueueState, BaseEvent } from "@moltbot/shared";
import { EventEmitter } from "events";
/**
 * Lane Queue - one queue per agent for serial execution
 */
export declare class LaneQueue<T = unknown> extends EventEmitter {
  private readonly agent;
  private state;
  private processing;
  constructor(agent: PhilosopherName);
  /**
   * Enqueue an event for processing
   */
  enqueue(event: BaseEvent<T>, priority?: number, maxAttempts?: number): void;
  /**
   * Sort queue by priority (highest first), then FIFO
   */
  private sortQueue;
  /**
   * Process next entry in queue
   */
  private processNext;
  /**
   * Process a single entry (emits for handler)
   */
  private processEntry;
  /**
   * Get current queue state
   */
  getState(): LaneQueueState;
  /**
   * Get queue size
   */
  size(): number;
  /**
   * Check if queue is idle
   */
  isIdle(): boolean;
  /**
   * Clear all entries
   */
  clear(): void;
}
//# sourceMappingURL=LaneQueue.d.ts.map
