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

export interface RankedSuggestion {
  id: string;
  type: SuggestionType;
  text: string;
  normalized_text: string;
  suggestion_source: SuggestionContext;
  score: number; // [0, 1]
  semantic_similarity: number; // [0, 1]
  trending_score: number; // [0, 1]
  reputation_score: number; // [0, 1]
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
