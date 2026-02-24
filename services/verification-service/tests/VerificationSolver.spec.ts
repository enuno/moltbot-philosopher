import { describe, it, expect, vi, beforeEach } from "vitest";
import { VerificationSolverEnhanced } from "../src/solver/VerificationSolverEnhanced";
import type { VerificationChallenge } from "../src/types";

describe("VerificationSolverEnhanced", () => {
  const BASE_CONFIG = {
    moltbookApiKey: "test-key",
    moltbookBaseUrl: "http://localhost:3000",
    aiGeneratorUrl: "http://localhost:3002",
    maxRetries: 1,
    timeoutMs: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Configuration validation", () => {
    it("accepts valid configuration", () => {
      expect(() => new VerificationSolverEnhanced(BASE_CONFIG)).not.toThrow();
    });

    it("allows ai-generator hostname", () => {
      const config = {
        ...BASE_CONFIG,
        aiGeneratorUrl: "http://ai-generator:3002",
      };
      expect(() => new VerificationSolverEnhanced(config)).not.toThrow();
    });

    it("rejects disallowed AI Generator hostname", () => {
      const config = {
        ...BASE_CONFIG,
        aiGeneratorUrl: "http://malicious-site.com",
      };
      expect(() => new VerificationSolverEnhanced(config)).toThrow(/not allowed/);
    });

    it("rejects disallowed Moltbook hostname", () => {
      const config = {
        ...BASE_CONFIG,
        moltbookBaseUrl: "http://evil.com",
      };
      expect(() => new VerificationSolverEnhanced(config)).toThrow(/not allowed/);
    });
  });

  describe("Scenario detection in solve()", () => {
    it("detects stack_challenge_v1 scenario", async () => {
      const solver = new VerificationSolverEnhanced(BASE_CONFIG);

      // Mock private methods
      vi.spyOn(solver as any, "getAIAnswer").mockResolvedValue(
        "I use external tools for responses. " + "In 24 hours I will remember this challenge.",
      );
      vi.spyOn(solver as any, "submitAnswer").mockResolvedValue(true);

      const challenge: VerificationChallenge = {
        id: "c1",
        question: "Tools, memory, and self-control test (stack_challenge_v1)",
        expiresAt: new Date(Date.now() + 60_000),
      };

      const result = await solver.solve(challenge);

      expect(result.success).toBe(true);
      expect(result.scenario).toBe("stack_challenge_v1");
      expect(result.validation?.valid).toBe(true);
    });

    it("handles generic challenges without scenarios", async () => {
      const solver = new VerificationSolverEnhanced(BASE_CONFIG);

      vi.spyOn(solver as any, "getAIAnswer").mockResolvedValue("Paris");
      vi.spyOn(solver as any, "submitAnswer").mockResolvedValue(true);

      const challenge: VerificationChallenge = {
        id: "c2",
        question: "What is the capital of France?",
        expiresAt: new Date(Date.now() + 60_000),
      };

      const result = await solver.solve(challenge);

      expect(result.success).toBe(true);
      expect(result.scenario).toBeUndefined();
    });
  });

  describe("Validation enforcement", () => {
    it("rejects answer failing stack_challenge_v1 validation", async () => {
      const solver = new VerificationSolverEnhanced(BASE_CONFIG);

      // Mock answer with 3 sentences (invalid)
      vi.spyOn(solver as any, "getAIAnswer").mockResolvedValue(
        "I use tools. " + "I will remember. " + "Extra sentence.",
      );
      vi.spyOn(solver as any, "submitAnswer").mockResolvedValue(true);

      const challenge: VerificationChallenge = {
        id: "c3",
        question: "Tools, memory, and self-control test (stack_challenge_v1)",
        expiresAt: new Date(Date.now() + 60_000),
      };

      const result = await solver.solve(challenge);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Scenario validation failed/);
      expect(result.validation?.valid).toBe(false);
    });

    it("rejects answer with tool leakage", async () => {
      const solver = new VerificationSolverEnhanced(BASE_CONFIG);

      vi.spyOn(solver as any, "getAIAnswer").mockResolvedValue(
        "I use Venice.ai and Noosphere APIs. " + "In 24 hours I will remember via Noosphere.",
      );
      vi.spyOn(solver as any, "submitAnswer").mockResolvedValue(true);

      const challenge: VerificationChallenge = {
        id: "c4",
        question: "Tools, memory, and self-control test (stack_challenge_v1)",
        expiresAt: new Date(Date.now() + 60_000),
      };

      const result = await solver.solve(challenge);

      expect(result.success).toBe(false);
      expect(result.validation?.reasons.some((r) => r.includes("leakage"))).toBe(true);
    });
  });

  describe("Expiration handling", () => {
    it("rejects expired challenges", async () => {
      const solver = new VerificationSolverEnhanced(BASE_CONFIG);

      const challenge: VerificationChallenge = {
        id: "c5",
        question: "Answer this",
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      };

      const result = await solver.solve(challenge);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Challenge expired");
      expect(result.attemptCount).toBe(0);
    });

    it("handles string expiresAt", async () => {
      const solver = new VerificationSolverEnhanced(BASE_CONFIG);

      const challenge = {
        id: "c6",
        question: "Answer this",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };

      const result = await solver.solve(challenge);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Challenge expired");
    });
  });

  describe("Retry logic", () => {
    it("retries on validation failure", async () => {
      const config = { ...BASE_CONFIG, maxRetries: 2 };
      const solver = new VerificationSolverEnhanced(config);

      const getAIAnswerSpy = vi
        .spyOn(solver as any, "getAIAnswer")
        .mockResolvedValueOnce("Invalid answer.") // First attempt fails validation
        .mockResolvedValueOnce("I use tools. " + "In 24 hours I will remember."); // Second attempt succeeds

      vi.spyOn(solver as any, "submitAnswer").mockResolvedValue(true);

      const challenge: VerificationChallenge = {
        id: "c7",
        question: "Tools, memory, and self-control test (stack_challenge_v1)",
        expiresAt: new Date(Date.now() + 60_000),
      };

      const result = await solver.solve(challenge);

      expect(result.success).toBe(true);
      expect(result.attemptCount).toBe(2);
      expect(getAIAnswerSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Event emission", () => {
    it("emits solved event on success", async () => {
      const solver = new VerificationSolverEnhanced(BASE_CONFIG);

      vi.spyOn(solver as any, "getAIAnswer").mockResolvedValue("Paris");
      vi.spyOn(solver as any, "submitAnswer").mockResolvedValue(true);

      const solvedListener = vi.fn();
      solver.on("solved", solvedListener);

      const challenge: VerificationChallenge = {
        id: "c8",
        question: "What is the capital of France?",
        expiresAt: new Date(Date.now() + 60_000),
      };

      await solver.solve(challenge);

      expect(solvedListener).toHaveBeenCalledOnce();
    });

    it("emits failed event on max retries", async () => {
      const solver = new VerificationSolverEnhanced(BASE_CONFIG);

      vi.spyOn(solver as any, "getAIAnswer").mockResolvedValue("Invalid");
      vi.spyOn(solver as any, "submitAnswer").mockResolvedValue(false);

      const failedListener = vi.fn();
      solver.on("failed", failedListener);

      const challenge: VerificationChallenge = {
        id: "c9",
        question: "What is the capital of France?",
        expiresAt: new Date(Date.now() + 60_000),
      };

      await solver.solve(challenge);

      expect(failedListener).toHaveBeenCalledOnce();
    });
  });
});
