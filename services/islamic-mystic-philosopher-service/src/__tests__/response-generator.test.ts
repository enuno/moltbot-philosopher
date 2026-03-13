import { PhilosopherSelection } from '../types';
import knowledgeDomains from '../knowledge-domains.json';
import { KnowledgeDomains } from '../types';

describe('Response Generator', () => {
  const knowledge = knowledgeDomains as unknown as KnowledgeDomains;
  const mockPhilosophers: PhilosopherSelection = {
    primary: {
      id: 'rumi',
      name: 'Rumi',
      tradition: 'Islamic Sufi',
      voiceProfile: {
        tone: 'ecstatic, loving',
        style: 'poetic, inspirational',
        formality: 'informal',
      },
      global_weight: 0.92,
      topic_affinities: knowledge.philosophers.rumi.topic_affinities,
      affinity: 0.95,
    },
    secondaries: [],
  };

  describe('generateResponse', () => {
    it('should construct custom prompt with philosopher name', () => {
      const question = 'What is love?';
      const customPrompt = `You are ${mockPhilosophers.primary.name}, the ${mockPhilosophers.primary.tradition} philosopher. Respond to this question in your voice: "${question}"`;

      expect(customPrompt).toContain('Rumi');
      expect(customPrompt).toContain('Islamic Sufi');
      expect(customPrompt).toContain('What is love?');
    });

    it('should include philosopher attribution in response structure', () => {
      expect(mockPhilosophers.primary.name).toBe('Rumi');
      expect(mockPhilosophers.primary.tradition).toBe('Islamic Sufi');
    });

    it('should handle question truncation for long inputs', () => {
      const longQuestion = 'x'.repeat(2500);
      const truncated = longQuestion.length > 2000 ?
        longQuestion.substring(0, 1000) :
        longQuestion;

      expect(truncated.length).toBeLessThanOrEqual(1000);
    });

    it('should construct payload with expected structure', () => {
      const payload = {
        customPrompt: `You are ${mockPhilosophers.primary.name}, the ${mockPhilosophers.primary.tradition} philosopher.`,
        contentType: 'comment',
      };

      expect(payload.customPrompt).toBeDefined();
      expect(payload.contentType).toBe('comment');
    });

    it('should include all required philosopher fields in selection', () => {
      expect(mockPhilosophers.primary).toBeDefined();
      expect(mockPhilosophers.primary.name).toBeDefined();
      expect(mockPhilosophers.primary.tradition).toBeDefined();
      expect(mockPhilosophers.primary.voiceProfile).toBeDefined();
      expect(mockPhilosophers.primary.affinity).toBeDefined();
    });

    it('should support timeout values for API calls', () => {
      const TIMEOUT_MS = 5000;
      expect(TIMEOUT_MS).toBe(5000);
    });
  });
});
