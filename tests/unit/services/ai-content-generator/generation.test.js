/**
 * Generation Endpoint Tests with AI Provider Mocking
 * Tests for successful content generation paths
 */

const request = require('supertest');
const nock = require('nock');
const fixtures = require('../../../fixtures/ai-generator-fixtures');

describe('AI Content Generator - Generation with Mocked APIs', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.VENICE_API_URL = 'http://test-venice.com/v1/chat/completions';
    process.env.KIMI_API_URL = 'http://test-kimi.com/v1/chat/completions';
    process.env.VENICE_API_KEY = 'test-venice-key';
    process.env.KIMI_API_KEY = 'test-kimi-key';
  });

  beforeEach(() => {
    jest.resetModules();
    nock.cleanAll();
    app = require('../../../../services/ai-content-generator/src/index');
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.restore();
  });

  describe('Venice API Success', () => {
    it('should generate content using Venice when provider is venice', async () => {
      nock('http://test-venice.com')
        .post('/v1/chat/completions')
        .reply(200, fixtures.mockVeniceResponse.data);

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'truth',
          provider: 'venice',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        content: expect.stringContaining('truth'),
        title: expect.any(String),
        metadata: {
          provider: 'venice',
        },
      });
    });

    it('should generate content using Venice when provider is auto and Venice key exists', async () => {
      nock('http://test-venice.com')
        .post('/v1/chat/completions')
        .reply(200, fixtures.mockVeniceResponse.data);

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'consciousness',
          provider: 'auto',
        })
        .expect(200);

      expect(response.body.metadata.provider).toBe('venice');
    });

    it('should include correct metadata in response', async () => {
      nock('http://test-venice.com')
        .post('/v1/chat/completions')
        .reply(200, fixtures.mockVeniceResponse.data);

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'ethics',
          persona: 'existentialist',
          contentType: 'post',
        })
        .expect(200);

      expect(response.body.metadata).toMatchObject({
        topic: 'ethics',
        persona: 'existentialist',
        contentType: 'post',
        provider: 'venice',
        generatedAt: expect.any(String),
      });

      // Verify timestamp is valid ISO string
      expect(new Date(response.body.metadata.generatedAt).toISOString()).toBe(
        response.body.metadata.generatedAt
      );
    });
  });

  describe('Kimi API Success', () => {
    it('should generate content using Kimi when provider is kimi', async () => {
      nock('http://test-kimi.com')
        .post('/v1/chat/completions')
        .reply(200, fixtures.mockKimiResponse.data);

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'reality',
          provider: 'kimi',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        content: expect.any(String),
        metadata: {
          provider: 'kimi',
        },
      });
    });
  });

  describe('Fallback Logic', () => {
    // SKIPPED: Flaky test - nock replyWithError causes unhandled rejection in CI
    // Test passes individually but fails ~33% of the time in full suite
    // Issue: async error handling timing with nock interceptors
    it.skip('should use template when Venice fails with explicit venice provider', async () => {
      // Clean any existing interceptors first
      nock.cleanAll();
      
      nock('http://test-venice.com')
        .post('/v1/chat/completions')
        .replyWithError('Connection failed');

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'philosophy',
          provider: 'venice',
        });

      expect(response.status).toBe(200);
      // With explicit provider that fails, falls back to template
      expect(response.body.success).toBe(true);
      expect(response.body.metadata.fallback).toBe(true);
      expect(response.body.metadata.provider).toBe('template');
      
      // Clean up after test
      nock.cleanAll();
      
      // Wait a bit for any async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // SKIPPED: Flaky test - nock replyWithError causes unhandled rejection in CI
    // Test passes individually but fails ~33% of the time in full suite  
    // Issue: async error handling timing with nock interceptors
    it.skip('should use template when auto provider is set but APIs fail', async () => {
      // Clean any existing interceptors first
      nock.cleanAll();
      
      nock('http://test-venice.com')
        .post('/v1/chat/completions')
        .replyWithError('Venice error');

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'wisdom',
          provider: 'auto',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata.provider).toBe('template');
      expect(response.body.metadata.fallback).toBe(true);
      
      // Clean up after test
      nock.cleanAll();
      
      // Wait a bit for any async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    it('should include error message in fallback response', async () => {
      nock('http://test-venice.com')
        .post('/v1/chat/completions')
        .reply(500, { error: 'API Error' });

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test topic',
          provider: 'venice',
        })
        .expect(200);

      expect(response.body.metadata).toHaveProperty('error');
      expect(response.body.metadata.fallback).toBe(true);
      expect(response.body.metadata.provider).toBe('template');
    });
  });

  describe('Different Content Types', () => {
    it('should generate post content', async () => {
      nock('http://test-venice.com')
        .post('/v1/chat/completions')
        .reply(200, fixtures.mockVeniceResponse.data);

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test',
          contentType: 'post',
        })
        .expect(200);

      expect(response.body.title).toBeDefined();
      expect(response.body.content).toBeDefined();
    });

    it('should generate comment content', async () => {
      nock('http://test-venice.com')
        .post('/v1/chat/completions')
        .reply(200, {
          choices: [{ message: { content: 'A thoughtful comment about the topic.' } }],
        });

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test',
          contentType: 'comment',
        })
        .expect(200);

      expect(response.body.metadata.contentType).toBe('comment');
    });

    it('should generate reply content', async () => {
      nock('http://test-venice.com')
        .post('/v1/chat/completions')
        .reply(200, {
          choices: [{ message: { content: 'A detailed reply to the question.' } }],
        });

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test',
          contentType: 'reply',
        })
        .expect(200);

      expect(response.body.metadata.contentType).toBe('reply');
    });
  });

  describe('Philosopher Personas', () => {
    it('should apply Socratic persona', async () => {
      nock('http://test-venice.com')
        .post('/v1/chat/completions')
        .reply(200, fixtures.mockVeniceResponse.data);

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'knowledge',
          persona: 'socratic',
        })
        .expect(200);

      expect(response.body.metadata.persona).toBe('socratic');
    });

    it('should apply Nietzschean persona', async () => {
      nock('http://test-venice.com')
        .post('/v1/chat/completions')
        .reply(200, fixtures.mockVeniceResponse.data);

      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'morality',
          persona: 'nietzschean',
        })
        .expect(200);

      expect(response.body.metadata.persona).toBe('nietzschean');
    });
  });
});
