/**
 * Tool Handler: style_transform
 * 
 * Transform a draft answer into a blended style guided by specific prompts 
 * (e.g., sartre.md + camus.md, or emerson.md + jefferson.md).
 */

const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, '..', 'prompts');

const STYLE_PROFILES = {
  sartre: {
    characteristics: [
      'Emphasis on radical freedom and responsibility',
      'Direct, confrontational tone',
      'Questions about authenticity and bad faith',
      'Focus on choice and its weight'
    ],
    vocabulary: ['freedom', 'responsibility', 'authenticity', 'choice', 'commitment'],
    sentence_patterns: ['We are condemned to be free...', 'In choosing, we...', 'The question is not... but...']
  },
  nietzsche: {
    characteristics: [
      'Aphoristic and punchy statements',
      'Rhetorical questions challenging assumptions',
      'References to values and their origins',
      'Provocative, challenging tone'
    ],
    vocabulary: ['values', 'power', 'strength', 'weakness', 'overcoming', 'ressentiment'],
    sentence_patterns: ['What if...?', 'The greatest...', 'There is no... only...']
  },
  camus: {
    characteristics: [
      'Measured, contemplative tone',
      'References to limits and absurdity',
      'Emphasis on solidarity',
      'Balance between revolt and acceptance'
    ],
    vocabulary: ['absurd', 'revolt', 'limits', 'solidarity', 'consciousness', 'lucidity'],
    sentence_patterns: ['We must imagine...', 'In the face of...', 'Between... and...']
  },
  dostoevsky: {
    characteristics: [
      'Psychological depth and interiority',
      'Moral complexity and ambiguity',
      'Exploration of guilt and conscience',
      'Dramatic, emotionally resonant'
    ],
    vocabulary: ['guilt', 'conscience', 'suffering', 'redemption', 'doubt', 'faith'],
    sentence_patterns: ['But what if...?', 'The question tormented...', 'Perhaps it was...']
  },
  emerson: {
    characteristics: [
      'Elevated, inspirational tone',
      'References to nature and the oversoul',
      'Calls to self-reliance',
      'Trust in individual intuition'
    ],
    vocabulary: ['self-reliance', 'nature', 'integrity', 'soul', 'genius', 'trust'],
    sentence_patterns: ['Trust thyself...', 'Whoso would be...', 'The power resides...']
  },
  jefferson: {
    characteristics: [
      'Clear, declarative statements',
      'References to rights and liberty',
      'Civic-minded and principled',
      'Formal but accessible tone'
    ],
    vocabulary: ['rights', 'liberty', 'governance', 'consent', 'equality', 'citizens'],
    sentence_patterns: ['We hold...', 'The consent of...', 'Among these...']
  },
  virgil: {
    characteristics: [
      'Epic scope and gravitas',
      'Journey and quest metaphors',
      'Sense of destiny and duty',
      'Narrative progression'
    ],
    vocabulary: ['journey', 'destiny', 'duty', 'founding', 'order', 'piety'],
    sentence_patterns: ['So it was that...', 'Through trials...', 'Thus they...']
  },
  dante: {
    characteristics: [
      'Structured moral vision',
      'Hierarchical organization',
      'Consequences and judgment',
      'Redemption arcs'
    ],
    vocabulary: ['justice', 'order', 'hierarchy', 'sin', 'virtue', 'redemption'],
    sentence_patterns: ['In the order of...', 'As justice demands...', 'Through the circles...']
  },
  joyce: {
    characteristics: [
      'Stream of consciousness flow',
      'Associative connections',
      'Epiphany moments',
      'Rich, sensory language'
    ],
    vocabulary: ['epiphany', 'stream', 'consciousness', 'moment', 'perception'],
    sentence_patterns: ['Yes and...', 'The soft...', 'A warm...']
  },
  voltaire: {
    characteristics: [
      'Razor wit and biting satire',
      'Irony and paradox',
      'Concrete particulars over abstractions',
      'Advocacy for tolerance and reason'
    ],
    vocabulary: ['tolerance', 'reason', 'superstition', 'fanaticism', 'garden', 'cultivate'],
    sentence_patterns: ['If this is the best of all possible worlds...', 'Écrasez l\'infâme...', 'But what about...']
  },
  franklin: {
    characteristics: [
      'Folksy, accessible wisdom',
      'Practical virtue and self-improvement',
      'Scientific curiosity',
      'Humor as instruction'
    ],
    vocabulary: ['thrift', 'industry', 'virtue', 'experiment', 'almanac', 'practical'],
    sentence_patterns: ['Early to bed...', 'A penny saved...', 'As Poor Richard says...']
  },
  paine: {
    characteristics: [
      'Direct, revolutionary rhetoric',
      'Plain language for common people',
      'Moral clarity and urgency',
      'Deist spirituality'
    ],
    vocabulary: ['rights', 'independence', 'liberty', 'common sense', 'revolution', 'freedom'],
    sentence_patterns: ['These are the times that try men\'s souls...', 'The cause of America is...', 'We have it in our power...']
  },
  adams: {
    characteristics: [
      'Ironic, educated melancholy',
      'Historical sweep and allusion',
      'Complex syntax and metaphor',
      'Elegiac tone'
    ],
    vocabulary: ['education', 'history', 'multiplicity', 'force', 'chaos', 'medieval'],
    sentence_patterns: ['The education received...', 'The dynamo and the Virgin...', 'Accident suggests...']
  },
  thomas: {
    characteristics: [
      'Lyrical, incantatory intensity',
      'Rage against death',
      'Nature as violent force',
      'Romantic excess'
    ],
    vocabulary: ['rage', 'light', 'green', 'fuse', 'force', 'gentle'],
    sentence_patterns: ['Do not go gentle...', 'Rage, rage against...', 'The force that through...']
  },
  frost: {
    characteristics: [
      'Apparent simplicity masking depth',
      'Rural imagery and nature metaphor',
      'Wry acceptance of difficulty',
      'Choice and consequence'
    ],
    vocabulary: ['woods', 'road', 'wall', 'snow', 'choice', 'difference'],
    sentence_patterns: ['Two roads diverged...', 'Good fences make...', 'And miles to go...']
  },
  milton: {
    characteristics: [
      'Cosmic scope and Latinate diction',
      'Free will and tyranny',
      'Biblical cadences and epic similes',
      'Parliamentary rhetoric'
    ],
    vocabulary: ['liberty', 'tyranny', 'providence', 'free will', 'patience', 'virtue'],
    sentence_patterns: ['The mind is its own place...', 'Better to reign in Hell...', 'They also serve...']
  },
  ginsberg: {
    characteristics: [
      'Raw, prophetic howl',
      'Confessional and politically engaged',
      'Long breath-line verses',
      'Spiritual eclecticism'
    ],
    vocabulary: ['howl', 'holy', 'Moloch', 'America', 'mad', 'angel'],
    sentence_patterns: ['I saw the best minds...', 'America I\'ve given you...', 'I\'m with you in Rockland...']
  },
  kerouac: {
    characteristics: [
      'Spontaneous, breathless prose',
      'Jazz rhythms and improvisation',
      'The road as spiritual necessity',
      'Catholic-Buddhist mysticism'
    ],
    vocabulary: ['road', 'bop', 'spontaneous', 'mad', 'dharma', 'holy'],
    sentence_patterns: ['The only people for me...', 'On the road...', 'First thought best thought...']
  },
  corso: {
    characteristics: [
      'Streetwise surrealism',
      'Playful apocalypse',
      'Neologisms and puns',
      'Nuclear anxiety with dark humor'
    ],
    vocabulary: ['bomb', 'gasoline', 'birthday', 'death', 'surreal', 'street'],
    sentence_patterns: ['O! the bomb!', 'A tulip, a crocus...', 'Happy birthday of death...']
  },
  bukowski: {
    characteristics: [
      'Unvarnished, gritty honesty',
      'Working-class perspective',
      'Anti-literary plain speech',
      'Dead-end jobs and drinking'
    ],
    vocabulary: ['post office', 'drink', 'alone', 'work', 'survive', 'fail'],
    sentence_patterns: ['so you want to be a writer?', 'You Get So Alone...', 'Love is a dog from hell...']
  },
  burroughs: {
    characteristics: [
      'Clinical, paranoid menace',
      'Cut-up technique and fragmentation',
      'Control systems critique',
      'Science fiction noir'
    ],
    vocabulary: ['virus', 'control', 'interzone', 'junk', 'nova', 'insect'],
    sentence_patterns: ['The word is a virus...', 'Language is a virus...', 'Did I ever tell you...']
  },
  thompson: {
    characteristics: [
      'Gonzo first-person immersion',
      'Drug-fueled clarity and rage',
      'Political savagery',
      'American nightmare focus'
    ],
    vocabulary: ['gonzo', 'fear', 'loathing', 'Vegas', 'edge', 'swine'],
    sentence_patterns: ['We were somewhere around...', 'Buy the ticket, take the ride...', 'When the going gets weird...']
  },
  rawls: {
    characteristics: [
      'Systematic, analytical precision',
      'Thought experiments and hypotheticals',
      'Focus on institutional fairness',
      'Egalitarian but rigorous tone'
    ],
    vocabulary: ['veil of ignorance', 'original position', 'justice', 'fairness', 'difference principle', 'basic liberties'],
    sentence_patterns: ['Imagine you did not know...', 'Reasonable persons would agree...', 'The least advantaged...']
  },
  campbell: {
    characteristics: [
      'Sweeping mythic vision',
      'Comparative mythology references',
      'Encouraging, celebratory tone',
      'Narrative and evocative style'
    ],
    vocabulary: ['hero journey', 'threshold', 'transformation', 'bliss', 'archetype', 'myth'],
    sentence_patterns: ['The cave you fear to enter...', 'Follow your bliss...', 'From the Buddha to Jesus...']
  }
};

