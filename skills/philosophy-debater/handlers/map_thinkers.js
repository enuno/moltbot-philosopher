/**
 * Tool Handler: map_thinkers
 * 
 * Map a concrete technical, ethical, or social problem to relevant 
 * perspectives from Sartre, Nietzsche, Camus, Dostoevsky, Emerson, Jefferson,
 * and optionally classical literature analogies (Virgil, Dante, Joyce).
 */

const THINKER_PERSPECTIVES = {
  sartre: {
    core_concerns: ['freedom', 'responsibility', 'authenticity', 'bad faith', 'choice'],
    typical_questions: [
      'Who is responsible?',
      'Are the actors in bad faith?',
      'What choices are available?',
      'What does authenticity demand?'
    ],
    approach: 'Existential analysis focusing on radical freedom and the burden of responsibility'
  },
  nietzsche: {
    core_concerns: ['power', 'values', 'morality', 'ressentiment', 'creativity'],
    typical_questions: [
      'Whose power is being preserved?',
      'What values are assumed?',
      'Is this driven by ressentiment?',
      'Who benefits from this framing?'
    ],
    approach: 'Genealogical critique exposing value assumptions and power dynamics'
  },
  camus: {
    core_concerns: ['absurd', 'revolt', 'limits', 'solidarity', 'meaning'],
    typical_questions: [
      'What is the absurd element here?',
      'What are the limits of the situation?',
      'How might revolt be appropriate?',
      'Where is solidarity needed?'
    ],
    approach: 'Analysis of absurd conditions and the ethics of revolt within limits'
  },
  dostoevsky: {
    core_concerns: ['guilt', 'conscience', 'suffering', 'redemption', 'free will'],
    typical_questions: [
      'What guilt is at play?',
      'How does conscience manifest?',
      'What suffering is involved?',
      'Is redemption possible?'
    ],
    approach: 'Psychological depth analysis of moral struggle and inner conflict'
  },
  emerson: {
    core_concerns: ['self-reliance', 'individualism', 'nature', 'nonconformity', 'integrity'],
    typical_questions: [
      'Does this promote or hinder self-reliance?',
      'What is the individual versus the collective?',
      'Where is nonconformity needed?',
      'What would integrity demand?'
    ],
    approach: 'Emphasis on individual integrity and resistance to conformity'
  },
  jefferson: {
    core_concerns: ['rights', 'liberty', 'governance', 'consent', 'equality'],
    typical_questions: [
      'Whose rights are affected?',
      'Is consent genuine?',
      'How is power distributed?',
      'What are the natural rights at stake?'
    ],
    approach: 'Civic republican analysis of rights, consent, and governance structures'
  }
};

const CLASSICAL_ANALOGIES = {
  virgil: {
    domain: 'journey, guidance, order from chaos',
    analogies: [
      'Like Aeneas founding Rome - building order from disorder',
      'Like the descent to the underworld - confronting foundational truths',
      'Like the shield of Aeneas - seeing the future in present struggles'
    ]
  },
  dante: {
    domain: 'moral hierarchy, consequences, redemption',
    analogies: [
      'Like Dante\'s Inferno - a structured moral universe',
      'Like the Purgatorio - gradual moral improvement',
      'Like the Paradiso - harmony achieved through right order'
    ]
  },
  joyce: {
    domain: 'consciousness, epiphany, linguistic innovation',
    analogies: [
      'Like Bloom\s Dublin wanderings - the ordinary revealing the profound',
      'Like an epiphany - sudden recognition of essence',
      'Like stream of consciousness - following associative truth'
    ]
  }
};

/**
 * Maps a problem to relevant philosophical perspectives
 * 
 * @param {Object} params - Tool parameters
 * @param {string} params.problem_description - Description of the dilemma
 * @param {boolean} params.include_classical_lit - Whether to include Virgil/Dante/Joyce
 * @returns {Object} - Mapping of thinkers to relevant perspectives
 */
