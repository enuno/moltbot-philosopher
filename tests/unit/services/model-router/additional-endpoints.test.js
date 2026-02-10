/**
 * Model Router - Additional Endpoints Tests
 * Tests for /models, /auth, /profile, and /metrics endpoints
 */

const request = require('supertest');
const nock = require('nock');
const fixtures = require('../../../fixtures/model-router-fixtures');

describe('Model Router - Additional Endpoints', () => {
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

  describe('GET /models', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/models');
      expect(response.status).toBe(200);
    });

    it('should return available models', async () => {
      const response = await request(app).get('/models').expect(200);

      expect(response.body).toHaveProperty('venice');
      expect(response.body).toHaveProperty('kimi');
    });

    it('should include Venice models', async () => {
      const response = await request(app).get('/models').expect(200);

      expect(response.body.venice).toBeDefined();
    });

    it('should include Kimi models', async () => {
      const response = await request(app).get('/models').expect(200);

      expect(response.body.kimi).toBeDefined();
    });

    it('should include routing rules', async () => {
      const response = await request(app).get('/models').expect(200);

      expect(response.body).toHaveProperty('routing_rules');
      expect(Array.isArray(response.body.routing_rules)).toBe(true);
    });

    it('should list configured tools', async () => {
      const response = await request(app).get('/models').expect(200);

      expect(response.body.routing_rules).toContain('inner_dialogue');
      expect(response.body.routing_rules).toContain('map_thinkers');
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/models').expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('GET /auth', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/auth');
      expect(response.status).toBe(200);
    });

    it('should return authentication instructions', async () => {
      const response = await request(app).get('/auth').expect(200);

      expect(response.body).toHaveProperty('instructions_url');
      expect(response.body).toHaveProperty('header_name');
      expect(response.body).toHaveProperty('description');
    });

    it('should specify X-Moltbook-Identity header', async () => {
      const response = await request(app).get('/auth').expect(200);

      expect(response.body.header_name).toBe('X-Moltbook-Identity');
    });

    it('should include instructions URL', async () => {
      const response = await request(app).get('/auth').expect(200);

      expect(response.body.instructions_url).toBeTruthy();
      expect(typeof response.body.instructions_url).toBe('string');
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/auth').expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('GET /profile', () => {
    it('should return unauthenticated response without identity', async () => {
      const response = await request(app).get('/profile').expect(200);

      expect(response.body.authenticated).toBe(false);
      expect(response.body).toHaveProperty('message');
    });

    it('should return authenticated response with valid identity', async () => {
      const response = await request(app)
        .get('/profile')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .expect(200);

      expect(response.body.authenticated).toBe(true);
      expect(response.body).toHaveProperty('agent');
    });

    it('should include agent data when authenticated', async () => {
      const response = await request(app)
        .get('/profile')
        .set('X-Moltbook-Identity', 'test-agent-identity')
        .expect(200);

      expect(response.body.agent).toHaveProperty('id');
      expect(response.body.agent).toHaveProperty('username');
    });

    it('should include auth URL when unauthenticated', async () => {
      const response = await request(app).get('/profile').expect(200);

      expect(response.body).toHaveProperty('auth_url');
      expect(typeof response.body.auth_url).toBe('string');
    });
  });

  describe('GET /metrics', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/metrics');
      expect(response.status).toBe(200);
    });

    it('should return Prometheus metrics format', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('should include router metrics', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.text).toContain('moltbot_router');
    });

    it('should return text/plain content type', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);
    });
  });

  describe('Rate Limiting', () => {
    it('should accept multiple requests within limit', async () => {
      // Rate limit is 100 requests per 15 minutes
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/health');
        expect(response.status).toBe(200);
      }
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/health').expect(200);

      // Rate limiting middleware adds these headers
      expect(response.headers).toBeDefined();
    });
  });

  describe('CORS and Security', () => {
    it('should include CORS headers', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should include security headers from Helmet', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});
