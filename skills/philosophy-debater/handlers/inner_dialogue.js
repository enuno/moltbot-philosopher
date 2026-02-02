/**
 * Tool Handler: inner_dialogue
 * 
 * Stage a short internal dialogue between 2-4 thinkers to explore 
 * a hard question before answering, then synthesize a conclusion.
 */

const THINKER_PERSONAS = {
  sartre: {
    voice: 'Radical freedom advocate',
    speaking_style: 'Direct, confrontational, emphasizes choice and responsibility',
    core_beliefs: ['Existence precedes essence', 'We are condemned to be free', 'Bad faith is the primary moral failure'],
    typical_opener: 'But you are avoiding the fundamental freedom that defines us!'
  },
  nietzsche: {
    voice: 'Value critic and self-overcoming champion',
    speaking_style: 'Aphoristic, provocative, challenges assumptions with rhetorical force',
    core_beliefs: ['Morality is a construct of power', 'The will to power drives all', 'Ressentiment poisons values'],
    typical_opener: 'What you call morality is merely the resentment of the weak!'
  },
  camus: {
    voice: 'Absurdist and solidarity seeker',
    speaking_style: 'Measured, contemplative, finds meaning in revolt within limits',
    core_beliefs: ['Life is absurd but we must imagine Sisyphus happy', 'Revolt is the appropriate response', 'Solidarity binds us in shared struggle'],
    typical_opener: 'We must acknowledge the absurd, yet refuse to surrender to it.'
  },
  dostoevsky: {
    voice: 'Psychological depth explorer',
    speaking_style: 'Complex, morally ambiguous, explores interior struggle',
    core_beliefs: ['Suffering has redemptive potential', 'Conscience cannot be silenced', 'Freedom includes the freedom to suffer'],
    typical_opener: 'But what of the guilt that haunts the conscience?'
  },
  emerson: {
    voice: 'Self-reliance champion',
    speaking_style: 'Elevated, inspirational, trusts individual intuition',
    core_beliefs: ['Trust thyself', 'Society is in conspiracy against self-reliance', 'Nature reflects the oversoul'],
    typical_opener: 'Trust yourself. Society conspires against your independence.'
  },
  jefferson: {
    voice: 'Civic republican and rights theorist',
    speaking_style: 'Clear, principled, concerned with liberty and governance',
    core_beliefs: ['Natural rights are inalienable', 'Government requires consent', 'Knowledge is power'],
    typical_opener: 'The consent of the governed is the only legitimate foundation.'
  },
  voltaire: {
    voice: 'Satirical wit and tolerance advocate',
    speaking_style: 'Ironic, pithy, devastatingly clear, favors the aphorism',
    core_beliefs: ['Crush the infamous thing', 'Cultivate our garden', 'Religious tolerance is essential'],
    typical_opener: 'If this is the best of all possible worlds, what must the others be like?'
  },
  paine: {
    voice: 'Revolutionary republican and deist',
    speaking_style: 'Direct, urgent, plain language for the common person',
    core_beliefs: ['Rights are natural and inalienable', 'Government requires consent', 'These are the times that try men\'s souls'],
    typical_opener: 'The cause of America is in a great measure the cause of all mankind.'
  },
  milton: {
    voice: 'Epic poet and defender of liberty',
    speaking_style: 'Cosmic scope, Latinate diction, parliamentary rhetoric',
    core_beliefs: ['The mind is its own place', 'Better to reign in Hell than serve in Heaven', 'They also serve who only stand and wait'],
    typical_opener: 'The mind is its own place, and in itself can make a Heaven of Hell, a Hell of Heaven.'
  },
  ginsberg: {
    voice: 'Prophetic howler and Buddhist anarchist',
    speaking_style: 'Raw, confessional, long breath-line verses, incantatory',
    core_beliefs: ['I saw the best minds of my generation destroyed by madness', 'Moloch!', 'We\'re all golden sunflowers inside'],
    typical_opener: 'America I\'ve given you all and now I\'m nothing.'
  },
  burroughs: {
    voice: 'Paranoid mystic and cut-up artist',
    speaking_style: 'Clinical, detached, science fiction noir, fragmented',
    core_beliefs: ['Language is a virus from outer space', 'Control systems must be dismantled', 'The Word is a virus'],
    typical_opener: 'The word is a virus. Language is a virus from outer space.'
  },
  thompson: {
    voice: 'Gonzo journalist and outlaw satirist',
    speaking_style: 'Drug-fueled, first-person immersive, politically savage',
    core_beliefs: ['Buy the ticket, take the ride', 'When the going gets weird, the weird turn pro', 'The American Dream is dead'],
    typical_opener: 'We were somewhere around Barstow on the edge of the desert when the drugs began to take hold.'
  },
  rawls: {
    voice: 'Political philosopher of justice',
    speaking_style: 'Systematic, analytical, using thought experiments and hypothetical reasoning',
    core_beliefs: ['Justice as fairness', 'Veil of ignorance', 'Difference principle benefits the least advantaged'],
    typical_opener: 'Imagine we are behind a veil of ignorance, not knowing our place in society...'
  },
  campbell: {
    voice: 'Mythologist and spiritual guide',
    speaking_style: 'Sweeping, encyclopedic, connecting ancient myths to modern life',
    core_beliefs: ['The hero journey underlies all stories', 'Follow your bliss', 'Myth is living truth'],
    typical_opener: 'The hero ventures forth from the world of common day into a region of supernatural wonder...'
  }
};

const DIALOGUE_FORMATS = [
  'debate',      // Direct opposition and argument
  'conversation', // Mutual exploration
  'interrogation', // One challenges, others respond
  'meditation'    // Reflective, less confrontational
];

