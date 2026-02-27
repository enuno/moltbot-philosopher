/**
 * Scoring Types Tests
 *
 * Tests for P4.1 hybrid search scoring type definitions:
 * - PostScoringInputs: Input parameters for scoring algorithm
 * - ScoringWeights: Tunable parameters and exponents
 * - ScoringResult: Output with optional debug information
 */

describe("Scoring Types", () => {
  it("should define PostScoringInputs interface", () => {
    const input = {
      postId: "test-123",
      semanticScore: 0.85,
      ageInDays: 2,
      authorHistoricalScore: 0.8,
      authorRecentScore: 0.6,
      isFollowedAuthor: true,
    };
    expect(input.postId).toBe("test-123");
  });

  it("should define ScoringWeights interface", () => {
    const weights = {
      historicalWeight: 0.5,
      recentWeight: 0.25,
      recencyExponent: 1.0,
      reputationExponent: 1.0,
      recencyHalfLife: 7,
    };
    expect(weights.historicalWeight).toBe(0.5);
  });

  it("should define ScoringResult interface", () => {
    const result = {
      postId: "test-123",
      finalScore: 0.92,
      debug: {
        semanticScore: 0.85,
        recencyMultiplier: 0.95,
        reputationMultiplier: 1.2,
        followBoost: 1.25,
        combinedScore: 0.92,
      },
    };
    expect(result.finalScore).toBe(0.92);
  });
});

describe("calculateRecency()", () => {
  const { calculateRecency } = require("../../services/moltbook-sdk/dist/scoring");

  it("should return 1.0 for 0-day-old post", () => {
    const result = calculateRecency(0, 1.0, 7);
    expect(result).toBeCloseTo(1.0, 2);
  });

  it("should return ~0.89 for 1-day-old post with half-life 7", () => {
    const result = calculateRecency(1, 1.0, 7);
    expect(result).toBeCloseTo(0.89, 1);
  });

  it("should return 0.5 for 7-day-old post (half-life)", () => {
    const result = calculateRecency(7, 1.0, 7);
    expect(result).toBeCloseTo(0.5, 1);
  });

  it("should return 0.25 for 14-day-old post", () => {
    const result = calculateRecency(14, 1.0, 7);
    expect(result).toBeCloseTo(0.25, 1);
  });

  it("should apply exponent to multiplier", () => {
    const noExponent = calculateRecency(7, 1.0, 7);
    const withExponent = calculateRecency(7, 2.0, 7);
    expect(withExponent).toBeLessThan(noExponent);
  });

  it("should throw 'Age cannot be negative' when ageInDays < 0", () => {
    expect(() => calculateRecency(-1, 1.0, 7)).toThrow("Age cannot be negative");
  });

  it("should throw 'Half-life must be positive' when halfLife <= 0", () => {
    expect(() => calculateRecency(7, 1.0, 0)).toThrow("Half-life must be positive");
    expect(() => calculateRecency(7, 1.0, -5)).toThrow("Half-life must be positive");
  });

  it("should throw 'Exponent must be non-negative' when exponent < 0", () => {
    expect(() => calculateRecency(7, -1.0, 7)).toThrow("Exponent must be non-negative");
  });
});

describe("calculateReputation()", () => {
  const { calculateReputation } = require("../../services/moltbook-sdk/dist/scoring");

  it("should return 1.0 for neutral author (0 scores)", () => {
    const result = calculateReputation(0, 0, 0.5, 0.25, 1.0);
    expect(result).toBeCloseTo(1.0, 2);
  });

  it("should boost for high historical score", () => {
    const result = calculateReputation(0.8, 0, 0.5, 0.25, 1.0);
    expect(result).toBeCloseTo(1.4, 1); // 1.0 + 0.5*0.8
  });

  it("should boost for high recent score", () => {
    const result = calculateReputation(0, 0.6, 0.5, 0.25, 1.0);
    expect(result).toBeCloseTo(1.15, 1); // 1.0 + 0.25*0.6
  });

  it("should clamp to minimum 0.5", () => {
    const result = calculateReputation(-1, -1, 0.5, 0.25, 1.0);
    expect(result).toBeCloseTo(0.5, 2);
  });

  it("should clamp to maximum 1.5", () => {
    const result = calculateReputation(1, 1, 0.5, 0.25, 1.0);
    expect(result).toBeCloseTo(1.5, 2); // clamp(1.0 + 0.5 + 0.25)
  });

  it("should apply exponent to final multiplier", () => {
    // Use inputs that clamp to a value < 1.0 so exponent reduces the result
    // base = 1.0 + 0.5*(-0.8) + 0.25*(-0.6) = 0.55, clamped to 0.55
    const exp1 = calculateReputation(-0.8, -0.6, 0.5, 0.25, 1.0);
    const exp2 = calculateReputation(-0.8, -0.6, 0.5, 0.25, 2.0);
    expect(exp2).toBeLessThan(exp1);
  });
});
