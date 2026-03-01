import { TrendingTopic, SuggestionWeights, SuggestionContext } from "./types";

/**
 * Compute cosine similarity between two embeddings.
 * Normalized to [0, 1] via (cos + 1) / 2.
 */
export function computeSemanticSimilarity(
  queryEmbedding: number[],
  topicEmbedding?: number[]
): number {
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
export function computeReputationScore(topic: TrendingTopic): number {
  const rep = topic.reputation;
  if (!rep) {
    return 0;
  }

  const components: number[] = [];
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
export function getWeights(ctx: SuggestionContext): SuggestionWeights {
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
export function filterTopicsForAutocomplete(
  query: string,
  topics: TrendingTopic[]
): TrendingTopic[] {
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
