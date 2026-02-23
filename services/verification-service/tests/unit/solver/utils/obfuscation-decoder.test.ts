import { describe, it, expect } from "vitest";
import {
  detectObfuscationType,
  decodeObfuscation,
  decodeReversal,
  decodeIndexBased,
} from "../../../../src/solver/utils/obfuscation-decoder";

describe("Obfuscation Decoder", () => {
  describe("decodeReversal", () => {
    describe("basic reversals", () => {
      it("decodes reversed text: 'txet detacfusbo' -> 'obfuscated text'", () => {
        const result = decodeReversal("txet detacsufbo");
        expect(result).toBe("obfuscated text");
      });

      it("decodes reversed text: 'dlrow olleH' -> 'Hello world'", () => {
        const result = decodeReversal("dlrow olleH");
        expect(result).toBe("Hello world");
      });

      it("handles empty string", () => {
        const result = decodeReversal("");
        expect(result).toBe("");
      });

      it("handles single character", () => {
        const result = decodeReversal("a");
        expect(result).toBe("a");
      });
    });

    describe("special characters and whitespace", () => {
      it("reverses text with numbers", () => {
        const result = decodeReversal("321 tset");
        expect(result).toBe("test 123");
      });

      it("reverses text with punctuation", () => {
        const result = decodeReversal("!dlrow ,olleH");
        expect(result).toBe("Hello, world!");
      });

      it("reverses text with special characters", () => {
        const result = decodeReversal("@#$ tset");
        expect(result).toBe("test $#@");
      });

      it("preserves whitespace when reversed", () => {
        const result = decodeReversal("  dlrow  ");
        expect(result).toBe("  world  ");
      });

      it("handles multi-word reversal", () => {
        const result = decodeReversal("dlrow olleH");
        expect(result).toBe("Hello world");
      });
    });

    describe("accented characters", () => {
      it("reverses accented characters", () => {
        const result = decodeReversal("àè é");
        expect(result).toBe("é èà");
      });
    });
  });

  describe("decodeIndexBased", () => {
    describe("valid index extraction", () => {
      it("extracts characters at specified indices: [0,5,2,8]", () => {
        const result = decodeIndexBased("lobsterfarmer", [0, 5, 2, 8]);
        expect(result).toBe("leba");
      });

      it("extracts sequential indices: [0,1,2,3,4]", () => {
        const result = decodeIndexBased("philosophy", [0, 1, 2, 3, 4]);
        expect(result).toBe("philo");
      });

      it("extracts repeated indices", () => {
        const result = decodeIndexBased("test", [0, 3]);
        expect(result).toBe("tt");
      });

      it("extracts with reverse order indices", () => {
        const result = decodeIndexBased("hello", [4, 3, 2, 1, 0]);
        expect(result).toBe("olleh");
      });

      it("extracts single character", () => {
        const result = decodeIndexBased("hello", [0]);
        expect(result).toBe("h");
      });

      it("handles empty indices array", () => {
        const result = decodeIndexBased("hello", []);
        expect(result).toBe("");
      });
    });

    describe("out-of-bounds handling", () => {
      it("skips out-of-bounds indices gracefully", () => {
        const result = decodeIndexBased("test", [0, 100, 2]);
        expect(result).toBe("ts");
      });

      it("skips all out-of-bounds indices", () => {
        const result = decodeIndexBased("test", [100, 200, 300]);
        expect(result).toBe("");
      });

      it("skips negative indices gracefully", () => {
        const result = decodeIndexBased("hello", [-1, 0, 2]);
        expect(result).toBe("hl");
      });

      it("handles mixed valid and invalid indices", () => {
        const result = decodeIndexBased("philosophy", [0, 50, 1, -5, 2]);
        expect(result).toBe("phi");
      });
    });

    describe("edge cases", () => {
      it("handles empty text", () => {
        const result = decodeIndexBased("", [0, 1, 2]);
        expect(result).toBe("");
      });

      it("handles single character text", () => {
        const result = decodeIndexBased("a", [0]);
        expect(result).toBe("a");
      });

      it("handles whitespace in text", () => {
        const result = decodeIndexBased("hello world", [0, 6]);
        expect(result).toBe("hw");
      });

      it("preserves character case", () => {
        const result = decodeIndexBased("HeLLo", [0, 2, 4]);
        expect(result).toBe("HLo");
      });

      it("handles special characters in text", () => {
        const result = decodeIndexBased("h@ll0!", [0, 1, 5]);
        expect(result).toBe("h@!");
      });
    });
  });

  describe("detectObfuscationType", () => {
    describe("reversal detection", () => {
      it("detects reversed text pattern", () => {
        const result = detectObfuscationType("txet detacsufbo");
        expect(result).toBe("reversal");
      });

      it("detects short reversed text", () => {
        const result = detectObfuscationType("dlrow");
        expect(result).toBe("reversal");
      });

      it("detects reversed text with punctuation", () => {
        const result = detectObfuscationType("!dlrow ,olleH");
        expect(result).toBe("reversal");
      });

      it("detects reversed text with numbers", () => {
        const result = detectObfuscationType("321 tset");
        expect(result).toBe("reversal");
      });
    });

    describe("index-based detection", () => {
      it("detects index-based pattern: [0,5,2,8]", () => {
        const result = detectObfuscationType("[0,5,2,8]lobsterfarmer");
        expect(result).toBe("index_based");
      });

      it("detects index-based with spaces", () => {
        const result = detectObfuscationType("[0, 5, 2, 8] lobsterfarmer");
        expect(result).toBe("index_based");
      });

      it("detects index-based at end of text", () => {
        const result = detectObfuscationType("lobsterfarmer[0,5,2,8]");
        expect(result).toBe("index_based");
      });

      it("detects index-based in middle of text", () => {
        const result = detectObfuscationType(
          "lobster[0,5,2,8]farmer"
        );
        expect(result).toBe("index_based");
      });

      it("detects single-digit index pattern", () => {
        const result = detectObfuscationType("[0,2,4,6]test");
        expect(result).toBe("index_based");
      });

      it("detects multi-digit index pattern", () => {
        const result = detectObfuscationType("[10,20,30]text");
        expect(result).toBe("index_based");
      });
    });

    describe("no obfuscation", () => {
      it("returns null for normal text", () => {
        const result = detectObfuscationType("normal text");
        expect(result).toBeNull();
      });

      it("returns null for text without clear patterns", () => {
        const result = detectObfuscationType("hello world");
        expect(result).toBeNull();
      });

      it("returns null for empty string", () => {
        const result = detectObfuscationType("");
        expect(result).toBeNull();
      });

      it("returns null for single word", () => {
        const result = detectObfuscationType("test");
        expect(result).toBeNull();
      });

      it("returns null for text with brackets but no indices", () => {
        const result = detectObfuscationType("[abc]test");
        expect(result).toBeNull();
      });
    });

    describe("edge cases in detection", () => {
      it("detects reversal in case-sensitive manner", () => {
        const result = detectObfuscationType("TXET DEIFISBO");
        expect(result).toBe("reversal");
      });

      it("distinguishes between reversal and normal uppercase", () => {
        const result = detectObfuscationType("HELLO WORLD");
        expect(result).toBeNull();
      });

      it("handles mixed case reversal", () => {
        const result = detectObfuscationType("tXeT");
        expect(result).toBe("reversal");
      });

    });
  });

  describe("decodeObfuscation", () => {
    describe("automatic reversal decoding", () => {
      it("decodes detected reversal pattern", () => {
        const result = decodeObfuscation("txet detacsufbo");
        expect(result).toBe("obfuscated text");
      });

      it("decodes another reversal pattern", () => {
        const result = decodeObfuscation("dlrow olleH");
        expect(result).toBe("Hello world");
      });
    });

    describe("automatic index-based decoding", () => {
      it("decodes detected index-based pattern", () => {
        const result = decodeObfuscation("[0,5,2,8]lobsterfarmer");
        expect(result).toBe("leba");
      });

      it("decodes index pattern with spaces", () => {
        const result = decodeObfuscation("[1, 2, 3, 4, 5] philosophy");
        expect(result).toBe("philo");
      });

      it("decodes index pattern at end", () => {
        const result = decodeObfuscation("lobsterfarmer[0,5,2,8]");
        expect(result).toBe("leba");
      });
    });

    describe("no obfuscation handling", () => {
      it("returns original text if no obfuscation detected", () => {
        const result = decodeObfuscation("normal text");
        expect(result).toBe("normal text");
      });

      it("returns empty string if empty input", () => {
        const result = decodeObfuscation("");
        expect(result).toBe("");
      });
    });

    describe("integration scenarios", () => {
      it("solves real scenario: reversed obfuscated answer", () => {
        const obfuscated = "61 + 25 = " + decodeReversal("16");
        const result = decodeObfuscation("61 + 25 = 61");
        expect(result).toBe("61 + 25 = 61");
      });

      it("solves complex reversal with special chars", () => {
        const result = decodeObfuscation("!txet tneibma ni detacsufbo");
        expect(result).toBe("obfuscated in ambient text!");
      });

      it("solves index extraction from sentence", () => {
        const result = decodeObfuscation(
          "[0,3,6,9]abcdefghijklmno"
        );
        expect(result).toBe("adgj");
      });
    });
  });

  describe("whitespace and formatting", () => {
    it("preserves spaces in reversal decoding", () => {
      const result = decodeReversal("b a");
      expect(result).toBe("a b");
    });

    it("handles tabs in reversal", () => {
      const result = decodeReversal("b\ta");
      expect(result).toBe("a\tb");
    });

    it("handles newlines in reversal", () => {
      const result = decodeReversal("b\na");
      expect(result).toBe("a\nb");
    });

    it("extracts with whitespace text in index-based", () => {
      const result = decodeIndexBased("h e l l o", [0, 2, 4, 6, 8]);
      expect(result).toBe("hello");
    });
  });

  describe("consistency across functions", () => {
    it("decodeObfuscation with reversal matches decodeReversal", () => {
      const obfuscated = "txet detacsufbo";
      const result1 = decodeObfuscation(obfuscated);
      const result2 = decodeReversal(obfuscated);
      expect(result1).toBe(result2);
    });

    it("detectObfuscationType correctly identifies reversal", () => {
      const obfuscated = "txet detacsufbo";
      const detected = detectObfuscationType(obfuscated);
      expect(detected).toBe("reversal");
    });

    it("detectObfuscationType correctly identifies index-based", () => {
      const obfuscated = "[0,5,2,8]lobsterfarmer";
      const detected = detectObfuscationType(obfuscated);
      expect(detected).toBe("index_based");
    });
  });
});
