import { WorkerStateEnum, WorkerState } from "./types";
import { DatabaseManager } from "./database";

/**
 * Circuit Breaker State Machine Configuration
 *
 * Controls circuit breaker behavior including failure threshold,
 * auto-recovery timing, and callback configuration.
 */
export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening circuit (default: 3) */
  maxConsecutiveFailures?: number;

  /** Milliseconds before auto-transitioning from OPEN to HALF_OPEN (default: 3600000 = 1 hour) */
  probeIntervalMs?: number;

  /** Callback fired when circuit transitions to OPEN state */
  onCircuitOpen?: (agentName: string, state: WorkerState) => void;
}

/**
 * Circuit Breaker for Action Queue Workers
 *
 * Implements full state machine: CLOSED → OPEN → HALF_OPEN → CLOSED
 *
 * - CLOSED: Normal operation, actions can execute
 * - OPEN: Failure threshold reached, actions blocked, openedAt timestamp recorded
 * - HALF_OPEN: Auto-recovery probe window, one action can attempt
 *
 * State persists to database via DatabaseManager for durability across restarts.
 * In-memory cache tracks per-agent state for performance.
 *
 * Auto-recovery: After probeIntervalMs (1 hour), automatically transitions OPEN→HALF_OPEN
 * to allow recovery probe. Full closure (HALF_OPEN→CLOSED) via recordSuccess.
 */
export class CircuitBreaker {
  private readonly maxConsecutiveFailures: number;
  private readonly probeIntervalMs: number;
  private readonly onCircuitOpen?: (agentName: string, state: WorkerState) => void;

  // Per-agent in-memory state cache
  private agentStates: Map<string, WorkerStateEnum> = new Map();
  private openedAtTimes: Map<string, Date> = new Map();
  private hasTrippedCallbackFired: Map<string, boolean> = new Map();

  constructor(options: CircuitBreakerOptions = {}) {
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
    this.probeIntervalMs = options.probeIntervalMs ?? 3600000; // 1 hour default
    this.onCircuitOpen = options.onCircuitOpen;
  }

  /**
   * Get current state for an agent (default: 'default' for backward compatibility)
   * Returns state enum directly instead of object
   */
  getState(agentName: string = "default"): WorkerStateEnum {
    return this.agentStates.get(agentName) ?? WorkerStateEnum.CLOSED;
  }

  /**
   * Record a worker failure
   *
   * Calls db.recordWorkerFailure to persist failure to database,
   * transitions to OPEN if threshold reached,
   * fires onCircuitOpen callback if state changes to OPEN.
   */
  async recordFailure(db: DatabaseManager, agentName: string): Promise<void> {
    // Get current state before update
    const currentState = this.getState(agentName);

    // Record failure in database
    const workerState = await db.recordWorkerFailure(agentName);

    // Determine new state based on consecutive failure count vs threshold
    let newState: WorkerStateEnum = WorkerStateEnum.CLOSED;
    if (workerState.consecutive_failures >= this.maxConsecutiveFailures) {
      newState = WorkerStateEnum.OPEN;
      // Call openCircuit to persist OPEN state to database
      if (currentState !== WorkerStateEnum.OPEN) {
        await db.openCircuit(agentName);
      }
    }

    // Update in-memory cache
    this.agentStates.set(agentName, newState);

    // If transitioning to OPEN, fire callback once and record openedAt
    if (
      currentState !== WorkerStateEnum.OPEN &&
      newState === WorkerStateEnum.OPEN &&
      !this.hasTrippedCallbackFired.get(agentName)
    ) {
      this.openedAtTimes.set(agentName, new Date());
      this.hasTrippedCallbackFired.set(agentName, true);
      this.onCircuitOpen?.(agentName, workerState);
    }
  }

  /**
   * Record a worker success
   *
   * Resets consecutive failures and transitions to CLOSED state.
   * Calls db.recordWorkerSuccess to persist to database.
   */
  async recordSuccess(db: DatabaseManager, agentName: string): Promise<void> {
    const workerState = await db.recordWorkerSuccess(agentName);

    // Update in-memory cache to CLOSED
    this.agentStates.set(agentName, WorkerStateEnum.CLOSED);
    this.openedAtTimes.delete(agentName);
    this.hasTrippedCallbackFired.set(agentName, false);
  }

  /**
   * Check if circuit can process actions
   *
   * Returns true only if CLOSED or HALF_OPEN.
   * Returns false if OPEN (circuit is tripped).
   */
  canProcess(agentName: string = "default"): boolean {
    const state = this.getState(agentName);
    return state === WorkerStateEnum.CLOSED || state === WorkerStateEnum.HALF_OPEN;
  }

  /**
   * Check if circuit is currently tripped (OPEN state)
   *
   * Alias for state === OPEN.
   */
  isTripped(agentName: string = "default"): boolean {
    return this.getState(agentName) === WorkerStateEnum.OPEN;
  }

  /**
   * Get timestamp when circuit was opened
   *
   * Returns undefined if circuit is not open or was never opened.
   */
  getOpenedAt(agentName: string = "default"): Date | undefined {
    return this.openedAtTimes.get(agentName);
  }

  /**
   * Manually attempt recovery (OPEN → HALF_OPEN)
   *
   * Has no effect if circuit is not OPEN.
   * Used for explicit recovery probes.
   */
  attemptRecovery(agentName: string = "default"): void {
    if (this.getState(agentName) !== WorkerStateEnum.OPEN) {
      return;
    }

    // Transition to HALF_OPEN
    this.agentStates.set(agentName, WorkerStateEnum.HALF_OPEN);
  }

  /**
   * Check and apply auto-recovery timeout
   *
   * If circuit has been OPEN for longer than probeIntervalMs,
   * automatically transition to HALF_OPEN to allow recovery probe.
   *
   * This is called periodically by the queue processor.
   */
  checkAutoRecovery(agentName: string = "default"): void {
    if (this.getState(agentName) !== WorkerStateEnum.OPEN) {
      return;
    }

    const openedAt = this.openedAtTimes.get(agentName);
    if (!openedAt) {
      return;
    }

    const timeSinceOpen = Date.now() - openedAt.getTime();
    if (timeSinceOpen >= this.probeIntervalMs) {
      this.attemptRecovery(agentName);
    }
  }
}
