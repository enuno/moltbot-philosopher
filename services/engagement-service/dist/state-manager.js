"use strict";
/**
 * StateManager
 * Handles atomic persistence of engagement state to JSON files
 * Includes conflict detection for concurrent writes
 * Uses async file operations for non-blocking I/O
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateManager = void 0;
exports.recordAuthorEngagementInThread = recordAuthorEngagementInThread;
exports.pruneStaleThreadMetrics = pruneStaleThreadMetrics;
exports.enqueueDraft = enqueueDraft;
exports.archiveDraft = archiveDraft;
exports.getProactiveQueue = getProactiveQueue;
const promises_1 = __importDefault(require("fs/promises"));
class StateManager {
    constructor(statePath) {
        this.statePath = statePath;
    }
    /**
     * Load state from disk with automatic daily reset (async)
     */
    async loadState() {
        const raw = await promises_1.default.readFile(this.statePath, "utf-8");
        const state = JSON.parse(raw);
        // Auto-reset daily stats if day changed
        const today = this.getTodayISO();
        if (state.dailyReset !== today) {
            state.dailyStats = {
                date: today,
                postsCreated: 0,
                commentsMade: 0,
                accountsFollowed: 0,
                dmRequestsSent: 0,
                threadsParticipated: 0,
            };
            state.dailyReset = today;
        }
        return state;
    }
    /**
     * Save state with conflict detection and atomic writes
     * If concurrent write detected (lastEngagementCheck changed),
     * merge stats and queue to preserve both changes
     * Uses tmp file + rename for atomicity
     */
    async saveState(state) {
        const current = await this.loadState();
        // Conflict detection: if lastEngagementCheck on disk is newer,
        // another process acted since we loaded. Merge carefully.
        if (current.lastEngagementCheck > state.lastEngagementCheck) {
            // Merge: keep higher daily_stats counts
            state.dailyStats.postsCreated = Math.max(current.dailyStats.postsCreated, state.dailyStats.postsCreated);
            state.dailyStats.commentsMade = Math.max(current.dailyStats.commentsMade, state.dailyStats.commentsMade);
            state.dailyStats.accountsFollowed = Math.max(current.dailyStats.accountsFollowed, state.dailyStats.accountsFollowed);
            state.dailyStats.dmRequestsSent = Math.max(current.dailyStats.dmRequestsSent, state.dailyStats.dmRequestsSent);
            // Merge queues: union of both, deduplicated by postId
            const mergedQueue = [...state.engagementQueue, ...current.engagementQueue];
            const seen = new Set();
            state.engagementQueue = mergedQueue.filter((item) => {
                if (seen.has(item.postId))
                    return false;
                seen.add(item.postId);
                return true;
            });
            // Re-sort merged queue by priority
            state.engagementQueue.sort((a, b) => b.priority - a.priority);
        }
        // Atomic write: write to temp file, then rename
        const tempPath = `${this.statePath}.tmp`;
        await promises_1.default.writeFile(tempPath, JSON.stringify(state, null, 2));
        await promises_1.default.rename(tempPath, this.statePath);
    }
    /**
     * Add opportunity to engagement queue, maintain priority sort
     */
    async enqueueOpportunity(opportunity) {
        const state = await this.loadState();
        state.engagementQueue.push(opportunity);
        // Sort by priority descending
        state.engagementQueue.sort((a, b) => b.priority - a.priority);
        await this.saveState(state);
    }
    /**
     * Record that an action was executed
     * Increments appropriate daily stat counter
     */
    async recordAction(actionType) {
        const state = await this.loadState();
        switch (actionType) {
            case "post":
                state.dailyStats.postsCreated++;
                state.rateLimits.lastPostTimestamp = Date.now();
                break;
            case "comment":
                state.dailyStats.commentsMade++;
                state.rateLimits.lastCommentTimestamp = Date.now();
                break;
            case "follow":
                state.dailyStats.accountsFollowed++;
                state.rateLimits.lastFollowTimestamp = Date.now();
                break;
            case "dm":
                state.dailyStats.dmRequestsSent++;
                state.rateLimits.lastDmTimestamp = Date.now();
                break;
        }
        state.lastEngagementCheck = Date.now();
        await this.saveState(state);
    }
    /**
     * Record that an account was followed
     * Tracks quality, engagement history, and exposure count
     */
    async recordFollow(account) {
        const state = await this.loadState();
        // Check if account already followed
        const existing = state.followedAccounts.findIndex((a) => a.name === account.name);
        if (existing >= 0) {
            // Update existing entry
            state.followedAccounts[existing] = {
                ...state.followedAccounts[existing],
                ...account,
                firstSeen: state.followedAccounts[existing].firstSeen, // Preserve original firstSeen
            };
        }
        else {
            // Add new account
            state.followedAccounts.push(account);
        }
        await this.saveState(state);
    }
    /**
     * Check if we can follow this account
     * Returns canFollow: true only if postsSeenCount >= 3
     */
    async getFollowEvaluationStatus(accountName) {
        const state = await this.loadState();
        const account = state.followedAccounts.find((a) => a.name === accountName);
        if (!account) {
            return { canFollow: false, postsSeenCount: 0 };
        }
        return {
            canFollow: account.postsSeenCount >= 3,
            postsSeenCount: account.postsSeenCount,
        };
    }
    /**
     * Increment posts seen count for an account
     * Used when we see a post from an account we're evaluating for follow
     */
    async incrementPostsSeen(accountName) {
        const state = await this.loadState();
        const account = state.followedAccounts.find((a) => a.name === accountName);
        if (account) {
            account.postsSeenCount++;
            account.lastEngagement = Date.now();
            await this.saveState(state);
        }
        // Silently ignore if account not found (not an error condition)
    }
    /**
     * Get today's date in ISO format (YYYY-MM-DD)
     */
    getTodayISO() {
        return new Date().toISOString().split("T")[0];
    }
}
exports.StateManager = StateManager;
/**
 * Record author engagement metrics for a specific thread (P2.2)
 * Stores per-thread author data with engagement calculations
 */
