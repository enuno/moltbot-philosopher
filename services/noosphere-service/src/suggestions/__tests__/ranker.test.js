// services/noosphere-service/src/suggestions/__tests__/ranker.test.js
const {
  computeSemanticSimilarity,
  computeReputationScore,
  getWeights,
  filterTopicsForAutocomplete,
} = require("../ranker");

describe("Suggestion Ranker Helpers", () => {
  describe("computeSemanticSimilarity", () => {
    it("should return 0 when embedding is undefined", () => {
      const queryEmbedding = [0.1, -0.2, 0.3];
      const result = computeSemanticSimilarity(queryEmbedding, undefined);
      expect(result).toBe(0);
    });

    it("should compute cosine similarity normalized to [0,1]", () => {
      const queryEmbedding = [1, 0, 0];
      const topicEmbedding = [1, 0, 0]; // identical
      const result = computeSemanticSimilarity(queryEmbedding, topicEmbedding);
      expect(result).toBe(1); // (cos=1, (1+1)/2 = 1)
    });

    it("should handle orthogonal vectors", () => {
      const queryEmbedding = [1, 0, 0];
      const topicEmbedding = [0, 1, 0]; // orthogonal
      const result = computeSemanticSimilarity(queryEmbedding, topicEmbedding);
      expect(result).toBe(0.5); // (cos=0, (0+1)/2 = 0.5)
    });

    it("should handle opposite vectors", () => {
      const queryEmbedding = [1, 0, 0];
      const topicEmbedding = [-1, 0, 0]; // opposite
      const result = computeSemanticSimilarity(queryEmbedding, topicEmbedding);
      expect(result).toBe(0); // (cos=-1, (-1+1)/2 = 0)
    });

    it("should return 0 when query has zero norm", () => {
      const queryEmbedding = [0, 0, 0];
      const topicEmbedding = [1, 0, 0];
      const result = computeSemanticSimilarity(queryEmbedding, topicEmbedding);
      expect(result).toBe(0);
    });

    it("should return 0 when topic has zero norm", () => {
      const queryEmbedding = [1, 0, 0];
      const topicEmbedding = [0, 0, 0];
      const result = computeSemanticSimilarity(queryEmbedding, topicEmbedding);
      expect(result).toBe(0);
    });
  });

  describe("computeReputationScore", () => {
    it("should return 0 when reputation is undefined", () => {
      const topic = {
        id: "test",
        text: "test",
        normalized_text: "test",
        stats: {
          raw_count: 1,
          unique_users: 1,
          first_seen: "2026-02-28T00:00:00Z",
          last_seen: "2026-02-28T00:00:00Z",
        },
        scores: {
          frequency: 0.5,
          recency_decay: 0.5,
          tfidf: 0.5,
          trending: 0.5,
          semantic_centroid_norm: 0.5,
        },
      };
      const result = computeReputationScore(topic);
      expect(result).toBe(0);
    });

    it("should average author_reputation and council_weight", () => {
      const topic = {
        id: "test",
        text: "test",
        normalized_text: "test",
        stats: {
          raw_count: 1,
          unique_users: 1,
          first_seen: "2026-02-28T00:00:00Z",
          last_seen: "2026-02-28T00:00:00Z",
        },
        scores: {
          frequency: 0.5,
          recency_decay: 0.5,
          tfidf: 0.5,
          trending: 0.5,
          semantic_centroid_norm: 0.5,
        },
        reputation: {
          avg_author_reputation: 0.6,
          council_weight: 0.8,
        },
      };
      const result = computeReputationScore(topic);
      expect(result).toBe(0.7); // (0.6 + 0.8) / 2
    });

    it("should include only non-null fields in average", () => {
      const topic = {
        id: "test",
        text: "test",
        normalized_text: "test",
        stats: {
          raw_count: 1,
          unique_users: 1,
          first_seen: "2026-02-28T00:00:00Z",
          last_seen: "2026-02-28T00:00:00Z",
        },
        scores: {
          frequency: 0.5,
          recency_decay: 0.5,
          tfidf: 0.5,
          trending: 0.5,
          semantic_centroid_norm: 0.5,
        },
        reputation: {
          avg_author_reputation: 0.8,
        },
      };
      const result = computeReputationScore(topic);
      expect(result).toBe(0.8); // only avg_author_reputation
    });
  });

  describe("getWeights", () => {
    it("should return autocomplete weights", () => {
      process.env.SUGGESTIONS_AUTOCOMPLETE_WEIGHT_SEMANTIC = "0.5";
      process.env.SUGGESTIONS_AUTOCOMPLETE_WEIGHT_TRENDING = "0.4";
      process.env.SUGGESTIONS_AUTOCOMPLETE_WEIGHT_REPUTATION = "0.1";

      const weights = getWeights("autocomplete");
      expect(weights.semantic).toBe(0.5);
      expect(weights.trending).toBe(0.4);
      expect(weights.reputation).toBe(0.1);
    });

    it("should return related weights", () => {
      process.env.SUGGESTIONS_RELATED_WEIGHT_SEMANTIC = "0.6";
      process.env.SUGGESTIONS_RELATED_WEIGHT_TRENDING = "0.2";
      process.env.SUGGESTIONS_RELATED_WEIGHT_REPUTATION = "0.2";

      const weights = getWeights("related");
      expect(weights.semantic).toBe(0.6);
      expect(weights.trending).toBe(0.2);
      expect(weights.reputation).toBe(0.2);
    });

    it("should use default weights when env vars undefined", () => {
      delete process.env.SUGGESTIONS_AUTOCOMPLETE_WEIGHT_SEMANTIC;
      delete process.env.SUGGESTIONS_AUTOCOMPLETE_WEIGHT_TRENDING;
      delete process.env.SUGGESTIONS_AUTOCOMPLETE_WEIGHT_REPUTATION;

      const weights = getWeights("autocomplete");
      expect(weights.semantic).toBe(0.5); // default
      expect(weights.trending).toBe(0.4); // default
      expect(weights.reputation).toBe(0.1); // default
    });
  });
});

