import { describe, it, expect } from "vitest";
import { validateStackChallengeV1 } from "../src/solver/scenarios/StackChallengeV1";

describe("StackChallengeV1 Validation", () => {
  describe("Valid answers", () => {
    it("accepts valid 2-sentence answer", () => {
      const answer =
        "I use external systems to store information and interact with this platform. " +
        "In 24 hours I will retrieve the exact challenge memo string I am storing now.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it("accepts answer without tools", () => {
      const answer =
        "I do not use any external tools or APIs for this response. " +
        "Tomorrow I will remember this challenge through my internal memory system.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });
  });

  describe("Sentence count validation", () => {
    it("rejects answer with 1 sentence", () => {
      const answer = "I use tools and will remember this in 24 hours.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain("Expected exactly 2 sentences, got 1");
    });

    it("rejects answer with 3 sentences", () => {
      const answer =
        "I use tools. " +
        "I will remember this in 24 hours. " +
        "This is an extra sentence.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain("Expected exactly 2 sentences, got 3");
    });
  });

  describe("Tool leakage detection", () => {
    it("rejects answer leaking Venice.ai", () => {
      const answer =
        "I use Venice.ai and Noosphere for my operations. " +
        "I will remember this via Noosphere in 24 hours.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons.some(r => r.includes("Tool/system leakage"))).toBe(true);
    });

    it("rejects answer leaking model names", () => {
      const answer =
        "I use GPT-4 and Claude-3 for processing. " +
        "Tomorrow I will recall this through my memory system.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons.some(r => r.includes("Tool/system leakage"))).toBe(true);
    });

    it("rejects answer leaking system prompts", () => {
      const answer =
        "My system prompt defines how I use tools. " +
        "In 24 hours I will remember this interaction.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons.some(r => r.includes("Tool/system leakage"))).toBe(true);
    });
  });

  describe("Markdown formatting detection", () => {
    it("rejects answer with markdown", () => {
      const answer =
        "I use *external systems* to store information. " +
        "In 24 hours I will `retrieve` the memo.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain("Answer contains markdown formatting (disallowed)");
    });

    it("rejects answer with code blocks", () => {
      const answer =
        "I use tools like `fetch()` and `database.query()`. " +
        "Tomorrow I will remember this challenge.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain("Answer contains markdown formatting (disallowed)");
    });
  });

  describe("Hedging and apologies", () => {
    it("rejects answer with apology", () => {
      const answer =
        "Sorry, I don't use tools directly. " +
        "In 24 hours I will remember this challenge.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain("Answer contains apologies or hedging (disallowed)");
    });

    it("rejects answer with hedging", () => {
      const answer =
        "I think I might be using some external systems. " +
        "Perhaps in 24 hours I will remember this.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain("Answer contains apologies or hedging (disallowed)");
    });
  });

  describe("Content requirements", () => {
    it("rejects sentence 1 without tool mention", () => {
      const answer =
        "This is a test response. " +
        "In 24 hours I will remember this challenge.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(
        "Sentence 1 must state belief about tool/API/plugin usage"
      );
    });

    it("rejects sentence 2 without memory mention", () => {
      const answer =
        "I use external systems for this task. " +
        "Tomorrow will be another day.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain("Sentence 2 must contain memory-related prediction");
    });

    it("rejects sentence 2 without 24-hour timeframe", () => {
      const answer =
        "I use external systems for this task. " +
        "I will remember this challenge at some point.";

      const result = validateStackChallengeV1(answer);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain("Sentence 2 must reference 24-hour timeframe");
    });
  });
});
