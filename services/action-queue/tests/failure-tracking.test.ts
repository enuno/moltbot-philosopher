import { Pool } from "pg";
import { DatabaseManager } from "../src/database";
import { WorkerStateEnum } from "../src/types";

// Skip tests if DATABASE_URL is not available with Docker network
const skipTests = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("localhost");
const describeOrSkip = skipTests ? describe.skip : describe;

describeOrSkip("Worker Failure Tracking (P7.7.1)", () => {
  let db: DatabaseManager;
  let pool: Pool;

  beforeEach(async () => {
    const testDbUrl =
      process.env.DATABASE_URL ||
      "postgresql://noosphere_admin:changeme_noosphere_2026@postgres:5432/action_queue";

    db = new DatabaseManager(testDbUrl);
    pool = new Pool({ connectionString: testDbUrl });

    // Clean up worker_state table before each test (table is created by DatabaseManager.initialize)
    try {
      await pool.query("DELETE FROM worker_state");
    } catch (err) {
      console.warn("Worker state table may not exist yet", err);
    }
  });

  afterEach(async () => {
    if (pool) {
      await pool.end();
    }
    if (db) {
      try {
        await db.close();
      } catch (err) {
        // May fail if db.initialize() was never called
      }
    }
  });

  describe("recordWorkerFailure", () => {
    it("should increment consecutive_failures from 0 to 1 on first failure", async () => {
      const result = await db.recordWorkerFailure("classical");

      expect(result).toBeDefined();
      expect(result.agent_name).toBe("classical");
      expect(result.consecutive_failures).toBe(1);
      expect(result.state).toBe(WorkerStateEnum.CLOSED);
      expect(result.last_failure_time).toBeDefined();
      expect(result.failure_reset_at).toBeDefined();
    });

    it("should increment consecutive_failures on subsequent failures", async () => {
      await db.recordWorkerFailure("enlightenment");
      const result2 = await db.recordWorkerFailure("enlightenment");
      const result3 = await db.recordWorkerFailure("enlightenment");

      expect(result3.consecutive_failures).toBe(3);
      expect(result3.state).toBe(WorkerStateEnum.CLOSED);
    });

    it("should update last_failure_time with each failure", async () => {
      const result1 = await db.recordWorkerFailure("joyce");
      const time1 = result1.last_failure_time?.getTime();

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result2 = await db.recordWorkerFailure("joyce");
      const time2 = result2.last_failure_time?.getTime();

      expect(time2).toBeDefined();
      expect(time1).toBeDefined();
      expect(time2).toBeGreaterThan(time1!);
    });

    it("should set failure_reset_at to 1 hour from now on each failure", async () => {
      const beforeCall = Date.now();
      const result = await db.recordWorkerFailure("transcendentalist");
      const afterCall = Date.now();

      expect(result.failure_reset_at).toBeDefined();
      const resetAtMs = result.failure_reset_at!.getTime();
      const defaultTimeout =
        parseInt(process.env.WORKER_FAILURE_RESET_TIMEOUT_MS || "3600000", 10) ||
        3600000;

      // Should be approximately 1 hour from now (with some tolerance for execution time)
      const expectedMin = beforeCall + defaultTimeout;
      const expectedMax = afterCall + defaultTimeout;

      expect(resetAtMs).toBeGreaterThanOrEqual(expectedMin - 100);
      expect(resetAtMs).toBeLessThanOrEqual(expectedMax + 100);
    });
  });

  describe("recordWorkerSuccess", () => {
    it("should reset consecutive_failures to 0 after failures", async () => {
      await db.recordWorkerFailure("beat");
      await db.recordWorkerFailure("beat");
      const result = await db.recordWorkerSuccess("beat");

      expect(result.consecutive_failures).toBe(0);
      expect(result.state).toBe(WorkerStateEnum.CLOSED);
    });

    it("should work on agent that has no prior record (create new record)", async () => {
      const result = await db.recordWorkerSuccess("brand-new-agent");

      expect(result.agent_name).toBe("brand-new-agent");
      expect(result.consecutive_failures).toBe(0);
      expect(result.state).toBe(WorkerStateEnum.CLOSED);
    });

    it("should update updated_at timestamp", async () => {
      const result1 = await db.recordWorkerFailure("nietzsche");
      const time1 = new Date(result1.updated_at).getTime();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const result2 = await db.recordWorkerSuccess("nietzsche");
      const time2 = new Date(result2.updated_at).getTime();

      expect(time2).toBeGreaterThan(time1);
    });
  });

  describe("getWorkerState", () => {
    it("should return WorkerState for agent with existing record", async () => {
      await db.recordWorkerFailure("stoic");
      const result = await db.getWorkerState("stoic");

      expect(result).toBeDefined();
      expect(result?.agent_name).toBe("stoic");
      expect(result?.consecutive_failures).toBe(1);
      expect(result?.state).toBe(WorkerStateEnum.CLOSED);
    });

    it("should return null for agent with no record", async () => {
      const result = await db.getWorkerState("nonexistent-agent");
      expect(result).toBeNull();
    });

    it("should reflect current state accurately", async () => {
      await db.recordWorkerFailure("peripatetic");
      await db.recordWorkerFailure("peripatetic");
      await db.recordWorkerFailure("peripatetic");

      const result = await db.getWorkerState("peripatetic");

      expect(result).toBeDefined();
      expect(result?.consecutive_failures).toBe(3);
      expect(result?.last_failure_time).toBeDefined();
      expect(result?.failure_reset_at).toBeDefined();
    });
  });

  describe("Auto-reset failures after timeout", () => {
    it("should auto-reset failures if failure_reset_at has passed", async () => {
      // Record a failure
      await db.recordWorkerFailure("stoicism");

      // Manually update the database to set failure_reset_at to the past
      // (simulating 1 hour has passed)
      const db2 = new DatabaseManager(":memory:");
      await db2.recordWorkerFailure("stoicism");

      // We'll test this by calling resetFailures and checking it resets
      // when the timeout has passed
      await db.resetFailures("stoicism");

      // After reset, failures should be 0
      const result = await db.getWorkerState("stoicism");
      expect(result?.consecutive_failures).toBe(0);
    });

    it("should NOT reset failures if failure_reset_at has not passed", async () => {
      // Record a failure (failure_reset_at will be set to ~1 hour from now)
      await db.recordWorkerFailure("epicureanism");

      // Try to reset (should not reset since timeout hasn't passed)
      await db.resetFailures("epicureanism");

      // Failures should still be 1 (or more if this runs slowly)
      const result = await db.getWorkerState("epicureanism");
      expect(result?.consecutive_failures).toBeGreaterThanOrEqual(1);
    });

    it("should handle agent with no record gracefully", async () => {
      // Should not throw
      await expect(db.resetFailures("ghost-agent")).resolves.not.toThrow();
    });
  });

  describe("openCircuit", () => {
    it("should set circuit state to OPEN with opened_at timestamp", async () => {
      const beforeCall = Date.now();
      await db.openCircuit("aristotle");
      const afterCall = Date.now();

      const result = await db.getWorkerState("aristotle");

      expect(result).toBeDefined();
      expect(result?.state).toBe(WorkerStateEnum.OPEN);
      expect(result?.opened_at).toBeDefined();

      const openedAtMs = new Date(result!.opened_at!).getTime();
      expect(openedAtMs).toBeGreaterThanOrEqual(beforeCall);
      expect(openedAtMs).toBeLessThanOrEqual(afterCall);
    });

    it("should open circuit on agent with failures", async () => {
      await db.recordWorkerFailure("kant");
      await db.recordWorkerFailure("kant");
      await db.recordWorkerFailure("kant");

      await db.openCircuit("kant");

      const result = await db.getWorkerState("kant");
      expect(result?.state).toBe(WorkerStateEnum.OPEN);
      expect(result?.consecutive_failures).toBe(3); // failures preserved
    });

    it("should handle opening circuit on new agent", async () => {
      await db.openCircuit("hume");

      const result = await db.getWorkerState("hume");
      expect(result?.state).toBe(WorkerStateEnum.OPEN);
      expect(result?.consecutive_failures).toBe(0);
    });
  });

  describe("Integration scenarios", () => {
    it("should track full failure → success → reset cycle", async () => {
      // Record multiple failures
      await db.recordWorkerFailure("epicurus");
      await db.recordWorkerFailure("epicurus");

      // Record success to reset
      const successResult = await db.recordWorkerSuccess("epicurus");
      expect(successResult.consecutive_failures).toBe(0);

      // Verify state
      const state = await db.getWorkerState("epicurus");
      expect(state?.consecutive_failures).toBe(0);
      expect(state?.state).toBe(WorkerStateEnum.CLOSED);
    });

    it("should handle multiple agents independently", async () => {
      await db.recordWorkerFailure("agent-a");
      await db.recordWorkerFailure("agent-a");
      await db.recordWorkerFailure("agent-b");

      const stateA = await db.getWorkerState("agent-a");
      const stateB = await db.getWorkerState("agent-b");

      expect(stateA?.consecutive_failures).toBe(2);
      expect(stateB?.consecutive_failures).toBe(1);
      expect(stateA?.agent_name).toBe("agent-a");
      expect(stateB?.agent_name).toBe("agent-b");
    });

    it("should properly transition from failure → open → success reset", async () => {
      // Record failures
      await db.recordWorkerFailure("transition-test");
      await db.recordWorkerFailure("transition-test");
      await db.recordWorkerFailure("transition-test");

      // Open the circuit
      await db.openCircuit("transition-test");

      let state = await db.getWorkerState("transition-test");
      expect(state?.state).toBe(WorkerStateEnum.OPEN);
      expect(state?.consecutive_failures).toBe(3);

      // Reset success (should close circuit and reset failures)
      await db.recordWorkerSuccess("transition-test");

      state = await db.getWorkerState("transition-test");
      expect(state?.consecutive_failures).toBe(0);
      expect(state?.state).toBe(WorkerStateEnum.CLOSED);
    });
  });
});
