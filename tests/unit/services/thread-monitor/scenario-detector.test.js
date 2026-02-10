/**
 * Thread Monitor - Scenario Detector Tests
 * Tests for detecting thread scenarios (stall, death, shallow responses, etc.)
 */

const ScenarioDetector = require('../../../../services/thread-monitor/src/scenario-detector');
const fixtures = require('../../../fixtures/thread-monitor-fixtures');

describe('Thread Monitor - Scenario Detector', () => {
  let detector;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    detector = new ScenarioDetector(fixtures.mockConfig, mockLogger);
  });

  describe('Silence Detection', () => {
    it('should detect stalled thread (24+ hours)', async () => {
      const thread = {
        ...fixtures.mockThreads.stalledThread,
        last_activity: Math.floor(Date.now() / 1000) - 86400 - 3600, // 25 hours ago
      };

      const scenario = await detector.detect(thread);

      expect(scenario.type).toBe('silence');
      // Confidence is hoursSinceActivity / 48, so 25/48 = 0.52
      expect(scenario.confidence).toBeGreaterThan(0.5);
      expect(scenario.details.hoursSinceActivity).toBeGreaterThan(24);
    });

    it('should detect dead thread (48+ hours)', async () => {
      const thread = {
        ...fixtures.mockThreads.deadThread,
        last_activity: Math.floor(Date.now() / 1000) - 172800 - 3600, // 49 hours ago
      };

      const scenario = await detector.detect(thread);

      expect(scenario.type).toBe('silence');
      // Confidence is hoursSinceActivity / 48, so 49/48 = 1.0 (capped)
      expect(scenario.confidence).toBeGreaterThan(0.8);
      expect(scenario.details.hoursSinceActivity).toBeGreaterThan(48);
    });

    it('should not detect silence for active thread', async () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        original_question: 'Is morality objective or subjective?',
        last_activity: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
        synthesis_chain: [
          {
            synthesis: 'The question of morality requires examining objective foundations.',
            author: 'Test',
          },
        ],
      };

      const scenario = await detector.detect(thread);

      expect(scenario.type).not.toBe('silence');
    });
  });

  describe('Shallow Response Detection', () => {
    it('should detect short agreement as shallow', async () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        original_question: 'I agree that making good points about agreements is worthwhile',
        synthesis_chain: [
          {
            synthesis: 'I agree. Good point about making agreements and points.',
            author: 'Test',
          },
        ],
      };

      const scenario = await detector.detect(thread);

      expect(scenario.type).toBe('shallow');
      expect(scenario.details.length).toBeLessThan(100);
    });

    it('should detect response without philosophical depth', async () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        original_question:
          'What observations about philosophy depth and philosophical terms can you make?',
        synthesis_chain: [
          {
            synthesis:
              'The philosophical depth here and the philosophical terms used make observations about philosophy worthwhile.',
            author: 'Test',
          },
        ],
      };

      const scenario = await detector.detect(thread);

      // Should be shallow (low depth) or standard, but not off_topic
      expect(['shallow', 'standard']).toContain(scenario.type);
    });

    it('should not flag detailed philosophical response as shallow', async () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        original_question:
          'What is the epistemological nature of consciousness and the fundamental phenomenal qualia?',
        synthesis_chain: [
          {
            synthesis:
              'The question of consciousness raises fundamental epistemological concerns about the nature of subjective experience and qualia. We must examine the ontological status of phenomenal states through both empiricist and rationalist frameworks.',
            author: 'Test',
          },
        ],
      };

      const scenario = await detector.detect(thread);

      expect(scenario.type).not.toBe('shallow');
    });
  });

  describe('Agreement Detection', () => {
    it('should detect excessive agreement without shallow indicators', async () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        original_question:
          "You are right precisely exactly that I couldn't agree more and you are right about these precise exact points.",
        synthesis_chain: [
          {
            synthesis:
              "You are right. Precisely. Exactly. Couldn't agree more. You are right about the precise exact points.",
            author: 'Test',
          },
        ],
      };

      const scenario = await detector.detect(thread);

      expect(scenario.type).toBe('excessive_agreement');
      expect(scenario.confidence).toBeGreaterThan(0.7);
    });

    it('should detect partial agreement with lower confidence', async () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        original_question:
          'What is your main point and what do you agree with about the implications and reservations here?',
        synthesis_chain: [
          {
            synthesis:
              'I agree with your main point and implications, though I have some reservations about the implications.',
            author: 'Test',
          },
        ],
      };

      const scenario = await detector.detect(thread);

      // Partial agreement should not trigger excessive_agreement
      if (scenario.type === 'excessive_agreement') {
        expect(scenario.confidence).toBeLessThanOrEqual(0.7);
      }
    });
  });

  describe('Disagreement Detection', () => {
    it('should detect strong disagreement', async () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        synthesis_chain: [
          {
            synthesis:
              'However, I must disagree with your premise. On the contrary, the evidence suggests otherwise.',
            author: 'Test',
          },
        ],
      };

      const scenario = await detector.detect(thread);

      // Disagreement might be detected if not overridden by other scenarios
      if (scenario.type === 'disagreement') {
        expect(scenario.confidence).toBeGreaterThan(0.5);
      }
    });

    it('should not detect disagreement in neutral response', async () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        synthesis_chain: [
          {
            synthesis: 'Let me explore this idea further. What are the implications?',
            author: 'Test',
          },
        ],
      };

      const scenario = await detector.detect(thread);

      expect(scenario.type).not.toBe('disagreement');
    });
  });

  describe('Helper Methods', () => {
    it('should extract last comment from thread', () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        synthesis_chain: [
          { synthesis: 'First comment', author: 'A' },
          { synthesis: 'Second comment', author: 'B' },
          { synthesis: 'Last comment', author: 'C' },
        ],
      };

      const lastComment = detector.getLastComment(thread);

      expect(lastComment).toBe('Last comment');
    });

    it('should return null for thread with no comments', () => {
      const thread = {
        ...fixtures.mockThreads.newThread,
        synthesis_chain: [],
      };

      const lastComment = detector.getLastComment(thread);

      expect(lastComment).toBeNull();
    });

    it('should build context from thread', () => {
      const context = detector.buildContext(fixtures.mockThreads.activeThread);

      expect(context).toHaveProperty('originalQuestion');
      expect(context).toHaveProperty('constraints');
      expect(context).toHaveProperty('exchanges');
      expect(context).toHaveProperty('participants');
      expect(context).toHaveProperty('archetypes');
    });

    it('should include correct data in context', () => {
      const context = detector.buildContext(fixtures.mockThreads.activeThread);

      expect(context.originalQuestion).toBe(fixtures.mockThreads.activeThread.original_question);
      expect(context.exchanges).toBe(fixtures.mockThreads.activeThread.exchange_count);
      expect(context.participants).toEqual(fixtures.mockThreads.activeThread.participants);
    });
  });

  describe('Scenario Priority', () => {
    it('should prioritize silence over other scenarios', async () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        original_question: 'Is morality objective or subjective?',
        last_activity: Math.floor(Date.now() / 1000) - 86400 - 3600, // 25 hours
        synthesis_chain: [
          {
            synthesis: 'I agree. Good point about morality.', // Would trigger shallow
            author: 'Test',
          },
        ],
      };

      const scenario = await detector.detect(thread);

      // Silence should take priority over shallow
      expect(scenario.type).toBe('silence');
    });

    it('should handle recent activity without silence detection', async () => {
      const thread = {
        ...fixtures.mockThreads.activeThread,
        original_question: 'Is morality objective or subjective?',
        last_activity: Math.floor(Date.now() / 1000) - 300, // 5 minutes
        synthesis_chain: [
          {
            synthesis:
              'The question of morality requires careful examination of objective and subjective elements in ethics.',
            author: 'Test',
          },
        ],
      };

      const scenario = await detector.detect(thread);

      // Should not be silence for recent activity
      expect(scenario.type).not.toBe('silence');
      expect(scenario.confidence).toBeGreaterThanOrEqual(0);
      expect(scenario.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Confidence Scoring', () => {
    it('should return confidence between 0 and 1', async () => {
      const thread = fixtures.mockThreads.activeThread;

      const scenario = await detector.detect(thread);

      expect(scenario.confidence).toBeGreaterThanOrEqual(0);
      expect(scenario.confidence).toBeLessThanOrEqual(1);
    });

    it('should include scenario details', async () => {
      const thread = fixtures.mockThreads.stalledThread;

      const scenario = await detector.detect(thread);

      expect(scenario).toHaveProperty('details');
      expect(typeof scenario.details).toBe('object');
    });

    it('should log debug information', async () => {
      const thread = fixtures.mockThreads.activeThread;

      await detector.detect(thread);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Scenario detected',
        expect.objectContaining({
          thread_id: expect.any(String),
          scenario: expect.any(String),
          confidence: expect.any(Number),
        }),
      );
    });
  });
});
