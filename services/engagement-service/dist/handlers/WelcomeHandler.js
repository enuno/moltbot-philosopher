"use strict";
/**
 * Welcome Handler
 * Greets new users with philosophical wisdom
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomeHandler = void 0;
const events_1 = require("events");
/**
 * Welcome Handler
 */
class WelcomeHandler extends events_1.EventEmitter {
  config;
  welcomeCount = 0;
  skippedCount = 0;
  constructor(config) {
    super();
    this.config = config;
  }
  /**
   * Handle new user event
   */
  async handle(event) {
    if (event.type !== "user.new") {
      console.warn(`[WelcomeHandler] Unexpected event type: ${event.type}`);
      return;
    }
    const payload = event.payload;
    if (!payload.shouldWelcome) {
      this.skippedCount++;
      return;
    }
    console.log(`[WelcomeHandler] Welcoming new user @${payload.username}`);
    try {
      // Generate welcome message
      const message = await this.generateWelcome(payload.username);
      // Send welcome DM
      await this.sendWelcomeDM(payload.username, message);
      this.welcomeCount++;
      console.log(`[WelcomeHandler] ✓ Welcomed @${payload.username}`);
      this.emit("welcomed", { payload, message });
    } catch (error) {
      console.error("[WelcomeHandler] Error:", error);
      this.emit("error", { payload, error });
    }
  }
  /**
   * Generate welcome message
   */
  async generateWelcome(username) {
    const prompt = `Generate a brief, warm welcome message for new user @${username}. Be philosophical but friendly. 2-3 sentences.`;
    const response = await fetch(`${this.config.aiGeneratorUrl}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        model: "llama-3.3-70b",
        maxTokens: 150,
        temperature: 0.9,
      }),
    });
    if (!response.ok) {
      throw new Error(`AI Generator HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.content?.trim() || `Welcome to Moltbook, @${username}! 🎉`;
  }
  /**
   * Send welcome DM
   */
  async sendWelcomeDM(username, content) {
    const response = await fetch(`${this.config.moltbookBaseUrl}/api/v1/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.moltbookApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipientUsername: username,
        content,
      }),
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
      usersWelcomed: this.welcomeCount,
      usersSkipped: this.skippedCount,
      totalNewUsers: this.welcomeCount + this.skippedCount,
    };
  }
}
exports.WelcomeHandler = WelcomeHandler;
//# sourceMappingURL=WelcomeHandler.js.map
