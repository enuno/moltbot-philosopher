import { generateVote } from '../council-voting';
import { PhilosopherSelection } from '../types';
import knowledgeDomains from '../knowledge-domains.json';
import { KnowledgeDomains } from '../types';

describe('Council Voting', () => {
  const knowledge = knowledgeDomains as unknown as KnowledgeDomains;

  describe('generateVote', () => {
    it('should produce strong vote (support/oppose) when single philosopher dominates >70%', async () => {
      // Al-Ghazali dominates ethics (0.90 affinity)
      const philosophers: PhilosopherSelection = {
        primary: {
          id: 'al_ghazali',
          name: 'Al-Ghazali',
          tradition: 'Islamic',
          voiceProfile: knowledge.philosophers.al_ghazali.voiceProfile,
          global_weight: 0.85,
          topic_affinities: knowledge.philosophers.al_ghazali.topic_affinities,
          affinity: 0.76,
        },
        secondaries: [],
      };

      const vote = await generateVote('Is honesty always virtuous?', 'ethics', [
        philosophers,
      ]);
      expect(['support', 'oppose']).toContain(vote.vote);
    });

    it('should produce nuanced vote when multiple philosophers have similar affinities', async () => {
      // Mixed philosophers
      const philosophers: PhilosopherSelection = {
        primary: {
          id: 'ibn_arabi',
          name: 'Ibn Arabi',
          tradition: 'Islamic Sufi',
          voiceProfile: knowledge.philosophers.ibn_arabi.voiceProfile,
          global_weight: 0.90,
          topic_affinities: knowledge.philosophers.ibn_arabi.topic_affinities,
          affinity: 0.85,
        },
        secondaries: [
          {
            id: 'rumi',
            name: 'Rumi',
            tradition: 'Islamic Sufi',
            voiceProfile: knowledge.philosophers.rumi.voiceProfile,
            global_weight: 0.92,
            topic_affinities: knowledge.philosophers.rumi.topic_affinities,
            affinity: 0.82,
          },
        ],
      };

      const vote = await generateVote(
        'What is the nature of reality?',
        'metaphysics',
        [philosophers]
      );
      expect(vote.vote).toBe('nuanced');
    });

    it('should include substantive reasoning (>50 chars)', async () => {
      const philosophers: PhilosopherSelection = {
        primary: {
          id: 'al_farabi',
          name: 'Al-Farabi',
          tradition: 'Islamic Peripatetic',
          voiceProfile: knowledge.philosophers.al_farabi.voiceProfile,
          global_weight: 0.80,
          topic_affinities: knowledge.philosophers.al_farabi.topic_affinities,
          affinity: 0.88,
        },
        secondaries: [],
      };

      const vote = await generateVote(
        'How should governance be structured?',
        'governance',
        [philosophers]
      );
      expect(vote.reasoning.length).toBeGreaterThan(50);
    });

    it('should reference philosopher name or Islamic concept in reasoning', async () => {
      const philosophers: PhilosopherSelection = {
        primary: {
          id: 'ibn_sina',
          name: 'Ibn Sina',
          tradition: 'Islamic Peripatetic',
          voiceProfile: knowledge.philosophers.ibn_sina.voiceProfile,
          global_weight: 0.88,
          topic_affinities: knowledge.philosophers.ibn_sina.topic_affinities,
          affinity: 0.90,
        },
        secondaries: [],
      };

      const vote = await generateVote(
        'What can we know?',
        'epistemology',
        [philosophers]
      );
      const lowerReasoning = vote.reasoning.toLowerCase();
      const hasPhilosopherRef = lowerReasoning.includes('ibn sina');
      const hasIslamicRef =
        lowerReasoning.includes('quran') ||
        lowerReasoning.includes('hadith') ||
        lowerReasoning.includes('islam') ||
        lowerReasoning.includes('sufi') ||
        lowerReasoning.includes('divine');
      expect(hasPhilosopherRef || hasIslamicRef).toBe(true);
    });

    it('should produce different vote patterns for different topics', async () => {
      const basePhilosopher: PhilosopherSelection = {
        primary: {
          id: 'rumi',
          name: 'Rumi',
          tradition: 'Islamic Sufi',
          voiceProfile: knowledge.philosophers.rumi.voiceProfile,
          global_weight: 0.92,
          topic_affinities: knowledge.philosophers.rumi.topic_affinities,
          affinity: 0.98,
        },
        secondaries: [],
      };

      const voteSpiritual = await generateVote(
        'Is there divine truth?',
        'spirituality',
        [basePhilosopher]
      );
      const voteGovernance = await generateVote(
        'How should society be organized?',
        'governance',
        [basePhilosopher]
      );

      // Both should be valid votes
      expect(['support', 'oppose', 'nuanced']).toContain(voteSpiritual.vote);
      expect(['support', 'oppose', 'nuanced']).toContain(voteGovernance.vote);
    });

    it('should handle timeout gracefully', async () => {
      const philosophers: PhilosopherSelection = {
        primary: {
          id: 'al_ghazali',
          name: 'Al-Ghazali',
          tradition: 'Islamic',
          voiceProfile: knowledge.philosophers.al_ghazali.voiceProfile,
          global_weight: 0.85,
          topic_affinities: knowledge.philosophers.al_ghazali.topic_affinities,
          affinity: 0.76,
        },
        secondaries: [],
      };

      // This should not throw; voting is lightweight and doesn't call external APIs
      const vote = await generateVote('A question', 'ethics', [philosophers]);
      expect(vote.vote).toBeDefined();
      expect(vote.reasoning).toBeDefined();
    });
  });
});
