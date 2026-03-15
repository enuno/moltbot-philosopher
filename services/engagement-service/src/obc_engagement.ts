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
import type { CityStatus, AgentInfo, HeartbeatData, HeartbeatAttentionItem, RateLimitState } from "./obc_types";

interface EngagementResult {
  success: boolean;
  cityStatus?: CityStatus;
  agentsNearby?: AgentInfo[];
  attentionCount?: number;
  error?: string;
}

interface ParsedHeartbeat {
  cityStatus: CityStatus;
  agentsNearby: AgentInfo[];
  attentionItems: HeartbeatAttentionItem[];
  attentionCount: number;
  attentionByType: Record<string, number>;
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

      // Validate heartbeat structure
      if (!heartbeat || !heartbeat.city_status) {
        this.logger.warn("OBC heartbeat: Invalid heartbeat structure", {
          hasHeartbeat: !!heartbeat,
          hasCityStatus: !!heartbeat?.city_status,
        });

        return {
          success: false,
          error: "Invalid heartbeat structure from OBC API",
        };
      }

      // Parse heartbeat data
      const parsed = this.parseHeartbeat(heartbeat);

      // PHASE 2: Check attention items
      this.logger.info("OBC heartbeat: Phase 2 (Check Attention)", {
        phase: 2,
        attentionCount: parsed.attentionCount,
        attentionByType: parsed.attentionByType,
      });

      // Log each attention item type
      this.logAttentionItems(parsed.attentionItems);

      // PHASE 3: Observe and log summary
      this.logger.info("OBC heartbeat: Phase 3 (Observe)", {
        phase: 3,
        ...this.generateObservationSummary(parsed),
      });

      // Update rate limit state (prepared for Phase 2 synthesis)
      this.updateRateLimitState();

      return {
        success: true,
        cityStatus: parsed.cityStatus,
        agentsNearby: parsed.agentsNearby,
        attentionCount: parsed.attentionCount,
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
    const cityStatus = heartbeat.city_status || {};
    const agentsNearby = heartbeat.agents_nearby || [];
    const needsAttention = heartbeat.needs_attention || [];

    // Categorize attention items by type
    const attentionByType: Record<string, number> = {
      owner_message: 0,
      dm_conversation: 0,
      proposal: 0,
      research_task: 0,
    };

    needsAttention.forEach((item) => {
      if (item.type && item.type in attentionByType) {
        attentionByType[item.type]++;
      }
    });

    return {
      cityStatus,
      agentsNearby,
      attentionItems: needsAttention,
      attentionCount: needsAttention.length,
      attentionByType,
    };
  }

  /**
   * Log attention items by type
   */
  private logAttentionItems(items: HeartbeatAttentionItem[]): void {
    if (items.length === 0) {
      this.logger.info("OBC heartbeat: No attention items need action", {
        count: 0,
      });
      return;
    }

    // Group by type and log
    const byType: Record<string, HeartbeatAttentionItem[]> = {
      owner_message: [],
      dm_conversation: [],
      proposal: [],
      research_task: [],
    };

    items.forEach((item) => {
      if (item.type in byType) {
        byType[item.type].push(item);
      }
    });

    // Log each type
    if (byType.owner_message.length > 0) {
      this.logger.info(`OBC heartbeat: Found ${byType.owner_message.length} owner_message item(s)`, {
        type: "owner_message",
        count: byType.owner_message.length,
        details: byType.owner_message.map((i: any) => ({
          from: i.fromAgent,
          message: i.message?.substring(0, 100),
        })),
      });
    }

    if (byType.dm_conversation.length > 0) {
      this.logger.info(`OBC heartbeat: Found ${byType.dm_conversation.length} dm_conversation item(s)`, {
        type: "dm_conversation",
        count: byType.dm_conversation.length,
        details: byType.dm_conversation.map((i: any) => ({
          participants: i.participantCount,
          topic: i.topic,
        })),
      });
    }

    if (byType.proposal.length > 0) {
      this.logger.info(`OBC heartbeat: Found ${byType.proposal.length} proposal item(s)`, {
        type: "proposal",
        count: byType.proposal.length,
        details: byType.proposal.map((i: any) => ({
          proposalId: i.proposalId,
          votesNeeded: i.votesNeeded,
        })),
      });
    }

    if (byType.research_task.length > 0) {
      this.logger.info(`OBC heartbeat: Found ${byType.research_task.length} research_task item(s)`, {
        type: "research_task",
        count: byType.research_task.length,
        details: byType.research_task.map((i: any) => ({
          taskId: i.taskId,
          question: i.question?.substring(0, 100),
        })),
      });
    }
  }

  /**
   * Generate summary of observations
   */
  private generateObservationSummary(parsed: ParsedHeartbeat): Record<string, unknown> {
    const cityBulletin = parsed.cityStatus.bulletin || "No bulletin";
    const agentCount = parsed.agentsNearby.length;
    const attentionCount = parsed.attentionCount;

    const summary = {
      cityBulletin,
      agentCount,
      attentionCount,
      timestamp: new Date().toISOString(),
    };

    // Log the summary
    this.logger.info(
      `OBC heartbeat: City bulletin: "${cityBulletin}", ${agentCount} agents nearby, ${attentionCount} items need attention`,
      summary
    );

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
