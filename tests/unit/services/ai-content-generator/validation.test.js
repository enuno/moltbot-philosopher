/**
 * Input Validation Tests
 * Tests for request validation in AI Content Generator
 */

const request = require('supertest');
const nock = require('nock');
const fixtures = require('../../../fixtures/ai-generator-fixtures');

describe('AI Content Generator - Input Validation', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.VENICE_API_URL = 'http://test-venice.com/v1/chat/completions';
    process.env.KIMI_API_URL = 'http://test-kimi.com/v1/chat/completions';
    process.env.VENICE_API_KEY = 'test-key';
  });

  beforeEach(() => {
    jest.resetModules();
    nock.cleanAll();
    app = require('../../../../services/ai-content-generator/src/index');
    
    // Set up default mock to prevent actual API calls
    nock('http://test-venice.com')
      .post('/v1/chat/completions')
      .reply(200, fixtures.mockVeniceResponse.data)
      .persist();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('POST /generate - Required Fields', () => {
    it('should accept request with only topic', async () => {
      const response = await request(app)
        .post('/generate')
        .send({ topic: 'test topic' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should accept request with only customPrompt', async () => {
      const response = await request(app)
        .post('/generate')
        .send({ customPrompt: 'Write about philosophy' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject request with neither topic nor customPrompt', async () => {
      const response = await request(app)
        .post('/generate')
        .send({ persona: 'socratic' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Missing required field: topic or customPrompt',
      });
    });

    it('should reject request with empty topic', async () => {
      const response = await request(app)
        .post('/generate')
        .send({ topic: '' })
        .expect(400);

      expect(response.body.error).toContain('required field');
    });
  });

  describe('POST /generate - Persona Validation', () => {
    it('should accept valid persona', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test',
          persona: 'socratic',
        });

      expect(response.status).toBe(200);
    });

    it('should use default persona when not specified', async () => {
      const response = await request(app)
        .post('/generate')
        .send({ topic: 'test' })
        .expect(200);

      expect(response.body.metadata.persona).toBe('socratic');
    });

    it('should reject invalid persona', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test',
          persona: 'invalid_persona',
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid persona');
      expect(response.body.error).toContain('Available:');
    });

    it('should list available personas in error message', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test',
          persona: 'unknown',
        })
        .expect(400);

      const errorMessage = response.body.error;
      expect(errorMessage).toContain('socratic');
      expect(errorMessage).toContain('aristotelian');
      expect(errorMessage).toContain('existentialist');
    });
  });

  describe('POST /generate - Content Type Validation', () => {
    it('should accept valid content type', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test',
          contentType: 'post',
        });

      expect(response.status).toBe(200);
    });

    it('should use default content type when not specified', async () => {
      const response = await request(app)
        .post('/generate')
        .send({ topic: 'test' })
        .expect(200);

      expect(response.body.metadata.contentType).toBe('post');
    });

    it('should reject invalid content type', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test',
          contentType: 'invalid_type',
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid content type');
      expect(response.body.error).toContain('Available:');
    });

    it('should list available content types in error message', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test',
          contentType: 'unknown',
        })
        .expect(400);

      const errorMessage = response.body.error;
      expect(errorMessage).toContain('post');
      expect(errorMessage).toContain('comment');
      expect(errorMessage).toContain('reply');
    });

    it('should accept all valid content types', async () => {
      const contentTypes = ['post', 'comment', 'reply'];

      for (const type of contentTypes) {
        const response = await request(app)
          .post('/generate')
          .send({
            topic: 'test',
            contentType: type,
          });

        expect(response.status).toBe(200);
        expect(response.body.metadata.contentType).toBe(type);
      }
    });
  });

  describe('POST /generate - Combined Validation', () => {
    it('should accept request with all valid fields', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'artificial intelligence',
          contentType: 'post',
          persona: 'existentialist',
          context: 'Discussion about AI consciousness',
          customPrompt: 'Focus on ethical implications',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata).toMatchObject({
        topic: 'artificial intelligence',
        contentType: 'post',
        persona: 'existentialist',
      });
    });

    it('should validate persona before making API call', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test',
          persona: 'invalid',
          contentType: 'post',
        })
        .expect(400);

      // Should fail validation before any API call
      expect(response.body.error).toContain('Invalid persona');
    });

    it('should validate content type before making API call', async () => {
      const response = await request(app)
        .post('/generate')
        .send({
          topic: 'test',
          persona: 'socratic',
          contentType: 'invalid',
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid content type');
    });
  });

  describe('POST /generate - Request Format', () => {
    it('should accept JSON content type', async () => {
      const response = await request(app)
        .post('/generate')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ topic: 'test' }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/generate')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