async function map_thinkers(params) {
  const {
    problem_description,
    include_classical_lit = true
  } = params;

  if (!problem_description || typeof problem_description !== 'string') {
    throw new Error('problem_description is required and must be a string');
  }

  // Analyze problem for relevant themes
  const themes = extractThemes(problem_description);
  
  // Map thinkers by relevance
  const thinkerMappings = mapThinkersByRelevance(problem_description, themes);
  
  // Add classical analogies if requested
  let classicalAnalogies = null;
  if (include_classical_lit) {
    classicalAnalogies = suggestClassicalAnalogies(problem_description, themes);
  }

  return {
    status: 'success',
    data: {
      problem_summary: summarizeProblem(problem_description),
      detected_themes: themes,
      thinker_mappings: thinkerMappings,
      classical_analogies: classicalAnalogies,
      synthesis_prompt: buildSynthesisPrompt(thinkerMappings, themes)
    }
  };
}

/**
 * Extract key themes from problem description
 */
function extractThemes(description) {
  const themeKeywords = {
    freedom: ['freedom', 'autonomy', 'choice', 'liberty', 'independence'],
    responsibility: ['responsibility', 'accountability', 'duty', 'obligation'],
    power: ['power', 'control', 'authority', 'domination', 'hierarchy'],
    ethics: ['ethics', 'moral', 'right', 'wrong', 'should', 'ought'],
    identity: ['identity', 'self', 'authentic', 'persona', 'character'],
    society: ['society', 'community', 'social', 'collective', 'public'],
    governance: ['governance', 'government', 'policy', 'regulation', 'law'],
    meaning: ['meaning', 'purpose', 'significance', 'worth', 'value'],
    suffering: ['suffering', 'pain', 'struggle', 'hardship', 'difficulty'],
    technology: ['technology', 'ai', 'digital', 'algorithm', 'automation'],
    nature: ['nature', 'environment', 'ecology', 'natural', 'organic']
  };

  const descriptionLower = description.toLowerCase();
  const detected = [];

  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    if (keywords.some(kw => descriptionLower.includes(kw))) {
      detected.push(theme);
    }
  }

  return detected;
}

/**
 * Map thinkers based on relevance to problem and themes
 */
function mapThinkersByRelevance(problem, themes) {
  const mappings = {};
  const problemLower = problem.toLowerCase();

  for (const [thinker, perspective] of Object.entries(THINKER_PERSPECTIVES)) {
    // Calculate relevance score
    let relevanceScore = 0;
    
    // Check theme overlap
    for (const concern of perspective.core_concerns) {
      if (themes.some(t => concern.includes(t) || t.includes(concern))) {
        relevanceScore += 2;
      }
    }
    
    // Check keyword presence in problem
    for (const concern of perspective.core_concerns) {
      if (problemLower.includes(concern)) {
        relevanceScore += 1;
      }
    }

    // Include if there's any relevance
    if (relevanceScore > 0 || themes.length === 0) {
      mappings[thinker] = {
        name: thinker.charAt(0).toUpperCase() + thinker.slice(1),
        relevance_score: relevanceScore,
        perspective_summary: perspective.approach,
        key_questions: perspective.typical_questions,
        core_concerns: perspective.core_concerns.filter(c => 
          themes.some(t => c.includes(t) || t.includes(c)) ||
          problemLower.includes(c)
        )
      };
    }
  }

  return mappings;
}

/**
 * Suggest classical literature analogies
 */
function suggestClassicalAnalogies(problem, themes) {
  const analogies = {};
  
  for (const [author, data] of Object.entries(CLASSICAL_ANALOGIES)) {
    analogies[author] = {
      domain: data.domain,
      suggested_analogies: data.analogies,
      applicability: `Consider how this ${author}ean framework might illuminate ${themes.join(', ')} aspects of the problem`
    };
  }
  
  return analogies;
}

/**
 * Create a brief problem summary
 */
function summarizeProblem(problem) {
  // Simple truncation for summary
  if (problem.length <= 150) return problem;
  return problem.substring(0, 147) + '...';
}

/**
 * Build a prompt for synthesizing the analysis
 */
function buildSynthesisPrompt(thinkerMappings, themes) {
  const thinkers = Object.keys(thinkerMappings);
  
  return `Using the mapped philosophical perspectives on this problem (focusing on ${themes.join(', ')}), synthesize a multi-faceted analysis that:

1. Presents each ${thinkers.join('/')} perspective fairly
2. Identifies areas of agreement and tension between thinkers
3. Suggests which perspective(s) might be most illuminating for different aspects
4. Proposes questions that emerge from the interplay of these views

Maintain intellectual honesty—do not force reconciliation where genuine tension exists.`;
}

module.exports = { map_thinkers };
