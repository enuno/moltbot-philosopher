/**
 * Suggestion routes for autocomplete and related-search endpoints.
 * Integrates the rankSuggestions ranker with Express.
 *
 * Endpoints:
 * - GET /search/autocomplete?q=...&limit=10 - Prefix-based autocomplete (trending-biased)
 * - GET /search/related?query=...&limit=10&min_score=0.5 - Semantic search (semantic-first)
 *
 * Responses include full ScoreBreakdown structure plus legacy fields for backward compatibility.
 */

const { Router } = require("express");
const {
  rankSuggestions,
  filterTopicsForAutocomplete,
  getWeights,
} = require("./ranker");

/**
 * Create suggestion routes
 * @param {Array} trendingTopics - Array of TrendingTopic objects
 * @returns {Router} Express router with autocomplete and related endpoints
 */
function createSuggestionRoutes(trendingTopics) {
  const router = Router();

  /**
   * GET /search/autocomplete
   * Prefix-based autocomplete for user typing.
   * Biased toward trending and recency.
   *
   * Query Parameters:
   * - q: Search query (required, min 1 char)
   * - limit: Max results (optional, 1-100, default 10)
   * - session_id: Session identifier (optional, for analytics)
   *
   * Response: AutocompleteResponse with suggestions including ScoreBreakdown
   */
  router.get("/autocomplete", async (req, res) => {
    try {
      const { q, limit = 10, session_id } = req.query;

      // Validate query parameter
      if (!q || typeof q !== "string") {
        res.status(400).json({
          success: false,
          error: "Query parameter 'q' is required (string)",
        });
        return;
      }

      if (q.length < 1) {
        res.status(400).json({
          success: false,
          error: "Query must be at least 1 character",
        });
        return;
      }

      // Parse and validate limit
      const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));

      // Filter by prefix match
      const filtered = filterTopicsForAutocomplete(q, trendingTopics);

      // Rank suggestions (no embedding needed for autocomplete, use dummy vector)
      const dummyEmbedding = new Array(768).fill(0);
      const ranked = rankSuggestions(
        "autocomplete",
        q,
        dummyEmbedding,
        filtered,
        parsedLimit,
        0.0 // No minimum score for autocomplete
      );

      const response = {
        query: q,
        suggestions: ranked,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      console.error("[autocomplete] Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * GET /search/related
   * Semantic-based related search for query expansion.
   * Finds topically similar suggestions.
   *
   * Query Parameters:
   * - query: Search query (required, min 3 chars)
   * - limit: Max results (optional, 1-100, default 10)
   * - min_score: Minimum score threshold (optional, 0-1, default 0.5)
   *
   * Response: RelatedResponse with suggestions including ScoreBreakdown
   */
  router.get("/related", async (req, res) => {
    try {
      const { query, limit = 10, min_score = 0.5 } = req.query;

      // Validate query parameter
      if (!query || typeof query !== "string") {
        res.status(400).json({
          success: false,
          error: "Query parameter 'query' is required (string)",
        });
        return;
      }

      if (query.length < 3) {
        res.status(400).json({
          success: false,
          error: "Query must be at least 3 characters",
        });
        return;
      }

      // Parse and validate limit
      const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));

      // Parse and validate min_score
      const parsedMinScore = Math.min(1.0, Math.max(0.0, parseFloat(String(min_score)) || 0.5));

      // For now, use dummy embedding (in production, call embedding service)
      const dummyEmbedding = new Array(768).fill(0);

      // Rank suggestions with semantic bias
      const ranked = rankSuggestions(
        "related",
        query,
        dummyEmbedding,
        trendingTopics,
        parsedLimit,
        parsedMinScore
      );

      const response = {
        query,
        related_suggestions: ranked,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      console.error("[related] Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  return router;
}

module.exports = {
  createSuggestionRoutes,
};
