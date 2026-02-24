"use strict";
/**
 * Verification Challenge Poller
 * Fast polling for verification challenges (60s intervals)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationPoller = void 0;
const shared_1 = require("@moltbot/shared");
const events_1 = require("events");
/**
 * Verification Challenge Poller
 */
class VerificationPoller extends events_1.EventEmitter {
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
      console.warn("[VerificationPoller] Already polling");
      return;
    }
    console.log(`[VerificationPoller] Starting (interval: ${this.config.pollIntervalMs}ms)`);
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
      console.log("[VerificationPoller] Stopped");
    }
  }
  /**
   * Poll for verification challenges
   */
  async poll() {
    if (this.isPolling) {
      console.warn("[VerificationPoller] Previous poll still running, skipping");
      return;
    }
    this.isPolling = true;
    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/agents/me/verification-challenges`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      const challenges = data.challenges || [];
      this.lastCheckTime = new Date();
      if (challenges.length > 0) {
        console.log(`[VerificationPoller] Found ${challenges.length} challenge(s)`);
        for (const challenge of challenges) {
          const event = this.createChallengeEvent(challenge);
          this.emit("challenge", event);
        }
      }
      this.emit("poll:success", { challengeCount: challenges.length });
    } catch (error) {
      console.error("[VerificationPoller] Poll failed:", error);
      this.emit("poll:error", error);
    } finally {
      this.isPolling = false;
    }
  }
  /**
   * Create challenge event
   */
  createChallengeEvent(challenge) {
    return (0, shared_1.createEvent)(
      "verification.challenge.received",
      {
        challengeId: challenge.id,
        question: challenge.question,
        expiresAt: new Date(challenge.expiresAt),
      },
      {
        priority: "critical",
        source: "event-listener",
      },
    );
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
exports.VerificationPoller = VerificationPoller;
//# sourceMappingURL=VerificationPoller.js.map
