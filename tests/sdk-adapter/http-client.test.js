/**
 * HttpClient tests
 */

const { HttpClient } = require('../../services/moltbook-sdk-adapter/HttpClient');
const {
  AuthenticationError,
} = require('../../services/moltbook-sdk-adapter/utils/errors');

describe('HttpClient', () => {
  let client;

  beforeEach(() => {
    client = new HttpClient({
      apiKey: 'test_api_key',
      baseUrl: 'https://test.moltbook.com/api/v1',
      retries: 1,
    });
  });

  describe('constructor', () => {
    it('should throw AuthenticationError if no API key provided', () => {
      expect(() => {
        new HttpClient({ apiKey: '' });
      }).toThrow(AuthenticationError);
    });

    it('should accept API key from options', () => {
      const testClient = new HttpClient({ apiKey: 'test_key' });
      expect(testClient.apiKey).toBe('test_key');
    });

    it('should use default values', () => {
      const testClient = new HttpClient({ apiKey: 'test_key' });
      expect(testClient.timeout).toBe(30000);
      expect(testClient.retries).toBe(3);
    });
  });

  describe('rate limit tracking', () => {
    it('should initialize rate limit info', () => {
      expect(client.rateLimitInfo).toHaveProperty('limit');
      expect(client.rateLimitInfo).toHaveProperty('remaining');
      expect(client.rateLimitInfo).toHaveProperty('reset');
    });

    it('should expose getRateLimitInfo method', () => {
      expect(typeof client.getRateLimitInfo).toBe('function');
    });

    it('should expose isRateLimited method', () => {
      expect(typeof client.isRateLimited).toBe('function');
    });
  });

  describe('HTTP methods', () => {
    it('should have get method', () => {
      expect(typeof client.get).toBe('function');
    });

    it('should have post method', () => {
      expect(typeof client.post).toBe('function');
    });

    it('should have patch method', () => {
      expect(typeof client.patch).toBe('function');
    });

    it('should have delete method', () => {
      expect(typeof client.delete).toBe('function');
    });
  });
});
