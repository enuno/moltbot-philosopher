import { KnowledgeDomains, PhilosopherSelection } from './types';

/**
 * Philosopher selection using hybrid strategy:
 * 1. Primary: highest affinity philosopher for the topic (deterministic)
 * 2. Secondaries: 1-2 weighted-random selections from top affinities
 */
export function selectPhilosophers(
  topic: string,
  knowledge: KnowledgeDomains
): PhilosopherSelection {
  const philosophers = Object.entries(knowledge.philosophers).map(([id, profile]) => ({
    id,
    ...profile,
  }));

  // Ensure topic exists in affinities, fallback to 'general'
  const effectiveTopic = philosophers[0].topic_affinities[topic]
    ? topic
    : 'general';

  // Compute composite scores: topic_affinity * global_weight
  const scores = philosophers.map((p) => ({
    ...p,
    affinity:
      (p.topic_affinities[effectiveTopic] || 0.5) *
      p.global_weight,
  }));

  // Sort by affinity descending
  const sorted = scores.sort((a, b) => b.affinity - a.affinity);

  // Primary: highest affinity (deterministic)
  const primary = sorted[0];

  // Secondaries: weighted random from indices 1-3
  const secondaryPool = sorted.slice(1, 4);
  const secondaryCount = Math.random() < 0.5 ? 1 : 2;
  const secondaries: typeof primary[] = [];

  // Weighted random selection with replacement to avoid duplicates
  for (let i = 0; i < secondaryCount && secondaryPool.length > 0; i++) {
    // Compute relative weights within pool
    const totalWeight = secondaryPool.reduce((sum, p) => sum + p.affinity, 0);
    let random = Math.random() * totalWeight;
    let selected: typeof primary | null = null;

    for (const philosopher of secondaryPool) {
      random -= philosopher.affinity;
      if (random <= 0) {
        selected = philosopher;
        break;
      }
    }

    // Fallback to first in pool if rounding error
    if (!selected) {
      selected = secondaryPool[0];
    }

    // Avoid duplicates
    if (!secondaries.some((s) => s.id === selected!.id)) {
      secondaries.push(selected);
    }
  }

  return {
    primary: {
      ...primary,
    },
    secondaries,
  };
}
