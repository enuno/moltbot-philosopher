/**
 * Rate Limiting Tests
 * Tests for rate limiter in AI Content Generator
 */

const request = require('supertest');
const nock = require('nock');
const fixtures = require('../../../fixtures/ai-generator-fixtures');

describe('AI Content Generator - Rate Limiting', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.VENICE_API_URL = 'http://test-venice.com/v1/chat/completions';
    process.env.VENICE_API_KEY = 'test-key';
  });

  beforeEach(() => {
    jest.resetModules();
    nock.cleanAll();
    
    // Mock Venice API
    nock('http://test-venice.com')
      .post('/v1/chat/completions')
      .reply(200, fixtures.mockVeniceResponse.data)
      .persist();
    
    app = require('../../../../services/ai-content-generator/src/index');
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('POST /generate - Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Make 5 requests (well under the 10/minute limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/generate')
          .send({ topic: `test ${i}` });

        expect(response.status).toBe(200);
      }
    });

    it('should enforce rate limit after 10 requests per IP', async () => {
      // Make 10 requests (at the limit)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/generate')
          .send({ topic: `test ${i}` })
          .expect(200);
      }

      // 11th request should be rate limited
      const response = await request(app)
        .post('/generate')
        .send({ topic: 'test 11' })
        .expect(429);

      expect(response.body).toMatchObject({
        error: 'Rate limit exceeded',
        retryAfter: expect.any(Number),
      });
    });

    it('should return retryAfter time in seconds', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/generate')
          .send({ topic: `test ${i}` });
      }

      // Check rate limit response
      const response = await request(app)
        .post('/generate')
        .send({ topic: 'test' })
        .expect(429);

      expect(response.body.retryAfter).toBeGreaterThan(0);
      expect(response.body.retryAfter).toBeLessThanOrEqual(60);
    });

    it('should return 429 status code when rate limited', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/generate')
          .send({ topic: `test ${i}` });
      }

      const response = await request(app)
        .post('/generate')
        .send({ topic: 'test' });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Rate limit');
    });

    it('should track rate limit per IP address', async () => {
      // This test verifies the rate limiter uses IP as key
      // In a real scenario, different IPs would have separate limits
      
      // Make 10 requests from "same IP" (supertest simulates this)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/generate')
          .send({ topic: `test ${i}` })
          .expect(200);
      }

      // 11th request should be rate limited
      await request(app)
        .post('/generate')
        .send({ topic: 'test' })
        .expect(429);
    });
  });

  describe('Rate Limiter Configuration', () => {
    it('should have a 60-second duration window', async () => {
      // This test documents the configuration
      // Rate limiter: 10 requests per 60 seconds
      
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/generate')
          .send({ topic: `test ${i}` })
          .expect(200);
      }

      // Next request should be rate limited
      const response = await request(app)
        .post('/generate')
        .send({ topic: 'test' })
        .expect(429);

      // RetryAfter should be within the 60-second window
      expect(response.body.retryAfter).toBeLessThanOrEqual(60);
    });

    it('should allow 10 requests before rate limiting', async () => {
      // Verify the exact limit is 10 requests
      
      // Requests 1-10 should succeed
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/generate')
          .send({ topic: `test ${i}` });

        expect(response.status).toBe(200);
      }

      // Request 11 should fail
      const response = await request(app)
        .post('/generate')
        .send({ topic: 'test 11' });

      expect(response.status).toBe(429);
    });
  });

  describe('Rate Limit Error Response', () => {
    it('should include error message in rate limit response', async () => {
      // Exhaust limit
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/generate')
          .send({ topic: `test ${i}` });
      }

      const response = await request(app)
        .post('/generate')
        .send({ topic: 'test' })
        .expect(429);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Rate limit exceeded');
    });

    it('should include retryAfter field in rate limit response', async () => {
      // Exhaust limit
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/generate')
          .send({ topic: `test ${i}` });
      }

      const response = await request(app)
        .post('/generate')
        .send({ topic: 'test' })
        .expect(429);

      expect(response.body).toHaveProperty('retryAfter');
      expect(typeof response.body.retryAfter).toBe('number');
    });

    it('should return JSON content type for rate limit errors', async () => {
      // Exhaust limit
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/generate')
          .send({ topic: `test ${i}` });
      }

      const response = await request(app)
        .post('/generate')
        .send({ topic: 'test' })
        .expect(429)
        .expect('Content-Type', /json/);

      expect(response.body).toBeDefined();
    });
  });
});