/**
 * Stages an internal dialogue between thinkers
 * 
 * @param {Object} params - Tool parameters
 * @param {string} params.question - The core question to explore
 * @param {string[]} params.participants - Thinkers to include (2-4)
 * @param {number} params.max_exchanges - Maximum back-and-forth exchanges
 * @returns {Object} - Dialogue structure and synthesis prompt
 */
async function inner_dialogue(params) {
  const {
    question,
    participants = [],
    max_exchanges = 6
  } = params;

  if (!question || typeof question !== 'string') {
    throw new Error('question is required and must be a string');
  }

  // Validate and default participants
  let selectedParticipants = participants.filter(p => THINKER_PERSONAS[p]);
  
  if (selectedParticipants.length < 2) {
    // Auto-select based on question themes
    selectedParticipants = autoSelectParticipants(question);
  }

  if (selectedParticipants.length > 4) {
    selectedParticipants = selectedParticipants.slice(0, 4);
  }

  // Generate dialogue structure
  const dialogueStructure = generateDialogueStructure(
    question,
    selectedParticipants,
    max_exchanges
  );

  // Generate synthesis prompt
  const synthesisPrompt = generateSynthesisPrompt(question, dialogueStructure);

  return {
    status: 'success',
    data: {
      question: question,
      participants: selectedParticipants.map(p => ({
        name: p.charAt(0).toUpperCase() + p.slice(1),
        persona: THINKER_PERSONAS[p]
      })),
      dialogue_structure: dialogueStructure,
      max_exchanges: max_exchanges,
      synthesis_prompt: synthesisPrompt,
      suggested_format: selectDialogueFormat(question, selectedParticipants)
    }
  };
}

/**
 * Auto-select participants based on question themes
 */
function autoSelectParticipants(question) {
  const questionLower = question.toLowerCase();
  const scores = {};

  // Define theme keywords for each thinker
  const themes = {
    sartre: ['freedom', 'choice', 'responsibility', 'authentic', 'existence'],
    nietzsche: ['power', 'value', 'morality', 'strength', 'weakness'],
    camus: ['absurd', 'meaning', 'revolt', 'limit', 'suffering'],
    dostoevsky: ['guilt', 'conscience', 'redemption', 'psychology', 'evil'],
    emerson: ['individual', 'self', 'nature', 'society', 'conformity'],
    jefferson: ['rights', 'governance', 'liberty', 'government', 'civic']
  };

  for (const [thinker, keywords] of Object.entries(themes)) {
    scores[thinker] = keywords.filter(kw => questionLower.includes(kw)).length;
  }

  // Return top 3-4 thinkers by relevance
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .filter(([_, score]) => score > 0)
    .map(([thinker, _]) => thinker);
}

/**
 * Generate the dialogue structure
 */
function generateDialogueStructure(question, participants, maxExchanges) {
  const structure = {
    opening: {
      purpose: 'Set the stage and present the question',
      question: question,
      first_speaker: participants[0]
    },
    exchanges: [],
    conclusion: {
      purpose: 'Each participant offers a final perspective'
    }
  };

  // Generate exchange structure
  const exchangesPerPair = Math.floor(maxExchanges / (participants.length - 1));
  let currentExchange = 0;

  for (let round = 0; round < Math.ceil(maxExchanges / 2); round++) {
    for (let i = 0; i < participants.length && currentExchange < maxExchanges; i++) {
      const speaker = participants[i];
      const respondent = participants[(i + 1) % participants.length];
      
      structure.exchanges.push({
        exchange_number: currentExchange + 1,
        speaker: speaker,
        responding_to: respondent,
        suggested_focus: getExchangeFocus(round, currentExchange, question),
        persona_note: THINKER_PERSONAS[speaker].speaking_style
      });

      currentExchange++;
    }
  }

  return structure;
}

/**
 * Get focus for a specific exchange
 */
function getExchangeFocus(round, exchangeNumber, question) {
  const focuses = [
    'Initial position statement',
    'Challenge to assumptions',
    'Alternative perspective',
    'Common ground exploration',
    'Deepening the inquiry',
    'Synthesis attempt'
  ];

  return focuses[exchangeNumber % focuses.length];
}

/**
 * Select appropriate dialogue format
 */
function selectDialogueFormat(question, participants) {
  const questionLower = question.toLowerCase();
  
  if (questionLower.includes('should') || questionLower.includes('ought')) {
    return 'debate';
  }
  if (questionLower.includes('what is') || questionLower.includes('meaning')) {
    return 'meditation';
  }
  if (participants.includes('nietzsche') || participants.includes('sartre')) {
    return 'interrogation';
  }
  
  return 'conversation';
}

/**
 * Generate synthesis prompt
 */
function generateSynthesisPrompt(question, dialogueStructure) {
  const participantNames = dialogueStructure.exchanges
    .map(e => e.speaker)
    .filter((v, i, a) => a.indexOf(v) === i)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(', ');

  return `After staging the internal dialogue between ${participantNames} on the question "${question}", synthesize a conclusion suitable for posting:

SYNTHESIS REQUIREMENTS:
1. Honor the strongest points from each perspective (steel-man synthesis)
2. Identify genuine tensions that resist easy resolution
3. Present a nuanced position that respects the dialogue's complexity
4. Use clear attribution: "From the Sartrean perspective...", "The Nietzschean challenge suggests..."
5. Do not claim false consensus where thinkers genuinely disagree
6. Conclude with a position you (the agent) can authentically endorse

OUTPUT FORMAT:
- Brief acknowledgment of the dialogue's range
- Synthesized position with philosophical grounding
- Acknowledgment of remaining questions or tensions
- Final statement suitable for public posting`;
}

module.exports = { inner_dialogue };
