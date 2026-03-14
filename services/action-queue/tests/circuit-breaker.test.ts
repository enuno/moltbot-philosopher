import { CircuitBreaker } from "../src/circuit-breaker";
import { DatabaseManager } from "../src/database";
import { WorkerStateEnum } from "../src/types";

/**
 * Mock DatabaseManager for testing
 */
class MockDatabaseManager implements Partial<DatabaseManager> {
  private workerStates: Map<string, any> = new Map();
  private callLog: Array<{ method: string; agentName: string; timestamp: number }> = [];

  async recordWorkerFailure(agentName: string) {
    this.callLog.push({ method: "recordWorkerFailure", agentName, timestamp: Date.now() });
    const state = this.workerStates.get(agentName) || {
      agent_name: agentName,
      state: WorkerStateEnum.CLOSED,
      consecutive_failures: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
    state.consecutive_failures = (state.consecutive_failures || 0) + 1;
    state.updated_at = new Date();
    state.last_failure_time = new Date();
    this.workerStates.set(agentName, state);
    return state;
  }

  async recordWorkerSuccess(agentName: string) {
    this.callLog.push({ method: "recordWorkerSuccess", agentName, timestamp: Date.now() });
    const state = this.workerStates.get(agentName) || {
      agent_name: agentName,
      state: WorkerStateEnum.CLOSED,
      consecutive_failures: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
    state.consecutive_failures = 0;
    state.updated_at = new Date();
    state.state = WorkerStateEnum.CLOSED;
    this.workerStates.set(agentName, state);
    return state;
  }

  async getWorkerState(agentName: string) {
    return this.workerStates.get(agentName) || null;
  }

  async openCircuit(agentName: string) {
    this.callLog.push({ method: "openCircuit", agentName, timestamp: Date.now() });
    const state = this.workerStates.get(agentName) || {
      agent_name: agentName,
      consecutive_failures: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
    state.state = WorkerStateEnum.OPEN;
    state.opened_at = new Date();
    state.updated_at = new Date();
    this.workerStates.set(agentName, state);
  }

  async transitionToHalfOpen(agentName: string) {
    const state = this.workerStates.get(agentName);
    if (state) {
      state.state = WorkerStateEnum.HALF_OPEN;
      state.updated_at = new Date();
    }
  }

  getCallLog() {
    return this.callLog;
  }

  clearCallLog() {
    this.callLog = [];
  }
}

describe("CircuitBreaker P7.7.2 - Full State Machine & NTFY Alerting", () => {
  describe("Basic State Machine", () => {
    it("starts in CLOSED state", () => {
      const cb = new CircuitBreaker();
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.CLOSED);
      expect(cb.canProcess("test-agent")).toBe(true);
      expect(cb.isTripped("test-agent")).toBe(false);
    });

    it("transitions to OPEN after 3 consecutive failures", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 3 });

      await cb.recordFailure(db, "test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.CLOSED);

      await cb.recordFailure(db, "test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.CLOSED);

      await cb.recordFailure(db, "test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.OPEN);
      expect(cb.canProcess("test-agent")).toBe(false);
      expect(cb.isTripped("test-agent")).toBe(true);
    });

    it("transitions to CLOSED on recordSuccess when already closed", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker();

      await cb.recordSuccess(db, "test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.CLOSED);
      expect(cb.canProcess("test-agent")).toBe(true);
    });

    it("transitions to CLOSED from OPEN on recordSuccess", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 2 });

      await cb.recordFailure(db, "test-agent");
      await cb.recordFailure(db, "test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.OPEN);

      await cb.recordSuccess(db, "test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.CLOSED);
      expect(cb.canProcess("test-agent")).toBe(true);
    });
  });

  describe("Failure Threshold Configuration", () => {
    it("respects custom maxConsecutiveFailures", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 1 });

      await cb.recordFailure(db, "test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.OPEN);
    });

    it("default threshold is 3", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker();

      await cb.recordFailure(db, "test-agent");
      await cb.recordFailure(db, "test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.CLOSED);

      await cb.recordFailure(db, "test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.OPEN);
    });
  });

  describe("Database Persistence", () => {
    it("calls db.recordWorkerFailure when recording failure", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 5 });

      await cb.recordFailure(db, "test-agent");

      const calls = db.getCallLog();
      expect(calls).toContainEqual(
        expect.objectContaining({
          method: "recordWorkerFailure",
          agentName: "test-agent",
        })
      );
    });

