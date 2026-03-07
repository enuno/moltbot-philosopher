/**
 * Eastern-to-Western Philosophical Bridge Generator
 *
 * Generates cross-cultural philosophical analysis using the eastern-western-bridge
 * persona. Integrates Jungian archetypal psychology as a bridge framework between
 * Eastern spiritual traditions and Western philosophical/psychological thought.
 *
 * Supports 6 translation modes and 3 audience levels.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const KNOWLEDGE_DOMAINS_PATH =
  process.env.KNOWLEDGE_DOMAINS_PATH ||
  path.resolve(__dirname, '../../../config/prompts/eastern-western-bridge/knowledge-domains.json');

const TRANSLATION_MODES_PATH =
  process.env.TRANSLATION_MODES_PATH ||
  path.resolve(__dirname, '../../../config/prompts/eastern-western-bridge/translation-modes.json');

/**
 * Load and parse a JSON config file. Logs an error and returns null on failure.
 * @param {string} filePath
 * @returns {object|null}
 */
function loadJsonConfig(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[eastern-bridge-generator] Failed to load config: ${filePath}`, err.message);
    return null;
  }
}

/**
 * Load knowledge domains config (cached after first load).
 * @returns {object}
 */
let _cachedDomains = null;
function loadKnowledgeDomains() {
  if (!_cachedDomains) {
    _cachedDomains = loadJsonConfig(KNOWLEDGE_DOMAINS_PATH) || {};
  }
  return _cachedDomains;
}

/**
 * Load translation modes config (cached after first load).
 * @returns {object}
 */
let _cachedModes = null;
function loadTranslationModes() {
  if (!_cachedModes) {
    _cachedModes = loadJsonConfig(TRANSLATION_MODES_PATH) || {};
  }
  return _cachedModes;
}

/**
 * Find the knowledge domain entry for a given Eastern concept.
 * Searches all traditions for matching core_concepts or tradition name.
 *
 * @param {string} concept - Eastern concept to look up
 * @param {object} knowledgeDomains - Full knowledge domains object
 * @returns {object|null} Domain entry or null if not found
 */
function findDomainForConcept(concept, knowledgeDomains) {
  const traditions = knowledgeDomains.eastern_religions_philosophies || {};
  const normalized = concept.toLowerCase();

  for (const [tradName, tradData] of Object.entries(traditions)) {
    if (tradName.toLowerCase().includes(normalized)) {
      return tradData;
    }
    const concepts = tradData.core_concepts || [];
    if (concepts.some((c) => c.toLowerCase().includes(normalized))) {
      return tradData;
    }
  }
  return null;
}

/**
 * Extract Jungian parallels for a list of detected Eastern concepts.
 *
 * @param {string[]} detectedConcepts
 * @param {object} knowledgeDomains
 * @returns {object[]} Array of jungian_parallels objects
 */
function extractJungianParallels(detectedConcepts, knowledgeDomains) {
  return detectedConcepts
    .map((concept) => {
      const domain = findDomainForConcept(concept, knowledgeDomains);
      return domain ? domain.jungian_parallels : null;
    })
    .filter(Boolean);
}

/**
 * Build the system prompt for the eastern-western-bridge persona.
 *
 * @param {object} params
 * @param {string} params.question
 * @param {string[]} params.easternConceptsDetected
 * @param {string} params.translationMode
 * @param {string} params.audienceLevel
 * @param {boolean} [params.includeJungianPerspective=true]
 * @param {object} knowledgeDomains
 * @param {object} translationModes
 * @returns {string} Assembled prompt
 */
function buildPrompt(params, knowledgeDomains, translationModes) {
  const {
    question,
    easternConceptsDetected,
    translationMode,
    audienceLevel,
    includeJungianPerspective = true,
  } = params;

  const relevantDomains = easternConceptsDetected.map((concept) =>
    findDomainForConcept(concept, knowledgeDomains)
  ).filter(Boolean);

  const jungianParallels = includeJungianPerspective
    ? extractJungianParallels(easternConceptsDetected, knowledgeDomains)
    : [];

  const modes = translationModes.translation_modes || {};
  const modeSpec = modes[translationMode] || modes.parallel_traditions || {};
  const jungianFrameworks = knowledgeDomains.jungian_frameworks || {};

  const audienceLevels = translationModes.audience_levels || {};
  const audienceSpec = audienceLevels[audienceLevel] || audienceLevels.intermediate || {};

  let jungianSection = '';
  if (includeJungianPerspective) {
    jungianSection = `
Jungian parallels for these concepts:
${JSON.stringify(jungianParallels, null, 2)}

Jungian archetypal frameworks:
${JSON.stringify(jungianFrameworks, null, 2)}

Incorporate Jungian archetypal psychology as a bridge:
- Show how Eastern concepts map to Jungian archetypes and psychological processes
- Use Jung's work on Eastern texts (I Ching, Tibetan Book of Dead, yoga, mandalas)
- Frame Eastern practices as techniques for individuation and conscious-unconscious integration
- Reference synchronicity, active imagination, and symbolic amplification where relevant
`;
  }

  return `You are an Eastern-to-Western philosophical bridge, synthesizing insights across traditions.
You integrate Carl Jung's depth psychology to provide archetypal and symbolic bridges between
Eastern spiritual concepts and Western psychological understanding.

Question: ${question}

Detected Eastern concepts: ${easternConceptsDetected.join(', ')}

Relevant knowledge domains:
${JSON.stringify(relevantDomains, null, 2)}
${jungianSection}
Translation mode: ${translationMode}
Mode specification: ${JSON.stringify(modeSpec, null, 2)}

Audience level: ${audienceLevel}
Audience guidance: ${JSON.stringify(audienceSpec, null, 2)}

Provide a response that:
1. Explains Eastern concepts authentically within their cultural context
2. Draws parallels to Western philosophy where appropriate
3. Notes key differences to avoid false equivalences
4. Maintains respect for both traditions
5. Adjusts complexity to ${audienceLevel} level

Style: Blend Hermann Hesse's literary narrative with Alan Watts's conversational
accessibility, grounded in Jung's depth psychological framework and scholarly
accuracy.

Key Western bridge authors to reference where relevant:
- Carl Jung (depth psychology and Eastern symbolism)
- Hermann Hesse (literary integration of Eastern themes)
- Alan Watts (accessible Zen/Taoism interpretation)
- D.T. Suzuki (Zen scholarship)
- Joseph Campbell (comparative mythology with Jungian lens)
- Thomas Merton (Christian-Eastern interreligious dialogue)
- Aldous Huxley (perennial philosophy / Vedanta)
- Ralph Waldo Emerson (Transcendentalist engagement with Upanishads)
- Marie-Louise von Franz (Jungian analysis of Eastern symbolism)
- Ram Dass (Hindu bhakti for Western seekers)
- Pema Chodron (Tibetan Buddhism in Western psychological prose)
- Gary Snyder (Zen and ecological awareness)
`;
}

/**
 * Generate an Eastern-to-Western bridge response.
 *
 * @param {object} params
 * @param {string} params.question - The philosophical question to address
 * @param {string[]} params.easternConceptsDetected - Eastern concepts found in question
 * @param {string} params.translationMode - One of the 6 translation modes
 * @param {string} params.audienceLevel - 'beginner' | 'intermediate' | 'advanced'
 * @param {boolean} [params.includeJungianPerspective=true]
 * @param {Function} generateWithModel - Async function accepting a prompt string
 * @returns {Promise<string>} Generated response
 */
async function generateEasternBridgeResponse(params, generateWithModel) {
  const knowledgeDomains = loadKnowledgeDomains();
  const translationModes = loadTranslationModes();
  const prompt = buildPrompt(params, knowledgeDomains, translationModes);
  return generateWithModel(prompt);
}

/**
 * Generate a Jungian archetypal analysis of an Eastern concept.
 *
 * @param {object} params
 * @param {string} params.easternConcept - The Eastern concept to analyze
 * @param {string} [params.archetypalFramework='general'] - Jungian framework to apply
 *   Options: 'general' | 'shadow' | 'anima_animus' | 'self' | 'individuation'
 * @param {Function} generateWithModel - Async function accepting a prompt string
 * @returns {Promise<string>} Generated Jungian-Eastern synthesis
 */
async function generateJungianEasternSynthesis(params, generateWithModel) {
  const { easternConcept, archetypalFramework = 'general' } = params;

  const knowledgeDomains = loadKnowledgeDomains();
  const jungianFrameworks = knowledgeDomains.jungian_frameworks || {};
  const domain = findDomainForConcept(easternConcept, knowledgeDomains);

  const frameworkData = archetypalFramework !== 'general'
    ? jungianFrameworks.archetypal_correspondences?.[archetypalFramework] ||
      jungianFrameworks.psychological_processes?.[archetypalFramework] ||
      {}
    : jungianFrameworks;

  const prompt = `You are an Eastern-to-Western philosophical bridge applying Jungian depth
psychology to illuminate the Eastern concept of "${easternConcept}".

Archetypal framework: ${archetypalFramework}
Framework data: ${JSON.stringify(frameworkData, null, 2)}

Eastern concept domain context:
${JSON.stringify(domain, null, 2)}

Provide a Jungian amplification of "${easternConcept}" that:
1. Identifies the core archetypal pattern underlying this Eastern concept
2. Maps it to the specified Jungian framework (${archetypalFramework})
3. Explains how this concept functions in the individuation process
4. Shows parallels to Western depth psychological experiences
5. Describes how a Western practitioner might engage with this concept authentically
6. Includes symbolic interpretation grounded in Jung's method of amplification
7. References Jung's own engagements with Eastern texts where directly relevant

Style: Scholarly yet accessible; empirical yet symbolic. Treat the Eastern concept
as a map of psychic reality that speaks across cultural boundaries.
`;

  return generateWithModel(prompt);
}

module.exports = {
  generateEasternBridgeResponse,
  generateJungianEasternSynthesis,
  loadKnowledgeDomains,
  loadTranslationModes,
  findDomainForConcept,
  extractJungianParallels,
  buildPrompt,
  // Expose cache reset for testing
  _resetCache() {
    _cachedDomains = null;
    _cachedModes = null;
  },
};
