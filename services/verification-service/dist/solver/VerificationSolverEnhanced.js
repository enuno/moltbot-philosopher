"use strict";
/**
 * Scenario-Aware Verification Challenge Solver
 *
 * Enhancements over base solver:
 * - Detects challenge scenarios (stack_challenge_v1, etc.)
 * - Validates responses against scenario rules
 * - Structured logging for production observability
 * - Per-scenario metrics tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationSolverEnhanced = void 0;
const events_1 = require("events");
const scenarios_1 = require("./scenarios");
const logger_1 = require("../utils/logger");
class VerificationSolverEnhanced extends events_1.EventEmitter {
  config;
  ALLOWED_HOSTS;
  constructor(config) {
    super();
    this.config = config;
    // Validate and whitelist allowed hosts
    this.ALLOWED_HOSTS = new Set();
    try {
      const aiUrl = new URL(this.config.aiGeneratorUrl);
      const moltbookUrl = new URL(this.config.moltbookBaseUrl);
      // Allow internal Docker services and localhost
      if (
        aiUrl.hostname === "ai-generator" ||
        aiUrl.hostname === "moltbot-ai-generator" ||
        aiUrl.hostname === "localhost" ||
        aiUrl.hostname === "127.0.0.1"
      ) {
        this.ALLOWED_HOSTS.add(aiUrl.host);
      } else {
        throw new Error(`AI Generator URL not allowed: ${aiUrl.hostname}`);
      }
      if (
        moltbookUrl.hostname.endsWith(".moltbook.com") ||
        moltbookUrl.hostname === "egress-proxy" ||
        moltbookUrl.hostname === "localhost"
      ) {
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
      // Block specific local TLDs
      if (/\.(local|internal|lan)$/i.test(parsed.hostname)) {
        throw new Error(`URL host not allowed (local TLD): ${parsed.hostname}`);
      }
      // Prevent accessing internal IPs (except whitelisted services)
      if (
        parsed.hostname !== "localhost" &&
        parsed.hostname !== "127.0.0.1" &&
        (parsed.hostname === "::1" ||
          parsed.hostname.startsWith("169.254.") ||
          parsed.hostname.startsWith("10.") ||
          parsed.hostname.startsWith("172.16.") ||
          parsed.hostname.startsWith("192.168."))
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
   * Solve a verification challenge with scenario detection and validation
   */
  async solve(challenge) {
    const startTime = Date.now();
    let attemptCount = 0;
    (0, logger_1.logInfo)("Solving challenge", {
      service: "verification-service",
      challengeId: challenge.id,
    });
    // Expiration check
    const expiresAt =
      typeof challenge.expiresAt === "string" ? new Date(challenge.expiresAt) : challenge.expiresAt;
    if (new Date() >= expiresAt) {
      return {
        success: false,
        error: "Challenge expired",
        attemptCount: 0,
        duration: Date.now() - startTime,
      };
    }
    // Scenario detection
    const scenario = (0, scenarios_1.detectScenario)(challenge.question);
    (0, logger_1.logInfo)("Scenario detected", {
      service: "verification-service",
      challengeId: challenge.id,
      scenario: scenario || "generic",
    });
    // Retry loop
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      attemptCount = attempt;
      try {
        // Augment question for scenario
        const questionForAI = scenario
          ? `${challenge.question}\n\nYou must strictly follow all constraints described above. Be concise and compliant.`
          : challenge.question;
        // Get AI answer
        const answer = await this.getAIAnswer(questionForAI);
        // Validate against scenario
        const validation = scenario
          ? (0, scenarios_1.validateByScenario)(scenario, answer)
          : { valid: true, reasons: [] };
        if (!validation.valid) {
          (0, logger_1.logWarn)("Validation failed", {
            service: "verification-service",
            challengeId: challenge.id,
            scenario: scenario ?? undefined,
            attempt,
            reasons: validation.reasons,
          });
          if (attempt === this.config.maxRetries) {
            const duration = Date.now() - startTime;
            this.emit("failed", challenge, validation.reasons, duration, attemptCount);
            return {
              success: false,
              error: `Scenario validation failed: ${validation.reasons.join("; ")}`,
              attemptCount,
              duration,
              scenario: scenario ?? undefined,
              validation: { scenario: scenario ?? "unknown", ...validation },
            };
          }
          // Retry with exponential backoff
          await this.sleep(Math.pow(2, attempt - 1) * 1000);
          continue;
        }
        // Submit answer
        const success = await this.submitAnswer(challenge.id, answer);
        const duration = Date.now() - startTime;
        if (success) {
          (0, logger_1.logInfo)("Challenge solved", {
            service: "verification-service",
            challengeId: challenge.id,
            scenario: scenario ?? undefined,
            duration,
            attempts: attempt,
          });
          this.emit("solved", challenge, answer, duration, attemptCount);
          return {
            success: true,
            answer,
            attemptCount,
            duration,
            scenario: scenario ?? undefined,
            validation: { scenario: scenario ?? "unknown", ...validation },
          };
        }
        // Check if this was the last attempt
        if (attempt === this.config.maxRetries) {
          (0, logger_1.logError)("Max retries exhausted", {
            service: "verification-service",
            challengeId: challenge.id,
          });
          this.emit("failed", challenge, "Max retries exceeded", duration, attemptCount);
          return {
            success: false,
            error: "Max retries exceeded",
            attemptCount,
            duration,
          };
        }
        (0, logger_1.logWarn)("Answer submission failed", {
          service: "verification-service",
          challengeId: challenge.id,
          attempt,
          maxRetries: this.config.maxRetries,
        });
      } catch (error) {
        (0, logger_1.logError)("Solve attempt error", {
          service: "verification-service",
          challengeId: challenge.id,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
        if (attempt === this.config.maxRetries) {
          const duration = Date.now() - startTime;
          this.emit("failed", challenge, error, duration, attemptCount);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            attemptCount,
            duration,
          };
        }
      }
      await this.sleep(Math.pow(2, attempt - 1) * 1000);
    }
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
    this.validateUrl(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `Answer this verification question concisely and accurately:\n\n${question}\n\nAnswer:`,
          model: "deepseek-v3",
          maxTokens: 200,
          temperature: 0.1, // Low temp for compliance
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`AI Generator HTTP ${response.status}`);
      }
      const data = await response.json();
      const answer = (data.content || data.text)?.trim();
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
    const url = `${this.config.moltbookBaseUrl}/agents/verification/submit`;
    this.validateUrl(url);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.moltbookApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ challengeId, answer }),
    });
    if (!response.ok) {
      (0, logger_1.logError)("Submit failed", {
        service: "verification-service",
        challengeId,
        status: response.status,
      });
      return false;
    }
    const data = await response.json();
    return data.success === true || data.correct === true;
  }
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
exports.VerificationSolverEnhanced = VerificationSolverEnhanced;
//# sourceMappingURL=VerificationSolverEnhanced.js.map
