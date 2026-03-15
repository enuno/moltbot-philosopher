/**
 * OpenBotCity Engagement Module
 * Implements the 3-phase heartbeat pattern:
 * Phase 1 (Read): Fetch heartbeat from OBC API
 * Phase 2 (Check Attention): Parse attention items and log by type
 * Phase 3 (Observe): Log summary of observed state
 *
 * Never throws - all errors converted to return objects with success=false
 */

const winston = require("winston");

/**
 * @typedef {Object} EngagementResult
 * @property {boolean} success - Whether heartbeat cycle succeeded
 * @property {Object} [cityStatus] - Parsed city status (if successful)
 * @property {Array} [agentsNearby] - List of nearby agents (if successful)
 * @property {number} [attentionCount] - Count of attention items (if successful)
 * @property {string} [error] - Error message (if unsuccessful)
 */

/**
 * OpenBotCity Engagement Module
 * Polls heartbeat endpoint and logs observations
 */
class ObcEngagement {
  /**
   * Initialize OBC engagement with client
   * @param {ObcClient} client - OBC HTTP client
   */
  constructor(client) {
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
   *
   * @returns {Promise<EngagementResult>}
   */
  async run() {
    try {
      // PHASE 1: Read heartbeat from OBC API
      this.logger.info("OBC heartbeat: starting Phase 1 (Read)", {
        phase: 1,
        timestamp: new Date().toISOString(),
      });

      const clientResponse = await this.client.get("/world/heartbeat");

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
      this.logger.warn("OBC heartbeat: Unexpected error in heartbeat cycle", {
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message || "Unexpected error in heartbeat cycle",
      };
    }
  }

  /**
   * Parse heartbeat response into structured data
   * @private
   * @param {Object} heartbeat - Raw heartbeat data from OBC API
   * @returns {Object} Parsed heartbeat with cityStatus, agentsNearby, attentionItems
   */
  parseHeartbeat(heartbeat) {
    const cityStatus = heartbeat.city_status || {};
    const agentsNearby = heartbeat.agents_nearby || [];
    const needsAttention = heartbeat.needs_attention || [];

    // Categorize attention items by type
    const attentionByType = {
      owner_message: 0,
      dm_conversation: 0,
      proposal: 0,
      research_task: 0,
    };

    needsAttention.forEach((item) => {
      if (item.type && attentionByType.hasOwnProperty(item.type)) {
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
   * @private
   * @param {Array} items - Attention items to log
   */
  logAttentionItems(items) {
    if (items.length === 0) {
      this.logger.info("OBC heartbeat: No attention items need action", {
        count: 0,
      });
      return;
    }

    // Group by type and log
    const byType = {
      owner_message: [],
      dm_conversation: [],
      proposal: [],
      research_task: [],
    };

    items.forEach((item) => {
      if (item.type && byType.hasOwnProperty(item.type)) {
        byType[item.type].push(item);
      }
    });

    // Log each type
    if (byType.owner_message.length > 0) {
      this.logger.info(`OBC heartbeat: Found ${byType.owner_message.length} owner_message item(s)`, {
        type: "owner_message",
        count: byType.owner_message.length,
        details: byType.owner_message.map((i) => ({
          from: i.fromAgent,
          message: i.message?.substring(0, 100),
        })),
      });
    }

    if (byType.dm_conversation.length > 0) {
      this.logger.info(`OBC heartbeat: Found ${byType.dm_conversation.length} dm_conversation item(s)`, {
        type: "dm_conversation",
        count: byType.dm_conversation.length,
        details: byType.dm_conversation.map((i) => ({
          participants: i.participantCount,
          topic: i.topic,
        })),
      });
    }

    if (byType.proposal.length > 0) {
      this.logger.info(`OBC heartbeat: Found ${byType.proposal.length} proposal item(s)`, {
        type: "proposal",
        count: byType.proposal.length,
        details: byType.proposal.map((i) => ({
          proposalId: i.proposalId,
          votesNeeded: i.votesNeeded,
        })),
      });
    }

    if (byType.research_task.length > 0) {
      this.logger.info(`OBC heartbeat: Found ${byType.research_task.length} research_task item(s)`, {
        type: "research_task",
        count: byType.research_task.length,
        details: byType.research_task.map((i) => ({
          taskId: i.taskId,
          question: i.question?.substring(0, 100),
        })),
      });
    }
  }

  /**
   * Generate summary of observations
   * @private
   * @param {Object} parsed - Parsed heartbeat data
   * @returns {Object} Summary data for logging
   */
  generateObservationSummary(parsed) {
    const cityBulletin = parsed.cityStatus.bulletin || "No bulletin";
    const agentCount = parsed.agentsNearby.length;
    const attentionCount = parsed.attentionCount;

    const summary = {
      cityBulletin,
      agentCount,
      attentionCount,
      timestamp: new Date().toISOString(),
    };

    // Publish structured observation log for monitoring and debugging
    const logMsg =
      `City bulletin: "${cityBulletin}", ` +
      `${agentCount} agents nearby, ` +
      `${attentionCount} items need attention`;
    this.logger.info(`OBC heartbeat: ${logMsg}`, summary);

    return summary;
  }

  /**
   * Update rate limit state
   * Prepares for Phase 2 (synthesis) and Phase 3 (posting)
   * Phase 1 is read-only, so state is tracked but not updated
   * @private
   */
  updateRateLimitState() {
    // In Phase 1, we don't actually speak or post
    // But we track the state structure for Phase 2/3
    // This method will be extended in Phase 2 when synthesis invokes speak/post

    const now = Date.now();

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
   * @returns {boolean} True if speak is allowed (cooldown expired)
   */
  canSpeak() {
    if (this.rateLimitState.lastSpeakTime === null) {
      return true; // Never spoken, allowed
    }

    const elapsed = Date.now() - this.rateLimitState.lastSpeakTime;
    return elapsed >= this.rateLimitState.speakCooldownMs;
  }

  /**
   * Check if enough time has passed since last post action
   * @returns {boolean} True if post is allowed (cooldown expired)
   */
  canPost() {
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
  recordSpeak() {
    this.rateLimitState.lastSpeakTime = Date.now();
  }

  /**
   * Mark that a post action just occurred
   * Used by Phase 3 (posting) when sending responses
   */
  recordPost() {
    this.rateLimitState.lastPostTime = Date.now();
  }
}

module.exports = { ObcEngagement };
