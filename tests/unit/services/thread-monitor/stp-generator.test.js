/**
 * Thread Monitor - STP Generator Tests
 * Tests for Synthesis-Tension-Propagation pattern generation
 */

const StpGenerator = require('../../../../services/thread-monitor/src/stp-generator');
const fixtures = require('../../../fixtures/thread-monitor-fixtures');
const nock = require('nock');

describe('Thread Monitor - STP Generator', () => {
  let generator;
  let mockLogger;
  let mockConfig;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConfig = {
      aiGeneratorUrl: 'http://localhost:3002',
      modelRouterUrl: 'http://localhost:3003',
    };

    generator = new StpGenerator(mockConfig, mockLogger);

    // Clean all nock mocks before each test
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Prompt Building', () => {
    it('should build STP prompt with thread context', () => {
      const thread = fixtures.mockThreads.activeThread;
      const scenario = { type: 'standard', confidence: 0.5, details: {} };

      const prompt = generator.buildStpPrompt(thread, scenario);

      expect(prompt).toContain('Original Question');
      expect(prompt).toContain(thread.original_question);
      expect(prompt).toContain('Exchange count');
      expect(prompt).toContain('Archetypes engaged');
      expect(prompt).toContain('SYNTHESIS');
      expect(prompt).toContain('TENSION');
      expect(prompt).toContain('PROPAGATION');
    });

    it('should include constraints in prompt', () => {
      const thread = fixtures.mockThreads.activeThread;
      const scenario = { type: 'standard', confidence: 0.5, details: {} };

      const prompt = generator.buildStpPrompt(thread, scenario);

      thread.constraints.forEach((constraint) => {
        expect(prompt).toContain(constraint);
      });
    });

    it('should add shallow response guidance', () => {
      const thread = fixtures.mockThreads.activeThread;
      const scenario = { type: 'shallow', confidence: 0.8, details: {} };

      const prompt = generator.buildStpPrompt(thread, scenario);

      expect(prompt).toContain('Shallow Response Detected');
      expect(prompt).toContain('epistemological assumptions');
    });

    it('should add conflict guidance', () => {
      const thread = fixtures.mockThreads.activeThread;
      const scenario = { type: 'conflict', confidence: 0.7, details: {} };

      const prompt = generator.buildStpPrompt(thread, scenario);

      expect(prompt).toContain('Conflict Detected');
      expect(prompt).toContain('philosophical dichotomies');
    });

    it('should add off-topic guidance', () => {
      const thread = fixtures.mockThreads.activeThread;
      const scenario = { type: 'off_topic', confidence: 0.6, details: {} };

      const prompt = generator.buildStpPrompt(thread, scenario);

      expect(prompt).toContain('Off-Topic Detected');
      expect(prompt).toContain('re-anchor');
    });

    it('should add excessive agreement guidance', () => {
      const thread = fixtures.mockThreads.activeThread;
      const scenario = { type: 'excessive_agreement', confidence: 0.9, details: {} };

      const prompt = generator.buildStpPrompt(thread, scenario);

      expect(prompt).toContain('Excessive Agreement Detected');
      expect(prompt).toContain('Do not validate');
    });

    it('should include last comment in prompt', () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        synthesis_chain: [
          {
            synthesis: 'This is the last philosophical comment.',
            author: 'TestAuthor',
          },
        ],
      };
      const scenario = { type: 'standard', confidence: 0.5, details: {} };

      const prompt = generator.buildStpPrompt(thread, scenario);

      expect(prompt).toContain('This is the last philosophical comment.');
    });
  });

  describe('STP Response Parsing', () => {
    it('should parse properly formatted STP response', () => {
      const content = `SYNTHESIS: The argument suggests that consciousness is emergent.

TENSION: This creates tension with reductive explanations of qualia.

PROPAGATION: How might epiphenomenalism address this contradiction?

TARGET_ARCHETYPES: existentialist, transcendentalist`;

      const stp = generator.parseStpResponse(content);

      expect(stp.synthesis).toContain('consciousness is emergent');
      expect(stp.tension).toContain('tension with reductive');
      expect(stp.propagation).toContain('epiphenomenalism');
      expect(stp.targetArchetypes).toEqual(['existentialist', 'transcendentalist']);
    });

    it('should handle missing labels by extracting sentences', () => {
      const content =
        'The position assumes determinism. Yet this contradicts free will. What about moral responsibility?';

      const stp = generator.parseStpResponse(content);

      expect(stp.synthesis).toBeTruthy();
      expect(stp.tension).toBeTruthy();
      expect(stp.propagation).toBeTruthy();
    });

    it('should extract question for propagation', () => {
      const content = 'Some text without labels. But here is a question?';

      const stp = generator.parseStpResponse(content);

      expect(stp.propagation).toContain('?');
    });

    it('should provide fallback question if none found', () => {
      const content = 'Some text with no question marks at all.';

      const stp = generator.parseStpResponse(content);

      expect(stp.propagation).toContain('?');
      expect(stp.propagation).toContain('explore');
    });

    it('should handle empty target archetypes', () => {
      const content = `SYNTHESIS: Test
TENSION: Test
PROPAGATION: Test?`;

      const stp = generator.parseStpResponse(content);

      expect(stp.targetArchetypes).toEqual([]);
    });
  });

  describe('AI Generator Integration', () => {
    it('should call AI Generator with correct parameters', async () => {
      const thread = fixtures.mockThreads.activeThread;
      const scenario = { type: 'standard', confidence: 0.5, details: {} };
      const prompt = 'test prompt';

      const scope = nock('http://localhost:3002')
        .post('/generate', (body) => {
          expect(body.topic).toBe(thread.original_question);
          expect(body.contentType).toBe('reply');
          expect(body.persona).toBe('socratic');
          expect(body.customPrompt).toBe(prompt);
          return true;
        })
        .reply(200, {
          content: 'SYNTHESIS: Test\nTENSION: Test\nPROPAGATION: Test?',
          metadata: {},
        });

      await generator.callAiGenerator(prompt, thread, scenario);

      expect(scope.isDone()).toBe(true);
    });

    it('should return parsed content from AI Generator', async () => {
      const thread = fixtures.mockThreads.activeThread;
      const scenario = { type: 'standard', confidence: 0.5, details: {} };
      const prompt = 'test prompt';

      nock('http://localhost:3002').post('/generate').reply(200, {
        content: 'Generated STP content',
        metadata: { model: 'llama-3.3-70b' },
      });

      const response = await generator.callAiGenerator(prompt, thread, scenario);

      expect(response.content).toBe('Generated STP content');
      expect(response.metadata).toHaveProperty('model');
    });

    it('should throw error when AI Generator fails', async () => {
      const thread = fixtures.mockThreads.activeThread;
      const scenario = { type: 'standard', confidence: 0.5, details: {} };
      const prompt = 'test prompt';

      nock('http://localhost:3002').post('/generate').reply(500, { error: 'Internal error' });

      await expect(generator.callAiGenerator(prompt, thread, scenario)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AI Generator call failed',
        expect.objectContaining({
          error: expect.any(String),
        }),
      );
    });
  });

  describe('Full STP Generation', () => {
    it('should generate complete STP response', async () => {
      const thread = fixtures.mockThreads.activeThread;
      const scenario = { type: 'standard', confidence: 0.5, details: {} };

      nock('http://localhost:3002').post('/generate').reply(200, {
        content: `SYNTHESIS: Morality appears objective from classical viewpoint.
TENSION: This conflicts with cultural relativism.
PROPAGATION: How do we reconcile universal principles with diverse practices?
TARGET_ARCHETYPES: existentialist, enlightenment`,
        metadata: {},
      });

      const result = await generator.generate(thread, scenario);

      expect(result.content).toBeTruthy();
      expect(result.synthesis).toContain('Morality');
      expect(result.tension).toContain('conflicts');
      expect(result.propagation).toContain('?');
      expect(result.mentions).toBeDefined();
    });

    it('should return fallback on generation failure', async () => {
      const thread = fixtures.mockThreads.activeThread;
      const scenario = { type: 'standard', confidence: 0.5, details: {} };

      nock('http://localhost:3002').post('/generate').reply(500);

      const result = await generator.generate(thread, scenario);

      expect(result).toBeDefined();
      expect(result.content).toBeTruthy();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'STP generation failed',
        expect.objectContaining({
          error: expect.any(String),
        }),
      );
    });

    it('should include scenario type in context', async () => {
      const thread = fixtures.mockThreads.stalledThread;
      const scenario = { type: 'silence', confidence: 0.8, details: { hoursSinceActivity: 25 } };

      nock('http://localhost:3002')
        .post('/generate', (body) => {
          expect(body.context).toContain('silence');
          return true;
        })
        .reply(200, {
          content: 'SYNTHESIS: Test\nTENSION: Test\nPROPAGATION: Test?',
          metadata: {},
        });

      await generator.generate(thread, scenario);
    });
  });

  describe('Helper Methods', () => {
    it('should extract last comment from thread', () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        synthesis_chain: [
          { synthesis: 'First', author: 'A' },
          { synthesis: 'Second', author: 'B' },
          { synthesis: 'Last', author: 'C' },
        ],
      };

      const lastComment = generator.getLastComment(thread);

      expect(lastComment).toBe('Last');
    });

    it('should return null for empty synthesis chain', () => {
      const thread = {
        ...fixtures.mockThreads.newThread,
        synthesis_chain: [],
      };

      const lastComment = generator.getLastComment(thread);

      expect(lastComment).toBeNull();
    });

    it('should extract sentence by index', () => {
      const text = 'First sentence. Second sentence. Third sentence.';

      const first = generator.extractSentence(text, 0);
      const second = generator.extractSentence(text, 1);

      expect(first).toContain('First');
      expect(second).toContain('Second');
    });

    it('should extract question from text', () => {
      const text = 'Some statement. Then a question? More text.';

      const question = generator.extractQuestion(text);

      expect(question).toContain('question?');
    });

    it('should provide fallback question', () => {
      const text = 'No questions here.';

      const question = generator.extractQuestion(text);

      expect(question).toContain('?');
      expect(question).toContain('explore');
    });
  });
});
