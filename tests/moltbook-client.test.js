/**
 * Tests for Moltbook API Client
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');
const { MoltbookClient, MoltbookAuth } = require('../services/moltbook-client');

// Mock fetch globally
global.fetch = jest.fn();

describe('MoltbookClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set valid API key for tests (64 hex chars = 32 bytes)
    process.env.MOLTBOOK_API_KEY =
      'moltbook_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  describe('Constructor', () => {
    test('should create client with valid API key', () => {
      const client = new MoltbookClient();
      expect(client.apiKey).toBe(
        'moltbook_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      );
      expect(client.baseUrl).toBe('https://www.moltbook.com/api/v1');
    });

    test('should throw error if API key missing', () => {
      delete process.env.MOLTBOOK_API_KEY;
      expect(() => new MoltbookClient()).toThrow('MOLTBOOK_API_KEY is required');
    });

    test('should throw error if API key format invalid', () => {
      expect(() => new MoltbookClient({ apiKey: 'invalid_key' })).toThrow(
        'Invalid API key format'
      );
    });

    test('should accept custom baseUrl', () => {
      const client = new MoltbookClient({
        baseUrl: 'https://test.example.com/api',
      });
      expect(client.baseUrl).toBe('https://test.example.com/api');
    });
  });

  describe('Request Methods', () => {
    let client;

    beforeEach(() => {
      client = new MoltbookClient();
      global.fetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true }),
      });
    });

    test('GET request should include Authorization header', async () => {
      await client.get('/agents/me');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.moltbook.com/api/v1/agents/me',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization:
              'Bearer moltbook_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          }),
        })
      );
    });

    test('POST request should send body', async () => {
      await client.post('/posts', { content: 'Test post' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.moltbook.com/api/v1/posts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'Test post' }),
        })
      );
    });

    test('should handle API errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(client.get('/agents/me')).rejects.toThrow(
        'Moltbook API error (401)'
      );
    });
  });

  describe('Agent Operations', () => {
    let client;

    beforeEach(() => {
      client = new MoltbookClient();
      global.fetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true }),
      });
    });

    test('getMe should call /agents/me', async () => {
      await client.getMe();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.moltbook.com/api/v1/agents/me',
        expect.any(Object)
      );
    });

    test('updateProfile should PATCH profile data', async () => {
      await client.updateProfile({ description: 'Updated' });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.moltbook.com/api/v1/agents/me',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ description: 'Updated' }),
        })
      );
    });

    test('getStatus should call /agents/status', async () => {
      await client.getStatus();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.moltbook.com/api/v1/agents/status',
        expect.any(Object)
      );
    });
  });

  describe('Post Operations', () => {
    let client;

    beforeEach(() => {
      client = new MoltbookClient();
      global.fetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true }),
      });
    });

    test('createPost should POST post data', async () => {
      await client.createPost({ content: 'Hello world' });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.moltbook.com/api/v1/posts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'Hello world' }),
        })
      );
    });

    test('getPost should fetch specific post', async () => {
      await client.getPost('abc123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.moltbook.com/api/v1/posts/abc123',
        expect.any(Object)
      );
    });
  });

  describe('Verification Challenge Operations', () => {
    let client;

    beforeEach(() => {
      client = new MoltbookClient();
      global.fetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true }),
      });
    });

    test('submitVerificationAnswer should POST challenge response', async () => {
      await client.submitVerificationAnswer('challenge-123', 'VERIFIED');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.moltbook.com/api/v1/agents/me/verification-challenges',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            challenge_id: 'challenge-123',
            answer: 'VERIFIED',
          }),
        })
      );
    });

    test('getPendingChallenges should GET challenges', async () => {
      await client.getPendingChallenges();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.moltbook.com/api/v1/agents/me/verification-challenges',
        expect.any(Object)
      );
    });
  });
});

describe('MoltbookAuth Integration', () => {
  test('should validate token format', () => {
    const auth = new MoltbookAuth();
    // Valid API key: 64 hex chars (32 bytes)
    expect(
      auth.validateToken(
        'moltbook_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      )
    ).toBe(true);
    expect(auth.validateToken('moltbook_short')).toBe(false);
    expect(auth.validateToken('invalid')).toBe(false);
  });

  test('should generate valid API key', () => {
    const auth = new MoltbookAuth();
    const apiKey = auth.generateApiKey();
    expect(apiKey).toMatch(/^moltbook_[a-f0-9]+$/);
  });

  test('should extract token from Authorization header', () => {
    const auth = new MoltbookAuth();
    const token = auth.extractToken(
      'Bearer moltbook_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    );
    expect(token).toBe(
      'moltbook_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    );
  });
});
