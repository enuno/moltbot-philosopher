/**
 * RelevanceCalculator
 * Scores posts for agent-tradition semantic alignment
 * Enforces quality gates: no generic comments, minimum substantiveness
 */
import { Post, Agent } from "./types";
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
     * Check if comment is substantive (not trivial)
     * Requires: >20 characters AND >1 sentence (split by .!?)
     */
    isSubstantive(content: string): boolean;
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