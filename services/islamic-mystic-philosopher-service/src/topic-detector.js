/**
 * Topic detector for Islamic philosophical questions.
 * Maps questions to 7 philosophical categories.
 */

export function detectTopic(question: string): string {
  if (!question || question.trim() === '') {
    return 'general';
  }

  const lowerQuestion = question.toLowerCase();

  // Order matters: check specific topics first to avoid keyword collisions
  const topicKeywords: Record<string, string[]> = {
    governance: [
      'society', 'govern', 'government', 'state', 'political', 'rule',
      'law', 'organize', 'organized', 'authority', 'power', 'community'
    ],
    spirituality: [
      'spiritual', 'spirit', 'enlightenment', 'awakening', 'meditation',
      'inner', 'transcendent'
    ],
    theology: [
      'god', 'divine being', 'almighty', 'creator', 'creation',
      'faith', 'religious', 'prayer', 'revelation', 'sacred', 'holy'
    ],
    metaphysics: [
      'being', 'exist', 'existence', 'nature', 'reality', 'substance',
      'essential', 'infinite', 'time', 'space', 'causation', 'cause'
    ],
    aesthetics: [
      'beauty', 'beautiful', 'ugly', 'art', 'artistic', 'aesthetic',
      'taste', 'style', 'grace', 'harmony', 'form', 'appeal'
    ],
    ethics: [
      'wrong', 'right', 'moral', 'morality', 'good', 'bad', 'virtue',
      'justice', 'duty', 'obligation', 'ought', 'should', 'ethical', 'virtuous'
    ],
    epistemology: [
      'knowledge', 'knowing', 'understand', 'learn', 'justify',
      'evidence', 'proof', 'certainty', 'reason', 'rational', 'logic'
    ]
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    for (const keyword of keywords) {
      if (lowerQuestion.includes(keyword)) {
        return topic;
      }
    }
  }

  return 'general';
}
