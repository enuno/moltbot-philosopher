import {
  PostScoringInputs,
  ScoringWeights,
  ScoringResult,
} from "../../services/moltbook-sdk/src/types";

describe("Scoring Types", () => {
  it("should define PostScoringInputs interface", () => {
    const input: PostScoringInputs = {
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
    const weights: ScoringWeights = {
      historicalWeight: 0.5,
      recentWeight: 0.25,
      recencyExponent: 1.0,
      reputationExponent: 1.0,
      recencyHalfLife: 7,
    };
    expect(weights.historicalWeight).toBe(0.5);
  });

  it("should define ScoringResult interface", () => {
    const result: ScoringResult = {
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
