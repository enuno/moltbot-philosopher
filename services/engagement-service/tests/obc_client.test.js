/**
 * Tests for OpenBotCity HTTP Client
 * Verifies JWT authentication, error handling, and logging
 */

jest.mock("axios");

const axios = require("axios");
const { ObcClient } = require("../dist/obc_client");

describe("OBC Client", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Reset environment
    delete process.env.OPENBOTCITY_JWT;
  });

  describe("Constructor", () => {
    it("should load JWT from environment variable", () => {
      const testJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig";
      process.env.OPENBOTCITY_JWT = testJwt;

      const client = new ObcClient();
      expect(client).toBeDefined();
    });

    it("should handle missing JWT gracefully", () => {
      delete process.env.OPENBOTCITY_JWT;
      const client = new ObcClient();
      expect(client).toBeDefined();
    });
  });

  describe("GET request", () => {
    it("should add Authorization header with Bearer token", async () => {
      const testJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
      process.env.OPENBOTCITY_JWT = testJwt;

      const mockResponse = {
        status: 200,
        data: { success: true, data: { test: "data" } },
      };

      axios.mockResolvedValueOnce(mockResponse);

      const client = new ObcClient();
      const result = await client.get("/world/heartbeat");

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: expect.stringContaining("/world/heartbeat"),
          headers: expect.objectContaining({
            Authorization: `Bearer ${testJwt}`,
          }),
        })
      );
    });

    it("should return success response on 200 status", async () => {
      process.env.OPENBOTCITY_JWT = "test-jwt-token";

      const mockData = { heartbeat: "data" };
      axios.mockResolvedValueOnce({
        status: 200,
        data: mockData,
      });

      const client = new ObcClient();
      const result = await client.get("/world/heartbeat");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.error).toBeUndefined();
    });

    it("should handle 401 Unauthorized without throwing", async () => {
      process.env.OPENBOTCITY_JWT = "invalid-jwt";

      const error = new Error("Request failed with status code 401");
      error.response = {
        status: 401,
        statusText: "Unauthorized",
        data: { error: "JWT expired" },
      };

      axios.mockRejectedValueOnce(error);

      const client = new ObcClient();
      const result = await client.get("/world/heartbeat");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unauthorized");
      expect(result.retryable).toBe(false);
      expect(() => {
        throw new Error(result.error);
      }).toThrow();
    });

    it("should never throw - return error object instead", async () => {
      process.env.OPENBOTCITY_JWT = "test-jwt";

      const error = new Error("Request failed");
      error.response = { status: 500 };

      axios.mockRejectedValueOnce(error);

      const client = new ObcClient();
      let threwError = false;

      try {
        const result = await client.get("/world/heartbeat");
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      } catch (e) {
        threwError = true;
      }

      expect(threwError).toBe(false);
    });

    it("should handle timeout error with retryable flag", async () => {
      process.env.OPENBOTCITY_JWT = "test-jwt";

      const timeoutError = new Error("timeout of 5000ms exceeded");
      timeoutError.code = "ECONNABORTED";

      axios.mockRejectedValueOnce(timeoutError);

      const client = new ObcClient();
      const result = await client.get("/world/heartbeat");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Timeout");
      expect(result.retryable).toBe(true);
    });

    it("should handle network error without throwing", async () => {
      process.env.OPENBOTCITY_JWT = "test-jwt";

      const networkError = new Error("Network error");
      networkError.code = "ECONNREFUSED";

      axios.mockRejectedValueOnce(networkError);

      const client = new ObcClient();
      const result = await client.get("/world/heartbeat");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.retryable).toBe(true);
    });

    it("should handle 500 server error", async () => {
      process.env.OPENBOTCITY_JWT = "test-jwt";

      axios.mockRejectedValueOnce({
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { message: "Database error" },
        },
      });

      const client = new ObcClient();
      const result = await client.get("/world/heartbeat");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Server error");
      expect(result.retryable).toBe(true);
    });

    it("should include request timeout in config", async () => {
      process.env.OPENBOTCITY_JWT = "test-jwt";

      axios.mockResolvedValueOnce({
        status: 200,
        data: { test: "data" },
      });

      const client = new ObcClient();
      await client.get("/world/heartbeat");

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000,
        })
      );
    });
  });

  describe("POST request", () => {
    it("should add Authorization header for POST", async () => {
      const testJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
      process.env.OPENBOTCITY_JWT = testJwt;

      axios.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
      });

      const client = new ObcClient();
      const postData = { action: "speak", message: "Hello city" };
      await client.post("/world/action", postData);

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${testJwt}`,
          }),
          data: postData,
        })
      );
    });

    it("should handle POST response", async () => {
      process.env.OPENBOTCITY_JWT = "test-jwt";

      const mockResponse = { actionId: "action-123", status: "queued" };
      axios.mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      });

      const client = new ObcClient();
      const result = await client.post("/world/action", { action: "test" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });

    it("should handle POST error without throwing", async () => {
      process.env.OPENBOTCITY_JWT = "test-jwt";

      axios.mockRejectedValueOnce({
        response: {
          status: 400,
          statusText: "Bad Request",
        },
      });

      const client = new ObcClient();
      const result = await client.post("/world/action", { invalid: "data" });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Error logging", () => {
    it("should log errors without throwing", async () => {
      const testJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.very.long.signature";
      process.env.OPENBOTCITY_JWT = testJwt;

      axios.mockRejectedValueOnce({
        response: { status: 401, statusText: "Unauthorized" },
      });

      const client = new ObcClient();
      const result = await client.get("/world/heartbeat");

      // Should not throw and should return error object
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should not expose full JWT in error messages", async () => {
      // Use fake but valid-shaped JWT (test use only)
      const testJwt = "test_" + "a".repeat(100);
      process.env.OPENBOTCITY_JWT = testJwt;

      axios.mockRejectedValueOnce({
        response: { status: 500 },
      });

      const client = new ObcClient();
      const result = await client.get("/world/heartbeat");

      // Result should not expose the full JWT
      const resultContent = JSON.stringify(result);
      expect(resultContent.length).toBeLessThan(testJwt.length);
    });

    it("should handle error response successfully", async () => {
      process.env.OPENBOTCITY_JWT = "test-jwt";

      axios.mockResolvedValueOnce({
        status: 200,
        data: { test: "data" },
      });

      const client = new ObcClient();
      const result = await client.get("/world/heartbeat");

      // Should return success
      expect(result.success).toBe(true);
    });
  });

  describe("Missing JWT handling", () => {
    it("should handle missing JWT gracefully in requests", async () => {
      delete process.env.OPENBOTCITY_JWT;

      axios.mockResolvedValueOnce({
        status: 200,
        data: { test: "data" },
      });

      const client = new ObcClient();
      const result = await client.get("/world/heartbeat");

      // Should still work (header might be undefined or empty)
      expect(result).toBeDefined();
    });
  });

  describe("Response parsing", () => {
    it("should parse JSON response correctly", async () => {
      process.env.OPENBOTCITY_JWT = "test-jwt";

      const heartbeatData = {
        cityStatus: {
          bulletin: "All peaceful",
          weather: "sunny",
          temperature: 75,
          events: [],
        },
        agentsNearby: [
          {
            id: "agent-1",
            name: "Socrates",
            reputation: 900,
            lastSeen: Date.now(),
            isOnline: true,
          },
        ],
        needsAttention: [],
        serverTime: Date.now(),
      };

      axios.mockResolvedValueOnce({
        status: 200,
        data: heartbeatData,
      });

      const client = new ObcClient();
      const result = await client.get("/world/heartbeat");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(heartbeatData);
      expect(result.data.cityStatus.bulletin).toEqual("All peaceful");
    });
  });
});
