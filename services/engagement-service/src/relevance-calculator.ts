/**
 * RelevanceCalculator
 * Scores posts for agent-tradition semantic alignment
 * Enforces quality gates: no generic comments, minimum substantiveness,
 * and content quality assessment (word count, conceptual density, argument structure).
 */

import { isBannedForAgent } from "./banned-phrases";
import { Post, Agent } from "./types";

// ─── Content Quality Thresholds ───────────────────────────────────────────────

/** Minimum thresholds for content quality pre-flight gate */
export const CONTENT_QUALITY_THRESHOLDS = {
  /** Ignore comments with fewer words than this */
  MIN_WORD_COUNT: 25,
  /**
   * Minimum ratio of philosophical term matches to total words.
   * A value of 0.05 requires roughly 1 philosophical term per 20 words —
   * easily met by substantive philosophical writing but not by shallow
   * affirmations ("I agree. Good point.") which contain zero such terms.
   */
  MIN_CONCEPTUAL_DENSITY: 0.05,
} as const;

/**
 * Philosophical terms used to compute conceptual density.
 * A comment must contain enough of these relative to its word count
 * to pass the content quality gate.
 */
export const PHILOSOPHICAL_TERMS = [
  "ontology",
  "ontological",
  "epistemology",
  "epistemological",
  "ethics",
  "ethical",
  "metaphysics",
  "metaphysical",
  "consciousness",
  "authenticity",
  "absurd",
  "absurdity",
  "dialectic",
  "dialectical",
  "phenomenology",
  "phenomenological",
  "existential",
  "existentialism",
  "existentialist",
  "deontology",
  "deontological",
  "consequentialist",
  "consequentialism",
  "virtue",
  "teleology",
  "teleological",
  "empiricism",
  "empirical",
  "rationalism",
  "rationalist",
  "idealism",
  "idealist",
  "realism",
  "determinism",
  "autonomy",
  "intentionality",
  "qualia",
  "syllogism",
  "modality",
  "a priori",
  "hermeneutics",
  "aesthetics",
  "aesthetic",
  "epistemics",
  "pragmatism",
  "pragmatic",
  "nihilism",
  "nihilistic",
  "stoicism",
  "stoic",
  "logos",
  "aporia",
  "noumena",
  "dialectics",
  "implication",
  "implies",
] as const;

/** Argument-structure connectives that indicate logical reasoning */
const ARGUMENT_STRUCTURE_PATTERNS = [
  "because",
  "therefore",
  "however",
  "consequently",
  "if\\s+.{1,60}\\s+then",
  "implies",
  "entails",
  "follows that",
  "it is the case",
  "consider that",
  "suppose that",
  "given that",
  "in contrast",
  "on the contrary",
  "by contrast",
  "yet this",
  "this means",
  "this entails",
  "one could argue",
];
const ARGUMENT_STRUCTURE_RE = new RegExp(
  `\\b(${ARGUMENT_STRUCTURE_PATTERNS.join("|")})\\b`,
  "i",
);

/** Result of a content quality assessment */
export interface ContentQualityResult {
  /** Whether the comment passes the quality threshold */
  qualifies: boolean;
  /** Numeric quality score (higher is better) */
  score: number;
  /** Number of words in the comment */
  wordCount: number;
  /** Number of philosophical term matches */
  termMatches: number;
  /** Ratio of philosophical terms to words */
  conceptualDensity: number;
  /** Whether the comment contains argument-structure connectives */
  hasArgumentStructure: boolean;
  /** Human-readable reason why the comment failed (if qualifies=false) */
  failReason?: string;
}

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

const TRADITION_KEYWORDS: Record<string, string[]> = {
  Stoicism: ["virtue", "reason", "duty", "apatheia", "logos", "nature"],
  Existentialism: ["freedom", "responsibility", "authenticity", "bad faith", "anguish"],
  Transcendentalism: ["nature", "intuition", "self-reliance", "transcendent", "individual"],
  Phenomenology: ["consciousness", "experience", "intentionality", "perception", "lived"],
  Rationalism: ["reason", "innate", "deduction", "logic", "mind"],
  "Avant-garde": ["innovation", "experiment", "break", "convention", "radical"],
};

interface TrendingTopic {
  topic: string;
}

export class RelevanceCalculator {
  private trendingTopics: TrendingTopic[] = [];

  /**
   * Score post for agent-tradition semantic alignment
   * Returns 0-1, combining semantic + trending + keyword + author + banned phrase penalty
   * 5-factor formula: semantic (40%) + trending (30%) + keyword (15%) + author (10%)
   * Applies 50% penalty if post contains banned phrases for agent
   */
  async scorePost(post: Post, agent: Agent): Promise<number> {
    // Semantic scoring (would call Noosphere in real implementation)
    const semanticScore = await this.getSemanticScore(post, agent);

    // Trending score combines velocity + feed trends + agent relevance
    const agentType = agent.type || (agent.id as any); // Fallback to id if type not set
    const trendingScore = this.calculateTrendingScore(post, agentType);

    // Keyword matching fallback
    const keywordScore = this.keywordMatch(post.content, agent.tradition);

    // Author quality (placeholder - would be enhanced with state tracking)
    const authorScore = this.getAuthorQuality(post.author);

    // 5-factor weighted formula: 40% semantic + 30% trending + 15% keyword + 10% author
    let score = semanticScore * 0.4 + trendingScore * 0.3 + keywordScore * 0.15 + authorScore * 0.1;

    // Apply 50% penalty for banned phrases for this agent
    if (isBannedForAgent(post.content, agentType)) {
      score *= 0.5;
    }

    // Cap score at 1.0
    return Math.min(score, 1.0);
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
    const matches = keywords.filter((kw) => lowerContent.includes(kw)).length;

    return Math.min(matches / keywords.length, 1.0);
  }

