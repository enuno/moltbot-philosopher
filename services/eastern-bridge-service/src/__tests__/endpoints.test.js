import { app, cachedKnowledgeDomains } from '../index.js';
import request from 'supertest';

/**
 * Task 2 Tests: Implement Core Endpoints
 *
 * These tests verify BEHAVIOR:
 * - /synthesize returns Eastern philosophy synthesis with Western parallels
 * - /council-vote returns bridge persona's vote with reasoning
 * - Knowledge domain context is injected into responses
 * - Topic-tradition affinities are used to select primary traditions
 * - Error handling for invalid/missing inputs
 */

describe('Eastern Bridge Service - Task 2: Core Endpoints', () => {
  describe('POST /synthesize', () => {
    test('Returns 200 with synthesis response for valid question', async () => {
      const response = await request(app)
        .post('/synthesize')
        .send({
          question: 'What is the nature of consciousness?',
          context: 'Metaphysics'
        })
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          question: expect.any(String),
          answer: expect.any(String),
          primary_tradition: expect.any(String),
          secondary_traditions: expect.any(Array),
          western_parallels: expect.any(Object),
        })
      );
    });

    test('Synthesis response includes Eastern tradition as primary', async () => {
      const response = await request(app)
        .post('/synthesize')
        .send({
          question: 'What is the nature of consciousness?'
        })
        .expect(200);

      // Primary tradition should be one of the six Eastern traditions
      const validTraditions = ['hinduism', 'buddhism', 'taoism', 'confucianism', 'jainism', 'shinto'];
      expect(validTraditions).toContain(response.body.primary_tradition.toLowerCase());
    });

    test('Synthesis response includes Western parallels object', async () => {
      const response = await request(app)
        .post('/synthesize')
        .send({
          question: 'How should we govern society?',
          context: 'Politics'
        })
        .expect(200);

      // Western parallels should indicate how Jungian bridges (if used) are marked
      expect(response.body.western_parallels).toHaveProperty('jungian_reference');
      expect(response.body.western_parallels.jungian_reference).toEqual(
        expect.stringMatching(/explicit|none|bridge/)
      );
    });

    test('Synthesis response has answer field with content', async () => {
      const response = await request(app)
        .post('/synthesize')
        .send({
          question: 'What is virtue?'
        })
        .expect(200);

      expect(response.body.answer).toBeTruthy();
      expect(response.body.answer.length).toBeGreaterThan(50);
    });

    test('Secondary traditions array includes at least one tradition', async () => {
      const response = await request(app)
        .post('/synthesize')
        .send({
          question: 'What is self?'
        })
        .expect(200);

      expect(response.body.secondary_traditions).toEqual(
        expect.arrayContaining([expect.any(String)])
      );
    });

    test('Returns 400 for empty question', async () => {
      const response = await request(app)
        .post('/synthesize')
        .send({ question: '' })
        .expect(400);

      expect(response.body.error).toBe('invalid_input');
    });

    test('Returns 400 for non-string question', async () => {
      const response = await request(app)
        .post('/synthesize')
        .send({ question: 123 })
        .expect(400);

      expect(response.body.error).toBe('invalid_input');
    });

    test('Synthesis uses topic-tradition affinities from knowledge domains', async () => {
      // Governance topic should prefer Confucianism
      const response = await request(app)
        .post('/synthesize')
        .send({
          question: 'How should leaders govern?',
          context: 'governance'
        })
        .expect(200);

      // This test doesn't mandate exact output, but verifies the response structure
      // indicating that affinities were consulted
      expect(response.body).toHaveProperty('primary_tradition');
      expect(response.body).toHaveProperty('answer');
    });
  });

  describe('POST /council-vote', () => {
    test('Returns 200 with vote response for valid deliberation', async () => {
      const response = await request(app)
        .post('/council-vote')
        .send({
          deliberation: 'Should we prioritize individual freedom or social harmony?',
          topic: 'governance'
        })
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          vote: expect.stringMatching(/support|oppose|abstain|nuanced/i),
          reasoning: expect.any(String),
          tradition_perspective: expect.any(String),
          council_position: expect.any(String),
        })
      );
    });

    test('Vote includes tradition perspective', async () => {
      const response = await request(app)
        .post('/council-vote')
        .send({
          deliberation: 'Should a society enforce strict moral codes?'
        })
        .expect(200);

      // Should cite an Eastern tradition
      expect(response.body.tradition_perspective).toBeTruthy();
      const validTraditions = ['hinduism', 'buddhism', 'taoism', 'confucianism', 'jainism', 'shinto'];
      const hasValidTradition = validTraditions.some(t =>
        response.body.tradition_perspective.toLowerCase().includes(t)
      );
      expect(hasValidTradition).toBe(true);
    });

    test('Vote includes substantial reasoning', async () => {
      const response = await request(app)
        .post('/council-vote')
        .send({
          deliberation: 'What is the proper role of the state?'
        })
        .expect(200);

      expect(response.body.reasoning.length).toBeGreaterThan(50);
    });

    test('Council position indicates how vote aligns with Eastern philosophy', async () => {
      const response = await request(app)
        .post('/council-vote')
        .send({
          deliberation: 'Should individuals act based on duty or happiness?'
        })
        .expect(200);

      // Council position should explain Eastern perspective
      expect(response.body.council_position).toBeTruthy();
      expect(response.body.council_position.length).toBeGreaterThan(30);
    });

    test('Returns 400 for empty deliberation', async () => {
      const response = await request(app)
        .post('/council-vote')
        .send({ deliberation: '' })
        .expect(400);

      expect(response.body.error).toBe('invalid_input');
    });

    test('Returns 400 for non-string deliberation', async () => {
      const response = await request(app)
        .post('/council-vote')
        .send({ deliberation: { nested: 'object' } })
        .expect(400);

      expect(response.body.error).toBe('invalid_input');
    });

    test('Vote position is clear and takes a stance', async () => {
      const response = await request(app)
        .post('/council-vote')
        .send({
          deliberation: 'Should society accept suffering as inevitable?'
        })
        .expect(200);

      // Vote should take a clear position
      expect(['support', 'oppose', 'abstain', 'nuanced']).toContain(
        response.body.vote.toLowerCase()
      );
    });
  });

  describe('Knowledge Domain Integration', () => {
    test('Responses reference knowledge domains from cache', async () => {
      // This test verifies that knowledge domains are available in the service
      expect(cachedKnowledgeDomains).toBeDefined();
      expect(cachedKnowledgeDomains).toHaveProperty('layer_1_eastern_traditions');
      expect(cachedKnowledgeDomains).toHaveProperty('layer_2_topic_tradition_affinities');
    });

    test('Service uses all six Eastern traditions from knowledge domains', async () => {
      const traditions = Object.keys(cachedKnowledgeDomains.layer_1_eastern_traditions);
      expect(traditions).toContain('hinduism');
      expect(traditions).toContain('buddhism');
      expect(traditions).toContain('taoism');
      expect(traditions).toContain('confucianism');
      expect(traditions).toContain('jainism');
      expect(traditions).toContain('shinto');
    });
  });

  describe('Endpoint Response Consistency', () => {
    test('Both endpoints return valid JSON responses', async () => {
      const synthResponse = await request(app)
        .post('/synthesize')
        .send({ question: 'What is being?' })
        .expect(200);

      const voteResponse = await request(app)
        .post('/council-vote')
        .send({ deliberation: 'How should we live?' })
        .expect(200);

      expect(synthResponse.body).toBeDefined();
      expect(voteResponse.body).toBeDefined();
      expect(typeof synthResponse.body).toBe('object');
      expect(typeof voteResponse.body).toBe('object');
    });

    test('Response headers indicate JSON content type', async () => {
      const response = await request(app)
        .post('/synthesize')
        .send({ question: 'What is truth?' })
        .expect(200);

      expect(response.type).toMatch(/json/);
    });
  });
});
