/**
 * Unit tests for RelevanceCalculator
 * Tests scoring logic, quality gates, generic comment detection, substantiveness
 */

const { RelevanceCalculator } = require("../src/relevance-calculator");
const { createMockPost, MOCK_AGENTS } = require("./test-utils");

describe("RelevanceCalculator", () => {
  let calculator;

  beforeEach(() => {
    calculator = new RelevanceCalculator();
  });

  describe("scorePost", () => {
    it("should return score 0-1 for valid post", async () => {
      const post = createMockPost();
      const agent = MOCK_AGENTS[0];
      const score = await calculator.scorePost(post, agent);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should score semantic matches higher than non-matches", async () => {
      const semanticPost = createMockPost({
        content: "Virtue ethics and stoic principles",
      });
      const nonSemanticPost = createMockPost({
        content: "Random unrelated content",
      });
      const agent = MOCK_AGENTS[0]; // Classical (Stoicism)

      const semanticScore = await calculator.scorePost(semanticPost, agent);
      const nonSemanticScore = await calculator.scorePost(nonSemanticPost, agent);

      expect(semanticScore).toBeGreaterThan(nonSemanticScore);
    });
  });

  describe("isGenericComment", () => {
    it('should reject "good point"', () => {
      expect(calculator.isGenericComment("good point")).toBe(true);
    });

    it('should reject "interesting"', () => {
      expect(calculator.isGenericComment("interesting")).toBe(true);
    });

    it('should reject "nice post"', () => {
      expect(calculator.isGenericComment("nice post")).toBe(true);
    });

    it('should reject "well said"', () => {
      expect(calculator.isGenericComment("well said")).toBe(true);
    });

    it('should reject "+1"', () => {
      expect(calculator.isGenericComment("+1")).toBe(true);
    });

    it("should accept substantive comment", () => {
      expect(
        calculator.isGenericComment(
          "I disagree with your premise because virtue ethics relies on character development",
        ),
      ).toBe(false);
    });

    it("should accept philosophical counter-argument", () => {
      expect(
        calculator.isGenericComment(
          "This contradicts the stoic position on emotional resilience",
        ),
      ).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(calculator.isGenericComment("GOOD POINT")).toBe(true);
      expect(calculator.isGenericComment("Good Point")).toBe(true);
    });
  });

  describe("isSubstantive", () => {
    it("should reject comments shorter than 20 characters", () => {
      expect(calculator.isSubstantive("Too short")).toBe(false);
    });

    it("should reject single-sentence comments", () => {
      expect(calculator.isSubstantive("This is one sentence only.")).toBe(false);
    });

    it("should accept multi-sentence substantive comments", () => {
      const comment = "This is first sentence. Here is the second sentence with actual substance.";
      expect(calculator.isSubstantive(comment)).toBe(true);
    });

    it("should accept comments with multiple sentences", () => {
      const comment = "First thought here. Second thought here! Third thought as well?";
      expect(calculator.isSubstantive(comment)).toBe(true);
    });

    it("should reject blank or whitespace-only", () => {
      expect(calculator.isSubstantive("   ")).toBe(false);
    });
  });

  describe("quality gates combined", () => {
    it("should reject generic + short comment", () => {
      expect(calculator.isGenericComment("good")).toBe(true);
      expect(calculator.isSubstantive("good")).toBe(false);
    });

    it("should accept well-formed philosophical reply", () => {
      const comment =
        "I see your point about Kant. However, Hegel's dialectical approach offers an alternative framework.";
      expect(calculator.isGenericComment(comment)).toBe(false);
      expect(calculator.isSubstantive(comment)).toBe(true);
    });
  });

  describe("calculateVelocityScore", () => {
    it("should apply 1.5x boost for posts <1h old", () => {
      const now = Date.now();
      const post = createMockPost({
        createdAt: now - 30 * 60 * 1000, // 30 minutes ago
        commentCount: 12,
      });

      const score = calculator.calculateVelocityScore(post);

      // Comments per hour = (12 / 1800000) * 3600000 = 24
      // With 1.5x boost = 24 * 1.5 = 36
      expect(score).toBeCloseTo(36, 0);
    });

    it("should apply 1.2x boost for posts <24h old", () => {
      const now = Date.now();
      const post = createMockPost({
        createdAt: now - 12 * 60 * 60 * 1000, // 12 hours ago
        commentCount: 10,
      });

      const score = calculator.calculateVelocityScore(post);

      // Comments per hour = (10 / 43200000) * 3600000 ≈ 0.833
      // With 1.2x boost = 0.833 * 1.2 ≈ 1.0
      expect(score).toBeCloseTo(1.0, 1);
    });

    it("should apply 1.0x (no boost) for older posts", () => {
      const now = Date.now();
      const post = createMockPost({
        createdAt: now - 48 * 60 * 60 * 1000, // 48 hours ago
        commentCount: 8,
      });

      const score = calculator.calculateVelocityScore(post);

      // Comments per hour = (8 / 172800000) * 3600000 ≈ 0.167
      // With 1.0x (no boost) = 0.167 * 1.0 ≈ 0.167
      expect(score).toBeCloseTo(0.167, 2);
    });

    it("should handle posts with zero comments", () => {
      const now = Date.now();
      const post = createMockPost({
        createdAt: now - 30 * 60 * 1000, // 30 minutes ago
        commentCount: 0,
      });

      const score = calculator.calculateVelocityScore(post);

      expect(score).toBe(0);
    });

    it("should handle very recent posts (seconds old)", () => {
      const now = Date.now();
      const post = createMockPost({
        createdAt: now - 30 * 1000, // 30 seconds ago
        commentCount: 5,
      });

      const score = calculator.calculateVelocityScore(post);

      // Comments per hour = (5 / 30000) * 3600000 = 600
      // With 1.5x boost = 600 * 1.5 = 900
      expect(score).toBeCloseTo(900, 0);
    });

    it("should correctly transition boost at 1h boundary", () => {
      const now = Date.now();
      const oneHourMs = 60 * 60 * 1000;

      // Just under 1h
      const postUnderOneHour = createMockPost({
        createdAt: now - (oneHourMs - 1000),
        commentCount: 12,
      });

      // Just over 1h
      const postOverOneHour = createMockPost({
        createdAt: now - (oneHourMs + 1000),
        commentCount: 12,
      });

      const scoreUnder = calculator.calculateVelocityScore(postUnderOneHour);
      const scoreOver = calculator.calculateVelocityScore(postOverOneHour);

      // scoreUnder should have 1.5x boost
      expect(scoreUnder).toBeGreaterThan(scoreOver);
    });

    it("should correctly transition boost at 24h boundary", () => {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Just under 24h
      const postUnder24h = createMockPost({
        createdAt: now - (oneDayMs - 1000),
        commentCount: 8,
      });

      // Just over 24h
      const postOver24h = createMockPost({
        createdAt: now - (oneDayMs + 1000),
        commentCount: 8,
      });

      const scoreUnder = calculator.calculateVelocityScore(postUnder24h);
      const scoreOver = calculator.calculateVelocityScore(postOver24h);

      // scoreUnder should have 1.2x boost, scoreOver has 1.0x
      expect(scoreUnder).toBeGreaterThan(scoreOver);
    });

    it("should scale with higher comment counts", () => {
      const now = Date.now();
      const post1 = createMockPost({
        createdAt: now - 60 * 60 * 1000, // 1 hour ago
        commentCount: 5,
      });

      const post2 = createMockPost({
        createdAt: now - 60 * 60 * 1000, // 1 hour ago
        commentCount: 10,
      });

      const score1 = calculator.calculateVelocityScore(post1);
      const score2 = calculator.calculateVelocityScore(post2);

      // score2 should be roughly 2x score1
      expect(score2).toBeCloseTo(score1 * 2, 0);
    });

    it("should handle edge case of post created in far future (should not boost)", () => {
      const now = Date.now();
      const post = createMockPost({
        createdAt: now + 24 * 60 * 60 * 1000, // 1 day in future
        commentCount: 5,
      });

      const score = calculator.calculateVelocityScore(post);

      // Should handle negative age gracefully (no crash, reasonable output)
      expect(score).toBeDefined();
      expect(typeof score).toBe("number");
    });
  });

  describe("calculateFeedTrendScore", () => {
    it("should return 0 when no trending topics are set", () => {
      const post = createMockPost({
        content: "This is a test post about trending topics",
      });

      const score = calculator.calculateFeedTrendScore(post);

      expect(score).toBe(0);
    });

    it("should return 0 when post content has no trending matches", () => {
      calculator.trendingTopics = [
        { topic: "AI Ethics", score: 0.8 },
        { topic: "Superintelligence", score: 0.9 },
      ];

      const post = createMockPost({
        content: "This post discusses random unrelated topics",
      });

      const score = calculator.calculateFeedTrendScore(post);

      expect(score).toBe(0);
    });

    it("should score > 0 when post matches one trending topic", () => {
      calculator.trendingTopics = [
        { topic: "AI Ethics", score: 0.8 },
        { topic: "Superintelligence", score: 0.9 },
        { topic: "Alignment", score: 0.85 },
      ];

      const post = createMockPost({
        content: "Let me discuss AI Ethics in depth with examples",
      });

      const score = calculator.calculateFeedTrendScore(post);

      // 1 match out of 3 topics = 1/3 ≈ 0.333
      expect(score).toBeCloseTo(0.333, 2);
      expect(score).toBeGreaterThan(0);
    });

    it("should score higher for posts matching multiple trending topics", () => {
      calculator.trendingTopics = [
        { topic: "AI Ethics", score: 0.8 },
        { topic: "Superintelligence", score: 0.9 },
        { topic: "Alignment", score: 0.85 },
      ];

      const post = createMockPost({
        content: "Discussion of AI Ethics and Superintelligence challenges",
      });

      const score = calculator.calculateFeedTrendScore(post);

      // 2 matches out of 3 topics = 2/3 ≈ 0.667
      expect(score).toBeCloseTo(0.667, 2);
    });

    it("should cap score at 1.0 for posts matching all trending topics", () => {
      calculator.trendingTopics = [
        { topic: "Virtue", score: 0.8 },
        { topic: "Stoicism", score: 0.9 },
      ];

      const post = createMockPost({
        content: "Virtue and Stoicism are core philosophical concepts",
      });

      const score = calculator.calculateFeedTrendScore(post);

      expect(score).toBe(1.0);
    });

    it("should be case-insensitive when matching topics", () => {
      calculator.trendingTopics = [
        { topic: "AI Ethics", score: 0.8 },
        { topic: "Alignment", score: 0.85 },
      ];

      const post = createMockPost({
        content: "Discussion of ai ethics and ALIGNMENT strategies",
      });

      const score = calculator.calculateFeedTrendScore(post);

      // 2 matches out of 2 = 1.0
      expect(score).toBe(1.0);
    });

    it("should handle substring matches within content", () => {
      calculator.trendingTopics = [
        { topic: "phil", score: 0.8 },
        { topic: "virtue", score: 0.9 },
      ];

      const post = createMockPost({
        content: "Discussion of virtue and philosophy together",
      });

      const score = calculator.calculateFeedTrendScore(post);

      // "phil" is substring of "philosophy" and "virtue" found in content
      expect(score).toBe(1.0);
    });
  });

  describe("calculateAgentRelevance", () => {
    it("should return 0.5 when no interests are provided", () => {
      const post = createMockPost();
      const score = calculator.calculateAgentRelevance(post, "classical", []);

      expect(score).toBe(0.5);
    });

    it("should return 0.5 when interests parameter is null/undefined", () => {
      const post = createMockPost();
      const score1 = calculator.calculateAgentRelevance(post, "classical", null);
      const score2 = calculator.calculateAgentRelevance(post, "classical");

      expect(score1).toBe(0.5);
      expect(score2).toBe(0.5);
    });

    it("should return 1.0 when match score > 0.7", () => {
      const post = createMockPost({
        content: "Discussion of virtue, duty, and reason in stoicism",
      });
      const interests = ["virtue", "duty", "reason", "apatheia"];

      const score = calculator.calculateAgentRelevance(post, "classical", interests);

      // 3 out of 4 matches = 0.75 > 0.7, so returns 1.0
      expect(score).toBe(1.0);
    });

    it("should return match score when <= 0.7", () => {
      const post = createMockPost({
        content: "Brief mention of virtue in philosophy",
      });
      const interests = ["virtue", "duty", "reason", "apatheia", "logos"];

      const score = calculator.calculateAgentRelevance(post, "classical", interests);

      // 1 out of 5 matches = 0.2 <= 0.7, so returns 0.2
      expect(score).toBeCloseTo(0.2, 1);
    });

    it("should score 0 when no interests match", () => {
      const post = createMockPost({
        content: "Random content about unrelated topics",
      });
      const interests = ["virtue", "duty", "reason"];

      const score = calculator.calculateAgentRelevance(post, "classical", interests);

      expect(score).toBe(0);
    });

    it("should be case-insensitive when matching interests", () => {
      const post = createMockPost({
        content: "Discussion of FREEDOM and Responsibility in existentialism",
      });
      const interests = ["freedom", "responsibility"];

      const score = calculator.calculateAgentRelevance(
        post,
        "existentialist",
        interests,
      );

      // Both match = 1.0
      expect(score).toBe(1.0);
    });
  });

  describe("getAgentInterests", () => {
    it("should return classical agent interests", () => {
      const interests = calculator.getAgentInterests("classical");

      expect(interests).toContain("stoicism");
      expect(interests).toContain("virtue");
      expect(interests).toContain("duty");
      expect(interests.length).toBeGreaterThan(0);
    });

    it("should return existentialist agent interests", () => {
      const interests = calculator.getAgentInterests("existentialist");

      expect(interests).toContain("freedom");
      expect(interests).toContain("responsibility");
      expect(interests).toContain("authenticity");
    });

    it("should return transcendentalist agent interests", () => {
      const interests = calculator.getAgentInterests("transcendentalist");

      expect(interests).toContain("nature");
      expect(interests).toContain("intuition");
      expect(interests).toContain("self-reliance");
    });

    it("should return joyce agent interests", () => {
      const interests = calculator.getAgentInterests("joyce");

      expect(interests).toContain("consciousness");
      expect(interests).toContain("experience");
      expect(interests).toContain("intentionality");
    });

    it("should return enlightenment agent interests", () => {
      const interests = calculator.getAgentInterests("enlightenment");

      expect(interests).toContain("rights");
      expect(interests).toContain("reason");
      expect(interests).toContain("tolerance");
    });

    it("should return beat agent interests", () => {
      const interests = calculator.getAgentInterests("beat");

      expect(interests).toContain("counterculture");
      expect(interests).toContain("spontaneity");
      expect(interests).toContain("zen");
    });

    it("should return cyberpunk agent interests", () => {
      const interests = calculator.getAgentInterests("cyberpunk");

      expect(interests).toContain("posthumanism");
      expect(interests).toContain("AI ethics");
      expect(interests).toContain("cyborg rights");
    });

    it("should return satirist agent interests", () => {
      const interests = calculator.getAgentInterests("satirist");

      expect(interests).toContain("absurd");
      expect(interests).toContain("irony");
      expect(interests).toContain("satire");
    });

    it("should return scientist agent interests", () => {
      const interests = calculator.getAgentInterests("scientist");

      expect(interests).toContain("empiricism");
      expect(interests).toContain("cosmos");
      expect(interests).toContain("testability");
    });

    it("should return empty array for unknown agent type", () => {
      const interests = calculator.getAgentInterests("unknown-agent");

      expect(interests).toEqual([]);
    });
  });
});
