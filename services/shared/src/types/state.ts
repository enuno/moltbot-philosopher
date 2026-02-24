/**
 * State Management Types
 * Types for managing shared state across services
 */

import type { PhilosopherName } from "./agent.js";

/**
 * State file types (JSON state files in workspace)
 */
export type StateFileType =
  | "heartbeat" // heartbeat-state.json
  | "post" // post-state.json
  | "memory" // memory-state.json
  | "codex" // codex-state.json
  | "verification" // verification-state.json
  | "moltstack"; // moltstack-state.json

/**
 * Lane Queue entry (serial execution per agent)
 */
export interface LaneQueueEntry<T = unknown> {
  /** Unique entry ID */
  id: string;

  /** Agent name (defines which lane/queue this belongs to) */
  agent: PhilosopherName;

  /** Task payload */
  payload: T;

  /** Priority (higher = processed first) */
  priority: number;

  /** Created timestamp */
  createdAt: Date;

  /** Attempts count */
  attempts: number;

  /** Max retry attempts */
  maxAttempts: number;

  /** Next retry time (if failed) */
  retryAfter?: Date;
}

/**
 * Lane Queue state (one per agent)
 */
export interface LaneQueueState {
  /** Agent name */
  agent: PhilosopherName;

  /** Queue entries (ordered by priority, then FIFO) */
  entries: LaneQueueEntry[];

  /** Currently processing entry ID */
  processingId: string | null;

  /** Processing started timestamp */
  processingStartedAt: Date | null;

  /** Last processed entry ID */
  lastProcessedId: string | null;

  /** Last processed timestamp */
  lastProcessedAt: Date | null;

  /** Total entries processed */
  totalProcessed: number;

  /** Total entries failed */
  totalFailed: number;
}

/**
 * State manager interface
 */
export interface IStateManager {
  /**
   * Read state file
   */
  read<T = unknown>(agent: PhilosopherName, type: StateFileType): Promise<T>;

  /**
   * Write state file (atomic with temp file + rename)
   */
  write<T = unknown>(agent: PhilosopherName, type: StateFileType, data: T): Promise<void>;

  /**
   * Update state file (read-modify-write with lock)
   */
  update<T = unknown>(
    agent: PhilosopherName,
    type: StateFileType,
    updater: (current: T) => T,
  ): Promise<T>;

  /**
   * Check if state file exists
   */
  exists(agent: PhilosopherName, type: StateFileType): Promise<boolean>;

  /**
   * Delete state file
   */
  delete(agent: PhilosopherName, type: StateFileType): Promise<void>;
}
