/**
 * Suggestion ranker with multiplicative ScoreBreakdown model.
 * Computes semantic, recency, reputation, and follow-graph factors.
 */

/**
 * Compute cosine similarity between two embeddings.
 * Normalized to [0, 1] via (cos + 1) / 2.
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {number[]} topicEmbedding - Topic embedding vector
 * @returns {number} Similarity score [0, 1]
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
 * Compute exponential recency decay multiplier based on last seen time.
 * Uses 24-hour half-life: multiplier = exp(-ageHours / 24).
 * Clamped to [0.5, 1.0].
 * @param {string} lastSeenIso - ISO 8601 timestamp
 * @returns {number} Multiplier [0.5, 1.0]
 */
function computeRecencyMultiplier(lastSeenIso) {
  try {
    const ageMsec = Date.now() - new Date(lastSeenIso).getTime();
    const ageHours = ageMsec / (1000 * 60 * 60);
    const multiplier = Math.exp(-ageHours / 24);
    return Math.max(0.5, Math.min(1.0, multiplier));
  } catch {
    // If date parsing fails, return neutral multiplier
    return 1.0;
  }
}

/**
 * Compute reputation multiplier from topic metadata.
 * Returns the average of available reputation signals (author reputation, council weight).
 * Used as multiplicative factor in ScoreBreakdown.
 * @param {Object} topic - TrendingTopic object
 * @returns {number} Reputation multiplier
 */
function computeReputationMultiplier(topic) {
  const rep = topic.reputation;
  if (!rep) {
    return 1.0;
  }

  const components = [];
  if (typeof rep.avg_author_reputation === "number") {
    components.push(rep.avg_author_reputation);
  }
  if (typeof rep.council_weight === "number") {
    components.push(rep.council_weight);
  }

  if (components.length === 0) {
    return 1.0;
  }

  return components.reduce((a, b) => a + b, 0) / components.length;
}

/**
 * Compute follow-graph boost factor.
 * Returns 1.25 if topic has follow_graph_weight (author is followed), else 1.0.
 * @param {Object} topic - TrendingTopic object
 * @returns {number} Follow boost factor (1.0 or 1.25)
 */
function computeFollowBoost(topic) {
  return topic.metadata?.follow_graph_weight != null ? 1.25 : 1.0;
}

/**
 * Get weight configuration for given context.
 * Loads from environment with sensible defaults.
 * @param {string} ctx - Context ("autocomplete" or "related")
 * @returns {Object} SuggestionWeights with semantic, trending, reputation
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
 * @param {string} query - Search query
 * @param {Array} topics - Array of TrendingTopic objects
 * @returns {Array} Filtered topics matching the prefix
 */
function filterTopicsForAutocomplete(query, topics) {
  const q = query.trim().toLowerCase();

  if (!q) {
    return [];
  }

  return topics.filter((t) => {
    if (t.normalized_text.startsWith(q)) {
      return true;
    }

    return (t.aliases ?? []).some((alias) =>
      alias.toLowerCase().startsWith(q)
    );
  });
}

/**
 * Generate a human-readable reason explaining the ScoreBreakdown.
 * Includes semantic match, recency multiplier, reputation multiplier, and follow boost.
 * @param {number} semantic - Semantic similarity [0, 1]
 * @param {number} recencyMultiplier - Recency decay [0.5, 1.0]
 * @param {number} reputationMultiplier - Reputation score
 * @param {number} followBoost - Follow graph boost (1.0 or 1.25)
 * @returns {string} Human-readable explanation
 */
function generateReason(
  semantic,
  recencyMultiplier,
  reputationMultiplier,
  followBoost
) {
  const signals = [];

  // Semantic signal
  if (semantic >= 0.8) {
    signals.push("strong semantic match");
  } else if (semantic >= 0.5) {
    signals.push("moderate semantic match");
  } else if (semantic > 0) {
    signals.push("weak semantic match");
  }

  // Recency multiplier signal
  const recencyPercent = Math.round(recencyMultiplier * 100);
  if (recencyMultiplier >= 0.9) {
    signals.push(`recent content (${recencyPercent}%)`);
  } else if (recencyMultiplier >= 0.7) {
    signals.push(`moderately recent (${recencyPercent}%)`);
  } else {
    signals.push(`older content (${recencyPercent}%)`);
  }

  // Reputation multiplier signal
  if (reputationMultiplier >= 1.1) {
    signals.push("high reputation author");
  } else if (reputationMultiplier >= 0.9) {
    signals.push("neutral reputation");
  } else {
    signals.push("lower reputation");
  }

  // Follow boost signal
  if (followBoost > 1.0) {
    signals.push("followed author (+25%)");
  }

  return signals.length > 0 ? signals.join(" + ") : "Matched query criteria";
}

/**
 * Main scoring orchestrator using multiplicative ScoreBreakdown model.
 * Computes: final = semantic × recencyMultiplier × reputationMultiplier × followBoost.
 *
 * @param {string} ctx - Suggestion context ("autocomplete" or "related")
 * @param {string} query - User query string
 * @param {number[]} queryEmbedding - Vector embedding of the query
 * @param {Array} topics - Candidate trending topics to rank
 * @param {number} limit - Maximum number of results to return
 * @param {number} minScore - Minimum score threshold for inclusion (0-1)
 * @returns {Array} Array of RankedSuggestion objects sorted by final score descending
 */
function rankSuggestions(
  ctx,
  query,
  queryEmbedding,
  topics,
  limit,
  minScore
) {
  const ranked = topics
    .map((topic) => {
      // Compute all four components
      const semantic = computeSemanticSimilarity(
        queryEmbedding,
        topic.semantic?.embedding
      );
      const recencyMultiplier = computeRecencyMultiplier(
        topic.stats.last_seen
      );
      const reputationMultiplier = computeReputationMultiplier(topic);
      const followBoost = computeFollowBoost(topic);

      // Multiplicative formula with clipping at 1.0
      const finalScore = Math.min(
        1.0,
        semantic * recencyMultiplier * reputationMultiplier * followBoost
      );

      // Build ScoreBreakdown
      const scoreBreakdown = {
        semantic,
        recencyMultiplier,
        reputationMultiplier,
        followBoost,
        final: finalScore,
      };

      // Build legacy fields for backward compatibility
      const trendingScore = topic.scores?.trending || 0;

      const rankedSuggestion = {
        id: topic.id,
        type: "query",
        text: topic.text,
        normalized_text: topic.normalized_text,
        suggestion_source: ctx,
        score: scoreBreakdown,
        score_legacy: finalScore,
        semantic_similarity: semantic,
        trending_score: trendingScore,
        reputation_score: reputationMultiplier,
        reason: generateReason(
          semantic,
          recencyMultiplier,
          reputationMultiplier,
          followBoost
        ),
      };

      // Add shared_context for "related" context
      if (ctx === "related" && topic.metadata?.example_queries) {
        rankedSuggestion.shared_context = topic.metadata.example_queries;
      }

      return rankedSuggestion;
    })
    .filter((s) => s.score.final >= minScore)
    .sort((a, b) => b.score.final - a.score.final)
    .slice(0, limit);

  return ranked;
}

module.exports = {
  computeSemanticSimilarity,
  computeRecencyMultiplier,
  computeReputationMultiplier,
  computeFollowBoost,
  getWeights,
  filterTopicsForAutocomplete,
  rankSuggestions,
};
