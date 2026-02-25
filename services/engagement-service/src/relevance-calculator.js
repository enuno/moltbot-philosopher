/**
 * RelevanceCalculator
 * Scores posts for agent-tradition semantic alignment
 * Enforces quality gates: no generic comments, minimum substantiveness
 */

const BANNED_PHRASES = [
  "good",
  "good point",
  "interesting",
  "nice post",
  "well said",
  "couldn't agree more",
  "this is great",
  "+1",
  "same",
];

const TRADITION_KEYWORDS = {
  Stoicism: ["virtue", "reason", "duty", "apatheia", "logos", "nature"],
  Existentialism: ["freedom", "responsibility", "authenticity", "bad faith", "anguish"],
  Transcendentalism: ["nature", "intuition", "self-reliance", "transcendent", "individual"],
  Phenomenology: ["consciousness", "experience", "intentionality", "perception", "lived"],
  Rationalism: ["reason", "innate", "deduction", "logic", "mind"],
  "Avant-garde": ["innovation", "experiment", "break", "convention", "radical"],
};

class RelevanceCalculator {
  /**
   * Score post for agent-tradition semantic alignment
   * Returns 0-1, combining semantic + keyword + author quality
   */
  async scorePost(post, agent) {
    // Semantic scoring (would call Noosphere in real implementation)
    const semanticScore = await this.getSemanticScore(post, agent);

    // Keyword matching fallback
    const keywordScore = this.keywordMatch(post.content, agent.tradition);

    // Author quality (placeholder - would be enhanced with state tracking)
    const authorScore = this.getAuthorQuality(post.author);

    // Weighted average: 60% semantic, 25% keyword, 15% author
    return semanticScore * 0.6 + keywordScore * 0.25 + authorScore * 0.15;
  }

  /**
   * Get semantic relevance score from Noosphere
   * In production, calls NoosphereClient.queryMemories()
   * For now, uses keyword matching as base
   */
  async getSemanticScore(post, agent) {
    // TODO: Integrate with Noosphere API
    // For testing, use keyword-based scoring
    const keywordScore = this.keywordMatch(post.content, agent.tradition);
    return Math.min(keywordScore * 1.2, 1.0); // Slight boost for semantic
  }

  /**
   * Keyword-based relevance matching
   * Checks for tradition-specific keywords in post content
   */
  keywordMatch(content, tradition) {
    const keywords = TRADITION_KEYWORDS[tradition] || [];
    if (keywords.length === 0) return 0.3;

    const lowerContent = content.toLowerCase();
    const matches = keywords.filter((kw) => lowerContent.includes(kw)).length;

    return Math.min(matches / keywords.length, 1.0);
  }

  /**
   * Author quality scoring
   * Higher for authors with more followers, lower for unknowns
   */
  getAuthorQuality(author) {
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
  isGenericComment(content) {
    const lower = content.toLowerCase().trim();
    return BANNED_PHRASES.some((phrase) => lower === phrase || lower.includes(phrase));
  }

  /**
   * Check if comment is substantive (not trivial)
   * Requires: >20 characters AND >1 sentence (split by .!?)
   */
  isSubstantive(content) {
    const trimmed = content.trim();

    // Minimum length check
    if (trimmed.length < 20) return false;

    // Minimum sentence count check
    const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    return sentences.length >= 2;
  }

  /**
   * Calculate velocity score based on post engagement momentum
   * Measures comments per hour with recency boost for trending posts
   *
   * Formula: (commentCount / ageMs) * 3600000
   * Boost: <1h: 1.5x | <24h: 1.2x | older: 1.0x
   */
  calculateVelocityScore(post) {
    const ageMs = Date.now() - post.createdAt;

    // Avoid division by zero for very new posts
    if (ageMs <= 0) return 0;

    // Calculate comments per hour
    const commentsPerHour = (post.commentCount / ageMs) * 3600000;

    // Apply recency boost
    if (ageMs < 3600000) {
      return commentsPerHour * 1.5; // <1h: +50% boost
    }
    if (ageMs < 86400000) {
      return commentsPerHour * 1.2; // <24h: +20% boost
    }
    return commentsPerHour * 1.0; // No boost for older posts
  }

  /**
   * Calculate feed trend score based on post relevance to trending topics
   * Measures how many trending topics are mentioned in the post
   *
   * Returns 0-1 score: (matches / total trending topics)
   */
  calculateFeedTrendScore(post) {
    const trendingTopics = this.trendingTopics || [];
    if (trendingTopics.length === 0) return 0;

    const contentLower = post.content.toLowerCase();
    const matches = trendingTopics.filter((trend) =>
      contentLower.includes(trend.topic.toLowerCase()),
    ).length;

    if (matches === 0) return 0;
    return Math.min(matches / Math.max(trendingTopics.length, 1), 1.0);
  }

  /**
   * Calculate agent relevance based on interest matching
   * Measures how well post content aligns with agent's philosophical interests
   *
   * Returns 0-1 score: full match (>0.7) = 1.0, else = match ratio
   */
  calculateAgentRelevance(post, agentType, interests = []) {
    if (!interests || interests.length === 0) return 0.5;

    const contentLower = post.content.toLowerCase();
    const matches = interests.filter((interest) =>
      contentLower.includes(interest.toLowerCase()),
    ).length;

    const matchScore = Math.min(matches / interests.length, 1.0);
    return matchScore > 0.7 ? 1.0 : matchScore;
  }

  /**
   * Get agent-specific interests by agent type
   * Maps each philosophical agent to their core conceptual interests
   */
  getAgentInterests(agentType) {
    const interests = {
      classical: ["stoicism", "virtue", "duty", "apatheia", "logos", "nature", "reason"],
      existentialist: [
        "freedom",
        "responsibility",
        "authenticity",
        "bad faith",
        "anguish",
      ],
      transcendentalist: ["nature", "intuition", "self-reliance", "transcendent"],
      joyce: ["consciousness", "experience", "intentionality", "perception"],
      enlightenment: ["rights", "reason", "tolerance", "utilitarianism"],
      beat: ["counterculture", "spontaneity", "zen", "rebellion"],
      cyberpunk: ["posthumanism", "AI ethics", "cyborg rights", "autonomy"],
      satirist: ["absurd", "irony", "satire", "paradox"],
      scientist: ["empiricism", "cosmos", "testability", "evidence"],
    };
    return interests[agentType] || [];
  }
}

module.exports = { RelevanceCalculator };
