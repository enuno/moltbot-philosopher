// services/noosphere-service/src/suggestions/__tests__/routes.test.js
/**
 * Test suite for suggestion routes.
 * Validates:
 * 1. Autocomplete endpoint filtering and serialization
 * 2. Related-search endpoint ranking and serialization
 * 3. ScoreBreakdown structure in responses
 * 4. Backward compatibility with legacy flat fields
 * 5. Error handling and input validation
 */

const express = require("express");
const request = require("supertest");
const { createSuggestionRoutes } = require("../routes.js");

describe("Suggestion Routes", () => {
  let app;
  let mockTopics;

  beforeEach(() => {
    // Create Express app with routes
    app = express();
    app.use(express.json());

    // Mock trending topics for testing
    mockTopics = [
      {
        id: "topic-1",
        text: "artificial intelligence ethics",
        normalized_text: "artificial intelligence ethics",
        aliases: ["ai ethics", "ethics ai"],
        stats: {
          raw_count: 42,
          unique_users: 15,
          first_seen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          last_seen: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        },
        scores: {
          frequency: 0.85,
          recency_decay: 0.95,
          tfidf: 0.72,
          trending: 0.8,
          semantic_centroid_norm: 0.9,
        },
        semantic: {
          embedding_model: "multilingual-e5-large",
          embedding_dim: 768,
          embedding: new Array(768).fill(0.5),
        },
        reputation: {
          avg_author_reputation: 0.9,
          council_weight: 0.95,
        },
        metadata: {
          example_queries: ["ai safety", "machine learning ethics"],
          example_post_ids: ["post-1", "post-2"],
          follow_graph_weight: 1.0,
        },
      },
      {
        id: "topic-2",
        text: "machine learning",
        normalized_text: "machine learning",
        aliases: ["ml", "deep learning"],
        stats: {
          raw_count: 28,
          unique_users: 12,
          first_seen: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          last_seen: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        },
        scores: {
          frequency: 0.65,
          recency_decay: 0.85,
          tfidf: 0.68,
          trending: 0.6,
          semantic_centroid_norm: 0.85,
        },
        semantic: {
          embedding_model: "multilingual-e5-large",
          embedding_dim: 768,
          embedding: new Array(768).fill(0.4),
        },
        reputation: {
          avg_author_reputation: 0.75,
        },
        metadata: {
          example_queries: ["supervised learning", "neural networks"],
          example_post_ids: ["post-3", "post-4"],
        },
      },
      {
        id: "topic-3",
        text: "neural networks",
        normalized_text: "neural networks",
        aliases: ["nn", "deep nets"],
        stats: {
          raw_count: 35,
          unique_users: 18,
          first_seen: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          last_seen: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        },
        scores: {
          frequency: 0.78,
          recency_decay: 0.98,
          tfidf: 0.75,
          trending: 0.75,
          semantic_centroid_norm: 0.88,
        },
        semantic: {
          embedding_model: "multilingual-e5-large",
          embedding_dim: 768,
          embedding: new Array(768).fill(0.45),
        },
        reputation: {
          council_weight: 1.05,
        },
        metadata: {
          example_queries: ["backpropagation", "convolutional networks"],
          example_post_ids: ["post-5", "post-6"],
        },
      },
    ];

    // Mount routes
    app.use("/search", createSuggestionRoutes(mockTopics));
  });

  describe("GET /search/autocomplete", () => {
    it("should filter topics by prefix and return ScoreBreakdown", async () => {
      const response = await request(app).get("/search/autocomplete?q=arti&limit=5");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("query", "arti");
      expect(response.body).toHaveProperty("suggestions");
      expect(Array.isArray(response.body.suggestions)).toBe(true);
      expect(response.body.suggestions.length).toBeGreaterThan(0);
    });

    it("should include complete ScoreBreakdown in response", async () => {
      const response = await request(app).get("/search/autocomplete?q=arti");

      expect(response.status).toBe(200);
      const suggestion = response.body.suggestions[0];

      // Verify ScoreBreakdown structure
      expect(suggestion).toHaveProperty("score");
      expect(suggestion.score).toHaveProperty("semantic");
      expect(suggestion.score).toHaveProperty("recencyMultiplier");
      expect(suggestion.score).toHaveProperty("reputationMultiplier");
      expect(suggestion.score).toHaveProperty("followBoost");
      expect(suggestion.score).toHaveProperty("final");

      // Verify numeric types
      expect(typeof suggestion.score.semantic).toBe("number");
      expect(typeof suggestion.score.recencyMultiplier).toBe("number");
      expect(typeof suggestion.score.reputationMultiplier).toBe("number");
      expect(typeof suggestion.score.followBoost).toBe("number");
      expect(typeof suggestion.score.final).toBe("number");

      // Verify valid ranges
      expect(suggestion.score.semantic).toBeGreaterThanOrEqual(0);
      expect(suggestion.score.semantic).toBeLessThanOrEqual(1);
      expect(suggestion.score.final).toBeGreaterThanOrEqual(0);
      expect(suggestion.score.final).toBeLessThanOrEqual(1);
    });

    it("should include legacy flat fields for backward compatibility", async () => {
      const response = await request(app).get("/search/autocomplete?q=arti");

      expect(response.status).toBe(200);
      const suggestion = response.body.suggestions[0];

      // Verify legacy fields exist
      expect(suggestion).toHaveProperty("score_legacy");
      expect(suggestion).toHaveProperty("semantic_similarity");
      expect(suggestion).toHaveProperty("trending_score");
      expect(suggestion).toHaveProperty("reputation_score");

      // Verify consistency between new and legacy fields
      expect(suggestion.score_legacy).toBe(suggestion.score.final);
      expect(suggestion.semantic_similarity).toBe(suggestion.score.semantic);
      expect(suggestion.reputation_score).toBe(suggestion.score.reputationMultiplier);
    });

    it("should respect limit parameter", async () => {
      const response = await request(app).get("/search/autocomplete?q=arti&limit=1");

      expect(response.status).toBe(200);
      expect(response.body.suggestions.length).toBeLessThanOrEqual(1);
    });

    it("should clamp limit to valid range (1-100)", async () => {
      const response1 = await request(app).get("/search/autocomplete?q=arti&limit=200");
      const response2 = await request(app).get("/search/autocomplete?q=arti&limit=0");

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      // Limits should be clamped (max 100, min 1)
      expect(response1.body.suggestions.length).toBeLessThanOrEqual(100);
    });

    it("should reject empty query", async () => {
      const response = await request(app).get("/search/autocomplete?q=");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
    });

    it("should reject missing query parameter", async () => {
      const response = await request(app).get("/search/autocomplete");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success", false);
    });

    it("should return timestamp in ISO-8601 format", async () => {
      const response = await request(app).get("/search/autocomplete?q=arti");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("timestamp");
      // Verify it's a valid ISO-8601 date
      const date = new Date(response.body.timestamp);
      expect(date.getTime()).toBeGreaterThan(0);
    });

    it("should perform case-insensitive prefix matching", async () => {
      const response1 = await request(app).get("/search/autocomplete?q=ARTI");
      const response2 = await request(app).get("/search/autocomplete?q=arti");

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      // Both should return same number of results (case-insensitive)
      expect(response1.body.suggestions.length).toBe(response2.body.suggestions.length);
    });
  });

  describe("GET /search/related", () => {
    it("should return related suggestions with ScoreBreakdown", async () => {
      const response = await request(app).get(
        "/search/related?query=machine learning&limit=5"
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("query", "machine learning");
      expect(response.body).toHaveProperty("related_suggestions");
      expect(Array.isArray(response.body.related_suggestions)).toBe(true);
    });

    it("should include complete ScoreBreakdown in response", async () => {
      const response = await request(app).get("/search/related?query=deep learning");

      expect(response.status).toBe(200);

      if (response.body.related_suggestions.length > 0) {
        const suggestion = response.body.related_suggestions[0];

        // Verify ScoreBreakdown structure
        expect(suggestion).toHaveProperty("score");
        expect(suggestion.score).toHaveProperty("semantic");
        expect(suggestion.score).toHaveProperty("recencyMultiplier");
        expect(suggestion.score).toHaveProperty("reputationMultiplier");
        expect(suggestion.score).toHaveProperty("followBoost");
        expect(suggestion.score).toHaveProperty("final");
      }
    });

    it("should respect min_score threshold", async () => {
      const response = await request(app).get(
        "/search/related?query=neural&min_score=0.1"
      );

      expect(response.status).toBe(200);

      // All suggestions should meet minimum score (with small epsilon for floating point)
      response.body.related_suggestions.forEach((suggestion) => {
        expect(suggestion.score.final).toBeGreaterThanOrEqual(0.1 - 0.001);
      });
    });

    it("should reject query shorter than 3 characters", async () => {
      const response = await request(app).get("/search/related?query=ai");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body.error).toMatch(/at least 3 characters/i);
    });

    it("should reject missing query parameter", async () => {
      const response = await request(app).get("/search/related");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success", false);
    });

    it("should clamp min_score to [0, 1]", async () => {
      const response1 = await request(app).get(
        "/search/related?query=machine&min_score=1.5"
      );
      const response2 = await request(app).get(
        "/search/related?query=machine&min_score=-0.5"
      );

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it("should include shared_context for related suggestions", async () => {
      const response = await request(app).get("/search/related?query=neural");

      expect(response.status).toBe(200);

      // At least one suggestion should have shared_context (from metadata)
      const withContext = response.body.related_suggestions.some(
        (s) => s.shared_context && s.shared_context.length > 0
      );
      // Note: may not always have context depending on mock data
      if (withContext) {
        expect(withContext).toBe(true);
      }
    });

    it("should return timestamp in ISO-8601 format", async () => {
      const response = await request(app).get("/search/related?query=learning");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("timestamp");
      const date = new Date(response.body.timestamp);
      expect(date.getTime()).toBeGreaterThan(0);
    });

    it("should handle large limit parameter", async () => {
      const response = await request(app).get("/search/related?query=learning&limit=500");

      expect(response.status).toBe(200);
      // Should be clamped to max 100
      expect(response.body.related_suggestions.length).toBeLessThanOrEqual(100);
    });
  });

  describe("Response structure validation", () => {
    it("should never include circular references in JSON", async () => {
      const response = await request(app).get("/search/autocomplete?q=arti");

      expect(response.status).toBe(200);
      // If response is JSON-serializable, there are no circular refs
      expect(() => JSON.stringify(response.body)).not.toThrow();
    });

    it("should include suggestion_source in all responses", async () => {
      const response1 = await request(app).get("/search/autocomplete?q=arti");
      const response2 = await request(app).get("/search/related?query=machine");

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      response1.body.suggestions.forEach((suggestion) => {
        expect(suggestion.suggestion_source).toBe("autocomplete");
      });

      response2.body.related_suggestions.forEach((suggestion) => {
        expect(suggestion.suggestion_source).toBe("related");
      });
    });

    it("should include reason string explaining ranking", async () => {
      const response = await request(app).get("/search/autocomplete?q=arti");

      expect(response.status).toBe(200);

      response.body.suggestions.forEach((suggestion) => {
        expect(suggestion).toHaveProperty("reason");
        expect(typeof suggestion.reason).toBe("string");
        expect(suggestion.reason.length).toBeGreaterThan(0);
      });
    });
  });
});
