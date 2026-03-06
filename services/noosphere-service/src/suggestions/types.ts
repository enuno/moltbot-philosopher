// services/noosphere-service/src/suggestions/types.ts

export type SuggestionContext = "autocomplete" | "related";
export type SuggestionType = "query";

export interface TrendingTopicStats {
  raw_count: number;
  unique_users: number;
  first_seen: string; // ISO-8601
  last_seen: string; // ISO-8601
}

export interface TrendingTopicScores {
  frequency: number; // [0, 1]
  recency_decay: number; // [0, 1]
  tfidf: number; // [0, 1]
  trending: number; // [0, 1]
  semantic_centroid_norm: number; // [0, 1]
}

export interface TrendingTopicSemantic {
  embedding_model: string;
  embedding_dim: number;
  embedding: number[];
}

export interface TrendingTopicReputation {
  avg_author_reputation?: number;
  council_weight?: number;
  submolt_signals?: Record<string, number>;
}

export interface TrendingTopicMetadata {
  example_queries?: string[];
  example_post_ids?: string[];
  follow_graph_weight?: number; // for follow-boost computation (presence indicates followed)
}

export interface TrendingTopic {
  id: string;
  text: string;
  normalized_text: string;
  aliases?: string[];
  stats: TrendingTopicStats;
  scores: TrendingTopicScores;
  semantic?: TrendingTopicSemantic;
  reputation?: TrendingTopicReputation;
  metadata?: TrendingTopicMetadata;
}

export interface SuggestionWeights {
  semantic: number;
  trending: number;
  reputation: number;
}

/**
 * ScoreBreakdown: Nested structure containing canonical ranking score components.
 * Used in P4.4 to replace flat score fields for clarity and debuggability.
 *
 * Invariant: final ≈ semantic × recencyMultiplier × reputationMultiplier × followBoost
 * (within small epsilon ~0.0001 for floating-point rounding and normalization).
 */
export interface ScoreBreakdown {
  /** Semantic similarity [0–1], computed from embedding cosine distance. */
  semantic: number;

  /** Exponential recency decay multiplier (>0, typically 0.8–1.0). */
  recencyMultiplier: number;

  /** Author/content credibility multiplier (>0, typically 0.8–1.2). */
  reputationMultiplier: number;

  /** Follow-graph boost factor (1.0 or 1.25 for boosted results). */
  followBoost: number;

  /** Combined final score [0–1], clamped after multiplication. */
  final: number;
}

export interface RankedSuggestion {
  id: string;
  type: SuggestionType;
  text: string;
  normalized_text: string;
  suggestion_source: SuggestionContext;

  // Canonical nested structure (new in P4.4)
  score: ScoreBreakdown;

  // Legacy flat fields (deprecated, kept for backward compatibility)
  /** @deprecated Use score.final instead. Alias for score.final. */
  score_legacy?: number; // [0, 1]

  /** @deprecated Use score.semantic instead. Alias for score.semantic. */
  semantic_similarity?: number; // [0, 1]

  /** @deprecated Use score breakdown instead. Trending component. */
  trending_score?: number; // [0, 1]

  /** @deprecated Use score.reputationMultiplier instead. Reputation component. */
  reputation_score?: number; // [0, 1]

  reason: string;
  shared_context?: string[];
}

export interface TrendingTopicsState {
  version: number;
  last_updated: string; // ISO-8601
  time_window_seconds: number;
  total_queries: number;
  topics: TrendingTopic[];
}

export interface AutocompleteRequest {
  q: string;
  limit?: number;
  session_id?: string;
}

export interface AutocompleteResponse {
  query: string;
  suggestions: RankedSuggestion[];
  timestamp: string; // ISO-8601
}

export interface RelatedRequest {
  query: string;
  limit?: number;
  min_score?: number;
}

export interface RelatedResponse {
  query: string;
  related_suggestions: RankedSuggestion[];
  timestamp: string; // ISO-8601
}
