# Phase 7.7: Circuit Breaker for Action Workers - Implementation Plan

**Goal**: Implement auto-disable mechanism for workers after 3 consecutive failures with atomic action claiming and automatic recovery.

**Architecture**: Worker state machine (CLOSED → OPEN → HALF_OPEN → CLOSED) persisted in PostgreSQL. Circuit opens <1s after 3rd failure. Critical alerts via NTFY <5s. Zero duplicate action processing via atomic UPDATEs. Automatic recovery >80% success rate.

**Tech Stack**: TypeScript (action-queue service), PostgreSQL (worker_state table), pg-boss (queue), NTFY (alerts), Jest (tests).

---

## Task 1: P7.7.1 - Failure Tracking Infrastructure

**Files**:
- Modify: `services/action-queue/src/database.ts` (add worker_state table + methods)
- Modify: `services/action-queue/src/types.ts` (add WorkerState types)
- Create: `services/action-queue/src/__tests__/failure-tracking.test.ts`

**Step 1: Add WorkerState types**

```typescript
// In types.ts, add:
export enum WorkerStateEnum {
  CLOSED = "CLOSED",      // Normal operation
  OPEN = "OPEN",          // Circuit tripped, not processing
  HALF_OPEN = "HALF_OPEN", // Testing recovery
}

export interface WorkerState {
  agent_name: string;
  state: WorkerStateEnum;
  consecutive_failures: number;
  last_failure_time: Date | null;
  failure_reset_at: Date | null;  // When failures will reset (1 hour after last)
  opened_at: Date | null;         // When circuit opened
  created_at: Date;
  updated_at: Date;
}
```

**Step 2: Add worker_state table to DatabaseManager.createCustomTables()**

```sql
CREATE TABLE IF NOT EXISTS worker_state (
  agent_name TEXT PRIMARY KEY,
  state TEXT DEFAULT 'CLOSED',
  consecutive_failures INT DEFAULT 0,
  last_failure_time TIMESTAMP,
  failure_reset_at TIMESTAMP,
  opened_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_worker_state_updated ON worker_state(updated_at DESC);
```

**Step 3: Add methods to DatabaseManager**

- `recordWorkerFailure(agentName: string): Promise<WorkerState>` - Increment consecutive_failures, return updated state
- `recordWorkerSuccess(agentName: string): Promise<WorkerState>` - Reset failures to 0
- `getWorkerState(agentName: string): Promise<WorkerState | null>` - Fetch current state
- `openCircuit(agentName: string): Promise<void>` - Set state to OPEN, opened_at timestamp
- `resetFailures(agentName: string): Promise<void>` - Reset to 0 if enough time passed

**Step 4: Write failing tests**

```typescript
describe('Failure Tracking', () => {
  it('should increment consecutive_failures on recordWorkerFailure', async () => {
    const state = await db.recordWorkerFailure('classical');
    expect(state.consecutive_failures).toBe(1);
  });

  it('should reset failures to 0 on recordWorkerSuccess', async () => {
    await db.recordWorkerFailure('classical');
    const state = await db.recordWorkerSuccess('classical');
    expect(state.consecutive_failures).toBe(0);
  });

  it('should auto-reset failures after 1 hour of no failures', async () => {
    // Simulate old failure
    const state = await db.recordWorkerFailure('classical');
    // Manually set failure_reset_at to past
    await db.query('UPDATE worker_state SET failure_reset_at = NOW() - INTERVAL \'61 minutes\'');
    const reset = await db.resetFailures('classical');
    expect(reset.consecutive_failures).toBe(0);
  });
});
```

**Step 5: Run tests, implement code**

Run tests with `npm test -- failure-tracking.test.ts`, implement methods, verify all tests pass.

**Step 6: Commit**

```bash
git add services/action-queue/src/{database.ts,types.ts,__tests__/failure-tracking.test.ts}
git commit -m "feat(p7.7.1): Add worker_state table and failure tracking methods"
```

---

## Task 2: P7.7.2 - Circuit Breaker State Machine & Alerting

**Files**:
- Modify: `services/action-queue/src/circuit-breaker.ts` (expand to full state machine)
- Modify: `services/action-queue/src/queue-processor.ts` (integrate circuit breaker checks)
- Create: `services/action-queue/src/alerting.ts` (NTFY integration)
- Create: `services/action-queue/src/__tests__/circuit-breaker.test.ts`

**Step 1: Enhance CircuitBreaker class**

