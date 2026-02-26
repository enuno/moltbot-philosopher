/**
 * StateManager
 * Handles atomic persistence of engagement state to JSON files
 * Includes conflict detection for concurrent writes
 * Uses async file operations for non-blocking I/O
 */
import { EngagementState, QueuedAction, ActionType, FollowedAccount } from "./types";
export declare class StateManager {
    private statePath;
    constructor(statePath: string);
    /**
     * Load state from disk with automatic daily reset (async)
     */
    loadState(): Promise<EngagementState>;
    /**
     * Save state with conflict detection and atomic writes
     * If concurrent write detected (lastEngagementCheck changed),
     * merge stats and queue to preserve both changes
     * Uses tmp file + rename for atomicity
     */
    saveState(state: EngagementState): Promise<void>;
    /**
     * Add opportunity to engagement queue, maintain priority sort
     */
    enqueueOpportunity(opportunity: QueuedAction): Promise<void>;
    /**
     * Record that an action was executed
     * Increments appropriate daily stat counter
     */
    recordAction(actionType: ActionType): Promise<void>;
    /**
     * Record that an account was followed
     * Tracks quality, engagement history, and exposure count
     */
    recordFollow(account: FollowedAccount): Promise<void>;
    /**
     * Check if we can follow this account
     * Returns canFollow: true only if postsSeenCount >= 3
     */
    getFollowEvaluationStatus(accountName: string): Promise<{
        canFollow: boolean;
        postsSeenCount: number;
    }>;
    /**
     * Increment posts seen count for an account
     * Used when we see a post from an account we're evaluating for follow
     */
    incrementPostsSeen(accountName: string): Promise<void>;
    /**
     * Get today's date in ISO format (YYYY-MM-DD)
     */
    private getTodayISO;
}
/**
 * Record author engagement metrics for a specific thread (P2.2)
 * Stores per-thread author data with engagement calculations
 */
export declare function recordAuthorEngagementInThread(state: EngagementState, threadId: string, authorId: string, commentCount: number, repliesReceived: number, authorName?: string): void;
/**
 * Prune stale thread metrics older than maxAgeDays
 * Implements 30-day rolling window for engagement tracking (P2.2)
 * Returns count of threads pruned
 */
export declare function pruneStaleThreadMetrics(state: EngagementState, maxAgeDays?: number): number;
/**
 * P2.3: Add editorial draft to proactive post queue
 */
export declare function enqueueDraft(state: EngagementState, draft: any): Promise<void>;
/**
 * P2.3: Archive editorial draft after decision
 */
export declare function archiveDraft(state: EngagementState, draft: any): Promise<void>;
/**
 * P2.3: Get proactive post queue
 */
export declare function getProactiveQueue(state: EngagementState): Promise<any[]>;
//# sourceMappingURL=state-manager.d.ts.map