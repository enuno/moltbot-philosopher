import { DatabaseManager } from "../src/database";
import { ActionType, ActionStatus, Priority, ConditionalAction } from "../src/types";

function makeAction(overrides: Partial<ConditionalAction> = {}): ConditionalAction {
  return {
    id: "test-action-1",
    agentName: "test-agent",
    actionType: ActionType.POST,
    priority: Priority.NORMAL,
    payload: { content: "Test" },
    status: ActionStatus.PENDING,
    createdAt: new Date(),
    attempts: 0,
    maxAttempts: 3,
    conditionCheckInterval: 60,
    ...overrides,
  };
}

describe("DatabaseManager - Backoff and Scheduler", () => {
  let db: DatabaseManager;

  beforeEach(() => {
    db = new DatabaseManager(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  describe("updateScheduledFor", () => {
    it("should update the scheduled_for timestamp", () => {
      const action = makeAction({ status: ActionStatus.SCHEDULED });
      db.insertAction(action);

      const future = new Date(Date.now() + 60_000);
      db.updateScheduledFor("test-action-1", future);

      const retrieved = db.getAction("test-action-1");
      expect(retrieved?.scheduledFor).toBeDefined();
      // SQLite stores as Unix seconds, so allow up to 1s of rounding
      const diff = Math.abs(retrieved!.scheduledFor!.getTime() - future.getTime());
      expect(diff).toBeLessThan(1001);
    });
  });

  describe("activateReadyScheduledActions", () => {
    it("should activate a scheduled action whose time has passed", () => {
      const past = new Date(Date.now() - 10_000);
      const action = makeAction({
        id: "sched-past",
        status: ActionStatus.SCHEDULED,
        scheduledFor: past,
      });
      db.insertAction(action);
      db.updateActionStatus("sched-past", ActionStatus.SCHEDULED);
      db.updateScheduledFor("sched-past", past);

      const activated = db.activateReadyScheduledActions();
      expect(activated).toBe(1);

      const retrieved = db.getAction("sched-past");
      expect(retrieved?.status).toBe(ActionStatus.PENDING);
    });

    it("should not activate a scheduled action whose time has not yet passed", () => {
      const future = new Date(Date.now() + 60_000);
      const action = makeAction({
        id: "sched-future",
        status: ActionStatus.SCHEDULED,
        scheduledFor: future,
      });
      db.insertAction(action);
      db.updateActionStatus("sched-future", ActionStatus.SCHEDULED);
      db.updateScheduledFor("sched-future", future);

      const activated = db.activateReadyScheduledActions();
      expect(activated).toBe(0);

      const retrieved = db.getAction("sched-future");
      expect(retrieved?.status).toBe(ActionStatus.SCHEDULED);
    });

    it("should not activate conditional actions (conditions IS NOT NULL)", () => {
      const past = new Date(Date.now() - 10_000);
      const action = makeAction({
        id: "cond-action",
        status: ActionStatus.SCHEDULED,
        scheduledFor: past,
        conditions: {
          type: "all",
          conditions: [{ id: "c1", type: "custom", params: {} }],
        } as any,
      });
      db.insertAction(action);
      db.updateActionStatus("cond-action", ActionStatus.SCHEDULED);
      db.updateScheduledFor("cond-action", past);

      const activated = db.activateReadyScheduledActions();
      expect(activated).toBe(0);

      const retrieved = db.getAction("cond-action");
      expect(retrieved?.status).toBe(ActionStatus.SCHEDULED);
    });

    it("should activate multiple overdue actions in one call", () => {
      const past = new Date(Date.now() - 5_000);
      for (const id of ["a1", "a2", "a3"]) {
        const action = makeAction({ id, status: ActionStatus.SCHEDULED, scheduledFor: past });
        db.insertAction(action);
        db.updateActionStatus(id, ActionStatus.SCHEDULED);
        db.updateScheduledFor(id, past);
      }

      const activated = db.activateReadyScheduledActions();
      expect(activated).toBe(3);

      for (const id of ["a1", "a2", "a3"]) {
        expect(db.getAction(id)?.status).toBe(ActionStatus.PENDING);
      }
    });

    it("should return 0 when no scheduled actions exist", () => {
      const activated = db.activateReadyScheduledActions();
      expect(activated).toBe(0);
    });
  });

  describe("retry backoff integration", () => {
    it("getNextAction should not return a scheduled action", () => {
      const future = new Date(Date.now() + 60_000);
      const action = makeAction({
        id: "retry-backoff",
        status: ActionStatus.SCHEDULED,
        scheduledFor: future,
      });
      db.insertAction(action);
      db.updateActionStatus("retry-backoff", ActionStatus.SCHEDULED);
      db.updateScheduledFor("retry-backoff", future);

      // Should not appear in the processing queue
      const next = db.getNextAction();
      expect(next).toBeNull();
    });

    it("getNextAction should return an action once its scheduled time passes", () => {
      const past = new Date(Date.now() - 5_000);
      const action = makeAction({
        id: "ready-retry",
        status: ActionStatus.SCHEDULED,
        scheduledFor: past,
      });
      db.insertAction(action);
      db.updateActionStatus("ready-retry", ActionStatus.SCHEDULED);
      db.updateScheduledFor("ready-retry", past);

      // Activate it
      db.activateReadyScheduledActions();

      const next = db.getNextAction();
      expect(next?.id).toBe("ready-retry");
    });
  });
});
