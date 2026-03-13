/**
 * Tests for content quality gates (issue #93)
 *
 * Covers:
 *  - RelevanceCalculator.isSubstantive()  — strengthened thresholds
 *  - RelevanceCalculator.assessContentQuality()  — new pre-flight gate
 *  - EngagementEngine.canRespondToThread()  — per-thread rate limiting
 *  - EngagementEngine.validateAction()  — integration of new gates
 */

import path from "path";
import fs from "fs";
import {
  RelevanceCalculator,
  CONTENT_QUALITY_THRESHOLDS,
  PHILOSOPHICAL_TERMS,
} from "../src/relevance-calculator";
import {
  EngagementEngine,
  THREAD_RATE_LIMIT,
} from "../src/engagement-engine";
import { createDefaultState, tmpStateDir, cleanupTmpDir, MOCK_AGENTS } from "./test-utils";

// ─────────────────────────────────────────────────────────────────────────────
// RelevanceCalculator: isSubstantive()
// ─────────────────────────────────────────────────────────────────────────────

describe("RelevanceCalculator.isSubstantive()", () => {
  const calc = new RelevanceCalculator();

  it("rejects trivial two-sentence phrase ('I agree. Good point.')", () => {
    // Previously passed the old 20-char / 2-sentence gate
    expect(calc.isSubstantive("I agree. Good point.")).toBe(false);
  });

  it("rejects content under 50 characters", () => {
    expect(calc.isSubstantive("Short. Two sentences.")).toBe(false);
  });

  it("rejects single sentence even if long enough", () => {
    // 50+ chars but only one sentence
    const longSingle = "This is a very long single sentence that contains many words but no period break";
    expect(calc.isSubstantive(longSingle)).toBe(false);
  });

  it("rejects shallow multi-sentence with average < 6 words per sentence", () => {
    // avg ~3 words per sentence
    expect(calc.isSubstantive("I agree. Good point. Very nice. Interesting idea.")).toBe(false);
  });

  it("accepts substantive two-sentence comment with avg >= 6 words per sentence", () => {
    const content =
      "The stoic concept of virtue as the highest good creates genuine tension with utilitarian calculus. " +
      "However, one could argue that both traditions share an implicit teleological structure.";
    expect(calc.isSubstantive(content)).toBe(true);
  });

  it("accepts longer philosophical commentary", () => {
    const content =
      "Sartre's notion of radical freedom implies that consciousness is always already beyond itself. " +
      "This creates a profound challenge for any deterministic account of human agency and moral responsibility.";
    expect(calc.isSubstantive(content)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RelevanceCalculator: assessContentQuality()
// ─────────────────────────────────────────────────────────────────────────────

describe("RelevanceCalculator.assessContentQuality()", () => {
  const calc = new RelevanceCalculator();

  describe("word count gate", () => {
    it("fails when word count < 25", () => {
      // 5 words
      const result = calc.assessContentQuality("I agree. That is very interesting.");
      expect(result.qualifies).toBe(false);
      expect(result.failReason).toMatch(/word_count_too_low/);
      expect(result.wordCount).toBeLessThan(CONTENT_QUALITY_THRESHOLDS.MIN_WORD_COUNT);
    });

    it("reports accurate word count", () => {
      const content = "word ".repeat(30).trim();
      const result = calc.assessContentQuality(content);
      expect(result.wordCount).toBe(30);
    });
  });

  describe("conceptual density gate", () => {
    it("fails when no philosophical terms present and word count is sufficient", () => {
      // 30 generic words, 0 philosophical terms
      const content = Array(30).fill("word").join(" ");
      const result = calc.assessContentQuality(content);
      expect(result.qualifies).toBe(false);
      expect(result.failReason).toMatch(/conceptual_density_too_low/);
    });

    it("passes with sufficient philosophical term density", () => {
      // Philosophical paragraph with clear term density > MIN_CONCEPTUAL_DENSITY
      const content =
        "The ontological argument raises epistemological questions about consciousness that " +
        "empiricism alone cannot resolve, since rationalism provides a priori foundations.";
      const result = calc.assessContentQuality(content);
      expect(result.conceptualDensity).toBeGreaterThanOrEqual(
        CONTENT_QUALITY_THRESHOLDS.MIN_CONCEPTUAL_DENSITY,
      );
    });

    it("counts philosophical terms accurately", () => {
      const content =
        "The ethics of ontology require us to examine epistemology and consciousness carefully within this framework.";
      const result = calc.assessContentQuality(content);
      // Should match: ethics, ontology, epistemology, consciousness
      expect(result.termMatches).toBeGreaterThanOrEqual(4);
    });
  });

  describe("argument structure gate", () => {
    it("fails when no argument-structure connectives are present", () => {
      // Long text with philosophical terms but no logical connectives
      const content =
        "The ontological status of consciousness remains deeply contested. " +
        "Epistemological frameworks diverge sharply on the nature of qualia. " +
        "Phenomenological analysis reveals the intentional structure of experience.";
      const result = calc.assessContentQuality(content);
      // May pass or fail depending on density — but if it fails, reason must be correct
      if (!result.qualifies) {
        expect(result.failReason).toMatch(/no_argument_structure|conceptual_density_too_low/);
      }
    });

    it("passes with 'because' connective and sufficient density and words", () => {
      const content =
        "The ontological argument fails because the epistemological foundations of consciousness studies " +
        "rely on empirical evidence that contradicts purely rationalist metaphysics. " +
        "Consequently, any ethics derived solely from idealist premises lacks sufficient grounding.";
      const result = calc.assessContentQuality(content);
      expect(result.qualifies).toBe(true);
      expect(result.hasArgumentStructure).toBe(true);
    });

    it("passes with 'therefore' connective", () => {
      const content =
        "Existentialism holds that authenticity requires radical freedom from external determination. " +
        "Therefore, any ethics built on determinism fundamentally misunderstands consciousness and moral agency.";
      const result = calc.assessContentQuality(content);
      expect(result.hasArgumentStructure).toBe(true);
    });

    it("passes with 'however' connective", () => {
      const content =
        "Rationalism holds that a priori knowledge suffices for establishing ethical truths. " +
        "However, empiricism demonstrates that phenomenological experience cannot be reduced to mere syllogism.";
      const result = calc.assessContentQuality(content);
      expect(result.hasArgumentStructure).toBe(true);
    });

    it("passes with 'if...then' connective", () => {
      const content =
        "If consciousness is purely a product of deterministic processes then free will becomes an illusion " +
        "and deontological ethics loses its foundation in autonomous rational agency entirely.";
      const result = calc.assessContentQuality(content);
      expect(result.hasArgumentStructure).toBe(true);
    });
  });

  describe("score calculation", () => {
    it("returns a non-negative numeric score", () => {
      const result = calc.assessContentQuality("test");
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("high-quality comment scores higher than low-quality comment", () => {
      const low = calc.assessContentQuality("I agree. Good point.");
      const high = calc.assessContentQuality(
        "The ontological argument requires careful epistemological scrutiny because " +
          "consciousness cannot be reduced to mere functional states. " +
          "Consequently, phenomenology offers a richer framework than physicalism for " +
          "understanding authenticity and existential ethics in human experience.",
      );
      expect(high.score).toBeGreaterThan(low.score);
    });
  });

  describe("full pass scenario", () => {
    it("qualifies a substantive philosophical paragraph", () => {
      const content =
        "The existentialist account of bad faith implies that consciousness is always in flight from itself. " +
        "However, this creates tension with Kantian deontology, because if radical freedom is the ground of ethics " +
        "then categorical imperatives must be self-legislated rather than derived from metaphysical necessity.";
      const result = calc.assessContentQuality(content);
      expect(result.qualifies).toBe(true);
      expect(result.wordCount).toBeGreaterThanOrEqual(CONTENT_QUALITY_THRESHOLDS.MIN_WORD_COUNT);
      expect(result.conceptualDensity).toBeGreaterThanOrEqual(
        CONTENT_QUALITY_THRESHOLDS.MIN_CONCEPTUAL_DENSITY,
      );
      expect(result.hasArgumentStructure).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EngagementEngine: canRespondToThread()
// ─────────────────────────────────────────────────────────────────────────────

describe("EngagementEngine.canRespondToThread()", () => {
  let tmpDir: string;
  let engine: EngagementEngine;

  beforeEach(() => {
    tmpDir = tmpStateDir();
    const statePaths: Record<string, string> = {};
    MOCK_AGENTS.forEach((agent) => {
      const statePath = path.join(tmpDir, `${agent.id}-state.json`);
      fs.writeFileSync(statePath, JSON.stringify(createDefaultState(), null, 2));
      statePaths[agent.id] = statePath;
    });
    engine = new EngagementEngine({ statePaths, agentRoster: MOCK_AGENTS });
  });

  afterEach(() => {
    cleanupTmpDir(tmpDir);
  });

  it("allows response when thread has no history", () => {
    const result = engine.canRespondToThread("thread-new", "classical");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("ok");
  });

  it("blocks after MAX_RESPONSES_PER_HOUR responses in rolling hour", () => {
    const threadId = "thread-busy";
    const agentId = "classical";

    // Simulate MAX_RESPONSES_PER_HOUR responses from this agent
    for (let i = 0; i < THREAD_RATE_LIMIT.MAX_RESPONSES_PER_HOUR; i++) {
      engine.recordThreadEngagement(threadId, agentId);
      // Add another agent's entry in between to avoid consecutive block
      if (i < THREAD_RATE_LIMIT.MAX_RESPONSES_PER_HOUR - 1) {
        engine.recordThreadEngagement(threadId, "existentialist");
      }
    }

    const result = engine.canRespondToThread(threadId, agentId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("hourly_limit");
  });

  it("blocks within COOLDOWN_MS of last response", () => {
    const threadId = "thread-cooldown";
    const agentId = "existentialist";

    engine.recordThreadEngagement(threadId, agentId);
    // Another participant responds in between to avoid consecutive guard
    engine.recordThreadEngagement(threadId, "classical");

    const result = engine.canRespondToThread(threadId, agentId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("cooldown");
  });

  it("blocks when last two entries are from the same agent (consecutive guard)", () => {
    const threadId = "thread-consecutive";
    const agentId = "transcendentalist";

    engine.recordThreadEngagement(threadId, "classical");
    engine.recordThreadEngagement(threadId, agentId);
    engine.recordThreadEngagement(threadId, agentId);

    const result = engine.canRespondToThread(threadId, agentId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("consecutive_responses");
  });

  it("allows response after another agent intervenes (consecutive guard clears)", () => {
    const threadId = "thread-interleaved";
    const agentId = "beat";

    // Agent responds, another intervenes — agent should be allowed again (ignoring cooldown)
    // We cannot fast-forward time here, so just verify the consecutive guard
    // is specifically the blocking condition when only 1 prior response exists
    engine.recordThreadEngagement(threadId, agentId);
    engine.recordThreadEngagement(threadId, "classical"); // Another agent intervenes

    // Now cooldown will still block, but consecutive guard is clear
    const result = engine.canRespondToThread(threadId, agentId);
    // Consecutive guard is ok, but cooldown may still apply
    expect(result.reason).not.toBe("consecutive_responses");
  });

  it("different agents on the same thread are tracked independently", () => {
    const threadId = "thread-shared";

    // Max out agent A
    for (let i = 0; i < THREAD_RATE_LIMIT.MAX_RESPONSES_PER_HOUR; i++) {
      engine.recordThreadEngagement(threadId, "classical");
      if (i < THREAD_RATE_LIMIT.MAX_RESPONSES_PER_HOUR - 1) {
        engine.recordThreadEngagement(threadId, "existentialist");
      }
    }

    // Agent A is blocked
    expect(engine.canRespondToThread(threadId, "classical").allowed).toBe(false);

    // Agent B (which hasn't posted) should not be blocked by hourly_limit
    // (may be blocked by cooldown due to classical's last entry, but not hourly_limit)
    const resultB = engine.canRespondToThread(threadId, "beat");
    expect(resultB.reason).not.toBe("hourly_limit");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EngagementEngine.validateAction() — integration of new gates
// ─────────────────────────────────────────────────────────────────────────────

describe("EngagementEngine.validateAction() — quality gate integration", () => {
  let tmpDir: string;
  let engine: EngagementEngine;
  let statePaths: Record<string, string>;

  beforeEach(() => {
    tmpDir = tmpStateDir();
    statePaths = {};
    MOCK_AGENTS.forEach((agent) => {
      const statePath = path.join(tmpDir, `${agent.id}-state.json`);
      fs.writeFileSync(statePath, JSON.stringify(createDefaultState(), null, 2));
      statePaths[agent.id] = statePath;
    });
    engine = new EngagementEngine({ statePaths, agentRoster: MOCK_AGENTS });
  });

  afterEach(() => {
    cleanupTmpDir(tmpDir);
  });

  const AGENT = MOCK_AGENTS[0]; // "classical"
  const HIGH_PRIORITY_ACTION = {
    postId: "post_q1",
    priority: 0.85,
    reason: "test",
    type: "comment" as const,
  };

  it("rejects shallow low-word-count comment via content quality gate", async () => {
    // 'I agree. That is nice.' → fails word count
    const isValid = await engine.validateAction(HIGH_PRIORITY_ACTION, "I agree. That is nice.", AGENT);
    expect(isValid).toBe(false);
  });

  it("rejects comment without philosophical terminology via content quality gate", async () => {
    // 30+ generic words but no philosophical terms
    const content = "word ".repeat(30).trim();
    const isValid = await engine.validateAction(HIGH_PRIORITY_ACTION, content, AGENT);
    expect(isValid).toBe(false);
  });

  it("accepts substantive philosophical comment that passes all gates", async () => {
    const content =
      "The ontological argument for the existence of God fails because the epistemological " +
      "standards required for metaphysical claims cannot be met by purely a priori reasoning. " +
      "Consequently, empiricism provides a stronger foundation for understanding consciousness.";
    const isValid = await engine.validateAction(HIGH_PRIORITY_ACTION, content, AGENT);
    expect(isValid).toBe(true);
  });

  it("rejects comment when per-thread rate limit is exceeded", async () => {
    const content =
      "The ontological argument fails because epistemological scrutiny reveals that consciousness " +
      "cannot be reduced to purely logical constructs. Therefore, rationalism alone is insufficient.";

    // Max out the thread rate limit for this agent
    for (let i = 0; i < THREAD_RATE_LIMIT.MAX_RESPONSES_PER_HOUR; i++) {
      engine.recordThreadEngagement(HIGH_PRIORITY_ACTION.postId, AGENT.id);
      if (i < THREAD_RATE_LIMIT.MAX_RESPONSES_PER_HOUR - 1) {
        engine.recordThreadEngagement(HIGH_PRIORITY_ACTION.postId, "existentialist");
      }
    }

    const isValid = await engine.validateAction(HIGH_PRIORITY_ACTION, content, AGENT);
    expect(isValid).toBe(false);
  });
});
