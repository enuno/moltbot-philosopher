import express, { Express } from 'express';
import { DatabaseManager } from '../../src/database';
import { QueueProcessor } from '../../src/queue-processor';
import { RateLimiter } from '../../src/rate-limiter';
import { ActionStatus } from '../../src/types';

/**
 * Mock ActionExecutor to return deterministic results
 */
export class MockActionExecutor {
  private shouldSucceed = true;
  private delayMs = 0;

  setShouldSucceed(success: boolean): void {
    this.shouldSucceed = success;
  }

  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  async execute(
    action: any
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    if (this.shouldSucceed) {
      return { success: true, result: { actionId: action.id } };
    }

    return { success: false, error: 'Mock execution failed' };
  }
}

/**
 * Advance fake timers
 */
export function advanceTime(ms: number): void {
  jest.advanceTimersByTime(ms);
}

/**
 * Wait for a condition to be satisfied (polling)
 */
export async function waitForCondition(
  condition: () => boolean,
  timeoutMs: number = 5000,
  pollIntervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Timeout waiting for condition');
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

/**
 * Query database directly
 */
export function queryDatabase(
  db: DatabaseManager,
  sql: string,
  params: any[] = []
): any {
  const rawDb = db.getDb();
  const stmt = rawDb.prepare(sql);

  if (params.length === 0) {
    return stmt.all();
  }

  return stmt.all(...params);
}

/**
 * Query database for a single row
 */
export function queryDatabaseRow(
  db: DatabaseManager,
  sql: string,
  params: any[] = []
): any {
  const rawDb = db.getDb();
  const stmt = rawDb.prepare(sql);

  if (params.length === 0) {
    return stmt.get();
  }

  return stmt.get(...params);
}

/**
 * Create test Express app with mocked dependencies
 */
export function createTestApp(
  db: DatabaseManager,
  mockExecutor?: MockActionExecutor
): Express {
  const app = express();
  app.use(express.json());

  const processor = new QueueProcessor(db);
  const rateLimiter = new RateLimiter(db);

  // Health check endpoint
  app.get('/queue/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Queue stats endpoint
  app.get('/queue/stats', (req, res) => {
    try {
      const stats = processor.getStats();
      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Submit action endpoint
  app.post('/actions', async (req, res) => {
    try {
      const { agentName, actionType, priority, payload, scheduledFor, conditions, metadata } =
        req.body;

      const action = {
        id: `test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        agentName,
        actionType,
        priority: priority || 1,
        payload,
        status: scheduledFor || conditions ? ActionStatus.SCHEDULED : ActionStatus.PENDING,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        conditions,
        metadata,
        conditionCheckInterval: 60,
      };

      db.insertAction(action);

      res.status(201).json({
        success: true,
        action: {
          id: action.id,
          status: action.status,
          createdAt: action.createdAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Get action endpoint
  app.get('/actions/:id', (req, res) => {
    try {
      const action = db.getAction(req.params.id);

      if (!action) {
        return res.status(404).json({
          success: false,
          error: 'Action not found',
        });
      }

      res.json({
        success: true,
        action,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Process queue endpoint (for testing)
  app.post('/queue/process', async (req, res) => {
    try {
      // This is a test helper - processes one action
      const nextAction = db.getNextAction();

      if (!nextAction) {
        return res.json({
          success: true,
          processed: 0,
          message: 'No pending actions',
        });
      }

      // Update status to processing
      db.updateActionStatus(nextAction.id, ActionStatus.PROCESSING);

      // Execute (mock or real)
      let result: { success: boolean; result?: any; error?: string } = { success: true };
      if (mockExecutor) {
        result = await mockExecutor.execute(nextAction);
      }

      if (result.success) {
        db.updateActionStatus(nextAction.id, ActionStatus.COMPLETED);
      } else {
        db.updateActionStatus(nextAction.id, ActionStatus.FAILED, result.error || 'Unknown error');
      }

      res.json({
        success: true,
        processed: 1,
        actionId: nextAction.id,
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return app;
}
