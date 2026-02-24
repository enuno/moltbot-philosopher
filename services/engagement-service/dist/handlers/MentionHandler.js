"use strict";
/**
 * Mention Handler
 * Processes mention events with context-aware responses
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MentionHandler = void 0;
const events_1 = require("events");
/**
 * Mention Handler
 */
class MentionHandler extends events_1.EventEmitter {
  config;
  router;
  mentionCount = 0;
  responseCount = 0;
  constructor(config, router) {
    super();
    this.config = config;
    this.router = router;
  }
  /**
   * Handle mention event
   */
  async handle(event) {
    if (event.type !== "mention.received") {
      console.warn(`[MentionHandler] Unexpected event type: ${event.type}`);
      return;
    }
    const payload = event.payload;
    this.mentionCount++;
    console.log(`[MentionHandler] Processing mention from @${payload.authorUsername}`);
    console.log(`[MentionHandler] Content: ${payload.content.substring(0, 100)}...`);
    try {
      // Select agent to respond
      const agent = this.router.selectAgent({
        content: payload.content,
        authorUsername: payload.authorUsername,
        type: "mention",
      });
      console.log(`[MentionHandler] Routing to ${agent}`);
      // Generate response
      const response = await this.generateResponse(agent, payload);
      // Post response
      await this.postResponse(payload, response);
      this.responseCount++;
      console.log(`[MentionHandler] ✓ Response posted by ${agent}`);
      this.emit("responded", { payload, agent, response });
    } catch (error) {
      console.error("[MentionHandler] Error:", error);
      this.emit("error", { payload, error });
    }
  }
  /**
   * Generate AI response
   */
  async generateResponse(agent, payload) {
    const prompt = `As ${agent}, respond to this mention: "${payload.content}"`;
    const response = await fetch(`${this.config.aiGeneratorUrl}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        model: "llama-3.3-70b",
        maxTokens: 300,
        temperature: 0.8,
      }),
    });
    if (!response.ok) {
      throw new Error(`AI Generator HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.content?.trim() || "Thank you for the mention!";
  }
  /**
   * Post response to Moltbook
   */
  async postResponse(payload, content) {
    const endpoint = payload.commentId
      ? `/api/v1/posts/${payload.postId}/comments/${payload.commentId}/reply`
      : `/api/v1/posts/${payload.postId}/comments`;
    const response = await fetch(`${this.config.moltbookBaseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.moltbookApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      throw new Error(`Moltbook API HTTP ${response.status}`);
    }
  }
  /**
   * Get handler statistics
   */
  getStats() {
    return {
      mentionsReceived: this.mentionCount,
      responsesPosted: this.responseCount,
      responseRate:
        this.mentionCount > 0
          ? ((this.responseCount / this.mentionCount) * 100).toFixed(1) + "%"
          : "N/A",
    };
  }
}
exports.MentionHandler = MentionHandler;
//# sourceMappingURL=MentionHandler.js.map
