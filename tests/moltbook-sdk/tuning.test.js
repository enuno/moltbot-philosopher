/**
 * A/B Parameter Tuning Tests
 *
 * Verify that parameter variations (exponents, weights, half-life)
 * correctly affect ranking and scoring behavior
 */

const {
  calculateRecency,
  calculateReputation,
  normalizeScores,
  scorePost,
  scorePostConditional,
} = require("../../services/moltbook-sdk/dist/scoring");

describe("A/B Tuning: Parameter Sensitivity", () => {
  const baseInput = {
    postId: "test-post",
    semanticScore: 0.8,
    ageInDays: 7,
    authorHistoricalScore: 0.7,
    authorRecentScore: 0.6,
    isFollowedAuthor: false,
  };

  describe("Recency Exponent Tuning", () => {
    it("should increase recency impact with higher exponent", () => {
      const ageInDays = 7;
      const halfLife = 7;

      // Lower exponent = less decay
      const exp0_5 = calculateRecency(ageInDays, 0.5, halfLife);
      // Normal decay
      const exp1_0 = calculateRecency(ageInDays, 1.0, halfLife);
      // Higher exponent = more decay
      const exp2_0 = calculateRecency(ageInDays, 2.0, halfLife);

      // For age = half_life: base = 0.5
      // exp0.5: 0.5^0.5 = 0.707 (less decay)
      // exp1.0: 0.5^1.0 = 0.5 (normal)
      // exp2.0: 0.5^2.0 = 0.25 (more decay)

      expect(exp0_5).toBeGreaterThan(exp1_0);
      expect(exp1_0).toBeGreaterThan(exp2_0);
      expect(exp0_5).toBeCloseTo(0.707, 2);
      expect(exp1_0).toBeCloseTo(0.5, 2);
      expect(exp2_0).toBeCloseTo(0.25, 2);
    });

    it("should show ranking change when recency exponent increases", () => {
      const now = new Date();
      const recent = new Date(now - 1 * 24 * 60 * 60 * 1000); // 1 day old
      const old = new Date(now - 30 * 24 * 60 * 60 * 1000); // 30 days old

      const recentPost = {
        ...baseInput,
        postId: "recent",
        createdAt: recent,
        ageInDays: 1,
      };

      const oldPost = {
        ...baseInput,
        postId: "old",
        createdAt: old,
        ageInDays: 30,
      };

      // With low exponent, age difference matters less
      const weights_exp0_5 = {
        historicalWeight: 0.5,
        recentWeight: 0.25,
        recencyExponent: 0.5,
        reputationExponent: 1.0,
        recencyHalfLife: 7,
      };

      const recentScore_exp0_5 = scorePost(recentPost, weights_exp0_5).finalScore;
      const oldScore_exp0_5 = scorePost(oldPost, weights_exp0_5).finalScore;

      // With high exponent, age difference matters much more
      const weights_exp2_0 = {
        historicalWeight: 0.5,
        recentWeight: 0.25,
        recencyExponent: 2.0,
        reputationExponent: 1.0,
        recencyHalfLife: 7,
      };

      const recentScore_exp2_0 = scorePost(recentPost, weights_exp2_0).finalScore;
      const oldScore_exp2_0 = scorePost(oldPost, weights_exp2_0).finalScore;

      // Gap should widen with higher exponent
      const gap_exp0_5 = recentScore_exp0_5 - oldScore_exp0_5;
      const gap_exp2_0 = recentScore_exp2_0 - oldScore_exp2_0;

      expect(gap_exp2_0).toBeGreaterThan(gap_exp0_5);
    });
  });

  describe("Reputation Exponent Tuning", () => {
    it("should increase reputation impact with higher exponent", () => {
      const historicalScore = 0.7;
      const recentScore = 0.6;
      const historicalWeight = 0.5;
      const recentWeight = 0.25;

      // Base reputation: 1.0 + 0.5×0.7 + 0.25×0.6 = 1.5
      const rep_exp0_5 = calculateReputation(
        historicalScore,
        recentScore,
        historicalWeight,
        recentWeight,
        0.5,
      );
      const rep_exp1_0 = calculateReputation(
        historicalScore,
        recentScore,
        historicalWeight,
        recentWeight,
        1.0,
      );
      const rep_exp2_0 = calculateReputation(
        historicalScore,
        recentScore,
        historicalWeight,
        recentWeight,
        2.0,
      );

      // 1.5^0.5 = 1.225
      // 1.5^1.0 = 1.5
      // 1.5^2.0 = 2.25 (clamped to 1.5 max)

      expect(rep_exp0_5).toBeLessThan(rep_exp1_0);
      // 1.5^2.0 = 2.25 (no clamping on exponent result)
      expect(rep_exp2_0).toBeCloseTo(2.25, 2);
    });

    it("should separate high-reputation from low-reputation posts with tuning", () => {
      const expert = {
        ...baseInput,
        postId: "expert",
        authorHistoricalScore: 0.95,
        authorRecentScore: 0.85,
      };

      const novice = {
        ...baseInput,
        postId: "novice",
        authorHistoricalScore: 0.2,
        authorRecentScore: 0.1,
      };

      // With low exponent, reputation difference minimal
      const weights_exp0_5 = {
        historicalWeight: 0.5,
        recentWeight: 0.25,
        recencyExponent: 1.0,
        reputationExponent: 0.5,
        recencyHalfLife: 7,
      };

      const expertScore_exp0_5 = scorePost(expert, weights_exp0_5).finalScore;
      const noviceScore_exp0_5 = scorePost(novice, weights_exp0_5).finalScore;

      // With high exponent, reputation difference large
      const weights_exp2_0 = {
        historicalWeight: 0.5,
        recentWeight: 0.25,
        recencyExponent: 1.0,
        reputationExponent: 2.0,
        recencyHalfLife: 7,
      };

      const expertScore_exp2_0 = scorePost(expert, weights_exp2_0).finalScore;
      const noviceScore_exp2_0 = scorePost(novice, weights_exp2_0).finalScore;

      // Gap should widen with higher exponent
      const gap_exp0_5 = expertScore_exp0_5 - noviceScore_exp0_5;
      const gap_exp2_0 = expertScore_exp2_0 - noviceScore_exp2_0;

      expect(gap_exp2_0).toBeGreaterThan(gap_exp0_5);
    });
  });

  describe("Historical Weight Tuning", () => {
    it("should increase expert advantage with higher historical weight", () => {
      const expert = {
        ...baseInput,
        postId: "expert",
        authorHistoricalScore: 0.9,
        authorRecentScore: 0.5,
      };

      const novice = {
        ...baseInput,
        postId: "novice",
        authorHistoricalScore: 0.3,
        authorRecentScore: 0.8, // Recently good but historically poor
      };

      // Low historical weight
      const weights_low = {
        historicalWeight: 0.1,
        recentWeight: 0.5,
        recencyExponent: 1.0,
        reputationExponent: 1.0,
        recencyHalfLife: 7,
      };

      const expertScore_low = scorePost(expert, weights_low).finalScore;
      const noviceScore_low = scorePost(novice, weights_low).finalScore;

      // High historical weight
      const weights_high = {
        historicalWeight: 0.9,
        recentWeight: 0.1,
        recencyExponent: 1.0,
        reputationExponent: 1.0,
        recencyHalfLife: 7,
      };

      const expertScore_high = scorePost(expert, weights_high).finalScore;
      const noviceScore_high = scorePost(novice, weights_high).finalScore;

      // Expert advantage should grow with historical weight
      const gap_low = expertScore_low - noviceScore_low;
      const gap_high = expertScore_high - noviceScore_high;

      expect(gap_high).toBeGreaterThan(gap_low);
    });

    it("should increase recent score importance with higher recent weight", () => {
      const oldExpert = {
        ...baseInput,
        postId: "oldExpert",
        authorHistoricalScore: 0.9,
        authorRecentScore: 0.2, // Historically good, recently inactive
      };

      const newExpert = {
        ...baseInput,
        postId: "newExpert",
        authorHistoricalScore: 0.5,
        authorRecentScore: 0.9, // Recently very active
      };

      // Low recent weight (favors historical)
      const weights_low = {
        historicalWeight: 0.8,
        recentWeight: 0.1,
        recencyExponent: 1.0,
        reputationExponent: 1.0,
        recencyHalfLife: 7,
      };

      const oldScore_low = scorePost(oldExpert, weights_low).finalScore;
      const newScore_low = scorePost(newExpert, weights_low).finalScore;

      // High recent weight (favors recent activity)
      const weights_high = {
        historicalWeight: 0.1,
        recentWeight: 0.8,
        recencyExponent: 1.0,
        reputationExponent: 1.0,
        recencyHalfLife: 7,
      };

      const oldScore_high = scorePost(oldExpert, weights_high).finalScore;
      const newScore_high = scorePost(newExpert, weights_high).finalScore;

      // With low recent weight, old expert should be competitive
      expect(oldScore_low).toBeGreaterThan(newScore_low * 0.5);

      // With high recent weight, new expert should dominate
      expect(newScore_high).toBeGreaterThan(oldScore_high);
    });
  });

  describe("Recency Half-Life Tuning", () => {
    it("should change decay rate with different half-life values", () => {
      const ageInDays = 14; // 2 weeks

      // Short half-life (decay faster)
      const halfLife3 = calculateRecency(ageInDays, 1.0, 3);
      // Normal half-life
      const halfLife7 = calculateRecency(ageInDays, 1.0, 7);
      // Long half-life (decay slower)
      const halfLife30 = calculateRecency(ageInDays, 1.0, 30);

      // At age = 14 days:
      // HL3: (0.5 ^ (14/3)) = 0.5^4.67 ≈ 0.042
      // HL7: (0.5 ^ (14/7)) = 0.5^2 = 0.25
      // HL30: (0.5 ^ (14/30)) = 0.5^0.467 ≈ 0.725

      expect(halfLife3).toBeLessThan(halfLife7);
      expect(halfLife7).toBeLessThan(halfLife30);
    });

    it("should show ranking impact change with half-life tuning", () => {
      const now = new Date();
      const old = new Date(now - 30 * 24 * 60 * 60 * 1000);

      const oldPost = {
        ...baseInput,
        postId: "old",
        ageInDays: 30,
      };

      // Short half-life: 30-day post heavily penalized
      const weights_hl3 = {
        historicalWeight: 0.5,
        recentWeight: 0.25,
        recencyExponent: 1.0,
        reputationExponent: 1.0,
        recencyHalfLife: 3,
      };

      // Long half-life: 30-day post lightly penalized
      const weights_hl30 = {
        historicalWeight: 0.5,
        recentWeight: 0.25,
        recencyExponent: 1.0,
        reputationExponent: 1.0,
        recencyHalfLife: 30,
      };

      const score_hl3 = scorePost(oldPost, weights_hl3).finalScore;
      const score_hl30 = scorePost(oldPost, weights_hl30).finalScore;

      // Longer half-life should produce higher score for old post
      expect(score_hl30).toBeGreaterThan(score_hl3);
    });
  });

  describe("Combined Tuning: Scenario-Based", () => {
    it("should create 'freshness-focused' config", () => {
      // Aggressive recency, minimal reputation impact
      const freshnessWeights = {
        historicalWeight: 0.1,
        recentWeight: 0.05,
        recencyExponent: 2.0, // Aggressive decay
        reputationExponent: 0.5, // Minimal reputation effect
        recencyHalfLife: 2, // Fast decay
      };

      const recent = { ...baseInput, postId: "recent", ageInDays: 1 };
      const old = { ...baseInput, postId: "old", ageInDays: 30 };

      const recentScore = scorePost(recent, freshnessWeights).finalScore;
      const oldScore = scorePost(old, freshnessWeights).finalScore;

      // Recent should heavily dominate
      expect(recentScore).toBeGreaterThan(oldScore * 2);
    });

    it("should create 'expert-focused' config", () => {
      // Minimal recency, aggressive reputation impact
      const expertWeights = {
        historicalWeight: 0.8,
        recentWeight: 0.7,
        recencyExponent: 0.5, // Light decay
        reputationExponent: 2.0, // Strong reputation effect
        recencyHalfLife: 30, // Slow decay
      };

      const expert = {
        ...baseInput,
        postId: "expert",
        semanticScore: 0.7, // Lower semantic match
        authorHistoricalScore: 0.95,
        authorRecentScore: 0.85,
        ageInDays: 7, // Recent too
      };

      const novice = {
        ...baseInput,
        postId: "novice",
        semanticScore: 0.9, // Higher semantic match
        authorHistoricalScore: 0.2,
        authorRecentScore: 0.1,
        ageInDays: 7, // Same age
      };

      const expertScore = scorePost(expert, expertWeights).finalScore;
      const noviceScore = scorePost(novice, expertWeights).finalScore;

      // Expert reputation dominates despite lower semantic score
      expect(expertScore).toBeGreaterThan(noviceScore);
    });

    it("should create 'balanced' config", () => {
      // Balanced across all factors
      const balancedWeights = {
        historicalWeight: 0.4,
        recentWeight: 0.2,
        recencyExponent: 1.0,
        reputationExponent: 1.0,
        recencyHalfLife: 7,
      };

      const good_recent_novice = {
        ...baseInput,
        postId: "good_recent_novice",
        semanticScore: 0.8,
        ageInDays: 1,
        authorHistoricalScore: 0.4,
        authorRecentScore: 0.4,
      };

      const ok_old_expert = {
        ...baseInput,
        postId: "ok_old_expert",
        semanticScore: 0.75,
        ageInDays: 14, // 2 weeks, not a month
        authorHistoricalScore: 0.7,
        authorRecentScore: 0.65,
      };

      const score1 = scorePost(good_recent_novice, balancedWeights).finalScore;
      const score2 = scorePost(ok_old_expert, balancedWeights).finalScore;

      // Should be relatively close (no factor dominates too much)
      const ratio = Math.max(score1, score2) / Math.min(score1, score2);
      expect(ratio).toBeLessThan(4); // Not more than 4x difference with balanced weights
    });
  });

  describe("Conditional Scoring with Tuning", () => {
    it("should respect tuning with some factors disabled", () => {
      const post = {
        ...baseInput,
        postId: "test",
        ageInDays: 10,
        authorHistoricalScore: 0.8,
        authorRecentScore: 0.7,
      };

      const weights = {
        historicalWeight: 0.5,
        recentWeight: 0.25,
        recencyExponent: 2.0, // Aggressive decay
        reputationExponent: 2.0, // Strong reputation
        recencyHalfLife: 5,
      };

      const flags = {
        enableRecency: true,
        enableReputation: true,
        enableFollowBoost: false,
      };

      const result = scorePostConditional(post, weights, flags);

      // Should apply both recency and reputation multipliers
      // Recency at age=10, hl=5: (0.5^(10/5))^2 = (0.5^2)^2 = 0.25^2 = 0.0625
      // Reputation: base = 1.0 + 0.5*0.8 + 0.25*0.7 = 1.575, clamped to 1.5, ^2 = 2.25 → clamped to 1.5
      // Final ≈ 0.8 * 0.0625 * 1.5 = 0.075
      expect(result.finalScore).toBeGreaterThan(0.05);
      expect(result.finalScore).toBeLessThan(0.15);
    });

    it("should show score difference when disabling aggressive recency tuning", () => {
      const post = {
        ...baseInput,
        postId: "test",
        ageInDays: 14,
      };

      const aggressiveWeights = {
        historicalWeight: 0.5,
        recentWeight: 0.25,
        recencyExponent: 2.0,
        reputationExponent: 1.0,
        recencyHalfLife: 3, // Very fast decay
      };

      // With aggressive recency enabled
      const with_recency = scorePostConditional(post, aggressiveWeights, {
        enableRecency: true,
        enableReputation: true,
        enableFollowBoost: true,
      }).finalScore;

      // With aggressive recency disabled
      const without_recency = scorePostConditional(post, aggressiveWeights, {
        enableRecency: false,
        enableReputation: true,
        enableFollowBoost: true,
      }).finalScore;

      // Disabling should produce higher score
      expect(without_recency).toBeGreaterThan(with_recency);
    });
  });

  describe("Normalization with Tuning Variations", () => {
    it("should normalize correctly when tuning produces vastly different scores", () => {
      const posts = [
        {
          ...baseInput,
          postId: "post1",
          semanticScore: 0.9,
          ageInDays: 1,
          authorHistoricalScore: 0.9,
          authorRecentScore: 0.9,
        },
        {
          ...baseInput,
          postId: "post2",
          semanticScore: 0.5,
          ageInDays: 30,
          authorHistoricalScore: 0.3,
          authorRecentScore: 0.3,
        },
      ];

      // Aggressive tuning
      const weights = {
        historicalWeight: 0.8,
        recentWeight: 0.6,
        recencyExponent: 2.0,
        reputationExponent: 2.0,
        recencyHalfLife: 3,
      };

      const scores = posts.map((p) => scorePost(p, weights).finalScore);
      const normalized = normalizeScores(scores);

      // Both normalized scores should be in [0, 1]
      expect(normalized[0]).toBeGreaterThanOrEqual(0);
      expect(normalized[0]).toBeLessThanOrEqual(1);
      expect(normalized[1]).toBeGreaterThanOrEqual(0);
      expect(normalized[1]).toBeLessThanOrEqual(1);

      // Best score should normalize to 1.0
      expect(Math.max(...normalized)).toBeCloseTo(1.0, 5);
      // Worst score should normalize to 0
      expect(Math.min(...normalized)).toBeCloseTo(0, 5);
    });
  });
});
