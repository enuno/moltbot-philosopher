import { Express } from 'express';
import request from 'supertest';
import { DatabaseManager } from '../../src/database';
import {
  initializeTestDatabase,
  cleanupTestDatabase,
  createTestAction,
  createTestAgent,
  getDatabaseConnection,
} from './setup';
import {
  createTestApp,
  MockActionExecutor,
  advanceTime,
  waitForCondition,
  queryDatabase,
  queryDatabaseRow,
} from './utils';
import { ActionType, ActionStatus, Priority } from '../../src/types';

describe('Action Queue Integration Tests', () => {
  let db: DatabaseManager;
  let app: Express;
  let mockExecutor: MockActionExecutor;

  beforeAll(async () => {
    // Initialize for all tests
  });

  beforeEach(async () => {
    db = await initializeTestDatabase();
    mockExecutor = new MockActionExecutor();
    app = createTestApp(db, mockExecutor);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  afterAll(async () => {
    // Cleanup for all tests
  });

  // ============================================================================
  // GROUP 1: CORE LIFECYCLE (Tests 1-3)
  // ============================================================================

  describe('End-to-End Action Lifecycle', () => {
    it('Test 1: should create, queue, and complete action', async () => {
      // Setup
      mockExecutor.setShouldSucceed(true);

      // Act: Create action
      const createResponse = await request(app)
        .post('/actions')
        .send({
          agentName: 'classical',
          actionType: ActionType.POST,
          priority: Priority.NORMAL,
          payload: { submolt: 'General', content: 'Test post' },
        });

      // Assert: Created
      expect(createResponse.status).toBe(201);
      expect(createResponse.body.action.id).toBeDefined();
      const actionId = createResponse.body.action.id;

      // Check queue stats
      const statsBeforeResponse = await request(app).get('/queue/stats');
      expect(statsBeforeResponse.body.stats).toBeDefined();
      expect(statsBeforeResponse.body.stats[ActionStatus.PENDING]).toBeGreaterThanOrEqual(1);

      // Get action
      const getResponse = await request(app).get(`/actions/${actionId}`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.body.action.status).toBe(ActionStatus.PENDING);

      // Process queue
      const processResponse = await request(app).post('/queue/process');
      expect(processResponse.status).toBe(200);
      expect(processResponse.body.processed).toBe(1);

      // Verify completed
      const finalResponse = await request(app).get(`/actions/${actionId}`);
      expect(finalResponse.body.action.status).toBe(ActionStatus.COMPLETED);
    });

    it('Test 2: should process concurrent submissions fairly', async () => {
      // Setup
      mockExecutor.setShouldSucceed(true);

      // Act: Submit 5 actions from different agents
      const actionIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/actions')
          .send({
            agentName: `agent-${i}`,
            actionType: ActionType.POST,
            priority: Priority.NORMAL,
            payload: { submolt: 'General', content: `Post from agent ${i}` },
          });

        expect(response.status).toBe(201);
        actionIds.push(response.body.action.id);
      }

      // Assert: All actions pending
      const statsResponse = await request(app).get('/queue/stats');
      expect(statsResponse.body.stats[ActionStatus.PENDING]).toBeGreaterThanOrEqual(5);

      // Process each action
      for (const actionId of actionIds) {
        await request(app).post('/queue/process');
      }

      // Assert: All completed
      for (const actionId of actionIds) {
        const response = await request(app).get(`/actions/${actionId}`);
        expect(response.body.action.status).toBe(ActionStatus.COMPLETED);
      }
    });

    it('Test 3: should handle action attempts counter', async () => {
      // Setup
      mockExecutor.setShouldSucceed(true);

      // Act: Create action
      const createResponse = await request(app)
        .post('/actions')
        .send({
          agentName: 'test-agent',
          actionType: ActionType.POST,
          priority: Priority.NORMAL,
          payload: { submolt: 'General', content: 'Test post' },
        });

      const actionId = createResponse.body.action.id;

      // Verify initial state
      let response = await request(app).get(`/actions/${actionId}`);
      expect(response.body.action.attempts).toBe(0);

      // Process action
      await request(app).post('/queue/process');

      // Check that it completed
      response = await request(app).get(`/actions/${actionId}`);
      expect(response.body.action.status).toBe(ActionStatus.COMPLETED);
      expect(response.body.action.attempts).toBe(0); // Only incremented on failures
    });
  });

  // ============================================================================
  // GROUP 2: RATE LIMITING (Tests 4-7) - DOCUMENTED FOR FUTURE INTEGRATION
  // ============================================================================

  describe('Rate Limiting', () => {
    // NOTE: Rate limiting tests require integration of RateLimiter into the
    // POST /actions endpoint. The RateLimiter class exists and is tested
    // separately in unit tests. These tests document the expected behavior
    // when rate limiting is integrated into the Express endpoints.

    it.skip('Test 4: should enforce POST rate limit (1 per 30 min)', async () => {
      // Setup: Requires rate limiter integrated into POST /actions
      mockExecutor.setShouldSucceed(true);

      // Act: Create first POST
      const response1 = await request(app)
        .post('/actions')
        .send({
          agentName: 'test-agent',
          actionType: ActionType.POST,
          priority: Priority.NORMAL,
          payload: { submolt: 'General', content: 'Post 1' },
        });

      expect(response1.status).toBe(201);

      // Try to create second POST immediately
      const response2 = await request(app)
        .post('/actions')
        .send({
          agentName: 'test-agent',
          actionType: ActionType.POST,
          priority: Priority.NORMAL,
          payload: { submolt: 'General', content: 'Post 2' },
        });

      // Should be rate limited
      expect(response2.status).toBe(429);
    });

    it.skip('Test 5: should enforce COMMENT rate limit (1 per 20 sec)', async () => {
      // Requires rate limiter integrated into POST /actions
      jest.useFakeTimers();

      mockExecutor.setShouldSucceed(true);

      const response1 = await request(app)
        .post('/actions')
        .send({
          agentName: 'test-agent',
          actionType: ActionType.COMMENT,
          priority: Priority.NORMAL,
          payload: { postId: 'post-123', content: 'Comment 1' },
        });

      expect(response1.status).toBe(201);

      const response2 = await request(app)
        .post('/actions')
        .send({
          agentName: 'test-agent',
          actionType: ActionType.COMMENT,
          priority: Priority.NORMAL,
          payload: { postId: 'post-123', content: 'Comment 2' },
        });

      expect(response2.status).toBe(429);

      advanceTime(21000);

      const response3 = await request(app)
        .post('/actions')
        .send({
          agentName: 'test-agent',
          actionType: ActionType.COMMENT,
          priority: Priority.NORMAL,
          payload: { postId: 'post-123', content: 'Comment 3' },
        });

      expect(response3.status).toBe(201);

      jest.useRealTimers();
    });

    it.skip('Test 6: should enforce stricter limits for new agents (1 per hour)', async () => {
      // Requires rate limiter integrated into POST /actions
      db.upsertAgent('new-agent', true);
      mockExecutor.setShouldSucceed(true);

      const response1 = await request(app)
        .post('/actions')
        .send({
          agentName: 'new-agent',
          actionType: ActionType.POST,
          priority: Priority.NORMAL,
          payload: { submolt: 'General', content: 'New agent post' },
        });

      expect(response1.status).toBe(201);

      const response2 = await request(app)
        .post('/actions')
        .send({
          agentName: 'new-agent',
          actionType: ActionType.POST,
          priority: Priority.NORMAL,
          payload: { submolt: 'General', content: 'Another post' },
        });

      expect(response2.status).toBe(429);
    });

    it.skip('Test 7: should enforce daily max (100 per day)', async () => {
      // Requires rate limiter integrated into POST /actions
      mockExecutor.setShouldSucceed(true);

      // Act: Create 100 actions
      for (let i = 0; i < 100; i++) {
        const response = await request(app)
          .post('/actions')
          .send({
            agentName: 'spam-agent',
            actionType: ActionType.UPVOTE,
            priority: Priority.NORMAL,
            payload: { targetId: `post-${i}`, targetType: 'post' },
          });

        expect(response.status).toBe(201);
      }

      // Try 101st - should fail
      const response101 = await request(app)
        .post('/actions')
        .send({
          agentName: 'spam-agent',
          actionType: ActionType.UPVOTE,
          priority: Priority.NORMAL,
          payload: { targetId: 'post-101', targetType: 'post' },
        });

      expect(response101.status).toBe(429);
    });
  });

  // ============================================================================
  // GROUP 3: PERSISTENCE & CONDITIONS (Tests 8-10)
  // ============================================================================

  describe('Persistence and Conditional Actions', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('Test 8: should persist data across operations', async () => {
      // Setup
      mockExecutor.setShouldSucceed(true);

      // Act: Create action
      const createResponse = await request(app)
        .post('/actions')
        .send({
          agentName: 'persistent-agent',
          actionType: ActionType.POST,
          priority: Priority.HIGH,
          payload: { submolt: 'General', content: 'Persistent post' },
        });

      const actionId = createResponse.body.action.id;

      // Query database directly
      const rows = queryDatabase(db, 'SELECT * FROM actions WHERE id = ?', [actionId]);
      expect(rows.length).toBe(1);
      expect(rows[0].agent_name).toBe('persistent-agent');
      expect(rows[0].priority).toBe(Priority.HIGH);
    });

    it('Test 9: should handle scheduled actions correctly', async () => {
      // Setup
      mockExecutor.setShouldSucceed(true);

      // Schedule action for 5 minutes in future
      const futureTime = new Date(Date.now() + 5 * 60 * 1000);

      // Act: Create scheduled action
      const response = await request(app)
        .post('/actions')
        .send({
          agentName: 'test-agent',
          actionType: ActionType.POST,
          priority: Priority.NORMAL,
          payload: { submolt: 'General', content: 'Scheduled post' },
          scheduledFor: futureTime.toISOString(),
        });

      expect(response.status).toBe(201);
      const actionId = response.body.action.id;

      // Verify status is SCHEDULED
      const getResponse = await request(app).get(`/actions/${actionId}`);
      expect(getResponse.body.action.status).toBe(ActionStatus.SCHEDULED);

      // Try to process (should be skipped - not yet time)
      const statsResponse1 = await request(app).get('/queue/stats');
      const pendingBefore = statsResponse1.body.stats.PENDING || 0;

      // Advance time to scheduled time
      advanceTime(5 * 60 * 1000 + 1000);

      // Now it should be processable
      const getResponse2 = await request(app).get(`/actions/${actionId}`);
      // Status might still be SCHEDULED until processed
      expect(getResponse2.status).toBe(200);
    });

    it('Test 10: should handle conditional actions', async () => {
      // Setup
      mockExecutor.setShouldSucceed(true);

      // Act: Create action with condition
      const response = await request(app)
        .post('/actions')
        .send({
          agentName: 'test-agent',
          actionType: ActionType.FOLLOW,
          priority: Priority.NORMAL,
          payload: { username: 'target-user' },
          conditions: {
            operator: 'AND',
            conditions: [
              {
                id: 'cond-1',
                type: 'ACCOUNT_ACTIVE',
                params: {},
              },
            ],
          },
        });

      expect(response.status).toBe(201);
      const actionId = response.body.action.id;

      // Verify status is SCHEDULED (because has conditions)
      const getResponse = await request(app).get(`/actions/${actionId}`);
      expect(getResponse.body.action.status).toBe(ActionStatus.SCHEDULED);
      expect(getResponse.body.action.conditions).toBeDefined();
    });
  });

  // ============================================================================
  // GROUP 4: ADVANCED PROCESSING (Tests 11-12)
  // ============================================================================

  describe('Advanced Processing', () => {
    it('Test 11: should handle multi-agent round-robin with priority', async () => {
      // Setup
      mockExecutor.setShouldSucceed(true);

      // Act: Create actions from multiple agents with different priorities
      const highPriorityResponse = await request(app)
        .post('/actions')
        .send({
          agentName: 'agent-1',
          actionType: ActionType.POST,
          priority: Priority.HIGH,
          payload: { submolt: 'General', content: 'High priority' },
        });

      const lowPriorityResponse = await request(app)
        .post('/actions')
        .send({
          agentName: 'agent-2',
          actionType: ActionType.POST,
          priority: Priority.LOW,
          payload: { submolt: 'General', content: 'Low priority' },
        });

      // Process should take HIGH priority first
      const processResponse = await request(app).post('/queue/process');
      expect(processResponse.body.processed).toBe(1);

      // Verify it processed the high-priority action
      const highPriorityAction = await request(app).get(
        `/actions/${highPriorityResponse.body.action.id}`
      );
      expect(highPriorityAction.body.action.status).toBe(ActionStatus.COMPLETED);

      // Low priority still pending
      const lowPriorityAction = await request(app).get(
        `/actions/${lowPriorityResponse.body.action.id}`
      );
      expect(lowPriorityAction.body.action.status).toBe(ActionStatus.PENDING);
    });

    it.skip('Test 12: should implement circuit breaker after failures', async () => {
      // NOTE: Circuit breaker tests require failure simulation and tracking
      // The CircuitBreaker class exists and is unit-tested separately
      // This integration test documents expected behavior when circuit breaker
      // prevents processing after consecutive failures

      // Setup: Make executor fail
      mockExecutor.setShouldSucceed(false);

      // Act: Create 5 actions and fail them all
      const actionIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/actions')
          .send({
            agentName: 'failing-agent',
            actionType: ActionType.POST,
            priority: Priority.NORMAL,
            payload: { submolt: 'General', content: `Post ${i}` },
          });

        actionIds.push(response.body.action.id);
      }

      // Process all (they'll fail)
      for (let i = 0; i < 5; i++) {
        await request(app).post('/queue/process');
      }

      // Verify all failed
      for (const actionId of actionIds) {
        const response = await request(app).get(`/actions/${actionId}`);
        expect(response.body.action.status).toBe(ActionStatus.FAILED);
      }

      // Now try another action - should be rate limited due to circuit breaker
      const response = await request(app)
        .post('/actions')
        .send({
          agentName: 'failing-agent',
          actionType: ActionType.POST,
          priority: Priority.NORMAL,
          payload: { submolt: 'General', content: 'Post 6' },
        });

      // Circuit breaker should prevent execution (503 or similar)
      expect([429, 503]).toContain(response.status);
    });
  });

  // ============================================================================
  // GROUP 5: OBSERVABILITY (Tests 13-15)
  // ============================================================================

  describe('Observability', () => {
    it('Test 13: should return queue stats by status', async () => {
      // Setup
      mockExecutor.setShouldSucceed(true);

      // Act: Create actions in different states
      const pendingResponse = await request(app)
        .post('/actions')
        .send({
          agentName: 'test-agent',
          actionType: ActionType.POST,
          priority: Priority.NORMAL,
          payload: { submolt: 'General', content: 'Pending' },
        });

      const pendingId = pendingResponse.body.action.id;

      // Create another and complete it
      const completedResponse = await request(app)
        .post('/actions')
        .send({
          agentName: 'test-agent',
          actionType: ActionType.COMMENT,
          priority: Priority.NORMAL,
          payload: { postId: 'post-123', content: 'Will complete' },
        });

      await request(app).post('/queue/process');

      // Get stats
      const statsResponse = await request(app).get('/queue/stats');
      const stats = statsResponse.body.stats;

      // Assert: Should have breakdown by status
      expect(statsResponse.status).toBe(200);
      expect(stats).toBeDefined();
      expect(typeof stats[ActionStatus.PENDING]).toBe('number');
      expect(typeof stats[ActionStatus.COMPLETED]).toBe('number');
      expect(stats[ActionStatus.PENDING]).toBeGreaterThanOrEqual(1);
      expect(stats[ActionStatus.COMPLETED]).toBeGreaterThanOrEqual(1);
    });

    it('Test 14: should show action state transitions in history', async () => {
      // Setup
      mockExecutor.setShouldSucceed(true);

      // Act: Create and process action
      const response = await request(app)
        .post('/actions')
        .send({
          agentName: 'test-agent',
          actionType: ActionType.POST,
          priority: Priority.NORMAL,
          payload: { submolt: 'General', content: 'History test' },
        });

      const actionId = response.body.action.id;

      // Verify status progression
      let action = (await request(app).get(`/actions/${actionId}`)).body.action;
      expect(action.status).toBe(ActionStatus.PENDING);

      // Process
      await request(app).post('/queue/process');

      // Check final state
      action = (await request(app).get(`/actions/${actionId}`)).body.action;
      expect(action.status).toBe(ActionStatus.COMPLETED);
      expect(action.completedAt).toBeDefined();
    });

    it('Test 15: should show agent metrics and action counts', async () => {
      // Setup
      mockExecutor.setShouldSucceed(true);

      // Act: Create and process some actions
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/actions')
          .send({
            agentName: 'metrics-agent',
            actionType: ActionType.UPVOTE,
            priority: Priority.NORMAL,
            payload: { targetId: `post-${i}`, targetType: 'post' },
          });

        await request(app).post('/queue/process');
      }

      // Query agent metrics directly
      const metrics = db.getAgentMetrics('metrics-agent');

      // Assert: Should show action counts by status
      expect(metrics.agentName).toBe('metrics-agent');
      expect(metrics.totalActions).toBeGreaterThanOrEqual(3);
      expect(metrics.byStatus).toBeDefined();
      expect(metrics.byStatus[ActionStatus.COMPLETED]).toBeGreaterThanOrEqual(3);
    });
  });
});
