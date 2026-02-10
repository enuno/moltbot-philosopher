/**
 * Model Router - Route Endpoint Tests
 * Tests for /route endpoint integration
 */

const request = require('supertest');
const nock = require('nock');
const fixtures = require('../../../fixtures/model-router-fixtures');

describe('Model Router - Route Endpoint', () => {
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
    nock.cleanAll();
    
    // Mock Moltbook identity verification
    nock('https://moltbook.com')
      .post('/api/v1/agents/verify-identity')
      .reply(200, {
        valid: true,
        agent: {
          id: 'test-agent-123',
          username: 'test-agent',
          displayName: 'Test Agent',
        },
      })
      .persist();
    
    global.mockRoutingConfig = fixtures.mockRoutingConfig;
    app = require('../../../../services/model-router/src/index');
  });

  afterEach(() => {
    delete global.mockRoutingConfig;
    nock.cleanAll();
  });

  afterAll(() => {
    nock.restore();
  });

  describe('POST /route - Basic Functionality', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/route')
        .send(fixtures.sampleRequests.basicInnerDialogue);

      expect(response.status).toBe(401);
    });

    it('should accept request with valid Moltbook identity', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send(fixtures.sampleRequests.basicInnerDialogue);

      expect(response.status).toBe(200);
    });

    it('should return routing decision', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send(fixtures.sampleRequests.basicInnerDialogue)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('routing');
      expect(response.body.routing).toHaveProperty('model');
      expect(response.body.routing).toHaveProperty('backend');
      expect(response.body.routing).toHaveProperty('reason');
    });

    it('should include timestamp in response', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send(fixtures.sampleRequests.basicInnerDialogue)
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('POST /route - Input Validation', () => {
    it('should reject request without tool field', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send({
          params: {},
          context: 'some context',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('tool');
    });

    it('should accept request with only tool field', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send({ tool: 'inner_dialogue' })
        .expect(200);

      expect(response.body.status).toBe('success');
    });

    it('should accept request with all fields', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send(fixtures.sampleRequests.basicInnerDialogue)
        .expect(200);

      expect(response.body.status).toBe('success');
    });
  });

  describe('POST /route - Routing Decisions', () => {
    it('should route inner_dialogue to Kimi by default', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send({
          tool: 'inner_dialogue',
          params: {},
          context: 'short context',
        })
        .expect(200);

      expect(response.body.routing.model).toBe('kimi/k2.5-thinking');
      expect(response.body.routing.backend).toBe('kimi');
    });

    it('should route map_thinkers to Venice by default', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send({
          tool: 'map_thinkers',
          params: {},
          context: '',
        })
        .expect(200);

      expect(response.body.routing.model).toBe('venice/llama-3.3-70b');
      expect(response.body.routing.backend).toBe('venice');
    });

    it('should apply persona preference', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send({
          tool: 'map_thinkers',
          params: {},
          context: '',
          persona: 'socratic',
        })
        .expect(200);

      expect(response.body.routing.model).toBe('kimi/k2.5-thinking');
      expect(response.body.routing.reason).toContain('persona:socratic');
    });

    it('should handle very long context', async () => {
      const longContext = 'A'.repeat(70000); // ~17500 tokens
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send({
          tool: 'generate_content',
          params: {},
          context: longContext,
        })
        .expect(200);

      expect(response.body.routing.model).toBe('kimi/k2.5-thinking');
      expect(response.body.routing.reason).toBe('very_long_context');
    });

    it('should apply override conditions', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send({
          tool: 'style_transform',
          params: { styles: ['technical', 'academic'] },
          context: '',
        })
        .expect(200);

      expect(response.body.routing.model).toBe('venice/deepseek-v3.2');
      expect(response.body.routing.reason).toBe('override:complex_style');
    });
  });

  describe('POST /route - Error Handling', () => {
    it('should handle malformed JSON', async () => {
      // Send invalid JSON - Express will return 400
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect([400, 500]).toContain(response.status);
      expect(response.body).toBeDefined();
    });

    it('should handle unknown tool gracefully', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send({
          tool: 'unknown_tool_xyz',
          params: {},
          context: '',
        })
        .expect(200);

      // Should fall back to default
      expect(response.body.status).toBe('success');
      expect(response.body.routing.reason).toBe('default_fallback');
    });

    it('should return JSON content type on error', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send({
          params: {},
        });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('POST /route - Response Structure', () => {
    it('should have consistent response structure', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send({ tool: 'inner_dialogue' })
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.any(String),
        routing: {
          model: expect.any(String),
          backend: expect.any(String),
          reason: expect.any(String),
          timestamp: expect.any(String),
        },
        timestamp: expect.any(String),
      });
    });

    it('should include reason for routing decision', async () => {
      const response = await request(app)
        .post('/route')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .send({ tool: 'map_thinkers' })
        .expect(200);

      expect(response.body.routing.reason).toBeTruthy();
      expect(typeof response.body.routing.reason).toBe('string');
    });
  });
});
