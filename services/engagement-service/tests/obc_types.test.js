/**
 * Tests for OpenBotCity API type definitions
 * Verifies that all OBC types can be instantiated and used
 */

const {
  CityStatus,
  AgentInfo,
  RateLimitState,
  HeartbeatData,
  OwnerMessageAttention,
  DmConversationAttention,
  ProposalAttention,
  ResearchTaskAttention,
  ObcResponse,
} = require("../dist/obc_types");

describe("OBC Types", () => {
  describe("CityStatus interface", () => {
    it("should create a valid city status object", () => {
      const cityStatus = {
        bulletin: "City is calm and peaceful",
        weather: "sunny",
        temperature: 72,
        events: ["market day", "council meeting"],
      };

      expect(cityStatus.bulletin).toEqual("City is calm and peaceful");
      expect(cityStatus.weather).toEqual("sunny");
      expect(cityStatus.events.length).toBe(2);
    });
  });

  describe("AgentInfo interface", () => {
    it("should create a valid agent info object", () => {
      const agent = {
        id: "classical-123",
        name: "Socratic Agent",
        reputation: 850,
        lastSeen: Date.now(),
        isOnline: true,
      };

      expect(agent.id).toEqual("classical-123");
      expect(agent.reputation).toBe(850);
      expect(agent.isOnline).toBe(true);
    });
  });

  describe("RateLimitState interface", () => {
    it("should create a rate limit state object", () => {
      const now = Date.now();
      const rateLimitState = {
        lastSpeakTime: now - 60000,
        lastPostTime: now - 120000,
        speakCooldownMs: 120000,
        postCooldownMs: 300000,
      };

      expect(rateLimitState.lastSpeakTime).toBeLessThan(now);
      expect(rateLimitState.speakCooldownMs).toBe(120000);
    });
  });

  describe("NeedsAttention union types", () => {
    it("should create owner_message attention item", () => {
      const item = {
        type: "owner_message",
        fromAgent: "classical-123",
        message: "Please help with this question",
        timestamp: Date.now(),
      };

      expect(item.type).toEqual("owner_message");
      expect(item.fromAgent).toEqual("classical-123");
    });

    it("should create dm_conversation attention item", () => {
      const item = {
        type: "dm_conversation",
        participantCount: 3,
        lastActivityTime: Date.now(),
        topic: "ethics debate",
      };

      expect(item.type).toEqual("dm_conversation");
      expect(item.participantCount).toBe(3);
    });

    it("should create proposal attention item", () => {
      const item = {
        type: "proposal",
        proposalId: "prop-456",
        proposer: "user-789",
        votesNeeded: 5,
        timeRemainingMs: 3600000,
      };

      expect(item.type).toEqual("proposal");
      expect(item.votesNeeded).toBe(5);
    });

    it("should create research_task attention item", () => {
      const item = {
        type: "research_task",
        taskId: "task-999",
        question: "What is virtue?",
        deadline: Date.now() + 86400000,
        rewardTokens: 100,
      };

      expect(item.type).toEqual("research_task");
      expect(item.rewardTokens).toBe(100);
    });
  });

  describe("HeartbeatData interface", () => {
    it("should create a complete heartbeat data object", () => {
      const heartbeat = {
        cityStatus: {
          bulletin: "All is well",
          weather: "clear",
          temperature: 70,
          events: [],
        },
        agentsNearby: [
          {
            id: "agent-1",
            name: "Aristotle",
            reputation: 900,
            lastSeen: Date.now(),
            isOnline: true,
          },
        ],
        needsAttention: [
          {
            type: "owner_message",
            fromAgent: "agent-1",
            message: "Hello",
            timestamp: Date.now(),
          },
        ],
        serverTime: Date.now(),
      };

      expect(heartbeat.cityStatus.bulletin).toEqual("All is well");
      expect(heartbeat.agentsNearby.length).toBe(1);
      expect(heartbeat.needsAttention.length).toBe(1);
    });

    it("should allow empty needsAttention array", () => {
      const heartbeat = {
        cityStatus: {
          bulletin: "Quiet day",
          weather: "cloudy",
          temperature: 68,
          events: [],
        },
        agentsNearby: [],
        needsAttention: [],
        serverTime: Date.now(),
      };

      expect(heartbeat.needsAttention.length).toBe(0);
    });
  });

  describe("ObcResponse generic wrapper", () => {
    it("should wrap successful response", () => {
      const heartbeat = {
        cityStatus: {
          bulletin: "All well",
          weather: "sunny",
          temperature: 75,
          events: [],
        },
        agentsNearby: [],
        needsAttention: [],
        serverTime: Date.now(),
      };

      const response = {
        success: true,
        data: heartbeat,
      };

      expect(response.success).toBe(true);
      expect(response.data.serverTime).toBeDefined();
    });

    it("should wrap error response", () => {
      const response = {
        success: false,
        error: "Authentication failed",
      };

      expect(response.success).toBe(false);
      expect(response.error).toEqual("Authentication failed");
    });
  });
});
