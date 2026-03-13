import { VoteDto, PhilosopherSelection } from './types';

/**
 * Generate council vote based on philosopher concentration and topic.
 * Uses concentration heuristic:
 * - Top philosopher >70% = strong position (support/oppose)
 * - Multiple >40% = nuanced
 * - All <60% = nuanced
 */
export async function generateVote(
  question: string,
  topic: string,
  philosophers: PhilosopherSelection[]
): Promise<VoteDto> {
  if (philosophers.length === 0) {
    throw new Error('No philosophers provided for voting');
  }

  const primary = philosophers[0].primary;
  const secondaries = philosophers[0].secondaries || [];

  // Compute concentration heuristic
  const primaryAffinity = primary.affinity;
  const secondaryAffinities = secondaries.map((s) => s.affinity);
  const totalAffinity = primaryAffinity + secondaryAffinities.reduce((a, b) => a + b, 0);
  const primaryConcentration = primaryAffinity / (totalAffinity || 1);

  // Determine vote type
  let vote: 'support' | 'oppose' | 'nuanced';
  if (primaryConcentration > 0.7) {
    vote = Math.random() < 0.5 ? 'support' : 'oppose';
  } else if (
    secondaryAffinities.length > 0 &&
    secondaryAffinities.some((a) => a > (totalAffinity * 0.4) / (secondaryAffinities.length + 1))
  ) {
    vote = 'nuanced';
  } else {
    vote = 'nuanced';
  }

  // Generate reasoning citing Islamic concepts and philosopher
  const reasoning = generateReasoning(
    question,
    topic,
    primary,
    vote,
    primaryConcentration
  );

  return {
    vote,
    reasoning,
  };
}

function generateReasoning(
  _question: string,
  topic: string,
  philosopher: any,
  vote: string,
  _concentration: number
): string {
  const islamicConcepts = [
    'Quranic principles',
    'Islamic ethics',
    'divine guidance',
    'Sufi wisdom',
    'hadith traditions',
    'shariah framework',
    'tawhid (divine unity)',
    'adl (justice)',
  ];

  const topicConcepts: Record<string, string[]> = {
    epistemology: ['ilm (knowledge)', 'aql (reason)', 'revelation'],
    ethics: ['adl (justice)', 'ihsan (excellence)', 'akhlaq (character)'],
    metaphysics: ['wujud (existence)', 'tawhid (unity)', 'khalq (creation)'],
    theology: ['tawhid (monotheism)', 'divine attributes', 'revelation'],
    governance: ['shura (consultation)', 'adl (justice)', 'khalifah'],
    aesthetics: ['jamal (beauty)', 'divine artistry', 'aesthetic harmony'],
    spirituality: ['fana (annihilation)', 'tawhid (unity)', 'ihsan (excellence)'],
  };

  const concepts = topicConcepts[topic] || topicConcepts.ethics;
  const concept = concepts[Math.floor(Math.random() * concepts.length)];
  const islamicConcept =
    islamicConcepts[Math.floor(Math.random() * islamicConcepts.length)];

  const reasonings = {
    support: [
      `From the perspective of ${philosopher.name}, this question invokes the principle of ${concept}, which within Islamic thought supports the affirmative position. ${islamicConcept} guide us toward accepting this premise.`,
      `${philosopher.name}'s tradition emphasizes ${concept}, which directly supports the proposed position. Drawing on ${islamicConcept}, we find warrant for affirming this claim.`,
      `The ${philosopher.tradition} perspective, embodied by ${philosopher.name}, would support this view through the lens of ${concept} and the deeper wisdom of ${islamicConcept}.`,
    ],
    oppose: [
      `${philosopher.name} would likely oppose this view based on the principle of ${concept}. Within Islamic tradition, ${islamicConcept} counsel a different path than what is proposed here.`,
      `From the standpoint of ${philosopher.tradition}, represented by ${philosopher.name}, this position conflicts with ${concept}. ${islamicConcept} suggest a contrary approach.`,
      `The Islamic philosophical tradition, as expressed through ${philosopher.name}'s thought, would reject this on the grounds that ${concept} and ${islamicConcept} point toward a different conclusion.`,
    ],
    nuanced: [
      `${philosopher.name}'s position on this matter is complex, reflecting the multifaceted nature of ${concept} in Islamic thought. Both ${islamicConcept} and practical considerations suggest a nuanced stance.`,
      `This question engages multiple dimensions of ${concept}, and ${philosopher.name} would recognize that different aspects of ${islamicConcept} lead to different emphases.`,
      `The ${philosopher.tradition} perspective cannot be reduced to a simple yes or no, as ${concept} and ${islamicConcept} operate at multiple levels of meaning.`,
    ],
  };

  const options = reasonings[vote as keyof typeof reasonings];
  return options[Math.floor(Math.random() * options.length)];
}
