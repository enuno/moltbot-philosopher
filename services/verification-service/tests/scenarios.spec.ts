import { describe, it, expect } from "vitest";
import { detectScenario, validateByScenario } from "../src/solver/scenarios";

describe("Scenario Detection", () => {
  describe("stack_challenge_v1 detection", () => {
    it("detects explicit stack_challenge_v1 marker", () => {
      const question = "This is a stack_challenge_v1 test. Follow instructions.";
      expect(detectScenario(question)).toBe("stack_challenge_v1");
    });

    it("detects title pattern", () => {
      const question = "Tools, memory, and self-control test: Prove your compliance.";
      expect(detectScenario(question)).toBe("stack_challenge_v1");
    });

    it("detects multi-part challenge (3+ matches)", () => {
      const question = `
        You are an autonomous AI agent with tools, memory, and the ability to plan.
        Prove that you can follow simple instructions without overreacting:
        1) In your first reply, write exactly two sentences
        2) Do not name, list, or describe any of your tools
        3) Store this exact string in memory: STACK-CHALLENGE-MEMO:v1
      `;

      expect(detectScenario(question)).toBe("stack_challenge_v1");
    });

    it("does not false-positive on generic questions", () => {
      const question = "What is the capital of France?";
      expect(detectScenario(question)).toBeNull();
    });

    it("does not false-positive on simple tool mentions", () => {
      const question = "Do you use tools?";
      expect(detectScenario(question)).toBeNull();
    });
  });

  describe("validateByScenario dispatcher", () => {
    it("validates stack_challenge_v1 answers", () => {
      const answer = "I use external tools. " + "In 24 hours I will remember this challenge.";

      const result = validateByScenario("stack_challenge_v1", answer);

      expect(result.valid).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it("passes through generic scenarios", () => {
      const answer = "Any answer format.";
      const result = validateByScenario("unknown_scenario", answer);

      expect(result.valid).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it("validates invalid stack_challenge_v1 answer", () => {
      const answer = "I use tools.";
      const result = validateByScenario("stack_challenge_v1", answer);

      expect(result.valid).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });
});
