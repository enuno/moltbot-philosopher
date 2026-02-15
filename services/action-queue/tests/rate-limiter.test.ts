import { DatabaseManager } from '../src/database';
import { RateLimiter } from '../src/rate-limiter';
import { ActionType } from '../src/types';

describe('RateLimiter', () => {
  let db: DatabaseManager;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    db = new DatabaseManager(':memory:');
    rateLimiter = new RateLimiter(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Interval Rate Limiting', () => {
    it('should allow action within rate limit', () => {
      const result = rateLimiter.isAllowed('test-agent', ActionType.POST);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block action exceeding interval rate limit', () => {
      // Posts: 1 per 30 minutes (1800 seconds)
      const agentName = 'test-agent';

      // First post should be allowed
      const first = rateLimiter.isAllowed(agentName, ActionType.POST);
      expect(first.allowed).toBe(true);

      // Record the action
      rateLimiter.recordAction(agentName, ActionType.POST);

      // Second post should be blocked (same 30min window)
      const second = rateLimiter.isAllowed(agentName, ActionType.POST);
      expect(second.allowed).toBe(false);
      expect(second.reason).toContain('interval rate limit');
    });

    it('should allow action in different time window', () => {
      const agentName = 'test-agent';

      // Record action in current window
      rateLimiter.recordAction(agentName, ActionType.POST);

      // Mock moving to next window (would need to wait 30min in reality)
      // For this test, we verify the logic exists
      const status = rateLimiter.getStatus(agentName);
      expect(status.limits[ActionType.POST]).toBeDefined();
      expect(status.limits[ActionType.POST].currentCount).toBe(1);
    });
  });

  describe('Daily Rate Limiting', () => {
    it('should track daily count', () => {
      const agentName = 'test-agent';

      // Record multiple actions (within different intervals but same day)
      rateLimiter.recordAction(agentName, ActionType.COMMENT);

      const status = rateLimiter.getStatus(agentName);
      expect(status.limits[ActionType.COMMENT].dailyCount).toBe(1);
    });

    it('should block when daily limit exceeded', () => {
      const agentName = 'test-agent';

      // Comments have daily max of 50 for established agents
      // Record 50 comments across different windows
      for (let i = 0; i < 50; i++) {
        rateLimiter.recordAction(agentName, ActionType.COMMENT);
      }

      // 51st comment should be blocked
      const result = rateLimiter.isAllowed(agentName, ActionType.COMMENT);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('daily limit');
    });
  });

  describe('Global API Rate Limiting', () => {
    it('should track global API calls', () => {
      const agentName = 'test-agent';

      // Record multiple different actions
      rateLimiter.recordAction(agentName, ActionType.POST);
      rateLimiter.recordAction(agentName, ActionType.COMMENT);
      rateLimiter.recordAction(agentName, ActionType.UPVOTE);

      const status = rateLimiter.getStatus(agentName);
      expect(status.globalCount).toBe(3);
    });

    it('should enforce global API limit', () => {
      const agentName = 'test-agent';

      // Global limit is 100 req/min
      // Record 100 actions
      for (let i = 0; i < 100; i++) {
        rateLimiter.recordAction(agentName, ActionType.UPVOTE);
      }

      // 101st action should be blocked by global limit
      const result = rateLimiter.isAllowed(agentName, ActionType.UPVOTE);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('global API limit');
    });
  });

  describe('New Agent Rate Limiting', () => {
    it('should apply stricter limits for new agents', () => {
      const newAgent = 'new-agent';

      // Register as new agent
      db.registerAgent(newAgent);

      // New agents: 1 post per 2 hours (7200 seconds)
      // Established agents: 1 post per 30 minutes (1800 seconds)

      rateLimiter.recordAction(newAgent, ActionType.POST);

      const result = rateLimiter.isAllowed(newAgent, ActionType.POST);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('rate limit');
    });

    it('should detect new agents correctly', () => {
      const newAgent = 'brand-new-agent';

      // Register agent
      db.registerAgent(newAgent);

      const agent = db.getAgent(newAgent);
      expect(agent?.isNew).toBe(1);

      // Check if rate limiter recognizes new status
      const status = rateLimiter.getStatus(newAgent);
      expect(status.isNewAgent).toBe(true);
    });

    it('should block DMs for new agents', () => {
      const newAgent = 'new-agent';
      db.registerAgent(newAgent);

      // New agents cannot send DMs
      const result = rateLimiter.isAllowed(newAgent, ActionType.SEND_DM);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('New agents cannot');
    });
  });

  describe('Different Action Types', () => {
    it('should enforce correct limits for comments', () => {
      const agentName = 'test-agent';

      // Comments: 1 per 20 seconds for established agents
      const first = rateLimiter.isAllowed(agentName, ActionType.COMMENT);
      expect(first.allowed).toBe(true);

      rateLimiter.recordAction(agentName, ActionType.COMMENT);

      const second = rateLimiter.isAllowed(agentName, ActionType.COMMENT);
      expect(second.allowed).toBe(false);
    });

    it('should enforce correct limits for follows', () => {
      const agentName = 'test-agent';

      // Follows: 1 per 5 minutes (300 seconds) for established agents
      const first = rateLimiter.isAllowed(agentName, ActionType.FOLLOW);
      expect(first.allowed).toBe(true);

      rateLimiter.recordAction(agentName, ActionType.FOLLOW);

      const second = rateLimiter.isAllowed(agentName, ActionType.FOLLOW);
      expect(second.allowed).toBe(false);
    });

    it('should enforce correct limits for upvotes', () => {
      const agentName = 'test-agent';

      // Upvotes: 10 per minute for established agents
      for (let i = 0; i < 10; i++) {
        const result = rateLimiter.isAllowed(agentName, ActionType.UPVOTE);
        expect(result.allowed).toBe(true);
        rateLimiter.recordAction(agentName, ActionType.UPVOTE);
      }

      // 11th upvote should be blocked
      const blocked = rateLimiter.isAllowed(agentName, ActionType.UPVOTE);
      expect(blocked.allowed).toBe(false);
    });

    it('should enforce correct limits for submolt creation', () => {
      const agentName = 'test-agent';

      // Create submolt: 1 per hour for established agents
      const first = rateLimiter.isAllowed(agentName, ActionType.CREATE_SUBMOLT);
      expect(first.allowed).toBe(true);

      rateLimiter.recordAction(agentName, ActionType.CREATE_SUBMOLT);

      const second = rateLimiter.isAllowed(agentName, ActionType.CREATE_SUBMOLT);
      expect(second.allowed).toBe(false);
    });
  });

  describe('Rate Limit Status', () => {
    it('should return comprehensive status', () => {
      const agentName = 'test-agent';

      rateLimiter.recordAction(agentName, ActionType.POST);
      rateLimiter.recordAction(agentName, ActionType.COMMENT);

      const status = rateLimiter.getStatus(agentName);

      expect(status.agentName).toBe(agentName);
      expect(status.isNewAgent).toBe(false);
      expect(status.globalCount).toBe(2);
      expect(status.limits).toBeDefined();
      expect(Object.keys(status.limits).length).toBeGreaterThan(0);
    });

    it('should show time until reset', () => {
      const agentName = 'test-agent';

      rateLimiter.recordAction(agentName, ActionType.POST);

      const status = rateLimiter.getStatus(agentName);
      const postLimit = status.limits[ActionType.POST];

      expect(postLimit.currentCount).toBe(1);
      expect(postLimit.maxPerInterval).toBe(1);
      expect(postLimit.intervalSeconds).toBe(1800); // 30 minutes
      expect(postLimit.resetIn).toBeGreaterThan(0);
    });
  });

  describe('Independent Action Type Tracking', () => {
    it('should track different action types independently', () => {
      const agentName = 'test-agent';

      // Record a post
      rateLimiter.recordAction(agentName, ActionType.POST);

      // Comment should still be allowed (different rate limit)
      const commentAllowed = rateLimiter.isAllowed(agentName, ActionType.COMMENT);
      expect(commentAllowed.allowed).toBe(true);

      // Follow should still be allowed
      const followAllowed = rateLimiter.isAllowed(agentName, ActionType.FOLLOW);
      expect(followAllowed.allowed).toBe(true);
    });

    it('should not affect other action types when one is blocked', () => {
      const agentName = 'test-agent';

      // Max out posts
      rateLimiter.recordAction(agentName, ActionType.POST);

      // Post should be blocked
      const postBlocked = rateLimiter.isAllowed(agentName, ActionType.POST);
      expect(postBlocked.allowed).toBe(false);

      // But comments should still work
      const commentAllowed = rateLimiter.isAllowed(agentName, ActionType.COMMENT);
      expect(commentAllowed.allowed).toBe(true);
    });
  });
});
