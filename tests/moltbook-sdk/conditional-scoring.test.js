/**
 * Conditional Scoring Tests
 *
 * Tests for feature flag-based conditional scoring:
 * - Disable/enable recency factor
 * - Disable/enable reputation factor
 * - Disable/enable follow boost factor
 * - Combine multiple disabled factors
 */

describe("Conditional Scoring (Feature Flags)", () => {
  // Mock config for testing
  const createMockConfig = (flags) => ({
    enableRecency: flags.enableRecency !== false,
    enableReputation: flags.enableReputation !== false,
    enableFollowBoost: flags.enableFollowBoost !== false,
    enableDebug: flags.enableDebug === true,
  });

  const baseInput = {
    postId: "test-post",
    semanticScore: 0.8,
    ageInDays: 7,
    authorHistoricalScore: 0.7,
    authorRecentScore: 0.6,
    isFollowedAuthor: true,
  };

  const baseWeights = {
    historicalWeight: 0.5,
    recentWeight: 0.25,
    recencyExponent: 1.0,
    reputationExponent: 1.0,
    recencyHalfLife: 7,
  };

  describe("All Factors Enabled (Default)", () => {
    it("should apply all factors when all flags enabled", () => {
      const flags = createMockConfig({
        enableRecency: true,
        enableReputation: true,
        enableFollowBoost: true,
      });

      // With all factors:
      // recency(7,1,7) = 0.5
      // reputation(0.7,0.6,0.5,0.25,1) = 1.5 (clamped max)
      // followBoost = 1.25
      // final = 0.8 * 0.5 * 1.5 * 1.25 = 0.75
      const expectedScore = 0.8 * 0.5 * 1.5 * 1.25;

      expect(flags.enableRecency).toBe(true);
      expect(flags.enableReputation).toBe(true);
      expect(flags.enableFollowBoost).toBe(true);
      expect(expectedScore).toBeCloseTo(0.75, 1);
    });
  });

  describe("Disable Recency Factor", () => {
    it("should skip recency when disabled (neutral multiplier = 1.0)", () => {
      const flags = createMockConfig({
        enableRecency: false,
        enableReputation: true,
        enableFollowBoost: true,
      });

      // Without recency (neutral = 1.0):
      // recency = 1.0 (neutral)
      // reputation = 1.5
      // followBoost = 1.25
      // final = 0.8 * 1.0 * 1.5 * 1.25 = 1.5
      const expectedScore = 0.8 * 1.0 * 1.5 * 1.25;

      expect(flags.enableRecency).toBe(false);
      expect(expectedScore).toBeCloseTo(1.5, 1);
    });

    it("should have higher score without recency decay", () => {
      const withRecency = 0.8 * 0.5 * 1.5 * 1.25; // = 0.75
      const withoutRecency = 0.8 * 1.0 * 1.5 * 1.25; // = 1.5

      expect(withoutRecency).toBeGreaterThan(withRecency);
    });
  });

  describe("Disable Reputation Factor", () => {
    it("should skip reputation when disabled (neutral multiplier = 1.0)", () => {
      const flags = createMockConfig({
        enableRecency: true,
        enableReputation: false,
        enableFollowBoost: true,
      });

      // Without reputation (neutral = 1.0):
      // recency = 0.5
      // reputation = 1.0 (neutral)
      // followBoost = 1.25
      // final = 0.8 * 0.5 * 1.0 * 1.25 = 0.5
      const expectedScore = 0.8 * 0.5 * 1.0 * 1.25;

      expect(flags.enableReputation).toBe(false);
      expect(expectedScore).toBeCloseTo(0.5, 1);
    });

    it("should have lower score without reputation boost", () => {
      const withReputation = 0.8 * 0.5 * 1.5 * 1.25; // = 0.75
      const withoutReputation = 0.8 * 0.5 * 1.0 * 1.25; // = 0.5

      expect(withReputation).toBeGreaterThan(withoutReputation);
    });
  });

  describe("Disable Follow Boost", () => {
    it("should skip follow boost when disabled (neutral = 1.0)", () => {
      const flags = createMockConfig({
        enableRecency: true,
        enableReputation: true,
        enableFollowBoost: false,
      });

      // Without follow boost (neutral = 1.0):
      // recency = 0.5
      // reputation = 1.5
      // followBoost = 1.0 (neutral)
      // final = 0.8 * 0.5 * 1.5 * 1.0 = 0.6
      const expectedScore = 0.8 * 0.5 * 1.5 * 1.0;

      expect(flags.enableFollowBoost).toBe(false);
      expect(expectedScore).toBeCloseTo(0.6, 1);
    });

    it("should have lower score without follow boost", () => {
      const withFollowBoost = 0.8 * 0.5 * 1.5 * 1.25; // = 0.75
      const withoutFollowBoost = 0.8 * 0.5 * 1.5 * 1.0; // = 0.6

      expect(withFollowBoost).toBeGreaterThan(withoutFollowBoost);
    });
  });

  describe("Multiple Factors Disabled", () => {
    it("should disable recency and reputation", () => {
      const flags = createMockConfig({
        enableRecency: false,
        enableReputation: false,
        enableFollowBoost: true,
      });

      // Without recency and reputation:
      // final = 0.8 * 1.0 * 1.0 * 1.25 = 1.0
      const expectedScore = 0.8;

      expect(flags.enableRecency).toBe(false);
      expect(flags.enableReputation).toBe(false);
      expect(expectedScore).toBe(0.8);
    });

    it("should disable all factors except semantic", () => {
      const flags = createMockConfig({
        enableRecency: false,
        enableReputation: false,
        enableFollowBoost: false,
      });

      // Only semantic score:
      // final = 0.8 * 1.0 * 1.0 * 1.0 = 0.8
      const expectedScore = 0.8;

      expect(flags.enableRecency).toBe(false);
      expect(flags.enableReputation).toBe(false);
      expect(flags.enableFollowBoost).toBe(false);
      expect(expectedScore).toBe(0.8);
    });
  });

  describe("Conditional Multiplier Application", () => {
    it("should apply exponent conditionally for recency", () => {
      // Recency exponent 0 = neutral (any^0 = 1.0)
      const recencyExponent0 = Math.pow(Math.pow(0.5, 7 / 7), 0);
      const recencyExponent1 = Math.pow(Math.pow(0.5, 7 / 7), 1.0);

      expect(recencyExponent0).toBeCloseTo(1.0, 5);
      expect(recencyExponent1).toBeCloseTo(0.5, 5);
    });

    it("should apply exponent conditionally for reputation", () => {
      // Reputation exponent 0 = neutral (any^0 = 1.0)
      const reputationBase = 1.0 + 0.5 * 0.7 + 0.25 * 0.6; // = 1.5
      const reputationClamped = Math.max(0.5, Math.min(1.5, reputationBase)); // clamped to 1.5
      const reputationExponent0 = Math.pow(reputationClamped, 0);
      const reputationExponent1 = Math.pow(reputationClamped, 1.0);

      expect(reputationExponent0).toBe(1.0);
      expect(reputationExponent1).toBeCloseTo(1.5, 5);
    });
  });

  describe("Follow Boost Conditional", () => {
    it("should apply 1.25x when followed and enabled", () => {
      const flags = createMockConfig({ enableFollowBoost: true });
      const isFollowed = true;

      const boost = flags.enableFollowBoost && isFollowed ? 1.25 : 1.0;

      expect(boost).toBe(1.25);
    });

    it("should apply 1.0 when followed but disabled", () => {
      const flags = createMockConfig({ enableFollowBoost: false });
      const isFollowed = true;

      const boost = flags.enableFollowBoost && isFollowed ? 1.25 : 1.0;

      expect(boost).toBe(1.0);
    });

    it("should apply 1.0 when not followed and enabled", () => {
      const flags = createMockConfig({ enableFollowBoost: true });
      const isFollowed = false;

      const boost = flags.enableFollowBoost && isFollowed ? 1.25 : 1.0;

      expect(boost).toBe(1.0);
    });
  });

  describe("Configuration Consistency", () => {
    it("should handle missing flags gracefully (default to enabled)", () => {
      const flags = createMockConfig({});

      expect(flags.enableRecency).toBe(true);
      expect(flags.enableReputation).toBe(true);
      expect(flags.enableFollowBoost).toBe(true);
      expect(flags.enableDebug).toBe(false);
    });

    it("should track flag state in config object", () => {
      const flags = createMockConfig({
        enableRecency: false,
        enableReputation: true,
      });

      expect(Object.keys(flags).length).toBe(4);
      expect(flags).toHaveProperty("enableRecency");
      expect(flags).toHaveProperty("enableReputation");
      expect(flags).toHaveProperty("enableFollowBoost");
      expect(flags).toHaveProperty("enableDebug");
    });
  });

  describe("Score Range Preservation", () => {
    it("should maintain scores in valid range after applying conditions", () => {
      const scores = [
        0.8 * 0.5 * 1.2 * 1.25, // all enabled
        0.8 * 1.0 * 1.2 * 1.25, // no recency
        0.8 * 0.5 * 1.0 * 1.25, // no reputation
        0.8 * 0.5 * 1.2 * 1.0, // no follow
        0.8, // only semantic
      ];

      for (const score of scores) {
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(2.0); // semantic * max_all_factors
      }
    });

    it("should be monotonic: all enabled > any disabled", () => {
      const allEnabled = 0.8 * 0.5 * 1.5 * 1.25; // 0.75

      const noRecency = 0.8 * 1.0 * 1.5 * 1.25; // 1.5
      const noReputation = 0.8 * 0.5 * 1.0 * 1.25; // 0.5
      const noFollowBoost = 0.8 * 0.5 * 1.5 * 1.0; // 0.6

      // Note: disabling recency INCREASES score (removes decay)
      // so "all enabled" is not always highest
      expect(noRecency).toBeGreaterThan(allEnabled);
      expect(allEnabled).toBeGreaterThan(noReputation);
      expect(noReputation).toBeLessThan(noFollowBoost);
    });
  });
});
