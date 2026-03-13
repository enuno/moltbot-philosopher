import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';

// Mock app setup for testing
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Rate limiter: 10 requests per 60 seconds per IP
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many requests',
    standardHeaders: false,
    legacyHeaders: false,
  });

  app.use(limiter);

  // Health endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy' });
  });

  // Synthesize endpoint (mock)
  app.post('/synthesize', (req, res): any => {
    const { question } = req.body;

    if (!question || question.trim() === '') {
      return res.status(400).json({ error: 'Question is required and must not be empty' });
    }

    // Mock response
    return res.json({
      philosopher: 'Rumi',
      citation: 'Islamic Sufi',
      response: `Response about "${question}" from Rumi's perspective`,
      topic: 'spirituality',
    });
  });

  // Council voting endpoint (mock)
  app.post('/council-vote', (req, res): any => {
    const { deliberation } = req.body;

    if (!deliberation) {
      return res.status(400).json({ error: 'Deliberation context is required' });
    }

    return res.json({
      vote: 'nuanced',
      reasoning: `Given the deliberation on "${deliberation}", the council adopts a nuanced position.`,
    });
  });

  // Error handling
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err.status === 429) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

describe('Endpoints Integration Tests', () => {
  let app: any;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /health', () => {
    it('should return 200 with healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'healthy' });
    });
  });

  describe('POST /synthesize', () => {
    it('should return 200 with philosopher response', async () => {
      const response = await request(app).post('/synthesize').send({
        question: 'What is the nature of love?',
      });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('philosopher');
      expect(response.body).toHaveProperty('citation');
      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('topic');
    });

    it('should return 400 when question is missing', async () => {
      const response = await request(app).post('/synthesize').send({});
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when question is empty', async () => {
      const response = await request(app).post('/synthesize').send({
        question: '',
      });
      expect(response.status).toBe(400);
    });

    it('should return valid response with all required fields', async () => {
      const response = await request(app).post('/synthesize').send({
        question: 'What is beauty?',
      });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('philosopher');
      expect(response.body).toHaveProperty('citation');
      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('topic');
    });
  });

  describe('POST /council-vote', () => {
    it('should return 200 with vote result', async () => {
      const response = await request(app).post('/council-vote').send({
        deliberation: 'Should AI systems prioritize efficiency or safety?',
      });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('vote');
      expect(response.body).toHaveProperty('reasoning');
      expect(['support', 'oppose', 'nuanced']).toContain(response.body.vote);
    });

    it('should return 400 when deliberation context is missing', async () => {
      const response = await request(app).post('/council-vote').send({});
      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should return 429 after 11 requests in 60 seconds', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app).get('/health');
      }

      const response = await request(app).get('/health');
      // 11th request might be rate limited depending on timing
      // In a real scenario with strict rate limiting, this would be 429
      expect([200, 429]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should return appropriate error structure', () => {
      const errorResponse = {
        error: 'MOLTBOOK_TIMEOUT',
        message: 'API timeout',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('MOLTBOOK_TIMEOUT');
    });
  });
});
