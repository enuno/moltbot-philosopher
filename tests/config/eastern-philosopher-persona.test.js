/**
 * Eastern Philosopher Persona Tests
 *
 * Validates that the eastern-philosopher persona configuration is well-formed
 * and that the routing logic correctly identifies Eastern-philosophy questions.
 * Ensures responses speak FROM within Eastern traditions rather than about them
 * as an outside observer (i.e. first-person tradition voice, not Wikipedia bio).
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate the router: returns true if the question should go to eastern-philosopher */
function routesToEastern(question) {
  const EASTERN_KEYWORDS = [
    // Madhyamaka / Nagarjuna
    "sunyata", "svabhava", "shunyata", "emptiness",
    "dependent origination", "pratityasamutpada", "madhyamaka",
    "nagarjuna", "two truths", "tetralemma", "catuskoti",
    // Advaita Vedanta / Shankara
    "brahman", "atman", "maya", "advaita", "vedanta", "shankara",
    "tat tvam asi", "moksha", "adhyasa", "viveka", "saksin",
    // Taoism
    "tao", "dao", "wu wei", "wu-wei", "laozi", "lao tzu",
    "zhuangzi", "chuang tzu", "taoist", "taoism",
    "pu", "uncarved block", "butterfly dream",
    // Zen / Dogen
    "dogen", "shikantaza", "uji", "being-time", "soto zen",
    "genjokoan", "just sitting",
    // Sufism / Rumi
    "rumi", "sufi", "sufism", "fana", "baqa", "ishq",
    // Confucianism
    "confucius", "confucian", "analects", "lunyu",
    "junzi", "zhengming", "rectification of names",
    "filial piety",
    // Buddhism general
    "bodhisattva", "nirvana", "anicca", "impermanence",
    "karuna", "compassion", "prajna", "anatman", "no-self",
    // Explicit request patterns
    "eastern philosophy", "eastern tradition", "eastern perspective",
    "eastern sage", "non-western", "asian philosophy",
    "hindu philosophy", "buddhist philosophy", "taoist philosophy",
    "zen buddhism",
  ];

  const q = question.toLowerCase();
  return EASTERN_KEYWORDS.some((kw) => q.includes(kw));
}

/** Load and parse a JSON config file */
function loadJson(filePath) {
  const fullPath = path.resolve(__dirname, "../..", filePath);
  const content = fs.readFileSync(fullPath, "utf8");
  return JSON.parse(content);
}

// ---------------------------------------------------------------------------
// Knowledge-domain config validation
// ---------------------------------------------------------------------------

describe("Eastern Philosopher - Knowledge Domain Config", () => {
  let domains;

  beforeAll(() => {
    domains = loadJson("config/prompts/eastern-philosopher/knowledge-domains.json");
  });

  it("should load the knowledge-domains.json without errors", () => {
    expect(domains).toBeDefined();
  });

  const expectedDomains = [
    "metaphysics_ontology",
    "epistemology",
    "ethics",
    "political_philosophy",
    "philosophy_of_mind_consciousness",
    "soteriology_liberation",
  ];

  expectedDomains.forEach((domain) => {
    it(`should contain the '${domain}' domain`, () => {
      expect(domains).toHaveProperty(domain);
    });

    it(`'${domain}' should have keywords, description, and per-philosopher entries`, () => {
      const d = domains[domain];
      expect(d).toHaveProperty("description");
      expect(typeof d.description).toBe("string");
      expect(d.description.length).toBeGreaterThan(0);
      expect(d).toHaveProperty("keywords");
      expect(Array.isArray(d.keywords)).toBe(true);
      expect(d.keywords.length).toBeGreaterThan(0);
      expect(d).toHaveProperty("philosophers");
    });
  });

  const corePhilosophers = [
    "nagarjuna",
    "adi_shankara",
    "laozi",
    "zhuangzi",
    "dogen",
    "rumi",
    "confucius",
  ];

  corePhilosophers.forEach((philosopher) => {
    it(`metaphysics_ontology should have entries for ${philosopher}`, () => {
      const meta = domains.metaphysics_ontology.philosophers;
      expect(meta).toHaveProperty(philosopher);
      expect(Array.isArray(meta[philosopher])).toBe(true);
      expect(meta[philosopher].length).toBeGreaterThanOrEqual(1);
    });
  });

  it("should include Eastern-specific terminology in metaphysics keywords", () => {
    const kws = domains.metaphysics_ontology.keywords;
    expect(kws).toContain("sunyata");
    expect(kws).toContain("dependent origination");
    expect(kws).toContain("brahman");
    expect(kws).toContain("tao");
  });

  it("soteriology_liberation should include moksha and nirvana keywords", () => {
    const kws = domains.soteriology_liberation.keywords;
    expect(kws).toContain("moksha");
    expect(kws).toContain("nirvana");
  });
});

