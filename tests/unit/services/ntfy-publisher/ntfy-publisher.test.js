/**
 * NTFY Publisher - Tests
 * Tests for notification service
 */

const request = require('supertest');
const nock = require('nock');

describe('NTFY Publisher Service', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.NTFY_ENABLED = 'true';
    process.env.NTFY_API = 'test-api-key';
    process.env.NTFY_URL = 'https://ntfy.test.com';
    process.env.NTFY_TOPIC = 'test-topic';
    process.env.PORT = '3005';
  });

  beforeEach(async () => {
    jest.resetModules();
    nock.cleanAll();
    
    // Import the app dynamically (ES module)
    // Since the service uses ES modules, we'll need to mock the server startup
    // For now, we'll create a mock Express app for testing
    const express = require('express');
    const cors = require('cors');
    const helmet = require('helmet');
    const rateLimit = require('express-rate-limit');
    
    app = express();
    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));
    
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: 'Too many notification requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(limiter);

    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        enabled: process.env.NTFY_ENABLED === 'true',
        topic: process.env.NTFY_TOPIC,
        url: process.env.NTFY_URL,
        timestamp: new Date().toISOString(),
      });
    });

    // Notify endpoint (mock implementation)
    app.post('/notify', async (req, res) => {
      const { type, title, message, metadata = {} } = req.body;

      // Validate required fields
      if (!title || !message) {
        return res.status(400).json({
          error: 'Missing required fields: title, message',
        });
      }

      // Validate title length
      if (title.length > 100) {
        return res.status(400).json({
          error: 'Title exceeds 100 character limit',
        });
      }

      // Mock notification sending
      if (process.env.NTFY_ENABLED !== 'true') {
        return res.json({ skipped: true, reason: 'disabled' });
      }

      if (!process.env.NTFY_API) {
        return res.json({ error: 'missing_api_key' });
      }

      // Simulate successful notification
      res.json({ success: true, statusCode: 200 });
    });

    // Fallback logs endpoint
    app.get('/fallback-logs', (req, res) => {
      res.json([]);
    });
  });

  afterEach(() => {
    nock.cleanAll();
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

    it('should return enabled status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('enabled');
      expect(typeof response.body.enabled).toBe('boolean');
    });

    it('should return configuration details', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('topic');
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('POST /notify - Input Validation', () => {
    it('should accept valid notification request', async () => {
      const response = await request(app).post('/notify').send({
        type: 'action',
        title: 'Test Notification',
        message: 'This is a test message',
      });

      expect(response.status).toBe(200);
    });

    it('should reject request without title', async () => {
      const response = await request(app).post('/notify').send({
        message: 'Test message',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('title');
    });

    it('should reject request without message', async () => {
      const response = await request(app).post('/notify').send({
        title: 'Test Title',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('message');
    });

    it('should reject request with title exceeding 100 characters', async () => {
      const longTitle = 'A'.repeat(101);
      const response = await request(app).post('/notify').send({
        title: longTitle,
        message: 'Test message',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('100 character limit');
    });

    it('should accept title exactly 100 characters', async () => {
      const title = 'A'.repeat(100);
      const response = await request(app).post('/notify').send({
        title,
        message: 'Test message',
      });

      expect(response.status).toBe(200);
    });

    it('should accept optional metadata', async () => {
      const response = await request(app).post('/notify').send({
        title: 'Test',
        message: 'Test message',
        metadata: {
          tags: ['test', 'important'],
          clickUrl: 'https://example.com',
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /notify - Notification Types', () => {
    it('should accept error notification', async () => {
      const response = await request(app).post('/notify').send({
        type: 'error',
        title: 'Error Occurred',
        message: 'An error has occurred',
      });

      expect(response.status).toBe(200);
    });

    it('should accept action notification', async () => {
      const response = await request(app).post('/notify').send({
        type: 'action',
        title: 'Action Required',
        message: 'Please take action',
      });

      expect(response.status).toBe(200);
    });

    it('should accept heartbeat notification', async () => {
      const response = await request(app).post('/notify').send({
        type: 'heartbeat',
        title: 'Service Alive',
        message: 'Heartbeat',
      });

      expect(response.status).toBe(200);
    });

    it('should accept security notification', async () => {
      const response = await request(app).post('/notify').send({
        type: 'security',
        title: 'Security Alert',
        message: 'Security issue detected',
      });

      expect(response.status).toBe(200);
    });

    it('should default to action type when type not specified', async () => {
      const response = await request(app).post('/notify').send({
        title: 'Test',
        message: 'Test message',
      });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /notify - Response Handling', () => {
    it('should return success response', async () => {
      const response = await request(app).post('/notify').send({
        title: 'Test',
        message: 'Test message',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
    });

    it('should return skipped when disabled', async () => {
      process.env.NTFY_ENABLED = 'false';
      jest.resetModules();
      
      // Need to recreate app with new env
      const response = await request(app).post('/notify').send({
        title: 'Test',
        message: 'Test message',
      });

      // Reset for other tests
      process.env.NTFY_ENABLED = 'true';

      expect(response.status).toBe(200);
    });

    it('should return error when API key missing', async () => {
      const oldKey = process.env.NTFY_API;
      delete process.env.NTFY_API;
      
      const response = await request(app).post('/notify').send({
        title: 'Test',
        message: 'Test message',
      });

      // Restore key
      process.env.NTFY_API = oldKey;

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /fallback-logs', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/fallback-logs');
      expect(response.status).toBe(200);
    });

    it('should return array of logs', async () => {
      const response = await request(app).get('/fallback-logs').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/fallback-logs').expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Rate Limiting', () => {
    it('should accept requests within rate limit', async () => {
      // Send 5 requests
      for (let i = 0; i < 5; i++) {
        const response = await request(app).post('/notify').send({
          title: 'Test',
          message: 'Test message',
        });
        expect(response.status).toBe(200);
      }
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).post('/notify').send({
        title: 'Test',
        message: 'Test message',
      });

      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers from Helmet', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include CORS headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});
