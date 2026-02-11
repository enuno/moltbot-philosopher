/**
 * Engagement Poller
 * Polls for mentions, comments, DMs, new users (30s intervals)
 */
import { EventEmitter } from 'events';
/**
 * Engagement poller configuration
 */
export interface EngagementPollerConfig {
    apiKey: string;
    baseUrl: string;
    pollIntervalMs: number;
}
/**
 * Engagement Poller
 */
export declare class EngagementPoller extends EventEmitter {
    private readonly config;
    private intervalId;
    private isPolling;
    private lastCheckTime;
    constructor(config: EngagementPollerConfig);
    /**
     * Start polling
     */
    start(): void;
    /**
     * Stop polling
     */
    stop(): void;
    /**
     * Poll for all engagement types
     */
    private poll;
    /**
     * Poll for mentions
     */
    private pollMentions;
    /**
     * Poll for comments on our posts
     */
    private pollComments;
    /**
     * Poll for DMs
     */
    private pollDMs;
    /**
     * Poll for new users to welcome
     */
    private pollNewUsers;
    /**
     * Get last check time
     */
    getLastCheckTime(): Date | null;
    /**
     * Get polling status
     */
    isActive(): boolean;
}
//# sourceMappingURL=EngagementPoller.d.ts.map
