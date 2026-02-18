import Database from 'better-sqlite3';
import { DatabaseManager } from '../src/database';
import {
  ActionType,
  ActionStatus,
  Priority,
  ConditionalAction,
  ConditionOperator,
  ConditionType,
  ConditionEvaluation,
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

      db.updateActionStatus('test-action-2', ActionStatus.COMPLETED);

      const updated = db.getAction('test-action-2');
      expect(updated?.status).toBe(ActionStatus.COMPLETED);
      // httpStatus is only stored on FAILED; completed actions don't persist it
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
    it('should record and retrieve rate limit state', () => {
      // intervalSeconds=1800 → 30min window
      db.recordRateLimit('test-agent', ActionType.POST, 1800);

      const limit = db.getRateLimitState('test-agent', ActionType.POST);
      expect(limit).toBeDefined();
      expect(limit?.count).toBe(1);
      expect(limit?.dailyCount).toBe(1);
    });

    it('should increment rate limit count within the same window', () => {
      db.recordRateLimit('test-agent', ActionType.POST, 1800);
      db.recordRateLimit('test-agent', ActionType.POST, 1800);

      const limit = db.getRateLimitState('test-agent', ActionType.POST);
      expect(limit?.count).toBe(2);
      expect(limit?.dailyCount).toBe(2);
    });

    it('should return null for agent with no rate limit records', () => {
      const limit = db.getRateLimitState('unknown-agent', ActionType.POST);
      expect(limit).toBeNull();
    });
  });

  describe('Agent Management', () => {
    it('should upsert and check new agent status', () => {
      db.upsertAgent('new-agent', true);

      const isNew = db.isNewAgent('new-agent');
      expect(isNew).toBe(true);
    });

    it('should report false for unknown agent', () => {
      const isNew = db.isNewAgent('no-such-agent');
      expect(isNew).toBe(false);
    });

    it('should allow re-upsert of existing agent', () => {
      db.upsertAgent('test-agent', true);
      db.upsertAgent('test-agent', false);

      // After marking not-new, isNew should be false
      const isNew = db.isNewAgent('test-agent');
      expect(isNew).toBe(false);
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
          operator: ConditionOperator.AND,
          conditions: [
            { id: 'c1', type: ConditionType.ACCOUNT_ACTIVE, params: {} },
          ],
        },
        conditionCheckInterval: 60,
        conditionTimeout: new Date(Date.now() + 86400000), // 24h from now
      };

      db.insertAction(conditionalAction);

      const retrieved = db.getAction('conditional-1') as ConditionalAction;
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
          operator: ConditionOperator.AND,
          conditions: [
            {
              id: 'c1',
              type: ConditionType.TIME_AFTER,
              params: { timestamp: new Date(Date.now() - 60000).toISOString() },
            },
          ],
        },
        conditionCheckInterval: 60,
      };

      db.insertAction(action);

      const dueActions = db.getConditionalActionsDueForCheck();
      expect(dueActions.length).toBeGreaterThan(0);
      expect(dueActions[0].id).toBe('conditional-check-1');
    });

    it('should store and retrieve condition evaluation', () => {
      const evaluation: ConditionEvaluation = {
        conditionId: 'cond-1',
        type: ConditionType.ACCOUNT_ACTIVE,
        satisfied: true,
        evaluatedAt: new Date(),
        message: 'All conditions satisfied',
      };

      // Insert a dummy action first (foreign key)
      const action: ConditionalAction = {
        id: 'eval-action',
        agentName: 'test-agent',
        actionType: ActionType.POST,
        priority: Priority.NORMAL,
        payload: {},
        status: ActionStatus.SCHEDULED,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        conditionCheckInterval: 60,
      };
      db.insertAction(action);

      db.storeConditionEvaluation('eval-action', evaluation);

      const evaluations = db.getConditionEvaluations('eval-action');
      expect(evaluations).toHaveLength(1);
      expect(evaluations[0].satisfied).toBe(true);
      expect(evaluations[0].message).toBe('All conditions satisfied');
    });
  });
});