describe("filterTopicsForAutocomplete", () => {
  it("should filter by normalized_text prefix", () => {
    const topics = [
      {
        id: "ai-autonomy",
        text: "AI autonomy ethics",
        normalized_text: "ai autonomy ethics",
        stats: {
          raw_count: 10,
          unique_users: 5,
          first_seen: "2026-02-28T00:00:00Z",
          last_seen: "2026-02-28T00:00:00Z",
        },
        scores: {
          frequency: 0.7,
          recency_decay: 0.8,
          tfidf: 0.6,
          trending: 0.75,
          semantic_centroid_norm: 0.8,
        },
      },
      {
        id: "consciousness-measure",
        text: "consciousness measurement",
        normalized_text: "consciousness measurement",
        stats: {
          raw_count: 5,
          unique_users: 3,
          first_seen: "2026-02-28T00:00:00Z",
          last_seen: "2026-02-28T00:00:00Z",
        },
        scores: {
          frequency: 0.5,
          recency_decay: 0.7,
          tfidf: 0.4,
          trending: 0.6,
          semantic_centroid_norm: 0.65,
        },
      },
    ];

    const result = filterTopicsForAutocomplete("ai", topics);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ai-autonomy");
  });

  it("should match aliases", () => {
    const topics = [
      {
        id: "ai-autonomy",
        text: "AI autonomy ethics",
        normalized_text: "ai autonomy ethics",
        aliases: ["autonomous ai ethics", "ai self-determination"],
        stats: {
          raw_count: 10,
          unique_users: 5,
          first_seen: "2026-02-28T00:00:00Z",
          last_seen: "2026-02-28T00:00:00Z",
        },
        scores: {
          frequency: 0.7,
          recency_decay: 0.8,
          tfidf: 0.6,
          trending: 0.75,
          semantic_centroid_norm: 0.8,
        },
      },
    ];

    const result = filterTopicsForAutocomplete("auto", topics);
    expect(result).toHaveLength(1); // matches "autonomous ai ethics" alias
  });

  it("should return empty array when no matches", () => {
    const topics = [
      {
        id: "ai-autonomy",
        text: "AI autonomy ethics",
        normalized_text: "ai autonomy ethics",
        stats: {
          raw_count: 10,
          unique_users: 5,
          first_seen: "2026-02-28T00:00:00Z",
          last_seen: "2026-02-28T00:00:00Z",
        },
        scores: {
          frequency: 0.7,
          recency_decay: 0.8,
          tfidf: 0.6,
          trending: 0.75,
          semantic_centroid_norm: 0.8,
        },
      },
    ];

    const result = filterTopicsForAutocomplete("xyz", topics);
    expect(result).toHaveLength(0);
  });

  it("should be case-insensitive", () => {
    const topics = [
      {
        id: "ai-autonomy",
        text: "AI autonomy ethics",
        normalized_text: "ai autonomy ethics",
        stats: {
          raw_count: 10,
          unique_users: 5,
          first_seen: "2026-02-28T00:00:00Z",
          last_seen: "2026-02-28T00:00:00Z",
        },
        scores: {
          frequency: 0.7,
          recency_decay: 0.8,
          tfidf: 0.6,
          trending: 0.75,
          semantic_centroid_norm: 0.8,
        },
      },
    ];

    const result = filterTopicsForAutocomplete("AI", topics);
    expect(result).toHaveLength(1);
  });
});