```typescript
export class CircuitBreaker {
  private state: WorkerStateEnum = WorkerStateEnum.CLOSED;
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures: number;
  private lastFailureTime: Date | null = null;
  private openedAt: Date | null = null;
  private readonly onTripped?: (failures: number) => Promise<void>;
  private readonly halfOpenProbeInterval = 60000; // 1 minute
  private lastProbeAttempt: Date | null = null;

  // Methods:
  // recordFailure(): update state, trip to OPEN if needed, call onTripped()
  // recordSuccess(): reset to CLOSED
  // getState(): return current state (CLOSED/OPEN/HALF_OPEN)
  // canProcess(): return true if CLOSED or HALF_OPEN
  // isTripped(): alias for getState() === OPEN
  // attemptRecovery(): if HALF_OPEN, try to move to CLOSED
}
```

**Step 2: Create alerting.ts**

```typescript
export async function sendCircuitAlert(
  agentName: string,
  consecutiveFailures: number,
  lastError?: string
): Promise<void> {
  const message = `
🚨 CIRCUIT BREAKER OPEN: ${agentName}
Consecutive failures: ${consecutiveFailures}
Last error: ${lastError || 'unknown'}
Action: Worker auto-disabled. Manual recovery required.
  `.trim();

  // Send to NTFY (or similar alerting)
  await fetch(process.env.NTFY_URL, {
    method: 'POST',
    headers: { 'Title': 'Circuit Breaker Tripped' },
    body: message,
  });
}
```

**Step 3: Write tests**

```typescript
describe('Circuit Breaker State Machine', () => {
  it('should transition CLOSED → OPEN after 3 consecutive failures', async () => {
    const cb = new CircuitBreaker({ maxConsecutiveFailures: 3 });
    expect(cb.getState()).toBe(WorkerStateEnum.CLOSED);
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe(WorkerStateEnum.CLOSED); // Not yet
    cb.recordFailure();
    expect(cb.getState()).toBe(WorkerStateEnum.OPEN); // Tripped
  });

  it('should call onTripped callback when circuit opens', async () => {
    const onTripped = jest.fn();
    const cb = new CircuitBreaker({ maxConsecutiveFailures: 3, onTripped });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(onTripped).toHaveBeenCalledWith(3);
  });

  it('should reject processing when OPEN', async () => {
    const cb = new CircuitBreaker({ maxConsecutiveFailures: 1 });
    cb.recordFailure();
    expect(cb.canProcess()).toBe(false);
  });

  it('should reset failures on success', async () => {
    const cb = new CircuitBreaker({ maxConsecutiveFailures: 3 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.getState()).toBe(WorkerStateEnum.CLOSED);
  });
});
```

**Step 4-6: Implement, test, commit**

**Success Criteria**: Circuit opens <1s after 3rd failure, NTFY alert fires <5s, all tests pass.

---

## Task 3: P7.7.3 - Atomic Action Claiming

**Files**:
- Modify: `services/action-queue/src/database.ts` (add atomic claim methods)
- Modify: `services/action-queue/src/queue-processor.ts` (use atomic claiming)
- Create: `services/action-queue/src/__tests__/atomic-claiming.test.ts`

**Step 1: Add action_claims table**

```sql
CREATE TABLE IF NOT EXISTS action_claims (
  job_id UUID PRIMARY KEY,
  agent_name TEXT NOT NULL,
  claimed_at TIMESTAMP DEFAULT NOW(),
  claimed_by_worker_pid INT,
  timeout_at TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES action_logs(job_id)
);

CREATE INDEX idx_action_claims_timeout ON action_claims(timeout_at);
```

**Step 2: Add methods to DatabaseManager**

- `claimAction(jobId: string, agentName: string, timeoutSeconds: number = 300): Promise<boolean>` - Atomically INSERT claim, return true if succeeded
- `releaseClaim(jobId: string): Promise<void>` - DELETE claim
- `findOrphanedActions(agentName?: string): Promise<string[]>` - Find claims with timeout_at < NOW()
- `reclaimOrphanedAction(jobId: string): Promise<boolean>` - Release orphaned claim

**Step 3: Write tests**

```typescript
describe('Atomic Action Claiming', () => {
  it('should atomically claim an action', async () => {
    const jobId = 'test-job-123';
    const claimed = await db.claimAction(jobId, 'classical', 300);
    expect(claimed).toBe(true);
  });

  it('should prevent duplicate claims (second attempt fails)', async () => {
    const jobId = 'test-job-456';
    await db.claimAction(jobId, 'classical', 300);
    const secondAttempt = await db.claimAction(jobId, 'beat', 300); // Different agent
    expect(secondAttempt).toBe(false);
  });

  it('should find orphaned actions (timeout exceeded)', async () => {
    const jobId = 'orphan-job';
    await db.claimAction(jobId, 'classical', 1); // 1 second timeout
    await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for timeout
    const orphans = await db.findOrphanedActions();
    expect(orphans).toContain(jobId);
  });

  it('should allow reclaiming orphaned actions', async () => {
    const jobId = 'orphan-reclaim';
    await db.claimAction(jobId, 'classical', 1);
    await new Promise(resolve => setTimeout(resolve, 1100));
    const reclaimed = await db.reclaimOrphanedAction(jobId);
    expect(reclaimed).toBe(true);
  });
});
```

