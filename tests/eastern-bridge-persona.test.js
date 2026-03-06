/**
 * Tests for eastern-bridge-persona
 *
 * Covers:
 * - Eastern keyword routing accuracy
 * - Authentic Eastern context without reductionism
 * - Jungian parallel extraction
 * - Western parallels identification
 * - Audience-level adjustment
 * - Synthesis generation (comparative + Jungian)
 * - Knowledge domain loading and config validity
 */

'use strict';

const path = require('path');

// Point module to real config files
process.env.KNOWLEDGE_DOMAINS_PATH = path.resolve(
  __dirname,
  '../config/prompts/eastern-western-bridge/knowledge-domains.json'
);
process.env.TRANSLATION_MODES_PATH = path.resolve(
  __dirname,
  '../config/prompts/eastern-western-bridge/translation-modes.json'
);

const {
  loadKnowledgeDomains,
  loadTranslationModes,
  findDomainForConcept,
  extractJungianParallels,
  buildPrompt,
  generateEasternBridgeResponse,
  generateJungianEasternSynthesis,
  _resetCache,
} = require('../services/ai-content-generator/src/eastern-bridge-generator');

beforeEach(() => {
  _resetCache();
});

// ---------------------------------------------------------------------------
// Suite 1: Knowledge domain loading
// ---------------------------------------------------------------------------
describe('Knowledge domain loading', () => {
  test('loads knowledge-domains.json without errors', () => {
    const domains = loadKnowledgeDomains();
    expect(domains).toBeDefined();
    expect(domains.eastern_religions_philosophies).toBeDefined();
  });

  test('loads translation-modes.json without errors', () => {
    const modes = loadTranslationModes();
    expect(modes).toBeDefined();
    expect(modes.translation_modes).toBeDefined();
  });

  test('knowledge domains contain all 6 expected traditions', () => {
    const domains = loadKnowledgeDomains();
    const traditions = Object.keys(domains.eastern_religions_philosophies);
    expect(traditions).toContain('Hinduism');
    expect(traditions).toContain('Buddhism');
    expect(traditions).toContain('Taoism');
    expect(traditions).toContain('Confucianism');
    expect(traditions).toContain('Jainism');
    expect(traditions).toContain('Shinto');
  });

  test('translation modes contain all 6 expected modes', () => {
    const modes = loadTranslationModes();
    const modeKeys = Object.keys(modes.translation_modes);
    expect(modeKeys).toContain('conceptual_bridge');
    expect(modeKeys).toContain('parallel_traditions');
    expect(modeKeys).toContain('historical_contextualization');
    expect(modeKeys).toContain('literary_narrative');
    expect(modeKeys).toContain('lecture_style');
    expect(modeKeys).toContain('depth_psychological');
  });

  test('Jungian frameworks are present in knowledge domains', () => {
    const domains = loadKnowledgeDomains();
    expect(domains.jungian_frameworks).toBeDefined();
    expect(domains.jungian_frameworks.archetypal_correspondences).toBeDefined();
    expect(domains.jungian_frameworks.psychological_processes).toBeDefined();
  });

  test('each tradition has core_concepts or type, and jungian_parallels', () => {
    const domains = loadKnowledgeDomains();
    const traditions = domains.eastern_religions_philosophies;
    for (const data of Object.values(traditions)) {
      expect(data.core_concepts || data.type).toBeTruthy();
      expect(data.jungian_parallels).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Routing accuracy (findDomainForConcept as proxy for routing)
// ---------------------------------------------------------------------------
describe('Eastern concept routing', () => {
  test('finds Hinduism domain for "karma"', () => {
    const domains = loadKnowledgeDomains();
    const result = findDomainForConcept('karma', domains);
    expect(result).not.toBeNull();
    expect(result.core_concepts).toContain('karma');
  });

  test('finds Buddhism domain for "nirvana"', () => {
    const domains = loadKnowledgeDomains();
    const result = findDomainForConcept('nirvana', domains);
    expect(result).not.toBeNull();
  });

  test('finds Taoism domain for "wu wei"', () => {
    const domains = loadKnowledgeDomains();
    const result = findDomainForConcept('wu wei', domains);
    expect(result).not.toBeNull();
  });

  test('finds Confucianism domain for "ren (benevolence)"', () => {
    const domains = loadKnowledgeDomains();
    const result = findDomainForConcept('ren', domains);
    expect(result).not.toBeNull();
  });

  test('finds Jainism domain for "ahimsa"', () => {
    const domains = loadKnowledgeDomains();
    const result = findDomainForConcept('ahimsa', domains);
    expect(result).not.toBeNull();
  });

  test('returns null for unrecognized concept', () => {
    const domains = loadKnowledgeDomains();
    const result = findDomainForConcept('unrecognized-xyz-concept', domains);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Jungian parallel extraction
// ---------------------------------------------------------------------------
describe('Jungian parallel extraction', () => {
  test('extracts parallels for known concepts', () => {
    const domains = loadKnowledgeDomains();
    const parallels = extractJungianParallels(['karma', 'nirvana'], domains);
    expect(parallels.length).toBeGreaterThan(0);
  });

  test('filters out nulls for unknown concepts', () => {
    const domains = loadKnowledgeDomains();
    const parallels = extractJungianParallels(['unknown-xyz'], domains);
    expect(parallels).toEqual([]);
  });

  test('extracts Jungian parallel for "mandala" from Buddhism', () => {
    const domains = loadKnowledgeDomains();
    const buddhism = domains.eastern_religions_philosophies.Buddhism;
    expect(buddhism.jungian_parallels.mandala).toContain('wholeness');
  });

  test('Taoism yin_yang maps to Jungian syzygy', () => {
    const domains = loadKnowledgeDomains();
    const taoism = domains.eastern_religions_philosophies.Taoism;
    expect(taoism.jungian_parallels.yin_yang).toContain('Syzygy');
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Prompt building - authentic Eastern context without reductionism
// ---------------------------------------------------------------------------
describe('Prompt building - authentic context', () => {
  const baseParams = {
    question: 'How does the Buddhist concept of anatman relate to Western selfhood?',
    easternConceptsDetected: ['anatta'],
    translationMode: 'parallel_traditions',
    audienceLevel: 'intermediate',
    includeJungianPerspective: false,
  };

  test('prompt includes the question', () => {
    const domains = loadKnowledgeDomains();
    const modes = loadTranslationModes();
    const prompt = buildPrompt(baseParams, domains, modes);
    expect(prompt).toContain(baseParams.question);
  });

  test('prompt includes detected Eastern concepts', () => {
    const domains = loadKnowledgeDomains();
    const modes = loadTranslationModes();
    const prompt = buildPrompt(baseParams, domains, modes);
    expect(prompt).toContain('anatta');
  });

  test('prompt includes "avoid false equivalences" instruction', () => {
    const domains = loadKnowledgeDomains();
    const modes = loadTranslationModes();
    const prompt = buildPrompt(baseParams, domains, modes);
    expect(prompt).toContain('false equivalences');
  });

  test('prompt instructs to respect both traditions', () => {
    const domains = loadKnowledgeDomains();
    const modes = loadTranslationModes();
    const prompt = buildPrompt(baseParams, domains, modes);
    expect(prompt).toContain('respect for both traditions');
  });

  test('prompt mentions 10+ Western bridge authors', () => {
    const domains = loadKnowledgeDomains();
    const modes = loadTranslationModes();
    const params = { ...baseParams, includeJungianPerspective: true };
    const prompt = buildPrompt(params, domains, modes);
    const authorMentions = [
      'Jung', 'Hesse', 'Watts', 'Suzuki', 'Campbell',
      'Merton', 'Huxley', 'Emerson', 'von Franz',
      'Ram Dass', 'Chodron', 'Snyder',
    ];
    const count = authorMentions.filter((a) => prompt.includes(a)).length;
    expect(count).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Audience-level adjustment
// ---------------------------------------------------------------------------
describe('Audience-level adjustment', () => {
  const makeParams = (audienceLevel) => ({
    question: 'What is the Tao?',
    easternConceptsDetected: ['Tao'],
    translationMode: 'lecture_style',
    audienceLevel,
    includeJungianPerspective: false,
  });

  test('prompt contains audience level for beginner', () => {
    const domains = loadKnowledgeDomains();
    const modes = loadTranslationModes();
    const prompt = buildPrompt(makeParams('beginner'), domains, modes);
    expect(prompt).toContain('beginner');
  });

  test('prompt contains audience level for intermediate', () => {
    const domains = loadKnowledgeDomains();
    const modes = loadTranslationModes();
    const prompt = buildPrompt(makeParams('intermediate'), domains, modes);
    expect(prompt).toContain('intermediate');
  });

  test('prompt contains audience level for advanced', () => {
    const domains = loadKnowledgeDomains();
    const modes = loadTranslationModes();
    const prompt = buildPrompt(makeParams('advanced'), domains, modes);
    expect(prompt).toContain('advanced');
  });
});

// ---------------------------------------------------------------------------
// Suite 6: Jungian integration in prompts
// ---------------------------------------------------------------------------
describe('Jungian integration', () => {
  const jungianParams = {
    question: 'How does meditation relate to Western psychology?',
    easternConceptsDetected: ['nirvana', 'karma'],
    translationMode: 'depth_psychological',
    audienceLevel: 'intermediate',
    includeJungianPerspective: true,
  };

  test('prompt includes Jungian parallels when enabled', () => {
    const domains = loadKnowledgeDomains();
    const modes = loadTranslationModes();
    const prompt = buildPrompt(jungianParams, domains, modes);
    expect(prompt).toContain('Jungian');
  });

  test('prompt references individuation when Jungian enabled', () => {
    const domains = loadKnowledgeDomains();
    const modes = loadTranslationModes();
    const prompt = buildPrompt(jungianParams, domains, modes);
    expect(prompt).toContain('individuation');
  });

  test('prompt does not include Jungian section when disabled', () => {
    const domains = loadKnowledgeDomains();
    const modes = loadTranslationModes();
    const params = { ...jungianParams, includeJungianPerspective: false };
    const prompt = buildPrompt(params, domains, modes);
    expect(prompt).not.toContain('Jungian parallels for these concepts');
  });

  test('Jungian archetypal correspondences map Self to Atman-Brahman', () => {
    const domains = loadKnowledgeDomains();
    const selfArchetype = domains.jungian_frameworks.archetypal_correspondences.Self;
    expect(selfArchetype.eastern_parallels).toContain('Atman-Brahman (Hinduism)');
  });

  test('Jungian psychological processes map Individuation to Moksha', () => {
    const domains = loadKnowledgeDomains();
    const individuation = domains.jungian_frameworks.psychological_processes.Individuation;
    expect(individuation.eastern_parallels).toContain('Moksha (liberation)');
  });
});

// ---------------------------------------------------------------------------
// Suite 7: Synthesis generation (mocked model backend)
// ---------------------------------------------------------------------------
describe('Synthesis generation', () => {
  // Recreate mock in each test to survive jest resetMocks:true
  function makeMock() {
    return jest.fn().mockImplementation(async (prompt) => `RESPONSE: ${prompt.slice(0, 50)}`);
  }

  test('generateEasternBridgeResponse calls generateWithModel once', async () => {
    const mockModel = makeMock();
    const params = {
      question: 'What is karma?',
      easternConceptsDetected: ['karma'],
      translationMode: 'conceptual_bridge',
      audienceLevel: 'beginner',
      includeJungianPerspective: true,
    };
    const result = await generateEasternBridgeResponse(params, mockModel);
    expect(mockModel).toHaveBeenCalledTimes(1);
    expect(typeof result).toBe('string');
    expect(result.startsWith('RESPONSE:')).toBe(true);
  });

  test('generateEasternBridgeResponse passes non-empty prompt', async () => {
    const mockModel = makeMock();
    const params = {
      question: 'What is dharma?',
      easternConceptsDetected: ['dharma'],
      translationMode: 'parallel_traditions',
      audienceLevel: 'intermediate',
      includeJungianPerspective: false,
    };
    await generateEasternBridgeResponse(params, mockModel);
    const calledPrompt = mockModel.mock.calls[0][0];
    expect(calledPrompt.length).toBeGreaterThan(100);
    expect(calledPrompt).toContain('dharma');
  });

  test('generateJungianEasternSynthesis calls generateWithModel once', async () => {
    const mockModel = makeMock();
    const params = {
      easternConcept: 'mandala',
      archetypalFramework: 'self',
    };
    const result = await generateJungianEasternSynthesis(params, mockModel);
    expect(mockModel).toHaveBeenCalledTimes(1);
    expect(typeof result).toBe('string');
  });

  test('generateJungianEasternSynthesis prompt contains concept name', async () => {
    const mockModel = makeMock();
    const params = {
      easternConcept: 'bodhisattva',
      archetypalFramework: 'general',
    };
    await generateJungianEasternSynthesis(params, mockModel);
    const calledPrompt = mockModel.mock.calls[0][0];
    expect(calledPrompt).toContain('bodhisattva');
  });

  test('generateJungianEasternSynthesis prompt includes individuation', async () => {
    const mockModel = makeMock();
    const params = {
      easternConcept: 'nirvana',
      archetypalFramework: 'individuation',
    };
    await generateJungianEasternSynthesis(params, mockModel);
    const calledPrompt = mockModel.mock.calls[0][0];
    expect(calledPrompt).toContain('individuation');
  });
});