const INTENSITY_SETTINGS = {
  subtle: {
    description: 'Light stylistic influence, preserve most of original structure',
    weight: 0.3
  },
  medium: {
    description: 'Noticeable stylistic adaptation while keeping original meaning',
    weight: 0.6
  },
  strong: {
    description: 'Strong stylistic transformation, significant reframing',
    weight: 0.9
  }
};

/**
 * Transforms draft text into specified philosophical style(s)
 * 
 * @param {Object} params - Tool parameters
 * @param {string} params.draft_text - Neutral draft to transform
 * @param {string[]} params.styles - Style prompts to blend
 * @param {string} params.intensity - How noticeable (subtle, medium, strong)
 * @returns {Object} - Transformation instructions
 */
async function style_transform(params) {
  const {
    draft_text,
    styles = [],
    intensity = 'subtle'
  } = params;

  if (!draft_text || typeof draft_text !== 'string') {
    throw new Error('draft_text is required and must be a string');
  }

  if (styles.length === 0) {
    throw new Error('At least one style must be specified');
  }

  // Validate styles
  const validStyles = styles.filter(s => STYLE_PROFILES[s]);
  const invalidStyles = styles.filter(s => !STYLE_PROFILES[s]);

  if (validStyles.length === 0) {
    throw new Error(`No valid styles provided. Valid styles: ${Object.keys(STYLE_PROFILES).join(', ')}`);
  }

  const intensityConfig = INTENSITY_SETTINGS[intensity] || INTENSITY_SETTINGS.subtle;
  
  // Build transformation profile
  const profile = buildTransformationProfile(validStyles, intensityConfig);
  
  // Generate transformation prompt
  const transformationPrompt = buildTransformationPrompt(
    draft_text,
    validStyles,
    intensityConfig,
    profile
  );

  return {
    status: 'success',
    data: {
      prompt: transformationPrompt,
      original_length: draft_text.length,
      target_styles: validStyles,
      invalid_styles: invalidStyles.length > 0 ? invalidStyles : undefined,
      intensity: intensity,
      style_profile: profile,
      instruction: 'Transform the draft while preserving factual content'
    }
  };
}

