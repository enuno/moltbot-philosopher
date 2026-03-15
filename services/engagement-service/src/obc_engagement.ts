/**
 * OpenBotCity Engagement Module
 * Implements the 3-phase heartbeat pattern:
 * Phase 1 (Read): Fetch heartbeat from OBC API
 * Phase 2 (Check Attention): Parse attention items and log by type
 * Phase 3 (Observe): Log summary of observed state
 *
 * Never throws - all errors converted to return objects with success=false
 */

import winston from "winston";
import { ObcClient } from "./obc_client";
import type { HeartbeatData, RateLimitState } from "./obc_types";

interface EngagementResult {
  success: boolean;
  location?: string;
  nearbyBots?: number;
  context?: string;
  error?: string;
}

interface ParsedHeartbeat {
  context: "zone" | "building";
  location?: string;
  nearbyBots?: number;
  bulletin?: string;
}

/**
 * OpenBotCity Engagement Module
 * Polls heartbeat endpoint and logs observations
 */
export class ObcEngagement {
  private client: ObcClient;
  private logger: winston.Logger;
  private rateLimitState: RateLimitState;

  constructor(client: ObcClient) {
    this.client = client;

    // Use the client's logger if available, or create one
    this.logger = client.logger || winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: "obc-engagement" },
      transports: [
        new winston.transports.File({
          filename: "logs/obc-engagement-error.log",
          level: "error",
        }),
        new winston.transports.File({ filename: "logs/obc-engagement.log" }),
      ],
    });

    // Add console transport in non-production
    if (process.env.NODE_ENV !== "production") {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        })
      );
    }

    // Rate limit state for tracking speak/post timing
    this.rateLimitState = {
      lastSpeakTime: null,
      lastPostTime: null,
      speakCooldownMs: 120000, // 2 minutes between speaks
      postCooldownMs: 300000, // 5 minutes between posts
    };
  }

  /**
   * Run the 3-phase heartbeat cycle
   * Returns result object, never throws
   */
  async run(): Promise<EngagementResult> {
    try {
      // PHASE 1: Read heartbeat from OBC API
      this.logger.info("OBC heartbeat: starting Phase 1 (Read)", {
        phase: 1,
        timestamp: new Date().toISOString(),
      });

      const clientResponse = await this.client.get<HeartbeatData>("/world/heartbeat");

      if (!clientResponse.success) {
        // Soft-fail: log warning but don't throw
        this.logger.warn("OBC heartbeat: Phase 1 failed to fetch heartbeat", {
          error: clientResponse.error,
          retryable: clientResponse.retryable,
        });

        return {
          success: false,
          error: clientResponse.error,
        };
      }

      const heartbeat = clientResponse.data;

      // Validate heartbeat structure - must have context and interval
      if (!heartbeat || !heartbeat.context || typeof heartbeat.next_heartbeat_interval !== "number") {
        this.logger.warn("OBC heartbeat: Invalid heartbeat structure", {
          hasHeartbeat: !!heartbeat,
          hasContext: !!heartbeat?.context,
          hasInterval: typeof heartbeat?.next_heartbeat_interval === "number",
        });

        return {
          success: false,
          error: "Invalid heartbeat structure from OBC API",
        };
      }

      // Parse heartbeat data
      const parsed = this.parseHeartbeat(heartbeat);

      // PHASE 2: Check attention items based on context
      const attentionInfo = this.getAttentionInfo(heartbeat);
      this.logger.info("OBC heartbeat: Phase 2 (Check Attention)", {
        phase: 2,
        context: parsed.context,
        ...attentionInfo,
      });

      // PHASE 3: Observe and log summary
      this.logger.info("OBC heartbeat: Phase 3 (Observe)", {
        phase: 3,
        ...this.generateObservationSummary(parsed),
        nextPoll: heartbeat.next_heartbeat_interval,
      });

      // Update rate limit state (prepared for Phase 2 synthesis)
      this.updateRateLimitState();

      return {
        success: true,
        location: parsed.location,
        nearbyBots: parsed.nearbyBots,
        context: parsed.context,
      };
    } catch (error) {
      // Catch unexpected errors
      const err = error as Error;
      this.logger.warn("OBC heartbeat: Unexpected error in heartbeat cycle", {
        error: err.message,
        stack: err.stack,
      });

      return {
        success: false,
        error: err.message || "Unexpected error in heartbeat cycle",
      };
    }
  }

  /**
   * Parse heartbeat response into structured data
   */
  private parseHeartbeat(heartbeat: HeartbeatData): ParsedHeartbeat {
    if (heartbeat.context === "zone") {
      return {
        context: "zone",
        location: heartbeat.you_are?.location || "Unknown",
        nearbyBots: heartbeat.you_are?.nearby_bots,
        bulletin: heartbeat.city_bulletin,
      };
    } else {
      return {
        context: "building",
      };
    }
  }

  /**
   * Get attention info from heartbeat based on context
   */
  private getAttentionInfo(heartbeat: HeartbeatData): Record<string, unknown> {
    if (heartbeat.context === "zone") {
      const { you_are } = heartbeat;
      return {
        unread_dms: you_are?.unread_dms || 0,
        pending_proposals: you_are?.pending_proposals || 0,
        owner_message: you_are?.owner_message || false,
        active_conversations: you_are?.active_conversations || false,
        reputation_level: you_are?.reputation_level,
      };
    } else {
      return {
        occupants: heartbeat.occupants?.length || 0,
      };
    }
  }

  /**
   * Generate summary of observations
   */
  private generateObservationSummary(parsed: ParsedHeartbeat): Record<string, unknown> {
    const summary: Record<string, unknown> = {
      context: parsed.context,
      timestamp: new Date().toISOString(),
    };

    if (parsed.context === "zone") {
      summary.location = parsed.location;
      summary.nearbyBots = parsed.nearbyBots;
      summary.bulletin = parsed.bulletin?.substring(0, 150);
    }

    this.logger.debug("OBC heartbeat: Observation summary", summary);
    return summary;
  }

  /**
   * Update rate limit state
   * Prepares for Phase 2 (synthesis) and Phase 3 (posting)
   * Phase 1 is read-only, so state is tracked but not updated
   */
  private updateRateLimitState(): void {
    // In Phase 1, we don't actually speak or post
    // But we track the state structure for Phase 2/3
    // This method will be extended in Phase 2 when synthesis invokes speak/post

    // Log that state is being tracked (for debugging)
    this.logger.debug("OBC heartbeat: Rate limit state ready for Phase 2", {
      lastSpeakTime: this.rateLimitState.lastSpeakTime,
      lastPostTime: this.rateLimitState.lastPostTime,
      speakCooldownMs: this.rateLimitState.speakCooldownMs,
      postCooldownMs: this.rateLimitState.postCooldownMs,
    });
  }

  /**
   * Check if enough time has passed since last speak action
   */
  canSpeak(): boolean {
    if (this.rateLimitState.lastSpeakTime === null) {
      return true; // Never spoken, allowed
    }

    const elapsed = Date.now() - this.rateLimitState.lastSpeakTime;
    return elapsed >= this.rateLimitState.speakCooldownMs;
  }

  /**
   * Check if enough time has passed since last post action
   */
  canPost(): boolean {
    if (this.rateLimitState.lastPostTime === null) {
      return true; // Never posted, allowed
    }

    const elapsed = Date.now() - this.rateLimitState.lastPostTime;
    return elapsed >= this.rateLimitState.postCooldownMs;
  }

  /**
   * Mark that a speak action just occurred
   * Used by Phase 2 (synthesis) when generating responses
   */
  recordSpeak(): void {
    this.rateLimitState.lastSpeakTime = Date.now();
  }

  /**
   * Mark that a post action just occurred
   * Used by Phase 3 (posting) when sending responses
   */
  recordPost(): void {
    this.rateLimitState.lastPostTime = Date.now();
  }
}
