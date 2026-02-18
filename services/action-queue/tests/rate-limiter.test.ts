import { DatabaseManager } from '../src/database';
import { RateLimiter } from '../src/rate-limiter';
import { ActionType, ActionStatus, Priority, QueuedAction } from '../src/types';

function makeAction(
  agentName: string,
  actionType: ActionType,
  overrides: Partial<QueuedAction> = {},
): QueuedAction {
  return {
    id: `${agentName}-${actionType}-${Date.now()}`,
    agentName,
    actionType,
    priority: Priority.NORMAL,
    payload: {},
    status: ActionStatus.PENDING,
    createdAt: new Date(),
    attempts: 0,
    maxAttempts: 3,
    ...overrides,
  };
}

describe('RateLimiter', () => {
  let db: DatabaseManager;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    db = new DatabaseManager(':memory:');
    rateLimiter = new RateLimiter(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Interval Rate Limiting', () => {
    it('should allow action within rate limit', async () => {
      const result = await rateLimiter.isAllowed(
        makeAction('test-agent', ActionType.POST),
      );
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block action exceeding interval rate limit', async () => {
      // Posts: 1 per 30 minutes (1800 seconds)
      const agentName = 'test-agent';

      // First post should be allowed
      const first = await rateLimiter.isAllowed(
        makeAction(agentName, ActionType.POST),
      );
      expect(first.allowed).toBe(true);

      // Record the action
      rateLimiter.recordAction(makeAction(agentName, ActionType.POST));

      // Second post should be blocked (same 30min window)
      const second = await rateLimiter.isAllowed(
        makeAction(agentName, ActionType.POST),
      );
      expect(second.allowed).toBe(false);
      expect(second.reason).toBeDefined();
    });

    it('should report current rate limit status after recording', () => {
      const agentName = 'test-agent';

      rateLimiter.recordAction(makeAction(agentName, ActionType.POST));

      const status = rateLimiter.getStatus(agentName);
      const postStatus = status.limits[ActionType.POST];
      expect(postStatus).toBeDefined();
      expect(postStatus.current?.count).toBe(1);
      expect(postStatus.config.maxPerInterval).toBe(1);
      expect(postStatus.config.intervalSeconds).toBe(1800); // 30 minutes
    });
  });

  describe('Daily Rate Limiting', () => {
    it('should track daily count', () => {
      const agentName = 'test-agent';

      rateLimiter.recordAction(makeAction(agentName, ActionType.COMMENT));

      const status = rateLimiter.getStatus(agentName);
      expect(status.limits[ActionType.COMMENT].current?.dailyCount).toBe(1);
    });

    it('should block when daily limit exceeded', async () => {
      const agentName = 'test-agent';

      // Comments: dailyMax=50 for established agents
      for (let i = 0; i < 50; i++) {
        rateLimiter.recordAction(makeAction(agentName, ActionType.COMMENT));
      }

      const result = await rateLimiter.isAllowed(
        makeAction(agentName, ActionType.COMMENT),
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('Agent Status', () => {
    it('should report new agent status correctly', () => {
      const newAgent = 'new-agent';
      db.upsertAgent(newAgent, true);

      const status = rateLimiter.getStatus(newAgent);
      expect(status.isNewAgent).toBe(true);
    });

    it('should report established agent status correctly', () => {
      const agentName = 'established-agent';
      // Not registered as new → isNewAgent=false
      const status = rateLimiter.getStatus(agentName);
      expect(status.isNewAgent).toBe(false);
    });

    it('should block DMs for new agents', async () => {
      const newAgent = 'new-agent';
      db.upsertAgent(newAgent, true);

      const result = await rateLimiter.isAllowed(
        makeAction(newAgent, ActionType.SEND_DM),
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('Independent Action Type Tracking', () => {
    it('should track different action types independently', async () => {
      const agentName = 'test-agent';

      rateLimiter.recordAction(makeAction(agentName, ActionType.POST));

      // Comment should still be allowed (different rate limit window)
      const commentAllowed = await rateLimiter.isAllowed(
        makeAction(agentName, ActionType.COMMENT),
      );
      expect(commentAllowed.allowed).toBe(true);

      // Follow should still be allowed
      const followAllowed = await rateLimiter.isAllowed(
        makeAction(agentName, ActionType.FOLLOW),
      );
      expect(followAllowed.allowed).toBe(true);
    });

    it('should not affect other action types when one is blocked', async () => {
      const agentName = 'test-agent';

      rateLimiter.recordAction(makeAction(agentName, ActionType.POST));

      const postBlocked = await rateLimiter.isAllowed(
        makeAction(agentName, ActionType.POST),
      );
      expect(postBlocked.allowed).toBe(false);

      const commentAllowed = await rateLimiter.isAllowed(
        makeAction(agentName, ActionType.COMMENT),
      );
      expect(commentAllowed.allowed).toBe(true);
    });
  });

  describe('Rate Limit Status', () => {
    it('should return comprehensive status', () => {
      const agentName = 'test-agent';

      rateLimiter.recordAction(makeAction(agentName, ActionType.POST));
      rateLimiter.recordAction(makeAction(agentName, ActionType.COMMENT));

      const status = rateLimiter.getStatus(agentName);

      expect(status.agentName).toBe(agentName);
      expect(status.isNewAgent).toBe(false);
      expect(status.limits).toBeDefined();
      expect(Object.keys(status.limits).length).toBeGreaterThan(0);
    });
  });
});