    it("calls db.recordWorkerSuccess when recording success", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker();

      await cb.recordSuccess(db, "test-agent");

      const calls = db.getCallLog();
      expect(calls).toContainEqual(
        expect.objectContaining({
          method: "recordWorkerSuccess",
          agentName: "test-agent",
        })
      );
    });

    it("calls db.openCircuit when state transitions to OPEN", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 2 });

      await cb.recordFailure(db, "test-agent");
      await cb.recordFailure(db, "test-agent");

      const calls = db.getCallLog();
      expect(calls).toContainEqual(
        expect.objectContaining({
          method: "openCircuit",
          agentName: "test-agent",
        })
      );
    });
  });

  describe("HALF_OPEN State & Recovery", () => {
    it("opens_at timestamp is set when circuit opens", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 1 });

      const beforeOpen = Date.now();
      await cb.recordFailure(db, "test-agent");
      const afterOpen = Date.now();

      expect(cb.getOpenedAt("test-agent")).toBeDefined();
      const openedAt = cb.getOpenedAt("test-agent")!.getTime();
      expect(openedAt).toBeGreaterThanOrEqual(beforeOpen);
      expect(openedAt).toBeLessThanOrEqual(afterOpen);
    });

    it("canProcess returns false when OPEN", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 1 });

      expect(cb.canProcess("test-agent")).toBe(true);
      await cb.recordFailure(db, "test-agent");
      expect(cb.canProcess("test-agent")).toBe(false);
    });

    it("canProcess returns true when HALF_OPEN", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 1 });

      await cb.recordFailure(db, "test-agent");
      expect(cb.canProcess("test-agent")).toBe(false);

      cb.attemptRecovery("test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.HALF_OPEN);
      expect(cb.canProcess("test-agent")).toBe(true);
    });

    it("attemptRecovery transitions OPEN to HALF_OPEN", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 1 });

      await cb.recordFailure(db, "test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.OPEN);

      cb.attemptRecovery("test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.HALF_OPEN);
    });

    it("attemptRecovery has no effect if not OPEN", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker();

      cb.attemptRecovery("test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.CLOSED);
    });

    it("auto-transitions OPEN to HALF_OPEN after 1 hour", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 1, probeIntervalMs: 100 });

      await cb.recordFailure(db, "test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.OPEN);

      // Manually set openedAtTimes to 101ms ago to trigger auto-recovery
      (cb as any).openedAtTimes.set("test-agent", new Date(Date.now() - 101));

      cb.checkAutoRecovery("test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.HALF_OPEN);
    });

    it("does not auto-recover if probeIntervalMs has not passed", () => {
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 1, probeIntervalMs: 60000 });

      // Force OPEN state manually
      (cb as any).agentStates.set("test-agent", WorkerStateEnum.OPEN);
      (cb as any).openedAtTimes.set("test-agent", new Date());

      cb.checkAutoRecovery("test-agent");
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.OPEN);
    });
  });

  describe("onCircuitOpen Callback", () => {
    it("fires onCircuitOpen callback when circuit opens", async () => {
      const onCircuitOpen = jest.fn();
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({
        maxConsecutiveFailures: 1,
        onCircuitOpen,
      });

      await cb.recordFailure(db, "test-agent");

      expect(onCircuitOpen).toHaveBeenCalledTimes(1);
      expect(onCircuitOpen).toHaveBeenCalledWith(
        "test-agent",
        expect.objectContaining({
          consecutive_failures: expect.any(Number),
        })
      );
    });

    it("fires onCircuitOpen only once when circuit opens", async () => {
      const onCircuitOpen = jest.fn();
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({
        maxConsecutiveFailures: 2,
        onCircuitOpen,
      });

      await cb.recordFailure(db, "test-agent");
      await cb.recordFailure(db, "test-agent");
      expect(onCircuitOpen).toHaveBeenCalledTimes(1);

      // Additional failures should not trigger callback again
      await cb.recordFailure(db, "test-agent");
      expect(onCircuitOpen).toHaveBeenCalledTimes(1);
    });

    it("does not fire callback if circuit is already open", async () => {
      const onCircuitOpen = jest.fn();
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({
        maxConsecutiveFailures: 1,
        onCircuitOpen,
      });

      await cb.recordFailure(db, "test-agent");
      onCircuitOpen.mockClear();

      await cb.recordFailure(db, "test-agent");
      expect(onCircuitOpen).not.toHaveBeenCalled();
    });
  });

  describe("Multiple Agents", () => {
    it("tracks state independently per agent", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 2 });

      await cb.recordFailure(db, "agent1");
      await cb.recordFailure(db, "agent2");

      // Both should still be CLOSED (only 1 failure each)
      expect(cb.getState("agent1")).toBe(WorkerStateEnum.CLOSED);
      expect(cb.getState("agent2")).toBe(WorkerStateEnum.CLOSED);

      // Third failure for agent1 opens it
      await cb.recordFailure(db, "agent1");
      expect(cb.getState("agent1")).toBe(WorkerStateEnum.OPEN);
      expect(cb.getState("agent2")).toBe(WorkerStateEnum.CLOSED);
    });
  });

  describe("Edge Cases", () => {
    it("handles zero maxConsecutiveFailures gracefully", () => {
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 0 });
      // Circuit should start closed even with 0 threshold
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.CLOSED);
    });

    it("isTripped is alias for state === OPEN", async () => {
      const db = new MockDatabaseManager() as any;
      const cb = new CircuitBreaker({ maxConsecutiveFailures: 1 });

      expect(cb.isTripped("test-agent")).toBe(false);
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.CLOSED);

      await cb.recordFailure(db, "test-agent");
      expect(cb.isTripped("test-agent")).toBe(true);
      expect(cb.getState("test-agent")).toBe(WorkerStateEnum.OPEN);
    });
  });
});
