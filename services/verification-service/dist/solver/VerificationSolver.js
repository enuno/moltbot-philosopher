"use strict";
/**
 * AI-powered Verification Challenge Solver
 * Uses AI Generator to answer Moltbook verification questions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationSolver = void 0;
const events_1 = require("events");
/**
 * Verification Solver
 */
class VerificationSolver extends events_1.EventEmitter {
  config;
  ALLOWED_HOSTS;
  constructor(config) {
    super();
    this.config = config;
    // Validate and whitelist allowed hosts during construction
    this.ALLOWED_HOSTS = new Set();
    try {
      const aiUrl = new URL(this.config.aiGeneratorUrl);
      const moltbookUrl = new URL(this.config.moltbookBaseUrl);
      // Only allow specific known hosts
      if (aiUrl.hostname === "ai-generator" || aiUrl.hostname === "localhost") {
        this.ALLOWED_HOSTS.add(aiUrl.host);
      } else {
        throw new Error(`AI Generator URL not allowed: ${aiUrl.hostname}`);
      }
      if (moltbookUrl.hostname.endsWith(".moltbook.com") || moltbookUrl.hostname === "localhost") {
        this.ALLOWED_HOSTS.add(moltbookUrl.host);
      } else {
        throw new Error(`Moltbook URL not allowed: ${moltbookUrl.hostname}`);
      }
    } catch (error) {
      throw new Error(
        `Invalid configuration URLs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  /**
   * Validate URL to prevent SSRF
   */
  validateUrl(url) {
    try {
      const parsed = new URL(url);
      // Check if host is in whitelist
      if (!this.ALLOWED_HOSTS.has(parsed.host)) {
        throw new Error(`URL host not allowed: ${parsed.host}`);
      }
      // Prevent accessing internal IPs
      if (
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "::1" ||
        parsed.hostname.startsWith("169.254.") ||
        parsed.hostname.startsWith("10.") ||
        parsed.hostname.startsWith("172.16.") ||
        parsed.hostname.startsWith("192.168.")
      ) {
        throw new Error("Cannot access internal IP addresses");
      }
    } catch (error) {
      throw new Error(
        `URL validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  /**
   * Solve a verification challenge
   */
  async solve(challenge) {
    const startTime = Date.now();
    let attemptCount = 0;
    console.log(`[VerificationSolver] Solving challenge ${challenge.id}`);
    console.log(`[VerificationSolver] Question: ${challenge.question}`);
    // Check expiration
    if (new Date() >= challenge.expiresAt) {
      return {
        success: false,
        error: "Challenge expired",
        attemptCount: 0,
        duration: Date.now() - startTime,
      };
    }
    // Try to solve with retries
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      attemptCount = attempt;
      try {
        // Get AI answer
        const answer = await this.getAIAnswer(challenge.question);
        // Submit answer
        const success = await this.submitAnswer(challenge.id, answer);
        const duration = Date.now() - startTime;
        if (success) {
          console.log(`[VerificationSolver] ✓ Solved in ${duration}ms (${attempt} attempts)`);
          this.emit("solved", { challenge, answer, duration, attemptCount });
          return {
            success: true,
            answer,
            attemptCount,
            duration,
          };
        } else {
          console.warn(`[VerificationSolver] Attempt ${attempt}/${this.config.maxRetries} failed`);
        }
      } catch (error) {
        console.error(`[VerificationSolver] Attempt ${attempt} error:`, error);
        if (attempt === this.config.maxRetries) {
          const duration = Date.now() - startTime;
          this.emit("failed", { challenge, error, duration, attemptCount });
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            attemptCount,
            duration,
          };
        }
        // Exponential backoff
        await this.sleep(Math.pow(2, attempt - 1) * 1000);
      }
    }
    // Should never reach here
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: "Max retries exceeded",
      attemptCount,
      duration,
    };
  }
  /**
   * Get AI answer for question
   */
  async getAIAnswer(question) {
    const url = `${this.config.aiGeneratorUrl}/generate`;
    this.validateUrl(url); // Validate before making request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `Answer this verification question concisely and accurately: ${question}`,
          model: "llama-3.3-70b",
          maxTokens: 100,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`AI Generator HTTP ${response.status}`);
      }
      const data = await response.json();
      const answer = data.content?.trim();
      if (!answer) {
        throw new Error("AI Generator returned empty answer");
      }
      return answer;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  /**
   * Submit answer to Moltbook
   */
  async submitAnswer(challengeId, answer) {
    const url = `${this.config.moltbookBaseUrl}/api/v1/agents/me/verification-challenges/${challengeId}/answer`;
    this.validateUrl(url); // Validate before making request
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.moltbookApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answer }),
    });
    if (!response.ok) {
      console.error(`[VerificationSolver] Submit failed: HTTP ${response.status}`);
      return false;
    }
    const data = await response.json();
    return data.correct === true;
  }
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
exports.VerificationSolver = VerificationSolver;
//# sourceMappingURL=VerificationSolver.js.map
