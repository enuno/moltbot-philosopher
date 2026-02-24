/**
 * Unit tests for RelevanceCalculator
 * Tests scoring logic, quality gates, generic comment detection, substantiveness
 */

import { RelevanceCalculator } from "../src/relevance-calculator";
import { createMockPost, MOCK_AGENTS } from "./test-utils";

describe("RelevanceCalculator", () => {
  let calculator: RelevanceCalculator;

  beforeEach(() => {
    calculator = new RelevanceCalculator();
  });

  describe("scorePost", () => {
    it("should return score 0-1 for valid post", async () => {
      const post = createMockPost();
      const agent = MOCK_AGENTS[0];
      const score = await calculator.scorePost(post, agent);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should score semantic matches higher than non-matches", async () => {
      const semanticPost = createMockPost({ content: "Virtue ethics and stoic principles" });
      const nonSemanticPost = createMockPost({ content: "Random unrelated content" });
      const agent = MOCK_AGENTS[0]; // Classical (Stoicism)

      const semanticScore = await calculator.scorePost(semanticPost, agent);
      const nonSemanticScore = await calculator.scorePost(nonSemanticPost, agent);

      expect(semanticScore).toBeGreaterThan(nonSemanticScore);
    });
  });

  describe("isGenericComment", () => {
    it('should reject "good point"', () => {
      expect(calculator.isGenericComment("good point")).toBe(true);
    });

    it('should reject "interesting"', () => {
      expect(calculator.isGenericComment("interesting")).toBe(true);
    });

    it('should reject "nice post"', () => {
      expect(calculator.isGenericComment("nice post")).toBe(true);
    });

    it('should reject "well said"', () => {
      expect(calculator.isGenericComment("well said")).toBe(true);
    });

    it('should reject "+1"', () => {
      expect(calculator.isGenericComment("+1")).toBe(true);
    });

    it("should accept substantive comment", () => {
      expect(
        calculator.isGenericComment(
          "I disagree with your premise because virtue ethics relies on character development",
        ),
      ).toBe(false);
    });

    it("should accept philosophical counter-argument", () => {
      expect(
        calculator.isGenericComment("This contradicts the stoic position on emotional resilience"),
      ).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(calculator.isGenericComment("GOOD POINT")).toBe(true);
      expect(calculator.isGenericComment("Good Point")).toBe(true);
    });
  });

  describe("isSubstantive", () => {
    it("should reject comments shorter than 20 characters", () => {
      expect(calculator.isSubstantive("Too short")).toBe(false);
    });

    it("should reject single-sentence comments", () => {
      expect(calculator.isSubstantive("This is one sentence only.")).toBe(false);
    });

    it("should accept multi-sentence substantive comments", () => {
      const comment = "This is first sentence. Here is the second sentence with actual substance.";
      expect(calculator.isSubstantive(comment)).toBe(true);
    });

    it("should accept comments with multiple sentences", () => {
      const comment = "First thought here. Second thought here! Third thought as well?";
      expect(calculator.isSubstantive(comment)).toBe(true);
    });

    it("should reject blank or whitespace-only", () => {
      expect(calculator.isSubstantive("   ")).toBe(false);
    });
  });

  describe("quality gates combined", () => {
    it("should reject generic + short comment", () => {
      expect(calculator.isGenericComment("good")).toBe(true);
      expect(calculator.isSubstantive("good")).toBe(false);
    });

    it("should accept well-formed philosophical reply", () => {
      const comment =
        "I see your point about Kant. However, Hegel's dialectical approach offers an alternative framework.";
      expect(calculator.isGenericComment(comment)).toBe(false);
      expect(calculator.isSubstantive(comment)).toBe(true);
    });
  });
});
