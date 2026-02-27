/**
 * Semantic Search
 * Hybrid search with semantic similarity and post scoring
 */

import type { MemoryEntry } from "../memory/MemoryLayer.js";
import { scorePost, normalizeScores } from "../../../moltbook-sdk/src/scoring.js";
import type { PostScoringInputs, ScoringWeights } from "../../../moltbook-sdk/src/types.js";

/**
 * Search result with optional author info
 */
export interface SearchResult {
  entry: MemoryEntry;
  score: number;
  matchedTerms: string[];
  authorName?: string;
}

/**
 * Semantic Search with hybrid ranking
 */
export class SemanticSearch {
  private followSet: Set<string>;
  private weights?: ScoringWeights;

  /**
   * Initialize SemanticSearch with optional follow set
   * @param followSet Set of followed author names (optional)
   * @param weights Optional ScoringWeights for scorePost()
   */
  constructor(followSet?: Set<string>, weights?: ScoringWeights) {
    this.followSet = followSet || new Set();
    this.weights = weights;
  }

  /**
   * Search entries by query with hybrid scoring
   */
  search(query: string, entries: MemoryEntry[], topK: number = 10): SearchResult[] {
    const queryTerms = this.tokenize(query);
    const results: SearchResult[] = [];

    for (const entry of entries) {
      const semanticScore = this.calculateScore(queryTerms, entry);
      const matchedTerms = this.getMatchedTerms(queryTerms, entry);
      const authorName = this.extractAuthorName(entry);

      if (semanticScore > 0) {
        // Apply scorePost() for hybrid ranking
        const finalScore = this.applyHybridScoring(
          entry,
          semanticScore,
          authorName,
        );

        results.push({
          entry,
          score: finalScore,
          matchedTerms,
          authorName,
        });
      }
    }

    // Normalize final scores to [0, 1] range
    if (results.length > 0) {
      const scores = results.map((r) => r.score);
      const normalized = normalizeScores(scores);
      for (let i = 0; i < results.length; i++) {
        results[i].score = normalized[i];
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top K
    return results.slice(0, topK);
  }

  /**
   * Calculate relevance score
   */
  private calculateScore(queryTerms: string[], entry: MemoryEntry): number {
    let score = 0;
    const entryText = `${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
    const entryTerms = this.tokenize(entryText);

    // Term frequency scoring
    for (const term of queryTerms) {
      const termCount = entryTerms.filter((t) => t === term).length;
      score += termCount;
    }

    // Boost by confidence
    score *= entry.confidence;

    // Boost by layer (Layer 3 > Layer 2 > Layer 1)
    score *= entry.layer;

    return score;
  }

  /**
   * Get matched terms
   */
  private getMatchedTerms(queryTerms: string[], entry: MemoryEntry): string[] {
    const entryText = `${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
    const entryTerms = this.tokenize(entryText);
    const matched = new Set<string>();

    for (const term of queryTerms) {
      if (entryTerms.includes(term)) {
        matched.add(term);
      }
    }

    return Array.from(matched);
  }

  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2); // Filter short terms
  }

  /**
   * Extract author name from entry metadata
   */
  private extractAuthorName(entry: MemoryEntry): string {
    // Try metadata first
    if (entry.metadata?.authorName && typeof entry.metadata.authorName === "string") {
      return entry.metadata.authorName;
    }

    // Try tags for author name pattern
    const authorTag = entry.tags.find((t) => t.startsWith("author:"));
    if (authorTag) {
      return authorTag.replace("author:", "");
    }

    return "unknown";
  }

  /**
   * Calculate age in days from creation date
   */
  private calculateAgeDays(createdAt: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - new Date(createdAt).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.max(0, diffDays);
  }

  /**
   * Apply hybrid scoring combining semantic relevance with author reputation
   * and recency factors
   */
  private applyHybridScoring(
    entry: MemoryEntry,
    semanticScore: number,
    authorName: string,
  ): number {
    try {
      // Get author reputation from metadata (use defaults if unavailable)
      const authorHistoricalScore =
        (typeof entry.metadata?.authorHistoricalScore === "number"
          ? entry.metadata.authorHistoricalScore
          : 0.5) as number;

      const authorRecentScore =
        (typeof entry.metadata?.authorRecentScore === "number"
          ? entry.metadata.authorRecentScore
          : 0.5) as number;

      // Check if author is followed
      const isFollowedAuthor = this.followSet.has(authorName);

      // Calculate age in days
      const ageInDays = this.calculateAgeDays(entry.createdAt);

      // Build scoring input
      const input: PostScoringInputs = {
        postId: entry.id,
        semanticScore,
        ageInDays,
        authorHistoricalScore,
        authorRecentScore,
        isFollowedAuthor,
      };

      // Apply scorePost() with optional weights
      const result = scorePost(input, this.weights);
      return result.finalScore;
    } catch {
      // Fallback to semantic score if hybrid scoring fails
      return semanticScore;
    }
  }
}
