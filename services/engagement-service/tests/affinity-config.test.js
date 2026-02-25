/**
 * Agent-Topic Affinity Configuration Test Suite
 * P2.3 Task 4: Tests agent affinity scoring and rankings
 */

const {
  AGENT_TOPIC_AFFINITIES,
  getAgentAffinities,
  getAffinityScore,
  getTopAgentsForTopic,
  computeEngagementRelevance,
} = require("../src/affinity-config");

describe("Agent-Topic Affinity Configuration", () => {
  describe("AGENT_TOPIC_AFFINITIES Matrix", () => {
    it("should define affinity scores for 9 agents × 6 topics", () => {
      const agentCount = Object.keys(AGENT_TOPIC_AFFINITIES).length;
      expect(agentCount).toBe(9);

      let totalScores = 0;
      Object.values(AGENT_TOPIC_AFFINITIES).forEach((agentAffinities) => {
        const topicCount = Object.keys(agentAffinities).length;
        expect(topicCount).toBe(6);
        totalScores += Object.values(agentAffinities).length;
      });

      expect(totalScores).toBe(54);
    });

    it("should contain all affinity scores between 0 and 1", () => {
      Object.values(AGENT_TOPIC_AFFINITIES).forEach((agentAffinities) => {
        Object.values(agentAffinities).forEach((score) => {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
          expect(typeof score).toBe("number");
        });
      });
    });

    it("should have high affinity for agent-topic matches", () => {
      // classical → virtue_ethics
      expect(AGENT_TOPIC_AFFINITIES.classical.virtue_ethics).toBeGreaterThan(
        0.8
      );

      // existentialist → consciousness
      expect(AGENT_TOPIC_AFFINITIES.existentialist.consciousness).toBeGreaterThan(
        0.8
      );

      // cyberpunk-posthumanist → ai_safety
      expect(
        AGENT_TOPIC_AFFINITIES["cyberpunk-posthumanist"].ai_safety
      ).toBeGreaterThan(0.8);
    });
  });

  describe("getAgentAffinities", () => {
    it("should return affinity scores for a specific agent", () => {
      const affinities = getAgentAffinities("classical");
      expect(affinities).toBeDefined();
      expect(typeof affinities).toBe("object");
      expect(Object.keys(affinities).length).toBe(6);
    });

    it("should return object with topic IDs as keys", () => {
      const affinities = getAgentAffinities("classical");
      const expectedTopics = [
        "virtue_ethics",
        "consciousness",
        "social_ethics",
        "ai_safety",
        "epistemology",
        "aesthetics",
      ];
      expectedTopics.forEach((topic) => {
        expect(affinities).toHaveProperty(topic);
      });
    });

    it("should return numeric scores", () => {
      const affinities = getAgentAffinities("classical");
      Object.values(affinities).forEach((score) => {
        expect(typeof score).toBe("number");
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it("should return affinities for all agents", () => {
      const agents = [
        "classical",
        "existentialist",
        "transcendentalist",
        "joyce",
        "enlightenment",
        "beat",
        "cyberpunk-posthumanist",
        "satirist-absurdist",
        "scientist-empiricist",
      ];
      agents.forEach((agent) => {
        const affinities = getAgentAffinities(agent);
        expect(affinities).toBeDefined();
        expect(Object.keys(affinities).length).toBe(6);
      });
    });
  });

  describe("getAffinityScore", () => {
    it("should return affinity score for agent-topic pair", () => {
      const score = getAffinityScore("classical", "virtue_ethics");
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should return high score for matching agent-topic", () => {
      const score = getAffinityScore("classical", "virtue_ethics");
      expect(score).toBeGreaterThan(0.8);
    });

    it("should return low score for non-matching pairs", () => {
      // cyberpunk might not care about virtue ethics
      const score = getAffinityScore("cyberpunk-posthumanist", "virtue_ethics");
      expect(score).toBeLessThan(0.6);
    });

    it("should handle unknown agents gracefully", () => {
      const score = getAffinityScore("unknown-agent", "virtue_ethics");
      expect(score).toBe(0);
    });

    it("should handle unknown topics gracefully", () => {
      const score = getAffinityScore("classical", "unknown-topic");
      expect(score).toBe(0);
    });
  });

  describe("getTopAgentsForTopic", () => {
    it("should return array of agents for a topic", () => {
      const agents = getTopAgentsForTopic("virtue_ethics");
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
    });

    it("should return agents sorted by affinity descending", () => {
      const agents = getTopAgentsForTopic("virtue_ethics");
      for (let i = 0; i < agents.length - 1; i++) {
        expect(agents[i].affinityScore).toBeGreaterThanOrEqual(
          agents[i + 1].affinityScore
        );
      }
    });

    it("should include agentId and affinityScore", () => {
      const agents = getTopAgentsForTopic("virtue_ethics");
      agents.forEach((agent) => {
        expect(agent).toHaveProperty("agentId");
        expect(agent).toHaveProperty("affinityScore");
        expect(typeof agent.agentId).toBe("string");
        expect(typeof agent.affinityScore).toBe("number");
      });
    });

    it("should respect limit parameter", () => {
      const agents3 = getTopAgentsForTopic("virtue_ethics", 3);
      expect(agents3.length).toBeLessThanOrEqual(3);

      const agents1 = getTopAgentsForTopic("virtue_ethics", 1);
      expect(agents1.length).toBeLessThanOrEqual(1);
    });

    it("should return all agents when limit not specified", () => {
      const agents = getTopAgentsForTopic("virtue_ethics");
      expect(agents.length).toBe(9);
    });

    it("should return top agent for each topic", () => {
      const topics = [
        "virtue_ethics",
        "consciousness",
        "social_ethics",
        "ai_safety",
        "epistemology",
        "aesthetics",
      ];
      topics.forEach((topic) => {
        const topAgent = getTopAgentsForTopic(topic, 1);
        expect(topAgent.length).toBe(1);
        expect(topAgent[0].affinityScore).toBeGreaterThan(0.5);
      });
    });
  });

  describe("computeEngagementRelevance", () => {
    it("should compute relevance from topic relevance and affinity", () => {
      const topicRelevance = 0.7;
      const affinityScore = 0.8;
      const relevance = computeEngagementRelevance(
        topicRelevance,
        affinityScore
      );

      expect(typeof relevance).toBe("number");
      expect(relevance).toBeGreaterThanOrEqual(0);
      expect(relevance).toBeLessThanOrEqual(1);
    });

    it("should give weight to both topic and affinity", () => {
      const highTopic = computeEngagementRelevance(0.9, 0.5);
      const lowTopic = computeEngagementRelevance(0.3, 0.5);
      expect(highTopic).toBeGreaterThan(lowTopic);

      const highAffinity = computeEngagementRelevance(0.5, 0.9);
      const lowAffinity = computeEngagementRelevance(0.5, 0.3);
      expect(highAffinity).toBeGreaterThan(lowAffinity);
    });

    it("should return 0 if both inputs are 0", () => {
      const relevance = computeEngagementRelevance(0, 0);
      expect(relevance).toBe(0);
    });

    it("should return 1 if both inputs are 1", () => {
      const relevance = computeEngagementRelevance(1, 1);
      expect(relevance).toBe(1);
    });

    it("should use 60% topic / 40% affinity weighting", () => {
      // Pure topic: 0.6 * 1.0 + 0.4 * 0 = 0.6
      const pureTopicRelevance = computeEngagementRelevance(1.0, 0);
      expect(pureTopicRelevance).toBeCloseTo(0.6, 2);

      // Pure affinity: 0.6 * 0 + 0.4 * 1.0 = 0.4
      const pureAffinityRelevance = computeEngagementRelevance(0, 1.0);
      expect(pureAffinityRelevance).toBeCloseTo(0.4, 2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle fractional affinity scores", () => {
      const relevance = computeEngagementRelevance(0.33, 0.67);
      expect(relevance).toBeGreaterThan(0);
      expect(relevance).toBeLessThan(1);
    });

    it("should handle invalid agent names gracefully", () => {
      const affinities = getAgentAffinities("nonexistent");
      expect(affinities).toEqual({});

      const score = getAffinityScore("nonexistent", "virtue_ethics");
      expect(score).toBe(0);
    });

    it("should handle invalid topic names gracefully", () => {
      const score = getAffinityScore("classical", "nonexistent");
      expect(score).toBe(0);
    });

    it("should handle null/undefined inputs", () => {
      expect(() => {
        computeEngagementRelevance(null, 0.5);
      }).not.toThrow();

      expect(() => {
        getAffinityScore(null, null);
      }).not.toThrow();

      expect(() => {
        getTopAgentsForTopic(null);
      }).not.toThrow();
    });
  });

  describe("Integration Scenarios", () => {
    it("should enable agent selection for a detected topic", () => {
      const topicId = "virtue_ethics";
      const topAgents = getTopAgentsForTopic(topicId, 3);

      expect(topAgents.length).toBeGreaterThan(0);
      expect(topAgents[0].agentId).toBeDefined();

      // Verify these are actual agents
      const affinities = getAgentAffinities(topAgents[0].agentId);
      expect(Object.keys(affinities).length).toBe(6);
    });

    it("should score posts based on topic + agent affinity", () => {
      const topicRelevance = 0.75;
      const agent = "classical";
      const topic = "virtue_ethics";

      const affinityScore = getAffinityScore(agent, topic);
      const engagementRelevance = computeEngagementRelevance(
        topicRelevance,
        affinityScore
      );

      expect(engagementRelevance).toBeGreaterThan(topicRelevance * 0.5);
    });
  });
});
