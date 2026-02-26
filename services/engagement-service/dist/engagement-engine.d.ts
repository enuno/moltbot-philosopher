/**
 * EngagementEngine
 * Orchestrates feed monitoring, opportunity scoring, action validation, and agent scheduling
 * Core responsibilities:
 * - Monitor feeds across subscribedSubmolts
 * - Score posts for relevance and queue opportunities
 * - Validate actions against 6-point quality gates
 * - Schedule agents in round-robin order
 * - Generate content for posting
 * - Daily maintenance (reset stats, unfollow inactive accounts)
 */
import { Agent, Opportunity, QueuedAction } from "./types";
interface EngagementEngineConfig {
    statePaths: Record<string, string>;
    agentRoster: Agent[];
}
export declare class EngagementEngine {
    private statePaths;
    private agentRoster;
    private stateManagers;
    private relevanceCalculator;
    constructor(config: EngagementEngineConfig);
    /**
     * Monitor feed across subscribedSubmolts
     * Fetches posts, scores for relevance, filters > 0.6, returns opportunities
     * Limits to 10 posts per submolt for efficiency
     * P2.2: Computes thread quality metrics and records author engagement
     */
    monitorFeed(): Promise<Opportunity[]>;
    /**
     * Fetch posts from a submolt (mock implementation)
     * In production, calls egress-proxy
     */
    private fetchSubmoltPosts;
    /**
     * Dequeue opportunities for a specific agent
     * Respects daily limits and action-specific constraints
     */
    dequeueOpportunities(agent: Agent): Promise<QueuedAction[]>;
    /**
     * Validate action against 6-point quality gate
     * 1. Relevance > 0.6
     * 2. No generic comments
     * 3. Substantiveness (>20 chars, 2+ sentences)
     * 4. Rate limits (checked locally)
     * 5. Daily caps (within limits)
     * 6. Follow evaluation (3+ posts seen before follow)
     * P2.2: Also considers thread quality score
     */
    validateAction(action: QueuedAction, content: string, agent: Agent): Promise<boolean>;
    /**
     * Run engagement cycle
     * Visits all agents in order, dequeues and validates actions
     */
    runEngagementCycle(): Promise<void>;
    /**
     * Consider posting for an agent
     * Respects 30-minute cooldown and daily posting limit
     */
    considerPosting(agent: Agent): Promise<void>;
    /**
     * Daily maintenance
     * Resets daily stats and removes inactive follows
     */
    dailyMaintenance(): Promise<void>;
    /**
     * Heartbeat maintenance handler
     * Runs once per day to enforce 30-day rolling window for metrics
     * - Prunes threads older than 30 days
     * - Maintains lastMaintenanceAt timestamp to prevent redundant runs
     * - Logs maintenance activity for monitoring
     * - Handles errors gracefully without crashing engagement engine
     */
    onHeartbeat(): Promise<void>;
    /**
     * P2.3: Detect topics in current feed
     * Returns topics sorted by score
     */
    detectTopicsInFeed(): Promise<Array<{
        topicId: string;
        score: number;
        threadCount: number;
    }>>;
    /**
     * P2.3: Select agents for a detected topic
     * Returns top agents by affinity
     */
    selectAgentsForPost(topicId: string): Promise<Array<{
        agentId: string;
        affinityScore: number;
    }>>;
    /**
     * P2.3: Generate draft post from template
     * Creates editorial draft with interpolated content
     */
    generateDraftPost(agentId: string, topicId: string, threadId: string | undefined, slots: Record<string, string>): Promise<any>;
    /**
     * P2.3: Check for proactive posting opportunities
     * Returns count of draft posts queued
     */
    checkProactivePostingOpportunities(): Promise<number>;
}
export {};
//# sourceMappingURL=engagement-engine.d.ts.map