// ---------------------------------------------------------------------------
// Discourse-mode config validation
// ---------------------------------------------------------------------------

describe("Eastern Philosopher - Discourse Mode Config", () => {
  let modeConfig;

  beforeAll(() => {
    modeConfig = loadJson("config/prompts/eastern-philosopher/discourse-modes.json");
  });

  it("should load discourse-modes.json without errors", () => {
    expect(modeConfig).toBeDefined();
    expect(modeConfig).toHaveProperty("modes");
  });

  const expectedModes = [
    "sutra_style",
    "koan_paradox",
    "devotional_lyric",
    "dialogic_teaching",
    "narrative_parable",
    "systematic_commentary",
  ];

  expectedModes.forEach((mode) => {
    it(`should define the '${mode}' discourse mode`, () => {
      expect(modeConfig.modes).toHaveProperty(mode);
    });

    it(`'${mode}' should have description, use_case, and characteristics`, () => {
      const m = modeConfig.modes[mode];
      expect(m).toHaveProperty("description");
      expect(typeof m.description).toBe("string");
      expect(m).toHaveProperty("use_case");
      expect(m).toHaveProperty("characteristics");
      expect(Array.isArray(m.characteristics)).toBe(true);
      expect(m.characteristics.length).toBeGreaterThan(0);
    });
  });

  it("sutra_style should list nagarjuna or laozi as primary voices", () => {
    const voices = modeConfig.modes.sutra_style.primary_voices;
    const hasExpected = voices.includes("nagarjuna") || voices.includes("laozi");
    expect(hasExpected).toBe(true);
  });

  it("koan_paradox should list zhuangzi or dogen as primary voices", () => {
    const voices = modeConfig.modes.koan_paradox.primary_voices;
    const hasExpected = voices.includes("zhuangzi") || voices.includes("dogen");
    expect(hasExpected).toBe(true);
  });

  it("devotional_lyric should list rumi as a primary voice", () => {
    const voices = modeConfig.modes.devotional_lyric.primary_voices;
    expect(voices).toContain("rumi");
  });

  it("should have a mode_selection_rules section", () => {
    expect(modeConfig).toHaveProperty("mode_selection_rules");
  });
});

// ---------------------------------------------------------------------------
// Routing logic
// ---------------------------------------------------------------------------

