import { selectPhilosophers } from '../philosopher-selector';
import knowledgeDomains from '../knowledge-domains.json';
import { KnowledgeDomains } from '../types';

describe('Philosopher Selector', () => {
  const knowledge = knowledgeDomains as unknown as KnowledgeDomains;

  describe('selectPhilosophers', () => {
    it('should select ethics-focused philosopher with high affinity', () => {
      const selection = selectPhilosophers('ethics', knowledge);
      expect(selection.primary).toBeDefined();
      expect(selection.primary.affinity).toBeGreaterThan(0.75);
    });

    it('should select metaphysics-focused philosopher with high affinity for metaphysics', () => {
      const selection = selectPhilosophers('metaphysics', knowledge);
      expect(selection.primary).toBeDefined();
      expect(selection.primary.affinity).toBeGreaterThan(0.75);
    });

    it('should select governance-focused philosopher with high governance affinity', () => {
      const selection = selectPhilosophers('governance', knowledge);
      expect(selection.primary).toBeDefined();
      expect(selection.primary.affinity).toBeGreaterThan(0.70);
    });

    it('should use hybrid strategy: deterministic primary plus 1-2 weighted secondary philosophers', () => {
      const selection = selectPhilosophers('theology', knowledge);
      expect(selection.primary).toBeDefined();
      expect(selection.primary.id).toBeDefined();
      expect(selection.secondaries).toBeDefined();
      expect(selection.secondaries.length).toBeGreaterThanOrEqual(1);
      expect(selection.secondaries.length).toBeLessThanOrEqual(2);
      expect(selection.secondaries.every((s) => s.id !== selection.primary.id)).toBe(true);
    });

    it('should include philosopher name, affinity, and voiceProfile in selection', () => {
      const selection = selectPhilosophers('spirituality', knowledge);
      expect(selection.primary.name).toBeDefined();
      expect(selection.primary.affinity).toBeDefined();
      expect(selection.primary.voiceProfile).toBeDefined();
      expect(selection.primary.voiceProfile.tone).toBeDefined();
      expect(selection.primary.voiceProfile.style).toBeDefined();
      expect(selection.primary.voiceProfile.formality).toBeDefined();
    });

    it('should distribute secondary philosophers approximately according to configured weights over 100 runs', () => {
      const topic = 'epistemology';
      const secondaryDistribution: Record<string, number> = {};

      for (let i = 0; i < 100; i++) {
        const selection = selectPhilosophers(topic, knowledge);
        for (const secondary of selection.secondaries) {
          secondaryDistribution[secondary.id] =
            (secondaryDistribution[secondary.id] || 0) + 1;
        }
      }

      // Verify at least 2 different philosophers appear as secondaries across runs
      const uniqueSecondaries = Object.keys(secondaryDistribution);
      expect(uniqueSecondaries.length).toBeGreaterThanOrEqual(2);

      // Verify distribution shows variation (no single philosopher gets 100%)
      const maxCount = Math.max(...Object.values(secondaryDistribution));
      expect(maxCount).toBeLessThan(100);
    });
  });
});
