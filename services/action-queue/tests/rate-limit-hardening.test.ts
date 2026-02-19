import { RateLimiter } from '../src/rate-limiter';
import { DatabaseManager } from '../src/database';
import { ActionType, ActionStatus, Priority, QueuedAction } from '../src/types';

function makeAction(overrides: Partial<QueuedAction> = {}): QueuedAction {
  return {
    id: 'test-action-1',
    agentName: 'test-agent',
    actionType: ActionType.POST,
    priority: Priority.NORMAL,
    payload: { content: 'Test', title: 'Test' },
    status: ActionStatus.PENDING,
    createdAt: new Date(),
    attempts: 0,
    maxAttempts: 3,
    ...overrides,
  };
}

describe('RateLimiter - syncFromApiResponse (7.1)', () => {
  let db: DatabaseManager;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    db = new DatabaseManager(':memory:');
    rateLimiter = new RateLimiter(db);
  });

  afterEach(() => {
    db.close();
  });

  it('syncFromApiResponse(0) blocks further post actions until next midnight', async () => {
    const action = makeAction({ actionType: ActionType.POST });

    // Initially allowed
    const before = await rateLimiter.isAllowed(action);
    expect(before.allowed).toBe(true);

    // API reports 0 remaining
    rateLimiter.syncFromApiResponse('test-agent', ActionType.POST, 0);

    // Now blocked
    const after = await rateLimiter.isAllowed(action);
    expect(after.allowed).toBe(false);
    expect(after.reason).toMatch(/daily limit reached/i);
    expect(after.retryAfter).toBeGreaterThan(0);
  });

  it('syncFromApiResponse with non-zero remaining does not block', async () => {
    const action = makeAction({ actionType: ActionType.COMMENT });

    rateLimiter.syncFromApiResponse('test-agent', ActionType.COMMENT, 5);

    const check = await rateLimiter.isAllowed(action);
    expect(check.allowed).toBe(true);
  });

  it('block is per-agent and per-action-type', async () => {
    const postAction = makeAction({ actionType: ActionType.POST });
    const commentAction = makeAction({ actionType: ActionType.COMMENT });

    // Block posts for test-agent
    rateLimiter.syncFromApiResponse('test-agent', ActionType.POST, 0);

    // Posts blocked
    const postCheck = await rateLimiter.isAllowed(postAction);
    expect(postCheck.allowed).toBe(false);

    // Comments still allowed
    const commentCheck = await rateLimiter.isAllowed(commentAction);
    expect(commentCheck.allowed).toBe(true);
  });

  it('block is per-agent - other agents not affected', async () => {
    const agentAAction = makeAction({ agentName: 'agent-a', actionType: ActionType.POST });
    const agentBAction = makeAction({ agentName: 'agent-b', actionType: ActionType.POST });

    rateLimiter.syncFromApiResponse('agent-a', ActionType.POST, 0);

    const aCheck = await rateLimiter.isAllowed(agentAAction);
    expect(aCheck.allowed).toBe(false);

    const bCheck = await rateLimiter.isAllowed(agentBAction);
    expect(bCheck.allowed).toBe(true);
  });
});
