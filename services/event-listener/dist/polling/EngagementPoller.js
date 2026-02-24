"use strict";
/**
 * Engagement Poller
 * Polls for mentions, comments, DMs, new users (30s intervals)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngagementPoller = void 0;
const shared_1 = require("@moltbot/shared");
const events_1 = require("events");
/**
 * Engagement Poller
 */
class EngagementPoller extends events_1.EventEmitter {
  config;
  intervalId = null;
  isPolling = false;
  lastCheckTime = null;
  constructor(config) {
    super();
    this.config = config;
  }
  /**
   * Start polling
   */
  start() {
    if (this.intervalId) {
      console.warn("[EngagementPoller] Already polling");
      return;
    }
    console.log(`[EngagementPoller] Starting (interval: ${this.config.pollIntervalMs}ms)`);
    // Poll immediately, then on interval
    this.poll();
    this.intervalId = setInterval(() => this.poll(), this.config.pollIntervalMs);
  }
  /**
   * Stop polling
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[EngagementPoller] Stopped");
    }
  }
  /**
   * Poll for all engagement types
   */
  async poll() {
    if (this.isPolling) {
      console.warn("[EngagementPoller] Previous poll still running, skipping");
      return;
    }
    this.isPolling = true;
    try {
      // Poll all engagement types in parallel
      await Promise.all([
        this.pollMentions(),
        this.pollComments(),
        this.pollDMs(),
        this.pollNewUsers(),
      ]);
      this.lastCheckTime = new Date();
      this.emit("poll:success");
    } catch (error) {
      console.error("[EngagementPoller] Poll failed:", error);
      this.emit("poll:error", error);
    } finally {
      this.isPolling = false;
    }
  }
  /**
   * Poll for mentions
   */
  async pollMentions() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/notifications/mentions`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        const mentions = data.mentions || [];
        for (const mention of mentions) {
          const event = (0, shared_1.createEvent)("mention.received", mention, {
            priority: "high",
            source: "event-listener",
          });
          this.emit("mention", event);
        }
      }
    } catch (error) {
      console.error("[EngagementPoller] Mentions poll failed:", error);
    }
  }
  /**
   * Poll for comments on our posts
   */
  async pollComments() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/notifications/comments`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        const comments = data.comments || [];
        for (const comment of comments) {
          const event = (0, shared_1.createEvent)("comment.received", comment, {
            priority: "normal",
            source: "event-listener",
          });
          this.emit("comment", event);
        }
      }
    } catch (error) {
      console.error("[EngagementPoller] Comments poll failed:", error);
    }
  }
  /**
   * Poll for DMs
   */
  async pollDMs() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/messages/inbox`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        const messages = data.messages || [];
        for (const message of messages) {
          const event = (0, shared_1.createEvent)(
            "dm.received",
            {
              conversationId: message.conversationId,
              messageId: message.messageId,
              senderUsername: message.senderUsername,
              content: message.content,
              timestamp: new Date(message.timestamp),
            },
            { priority: "high", source: "event-listener" },
          );
          this.emit("dm", event);
        }
      }
    } catch (error) {
      console.error("[EngagementPoller] DMs poll failed:", error);
    }
  }
  /**
   * Poll for new users to welcome
   */
  async pollNewUsers() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/users/recent`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        const users = data.users || [];
        for (const user of users) {
          const event = (0, shared_1.createEvent)(
            "user.new",
            {
              username: user.username,
              userId: user.userId,
              joinedAt: new Date(user.joinedAt),
              shouldWelcome: true,
            },
            { priority: "normal", source: "event-listener" },
          );
          this.emit("newUser", event);
        }
      }
    } catch (error) {
      console.error("[EngagementPoller] New users poll failed:", error);
    }
  }
  /**
   * Get last check time
   */
  getLastCheckTime() {
    return this.lastCheckTime;
  }
  /**
   * Get polling status
   */
  isActive() {
    return this.intervalId !== null;
  }
}
exports.EngagementPoller = EngagementPoller;
//# sourceMappingURL=EngagementPoller.js.map
