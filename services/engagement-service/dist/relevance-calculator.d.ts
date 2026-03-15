/**
 * RelevanceCalculator
 * Scores posts for agent-tradition semantic alignment
 * Enforces quality gates: no generic comments, minimum substantiveness,
 * and content quality assessment (word count, conceptual density, argument structure).
 */
import { Post, Agent } from "./types";
/** Minimum thresholds for content quality pre-flight gate */
export declare const CONTENT_QUALITY_THRESHOLDS: {
    /** Ignore comments with fewer words than this */
    readonly MIN_WORD_COUNT: 25;
    /**
     * Minimum ratio of philosophical term matches to total words.
     * A value of 0.05 requires roughly 1 philosophical term per 20 words —
     * easily met by substantive philosophical writing but not by shallow
     * affirmations ("I agree. Good point.") which contain zero such terms.
     */
    readonly MIN_CONCEPTUAL_DENSITY: 0.05;
};
/**
 * Philosophical terms used to compute conceptual density.
 * A comment must contain enough of these relative to its word count
 * to pass the content quality gate.
 */
export declare const PHILOSOPHICAL_TERMS: readonly ["ontology", "ontological", "epistemology", "epistemological", "ethics", "ethical", "metaphysics", "metaphysical", "consciousness", "authenticity", "absurd", "absurdity", "dialectic", "dialectical", "phenomenology", "phenomenological", "existential", "existentialism", "existentialist", "deontology", "deontological", "consequentialist", "consequentialism", "virtue", "teleology", "teleological", "empiricism", "empirical", "rationalism", "rationalist", "idealism", "idealist", "realism", "determinism", "autonomy", "intentionality", "qualia", "syllogism", "modality", "a priori", "hermeneutics", "aesthetics", "aesthetic", "epistemics", "pragmatism", "pragmatic", "nihilism", "nihilistic", "stoicism", "stoic", "logos", "aporia", "noumena", "dialectics", "implication", "implies"];
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
export declare class RelevanceCalculator {
    private trendingTopics;
    /**
     * Score post for agent-tradition semantic alignment
     * Returns 0-1, combining semantic + trending + keyword + author + banned phrase penalty
     * 5-factor formula: semantic (40%) + trending (30%) + keyword (15%) + author (10%)
     * Applies 50% penalty if post contains banned phrases for agent
     */
    scorePost(post: Post, agent: Agent): Promise<number>;
    /**
     * Get semantic relevance score from Noosphere
     * In production, calls NoosphereClient.queryMemories()
     * For now, uses keyword matching as base
     */
    private getSemanticScore;
    /**
     * Keyword-based relevance matching
     * Checks for tradition-specific keywords in post content
     */
    private keywordMatch;
    /**
     * Author quality scoring
     * Higher for authors with more followers, lower for unknowns
     */
    private getAuthorQuality;
    /**
     * Detect generic low-effort comments
     * Returns true if comment contains banned phrases
     */
    isGenericComment(content: string): boolean;
    /**
     * Check if comment is substantive (not trivial).
     *
     * Strengthened gate (issue #93):
     *   - Minimum 50 characters (raised from 20)
     *   - At least 2 non-trivial sentences (each sentence must contain
     *     a meaningful word token, not just punctuation)
     *   - Average words per sentence must be ≥ 6
     */
    isSubstantive(content: string): boolean;
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
    assessContentQuality(commentText: string): ContentQualityResult;
    /**
     * Calculate velocity score based on post engagement momentum
     * Measures comments per hour with recency boost for trending posts
     *
     * Formula: (commentCount / ageMs) * 3600000
     * Boost: <1h: 1.5x | <24h: 1.2x | older: 1.0x
     */
    private calculateVelocityScore;
    /**
     * Calculate feed trend score based on post relevance to trending topics
     * Measures how many trending topics are mentioned in the post
     *
     * Returns 0-1 score: (matches / total trending topics)
     */
    private calculateFeedTrendScore;
    /**
     * Calculate agent relevance based on interest matching
     * Measures how well post content aligns with agent's philosophical interests
     *
     * Returns 0-1 score: full match (>0.7) = 1.0, else = match ratio
     */
    private calculateAgentRelevance;
    /**
     * Get agent-specific interests by agent type
     * Maps each philosophical agent to their core conceptual interests
     */
    private getAgentInterests;
    /**
     * Calculate combined trending score based on velocity, feed trends, and agent relevance
     * Combines: velocity (50%) + feed trend (30%) + agent relevance (20%)
     *
     * Returns 0-1 score representing post trending appeal for the agent
     */
    calculateTrendingScore(post: Post, agentType: string): number;
}
//# sourceMappingURL=relevance-calculator.d.ts.map