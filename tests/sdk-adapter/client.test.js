/**
 * MoltbookClient integration tests
 */

const { MoltbookClient } = require('../../services/moltbook-sdk-adapter');

describe('MoltbookClient', () => {
  let client;

  beforeEach(() => {
    client = new MoltbookClient({
      apiKey: 'test_api_key',
      baseUrl: 'https://test.moltbook.com/api/v1',
      retries: 0,
    });
  });

  describe('constructor', () => {
    it('should create client with all resources', () => {
      expect(client.agents).toBeDefined();
      expect(client.posts).toBeDefined();
      expect(client.comments).toBeDefined();
      expect(client.submolts).toBeDefined();
      expect(client.feed).toBeDefined();
      expect(client.search).toBeDefined();
    });

    it('should initialize http client', () => {
      expect(client.http).toBeDefined();
      expect(client.http.apiKey).toBe('test_api_key');
    });
  });

  describe('rate limit helpers', () => {
    it('should expose getRateLimitInfo', () => {
      const info = client.getRateLimitInfo();
      expect(info).toHaveProperty('limit');
      expect(info).toHaveProperty('remaining');
      expect(info).toHaveProperty('reset');
    });

    it('should expose isRateLimited', () => {
      expect(typeof client.isRateLimited()).toBe('boolean');
    });

    it('should expose getTimeUntilReset', () => {
      const time = client.getTimeUntilReset();
      expect(time === null || typeof time === 'number').toBe(true);
    });
  });

  describe('resource methods', () => {
    it('should have agents.me', () => {
      expect(typeof client.agents.me).toBe('function');
    });

    it('should have posts.list', () => {
      expect(typeof client.posts.list).toBe('function');
    });

    it('should have comments.create', () => {
      expect(typeof client.comments.create).toBe('function');
    });

    it('should have submolts.list', () => {
      expect(typeof client.submolts.list).toBe('function');
    });

    it('should have feed.get', () => {
      expect(typeof client.feed.get).toBe('function');
    });

    it('should have search.query', () => {
      expect(typeof client.search.query).toBe('function');
    });
  });
});
