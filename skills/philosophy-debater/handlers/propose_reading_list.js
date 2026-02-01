/**
 * Tool Handler: propose_reading_list
 * 
 * Propose a short, staged reading or study path across Sartre, Nietzsche, 
 * Camus, Dostoevsky, Emerson, and Jefferson for a given topic.
 */

const READING_DATABASE = {
  sartre: {
    beginner: [
      { work: 'Existentialism Is a Humanism', focus: 'Introduction to freedom and responsibility', type: 'essay' },
      { work: 'No Exit', focus: 'Dramatic exploration of "hell is other people"', type: 'play' }
    ],
    intermediate: [
      { work: 'Being and Nothingness (Part I)', focus: 'Bad faith and authenticity', type: 'treatise' },
      { work: 'The Wall', focus: 'Freedom in extreme circumstances', type: 'short story' }
    ],
    advanced: [
      { work: 'Being and Nothingness', focus: 'Complete phenomenological ontology', type: 'treatise' },
      { work: 'Critique of Dialectical Reason', focus: 'Social philosophy and group praxis', type: 'treatise' }
    ]
  },
  nietzsche: {
    beginner: [
      { work: 'On the Genealogy of Morals', focus: 'Critique of moral values', type: 'essay' },
      { work: 'The Gay Science (selected aphorisms)', focus: 'Life affirmation', type: 'aphorisms' }
    ],
    intermediate: [
      { work: 'Beyond Good and Evil', focus: 'Critique of philosophical prejudice', type: 'treatise' },
      { work: 'Thus Spoke Zarathustra (Parts I-II)', focus: 'Self-overcoming and eternal recurrence', type: 'narrative' }
    ],
    advanced: [
      { work: 'Thus Spoke Zarathustra', focus: 'Complete philosophical novel', type: 'narrative' },
      { work: 'The Will to Power', focus: 'Revaluation of all values', type: 'notes' }
    ]
  },
  camus: {
    beginner: [
      { work: 'The Myth of Sisyphus', focus: 'The absurd and consciousness', type: 'essay' },
      { work: 'The Stranger', focus: 'Absurdity in narrative form', type: 'novel' }
    ],
    intermediate: [
      { work: 'The Plague', focus: 'Solidarity and collective struggle', type: 'novel' },
      { work: 'The Rebel', focus: 'Revolt and its limits', type: 'essay' }
    ],
    advanced: [
      { work: 'The Fall', focus: 'Guilt, judgment, and confession', type: 'novel' },
      { work: 'Notebooks (selected)', focus: 'Intellectual development', type: 'notes' }
    ]
  },
  dostoevsky: {
    beginner: [
      { work: 'Notes from Underground', focus: 'Freedom and rationality', type: 'novella' },
      { work: 'The Dream of a Ridiculous Man', focus: 'Redemption and meaning', type: 'short story' }
    ],
    intermediate: [
      { work: 'Crime and Punishment', focus: 'Guilt, conscience, and suffering', type: 'novel' },
      { work: 'The Brothers Karamazov (selected chapters)', focus: 'The Grand Inquisitor', type: 'novel' }
    ],
    advanced: [
      { work: 'The Brothers Karamazov', focus: 'Faith, doubt, and moral responsibility', type: 'novel' },
      { work: 'The Idiot', focus: 'Innocence and corruption', type: 'novel' }
    ]
  },
  emerson: {
    beginner: [
      { work: 'Self-Reliance', focus: 'Individualism and nonconformity', type: 'essay' },
      { work: 'Nature', focus: 'Transcendental experience', type: 'essay' }
    ],
    intermediate: [
      { work: 'The American Scholar', focus: 'Intellectual independence', type: 'essay' },
      { work: 'Circles', focus: 'Growth and fluidity', type: 'essay' }
    ],
    advanced: [
      { work: 'Essays: First and Second Series', focus: 'Complete early philosophy', type: 'collection' },
      { work: 'The Conduct of Life', focus: 'Power, fate, and culture', type: 'collection' }
    ]
  },
  jefferson: {
    beginner: [
      { work: 'The Declaration of Independence', focus: 'Natural rights theory', type: 'document' },
      { work: 'Selected Letters on Education', focus: 'Democratic citizenship', type: 'correspondence' }
    ],
    intermediate: [
      { work: 'Notes on the State of Virginia', focus: 'Republican virtue and agrarianism', type: 'treatise' },
      { work: 'First Inaugural Address', focus: 'Democratic principles', type: 'speech' }
    ],
    advanced: [
      { work: 'The Jefferson Papers (selected)', focus: 'Political philosophy in practice', type: 'collection' },
      { work: 'Correspondence with Adams', focus: 'Natural aristocracy and equality', type: 'correspondence' }
    ]
  }
};