**Step 4-6: Implement, test, commit**

**Success Criteria**: Zero duplicate action processing, orphaned actions recovered <5min, all tests pass.

---

## Task 4: P7.7.4 - Recovery Mechanisms

**Files**:
- Create: `services/action-queue/src/recovery-engine.ts`
- Modify: `services/action-queue/src/index.ts` (add recovery endpoints)
- Create: `services/action-queue/scripts/recovery-cli.ts`
- Create: `services/action-queue/src/__tests__/recovery.test.ts`

**Step 1: Create RecoveryEngine**

```typescript
export class RecoveryEngine {
  constructor(private db: DatabaseManager, private alerting: AlertingService) {}

  async startAutoRecoveryProbe(intervalSeconds: number = 3600) {
    // Every 1 hour, probe workers in OPEN state
    // Attempt to move HALF_OPEN, run test action
    // If success, move to CLOSED; if fail, stay OPEN
  }

  async manualReset(agentName: string): Promise<void> {
    // Reset circuit to CLOSED, log admin action
  }

  async recoverOrphanedActions(): Promise<number> {
    // Find all orphaned actions, reclaim them, return count
  }

  async exponentialBackoff(attempt: number): Promise<number> {
    // Return delay in ms: Math.min(300000, 1000 * Math.pow(2, attempt))
  }
}
```

**Step 2: Add HTTP endpoints**

- `POST /recovery/reset/:agentName` - Manual reset (admin protected)
- `POST /recovery/probe` - Trigger auto-recovery probe
- `GET /recovery/status/:agentName` - Get circuit state
- `POST /recovery/orphaned/reclaim` - Reclaim orphaned actions

**Step 3: Create recovery CLI**

```bash
# Usage examples:
npm run recovery -- reset classical
npm run recovery -- status beat
npm run recovery -- probe
npm run recovery -- orphaned
```

**Step 4-6: Implement, test, commit**

---

## Task 5: P7.7.5 - Testing & Monitoring

**Files**:
- Create: `services/action-queue/src/__tests__/e2e-circuit-breaker.test.ts`
- Create: `services/action-queue/src/metrics.ts`
- Modify: `services/action-queue/src/index.ts` (add /metrics endpoint)

**Step 1: E2E circuit breaker test**

Simulate 3+ failures → circuit opens → manual reset → circuit closes

**Step 2: Chaos testing**

Inject random failures, verify circuit trips correctly and recovers

**Step 3: Metrics collection**

Track: circuit_opens, circuit_closes, recovery_attempts, recovery_success_rate, orphaned_actions_recovered

**Step 4: Health check endpoint**

`GET /health` returns circuit state + recovery status for all agents

**Step 5-6: All tests pass, commit**

---

## Task 6: P7.7.6 - Documentation

**Files**:
- Create: `docs/operator-runbook-circuit-breaker.md`
- Create: `docs/CIRCUIT_BREAKER_ARCHITECTURE.md`
- Modify: `README.md` (add circuit breaker section)

**Runbook covers**:
- How to detect circuit breaker trips
- Manual reset procedures
- Monitoring dashboards
- Troubleshooting guide

**Architecture doc covers**:
- State machine diagram
- Atomic claiming mechanism
- Recovery probe design
- Failure recovery flow

---

## Testing Plan

**Unit tests**: 50+ tests across failure tracking, circuit breaker, atomic claiming, recovery
**Integration tests**: Full workflow: 3 failures → circuit opens → alert fires → manual reset → circuit closes
**Chaos tests**: Random failure injection, verify resilience
**E2E tests**: Real action execution with circuit breaker engaged

NOTE: I will write *all* tests before implementing functionality using TDD.

---

## Testing Details

Tests validate BEHAVIOR not implementation:
- Circuit opens after exactly 3 consecutive failures (not internal state)
- Alerts fire synchronously when circuit trips
- Atomic claims prevent duplicate action processing
- Orphaned actions auto-recover within 5 minutes
- Manual recovery resets circuit immediately
- Half-open probe successfully transitions to CLOSED on success

## Implementation Details

- WorkerState persisted in PostgreSQL for cross-process consistency
- Atomic UPDATEs use WHERE conditions to prevent race conditions
- NTFY alerts bypass rate limiting (critical alerts)
- Recovery probe uses exponential backoff (1s, 2s, 4s, 8s, 16s...)
- Orphan timeout = 5 minutes (longer than normal action timeout of 3 minutes)
- Manual recovery endpoint requires admin authentication (bearer token)

## Questions

- Should circuit breaker state be per-agent or global?
- NTFY URL configured via environment variable or hardcoded?
- Do you want Grafana dashboard as part of P7.7.5 or separate task?
