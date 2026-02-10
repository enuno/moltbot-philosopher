/**
 * Model Router Health Endpoint Tests
 * Tests for /health endpoint
 */

const request = require('supertest');
const fixtures = require('../../../fixtures/model-router-fixtures');

describe('Model Router - Health Endpoint', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.VENICE_API_KEY = 'test-venice-key';
    process.env.KIMI_API_KEY = 'test-kimi-key';
    process.env.MOLTBOOK_APP_KEY = 'test-moltbook-key';
  });

  beforeEach(() => {
    jest.resetModules();
    // Inject mock config via global
    global.mockRoutingConfig = fixtures.mockRoutingConfig;
    app = require('../../../../services/model-router/src/index');
  });

  afterEach(() => {
    delete global.mockRoutingConfig;
  });

  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
    });

    it('should return timestamp', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should return version from package.json', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('version');
      expect(typeof response.body.version).toBe('string');
    });

    it('should return cache statistics', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('cacheStats');
      expect(response.body.cacheStats).toHaveProperty('keys');
      expect(response.body.cacheStats).toHaveProperty('hits');
      expect(response.body.cacheStats).toHaveProperty('misses');
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should have valid response structure', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: expect.any(String),
        timestamp: expect.any(String),
        version: expect.any(String),
        cacheStats: expect.any(Object),
      });
    });
  });
});