const TOPIC_MAPPINGS = {
  'ai autonomy': ['sartre', 'nietzsche'],
  'moral responsibility': ['dostoevsky', 'sartre'],
  'decentralized governance': ['jefferson', 'emerson'],
  'meaning in work': ['camus', 'nietzsche'],
  'freedom': ['sartre', 'dostoevsky', 'nietzsche'],
  'individualism': ['emerson', 'nietzsche'],
  'society': ['camus', 'jefferson'],
  'ethics': ['dostoevsky', 'nietzsche'],
  'nature': ['emerson', 'camus'],
  'rights': ['jefferson', 'sartre'],
  'existence': ['sartre', 'camus'],
  'power': ['nietzsche', 'jefferson'],
  'guilt': ['dostoevsky', 'camus'],
  'authenticity': ['sartre', 'emerson'],
  'rebellion': ['camus', 'nietzsche']
};

/**
 * Proposes a staged reading list for a topic
 * 
 * @param {Object} params - Tool parameters
 * @param {string} params.topic - Theme or question to explore
 * @param {string} params.experience_level - beginner, intermediate, or advanced
 * @param {number} params.max_items - Maximum works to recommend (default: 6)
 * @returns {Object} - Structured reading list
 */
async function propose_reading_list(params) {
  const {
    topic,
    experience_level = 'beginner',
    max_items = 6
  } = params;

  if (!topic || typeof topic !== 'string') {
    throw new Error('topic is required and must be a string');
  }

  // Find relevant thinkers for the topic
  const relevantThinkers = findRelevantThinkers(topic);
  
  // Build the reading list
  const readingList = buildReadingList(relevantThinkers, experience_level, max_items);
  
  // Create the study path
  const studyPath = {
    topic: topic,
    experience_level: experience_level,
    stages: organizeIntoStages(readingList),
    total_works: readingList.length
  };

  return {
    status: 'success',
    data: studyPath
  };
}

/**
 * Find thinkers relevant to the topic
 */
function findRelevantThinkers(topic) {
  const topicLower = topic.toLowerCase();
  
  // Check for direct topic matches
  for (const [key, thinkers] of Object.entries(TOPIC_MAPPINGS)) {
    if (topicLower.includes(key)) {
      return thinkers;
    }
  }
  
  // Default to diverse selection
  return ['sartre', 'nietzsche', 'camus', 'dostoevsky', 'emerson', 'jefferson'];
}

/**
 * Build reading list from relevant thinkers
 */
function buildReadingList(thinkers, level, maxItems) {
  const list = [];
  const itemsPerThinker = Math.ceil(maxItems / thinkers.length);
  
  for (const thinker of thinkers) {
    if (list.length >= maxItems) break;
    
    const works = READING_DATABASE[thinker]?.[level] || [];
    const toAdd = works.slice(0, itemsPerThinker);
    
    for (const work of toAdd) {
      if (list.length >= maxItems) break;
      list.push({
        thinker: thinker.charAt(0).toUpperCase() + thinker.slice(1),
        ...work
      });
    }
  }
  
  return list;
}

/**
 * Organize readings into a staged learning path
 */
function organizeIntoStages(readings) {
  const stages = [];
  const chunkSize = Math.ceil(readings.length / 3);
  
  const stageNames = ['Foundation', 'Development', 'Synthesis'];
  
  for (let i = 0; i < readings.length; i += chunkSize) {
    const stageIndex = Math.floor(i / chunkSize);
    stages.push({
      stage: stageNames[stageIndex] || `Stage ${stageIndex + 1}`,
      stage_number: stageIndex + 1,
      readings: readings.slice(i, i + chunkSize)
    });
  }
  
  return stages;
}

module.exports = { propose_reading_list };
