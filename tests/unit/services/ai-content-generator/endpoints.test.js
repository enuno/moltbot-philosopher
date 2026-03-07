/**
 * Endpoints Tests
 * Tests for /personas and /content-types endpoints
 */

const request = require('supertest');

describe('AI Content Generator - Information Endpoints', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
  });

  beforeEach(() => {
    jest.resetModules();
    app = require('../../../../services/ai-content-generator/src/index');
  });

  describe('GET /personas', () => {
    it('should return 200 OK', async () => {
      await request(app)
        .get('/personas')
        .expect(200);
    });

    it('should return list of available personas', async () => {
      const response = await request(app)
        .get('/personas')
        .expect(200);

      expect(response.body).toHaveProperty('personas');
      expect(Array.isArray(response.body.personas)).toBe(true);
      expect(response.body.personas.length).toBeGreaterThan(0);
    });

    it('should return personas with id, name, and voice', async () => {
      const response = await request(app)
        .get('/personas')
        .expect(200);

      const persona = response.body.personas[0];
      expect(persona).toHaveProperty('id');
      expect(persona).toHaveProperty('name');
      expect(persona).toHaveProperty('voice');
      expect(typeof persona.id).toBe('string');
      expect(typeof persona.name).toBe('string');
      expect(typeof persona.voice).toBe('string');
    });

    it('should include socratic persona', async () => {
      const response = await request(app)
        .get('/personas')
        .expect(200);

      const socratic = response.body.personas.find((p) => p.id === 'socratic');
      expect(socratic).toBeDefined();
      expect(socratic.name).toBe('Socrates');
      expect(socratic.voice).toContain('Inquisitive');
    });

    it('should include all expected personas', async () => {
      const response = await request(app)
        .get('/personas')
        .expect(200);

      const expectedPersonas = [
        'socratic',
        'aristotelian',
        'platonic',
        'nietzschean',
        'existentialist',
        'stoic',
        'confucian',
        'daoist',
        'pragmatic',
        'feminist',
      ];

      const personaIds = response.body.personas.map((p) => p.id);

      expectedPersonas.forEach((expected) => {
        expect(personaIds).toContain(expected);
      });
    });

    it('should return all defined personas', async () => {
      const response = await request(app)
        .get('/personas')
        .expect(200);

      // Service defines 18 personas: 10 legacy + 8 daily polemic
      // Legacy: socratic, aristotelian, platonic, nietzschean, existentialist, stoic, confucian, daoist, pragmatic, feminist
      // Daily polemic: classical, transcendentalist, joyce, enlightenment, beat, cyberpunk, satirist, scientist
      expect(response.body.personas).toHaveLength(18);
    });

    it('should return JSON content type', async () => {
      await request(app)
        .get('/personas')
        .expect(200)
        .expect('Content-Type', /json/);
    });

    it('should include existentialist persona', async () => {
      const response = await request(app)
        .get('/personas')
        .expect(200);

      const existentialist = response.body.personas.find((p) => p.id === 'existentialist');
      expect(existentialist).toBeDefined();
      expect(existentialist.name).toBe('Sartre');
    });

    it('should include nietzschean persona', async () => {
      const response = await request(app)
        .get('/personas')
        .expect(200);

      const nietzschean = response.body.personas.find((p) => p.id === 'nietzschean');
      expect(nietzschean).toBeDefined();
      expect(nietzschean.name).toBe('Nietzsche');
    });
  });

  describe('GET /content-types', () => {
    it('should return 200 OK', async () => {
      await request(app)
        .get('/content-types')
        .expect(200);
    });

    it('should return list of available content types', async () => {
      const response = await request(app)
        .get('/content-types')
        .expect(200);

      expect(response.body).toHaveProperty('contentTypes');
      expect(Array.isArray(response.body.contentTypes)).toBe(true);
      expect(response.body.contentTypes.length).toBeGreaterThan(0);
    });

    it('should return content types with required fields', async () => {
      const response = await request(app)
        .get('/content-types')
        .expect(200);

      const contentType = response.body.contentTypes[0];
      expect(contentType).toHaveProperty('id');
      expect(contentType).toHaveProperty('minLength');
      expect(contentType).toHaveProperty('maxLength');
      expect(contentType).toHaveProperty('description');
    });

    it('should include post content type', async () => {
      const response = await request(app)
        .get('/content-types')
        .expect(200);

      const post = response.body.contentTypes.find((ct) => ct.id === 'post');
      expect(post).toBeDefined();
      expect(post.minLength).toBe(200);
      expect(post.maxLength).toBe(2000);
      expect(post.description).toContain('post');
    });

    it('should include comment content type', async () => {
      const response = await request(app)
        .get('/content-types')
        .expect(200);

      const comment = response.body.contentTypes.find((ct) => ct.id === 'comment');
      expect(comment).toBeDefined();
      expect(comment.minLength).toBe(50);
      expect(comment.maxLength).toBe(500);
    });

    it('should include reply content type', async () => {
      const response = await request(app)
        .get('/content-types')
        .expect(200);

      const reply = response.body.contentTypes.find((ct) => ct.id === 'reply');
      expect(reply).toBeDefined();
      expect(reply.minLength).toBe(100);
      expect(reply.maxLength).toBe(1000);
    });

    it('should return 3 content types', async () => {
      const response = await request(app)
        .get('/content-types')
        .expect(200);

      expect(response.body.contentTypes).toHaveLength(3);
    });

    it('should return JSON content type', async () => {
      await request(app)
        .get('/content-types')
        .expect(200)
        .expect('Content-Type', /json/);
    });

    it('should have post as longest content type', async () => {
      const response = await request(app)
        .get('/content-types')
        .expect(200);

      const post = response.body.contentTypes.find((ct) => ct.id === 'post');
      const comment = response.body.contentTypes.find((ct) => ct.id === 'comment');
      const reply = response.body.contentTypes.find((ct) => ct.id === 'reply');

      expect(post.maxLength).toBeGreaterThan(comment.maxLength);
      expect(post.maxLength).toBeGreaterThan(reply.maxLength);
    });

    it('should have comment as shortest content type', async () => {
      const response = await request(app)
        .get('/content-types')
        .expect(200);

      const post = response.body.contentTypes.find((ct) => ct.id === 'post');
      const comment = response.body.contentTypes.find((ct) => ct.id === 'comment');
      const reply = response.body.contentTypes.find((ct) => ct.id === 'reply');

      expect(comment.maxLength).toBeLessThan(post.maxLength);
      expect(comment.maxLength).toBeLessThan(reply.maxLength);
    });
  });

  describe('Endpoint Integration', () => {
    it('should have consistent persona data between /personas and /generate validation', async () => {
      const personasResponse = await request(app).get('/personas');
      const personaIds = personasResponse.body.personas.map((p) => p.id);

      // Try to generate with each persona
      for (const personaId of personaIds.slice(0, 3)) {
        // Test first 3 for speed
        const generateResponse = await request(app)
          .post('/generate')
          .send({
            topic: 'test',
            persona: personaId,
          });

        // Should not get invalid persona error
        expect(generateResponse.status).not.toBe(400);
        if (generateResponse.status === 400) {
          expect(generateResponse.body.error).not.toContain('Invalid persona');
        }
      }
    });

    it('should have consistent content type data between /content-types and /generate validation', async () => {
      const typesResponse = await request(app).get('/content-types');
      const typeIds = typesResponse.body.contentTypes.map((ct) => ct.id);

      // Try to generate with each content type
      for (const typeId of typeIds) {
        const generateResponse = await request(app)
          .post('/generate')
          .send({
            topic: 'test',
            contentType: typeId,
          });

        // Should not get invalid content type error
        expect(generateResponse.status).not.toBe(400);
        if (generateResponse.status === 400) {
          expect(generateResponse.body.error).not.toContain('Invalid content type');
        }
      }
    });
  });
});
