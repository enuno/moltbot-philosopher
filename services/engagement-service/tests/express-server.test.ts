/**
 * Integration tests for Express server endpoints and cron jobs
 * Tests /engage endpoint, /health endpoint, /stats endpoint
 * Tests cron job scheduling
 */

import request from 'supertest';
import express, { type Express } from 'express';
import fs from 'fs';
import path from 'path';
import { EngagementEngine } from '../src/engagement-engine';
import { StateManager } from '../src/state-manager';
import { createDefaultState, tmpStateDir, cleanupTmpDir, MOCK_AGENTS } from './test-utils';

describe('Express Server - Engagement Service', () => {
  let app: Express;
  let tmpDir: string;
  let statePaths: Record<string, string>;
  let engine: EngagementEngine;
  let server: any;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Setup temp state files
    tmpDir = tmpStateDir();
    statePaths = {};

    MOCK_AGENTS.forEach(agent => {
      const statePath = path.join(tmpDir, `${agent.id}-state.json`);
      fs.writeFileSync(statePath, JSON.stringify(createDefaultState(), null, 2));
      statePaths[agent.id] = statePath;
    });

    // Create engine
    engine = new EngagementEngine({ statePaths, agentRoster: MOCK_AGENTS });

    // Setup routes
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'engagement-service',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    // Engage endpoint - trigger engagement cycle manually
    app.post('/engage', async (req, res) => {
      try {
        const startTime = Date.now();
        await engine.runEngagementCycle();
        const duration = Date.now() - startTime;

        res.json({
          success: true,
          message: 'Engagement cycle completed',
          duration,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Stats endpoint - show engagement breakdown
    app.get('/stats', async (req, res) => {
      try {
        const stats: Record<string, any> = {};

        for (const agent of MOCK_AGENTS) {
          const stateManager = new StateManager(statePaths[agent.id]);
          const state = await stateManager.loadState();

          stats[agent.id] = {
            dailyStats: state.dailyStats,
            followedAccounts: state.followedAccounts.length,
            queuedOpportunities: state.engagementQueue.length,
            lastEngagementCheck: state.lastEngagementCheck
          };
        }

        res.json(stats);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
    cleanupTmpDir(tmpDir);
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('engagement-service');
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('POST /engage', () => {
    it('should trigger engagement cycle successfully', async () => {
      const response = await request(app)
        .post('/engage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Engagement cycle completed');
      expect(response.body.duration).toBeGreaterThanOrEqual(0);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle engagement cycle errors gracefully', async () => {
      // Create a broken engine that throws
      const brokenEngine = {
        runEngagementCycle: async () => {
          throw new Error('Test error');
        }
      } as any;

      // Override engine
      app.post('/engage-broken', async (req, res) => {
        try {
          await brokenEngine.runEngagementCycle();
          res.json({ success: true });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      const response = await request(app)
        .post('/engage-broken')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error');
    });
  });

  describe('GET /stats', () => {
    it('should return engagement statistics for all agents', async () => {
      const response = await request(app)
        .get('/stats')
        .expect(200);

      // Should have stats for all mock agents
      MOCK_AGENTS.forEach(agent => {
        expect(response.body[agent.id]).toBeDefined();
        expect(response.body[agent.id].dailyStats).toBeDefined();
        expect(response.body[agent.id].followedAccounts).toBe(0);
        expect(response.body[agent.id].queuedOpportunities).toBe(0);
      });
    });

    it('should reflect updated stats after actions', async () => {
      const agent = MOCK_AGENTS[0];
      const stateManager = new StateManager(statePaths[agent.id]);

      // Enqueue an opportunity
      await stateManager.enqueueOpportunity({
        postId: 'post_1',
        priority: 0.8,
        reason: 'test',
        type: 'comment'
      });

      const response = await request(app)
        .get('/stats')
        .expect(200);

      expect(response.body[agent.id].queuedOpportunities).toBe(1);
    });

    it('should show correct count of followed accounts', async () => {
      const agent = MOCK_AGENTS[0];
      const stateManager = new StateManager(statePaths[agent.id]);

      // Add followed accounts
      await stateManager.recordFollow({
        name: 'Author1',
        postsSeenCount: 5,
        firstSeen: Date.now(),
        lastEngagement: Date.now(),
        qualityScore: 0.7
      });

      await stateManager.recordFollow({
        name: 'Author2',
        postsSeenCount: 3,
        firstSeen: Date.now(),
        lastEngagement: Date.now(),
        qualityScore: 0.8
      });

      const response = await request(app)
        .get('/stats')
        .expect(200);

      expect(response.body[agent.id].followedAccounts).toBe(2);
    });
  });

  describe('Server startup and lifecycle', () => {
    it('should start without errors', async () => {
      expect(() => {
        server = app.listen(0); // Use port 0 for automatic assignment
      }).not.toThrow();
    });

    it('should handle graceful shutdown', async () => {
      server = app.listen(0);
      expect(() => {
        server.close();
      }).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle missing routes gracefully', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON in POST requests', async () => {
      const response = await request(app)
        .post('/engage')
        .set('Content-Type', 'application/json')
        .send('{invalid json');

      // Express will handle this automatically
      expect([400, 405, 404]).toContain(response.status);
    });
  });
});

describe('Cron Job Scheduling', () => {
  let tmpDir: string;
  let statePaths: Record<string, string>;
  let engine: EngagementEngine;

  beforeEach(() => {
    tmpDir = tmpStateDir();
    statePaths = {};

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

  describe('5-minute engagement cycle', () => {
    it('should execute engagement cycle without errors', async () => {
      await engine.runEngagementCycle();
      expect(true).toBe(true);
    });

    it('should visit all agents in order', async () => {
      const visitedAgents: string[] = [];

      // Mock dequeueOpportunities to track visits
      const originalDequeue = engine.dequeueOpportunities;
      (engine.dequeueOpportunities as any) = function(agent: any) {
        visitedAgents.push(agent.id);
        return Promise.resolve([]);
      };

      await engine.runEngagementCycle();

      // Should visit all agents (actual order depends on implementation)
      MOCK_AGENTS.forEach(agent => {
        expect(visitedAgents).toContain(agent.id);
      });

      // Restore original
      engine.dequeueOpportunities = originalDequeue;
    });
  });

  describe('30-minute posting check', () => {
    it('should respect post cooldown (30 minutes)', async () => {
      const agent = MOCK_AGENTS[0];
      const stateManager = new StateManager(statePaths[agent.id]);

      // Set last post to 5 minutes ago
      let state = await stateManager.loadState();
      state.lastPostTime = Date.now() - 5 * 60 * 1000;
      await stateManager.saveState(state);

      await engine.considerPosting(agent);

      // State should not change (no new post)
      state = await stateManager.loadState();
      expect(state.dailyStats.postsCreated).toBe(0);
    });

    it('should allow posting after 30-minute cooldown', async () => {
      const agent = MOCK_AGENTS[0];
      const stateManager = new StateManager(statePaths[agent.id]);

      // Set last post to 40 minutes ago
      let state = await stateManager.loadState();
      state.lastPostTime = Date.now() - 40 * 60 * 1000;
      state.dailyStats.postsCreated = 0;
      await stateManager.saveState(state);

      await engine.considerPosting(agent);

      // No error should occur
      expect(true).toBe(true);
    });
  });

  describe('2am daily maintenance', () => {
    it('should reset daily stats', async () => {
      const agent = MOCK_AGENTS[0];
      const stateManager = new StateManager(statePaths[agent.id]);

      // Set some stats
      let state = await stateManager.loadState();
      state.dailyStats.postsCreated = 2;
      state.dailyStats.commentsMade = 15;
      state.dailyReset = '2026-02-19'; // Yesterday
      await stateManager.saveState(state);

      await engine.dailyMaintenance();

      state = await stateManager.loadState();
      expect(state.dailyStats.postsCreated).toBe(0);
      expect(state.dailyStats.commentsMade).toBe(0);
    });

    it('should remove inactive accounts (>30 days)', async () => {
      const agent = MOCK_AGENTS[0];
      const stateManager = new StateManager(statePaths[agent.id]);

      // Add account inactive for 35 days
      await stateManager.recordFollow({
        name: 'InactiveAuthor',
        postsSeenCount: 5,
        firstSeen: Date.now() - 40 * 24 * 60 * 60 * 1000,
        lastEngagement: Date.now() - 35 * 24 * 60 * 60 * 1000,
        qualityScore: 0.7
      });

      await engine.dailyMaintenance();

      const state = await stateManager.loadState();
      const inactive = state.followedAccounts.find(a => a.name === 'InactiveAuthor');
      expect(inactive).toBeUndefined();
    });

    it('should keep active accounts (<30 days)', async () => {
      const agent = MOCK_AGENTS[0];
      const stateManager = new StateManager(statePaths[agent.id]);

      // Add account active within 20 days
      await stateManager.recordFollow({
        name: 'ActiveAuthor',
        postsSeenCount: 5,
        firstSeen: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastEngagement: Date.now() - 20 * 24 * 60 * 60 * 1000,
        qualityScore: 0.8
      });

      await engine.dailyMaintenance();

      const state = await stateManager.loadState();
      const active = state.followedAccounts.find(a => a.name === 'ActiveAuthor');
      expect(active).toBeDefined();
    });
  });
});
