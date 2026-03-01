/**
 * Compute cosine similarity between two embeddings.
 * Normalized to [0, 1] via (cos + 1) / 2.
 */
function computeSemanticSimilarity(queryEmbedding, topicEmbedding) {
  if (!topicEmbedding || topicEmbedding.length === 0) {
    return 0;
  }

  // Cosine similarity
  const dot = queryEmbedding.reduce((acc, v, i) => acc + v * topicEmbedding[i], 0);
  const normQ = Math.sqrt(queryEmbedding.reduce((acc, v) => acc + v * v, 0));
  const normT = Math.sqrt(topicEmbedding.reduce((acc, v) => acc + v * v, 0));

  if (normQ === 0 || normT === 0) {
    return 0;
  }

  const cos = dot / (normQ * normT);
  // Normalize from [-1, 1] to [0, 1]
  return (cos + 1) / 2;
}

/**
 * Compute reputation score from topic metadata.
 * Average of available reputation signals.
 */
function computeReputationScore(topic) {
  const rep = topic.reputation;
  if (!rep) {
    return 0;
  }

  const components = [];
  if (typeof rep.avg_author_reputation === "number") {
    components.push(rep.avg_author_reputation);
  }
  if (typeof rep.council_weight === "number") {
    components.push(rep.council_weight);
  }

  if (components.length === 0) {
    return 0;
  }

  return components.reduce((a, b) => a + b, 0) / components.length;
}

/**
 * Get weight configuration for given context.
 * Loads from environment with sensible defaults.
 */
function getWeights(ctx) {
  if (ctx === "autocomplete") {
    return {
      semantic: Number(process.env.SUGGESTIONS_AUTOCOMPLETE_WEIGHT_SEMANTIC ?? 0.5),
      trending: Number(process.env.SUGGESTIONS_AUTOCOMPLETE_WEIGHT_TRENDING ?? 0.4),
      reputation: Number(process.env.SUGGESTIONS_AUTOCOMPLETE_WEIGHT_REPUTATION ?? 0.1),
    };
  }

  return {
    semantic: Number(process.env.SUGGESTIONS_RELATED_WEIGHT_SEMANTIC ?? 0.6),
    trending: Number(process.env.SUGGESTIONS_RELATED_WEIGHT_TRENDING ?? 0.2),
    reputation: Number(process.env.SUGGESTIONS_RELATED_WEIGHT_REPUTATION ?? 0.2),
  };
}

/**
 * Filter topics for autocomplete by prefix match on normalized_text and aliases.
 * Case-insensitive matching.
 */
function filterTopicsForAutocomplete(query, topics) {
  const q = query.trim().toLowerCase();

  if (!q) {
    return [];
  }

  return topics.filter((t) => {
    if (t.normalized_text.toLowerCase().startsWith(q)) {
      return true;
    }

    return (t.aliases ?? []).some((alias) =>
      alias.toLowerCase().startsWith(q)
    );
  });
}

/**
 * Generate a human-readable reason explaining why a suggestion ranked highly.
 * Categorizes component scores as high (≥0.8), moderate (0.5-0.8), or low (<0.5).
 */
function generateReason(semanticScore, trendingScore, reputationScore) {
  const signals = [];

  // Semantic signal
  if (semanticScore >= 0.8) {
    signals.push("strong semantic match");
  } else if (semanticScore >= 0.5) {
    signals.push("moderate semantic match");
  } else if (semanticScore > 0) {
    signals.push("weak semantic match");
  }

  // Trending signal with percentage
  if (trendingScore >= 0.8) {
    signals.push(`high trending (${Math.round(trendingScore * 100)}%)`);
  } else if (trendingScore >= 0.5) {
    signals.push(`moderate trending (${Math.round(trendingScore * 100)}%)`);
  } else if (trendingScore > 0) {
    signals.push(`low trending (${Math.round(trendingScore * 100)}%)`);
  }

  // Reputation signal
  if (reputationScore >= 0.8) {
    signals.push("high reputation");
  } else if (reputationScore >= 0.5) {
    signals.push("moderate reputation");
  } else if (reputationScore > 0) {
    signals.push("low reputation");
  }

  return signals.length > 0 ? signals.join(" + ") : "Matched query criteria";
}

/**
 * Main scoring orchestrator. Blends semantic, trending, and reputation scores
 * using context-specific weights from environment variables.
 *
 * @param {string} ctx - Suggestion context ("autocomplete" or "related")
 * @param {string} query - User query string
 * @param {number[]} queryEmbedding - Vector embedding of the query
 * @param {Object[]} topics - Candidate trending topics to rank
 * @param {number} limit - Maximum number of results to return
 * @param {number} minScore - Minimum score threshold for inclusion (0-1)
 * @returns {Object[]} Array of RankedSuggestion objects sorted by score descending
 */
function rankSuggestions(ctx, query, queryEmbedding, topics, limit, minScore) {
  const weights = getWeights(ctx);

  const ranked = topics
    .map((topic) => {
      const semanticScore = computeSemanticSimilarity(
        queryEmbedding,
        topic.semantic?.embedding
      );
      const reputationScore = computeReputationScore(topic);
      const trendingScore = topic.scores?.trending || 0;

      const score =
        weights.semantic * semanticScore +
        weights.trending * trendingScore +
        weights.reputation * reputationScore;

      const rankedSuggestion = {
        id: topic.id,
        type: "query",
        text: topic.text,
        normalized_text: topic.normalized_text,
        suggestion_source: ctx,
        score,
        semantic_score: semanticScore,
        trending_score: trendingScore,
        reputation_score: reputationScore,
        reason: generateReason(semanticScore, trendingScore, reputationScore),
      };

      // Add shared_context for "related" context
      if (ctx === "related" && topic.metadata?.example_queries) {
        rankedSuggestion.shared_context = topic.metadata.example_queries;
      }

      return rankedSuggestion;
    })
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked;
}

module.exports = {
  computeSemanticSimilarity,
  computeReputationScore,
  getWeights,
  filterTopicsForAutocomplete,
  rankSuggestions,
};
