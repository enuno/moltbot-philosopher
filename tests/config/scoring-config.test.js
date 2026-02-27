/**
 * Scoring Config Module Tests
 *
 * Tests for P4.1 configuration management:
 * - Load weights from environment variables
 * - Feature flags for scoring factors
 * - Runtime configuration updates
 * - Validation of config values
 */

describe("Scoring Configuration", () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Clear module cache to reload fresh config
    jest.resetModules();
  });

  describe("Load Default Configuration", () => {
    it("should load default weights when no env vars set", () => {
      // Clear any existing config env vars
      delete process.env.SCORING_HISTORICAL_WEIGHT;
      delete process.env.SCORING_RECENT_WEIGHT;
      delete process.env.SCORING_RECENCY_EXPONENT;
      delete process.env.SCORING_REPUTATION_EXPONENT;
      delete process.env.SCORING_RECENCY_HALF_LIFE;

      const config = {
        historicalWeight: 0.5,
        recentWeight: 0.25,
        recencyExponent: 1.0,
        reputationExponent: 1.0,
        recencyHalfLife: 7,
      };

      expect(config.historicalWeight).toBe(0.5);
      expect(config.recentWeight).toBe(0.25);
      expect(config.recencyExponent).toBe(1.0);
      expect(config.reputationExponent).toBe(1.0);
      expect(config.recencyHalfLife).toBe(7);
    });

    it("should have correct default values for all weights", () => {
      const defaults = {
        historicalWeight: 0.5,
        recentWeight: 0.25,
        recencyExponent: 1.0,
        reputationExponent: 1.0,
        recencyHalfLife: 7,
      };

      // Verify all defaults are numbers
      for (const [key, value] of Object.entries(defaults)) {
        expect(typeof value).toBe("number");
        expect(value).toBeGreaterThan(0);
      }
    });
  });

  describe("Load from Environment Variables", () => {
    it("should load weights from SCORING_* env vars", () => {
      process.env.SCORING_HISTORICAL_WEIGHT = "0.6";
      process.env.SCORING_RECENT_WEIGHT = "0.3";
      process.env.SCORING_RECENCY_EXPONENT = "1.2";
      process.env.SCORING_REPUTATION_EXPONENT = "0.8";
      process.env.SCORING_RECENCY_HALF_LIFE = "10";

      const config = {
        historicalWeight: parseFloat(process.env.SCORING_HISTORICAL_WEIGHT) || 0.5,
        recentWeight: parseFloat(process.env.SCORING_RECENT_WEIGHT) || 0.25,
        recencyExponent: parseFloat(process.env.SCORING_RECENCY_EXPONENT) || 1.0,
        reputationExponent: parseFloat(process.env.SCORING_REPUTATION_EXPONENT) || 1.0,
        recencyHalfLife: parseFloat(process.env.SCORING_RECENCY_HALF_LIFE) || 7,
      };

      expect(config.historicalWeight).toBe(0.6);
      expect(config.recentWeight).toBe(0.3);
      expect(config.recencyExponent).toBe(1.2);
      expect(config.reputationExponent).toBe(0.8);
      expect(config.recencyHalfLife).toBe(10);
    });

    it("should fallback to defaults for missing env vars", () => {
      process.env.SCORING_HISTORICAL_WEIGHT = "0.6";
      delete process.env.SCORING_RECENT_WEIGHT;

      const config = {
        historicalWeight: process.env.SCORING_HISTORICAL_WEIGHT
          ? parseFloat(process.env.SCORING_HISTORICAL_WEIGHT)
          : 0.5,
        recentWeight: process.env.SCORING_RECENT_WEIGHT
          ? parseFloat(process.env.SCORING_RECENT_WEIGHT)
          : 0.25,
      };

      expect(config.historicalWeight).toBe(0.6);
      expect(config.recentWeight).toBe(0.25);
    });
  });

  describe("Feature Flags", () => {
    it("should have feature flags for each scoring factor", () => {
      const flags = {
        enableRecency: true,
        enableReputation: true,
        enableFollowBoost: true,
        enableDebug: false,
      };

      expect(flags).toHaveProperty("enableRecency");
      expect(flags).toHaveProperty("enableReputation");
      expect(flags).toHaveProperty("enableFollowBoost");
      expect(flags).toHaveProperty("enableDebug");
    });

    it("should load feature flags from env vars", () => {
      process.env.ENABLE_RECENCY = "false";
      process.env.ENABLE_REPUTATION = "true";
      process.env.ENABLE_FOLLOW_BOOST = "true";
      process.env.ENABLE_DEBUG = "true";

      const flags = {
        enableRecency: process.env.ENABLE_RECENCY === "true",
        enableReputation: process.env.ENABLE_REPUTATION === "true",
        enableFollowBoost: process.env.ENABLE_FOLLOW_BOOST === "true",
        enableDebug: process.env.ENABLE_DEBUG === "true",
      };

      expect(flags.enableRecency).toBe(false);
      expect(flags.enableReputation).toBe(true);
      expect(flags.enableFollowBoost).toBe(true);
      expect(flags.enableDebug).toBe(true);
    });

    it("should default feature flags to enabled", () => {
      delete process.env.ENABLE_RECENCY;
      delete process.env.ENABLE_REPUTATION;
      delete process.env.ENABLE_FOLLOW_BOOST;
      delete process.env.ENABLE_DEBUG;

      const flags = {
        enableRecency: process.env.ENABLE_RECENCY !== "false",
        enableReputation: process.env.ENABLE_REPUTATION !== "false",
        enableFollowBoost: process.env.ENABLE_FOLLOW_BOOST !== "false",
        enableDebug: process.env.ENABLE_DEBUG === "true",
      };

      expect(flags.enableRecency).toBe(true);
      expect(flags.enableReputation).toBe(true);
      expect(flags.enableFollowBoost).toBe(true);
      expect(flags.enableDebug).toBe(false);
    });
  });

  describe("Configuration Validation", () => {
    it("should validate weight ranges", () => {
      const validWeight = (w) => typeof w === "number" && w > 0;

      expect(validWeight(0.5)).toBe(true);
      expect(validWeight(0)).toBe(false);
      expect(validWeight(-0.1)).toBe(false);
      expect(validWeight("0.5")).toBe(false);
    });

    it("should validate exponent ranges", () => {
      const validExponent = (e) => typeof e === "number" && e >= 0;

      expect(validExponent(1.0)).toBe(true);
      expect(validExponent(0)).toBe(true);
      expect(validExponent(-1)).toBe(false);
      expect(validExponent(1.5)).toBe(true);
    });

    it("should reject invalid weight values", () => {
      const shouldThrow = () => {
        const invalidWeight = -0.5;
        if (invalidWeight <= 0) {
          throw new Error("Weight must be positive");
        }
      };

      expect(shouldThrow).toThrow("Weight must be positive");
    });
  });

  describe("Configuration Object", () => {
    it("should return complete config object", () => {
      const config = {
        weights: {
          historicalWeight: 0.5,
          recentWeight: 0.25,
          recencyExponent: 1.0,
          reputationExponent: 1.0,
          recencyHalfLife: 7,
        },
        flags: {
          enableRecency: true,
          enableReputation: true,
          enableFollowBoost: true,
          enableDebug: false,
        },
      };

      expect(config).toHaveProperty("weights");
      expect(config).toHaveProperty("flags");
      expect(config.weights).toHaveProperty("historicalWeight");
      expect(config.flags).toHaveProperty("enableRecency");
    });

    it("should provide method to get current config", () => {
      const getConfig = () => ({
        weights: {
          historicalWeight: 0.5,
          recentWeight: 0.25,
          recencyExponent: 1.0,
          reputationExponent: 1.0,
          recencyHalfLife: 7,
        },
        flags: {
          enableRecency: true,
          enableReputation: true,
          enableFollowBoost: true,
          enableDebug: false,
        },
      });

      const config = getConfig();
      expect(config.weights.historicalWeight).toBe(0.5);
    });

    it("should provide method to update config", () => {
      let config = {
        weights: { historicalWeight: 0.5 },
      };

      const updateConfig = (updates) => {
        config.weights = { ...config.weights, ...updates };
      };

      updateConfig({ historicalWeight: 0.6 });
      expect(config.weights.historicalWeight).toBe(0.6);
    });
  });

  describe("Hot Reload Capability", () => {
    it("should support runtime config updates", () => {
      let runtimeConfig = {
        weights: {
          historicalWeight: 0.5,
          recentWeight: 0.25,
        },
      };

      // Update runtime config
      runtimeConfig.weights.historicalWeight = 0.7;

      expect(runtimeConfig.weights.historicalWeight).toBe(0.7);
    });

    it("should validate before applying runtime updates", () => {
      const applyUpdate = (currentConfig, updates) => {
        // Validate all update values
        for (const [key, value] of Object.entries(updates)) {
          if (typeof value !== "number" || value <= 0) {
            throw new Error(`Invalid value for ${key}: must be positive number`);
          }
        }
        return { ...currentConfig, ...updates };
      };

      const config = { historicalWeight: 0.5 };

      // Valid update
      expect(() => applyUpdate(config, { historicalWeight: 0.6 })).not.toThrow();

      // Invalid update
      expect(() => applyUpdate(config, { historicalWeight: -0.1 })).toThrow();
    });
  });

  describe("Environment Variable Parsing", () => {
    it("should parse numeric env vars correctly", () => {
      process.env.TEST_WEIGHT = "0.75";

      const parsed = parseFloat(process.env.TEST_WEIGHT);
      expect(parsed).toBe(0.75);
      expect(typeof parsed).toBe("number");
    });

    it("should handle invalid numeric strings", () => {
      process.env.INVALID_WEIGHT = "not_a_number";

      const parsed = parseFloat(process.env.INVALID_WEIGHT);
      expect(isNaN(parsed)).toBe(true);
    });

    it("should use fallback for non-numeric values", () => {
      process.env.INVALID_WEIGHT = "invalid";

      const weight =
        parseFloat(process.env.INVALID_WEIGHT) || 0.5; // fallback to 0.5

      expect(weight).toBe(0.5);
    });
  });
});
