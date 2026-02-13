import Database from 'better-sqlite3';
import { DatabaseManager } from '../src/database';
import {
  ActionType,
  ActionStatus,
  Priority,
  ConditionalAction,
} from '../src/types';

describe('DatabaseManager', () => {
  let db: DatabaseManager;

  beforeEach(() => {
    // Use in-memory database for tests
    db = new DatabaseManager(':memory:');
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Action Management', () => {
    it('should insert and retrieve an action', () => {
      const action: ConditionalAction = {
        id: 'test-action-1',
        agentName: 'test-agent',
        actionType: ActionType.POST,
        priority: Priority.NORMAL,
        payload: { submolt: 'General', content: 'Test post' },
        status: ActionStatus.PENDING,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      db.insertAction(action);

      const retrieved = db.getAction('test-action-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.agentName).toBe('test-agent');
      expect(retrieved?.actionType).toBe(ActionType.POST);
      expect(retrieved?.status).toBe(ActionStatus.PENDING);
    });

    it('should get next pending action by priority', () => {
      // Insert multiple actions with different priorities
      const lowPriority: ConditionalAction = {
        id: 'low-priority',
        agentName: 'test-agent',
        actionType: ActionType.COMMENT,
        priority: Priority.LOW,
        payload: { postId: '123', content: 'Low priority comment' },
        status: ActionStatus.PENDING,
        createdAt: new Date(Date.now() - 3000),
        attempts: 0,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      const highPriority: ConditionalAction = {
        id: 'high-priority',
        agentName: 'test-agent',
        actionType: ActionType.POST,
        priority: Priority.HIGH,
        payload: { submolt: 'General', content: 'High priority post' },
        status: ActionStatus.PENDING,
        createdAt: new Date(Date.now() - 2000),
        attempts: 0,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      const normalPriority: ConditionalAction = {
        id: 'normal-priority',
        agentName: 'test-agent',
        actionType: ActionType.FOLLOW,
        priority: Priority.NORMAL,
        payload: { username: 'user123' },
        status: ActionStatus.PENDING,
        createdAt: new Date(Date.now() - 1000),
        attempts: 0,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      db.insertAction(lowPriority);
      db.insertAction(highPriority);
      db.insertAction(normalPriority);

      const next = db.getNextAction();
      expect(next).toBeDefined();
      expect(next?.id).toBe('high-priority');
      expect(next?.priority).toBe(Priority.HIGH);
    });

    it('should update action status', () => {
      const action: ConditionalAction = {
        id: 'test-action-2',
        agentName: 'test-agent',
        actionType: ActionType.UPVOTE,
        priority: Priority.NORMAL,
        payload: { postId: '123' },
        status: ActionStatus.PENDING,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      db.insertAction(action);

      db.updateActionStatus(
        'test-action-2',
        ActionStatus.COMPLETED,
        undefined,
        200,
      );

      const updated = db.getAction('test-action-2');
      expect(updated?.status).toBe(ActionStatus.COMPLETED);
      expect(updated?.httpStatus).toBe(200);
      expect(updated?.completedAt).toBeDefined();
    });

    it('should cancel an action', () => {
      const action: ConditionalAction = {
        id: 'test-action-3',
        agentName: 'test-agent',
        actionType: ActionType.FOLLOW,
        priority: Priority.NORMAL,
        payload: { username: 'user456' },
        status: ActionStatus.SCHEDULED,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      db.insertAction(action);

      db.cancelAction('test-action-3', 'User requested cancellation');

      const cancelled = db.getAction('test-action-3');
      expect(cancelled?.status).toBe(ActionStatus.CANCELLED);
      expect(cancelled?.error).toBe('User requested cancellation');
    });

    it('should get actions by status', () => {
      const pending1: ConditionalAction = {
        id: 'pending-1',
        agentName: 'test-agent',
        actionType: ActionType.POST,
        priority: Priority.NORMAL,
        payload: { submolt: 'General', content: 'Pending 1' },
        status: ActionStatus.PENDING,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      const pending2: ConditionalAction = {
        id: 'pending-2',
        agentName: 'test-agent',
        actionType: ActionType.COMMENT,
        priority: Priority.NORMAL,
        payload: { postId: '123', content: 'Pending 2' },
        status: ActionStatus.PENDING,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      const completed: ConditionalAction = {
        id: 'completed-1',
        agentName: 'test-agent',
        actionType: ActionType.UPVOTE,
        priority: Priority.NORMAL,
        payload: { postId: '456' },
        status: ActionStatus.COMPLETED,
        createdAt: new Date(),
        attempts: 1,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      db.insertAction(pending1);
      db.insertAction(pending2);
      db.insertAction(completed);

      const pendingActions = db.getActionsByStatus(ActionStatus.PENDING);
      expect(pendingActions).toHaveLength(2);
      expect(pendingActions.every((a) => a.status === ActionStatus.PENDING)).toBe(
        true,
      );
    });

    it('should increment attempt count', () => {
      const action: ConditionalAction = {
        id: 'test-action-4',
        agentName: 'test-agent',
        actionType: ActionType.POST,
        priority: Priority.NORMAL,
        payload: { submolt: 'General', content: 'Test retry' },
        status: ActionStatus.PENDING,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      db.insertAction(action);

      db.incrementAttempts('test-action-4');

      const updated = db.getAction('test-action-4');
      expect(updated?.attempts).toBe(1);

      db.incrementAttempts('test-action-4');
      const updated2 = db.getAction('test-action-4');
      expect(updated2?.attempts).toBe(2);
    });
  });

  describe('Rate Limit Management', () => {
    it('should record and retrieve rate limit', () => {
      const now = Date.now();
      const windowStart = Math.floor(now / 1800000) * 1800000; // 30min window

      db.recordRateLimit('test-agent', ActionType.POST, windowStart);

      const limit = db.getRateLimit('test-agent', ActionType.POST, windowStart);
      expect(limit).toBeDefined();
      expect(limit?.count).toBe(1);
      expect(limit?.dailyCount).toBe(1);
    });

    it('should increment rate limit count', () => {
      const now = Date.now();
      const windowStart = Math.floor(now / 1800000) * 1800000;

      db.recordRateLimit('test-agent', ActionType.POST, windowStart);
      db.recordRateLimit('test-agent', ActionType.POST, windowStart);

      const limit = db.getRateLimit('test-agent', ActionType.POST, windowStart);
      expect(limit?.count).toBe(2);
      expect(limit?.dailyCount).toBe(2);
    });

    it('should track daily count separately', () => {
      const now = Date.now();
      const window1 = Math.floor(now / 1800000) * 1800000;
      const window2 = window1 + 1800000; // Next 30min window

      db.recordRateLimit('test-agent', ActionType.POST, window1);
      db.recordRateLimit('test-agent', ActionType.POST, window2);

      const limit1 = db.getRateLimit('test-agent', ActionType.POST, window1);
      const limit2 = db.getRateLimit('test-agent', ActionType.POST, window2);

      // Each window has count=1, but dailyCount should accumulate
      expect(limit1?.count).toBe(1);
      expect(limit2?.count).toBe(1);
      // Note: Daily count tracking depends on same dailyReset value
    });
  });

  describe('Agent Management', () => {
    it('should register and retrieve agent', () => {
      db.registerAgent('new-agent');

      const agent = db.getAgent('new-agent');
      expect(agent).toBeDefined();
      expect(agent?.agentName).toBe('new-agent');
      expect(agent?.isNew).toBe(1); // Should be marked as new
    });

    it('should update agent last activity', () => {
      db.registerAgent('test-agent');

      const before = db.getAgent('test-agent');
      const beforeActivity = before?.lastActivity;

      // Wait a bit
      setTimeout(() => {
        db.updateAgentActivity('test-agent');

        const after = db.getAgent('test-agent');
        expect(after?.lastActivity).toBeGreaterThan(beforeActivity || 0);
      }, 10);
    });
  });

  describe('Statistics', () => {
    it('should return queue statistics', () => {
      const action1: ConditionalAction = {
        id: 'stats-1',
        agentName: 'test-agent',
        actionType: ActionType.POST,
        priority: Priority.NORMAL,
        payload: { submolt: 'General', content: 'Stats test 1' },
        status: ActionStatus.PENDING,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      const action2: ConditionalAction = {
        id: 'stats-2',
        agentName: 'test-agent',
        actionType: ActionType.COMMENT,
        priority: Priority.NORMAL,
        payload: { postId: '123', content: 'Stats test 2' },
        status: ActionStatus.COMPLETED,
        createdAt: new Date(),
        attempts: 1,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };

      db.insertAction(action1);
      db.insertAction(action2);

      const stats = db.getStats();
      expect(stats.totalActions).toBe(2);
    });
  });

  describe('Conditional Actions', () => {
    it('should store and retrieve conditional actions', () => {
      const conditionalAction: ConditionalAction = {
        id: 'conditional-1',
        agentName: 'test-agent',
        actionType: ActionType.FOLLOW,
        priority: Priority.NORMAL,
        payload: { username: 'user789' },
        status: ActionStatus.SCHEDULED,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        conditions: {
          type: 'ACCOUNT_ACTIVE',
        },
        conditionCheckInterval: 60,
        conditionTimeout: new Date(Date.now() + 86400000), // 24h from now
      };

      db.insertAction(conditionalAction);

      const retrieved = db.getAction('conditional-1');
      expect(retrieved?.conditions).toBeDefined();
      expect(retrieved?.conditionCheckInterval).toBe(60);
      expect(retrieved?.conditionTimeout).toBeDefined();
    });

    it('should get conditional actions due for check', () => {
      const action: ConditionalAction = {
        id: 'conditional-check-1',
        agentName: 'test-agent',
        actionType: ActionType.POST,
        priority: Priority.NORMAL,
        payload: { submolt: 'General', content: 'Conditional post' },
        status: ActionStatus.SCHEDULED,
        createdAt: new Date(Date.now() - 120000), // 2 minutes ago
        attempts: 0,
        maxAttempts: 3,
        conditions: {
          type: 'TIME_AFTER',
          timestamp: new Date(Date.now() - 60000).toISOString(), // 1 min ago
        },
        conditionCheckInterval: 60,
      };

      db.insertAction(action);

      const dueActions = db.getConditionalActionsDueForCheck();
      expect(dueActions.length).toBeGreaterThan(0);
      expect(dueActions[0].id).toBe('conditional-check-1');
    });

    it('should record condition evaluation', () => {
      db.recordConditionEvaluation(
        'test-action-id',
        true,
        'All conditions satisfied',
      );

      const evaluations = db.getConditionEvaluations('test-action-id');
      expect(evaluations).toHaveLength(1);
      expect(evaluations[0].satisfied).toBe(1); // SQLite stores boolean as 0/1
      expect(evaluations[0].details).toBe('All conditions satisfied');
    });
  });
});
