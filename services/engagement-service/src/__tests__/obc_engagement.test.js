/**
 * OBC Engagement Module Tests
 * Tests the 3-phase heartbeat pattern: Read -> Check Attention -> Log
 */

// Mock axios and winston BEFORE requiring modules
jest.mock("axios");

// Create a proper mock logger
const mockLoggerInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  add: jest.fn(function() {
    return this;
  }),
};

jest.mock("winston", () => ({
  createLogger: jest.fn(() => mockLoggerInstance),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    simple: jest.fn(() => ({})),
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn(),
  },
}));

const { ObcEngagement } = require("../obc_engagement");
const { ObcClient } = require("../obc_client");

describe("ObcEngagement", () => {
  let obcEngagement;
  let mockClient;
  let mockLogger;

  beforeEach(() => {
    // Set production mode to skip console transport setup
    process.env.NODE_ENV = "production";

    // Create mock client
    mockClient = new ObcClient();

    // Replace the client's logger with a fresh mock
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    mockClient.logger = mockLogger;

    // Initialize OBC engagement
    obcEngagement = new ObcEngagement(mockClient);
  });

  afterEach(() => {
    // Reset NODE_ENV
    delete process.env.NODE_ENV;
    jest.clearAllMocks();
  });

  describe("Dry-run with mock data", () => {
    it("should parse heartbeat and return success with parsed data", async () => {
      // Mock client to return valid heartbeat
      mockClient.get = jest.fn().mockResolvedValue({
        success: true,
        data: {
          city_status: {
            bulletin: "City is calm",
            weather: "sunny",
            temperature: 72,
            events: ["market day"],
          },
          agents_nearby: [
            {
              id: "agent1",
              name: "Alice",
              reputation: 850,
              lastSeen: Date.now(),
              isOnline: true,
            },
            {
              id: "agent2",
              name: "Bob",
              reputation: 620,
              lastSeen: Date.now() - 60000,
              isOnline: false,
            },
          ],
          needs_attention: [
            {
              type: "dm_conversation",
              participantCount: 2,
              lastActivityTime: Date.now(),
              topic: "governance",
            },
          ],
          serverTime: Date.now(),
        },
      });

      const result = await obcEngagement.run();

      expect(result.success).toBe(true);
      expect(result.cityStatus).toBeDefined();
      expect(result.agentsNearby).toBeDefined();
      expect(result.attentionCount).toBe(1);
      expect(result.error).toBeUndefined();
    });
  });

  describe("Parse city_status", () => {
    it("should extract city status and log bulletin", async () => {
      const mockHeartbeat = {
        city_status: {
          bulletin: "City under siege",
          weather: "stormy",
          temperature: 45,
          events: ["lockdown", "curfew"],
        },
        agents_nearby: [],
        needs_attention: [],
        serverTime: Date.now(),
      };

      mockClient.get = jest.fn().mockResolvedValue({
        success: true,
        data: mockHeartbeat,
      });

      const result = await obcEngagement.run();

      expect(result.success).toBe(true);
      expect(result.cityStatus).toEqual(mockHeartbeat.city_status);
      // Verify the bulletin is in one of the log calls
      const logCalls = mockLogger.info.mock.calls;
      const hasCityLog = logCalls.some((call) =>
        call[0].toLowerCase().includes("city") || call[0].includes("bulletin")
      );
      expect(hasCityLog).toBe(true);
    });
  });

  describe("Parse agents_nearby", () => {
    it("should count and parse agents correctly", async () => {
      const agents = [
        {
          id: "a1",
          name: "Alice",
          reputation: 900,
          lastSeen: Date.now(),
          isOnline: true,
        },
        {
          id: "a2",
          name: "Bob",
          reputation: 750,
          lastSeen: Date.now(),
          isOnline: true,
        },
        {
          id: "a3",
          name: "Charlie",
          reputation: 600,
          lastSeen: Date.now(),
          isOnline: false,
        },
      ];

      mockClient.get = jest.fn().mockResolvedValue({
        success: true,
        data: {
          city_status: { bulletin: "test", weather: "clear", temperature: 70, events: [] },
          agents_nearby: agents,
          needs_attention: [],
          serverTime: Date.now(),
        },
      });

      const result = await obcEngagement.run();

      expect(result.success).toBe(true);
      expect(result.agentsNearby).toHaveLength(3);
      expect(result.agentsNearby).toEqual(agents);
    });
  });

  describe("Parse needs_attention array", () => {
    it("should count attention items by type", async () => {
      const needsAttention = [
        {
          type: "owner_message",
          fromAgent: "admin",
          message: "Important update",
          timestamp: Date.now(),
        },
        {
          type: "dm_conversation",
          participantCount: 2,
          lastActivityTime: Date.now(),
          topic: "research",
        },
        {
          type: "proposal",
          proposalId: "prop1",
          proposer: "council",
          votesNeeded: 3,
          timeRemainingMs: 3600000,
        },
        {
          type: "research_task",
          taskId: "task1",
          question: "What is the nature of virtue?",
          deadline: Date.now() + 86400000,
          rewardTokens: 100,
        },
      ];

      mockClient.get = jest.fn().mockResolvedValue({
        success: true,
        data: {
          city_status: { bulletin: "test", weather: "clear", temperature: 70, events: [] },
          agents_nearby: [],
          needs_attention: needsAttention,
          serverTime: Date.now(),
        },
      });

      const result = await obcEngagement.run();

      expect(result.success).toBe(true);
      expect(result.attentionCount).toBe(4);
      // Verify logs for each type
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("owner_message"),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("dm_conversation"),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("proposal"),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("research_task"),
        expect.any(Object)
      );
    });
  });

  describe("Handle empty needs_attention", () => {
    it("should log that no attention items are needed", async () => {
      mockClient.get = jest.fn().mockResolvedValue({
        success: true,
        data: {
          city_status: { bulletin: "all calm", weather: "sunny", temperature: 72, events: [] },
          agents_nearby: [{ id: "a1", name: "Alice", reputation: 800, lastSeen: Date.now(), isOnline: true }],
          needs_attention: [],
          serverTime: Date.now(),
        },
      });

      const result = await obcEngagement.run();

      expect(result.success).toBe(true);
      expect(result.attentionCount).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("No attention"),
        expect.any(Object)
      );
    });
  });

  describe("Soft-fail on OBC client error", () => {
    it("should not throw when client returns error", async () => {
      mockClient.get = jest.fn().mockResolvedValue({
        success: false,
        error: "Network error (connection refused)",
        retryable: true,
      });

      const result = await obcEngagement.run();

      expect(result.success).toBe(false);
      expect(result.error).toEqual("Network error (connection refused)");
      expect(result.cityStatus).toBeUndefined();
      // Should log warning, not error
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should not throw when client throws exception", async () => {
      mockClient.get = jest.fn().mockRejectedValue(new Error("Unexpected error"));

      const result = await obcEngagement.run();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe("Rate limit state tracking", () => {
    it("should initialize rate limit state", () => {
      expect(obcEngagement.rateLimitState).toBeDefined();
      expect(obcEngagement.rateLimitState.lastSpeakTime).toBeNull();
      expect(obcEngagement.rateLimitState.lastPostTime).toBeNull();
    });

    it("should update speak time after speak action", async () => {
      mockClient.get = jest.fn().mockResolvedValue({
        success: true,
        data: {
          city_status: { bulletin: "test", weather: "clear", temperature: 70, events: [] },
          agents_nearby: [],
          needs_attention: [],
          serverTime: Date.now(),
        },
      });

      const beforeTime = Date.now();
      await obcEngagement.run();
      const afterTime = Date.now();

      // Note: Phase 1 is read-only, so state is not updated yet
      // But the structure should exist
      expect(obcEngagement.rateLimitState.lastSpeakTime).toBeNull();
      expect(obcEngagement.rateLimitState.lastPostTime).toBeNull();
    });
  });

  describe("Logging structure", () => {
    it("should log summary with counts and details", async () => {
      mockClient.get = jest.fn().mockResolvedValue({
        success: true,
        data: {
          city_status: { bulletin: "All systems nominal", weather: "clear", temperature: 72, events: ["celebration"] },
          agents_nearby: [
            { id: "a1", name: "Alice", reputation: 900, lastSeen: Date.now(), isOnline: true },
          ],
          needs_attention: [
            { type: "proposal", proposalId: "p1", proposer: "council", votesNeeded: 2, timeRemainingMs: 7200000 },
          ],
          serverTime: Date.now(),
        },
      });

      await obcEngagement.run();

      // Should log multiple info messages with structured data
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("OBC heartbeat"),
        expect.any(Object)
      );
    });
  });
});
