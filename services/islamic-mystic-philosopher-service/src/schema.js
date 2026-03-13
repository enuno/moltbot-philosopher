import Ajv from 'ajv';

const ajv = new Ajv();

/**
 * AJV schema for knowledge-domains.json validation
 * Validates 7 Islamic philosophers with their topic affinities
 */
export const knowledgeDomainsSchema = {
  type: 'object',
  properties: {
    _comment: { type: 'string' },
    philosophers: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['name', 'tradition', 'voiceProfile', 'global_weight', 'topic_affinities'],
        properties: {
          name: { type: 'string', minLength: 1 },
          tradition: { type: 'string', minLength: 1 },
          voiceProfile: {
            type: 'object',
            required: ['tone', 'style', 'formality'],
            properties: {
              tone: { type: 'string', minLength: 1 },
              style: { type: 'string', minLength: 1 },
              formality: { type: 'string', minLength: 1 },
            },
            additionalProperties: false,
          },
          global_weight: {
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
          topic_affinities: {
            type: 'object',
            required: ['epistemology', 'ethics', 'metaphysics', 'theology', 'governance', 'aesthetics', 'spirituality', 'general'],
            properties: {
              epistemology: { type: 'number', minimum: 0, maximum: 1 },
              ethics: { type: 'number', minimum: 0, maximum: 1 },
              metaphysics: { type: 'number', minimum: 0, maximum: 1 },
              theology: { type: 'number', minimum: 0, maximum: 1 },
              governance: { type: 'number', minimum: 0, maximum: 1 },
              aesthetics: { type: 'number', minimum: 0, maximum: 1 },
              spirituality: { type: 'number', minimum: 0, maximum: 1 },
              general: { type: 'number', minimum: 0, maximum: 1 },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      minProperties: 1,
    },
  },
  required: ['philosophers'],
  additionalProperties: true,
};

/**
 * Compile the schema for performance
 */
export const validateKnowledgeDomains = ajv.compile(knowledgeDomainsSchema);

/**
 * Validate knowledge domains data structure
 * @param {Object} data - Knowledge domains object to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateKnowledge(data) {
  const valid = validateKnowledgeDomains(data);

  if (!valid) {
    const errors = ajv.errorsText(validateKnowledgeDomains.errors, { dataVar: 'knowledge' });
    return {
      valid: false,
      errors: [errors],
    };
  }

  // Additional validation: check weight consistency
  const philosophers = Object.entries(data.philosophers);
  const totalWeight = philosophers.reduce((sum, [, philosopher]) => sum + philosopher.global_weight, 0);
  const weightErrors = [];

  // Weights should be reasonably distributed (allow ±0.1 tolerance for practical use)
  if (philosophers.length > 0) {
    const avgWeight = totalWeight / philosophers.length;
    if (Math.abs(avgWeight - (1 / philosophers.length)) > 0.1) {
      weightErrors.push(`Weight distribution warning: average weight ${avgWeight.toFixed(2)}, expected ~${(1 / philosophers.length).toFixed(2)}`);
    }
  }

  // Check that all philosophers have same topic keys
  if (philosophers.length > 0) {
    const firstTopics = Object.keys(philosophers[0][1].topic_affinities);
    for (const [id, philosopher] of philosophers) {
      const topics = Object.keys(philosopher.topic_affinities);
      if (!arraysEqual(topics, firstTopics)) {
        weightErrors.push(`Philosopher ${id} has different topic affinities than others`);
      }
    }
  }

  return {
    valid: weightErrors.length === 0,
    errors: weightErrors,
  };
}

/**
 * Helper to compare arrays
 */
function arraysEqual(a, b) {
  return a.length === b.length && a.every((val, idx) => val === b[idx]);
}
