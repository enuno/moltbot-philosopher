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
/** Configuration knobs for thread-level rate limiting */
export declare const THREAD_RATE_LIMIT: {
    /** Maximum responses an agent may make per thread within the rolling hour window */
    readonly MAX_RESPONSES_PER_HOUR: 3;
    /** Minimum milliseconds between successive responses in the same thread */
    readonly COOLDOWN_MS: number;
    /** Rolling window for per-hour cap (ms) */
    readonly HOUR_WINDOW_MS: number;
};
/** Result returned by canRespondToThread() */
export interface ThreadRateLimitResult {
    allowed: boolean;
    reason: "ok" | "hourly_limit" | "cooldown" | "consecutive_responses";
}
interface EngagementEngineConfig {
    statePaths: Record<string, string>;
    agentRoster: Agent[];
}
export declare class EngagementEngine {
    private statePaths;
    private agentRoster;
    private stateManagers;
    private relevanceCalculator;
    /**
     * In-memory per-thread engagement log.
     * Key: threadId → chronologically ordered list of engagement entries.
     * Reset on each process restart (acceptable: reconstructed from live state on restart).
     */
    private threadEngagementLog;
    constructor(config: EngagementEngineConfig);
    /**
     * Check whether an agent is allowed to respond in a given thread right now.
     *
     * Three hard stops (issue #93 Fix 2):
     *   1. Hourly cap  – agent has already responded MAX_RESPONSES_PER_HOUR times
     *      in this thread within the last rolling hour.
     *   2. Cooldown    – the agent's most-recent response in this thread was
     *      fewer than COOLDOWN_MS milliseconds ago.
     *   3. Consecutive – the last two entries in the thread (any agent) are both
     *      from this agent, i.e., the agent would be posting a third consecutive
     *      response without any other participant in between.
     *
     * @param threadId - The post/thread being targeted
     * @param agentId  - The agent that wants to respond
     * @returns ThreadRateLimitResult with `allowed` flag and diagnostic `reason`
     */
    canRespondToThread(threadId: string, agentId: string): ThreadRateLimitResult;
    /**
     * Record that an agent responded in a thread.
     * Called after a response is validated and executed so the log stays accurate.
     * Automatically prunes entries older than the rolling window to prevent unbounded growth.
     *
     * @param threadId - The post/thread that was responded to
     * @param agentId  - The agent that responded
     */
    recordThreadEngagement(threadId: string, agentId: string): void;
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
     * Validate action against quality gates (extended to 8 points).
     *
     * Gate 1: Relevance > 0.6
     * Gate 2: No generic/banned comments
     * Gate 3: Substantiveness (≥50 chars, ≥2 sentences, avg ≥6 words/sentence)
     * Gate 3b (NEW): Content quality pre-flight — word count, conceptual density,
     *               argument structure (issue #93 Fix 1)
     * Gate 4: Per-thread rate limiting — hourly cap, cooldown, consecutive guard
     *               (issue #93 Fix 2)
     * Gate 5: Daily caps (within limits)
     * Gate 6: Follow evaluation (3+ posts seen before follow)
     * P2.2: Also considers thread quality score
     */
    validateAction(action: QueuedAction, content: string, agent: Agent): Promise<boolean>;
    /**
     * Run engagement cycle
     * Visits all agents in order, dequeues and validates actions
     * Applies all validation gates (relevance, generic, substantive, quality, rate limit)
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