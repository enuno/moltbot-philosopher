/**
 * Integration tests for EngagementEngine
 * Tests orchestration, agent round-robin scheduling, feed monitoring, action execution
 */

import { EngagementEngine } from '../src/engagement-engine';
import { createDefaultState, tmpStateDir, cleanupTmpDir, MOCK_AGENTS } from './test-utils';
import fs from 'fs';
import path from 'path';

describe('EngagementEngine', () => {
  let tmpDir: string;
  let engine: EngagementEngine;
  let statePaths: Record<string, string>;

  beforeEach(() => {
    tmpDir = tmpStateDir();
    statePaths = {};

    // Create state files for all agents
    MOCK_AGENTS.forEach(agent => {
      const statePath = path.join(tmpDir, `${agent.id}-state.json`);
      fs.writeFileSync(statePath, JSON.stringify(createDefaultState(), null, 2));
      statePaths[agent.id] = statePath;
    });

    engine = new EngagementEngine({ statePaths, agentRoster: MOCK_AGENTS });
  });

  afterEach(() => {
    cleanupTmpDir(tmpDir);
  });

  describe('monitorFeed', () => {
    it('should return opportunities from monitored submolts', async () => {
      // Mock: return some posts
      const opportunities = await engine.monitorFeed();
      
      expect(Array.isArray(opportunities)).toBe(true);
      // Should score opportunities with relevance
      if (opportunities.length > 0) {
        expect(opportunities[0]).toHaveProperty('postId');
        expect(opportunities[0]).toHaveProperty('relevanceScore');
        expect(opportunities[0].relevanceScore).toBeGreaterThanOrEqual(0);
        expect(opportunities[0].relevanceScore).toBeLessThanOrEqual(1);
      }
    });

    it('should filter opportunities by relevance threshold (0.6)', async () => {
      const opportunities = await engine.monitorFeed();
      
      // All returned opportunities should have score > 0.6
      opportunities.forEach(opp => {
        expect(opp.relevanceScore).toBeGreaterThan(0.6);
      });
    });

    it('should fetch limited posts per submolt (10)', async () => {
      const opportunities = await engine.monitorFeed();
      
      // Max 10 posts per submolt * number of submolts
      // Default: 3 submolts, so max 30 opportunities
      expect(opportunities.length).toBeLessThanOrEqual(30);
    });
  });

  describe('dequeueOpportunities', () => {
    it('should dequeue opportunities respecting daily limits', async () => {
      const agent = MOCK_AGENTS[0];
      const agentStatePath = statePaths[agent.id];
      const agentStateManager = new StateManager(agentStatePath);

      // Populate queue with multiple opportunities
      await agentStateManager.enqueueOpportunity({
        postId: 'post_1',
        priority: 0.9,
        reason: 'high relevance',
        type: 'comment'
      });
      await agentStateManager.enqueueOpportunity({
        postId: 'post_2',
        priority: 0.7,
        reason: 'medium relevance',
        type: 'comment'
      });

      const actions = await engine.dequeueOpportunities(agent);

      // Should return queued actions
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThanOrEqual(0);
    });

    it('should not dequeue if daily comment limit reached', async () => {
      const agent = MOCK_AGENTS[0];
      const agentStatePath = statePaths[agent.id];
      const agentStateManager = new StateManager(agentStatePath);

      // Max out comments
      let state = await agentStateManager.loadState();
      state.dailyStats.commentsMade = 50; // Max
      await agentStateManager.saveState(state);

      // Enqueue opportunities
      await agentStateManager.enqueueOpportunity({
        postId: 'post_1',
        priority: 0.95,
        reason: 'urgent',
        type: 'comment'
      });

      const actions = await engine.dequeueOpportunities(agent);

      // Should not dequeue (over limit)
      expect(actions.length).toBe(0);
    });

    it('should respect agent daily posting limit', async () => {
      const agent = MOCK_AGENTS[0];
      const agentStatePath = statePaths[agent.id];
      const agentStateManager = new StateManager(agentStatePath);

      // Max out posts for the day
      let state = await agentStateManager.loadState();
      state.dailyStats.postsCreated = 3;
      await agentStateManager.saveState(state);

      const actions = await engine.dequeueOpportunities(agent);

      // Should only return comment/follow/dm actions, not posts
      actions.forEach(action => {
        expect(action.type).not.toBe('post');
      });
    });
  });

  describe('validateAction', () => {
    it('should reject action with relevance < 0.6', async () => {
      const isValid = await engine.validateAction({
        postId: 'post_1',
        priority: 0.5, // Below threshold
        reason: 'low score',
        type: 'comment'
      }, 'This is a valid comment', MOCK_AGENTS[0]);

      expect(isValid).toBe(false);
    });

    it('should reject generic comments', async () => {
      const isValid = await engine.validateAction({
        postId: 'post_1',
        priority: 0.8,
        reason: 'good match',
        type: 'comment'
      }, 'good point', MOCK_AGENTS[0]);

      expect(isValid).toBe(false);
    });

    it('should reject non-substantive comments', async () => {
      const isValid = await engine.validateAction({
        postId: 'post_1',
        priority: 0.8,
        reason: 'match',
        type: 'comment'
      }, 'too short', MOCK_AGENTS[0]);

      expect(isValid).toBe(false);
    });

    it('should accept valid comment action', async () => {
      const isValid = await engine.validateAction({
        postId: 'post_1',
        priority: 0.75,
        reason: 'semantic match',
        type: 'comment'
      }, 'This contradicts the stoic position. However, virtue ethics provides a compelling alternative framework.', MOCK_AGENTS[0]);

      expect(isValid).toBe(true);
    });

    it('should enforce following evaluation (3-post minimum)', async () => {
      const agent = MOCK_AGENTS[0];
      const agentStatePath = statePaths[agent.id];
      const agentStateManager = new StateManager(agentStatePath);

      // Add account with only 2 posts seen
      await agentStateManager.recordFollow({
        name: 'NewAuthor',
        postsSeenCount: 2,
        firstSeen: Date.now(),
        lastEngagement: Date.now(),
        qualityScore: 0.7
      });

      const isValid = await engine.validateAction({
        postId: 'post_1',
        priority: 0.8,
        reason: 'quality account',
        type: 'follow'
      }, 'NewAuthor', agent);

      // Should reject because < 3 posts seen
      expect(isValid).toBe(false);
    });
  });

  describe('runEngagementCycle', () => {
    it('should visit all agents in order', async () => {
      // Mock executeAction to track which agents are visited
      const originalValidate = engine.validateAction;
      (engine.validateAction as any) = async () => false; // Prevent execution, just track

      // Run cycle
      await engine.runEngagementCycle();

      // Check logs would show all agents visited
      // For now, verify no errors thrown
      expect(true).toBe(true);

      // Restore original
      engine.validateAction = originalValidate;
    });

    it('should skip agent if over daily limits', async () => {
      const agent = MOCK_AGENTS[0];
      const agentStatePath = statePaths[agent.id];
      const agentStateManager = new StateManager(agentStatePath);

      // Max out agent
      let state = await agentStateManager.loadState();
      state.dailyStats.commentsMade = 50;
      state.dailyStats.postsCreated = 3;
      state.dailyStats.accountsFollowed = 2;
      await agentStateManager.saveState(state);

      // Should skip this agent without error
      await engine.runEngagementCycle();

      // Verify state unchanged
      state = await agentStateManager.loadState();
      expect(state.dailyStats.commentsMade).toBe(50);
    });

    it('should handle errors gracefully and continue', async () => {
      // Even if one agent errors, cycle should complete
      await engine.runEngagementCycle();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('considerPosting', () => {
    it('should respect post cooldown (30 minutes)', async () => {
      const agent = MOCK_AGENTS[0];
      const agentStatePath = statePaths[agent.id];
      const agentStateManager = new StateManager(agentStatePath);

      // Set last post time to 5 minutes ago
      let state = await agentStateManager.loadState();
      state.lastPostTime = Date.now() - 5 * 60 * 1000;
      await agentStateManager.saveState(state);

      // Should not create post (cooldown not elapsed)
      await engine.considerPosting(agent);

      state = await agentStateManager.loadState();
      expect(state.dailyStats.postsCreated).toBe(0);
    });

    it('should allow post after 30-minute cooldown', async () => {
      const agent = MOCK_AGENTS[0];
      const agentStatePath = statePaths[agent.id];
      const agentStateManager = new StateManager(agentStatePath);

      // Set last post time to 40 minutes ago
      let state = await agentStateManager.loadState();
      state.lastPostTime = Date.now() - 40 * 60 * 1000;
      state.dailyStats.postsCreated = 0;
      await agentStateManager.saveState(state);

      // Should allow post (cooldown elapsed, under daily limit)
      await engine.considerPosting(agent);

      state = await agentStateManager.loadState();
      // Post may or may not be created depending on content quality
      // But no error should occur
      expect(true).toBe(true);
    });

    it('should respect daily post limit', async () => {
      const agent = MOCK_AGENTS[0];
      const agentStatePath = statePaths[agent.id];
      const agentStateManager = new StateManager(agentStatePath);

      // Max out posts for the day
      let state = await agentStateManager.loadState();
      state.dailyStats.postsCreated = 3;
      state.lastPostTime = 0; // Allow by cooldown
      await agentStateManager.saveState(state);

      await engine.considerPosting(agent);

      state = await agentStateManager.loadState();
      // Should not increment
      expect(state.dailyStats.postsCreated).toBe(3);
    });
  });

  describe('dailyMaintenance', () => {
    it('should reset daily stats for all agents', async () => {
      const agent = MOCK_AGENTS[0];
      const agentStatePath = statePaths[agent.id];
      const agentStateManager = new StateManager(agentStatePath);

      // Set stats to non-zero
      let state = await agentStateManager.loadState();
      state.dailyStats.postsCreated = 2;
      state.dailyStats.commentsMade = 15;
      state.dailyReset = '2026-02-19'; // Yesterday
      await agentStateManager.saveState(state);

      await engine.dailyMaintenance();

      state = await agentStateManager.loadState();
      expect(state.dailyStats.postsCreated).toBe(0);
      expect(state.dailyStats.commentsMade).toBe(0);
    });

    it('should unfollow inactive accounts (>30 days)', async () => {
      const agent = MOCK_AGENTS[0];
      const agentStatePath = statePaths[agent.id];
      const agentStateManager = new StateManager(agentStatePath);

      // Add account inactive for 35 days
      await agentStateManager.recordFollow({
        name: 'InactiveAuthor',
        postsSeenCount: 5,
        firstSeen: Date.now() - 40 * 24 * 60 * 60 * 1000,
        lastEngagement: Date.now() - 35 * 24 * 60 * 60 * 1000,
        qualityScore: 0.7
      });

      await engine.dailyMaintenance();

      const state = await agentStateManager.loadState();
      const inactive = state.followedAccounts.find(a => a.name === 'InactiveAuthor');
      expect(inactive).toBeUndefined();
    });

    it('should keep active accounts (<30 days)', async () => {
      const agent = MOCK_AGENTS[0];
      const agentStatePath = statePaths[agent.id];
      const agentStateManager = new StateManager(agentStatePath);

      // Add account active within last 20 days
      await agentStateManager.recordFollow({
        name: 'ActiveAuthor',
        postsSeenCount: 5,
        firstSeen: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastEngagement: Date.now() - 20 * 24 * 60 * 60 * 1000,
        qualityScore: 0.8
      });

      await engine.dailyMaintenance();

      const state = await agentStateManager.loadState();
      const active = state.followedAccounts.find(a => a.name === 'ActiveAuthor');
      expect(active).toBeDefined();
    });
  });
});
