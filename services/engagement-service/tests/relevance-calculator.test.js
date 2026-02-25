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
});
