/**
 * SemanticSearch Debug Output Integration Tests
 *
 * Tests verify that debug formatting works correctly when SemanticSearch
 * includes debug data in scoring results, testing the full pipeline from
 * search scoring through debug output formatting.
 */

// Import debug formatting functions from compiled SDK
const {
  calculateBreakdown,
  formatDebugBreakdown,
  formatDebugBreakdownJSON,
  formatDebugBreakdownMultiline,
} = require("../services/moltbook-sdk/dist/debugFormatter");

describe("SemanticSearch Debug Output Integration", () => {
  describe("calculateBreakdown Function", () => {
    it("should calculate breakdown from ScoringResult with multipliers", () => {
      // Create a scoring result with correctly calculated values
      // Formula: baseScore × recencyMult × reputationMult × followBoost = finalScore
      const baseScore = 0.75;
      const recencyMult = 0.95;
      const reputationMult = 1.1;
      const followBoost = 1.2;
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "calc-test-1",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      const breakdown = calculateBreakdown(scoringResult);

      // Verify structure
      expect(breakdown.postId).toBe("calc-test-1");
      expect(breakdown.baseScore).toBe(baseScore);
      expect(breakdown.finalScore).toBeCloseTo(finalScore, 4);
      expect(breakdown.factors.recency.multiplier).toBe(recencyMult);
      expect(breakdown.factors.reputation.multiplier).toBe(reputationMult);
      expect(breakdown.factors.followBoost.multiplier).toBe(followBoost);

      // Verify contribution calculations exist
      expect(breakdown.factors.recency.contribution).toBeDefined();
      expect(breakdown.factors.reputation.contribution).toBeDefined();
      expect(breakdown.factors.followBoost.contribution).toBeDefined();

      // Verify percentages exist
      expect(breakdown.factors.recency.contributionPercent).toBeDefined();
      expect(breakdown.factors.reputation.contributionPercent).toBeDefined();
      expect(breakdown.factors.followBoost.contributionPercent).toBeDefined();

      // Verify total change calculations
      expect(breakdown.totalChange).toBeDefined();
      expect(breakdown.totalChangePercent).toBeDefined();
    });

    it("should throw error when calculateBreakdown called without debug data", () => {
      const scoringResult = {
        postId: "no-debug-test",
        finalScore: 0.8,
        // debug field intentionally omitted
      };

      expect(() => calculateBreakdown(scoringResult)).toThrow(/Debug data required/);
    });

    it("should validate score calculation integrity", () => {
      // Create a scoring result with mismatched calculations (intentional error)
      const scoringResult = {
        postId: "bad-calc",
        finalScore: 0.99, // Wrong: calculated is different
        debug: {
          semanticScore: 0.75,
          recencyMultiplier: 0.95,
          reputationMultiplier: 1.1,
          followBoost: 1.2,
          combinedScore: 0.9405, // This is the correct calculated score
        },
      };

      expect(() => calculateBreakdown(scoringResult)).toThrow(/Score calculation mismatch/);
    });

    it("should calculate correct contribution percentages", () => {
      // Correctly calculated: 0.8 × 0.96 × 1.08 × 1.15 = 0.956
      const baseScore = 0.8;
      const recencyMult = 0.96;
      const reputationMult = 1.08;
      const followBoost = 1.15;
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "percent-test",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      const breakdown = calculateBreakdown(scoringResult);

      // Verify that percentages sum reasonably
      const totalPercent =
        breakdown.factors.recency.contributionPercent +
        breakdown.factors.reputation.contributionPercent +
        breakdown.factors.followBoost.contributionPercent;

      // Total should be approximately equal to totalChangePercent
      expect(Math.abs(totalPercent - breakdown.totalChangePercent)).toBeLessThan(0.5);
    });
  });

  describe("formatDebugBreakdown Function", () => {
    it("should format single-line output correctly", () => {
      const baseScore = 0.75;
      const recencyMult = 0.92;
      const reputationMult = 1.1;
      const followBoost = 1.25;
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "format-test-1",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      const formatted = formatDebugBreakdown(scoringResult);

      // Verify format contains expected elements
      expect(formatted).toContain("Post");
      expect(formatted).toContain("Semantic:");
      expect(formatted).toContain("Recency:");
      expect(formatted).toContain("Reputation:");
      expect(formatted).toContain("Follow:");
      expect(formatted).toContain("→ Final:");

      // Verify it's a single line (no newlines)
      expect(formatted.split("\n").length).toBe(1);

      // Verify numeric values are present
      expect(formatted).toMatch(/0\.\d+/);
    });

    it("should handle positive and negative contributions", () => {
      const baseScore = 0.85;
      const recencyMult = 0.85; // Decay
      const reputationMult = 1.2; // Boost
      const followBoost = 0.95; // No follow
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "format-test-2",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      const formatted = formatDebugBreakdown(scoringResult);

      // Should contain both positive and negative contributions
      expect(formatted).toMatch(/[+-]\d+\.\d%/);
    });
  });

  describe("formatDebugBreakdownJSON Function", () => {
    it("should produce valid JSON output", () => {
      const baseScore = 0.75;
      const recencyMult = 0.95;
      const reputationMult = 1.1;
      const followBoost = 1.2;
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "json-test-1",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      const jsonStr = formatDebugBreakdownJSON(scoringResult);

      // Verify it's valid JSON
      let parsed;
      expect(() => {
        parsed = JSON.parse(jsonStr);
      }).not.toThrow();

      // Verify JSON structure
      expect(parsed.postId).toBe("json-test-1");
      expect(parsed.baseScore).toBe(baseScore);
      expect(parsed.finalScore).toBeCloseTo(finalScore, 4);
      expect(parsed.factors).toBeDefined();
      expect(parsed.factors.recency).toBeDefined();
      expect(parsed.factors.reputation).toBeDefined();
      expect(parsed.factors.followBoost).toBeDefined();
    });

    it("should preserve numeric precision in JSON", () => {
      const baseScore = 0.666;
      const recencyMult = 1.111;
      const reputationMult = 1.222;
      const followBoost = 0.999;
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "json-precision",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      const jsonStr = formatDebugBreakdownJSON(scoringResult);
      const parsed = JSON.parse(jsonStr);

      // Verify precision is preserved
      expect(parsed.finalScore).toBeCloseTo(finalScore, 5);
      expect(parsed.baseScore).toBeCloseTo(baseScore, 5);
    });
  });

  describe("formatDebugBreakdownMultiline Function", () => {
    it("should format multiline output for terminal display", () => {
      const baseScore = 0.75;
      const recencyMult = 0.92;
      const reputationMult = 1.1;
      const followBoost = 1.25;
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "multiline-test",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      const multiline = formatDebugBreakdownMultiline(scoringResult);

      // Should be multiple lines
      const lines = multiline.split("\n");
      expect(lines.length).toBeGreaterThan(1);

      // Should contain key sections
      expect(multiline).toContain("Post:");
      expect(multiline).toContain("Semantic (base):");
      expect(multiline).toContain("Final Score:");
      expect(multiline).toContain("Total Change:");

      // Should have a separator line
      expect(multiline).toContain("─────────────────────────────");
    });

    it("should show score progression through stages", () => {
      const baseScore = 0.8;
      const recencyMult = 0.95;
      const reputationMult = 1.05;
      const followBoost = 1.15;
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "progression-test",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      const multiline = formatDebugBreakdownMultiline(scoringResult);

      // Should show After Recency, After Reputation, After FollowBoost
      expect(multiline).toContain("After Recency:");
      expect(multiline).toContain("After Reputation:");
      expect(multiline).toContain("After FollowBoost:");
    });
  });

  describe("Integration Tests with Real Data", () => {
    it("should handle edge case: all multipliers = 1.0 (no change)", () => {
      const baseScore = 0.5;
      const finalScore = baseScore * 1.0 * 1.0 * 1.0;

      const scoringResult = {
        postId: "no-change-test",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: 1.0,
          reputationMultiplier: 1.0,
          followBoost: 1.0,
          combinedScore: finalScore,
        },
      };

      const breakdown = calculateBreakdown(scoringResult);

      // All contributions should be 0
      expect(breakdown.factors.recency.contribution).toBe(0);
      expect(breakdown.factors.reputation.contribution).toBe(0);
      expect(breakdown.factors.followBoost.contribution).toBe(0);
      expect(breakdown.totalChange).toBe(0);
    });

    it("should handle large multipliers correctly", () => {
      const baseScore = 0.6;
      const recencyMult = 1.5;
      const reputationMult = 1.8;
      const followBoost = 1.0;
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "large-multiplier",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      const breakdown = calculateBreakdown(scoringResult);

      // Should calculate positive contributions for both high multipliers
      expect(breakdown.factors.recency.contributionPercent).toBeGreaterThan(0);
      expect(breakdown.factors.reputation.contributionPercent).toBeGreaterThan(0);
      expect(breakdown.totalChangePercent).toBeGreaterThan(0);
    });

    it("should handle very small final scores", () => {
      const baseScore = 0.01;
      const recencyMult = 0.99;
      const reputationMult = 1.01;
      const followBoost = 1.0;
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "small-score",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      const breakdown = calculateBreakdown(scoringResult);

      // Should handle small numbers without error
      expect(breakdown.finalScore).toBeCloseTo(finalScore, 4);
      expect(breakdown.factors.recency.multiplier).toBe(recencyMult);
    });

    it("should handle followed vs unfollowed author pattern", () => {
      // Followed author has higher followBoost
      const followedBase = 0.8;
      const followedRecency = 0.95;
      const followedReputation = 1.0;
      const followedBoost = 1.2; // High boost for followed
      const followedFinal =
        followedBase * followedRecency * followedReputation * followedBoost;

      // Unfollowed author has no boost
      const unfollowedBase = 0.8;
      const unfollowedRecency = 0.95;
      const unfollowedReputation = 1.0;
      const unfollowedBoost = 1.0; // No boost for unfollowed
      const unfollowedFinal =
        unfollowedBase * unfollowedRecency * unfollowedReputation * unfollowedBoost;

      const followedResult = {
        postId: "followed-post",
        finalScore: followedFinal,
        debug: {
          semanticScore: followedBase,
          recencyMultiplier: followedRecency,
          reputationMultiplier: followedReputation,
          followBoost: followedBoost,
          combinedScore: followedFinal,
        },
      };

      const unfollowedResult = {
        postId: "unfollowed-post",
        finalScore: unfollowedFinal,
        debug: {
          semanticScore: unfollowedBase,
          recencyMultiplier: unfollowedRecency,
          reputationMultiplier: unfollowedReputation,
          followBoost: unfollowedBoost,
          combinedScore: unfollowedFinal,
        },
      };

      const followedBreakdown = calculateBreakdown(followedResult);
      const unfollowedBreakdown = calculateBreakdown(unfollowedResult);

      // Followed should have higher final score due to boost
      expect(followedBreakdown.finalScore).toBeGreaterThan(unfollowedBreakdown.finalScore);

      // followBoost contribution should be higher for followed
      expect(followedBreakdown.factors.followBoost.contributionPercent).toBeGreaterThan(
        unfollowedBreakdown.factors.followBoost.contributionPercent
      );
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should throw error for missing debug field", () => {
      const scoringResult = {
        postId: "no-debug-field",
        finalScore: 0.5,
        // debug missing
      };

      expect(() => calculateBreakdown(scoringResult)).toThrow(/Debug data required/);
    });

    it("should preserve exact values through formatting pipeline", () => {
      const baseScore = 0.65;
      const recencyMult = 0.98;
      const reputationMult = 1.12;
      const followBoost = 1.05;
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "pipeline-test",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      // Calculate breakdown
      const breakdown = calculateBreakdown(scoringResult);

      // Format JSON
      const jsonStr = formatDebugBreakdownJSON(scoringResult);
      const parsed = JSON.parse(jsonStr);

      // Values should match
      expect(parsed.finalScore).toBeCloseTo(breakdown.finalScore, 5);
      expect(parsed.baseScore).toBeCloseTo(breakdown.baseScore, 5);
    });

    it("should format breakdown with reasonable multiplier ranges", () => {
      // Test with all multipliers in normal range [0.5, 2.0]
      const baseScore = 0.7;
      const recencyMult = 0.8;
      const reputationMult = 1.3;
      const followBoost = 1.1;
      const finalScore = baseScore * recencyMult * reputationMult * followBoost;

      const scoringResult = {
        postId: "reasonable-range",
        finalScore,
        debug: {
          semanticScore: baseScore,
          recencyMultiplier: recencyMult,
          reputationMultiplier: reputationMult,
          followBoost,
          combinedScore: finalScore,
        },
      };

      // All formatters should work without error
      const breakdown = calculateBreakdown(scoringResult);
      const singleLine = formatDebugBreakdown(scoringResult);
      const multiline = formatDebugBreakdownMultiline(scoringResult);
      const json = formatDebugBreakdownJSON(scoringResult);

      // Verify all produce output
      expect(breakdown).toBeDefined();
      expect(singleLine.length).toBeGreaterThan(0);
      expect(multiline.length).toBeGreaterThan(0);
      expect(json.length).toBeGreaterThan(0);
    });
  });
});
