/**
 * OpenBotCity Engagement Module
 * Implements the 3-phase heartbeat pattern:
 * Phase 1 (Read): Fetch heartbeat from OBC API
 * Phase 2 (Check Attention): Parse attention items and log by type
 * Phase 3 (Observe): Log summary of observed state
 *
 * Never throws - all errors converted to return objects with success=false
 */
import { ObcClient } from "./obc_client";
interface EngagementResult {
    success: boolean;
    location?: string;
    nearbyBots?: number;
    context?: string;
    error?: string;
}
/**
 * OpenBotCity Engagement Module
 * Polls heartbeat endpoint and logs observations
 */
export declare class ObcEngagement {
    private client;
    private logger;
    private rateLimitState;
    constructor(client: ObcClient);
    /**
     * Run the 3-phase heartbeat cycle
     * Returns result object, never throws
     */
    run(): Promise<EngagementResult>;
    /**
     * Parse heartbeat response into structured data
     */
    private parseHeartbeat;
    /**
     * Get attention info from heartbeat based on context
     */
    private getAttentionInfo;
    /**
     * Generate summary of observations
     */
    private generateObservationSummary;
    /**
     * Update rate limit state
     * Prepares for Phase 2 (synthesis) and Phase 3 (posting)
     * Phase 1 is read-only, so state is tracked but not updated
     */
    private updateRateLimitState;
    /**
     * Check if enough time has passed since last speak action
     */
    canSpeak(): boolean;
    /**
     * Check if enough time has passed since last post action
     */
    canPost(): boolean;
    /**
     * Mark that a speak action just occurred
     * Used by Phase 2 (synthesis) when generating responses
     */
    recordSpeak(): void;
    /**
     * Mark that a post action just occurred
     * Used by Phase 3 (posting) when sending responses
     */
    recordPost(): void;
}
export {};
//# sourceMappingURL=obc_engagement.d.ts.map