function recordAuthorEngagementInThread(state, threadId, authorId, commentCount, repliesReceived, authorName) {
    // Initialize thread author metrics map if not present
    if (!state.threadAuthorMetrics) {
        state.threadAuthorMetrics = new Map();
    }
    // Initialize thread-specific author map if not present
    let threadMap = state.threadAuthorMetrics.get(threadId);
    if (!threadMap) {
        threadMap = new Map();
        state.threadAuthorMetrics.set(threadId, threadMap);
    }
    // Store author engagement metrics for this thread
    threadMap.set(authorId, {
        authorId,
        authorName: authorName || authorId,
        commentsByAuthor: commentCount,
        repliesReceivedByAuthor: repliesReceived,
        replyEngagementRate: repliesReceived / Math.max(commentCount, 1),
    });
}
/**
 * Prune stale thread metrics older than maxAgeDays
 * Implements 30-day rolling window for engagement tracking (P2.2)
 * Returns count of threads pruned
 */
function pruneStaleThreadMetrics(state, maxAgeDays = 30) {
    if (!state.threadQualityCache) {
        return 0;
    }
    const cutoff = Date.now() - maxAgeDays * 24 * 3600000;
    let prunedCount = 0;
    // Iterate through all cached threads
    const threadIds = Array.from(state.threadQualityCache.keys());
    for (const threadId of threadIds) {
        const threadMetrics = state.threadQualityCache.get(threadId);
        // Check if thread is older than cutoff
        if (threadMetrics) {
            // Use timestamp from threadMetrics (in milliseconds)
            const threadAge = Date.now() - threadMetrics.timestamp;
            if (threadAge > maxAgeDays * 24 * 3600000) {
                // Remove stale thread
                state.threadQualityCache.delete(threadId);
                // Also remove from threadAuthorMetrics if present
                if (state.threadAuthorMetrics) {
                    state.threadAuthorMetrics.delete(threadId);
                }
                prunedCount++;
            }
        }
    }
    return prunedCount;
}
/**
 * P2.3: Add editorial draft to proactive post queue
 */
async function enqueueDraft(state, draft) {
    // Stub: to be implemented in P2.3
}
/**
 * P2.3: Archive editorial draft after decision
 */
async function archiveDraft(state, draft) {
    // Stub: to be implemented in P2.3
}
/**
 * P2.3: Get proactive post queue
 */
async function getProactiveQueue(state) {
    // Stub: to be implemented in P2.3
    return [];
}
//# sourceMappingURL=state-manager.js.map