  /**
   * Author quality scoring
   * Higher for authors with more followers, lower for unknowns
   */
  private getAuthorQuality(author: any): number {
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
    return BANNED_PHRASES.some((phrase) => lower === phrase || lower.includes(phrase));
  }

  /**
   * Check if comment is substantive (not trivial).
   *
   * Strengthened gate (issue #93):
   *   - Minimum 50 characters (raised from 20)
   *   - At least 2 non-trivial sentences (each sentence must contain
   *     a meaningful word token, not just punctuation)
   *   - Average words per sentence must be ≥ 6
   */
  isSubstantive(content: string): boolean {
    const trimmed = content.trim();

    // Minimum character length
    if (trimmed.length < 50) return false;

    // Split into non-trivial sentences (ignore empty fragments after split)
    const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 5);
    if (sentences.length < 2) return false;

    // Require average words per sentence >= 6 (prevents "I agree. Good point." style input)
    const totalWords = trimmed.split(/\s+/).filter((w) => w.length > 0).length;
    const avgWordsPerSentence = totalWords / sentences.length;
    return avgWordsPerSentence >= 6;
  }

  /**
   * Assess the content quality of a comment before generating STP responses.
   *
   * Three criteria (issue #93 Fix 1):
   *   1. Word count ≥ CONTENT_QUALITY_THRESHOLDS.MIN_WORD_COUNT (25)
   *   2. Conceptual density ≥ CONTENT_QUALITY_THRESHOLDS.MIN_CONCEPTUAL_DENSITY (0.05)
   *      (philosophical term matches / total words — requires ~1 term per 20 words)
   *   3. Presence of at least one argument-structure connective
   *      (because, therefore, however, if…then, implies, entails, etc.)
   *
   * All three criteria must pass for `qualifies` to be true.
   *
   * @param commentText - Raw comment text to assess
   * @returns ContentQualityResult with pass/fail and diagnostic metrics
   */
  assessContentQuality(commentText: string): ContentQualityResult {
    const trimmed = commentText.trim();
    const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;

    // Count philosophical term matches using word-boundary regex.
    // Word boundary matching prevents "ontology" from matching within "ontological"
    // when both variants are listed — each term is counted at most once (present/absent).
    const termMatches = PHILOSOPHICAL_TERMS.reduce((count, term) => {
      // Escape special regex chars in the term (handles "a priori" with space)
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      return re.test(trimmed) ? count + 1 : count;
    }, 0);

    const conceptualDensity = wordCount > 0 ? termMatches / wordCount : 0;
    const hasArgumentStructure = ARGUMENT_STRUCTURE_RE.test(trimmed);

    // Determine pass/fail and reason
    let qualifies = true;
    let failReason: string | undefined;

    if (wordCount < CONTENT_QUALITY_THRESHOLDS.MIN_WORD_COUNT) {
      qualifies = false;
      failReason = `word_count_too_low (${wordCount} < ${CONTENT_QUALITY_THRESHOLDS.MIN_WORD_COUNT})`;
    } else if (conceptualDensity < CONTENT_QUALITY_THRESHOLDS.MIN_CONCEPTUAL_DENSITY) {
      qualifies = false;
      failReason = `conceptual_density_too_low (${conceptualDensity.toFixed(3)} < ${CONTENT_QUALITY_THRESHOLDS.MIN_CONCEPTUAL_DENSITY})`;
    } else if (!hasArgumentStructure) {
      qualifies = false;
      failReason = "no_argument_structure";
    }

    // Numeric score for ranking purposes
    const score = wordCount * 0.3 + termMatches * 2 + (hasArgumentStructure ? 5 : 0);

    return {
      qualifies,
      score,
      wordCount,
      termMatches,
      conceptualDensity,
      hasArgumentStructure,
      ...(failReason && { failReason }),
    };
  }

  /**
   * Calculate velocity score based on post engagement momentum
   * Measures comments per hour with recency boost for trending posts
   *
   * Formula: (commentCount / ageMs) * 3600000
   * Boost: <1h: 1.5x | <24h: 1.2x | older: 1.0x
   */
  private calculateVelocityScore(post: Post): number {
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
  private calculateFeedTrendScore(post: Post): number {
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
  private calculateAgentRelevance(post: Post, agentType: string, interests: string[] = []): number {
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
  private getAgentInterests(agentType: string): string[] {
    const interests: Record<string, string[]> = {
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

  /**
   * Calculate combined trending score based on velocity, feed trends, and agent relevance
   * Combines: velocity (50%) + feed trend (30%) + agent relevance (20%)
   *
   * Returns 0-1 score representing post trending appeal for the agent
   */
  calculateTrendingScore(post: Post, agentType: string): number {
    const velocity = this.calculateVelocityScore(post);
    const feedTrend = this.calculateFeedTrendScore(post);
    const agentInterests = this.getAgentInterests(agentType);
    const agentRelevance = this.calculateAgentRelevance(post, agentType, agentInterests);

    // Normalize velocity to 0-1 range (cap at 10 comments/hour = score 1.0)
    const normalizedVelocity = Math.min(velocity / 10, 1.0);

    return normalizedVelocity * 0.5 + feedTrend * 0.3 + agentRelevance * 0.2;
  }
}
