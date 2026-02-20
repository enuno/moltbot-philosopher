/**
 * Integration tests for StateManager
 * Tests atomic persistence, daily reset, conflict detection, queue management
 */

import fs from 'fs';
import path from 'path';
import { StateManager } from '../src/state-manager';
import { createDefaultState, tmpStateDir, cleanupTmpDir, MOCK_AGENTS } from './test-utils';
import { EngagementState, FollowedAccount } from '../src/types';

describe('StateManager', () => {
  let tmpDir: string;
  let stateManager: StateManager;
  let statePath: string;

  beforeEach(() => {
    tmpDir = tmpStateDir();
    statePath = path.join(tmpDir, 'engagement-state.json');
    stateManager = new StateManager(statePath);
    
    // Create initial state file
    const initialState = createDefaultState();
    fs.writeFileSync(statePath, JSON.stringify(initialState, null, 2));
  });

  afterEach(() => {
    cleanupTmpDir(tmpDir);
  });

  describe('loadState', () => {
    it('should load valid state from disk', () => {
      const state = stateManager.loadState();
      expect(state).toBeDefined();
      expect(state.dailyStats).toBeDefined();
      expect(state.followedAccounts).toEqual([]);
    });

    it('should auto-reset daily stats when day changed', () => {
      const state = stateManager.loadState();
      state.dailyStats.postsCreated = 5;
      state.dailyReset = '2026-02-19'; // Yesterday
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

      const reloadedState = stateManager.loadState();
      expect(reloadedState.dailyStats.postsCreated).toBe(0);
      expect(reloadedState.dailyStats.commentsMade).toBe(0);
      expect(reloadedState.dailyStats.accountsFollowed).toBe(0);
    });

    it('should preserve daily stats on same day', () => {
      const state = stateManager.loadState();
      state.dailyStats.postsCreated = 3;
      state.dailyStats.commentsMade = 12;
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

      const reloadedState = stateManager.loadState();
      expect(reloadedState.dailyStats.postsCreated).toBe(3);
      expect(reloadedState.dailyStats.commentsMade).toBe(12);
    });
  });

  describe('saveState', () => {
    it('should persist state to disk', () => {
      const state = stateManager.loadState();
      state.dailyStats.postsCreated = 2;
      stateManager.saveState(state);

      const reloaded = stateManager.loadState();
      expect(reloaded.dailyStats.postsCreated).toBe(2);
    });

    it('should handle conflict detection on concurrent writes', () => {
      // Simulate two processes loading state
      const state1 = stateManager.loadState();
      const state2 = stateManager.loadState();

      // Process 1 increments comments
      state1.dailyStats.commentsMade = 5;
      state1.lastEngagementCheck = Date.now();

      // Process 2 increments posts
      state2.dailyStats.postsCreated = 2;
      state2.lastEngagementCheck = Date.now() - 1000; // Older timestamp

      // Save in order: state1 first, then state2
      stateManager.saveState(state1);
      stateManager.saveState(state2);

      // Final state should have merged values
      const final = stateManager.loadState();
      expect(final.dailyStats.commentsMade).toBe(5); // From state1
      expect(final.dailyStats.postsCreated).toBe(2); // From state2
    });

    it('should maintain queue integrity after conflict merge', () => {
      const state1 = stateManager.loadState();
      const state2 = stateManager.loadState();

      // State1: enqueue opportunity A
      state1.engagementQueue.push({
        postId: 'post_a',
        priority: 0.8,
        reason: 'semantic match',
        type: 'comment'
      });
      state1.lastEngagementCheck = Date.now();

      // State2: enqueue opportunity B
      state2.engagementQueue.push({
        postId: 'post_b',
        priority: 0.6,
        reason: 'keyword match',
        type: 'comment'
      });
      state2.lastEngagementCheck = Date.now() - 1000;

      stateManager.saveState(state1);
      stateManager.saveState(state2);

      const final = stateManager.loadState();
      const postIds = final.engagementQueue.map(q => q.postId);
      expect(postIds).toContain('post_a');
      expect(postIds).toContain('post_b');
    });
  });

  describe('enqueueOpportunity', () => {
    it('should add opportunity to queue sorted by priority', () => {
      let state = stateManager.loadState();
      
      stateManager.enqueueOpportunity({
        postId: 'post_1',
        priority: 0.6,
        reason: 'test',
        type: 'comment'
      });

      state = stateManager.loadState();
      expect(state.engagementQueue.length).toBe(1);
      expect(state.engagementQueue[0].priority).toBe(0.6);
    });

    it('should maintain priority sort order', () => {
      stateManager.enqueueOpportunity({
        postId: 'post_1',
        priority: 0.5,
        reason: 'first',
        type: 'comment'
      });

      stateManager.enqueueOpportunity({
        postId: 'post_2',
        priority: 0.9,
        reason: 'second',
        type: 'comment'
      });

      stateManager.enqueueOpportunity({
        postId: 'post_3',
        priority: 0.7,
        reason: 'third',
        type: 'comment'
      });

      const state = stateManager.loadState();
      const priorities = state.engagementQueue.map(q => q.priority);
      expect(priorities).toEqual([0.9, 0.7, 0.5]);
    });
  });

  describe('recordAction', () => {
    it('should increment comment count', () => {
      let state = stateManager.loadState();
      expect(state.dailyStats.commentsMade).toBe(0);

      stateManager.recordAction('comment');

      state = stateManager.loadState();
      expect(state.dailyStats.commentsMade).toBe(1);
    });

    it('should increment post count', () => {
      stateManager.recordAction('post');
      const state = stateManager.loadState();
      expect(state.dailyStats.postsCreated).toBe(1);
    });

    it('should increment follow count', () => {
      stateManager.recordAction('follow');
      const state = stateManager.loadState();
      expect(state.dailyStats.accountsFollowed).toBe(1);
    });

    it('should update last engagement timestamp', () => {
      const before = Date.now();
      stateManager.recordAction('comment');
      const after = Date.now();

      const state = stateManager.loadState();
      expect(state.lastEngagementCheck).toBeGreaterThanOrEqual(before);
      expect(state.lastEngagementCheck).toBeLessThanOrEqual(after);
    });
  });

  describe('recordFollow', () => {
    it('should add followed account with tracking data', () => {
      const account = {
        name: 'TestPhilosopher',
        userId: 'user_123',
        postsSeenCount: 5,
        firstSeen: Date.now(),
        lastEngagement: Date.now(),
        qualityScore: 0.75
      };

      stateManager.recordFollow(account);

      const state = stateManager.loadState();
      expect(state.followedAccounts.length).toBe(1);
      expect(state.followedAccounts[0].name).toBe('TestPhilosopher');
    });

    it('should update lastEngagement on duplicate follow', () => {
      const account = {
        name: 'TestPhilosopher',
        userId: 'user_123',
        postsSeenCount: 5,
        firstSeen: Date.now(),
        lastEngagement: Date.now(),
        qualityScore: 0.75
      };

      stateManager.recordFollow(account);
      
      // Record again with newer timestamp
      const newTime = Date.now() + 10000;
      stateManager.recordFollow({
        ...account,
        lastEngagement: newTime
      });

      const state = stateManager.loadState();
      expect(state.followedAccounts.length).toBe(1); // Still one entry
      expect(state.followedAccounts[0].lastEngagement).toBe(newTime);
    });
  });

  describe('getFollowEvaluationStatus', () => {
    it('should return false if account not followed', () => {
      const status = stateManager.getFollowEvaluationStatus('UnknownAccount');
      expect(status).toEqual({ canFollow: false, postsSeenCount: 0 });
    });

    it('should return false if posts seen < 3', () => {
      const account = {
        name: 'NewAccount',
        postsSeenCount: 2,
        firstSeen: Date.now(),
        lastEngagement: Date.now(),
        qualityScore: 0.7
      };

      stateManager.recordFollow(account);
      const status = stateManager.getFollowEvaluationStatus('NewAccount');
      expect(status.canFollow).toBe(false);
      expect(status.postsSeenCount).toBe(2);
    });

    it('should return true if posts seen >= 3', () => {
      const account = {
        name: 'KnownAccount',
        postsSeenCount: 3,
        firstSeen: Date.now(),
        lastEngagement: Date.now(),
        qualityScore: 0.8
      };

      stateManager.recordFollow(account);
      const status = stateManager.getFollowEvaluationStatus('KnownAccount');
      expect(status.canFollow).toBe(true);
      expect(status.postsSeenCount).toBe(3);
    });
  });

  describe('incrementPostsSeen', () => {
    it('should increase posts seen count for known account', () => {
      const account = {
        name: 'TestAuthor',
        postsSeenCount: 1,
        firstSeen: Date.now(),
        lastEngagement: Date.now(),
        qualityScore: 0.6
      };

      stateManager.recordFollow(account);
      stateManager.incrementPostsSeen('TestAuthor');

      const state = stateManager.loadState();
      expect(state.followedAccounts[0].postsSeenCount).toBe(2);
    });

    it('should handle unknown account gracefully', () => {
      expect(() => {
        stateManager.incrementPostsSeen('UnknownAuthor');
      }).not.toThrow();
    });
  });
});
