/**
 * Thread Monitor - Probe Generator Tests
 * Tests for generating continuation probes for stalled threads
 */

const ProbeGenerator = require('../../../../services/thread-monitor/src/probe-generator');
const fixtures = require('../../../fixtures/thread-monitor-fixtures');
const nock = require('nock');

describe('Thread Monitor - Probe Generator', () => {
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

    generator = new ProbeGenerator(mockConfig, mockLogger);

    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Probe Type Selection', () => {
    it('should select thought_experiment when no previous probe', () => {
      const thread = {
        ...fixtures.mockThreads.stalledThread,
        last_probe_type: null,
      };

      const type = generator.selectProbeType(thread);

      expect(type).toBe('thought_experiment');
    });

    it('should rotate to conceptual_inversion after thought_experiment', () => {
      const thread = {
        ...fixtures.mockThreads.stalledThread,
        last_probe_type: 'thought_experiment',
      };

      const type = generator.selectProbeType(thread);

      expect(type).toBe('conceptual_inversion');
    });

    it('should rotate to meta_question after conceptual_inversion', () => {
      const thread = {
        ...fixtures.mockThreads.stalledThread,
        last_probe_type: 'conceptual_inversion',
      };

      const type = generator.selectProbeType(thread);

      expect(type).toBe('meta_question');
    });

    it('should cycle back to thought_experiment after meta_question', () => {
      const thread = {
        ...fixtures.mockThreads.stalledThread,
        last_probe_type: 'meta_question',
      };

      const type = generator.selectProbeType(thread);

      expect(type).toBe('thought_experiment');
    });
  });

  describe('Prompt Building', () => {
    it('should build prompt with thread context', () => {
      const thread = fixtures.mockThreads.stalledThread;
      const type = 'thought_experiment';

      const prompt = generator.buildProbePrompt(thread, type);

      expect(prompt).toContain('Original Question');
      expect(prompt).toContain(thread.original_question);
      expect(prompt).toContain('Exchanges so far');
      expect(prompt).toContain('Stall count');
    });

    it('should include thought experiment instructions', () => {
      const thread = fixtures.mockThreads.stalledThread;
      const type = 'thought_experiment';

      const prompt = generator.buildProbePrompt(thread, type);

      expect(prompt).toContain('Thought Experiment');
      expect(prompt).toContain('counterfactual scenario');
      expect(prompt).toContain('Tests the boundaries');
    });

    it('should include conceptual inversion instructions', () => {
      const thread = fixtures.mockThreads.stalledThread;
      const type = 'conceptual_inversion';

      const prompt = generator.buildProbePrompt(thread, type);

      expect(prompt).toContain('Conceptual Inversion');
      expect(prompt).toContain('Reverses a key value hierarchy');
      expect(prompt).toContain('invert the value hierarchy');
    });

    it('should include meta-question instructions', () => {
      const thread = fixtures.mockThreads.stalledThread;
      const type = 'meta_question';

      const prompt = generator.buildProbePrompt(thread, type);

      expect(prompt).toContain('Meta-Question');
      expect(prompt).toContain('nature of the discourse itself');
      expect(prompt).toContain('self-referential');
    });

    it('should include recent context', () => {
      const thread = {
        ...fixtures.mockThreads.stalledThread,
        synthesis_chain: [
          {
            synthesis: 'First exchange about epistemology',
            author: 'Descartes',
            exchange_number: 1,
          },
        ],
      };
      const type = 'thought_experiment';

      const prompt = generator.buildProbePrompt(thread, type);

      expect(prompt).toContain('Recent Discussion');
      expect(prompt).toContain('Exchange 1');
    });
  });

  describe('Probe Formatting', () => {
    it('should format thought experiment probe', () => {
      const content = 'Test probe content';
      const targetArchetypes = ['enlightenment', 'existentialist'];
      const type = 'thought_experiment';

      const formatted = generator.formatProbe(content, targetArchetypes, type);

      expect(formatted).toContain('🧠 Thought Experiment');
      expect(formatted).toContain(content);
      expect(formatted).toContain('@Enlightenment');
      expect(formatted).toContain('@Existentialist');
      expect(formatted).toContain('generated to sustain philosophical discourse');
    });

    it('should format conceptual inversion probe', () => {
      const content = 'Test inversion';
      const targetArchetypes = ['classical', 'transcendentalist'];
      const type = 'conceptual_inversion';

      const formatted = generator.formatProbe(content, targetArchetypes, type);

      expect(formatted).toContain('🔄 Conceptual Inversion');
      expect(formatted).toContain('@Classical');
      expect(formatted).toContain('@Transcendentalist');
    });

    it('should format meta-question probe', () => {
      const content = 'Test meta question';
      const targetArchetypes = ['joyce-stream'];
      const type = 'meta_question';

      const formatted = generator.formatProbe(content, targetArchetypes, type);

      expect(formatted).toContain('🤔 Meta-Question');
      expect(formatted).toContain('@Joyce-stream');
    });

    it('should capitalize archetype mentions', () => {
      const content = 'Test';
      const targetArchetypes = ['existentialist', 'enlightenment'];
      const type = 'thought_experiment';

      const formatted = generator.formatProbe(content, targetArchetypes, type);

      expect(formatted).toContain('@Existentialist');
      expect(formatted).toContain('@Enlightenment');
    });
  });

  describe('Target Archetype Selection', () => {
    it('should select engaged archetypes first', () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        archetypes_engaged: ['existentialist', 'classical', 'enlightenment'],
      };
      const type = 'thought_experiment';

      const archetypes = generator.selectTargetArchetypes(thread, type);

      expect(archetypes.length).toBeLessThanOrEqual(3);
    });

    it('should select imaginative archetypes for thought experiments', () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        archetypes_engaged: ['joyce-stream', 'existentialist', 'classical'],
      };
      const type = 'thought_experiment';

      const archetypes = generator.selectTargetArchetypes(thread, type);

      expect(archetypes).toContain('joyce-stream');
    });

    it('should select analytical archetypes for conceptual inversion', () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        archetypes_engaged: ['enlightenment', 'beat-generation', 'classical'],
      };
      const type = 'conceptual_inversion';

      const archetypes = generator.selectTargetArchetypes(thread, type);

      expect(archetypes.some((a) => ['enlightenment', 'beat-generation'].includes(a))).toBe(true);
    });

    it('should select reflective archetypes for meta-questions', () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        archetypes_engaged: ['transcendentalist', 'classical', 'enlightenment'],
      };
      const type = 'meta_question';

      const archetypes = generator.selectTargetArchetypes(thread, type);

      expect(archetypes.some((a) => ['transcendentalist', 'classical'].includes(a))).toBe(true);
    });

    it('should limit to 3 archetypes', () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        archetypes_engaged: ['existentialist', 'classical', 'enlightenment', 'transcendentalist'],
      };
      const type = 'thought_experiment';

      const archetypes = generator.selectTargetArchetypes(thread, type);

      expect(archetypes.length).toBeLessThanOrEqual(3);
    });
  });

  describe('AI Generator Integration', () => {
    it('should call AI Generator with correct parameters', async () => {
      const thread = fixtures.mockThreads.stalledThread;
      const type = 'thought_experiment';
      const prompt = 'test prompt';

      const scope = nock('http://localhost:3002')
        .post('/generate', (body) => {
          expect(body.topic).toBe(thread.original_question);
          expect(body.contentType).toBe('post');
          expect(body.persona).toBe('socratic');
          expect(body.customPrompt).toBe(prompt);
          expect(body.context).toContain('thought_experiment');
          return true;
        })
        .reply(200, {
          content: 'Generated probe content',
          metadata: {},
        });

      await generator.callAiGenerator(prompt, thread, type);

      expect(scope.isDone()).toBe(true);
    });

    it('should return content from AI Generator', async () => {
      const thread = fixtures.mockThreads.stalledThread;
      const type = 'thought_experiment';
      const prompt = 'test prompt';

      nock('http://localhost:3002').post('/generate').reply(200, {
        content: 'Test probe content',
        metadata: { model: 'llama-3.3-70b' },
      });

      const response = await generator.callAiGenerator(prompt, thread, type);

      expect(response.content).toBe('Test probe content');
      expect(response.metadata).toHaveProperty('model');
    });

    it('should throw error when AI Generator fails', async () => {
      const thread = fixtures.mockThreads.stalledThread;
      const type = 'thought_experiment';
      const prompt = 'test prompt';

      nock('http://localhost:3002').post('/generate').reply(500);

      await expect(generator.callAiGenerator(prompt, thread, type)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AI Generator call failed for probe',
        expect.objectContaining({
          error: expect.any(String),
        }),
      );
    });
  });

  describe('Full Probe Generation', () => {
    it('should generate complete probe', async () => {
      const thread = fixtures.mockThreads.stalledThread;
      const probeType = 'thought_experiment';

      nock('http://localhost:3002').post('/generate').reply(200, {
        content: 'What if understanding requires embodiment? Can disembodied systems truly comprehend?',
        metadata: {},
      });

      const result = await generator.generate(thread, probeType);

      expect(result.type).toBe('thought_experiment');
      expect(result.content).toBeTruthy();
      expect(result.content).toContain('🧠');
      expect(result.targetArchetypes).toBeDefined();
      expect(result.thread_id).toBe(thread.thread_id);
    });

    it('should auto-select probe type if not specified', async () => {
      const thread = {
        ...fixtures.mockThreads.stalledThread,
        last_probe_type: null,
      };

      nock('http://localhost:3002').post('/generate').reply(200, {
        content: 'Test probe',
        metadata: {},
      });

      const result = await generator.generate(thread);

      expect(result.type).toBe('thought_experiment');
    });

    it('should return fallback probe on generation failure', async () => {
      const thread = fixtures.mockThreads.stalledThread;
      const probeType = 'conceptual_inversion';

      nock('http://localhost:3002').post('/generate').reply(500);

      const result = await generator.generate(thread, probeType);

      expect(result).toBeDefined();
      expect(result.type).toBe('conceptual_inversion');
      expect(result.content).toBeTruthy();
      expect(result.fallback).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Probe generation failed',
        expect.objectContaining({
          error: expect.any(String),
        }),
      );
    });

    it('should include thread_id in result', async () => {
      const thread = fixtures.mockThreads.stalledThread;

      nock('http://localhost:3002').post('/generate').reply(200, {
        content: 'Test probe',
        metadata: {},
      });

      const result = await generator.generate(thread, 'meta_question');

      expect(result.thread_id).toBe(thread.thread_id);
    });
  });

  describe('Fallback Probes', () => {
    it('should generate fallback for thought_experiment', () => {
      const thread = fixtures.mockThreads.stalledThread;
      const type = 'thought_experiment';

      const fallback = generator.generateFallbackProbe(thread, type);

      expect(fallback.type).toBe('thought_experiment');
      expect(fallback.content).toContain('🧠');
      expect(fallback.content).toContain('Consider');
      expect(fallback.targetArchetypes).toBeDefined();
      expect(fallback.fallback).toBe(true);
    });

    it('should generate fallback for conceptual_inversion', () => {
      const thread = fixtures.mockThreads.stalledThread;
      const type = 'conceptual_inversion';

      const fallback = generator.generateFallbackProbe(thread, type);

      expect(fallback.type).toBe('conceptual_inversion');
      expect(fallback.content).toContain('🔄');
      expect(fallback.content).toContain('invert');
      expect(fallback.targetArchetypes).toBeDefined();
    });

    it('should generate fallback for meta_question', () => {
      const thread = fixtures.mockThreads.stalledThread;
      const type = 'meta_question';

      const fallback = generator.generateFallbackProbe(thread, type);

      expect(fallback.type).toBe('meta_question');
      expect(fallback.content).toContain('🤔');
      expect(fallback.targetArchetypes).toBeDefined();
    });

    it('should default to thought_experiment for unknown type', () => {
      const thread = fixtures.mockThreads.stalledThread;
      const type = 'unknown_type';

      const fallback = generator.generateFallbackProbe(thread, type);

      expect(fallback.type).toBe('unknown_type');
      expect(fallback.content).toContain('Consider');
    });
  });

  describe('Recent Context Extraction', () => {
    it('should extract last 3 exchanges', () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        synthesis_chain: [
          { synthesis: 'Exchange 1 content', author: 'A', exchange_number: 1 },
          { synthesis: 'Exchange 2 content', author: 'B', exchange_number: 2 },
          { synthesis: 'Exchange 3 content', author: 'C', exchange_number: 3 },
          { synthesis: 'Exchange 4 content', author: 'D', exchange_number: 4 },
        ],
      };

      const context = generator.getRecentContext(thread);

      expect(context).toContain('Exchange 2');
      expect(context).toContain('Exchange 3');
      expect(context).toContain('Exchange 4');
      expect(context).not.toContain('Exchange 1');
    });

    it('should handle empty synthesis chain', () => {
      const thread = {
        ...fixtures.mockThreads.newThread,
        synthesis_chain: [],
      };

      const context = generator.getRecentContext(thread);

      expect(context).toBe('No exchanges yet.');
    });

    it('should truncate long exchanges', () => {
      const longContent = 'A'.repeat(200);
      const thread = {
        ...fixtures.mockThreads.activeThread,
        synthesis_chain: [{ synthesis: longContent, author: 'A', exchange_number: 1 }],
      };

      const context = generator.getRecentContext(thread);

      expect(context.length).toBeLessThan(longContent.length + 50);
      expect(context).toContain('...');
    });
  });
});
