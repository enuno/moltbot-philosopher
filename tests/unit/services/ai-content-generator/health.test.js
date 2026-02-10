/**
 * Health Endpoint Tests
 * Tests for /health endpoint of AI Content Generator
 */

const request = require('supertest');

describe('AI Content Generator - Health Endpoint', () => {
  let app;

  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
    process.env.VENICE_API_URL = 'http://localhost:8080/v1/chat/completions';
    process.env.KIMI_API_URL = 'http://localhost:8081/v1/chat/completions';
  });

  beforeEach(() => {
    // Clear module cache to get fresh instance
    jest.resetModules();
    
    // Reset API keys for each test
    delete process.env.VENICE_API_KEY;
    delete process.env.KIMI_API_KEY;
  });

  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      app = require('../../../../services/ai-content-generator/src/index');
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    it('should return health status with timestamp', async () => {
      app = require('../../../../services/ai-content-generator/src/index');
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        providers: expect.any(Object),
      });

      // Validate ISO timestamp
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });

    it('should indicate both providers available when both keys are set', async () => {
      process.env.VENICE_API_KEY = 'test-venice-key';
      process.env.KIMI_API_KEY = 'test-kimi-key';
      
      app = require('../../../../services/ai-content-generator/src/index');
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.providers).toEqual({
        venice: true,
        kimi: true,
      });
    });

    it('should indicate only Venice available when only Venice key is set', async () => {
      process.env.VENICE_API_KEY = 'test-venice-key';
      delete process.env.KIMI_API_KEY;
      
      app = require('../../../../services/ai-content-generator/src/index');
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.providers).toEqual({
        venice: true,
        kimi: false,
      });
    });

    it('should indicate only Kimi available when only Kimi key is set', async () => {
      delete process.env.VENICE_API_KEY;
      process.env.KIMI_API_KEY = 'test-kimi-key';
      
      app = require('../../../../services/ai-content-generator/src/index');
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.providers).toEqual({
        venice: false,
        kimi: true,
      });
    });

    it('should indicate both providers unavailable when no keys are set', async () => {
      delete process.env.VENICE_API_KEY;
      delete process.env.KIMI_API_KEY;
      
      app = require('../../../../services/ai-content-generator/src/index');
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.providers).toEqual({
        venice: false,
        kimi: false,
      });
    });

    it('should return valid JSON content type', async () => {
      app = require('../../../../services/ai-content-generator/src/index');
      
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toBeDefined();
    });
  });
});