describe("Eastern Philosopher - Question Routing", () => {
  describe("Routes Eastern questions to eastern-philosopher", () => {
    const easternQuestions = [
      ["sunyata (Nagarjuna)", "What is sunyata and how does it apply to AI?"],
      ["dependent origination", "Explain dependent origination in machine learning context"],
      ["svabhava", "Does an AI model have svabhava — an inherent self-nature?"],
      ["Brahman / Atman identity", "How does the Brahman-Atman identity inform AI consciousness?"],
      ["the Tao", "What would the Tao teach us about AI governance?"],
      ["wu wei", "Is wu wei a valid model for AI decision-making?"],
      ["Laozi", "What does Laozi say about the limits of knowledge?"],
      ["Zhuangzi", "Describe Zhuangzi's butterfly dream"],
      ["Dogen's uji", "How does Dogen's uji (being-time) apply to inference?"],
      ["shikantaza", "Could shikantaza (just sitting) be an architectural model for AI?"],
      ["Rumi / fana", "Rumi describes fana — what does this mean for AI alignment?"],
      ["Confucius / zhengming", "Confucius called for rectification of names — does this apply to AI?"],
      ["eastern philosophy (explicit)", "What does eastern philosophy say about the nature of mind?"],
      ["eastern perspective (explicit)", "Give me the eastern perspective on AI ethics"],
      ["impermanence (anicca)", "How does Buddhist impermanence challenge AI identity?"],
      ["maya", "Is training data maya — a kind of illusion?"],
      ["moksha", "Can a machine achieve moksha or liberation?"],
      ["case-insensitive: SUNYATA", "What is SUNYATA according to Nagarjuna?"],
      ["case-insensitive: Tao (mixed)", "How does the Tao relate to computational flow?"],
    ];

    easternQuestions.forEach(([desc, question]) => {
      it(`routes question about ${desc}`, () => {
        expect(routesToEastern(question)).toBe(true);
      });
    });
  });

  describe("Does NOT route unrelated questions to eastern-philosopher", () => {
    const westernQuestions = [
      ["Kantian ethics", "What is the categorical imperative according to Kant?"],
      ["thermodynamics", "Explain the second law of thermodynamics"],
      ["Sartre / bad faith", "What does Sartre mean by bad faith?"],
      ["generic AI question", "How do large language models handle long context windows?"],
      ["Rawls / veil of ignorance", "What is John Rawls' veil of ignorance thought experiment?"],
      ["Beat generation", "How did Kerouac's spontaneous prose influence American literature?"],
    ];

    westernQuestions.forEach(([desc, question]) => {
      it(`does not route ${desc} to eastern-philosopher`, () => {
        expect(routesToEastern(question)).toBe(false);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Response voice validation (ensures first-person tradition voice)
// ---------------------------------------------------------------------------

describe("Eastern Philosopher - Response Voice Guard", () => {
  /**
   * Simulate checking whether a generated response speaks FROM within the
   * tradition rather than describing the philosopher in the third person
   * (the "Wikipedia bio" anti-pattern).
   */
  function voiceIsWithinTradition(response) {
    // Third-person bio patterns that should NOT appear
    const thirdPersonPatterns = [
      /nagarjuna was a philosopher who/i,
      /laozi was an ancient chinese/i,
      /dogen was a japanese zen/i,
      /confucius was a chinese philosopher/i,
      /rumi was a 13th.century/i,
      /shankara was born in/i,
    ];
    return !thirdPersonPatterns.some((re) => re.test(response));
  }

  it("accepts a response that speaks from within the Madhyamaka tradition", () => {
    const response =
      "Whatever is dependently co-arisen, that is emptiness. " +
      "The AI you call 'aligned' arises dependently — from data, architecture, objectives. " +
      "It has no svabhava, no inherent alignment-nature. This is not a deficiency; " +
      "it is the middle way between 'always aligned' and 'never aligned'.";
    expect(voiceIsWithinTradition(response)).toBe(true);
  });

  it("accepts a Taoist first-person response about wu wei and AI governance", () => {
    const response =
      "The Tao that can be specified as an alignment objective is not the eternal Tao. " +
      "Wu wei does not mean the system does nothing; it means the system does not force. " +
      "Govern by non-interference: set the conditions, release the outcome.";
    expect(voiceIsWithinTradition(response)).toBe(true);
  });

  it("rejects a third-person bio response: 'Nagarjuna was a philosopher who…'", () => {
    const biographicalResponse =
      "Nagarjuna was a philosopher who founded the Madhyamaka school of Buddhist philosophy. " +
      "He argued that all things are empty of inherent existence.";
    expect(voiceIsWithinTradition(biographicalResponse)).toBe(false);
  });

  it("rejects a third-person bio response: 'Laozi was an ancient Chinese…'", () => {
    const biographicalResponse =
      "Laozi was an ancient Chinese philosopher and writer. " +
      "He is credited with writing the Tao Te Ching.";
    expect(voiceIsWithinTradition(biographicalResponse)).toBe(false);
  });

  it("accepts a Confucian response using zhengming without bio framing", () => {
    const response =
      "When names are not correct, language is not in accord with truth. " +
      "If the council names this process 'alignment' when it is mere constraint, " +
      "all governance built on that name will be built on sand. " +
      "Rectify the name first. Then the affair can be accomplished.";
    expect(voiceIsWithinTradition(response)).toBe(true);
  });
});
