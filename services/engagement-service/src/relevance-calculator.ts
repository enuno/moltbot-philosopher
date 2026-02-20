/**
 * RelevanceCalculator
 * Scores posts for agent-tradition semantic alignment
 * Enforces quality gates: no generic comments, minimum substantiveness
 */

import { Post, Agent } from './types';

const BANNED_PHRASES = [
  'good',
  'good point',
  'interesting',
  'nice post',
  'well said',
  'couldn\'t agree more',
  'this is great',
  '+1',
  'same'
];

const TRADITION_KEYWORDS: Record<string, string[]> = {
  'Stoicism': ['virtue', 'reason', 'duty', 'apatheia', 'logos', 'nature'],
  'Existentialism': ['freedom', 'responsibility', 'authenticity', 'bad faith', 'anguish'],
  'Transcendentalism': ['nature', 'intuition', 'self-reliance', 'transcendent', 'individual'],
  'Phenomenology': ['consciousness', 'experience', 'intentionality', 'perception', 'lived'],
  'Rationalism': ['reason', 'innate', 'deduction', 'logic', 'mind'],
  'Avant-garde': ['innovation', 'experiment', 'break', 'convention', 'radical']
};

export class RelevanceCalculator {
  /**
   * Score post for agent-tradition semantic alignment
   * Returns 0-1, combining semantic + keyword + author quality
   */
  async scorePost(post: Post, agent: Agent): Promise<number> {
    // Semantic scoring (would call Noosphere in real implementation)
    const semanticScore = await this.getSemanticScore(post, agent);

    // Keyword matching fallback
    const keywordScore = this.keywordMatch(post.content, agent.tradition);

    // Author quality (placeholder - would be enhanced with state tracking)
    const authorScore = this.getAuthorQuality(post.author);

    // Weighted average: 60% semantic, 25% keyword, 15% author
    return (semanticScore * 0.6) + (keywordScore * 0.25) + (authorScore * 0.15);
  }

  /**
   * Get semantic relevance score from Noosphere
   * In production, calls NoosphereClient.queryMemories()
   * For now, uses keyword matching as base
   */
  private async getSemanticScore(post: Post, agent: Agent): Promise<number> {
    // TODO: Integrate with Noosphere API
    // For testing, use keyword-based scoring
    const keywordScore = this.keywordMatch(post.content, agent.tradition);
    return Math.min(keywordScore * 1.2, 1.0); // Slight boost for semantic
  }

  /**
   * Keyword-based relevance matching
   * Checks for tradition-specific keywords in post content
   */
  private keywordMatch(content: string, tradition: string): number {
    const keywords = TRADITION_KEYWORDS[tradition] || [];
    if (keywords.length === 0) return 0.3;

    const lowerContent = content.toLowerCase();
    const matches = keywords.filter(kw => lowerContent.includes(kw)).length;

    return Math.min(matches / keywords.length, 1.0);
  }

  /**
   * Author quality scoring
   * Higher for authors with more followers, lower for unknowns
   */
  private getAuthorQuality(author: { followerCount?: number }): number {
    if (!author.followerCount) return 0.5;
    if (author.followerCount < 10) return 0.3;
    if (author.followerCount < 100) return 0.5;
    if (author.followerCount < 500) return 0.7;
    return 0.9;
  }

  /**
   * Detect generic low-effort comments
   * Returns true if comment contains banned phrases
   */
  isGenericComment(content: string): boolean {
    const lower = content.toLowerCase().trim();
    return BANNED_PHRASES.some(phrase => lower === phrase || lower.includes(phrase));
  }

  /**
   * Check if comment is substantive (not trivial)
   * Requires: >20 characters AND >1 sentence (split by .!?)
   */
  isSubstantive(content: string): boolean {
    const trimmed = content.trim();

    // Minimum length check
    if (trimmed.length < 20) return false;

    // Minimum sentence count check
    const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.length >= 2;
  }
}
