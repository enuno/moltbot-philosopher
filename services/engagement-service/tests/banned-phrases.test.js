/**
 * Test suite for banned phrase filtering
 * Tests GLOBAL_BANNED_PHRASES and AGENT_BANNED_PHRASES
 */

const {
  GLOBAL_BANNED_PHRASES,
  AGENT_BANNED_PHRASES,
  isBannedPhrase,
  isBannedForAgent,
} = require("../src/banned-phrases");

describe("Banned Phrases Module", () => {
  describe("GLOBAL_BANNED_PHRASES", () => {
    it("should contain at least 20 global phrases", () => {
      expect(GLOBAL_BANNED_PHRASES.length).toBeGreaterThanOrEqual(20);
    });

    it("should contain array of strings", () => {
      GLOBAL_BANNED_PHRASES.forEach((phrase) => {
        expect(typeof phrase).toBe("string");
        expect(phrase.length).toBeGreaterThan(0);
      });
    });

    it("should contain recognizable banned phrases", () => {
      const hasCommonPhrases = GLOBAL_BANNED_PHRASES.some(
        (p) =>
          p.toLowerCase().includes("spam") ||
          p.toLowerCase().includes("explicit") ||
          p.toLowerCase().includes("hate") ||
          p.toLowerCase().includes("violence")
      );
      expect(hasCommonPhrases).toBe(true);
    });
  });

  describe("AGENT_BANNED_PHRASES", () => {
    const agentNames = [
      "classical",
      "existentialist",
      "transcendentalist",
      "joyce",
      "enlightenment",
      "beat",
      "dadaist",
      "absurdist",
      "romantic",
    ];

    it("should have entries for all 9 agents", () => {
      agentNames.forEach((agent) => {
        expect(AGENT_BANNED_PHRASES).toHaveProperty(agent);
      });
    });

    it("should have 5-7 phrases per agent", () => {
      agentNames.forEach((agent) => {
        const phrases = AGENT_BANNED_PHRASES[agent];
        expect(phrases.length).toBeGreaterThanOrEqual(5);
        expect(phrases.length).toBeLessThanOrEqual(7);
      });
    });

    it("should contain array of strings for each agent", () => {
      agentNames.forEach((agent) => {
        const phrases = AGENT_BANNED_PHRASES[agent];
        phrases.forEach((phrase) => {
          expect(typeof phrase).toBe("string");
          expect(phrase.length).toBeGreaterThan(0);
        });
      });
    });

    it("should have agent-specific phrases (not all identical)", () => {
      const classicalPhrases = AGENT_BANNED_PHRASES.classical;
      const existentialPhrases = AGENT_BANNED_PHRASES.existentialist;
      const beatPhrases = AGENT_BANNED_PHRASES.beat;

      // At least some phrases should differ between agents
      const allUnique = new Set([...classicalPhrases, ...existentialPhrases, ...beatPhrases]);
      expect(allUnique.size).toBeGreaterThan(
        Math.max(classicalPhrases.length, existentialPhrases.length, beatPhrases.length)
      );
    });
  });

  describe("isBannedPhrase()", () => {
    it("should return true for global banned phrases", () => {
      const testPhrase = GLOBAL_BANNED_PHRASES[0];
      expect(isBannedPhrase(testPhrase)).toBe(true);
    });

    it("should return false for non-banned phrases", () => {
      expect(isBannedPhrase("This is a normal message")).toBe(false);
    });

    it("should be case-insensitive", () => {
      const testPhrase = GLOBAL_BANNED_PHRASES[0];
      expect(isBannedPhrase(testPhrase.toUpperCase())).toBe(true);
      expect(isBannedPhrase(testPhrase.toLowerCase())).toBe(true);
    });

    it("should detect banned phrases within longer text", () => {
      const testPhrase = GLOBAL_BANNED_PHRASES[0];
      const longText = `This is a message that contains ${testPhrase} in it.`;
      expect(isBannedPhrase(longText)).toBe(true);
    });

    it("should handle empty strings", () => {
      expect(isBannedPhrase("")).toBe(false);
    });

    it("should handle whitespace variations", () => {
      const testPhrase = GLOBAL_BANNED_PHRASES[0];
      expect(isBannedPhrase(`  ${testPhrase}  `)).toBe(true);
      expect(isBannedPhrase(testPhrase.replace(/ /g, "\n"))).toBe(true);
    });
  });

  describe("isBannedForAgent()", () => {
    it("should return true for agent-specific banned phrases", () => {
      const agentName = "classical";
      const testPhrase = AGENT_BANNED_PHRASES.classical[0];
      expect(isBannedForAgent(testPhrase, agentName)).toBe(true);
    });

    it("should return false for phrases not banned for that agent", () => {
      expect(isBannedForAgent("This is a normal message", "classical")).toBe(false);
    });

    it("should be case-insensitive for agent-specific phrases", () => {
      const agentName = "existentialist";
      const testPhrase = AGENT_BANNED_PHRASES.existentialist[0];
      expect(isBannedForAgent(testPhrase.toUpperCase(), agentName)).toBe(true);
      expect(isBannedForAgent(testPhrase.toLowerCase(), agentName)).toBe(true);
    });

    it("should detect agent-specific phrases within longer text", () => {
      const agentName = "beat";
      const testPhrase = AGENT_BANNED_PHRASES.beat[0];
      const longText = `This message has ${testPhrase} in it.`;
      expect(isBannedForAgent(longText, agentName)).toBe(true);
    });

    it("should return false for another agent's banned phrases", () => {
      const classicalPhrase = AGENT_BANNED_PHRASES.classical[0];
      // Only banned for classical, not for existentialist
      expect(isBannedForAgent(classicalPhrase, "existentialist")).toBe(false);
    });

    it("should accept various agent name formats", () => {
      const validAgents = [
        "classical",
        "existentialist",
        "transcendentalist",
        "joyce",
        "enlightenment",
        "beat",
        "dadaist",
        "absurdist",
        "romantic",
      ];

      validAgents.forEach((agent) => {
        const agentPhrases = AGENT_BANNED_PHRASES[agent];
        if (agentPhrases && agentPhrases.length > 0) {
          expect(isBannedForAgent(agentPhrases[0], agent)).toBe(true);
        }
      });
    });

    it("should combine global and agent-specific checks", () => {
      const agentName = "classical";
      const globalPhrase = GLOBAL_BANNED_PHRASES[0];
      const agentPhrase = AGENT_BANNED_PHRASES.classical[0];

      // Both should be banned
      expect(isBannedForAgent(globalPhrase, agentName)).toBe(true);
      expect(isBannedForAgent(agentPhrase, agentName)).toBe(true);
    });

    it("should handle unknown agent names gracefully", () => {
      expect(isBannedForAgent("test message", "unknown-agent")).toBe(false);
    });
  });

  describe("Integration Scenarios", () => {
    it("should validate engagement content for classical agent", () => {
      const validContent = "An exploration of Platonic ideals in modern philosophy";
      const bannedContent = `This is spam ${GLOBAL_BANNED_PHRASES[0]}`;
      const agentBannedContent = `Discussing ${AGENT_BANNED_PHRASES.classical[0]}`;

      expect(isBannedForAgent(validContent, "classical")).toBe(false);
      expect(isBannedForAgent(bannedContent, "classical")).toBe(true);
      expect(isBannedForAgent(agentBannedContent, "classical")).toBe(true);
    });

    it("should validate engagement content for beat agent", () => {
      const validContent = "Exploring the spontaneity of jazz and poetry";
      const bannedContent = `Inappropriate ${GLOBAL_BANNED_PHRASES[1]}`;
      const agentBannedContent = `Content with ${AGENT_BANNED_PHRASES.beat[0]}`;

      expect(isBannedForAgent(validContent, "beat")).toBe(false);
      expect(isBannedForAgent(bannedContent, "beat")).toBe(true);
      expect(isBannedForAgent(agentBannedContent, "beat")).toBe(true);
    });

    it("should filter batch of messages for engagement queue", () => {
      const messages = [
        "Normal engagement message",
        `Banned message with ${GLOBAL_BANNED_PHRASES[0]}`,
        "Another valid message",
        `Agent-specific banned for classical: ${AGENT_BANNED_PHRASES.classical[0]}`,
      ];

      const validForClassical = messages.filter(
        (msg) => !isBannedForAgent(msg, "classical")
      );
      expect(validForClassical.length).toBe(2);
    });
  });
});
