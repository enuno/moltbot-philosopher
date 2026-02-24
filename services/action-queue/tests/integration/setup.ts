import { DatabaseManager } from "../../src/database";
import { ActionType, ActionStatus, Priority, ConditionalAction } from "../../src/types";

/**
 * Initialize test database (in-memory SQLite)
 */
export async function initializeTestDatabase(): Promise<DatabaseManager> {
  const db = new DatabaseManager(":memory:");
  // Tables are created automatically by DatabaseManager constructor
  return db;
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(db: DatabaseManager): Promise<void> {
  // Clear all tables
  const rawDb = db.getDb();
  const tables = ["condition_evaluations", "rate_limits", "agents", "actions"];

  for (const table of tables) {
    try {
      const stmt = rawDb.prepare(`DELETE FROM ${table}`);
      stmt.run();
    } catch (e) {
      // Table might not exist, ignore
    }
  }

  db.close();
}

/**
 * Create test action with sensible defaults
 */
export function createTestAction(overrides: Partial<ConditionalAction> = {}): ConditionalAction {
  const baseAction: ConditionalAction = {
    id: `test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    agentName: "test-agent",
    actionType: ActionType.POST,
    priority: Priority.NORMAL,
    payload: { submolt: "General", content: "Test post" },
    status: ActionStatus.PENDING,
    createdAt: new Date(),
    attempts: 0,
    maxAttempts: 3,
    conditionCheckInterval: 60,
  };

  return { ...baseAction, ...overrides };
}

/**
 * Create test agent record
 */
export function createTestAgent(
  agentName: string = "test-agent",
  isNew: boolean = true,
): { agentName: string; isNew: boolean } {
  return { agentName, isNew };
}

/**
 * Get raw database connection for direct queries
 */
export function getDatabaseConnection(db: DatabaseManager): any {
  return db.getDb();
}
