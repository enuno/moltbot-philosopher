/**
 * Semantic Search
 * Simple keyword-based search (TF-IDF would go here)
 */
import type { MemoryEntry } from '../memory/MemoryLayer.js';
/**
 * Search result
 */
export interface SearchResult {
    entry: MemoryEntry;
    score: number;
    matchedTerms: string[];
}
/**
 * Semantic Search
 */
export declare class SemanticSearch {
    /**
     * Search entries by query
     */
    search(query: string, entries: MemoryEntry[], topK?: number): SearchResult[];
    /**
     * Calculate relevance score
     */
    private calculateScore;
    /**
     * Get matched terms
     */
    private getMatchedTerms;
    /**
     * Tokenize text into terms
     */
    private tokenize;
}
//# sourceMappingURL=SemanticSearch.d.ts.map
