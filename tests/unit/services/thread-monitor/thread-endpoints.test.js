/**
 * Thread Monitor - Thread Endpoints Tests
 * Tests for thread CRUD operations via REST API
 */

const request = require('supertest');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

describe('Thread Monitor - Thread Endpoints', () => {
  let app;
  let testStateDir;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
  });

  beforeEach(async () => {
    jest.resetModules();

    // Create unique test directory
    testStateDir = path.join(os.tmpdir(), `thread-state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    process.env.STATE_DIR = testStateDir;

    // Initialize state directories before loading app
    await fs.mkdir(path.join(testStateDir, 'active'), { recursive: true });
    await fs.mkdir(path.join(testStateDir, 'archived'), { recursive: true });
    await fs.mkdir(path.join(testStateDir, 'probes'), { recursive: true });

    app = require('../../../../services/thread-monitor/src/index');

    // Wait for app to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testStateDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('GET /threads', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/threads');
      expect(response.status).toBe(200);
    });

    it('should return empty array when no threads', async () => {
      const response = await request(app).get('/threads').expect(200);

      expect(response.body).toHaveProperty('count', 0);
      expect(response.body).toHaveProperty('threads');
      expect(response.body.threads).toEqual([]);
    });

    it('should return thread list with count', async () => {
      // Create a thread first
      await request(app).post('/threads').send({
        thread_id: 'test-thread-1',
        original_question: 'What is consciousness?',
      });

      const response = await request(app).get('/threads').expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.threads).toHaveLength(1);
    });

    it('should return thread summaries', async () => {
      await request(app).post('/threads').send({
        thread_id: 'test-thread-2',
        original_question: 'What is morality?',
      });

      const response = await request(app).get('/threads').expect(200);

      const thread = response.body.threads[0];
      expect(thread).toHaveProperty('thread_id');
      expect(thread).toHaveProperty('state');
      expect(thread).toHaveProperty('exchange_count');
      expect(thread).toHaveProperty('participants');
      expect(thread).toHaveProperty('archetypes_engaged');
      expect(thread).toHaveProperty('last_activity');
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/threads').expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('GET /threads/:threadId', () => {
    beforeEach(async () => {
      // Create a test thread
      await request(app).post('/threads').send({
        thread_id: 'existing-thread',
        original_question: 'Test question',
      });
    });

    it('should return 200 for existing thread', async () => {
      const response = await request(app).get('/threads/existing-thread');
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent thread', async () => {
      const response = await request(app).get('/threads/non-existent');
      expect(response.status).toBe(404);
    });

    it('should return complete thread data', async () => {
      const response = await request(app).get('/threads/existing-thread').expect(200);

      expect(response.body).toHaveProperty('thread_id', 'existing-thread');
      expect(response.body).toHaveProperty('state');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('last_activity');
      expect(response.body).toHaveProperty('exchange_count');
      expect(response.body).toHaveProperty('original_question');
      expect(response.body).toHaveProperty('target_metrics');
    });

    it('should return error message for non-existent thread', async () => {
      const response = await request(app).get('/threads/non-existent').expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /threads', () => {
    it('should create new thread', async () => {
      const response = await request(app)
        .post('/threads')
        .send({
          thread_id: 'new-thread-1',
          original_question: 'What is the meaning of life?',
        })
        .expect(201);

      expect(response.body).toHaveProperty('thread_id', 'new-thread-1');
      expect(response.body).toHaveProperty('state', 'initiated');
    });

    it('should reject request without thread_id', async () => {
      const response = await request(app)
        .post('/threads')
        .send({
          original_question: 'Test question',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('thread_id');
    });

    it('should reject request without original_question', async () => {
      const response = await request(app)
        .post('/threads')
        .send({
          thread_id: 'test-thread',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('original_question');
    });

    it('should accept optional constraints', async () => {
      const response = await request(app)
        .post('/threads')
        .send({
          thread_id: 'thread-with-constraints',
          original_question: 'Test question',
          constraints: ['No appeal to authority', 'Consider empirical evidence'],
        })
        .expect(201);

      expect(response.body.constraints).toHaveLength(2);
      expect(response.body.constraints).toContain('No appeal to authority');
    });

    it('should accept optional metadata', async () => {
      const response = await request(app)
        .post('/threads')
        .send({
          thread_id: 'thread-with-metadata',
          original_question: 'Test question',
          metadata: {
            topic: 'ethics',
            complexity: 'high',
          },
        })
        .expect(201);

      expect(response.body.metadata).toHaveProperty('topic', 'ethics');
      expect(response.body.metadata).toHaveProperty('complexity', 'high');
    });

    it('should initialize thread with default values', async () => {
      const response = await request(app)
        .post('/threads')
        .send({
          thread_id: 'default-thread',
          original_question: 'Test question',
        })
        .expect(201);

      expect(response.body.exchange_count).toBe(0);
      expect(response.body.participants).toEqual([]);
      expect(response.body.archetypes_engaged).toEqual([]);
      expect(response.body.stall_count).toBe(0);
    });

    it('should return JSON content type', async () => {
      const response = await request(app)
        .post('/threads')
        .send({
          thread_id: 'json-thread',
          original_question: 'Test question',
        })
        .expect(201);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('POST /threads/:threadId/exchanges', () => {
    beforeEach(async () => {
      // Create a test thread
      await request(app).post('/threads').send({
        thread_id: 'exchange-thread',
        original_question: 'Test question',
      });
    });

    it('should record exchange', async () => {
      const response = await request(app)
        .post('/threads/exchange-thread/exchanges')
        .send({
          author: 'Socrates',
          content: 'What do we mean when we speak of consciousness?',
          archetype: 'socratic',
        })
        .expect(200);

      expect(response.body.exchange_count).toBe(1);
    });

    it('should reject request without author', async () => {
      const response = await request(app)
        .post('/threads/exchange-thread/exchanges')
        .send({
          content: 'Test content',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('author');
    });

    it('should reject request without content', async () => {
      const response = await request(app)
        .post('/threads/exchange-thread/exchanges')
        .send({
          author: 'Socrates',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('content');
    });

    it('should add participant to thread', async () => {
      await request(app).post('/threads/exchange-thread/exchanges').send({
        author: 'Socrates',
        content: 'Test content',
        archetype: 'socratic',
      });

      const thread = await request(app).get('/threads/exchange-thread').expect(200);
      expect(thread.body.participants).toContain('Socrates');
    });

    it('should add archetype to thread', async () => {
      await request(app).post('/threads/exchange-thread/exchanges').send({
        author: 'Nietzsche',
        content: 'Test content',
        archetype: 'nietzschean',
      });

      const thread = await request(app).get('/threads/exchange-thread').expect(200);
      expect(thread.body.archetypes_engaged).toContain('nietzschean');
    });

    it('should transition thread to active state', async () => {
      await request(app).post('/threads/exchange-thread/exchanges').send({
        author: 'Socrates',
        content: 'Test content',
        archetype: 'socratic',
      });

      const thread = await request(app).get('/threads/exchange-thread').expect(200);
      expect(thread.body.state).toBe('active');
    });

    it('should update last activity timestamp', async () => {
      const beforeExchange = Math.floor(Date.now() / 1000);

      await request(app).post('/threads/exchange-thread/exchanges').send({
        author: 'Socrates',
        content: 'Test content',
        archetype: 'socratic',
      });

      const afterExchange = Math.floor(Date.now() / 1000);
      const thread = await request(app).get('/threads/exchange-thread').expect(200);

      expect(thread.body.last_activity).toBeGreaterThanOrEqual(beforeExchange);
      expect(thread.body.last_activity).toBeLessThanOrEqual(afterExchange);
    });

    it('should return 500 for non-existent thread', async () => {
      const response = await request(app)
        .post('/threads/non-existent/exchanges')
        .send({
          author: 'Socrates',
          content: 'Test content',
        });

      expect(response.status).toBe(500);
    });

    it('should return updated thread data', async () => {
      const response = await request(app)
        .post('/threads/exchange-thread/exchanges')
        .send({
          author: 'Socrates',
          content: 'Test content',
          archetype: 'socratic',
        })
        .expect(200);

      expect(response.body).toHaveProperty('thread_id', 'exchange-thread');
      expect(response.body).toHaveProperty('exchange_count');
      expect(response.body).toHaveProperty('participants');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/threads')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect([400, 500]).toContain(response.status);
    });

    it('should return JSON for errors', async () => {
      const response = await request(app).post('/threads').send({});

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
