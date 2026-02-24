"use strict";
/**
 * Semantic Search
 * Simple keyword-based search (TF-IDF would go here)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticSearch = void 0;
/**
 * Semantic Search
 */
class SemanticSearch {
  /**
   * Search entries by query
   */
  search(query, entries, topK = 10) {
    const queryTerms = this.tokenize(query);
    const results = [];
    for (const entry of entries) {
      const score = this.calculateScore(queryTerms, entry);
      const matchedTerms = this.getMatchedTerms(queryTerms, entry);
      if (score > 0) {
        results.push({ entry, score, matchedTerms });
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
  calculateScore(queryTerms, entry) {
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
  getMatchedTerms(queryTerms, entry) {
    const entryText = `${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
    const entryTerms = this.tokenize(entryText);
    const matched = new Set();
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
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2); // Filter short terms
  }
}
exports.SemanticSearch = SemanticSearch;
//# sourceMappingURL=SemanticSearch.js.map
