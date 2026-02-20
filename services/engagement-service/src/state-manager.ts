/**
 * StateManager
 * Handles atomic persistence of engagement state to JSON files
 * Includes conflict detection for concurrent writes
 * Uses async file operations for non-blocking I/O
 */

import fs from 'fs/promises';
import { EngagementState, QueuedAction, ActionType, FollowedAccount } from './types';

export class StateManager {
  private statePath: string;

  constructor(statePath: string) {
    this.statePath = statePath;
  }

  /**
   * Load state from disk with automatic daily reset (async)
   */
  async loadState(): Promise<EngagementState> {
    const raw = await fs.readFile(this.statePath, 'utf-8');
    const state = JSON.parse(raw) as EngagementState;

    // Auto-reset daily stats if day changed
    const today = this.getTodayISO();
    if (state.dailyReset !== today) {
      state.dailyStats = {
        date: today,
        postsCreated: 0,
        commentsMade: 0,
        accountsFollowed: 0,
        dmRequestsSent: 0,
        threadsParticipated: 0
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
  async saveState(state: EngagementState): Promise<void> {
    const current = await this.loadState();

    // Conflict detection: if lastEngagementCheck on disk is newer,
    // another process acted since we loaded. Merge carefully.
    if (current.lastEngagementCheck > state.lastEngagementCheck) {
      // Merge: keep higher daily_stats counts
      state.dailyStats.postsCreated = Math.max(
        current.dailyStats.postsCreated,
        state.dailyStats.postsCreated
      );
      state.dailyStats.commentsMade = Math.max(
        current.dailyStats.commentsMade,
        state.dailyStats.commentsMade
      );
      state.dailyStats.accountsFollowed = Math.max(
        current.dailyStats.accountsFollowed,
        state.dailyStats.accountsFollowed
      );
      state.dailyStats.dmRequestsSent = Math.max(
        current.dailyStats.dmRequestsSent,
        state.dailyStats.dmRequestsSent
      );

      // Merge queues: union of both, deduplicated by postId
      const mergedQueue = [...state.engagementQueue, ...current.engagementQueue];
      const seen = new Set<string>();
      state.engagementQueue = mergedQueue.filter(item => {
        if (seen.has(item.postId)) return false;
        seen.add(item.postId);
        return true;
      });

      // Re-sort merged queue by priority
      state.engagementQueue.sort((a, b) => b.priority - a.priority);
    }

    // Atomic write: write to temp file, then rename
    const tempPath = `${this.statePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2));
    await fs.rename(tempPath, this.statePath);
  }

  /**
   * Add opportunity to engagement queue, maintain priority sort
   */
  async enqueueOpportunity(opportunity: QueuedAction): Promise<void> {
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
  async recordAction(actionType: ActionType): Promise<void> {
    const state = await this.loadState();

    switch (actionType) {
      case 'post':
        state.dailyStats.postsCreated++;
        state.rateLimits.lastPostTimestamp = Date.now();
        break;
      case 'comment':
        state.dailyStats.commentsMade++;
        state.rateLimits.lastCommentTimestamp = Date.now();
        break;
      case 'follow':
        state.dailyStats.accountsFollowed++;
        state.rateLimits.lastFollowTimestamp = Date.now();
        break;
      case 'dm':
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
  async recordFollow(account: FollowedAccount): Promise<void> {
    const state = await this.loadState();

    // Check if account already followed
    const existing = state.followedAccounts.findIndex(a => a.name === account.name);

    if (existing >= 0) {
      // Update existing entry
      state.followedAccounts[existing] = {
        ...state.followedAccounts[existing],
        ...account,
        firstSeen: state.followedAccounts[existing].firstSeen // Preserve original firstSeen
      };
    } else {
      // Add new account
      state.followedAccounts.push(account);
    }

    await this.saveState(state);
  }

  /**
   * Check if we can follow this account
   * Returns canFollow: true only if postsSeenCount >= 3
   */
  async getFollowEvaluationStatus(accountName: string): Promise<{
    canFollow: boolean;
    postsSeenCount: number;
  }> {
    const state = await this.loadState();
    const account = state.followedAccounts.find(a => a.name === accountName);

    if (!account) {
      return { canFollow: false, postsSeenCount: 0 };
    }

    return {
      canFollow: account.postsSeenCount >= 3,
      postsSeenCount: account.postsSeenCount
    };
  }

  /**
   * Increment posts seen count for an account
   * Used when we see a post from an account we're evaluating for follow
   */
  async incrementPostsSeen(accountName: string): Promise<void> {
    const state = await this.loadState();
    const account = state.followedAccounts.find(a => a.name === accountName);

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
  private getTodayISO(): string {
    return new Date().toISOString().split('T')[0];
  }
}
