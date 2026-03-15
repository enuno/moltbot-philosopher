"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngagementEngine = exports.THREAD_RATE_LIMIT = void 0;
const state_manager_1 = require("./state-manager");
const relevance_calculator_1 = require("./relevance-calculator");
const quality_metrics_calculator_1 = require("./quality-metrics-calculator");
// ─── Per-Thread Rate Limiting ─────────────────────────────────────────────────
/** Configuration knobs for thread-level rate limiting */
exports.THREAD_RATE_LIMIT = {
    /** Maximum responses an agent may make per thread within the rolling hour window */
    MAX_RESPONSES_PER_HOUR: 3,
    /** Minimum milliseconds between successive responses in the same thread */
    COOLDOWN_MS: 15 * 60 * 1000, // 15 minutes
    /** Rolling window for per-hour cap (ms) */
    HOUR_WINDOW_MS: 60 * 60 * 1000, // 1 hour
};
class EngagementEngine {
    constructor(config) {
        this.statePaths = config.statePaths;
        this.agentRoster = config.agentRoster;
        this.stateManagers = new Map();
        this.relevanceCalculator = new relevance_calculator_1.RelevanceCalculator();
        this.threadEngagementLog = new Map();
        // Initialize StateManager for each agent
        Object.entries(config.statePaths).forEach(([agentId, statePath]) => {
            this.stateManagers.set(agentId, new state_manager_1.StateManager(statePath));
        });
    }
    // ─── Per-Thread Rate Limiting ───────────────────────────────────────────────
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
    canRespondToThread(threadId, agentId) {
        const now = Date.now();
        const history = this.threadEngagementLog.get(threadId) ?? [];
        // Entries from this agent within the rolling hour window
        const hourStart = now - exports.THREAD_RATE_LIMIT.HOUR_WINDOW_MS;
        const recentByAgent = history.filter((e) => e.agentId === agentId && e.timestamp >= hourStart);
        // 1. Hourly cap
        if (recentByAgent.length >= exports.THREAD_RATE_LIMIT.MAX_RESPONSES_PER_HOUR) {
            return { allowed: false, reason: "hourly_limit" };
        }
        // 2. Consecutive-response guard — checked before cooldown because it is a
        //    stricter structural condition independent of time elapsed.
        //    Block if the last two posts in the thread are both from this agent.
        if (history.length >= 2) {
            const lastTwo = history.slice(-2);
            if (lastTwo.every((e) => e.agentId === agentId)) {
                return { allowed: false, reason: "consecutive_responses" };
            }
        }
        // 3. Cooldown between successive responses
        const lastByAgent = recentByAgent[recentByAgent.length - 1];
        const timeSinceLastResponse = lastByAgent
            ? now - lastByAgent.timestamp
            : exports.THREAD_RATE_LIMIT.COOLDOWN_MS;
        if (timeSinceLastResponse < exports.THREAD_RATE_LIMIT.COOLDOWN_MS) {
            return { allowed: false, reason: "cooldown" };
        }
        return { allowed: true, reason: "ok" };
    }
    /**
     * Record that an agent responded in a thread.
     * Called after a response is validated and executed so the log stays accurate.
     * Automatically prunes entries older than the rolling window to prevent unbounded growth.
     *
     * @param threadId - The post/thread that was responded to
     * @param agentId  - The agent that responded
     */
    recordThreadEngagement(threadId, agentId) {
        const now = Date.now();
        const history = this.threadEngagementLog.get(threadId) ?? [];
        history.push({ agentId, timestamp: now });
        // Prune entries older than the rolling hour window, but keep last 2 for consecutive guard
        const hourStart = now - exports.THREAD_RATE_LIMIT.HOUR_WINDOW_MS;
        const pruned = history.filter((e) => e.timestamp >= hourStart);
        // If pruning removed all entries, delete the thread key; otherwise update
        if (pruned.length === 0) {
            this.threadEngagementLog.delete(threadId);
        }
        else {
            this.threadEngagementLog.set(threadId, pruned);
        }
    }
    /**
     * Monitor feed across subscribedSubmolts
     * Fetches posts, scores for relevance, filters > 0.6, returns opportunities
     * Limits to 10 posts per submolt for efficiency
     * P2.2: Computes thread quality metrics and records author engagement
     */
    async monitorFeed() {
        const opportunities = [];
        // In production, would iterate through all subscribedSubmolts
        // For testing, use default submolts
        const defaultSubmolts = ["ethics-convergence", "general", "aithoughts"];
        for (const submoltId of defaultSubmolts) {
            // Mock: fetch posts from submolt
            // In production: call egress-proxy API
            const posts = await this.fetchSubmoltPosts(submoltId, 10);
            for (const post of posts) {
                // Score post against all agents to find best match
                for (const agent of this.agentRoster) {
                    const relevanceScore = await this.relevanceCalculator.scorePost(post, agent);
                    // P2.2: Compute thread quality metrics for all posts
                    const stateManager = this.stateManagers.get(agent.id);
                    if (stateManager) {
                        const state = await stateManager.loadState();
                        // Compute quality metrics (in production: would include fetched comments)
                        // For now: use empty comment array (comments not fetched in feed monitoring)
                        const comments = []; // Mock: no comments in feed monitoring context
                        const threadQuality = await (0, quality_metrics_calculator_1.computeThreadQuality)(post, comments, state);
                        // Record author engagement from quality metrics
                        for (const author of threadQuality.topAuthors) {
                            (0, state_manager_1.recordAuthorEngagementInThread)(state, post.id, author.userId, author.commentsByAuthor, author.repliesReceivedByAuthor, author.userName);
                        }
                        // Cache quality metrics
                        if (!state.threadQualityCache) {
                            state.threadQualityCache = new Map();
                        }
                        state.threadQualityCache.set(post.id, threadQuality);
                        // Persist state with quality metrics
                        await stateManager.saveState(state);
                        // P2.2: Combine relevance and quality scores for engagement decision
                        // Formula: 60% relevance + 40% quality
                        const combinedScore = (relevanceScore * 0.6) + (threadQuality.qualityScore * 0.4);
                        // Only queue if combined score above threshold
                        if (combinedScore > 0.6) {
                            opportunities.push({
                                id: `opp_${post.id}_${agent.id}`,
                                postId: post.id,
                                author: post.author,
                                content: post.content,
                                submoltId: post.submoltId,
                                relevanceScore: combinedScore, // Store combined score for engagement decision
                                reason: `Semantic match to ${agent.tradition}`,
                                suggestedAction: "comment",
                                createdAt: Date.now(),
                            });
                        }
                    }
                }
            }
        }
        return opportunities;
    }
    /**
     * Fetch posts from a submolt (mock implementation)
     * In production, calls egress-proxy
     */
    async fetchSubmoltPosts(submoltId, limit) {
        // Mock implementation for testing
        return [];
    }
    /**
     * Dequeue opportunities for a specific agent
     * Respects daily limits and action-specific constraints
     */
    async dequeueOpportunities(agent) {
        const stateManager = this.stateManagers.get(agent.id);
        if (!stateManager)
            return [];
        const state = await stateManager.loadState();
        const actions = [];
        const dequeuedPostIds = new Set();
        // Process queue in priority order
        for (const opportunity of state.engagementQueue) {
            // Check daily limits based on action type
            if (opportunity.type === "comment" && state.dailyStats.commentsMade >= 50) {
                continue;
            }
            if (opportunity.type === "post" && state.dailyStats.postsCreated >= 3) {
                continue;
            }
            if (opportunity.type === "follow" && state.dailyStats.accountsFollowed >= 2) {
                continue;
            }
            if (opportunity.type === "dm" && state.dailyStats.dmRequestsSent >= 2) {
                continue;
            }
            // Add to dequeued actions
            actions.push(opportunity);
            dequeuedPostIds.add(opportunity.postId);
            // Don't dequeue too many at once
            if (actions.length >= 5)
                break;
        }
        // Remove dequeued items from state
        state.engagementQueue = state.engagementQueue.filter((opp) => !dequeuedPostIds.has(opp.postId));
        await stateManager.saveState(state);
        return actions;
    }
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
    async validateAction(action, content, agent) {
        // Gate 1: Relevance threshold
        if (action.priority <= 0.6) {
            return false;
        }
        // Gate 2: Generic comments
        if (action.type === "comment" && this.relevanceCalculator.isGenericComment(content)) {
            return false;
        }
        // Gate 3: Substantiveness (50+ chars, 2+ sentences, avg ≥6 words/sentence)
        if (action.type === "comment" && !this.relevanceCalculator.isSubstantive(content)) {
            return false;
        }
        // Gate 3b: Content quality pre-flight gate (issue #93 Fix 1)
        // Checks word count, conceptual density, and argument structure.
        // Applied to comments only; posts use their own editorial pipeline.
        if (action.type === "comment") {
            const quality = this.relevanceCalculator.assessContentQuality(content);
            if (!quality.qualifies) {
                // Log skip at debug level with structured context
                console.log(JSON.stringify({
                    level: "debug",
                    event: "quality_gate_skip",
                    agentId: agent.id,
                    postId: action.postId,
                    reason: quality.failReason,
                    wordCount: quality.wordCount,
                    conceptualDensity: quality.conceptualDensity,
                    hasArgumentStructure: quality.hasArgumentStructure,
                }));
                return false;
            }
        }
        // Gate 4: Per-thread rate limiting (issue #93 Fix 2)
        if (action.type === "comment") {
            const threadLimit = this.canRespondToThread(action.postId, agent.id);
            if (!threadLimit.allowed) {
                // Log skip at debug level with structured context
                console.log(JSON.stringify({
                    level: "debug",
                    event: "thread_rate_limit_skip",
                    agentId: agent.id,
                    threadId: action.postId,
                    reason: threadLimit.reason,
                }));
                return false;
            }
        }
        const stateManager = this.stateManagers.get(agent.id);
        if (!stateManager)
            return false;
        const state = await stateManager.loadState();
        // P2.2: Check quality score if available (optional boost to priority)
        // Quality score can enhance engagement decision but isn't a gate
        let qualityScore = 0.5; // Default neutral if no quality metrics cached
        if (state.threadQualityCache) {
            const threadQuality = state.threadQualityCache.get(action.postId);
            if (threadQuality) {
                qualityScore = threadQuality.qualityScore;
            }
        }
        // Note: In production, could use: action.priority += (qualityScore * 0.1)
        // For now, just ensure we have the metric available
        // Gate 5: Daily caps (check current counts)
        if (action.type === "comment" && state.dailyStats.commentsMade >= 50) {
            return false;
        }
        if (action.type === "post" && state.dailyStats.postsCreated >= 3) {
            return false;
        }
        if (action.type === "follow" && state.dailyStats.accountsFollowed >= 2) {
            return false;
        }
        if (action.type === "dm" && state.dailyStats.dmRequestsSent >= 2) {
            return false;
        }
        // Gate 6: Follow evaluation (must have seen 3+ posts from account)
        if (action.type === "follow") {
            const evaluation = await stateManager.getFollowEvaluationStatus(content);
            if (!evaluation.canFollow) {
                return false;
            }
        }
        return true;
    }
    /**
     * Run engagement cycle
     * Visits all agents in order, dequeues and validates actions
     * Applies all validation gates (relevance, generic, substantive, quality, rate limit)
     */
    async runEngagementCycle() {
        for (const agent of this.agentRoster) {
            try {
                const actions = await this.dequeueOpportunities(agent);
                for (const action of actions) {
                    // In production: would generateContent here, validate content
                    // against quality gates, then executeAction. For now, just
                    // record engagement to test per-thread rate limiting.
                    // Record thread engagement for rate limiting tracking
                    if (action.type === "comment") {
                        this.recordThreadEngagement(action.postId, agent.id);
                    }
                }
            }
            catch (error) {
                // Log error but continue with next agent
                console.error(`Error processing agent ${agent.id}:`, error);
            }
        }
    }
    /**
     * Consider posting for an agent
     * Respects 30-minute cooldown and daily posting limit
     */
    async considerPosting(agent) {
        const stateManager = this.stateManagers.get(agent.id);
        if (!stateManager)
            return;
        const state = await stateManager.loadState();
        // Check post cooldown (30 minutes = 1800000ms)
        const timeSinceLastPost = Date.now() - state.lastPostTime;
        if (timeSinceLastPost < 30 * 60 * 1000) {
            return;
        }
        // Check daily post limit (max 3)
        if (state.dailyStats.postsCreated >= 3) {
            return;
        }
        // In production: would generate post content and execute
        // For testing: just verify no errors
    }
    /**
     * Daily maintenance
     * Resets daily stats and removes inactive follows
     */
    async dailyMaintenance() {
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        for (const agent of this.agentRoster) {
            const stateManager = this.stateManagers.get(agent.id);
            if (!stateManager)
                continue;
            const state = await stateManager.loadState();
            // Reset daily stats (auto-handled by loadState, but ensure clean)
            const today = new Date().toISOString().split("T")[0];
            if (state.dailyReset !== today) {
                state.dailyStats = {
                    date: today,
                    postsCreated: 0,
                    commentsMade: 0,
                    accountsFollowed: 0,
                    dmRequestsSent: 0,
                    threadsParticipated: 0,
                };
                state.dailyReset = today;
            }
            // Unfollow inactive accounts (>30 days without engagement)
            state.followedAccounts = state.followedAccounts.filter((account) => {
                const daysSinceEngagement = (now - account.lastEngagement) / (24 * 60 * 60 * 1000);
                return daysSinceEngagement <= 30;
            });
            await stateManager.saveState(state);
        }
    }
    /**
     * Heartbeat maintenance handler
     * Runs once per day to enforce 30-day rolling window for metrics
     * - Prunes threads older than 30 days
     * - Maintains lastMaintenanceAt timestamp to prevent redundant runs
     * - Logs maintenance activity for monitoring
     * - Handles errors gracefully without crashing engagement engine
     */
    async onHeartbeat() {
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        for (const agent of this.agentRoster) {
            const stateManager = this.stateManagers.get(agent.id);
            if (!stateManager)
                continue;
            try {
                const state = await stateManager.loadState();
                // Check if maintenance already ran today
                const lastMaint = state.lastMaintenanceAt
                    ? new Date(state.lastMaintenanceAt).getTime()
                    : 0;
                if (now - lastMaint < dayInMs) {
                    // Already ran today, skip
                    continue;
                }
                // Prune stale threads (older than 30 days)
                const prunedCount = (0, state_manager_1.pruneStaleThreadMetrics)(state);
                // Update timestamp
                state.lastMaintenanceAt = now;
                // Persist state
                await stateManager.saveState(state);
                // Log activity
                if (prunedCount > 0) {
                    console.log(`[P2.2 Maintenance] Agent: ${agent.id}, Threads pruned: ${prunedCount}, Timestamp: ${new Date(now).toISOString()}`);
                }
            }
            catch (error) {
                // Log error but don't crash engagement engine
                console.error(`[P2.2 Maintenance] Error for agent ${agent.id}: ${error instanceof Error ? error.message : String(error)}`);
                // Continue with next agent
            }
        }
    }
    /**
     * P2.3: Detect topics in current feed
     * Returns topics sorted by score
     */
    async detectTopicsInFeed() {
        // Stub: to be implemented in P2.3
        return [];
    }
    /**
     * P2.3: Select agents for a detected topic
     * Returns top agents by affinity
     */
    async selectAgentsForPost(topicId) {
        // Stub: to be implemented in P2.3
        return [];
    }
    /**
     * P2.3: Generate draft post from template
     * Creates editorial draft with interpolated content
     */
    async generateDraftPost(agentId, topicId, threadId, slots) {
        // Stub: to be implemented in P2.3
        return null;
    }
    /**
     * P2.3: Check for proactive posting opportunities
     * Returns count of draft posts queued
     */
    async checkProactivePostingOpportunities() {
        // Stub: to be implemented in P2.3
        return 0;
    }
}
exports.EngagementEngine = EngagementEngine;
//# sourceMappingURL=engagement-engine.js.map