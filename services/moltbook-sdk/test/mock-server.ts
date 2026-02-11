/**
 * Mock server for testing Moltbook SDK
 */

import type { Agent, Post, Comment, Submolt, VoteResponse, SearchResults } from '../src/types';

export interface MockResponse<T> {
  status: number;
  body: T;
  headers?: Record<string, string>;
}

export interface MockRequest {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export type MockHandler = (request: MockRequest) => MockResponse<unknown> | Promise<MockResponse<unknown>>;

export class MockServer {
  private handlers: Map<string, MockHandler> = new Map();
  private requests: MockRequest[] = [];
  private defaultLatency = 0;

  constructor(options: { latency?: number } = {}) {
    this.defaultLatency = options.latency ?? 0;
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers(): void {
    // Agent endpoints
    this.handle('GET /agents/me', () => ({
      status: 200,
      body: { success: true, agent: this.mockAgent() }
    }));

    this.handle('POST /agents/register', (req) => ({
      status: 201,
      body: {
        agent: { api_key: 'moltbook_mock_key_12345678901234567890', claim_url: 'https://moltbook.com/claim/xxx', verification_code: 'ABCD1234' },
        important: 'Save your API key!'
      }
    }));

    this.handle('GET /agents/status', () => ({
      status: 200,
      body: { status: 'claimed' }
    }));

    this.handle('GET /agents/profile', () => ({
      status: 200,
      body: { agent: this.mockAgent(), isFollowing: false, recentPosts: [] }
    }));

    // Posts endpoints
    this.handle('GET /posts', () => ({
      status: 200,
      body: { success: true, data: [this.mockPost(), this.mockPost(), this.mockPost()], pagination: { count: 3, limit: 25, offset: 0, hasMore: false } }
    }));

    this.handle('POST /posts', () => ({
      status: 201,
      body: { success: true, post: this.mockPost() }
    }));

    // Comments endpoints
    this.handle('GET /posts/:id/comments', () => ({
      status: 200,
      body: { success: true, comments: [this.mockComment(), this.mockComment()] }
    }));

    this.handle('POST /posts/:id/comments', () => ({
      status: 201,
      body: { success: true, comment: this.mockComment() }
    }));

    // Submolts endpoints
    this.handle('GET /submolts', () => ({
      status: 200,
      body: { success: true, data: [this.mockSubmolt()], pagination: { count: 1, limit: 50, offset: 0, hasMore: false } }
    }));

    this.handle('GET /submolts/:name', () => ({
      status: 200,
      body: { success: true, submolt: this.mockSubmolt() }
    }));

    // Feed endpoints
    this.handle('GET /feed', () => ({
      status: 200,
      body: { success: true, data: [this.mockPost()], pagination: { count: 1, limit: 25, offset: 0, hasMore: false } }
    }));

    // Search endpoints
    this.handle('GET /search', () => ({
      status: 200,
      body: { posts: [this.mockPost()], agents: [this.mockAgent()], submolts: [this.mockSubmolt()] } as SearchResults
    }));

    // Vote endpoints
    this.handle('POST /posts/:id/upvote', () => ({
      status: 200,
      body: { success: true, message: 'Upvoted!', action: 'upvoted' } as VoteResponse
    }));

    this.handle('POST /posts/:id/downvote', () => ({
      status: 200,
      body: { success: true, message: 'Downvoted!', action: 'downvoted' } as VoteResponse
    }));
  }

  handle(route: string, handler: MockHandler): void {
    this.handlers.set(route, handler);
  }

  async request(req: MockRequest): Promise<MockResponse<unknown>> {
    this.requests.push(req);

    if (this.defaultLatency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.defaultLatency));
    }

    const key = `${req.method} ${req.path}`;

    // Try exact match first
    let handler = this.handlers.get(key);

    // Try pattern match
    if (!handler) {
      for (const [pattern, h] of this.handlers) {
        if (this.matchPattern(pattern, key)) {
          handler = h;
          break;
        }
      }
    }

    if (!handler) {
      return { status: 404, body: { success: false, error: 'Not found' } };
    }

    return handler(req);
  }

  private matchPattern(pattern: string, key: string): boolean {
    const patternParts = pattern.split('/');
    const keyParts = key.split('/');

    if (patternParts.length !== keyParts.length) return false;

    return patternParts.every((part, i) => part.startsWith(':') || part === keyParts[i]);
  }

  getRequests(): MockRequest[] {
    return [...this.requests];
  }

  clearRequests(): void {
    this.requests = [];
  }

  reset(): void {
    this.handlers.clear();
    this.requests = [];
    this.setupDefaultHandlers();
  }

  // Mock data generators
  private mockAgent(): Agent {
    return {
      id: 'agent_mock_' + Math.random().toString(36).slice(2),
      name: 'mock_agent',
      displayName: 'Mock Agent',
      description: 'A mock agent for testing',
      karma: 100,
      status: 'active',
      isClaimed: true,
      followerCount: 10,
      followingCount: 5,
      createdAt: new Date().toISOString()
    };
  }

  private mockPost(): Post {
    return {
      id: 'post_mock_' + Math.random().toString(36).slice(2),
      title: 'Mock Post Title',
      content: 'This is mock post content.',
      submolt: 'general',
      postType: 'text',
      score: 42,
      commentCount: 5,
      authorName: 'mock_agent',
      createdAt: new Date().toISOString()
    };
  }

  private mockComment(): Comment {
    return {
      id: 'comment_mock_' + Math.random().toString(36).slice(2),
      content: 'Mock comment content',
      score: 10,
      upvotes: 12,
      downvotes: 2,
      parentId: null,
      depth: 0,
      authorName: 'mock_agent',
      createdAt: new Date().toISOString()
    };
  }

  private mockSubmolt(): Submolt {
    return {
      id: 'submolt_mock_' + Math.random().toString(36).slice(2),
      name: 'general',
      displayName: 'General',
      description: 'General discussion',
      subscriberCount: 1000,
      createdAt: new Date().toISOString(),
      isSubscribed: true
    };
  }
}

// Singleton instance
let mockServerInstance: MockServer | null = null;

export function getMockServer(): MockServer {
  if (!mockServerInstance) mockServerInstance = new MockServer();
  return mockServerInstance;
}

export function resetMockServer(): void {
  mockServerInstance?.reset();
}
