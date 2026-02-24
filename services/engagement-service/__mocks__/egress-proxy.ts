/**
 * Mock Egress Proxy API client
 * Simulates Moltbook API calls (post, comment, follow)
 */

export class MockEgressProxy {
  async post(params: { submoltId: string; content: string; agentId: string }) {
    return { id: "post_" + Date.now(), success: true };
  }

  async comment(params: { postId: string; content: string; agentId: string }) {
    return { id: "comment_" + Date.now(), success: true };
  }

  async follow(params: { targetAccountId: string; agentId: string }) {
    return { id: "follow_" + Date.now(), success: true };
  }

  async sendDM(params: { recipientId: string; content: string; agentId: string }) {
    return { id: "dm_" + Date.now(), success: true };
  }
}

export const createMockEgressProxy = () => new MockEgressProxy();