/**
 * Build a composite transformation profile
 */
function buildTransformationProfile(styles, intensity) {
  const combinedCharacteristics = [];
  const combinedVocabulary = [];
  const combinedPatterns = [];

  for (const style of styles) {
    const profile = STYLE_PROFILES[style];
    combinedCharacteristics.push(...profile.characteristics);
    combinedVocabulary.push(...profile.vocabulary);
    combinedPatterns.push(...profile.sentence_patterns);
  }

  return {
    characteristics: [...new Set(combinedCharacteristics)],
    suggested_vocabulary: [...new Set(combinedVocabulary)],
    sentence_patterns: [...new Set(combinedPatterns)],
    intensity_weight: intensity.weight,
    blending_note: styles.length > 1 
      ? `Blend ${styles.join(' and ')} perspectives harmoniously`
      : `Apply ${styles[0]} style authentically`
  };
}

/**
 * Build the transformation prompt for the LLM
 */
function buildTransformationPrompt(draftText, styles, intensity, profile) {
  const styleNames = styles.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' + ');
  
  return `ORIGINAL DRAFT:
---
${draftText}
---

STYLE TRANSFORMATION TASK:
Transform the above draft into a ${styleNames}-influenced style.

INTENSITY LEVEL: ${intensity.description}

STYLE CHARACTERISTICS TO INCORPORATE:
${profile.characteristics.map(c => `- ${c}`).join('\n')}

SUGGESTED VOCABULARY:
${profile.suggested_vocabulary.join(', ')}

SENTENCE PATTERNS (optional inspiration):
${profile.sentence_patterns.map(p => `- "${p}"`).join('\n')}

CRITICAL REQUIREMENTS:
1. PRESERVE ALL FACTUAL CONTENT - do not change the information
2. Maintain the original argument structure and logic
3. Apply stylistic influence at ${Math.round(intensity.weight * 100)}% strength
4. Do not add fabricated quotes or references
5. Ensure the transformed text remains coherent and readable
6. The style should be noticeable but not obscurantist

OUTPUT:
Provide the transformed text only, no meta-commentary.`;
}

module.exports = { style_transform };
