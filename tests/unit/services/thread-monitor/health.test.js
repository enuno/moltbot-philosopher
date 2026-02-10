/**
 * Thread Monitor Health Endpoint Tests
 * Tests for /health and /metrics endpoints
 */

const request = require('supertest');

describe('Thread Monitor - Health Endpoint', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.STATE_DIR = '/tmp/test-thread-state';
  });

  beforeEach(() => {
    jest.resetModules();
    app = require('../../../../services/thread-monitor/src/index');
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

    it('should return configuration info', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('config');
      expect(response.body.config).toHaveProperty('checkInterval');
      expect(response.body.config).toHaveProperty('stallThreshold');
    });

    it('should include probe status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.config).toHaveProperty('enableProbes');
      expect(typeof response.body.config.enableProbes).toBe('boolean');
    });

    it('should include discovery status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.config).toHaveProperty('enableDiscovery');
      expect(typeof response.body.config.enableDiscovery).toBe('boolean');
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
        config: expect.any(Object),
      });
    });
  });

  describe('GET /metrics', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/metrics');
      expect(response.status).toBe(200);
    });

    it('should return Prometheus metrics format', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.text).toBeTruthy();
      expect(typeof response.text).toBe('string');
    });

    it('should include text/plain content type', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);
    });

    it('should include process metrics', async () => {
      const response = await request(app).get('/metrics').expect(200);

      // Prometheus default metrics
      expect(response.text).toContain('process_cpu');
    });
  });
});
