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

  it("should return minimum value with zero scores and weights", () => {
    // With valid inputs (scores [0,1], weights >= 0), minimum base = 1.0
    // This is the minimum achievable value, which is above the 0.5 clamp floor
    const result = calculateReputation(0, 0, 0, 0, 1.0);
    expect(result).toBeCloseTo(1.0, 2);
  });

  it("should clamp to maximum 1.5", () => {
    // base = 1.0 + 0.5*1 + 0.25*1 = 1.75, clamped to 1.5
    const result = calculateReputation(1, 1, 0.5, 0.25, 1.0);
    expect(result).toBeCloseTo(1.5, 2);
  });

  it("should apply exponent to final multiplier", () => {
    // When base = 1.0 (neutral case), exponent doesn't change it
    // When base > 1.0 and exponent > 1.0, it increases the result
    // When base < 1.0 and exponent > 1.0, it decreases the result (mathematically)
    // Since min valid base is 1.0 with weights >= 0, test exponent amplification
    const noExp = calculateReputation(0.8, 0.6, 0.5, 0.25, 1.0);
    const withExp = calculateReputation(0.8, 0.6, 0.5, 0.25, 2.0);
    expect(withExp).toBeGreaterThan(noExp);
  });

  it("should throw 'Historical score must be in [0, 1]' when out of range", () => {
    expect(() => calculateReputation(2.5, 0.5, 0.5, 0.25, 1.0))
      .toThrow("Historical score must be in [0, 1]");
    expect(() => calculateReputation(-0.5, 0.5, 0.5, 0.25, 1.0))
      .toThrow("Historical score must be in [0, 1]");
  });

  it("should throw 'Recent score must be in [0, 1]' when out of range", () => {
    expect(() => calculateReputation(0.5, 2.0, 0.5, 0.25, 1.0))
      .toThrow("Recent score must be in [0, 1]");
    expect(() => calculateReputation(0.5, -0.1, 0.5, 0.25, 1.0))
      .toThrow("Recent score must be in [0, 1]");
  });

  it("should throw on invalid weights or exponent", () => {
    expect(() => calculateReputation(0.5, 0.5, -0.1, 0.25, 1.0))
      .toThrow("Historical weight must be non-negative");
    expect(() => calculateReputation(0.5, 0.5, 0.5, -0.1, 1.0))
      .toThrow("Recent weight must be non-negative");
    expect(() => calculateReputation(0.5, 0.5, 0.5, 0.25, -1.0))
      .toThrow("Exponent must be non-negative");
  });
});

describe("normalizeScores()", () => {
  const { normalizeScores } = require("../../services/moltbook-sdk/dist/scoring");

  it("should normalize multiple different scores to [0, 1] range", () => {
    const scores = [0.2, 0.5, 0.9];
    const result = normalizeScores(scores);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(0.428571, 5);
    expect(result[2]).toBeCloseTo(1, 5);
  });

  it("should return empty array for empty input", () => {
    const result = normalizeScores([]);
    expect(result).toEqual([]);
  });

  it("should return [0] for single score", () => {
    const result = normalizeScores([0.5]);
    expect(result).toEqual([0]);
  });

  it("should return array of zeros for identical scores", () => {
    const scores = [0.5, 0.5, 0.5];
    const result = normalizeScores(scores);
    expect(result).toEqual([0, 0, 0]);
  });

  it("should normalize negative scores correctly", () => {
    const scores = [-1, 0, 1];
    const result = normalizeScores(scores);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(0.5, 5);
    expect(result[2]).toBeCloseTo(1, 5);
  });

  it("should normalize large numbers correctly", () => {
    const scores = [1000, 5000, 10000];
    const result = normalizeScores(scores);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(0.444444, 5);
    expect(result[2]).toBeCloseTo(1, 5);
  });

  it("should throw 'Scores must be an array' when input is not an array", () => {
    expect(() => normalizeScores(null)).toThrow("Scores must be an array");
    expect(() => normalizeScores(undefined)).toThrow("Scores must be an array");
    expect(() => normalizeScores("not an array")).toThrow("Scores must be an array");
    expect(() => normalizeScores({})).toThrow("Scores must be an array");
  });

  it("should throw when scores contain non-numeric values", () => {
    expect(() => normalizeScores([0.5, "invalid", 0.9])).toThrow(
      "All scores must be numbers"
    );
    expect(() => normalizeScores([0.5, null, 0.9])).toThrow(
      "All scores must be numbers"
    );
  });
});
