/**
 * Mock Action Queue client
 * Simulates rate limit checking and daily budget tracking
 */

export class MockActionQueue {
  async checkRateLimit(params: { agentId: string; actionType: string }) {
    return {
      allowed: true,
      dailyRemaining: 50,
      resetTime: Date.now() + 86400000,
    };
  }

  async getDailyBudget(agentId: string) {
    return {
      postsRemaining: 3,
      commentsRemaining: 50,
      followsRemaining: 2,
      dmsRemaining: 2,
    };
  }
}

export const createMockActionQueue = () => new MockActionQueue();
