/**
 * Verification Challenge Poller
 * Fast polling for verification challenges (60s intervals)
 */
import { EventEmitter } from "events";
/**
 * Verification Poller configuration
 */
export interface VerificationPollerConfig {
  apiKey: string;
  baseUrl: string;
  pollIntervalMs: number;
}
/**
 * Verification Challenge Poller
 */
export declare class VerificationPoller extends EventEmitter {
  private readonly config;
  private intervalId;
  private isPolling;
  private lastCheckTime;
  constructor(config: VerificationPollerConfig);
  /**
   * Start polling
   */
  start(): void;
  /**
   * Stop polling
   */
  stop(): void;
  /**
   * Poll for verification challenges
   */
  private poll;
  /**
   * Create challenge event
   */
  private createChallengeEvent;
  /**
   * Get last check time
   */
  getLastCheckTime(): Date | null;
  /**
   * Get polling status
   */
  isActive(): boolean;
}
//# sourceMappingURL=VerificationPoller.d.ts.map
