/**
 * Circuit Breaker for Action Queue Workers
 *
 * Prevents cascading failures by stopping processing after 3 consecutive
 * non-rate-limit failures. Requires manual reset (admin action) to reopen.
 *
 * State machine: CLOSED (normal) → OPEN (tripped after threshold)
 * Intentionally simple: no half-open state, no timeout-based auto-recovery.
 */
export interface CircuitBreakerOptions {
  maxConsecutiveFailures?: number;
  onTripped?: (consecutiveFailures: number) => void;
}

export class CircuitBreaker {
  private consecutiveFailures = 0;
  private isOpen = false;
  private readonly maxConsecutiveFailures: number;
  private readonly onTripped?: (consecutiveFailures: number) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
    this.onTripped = options.onTripped;
  }

  /**
   * Record a successful action - resets the consecutive failure counter.
   */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.isOpen = false;
  }

  /**
   * Record a failed action. Trips the circuit after maxConsecutiveFailures.
   * Rate limit errors should NOT be passed here - only genuine errors.
   */
  recordFailure(): void {
    this.consecutiveFailures++;
    if (!this.isOpen && this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.isOpen = true;
      this.onTripped?.(this.consecutiveFailures);
    }
  }

  get isTripped(): boolean {
    return this.isOpen;
  }

  /**
   * Manually reset the circuit breaker (for admin/recovery use).
   */
  reset(): void {
    this.consecutiveFailures = 0;
    this.isOpen = false;
  }

  getState(): { isOpen: boolean; consecutiveFailures: number } {
    return {
      isOpen: this.isOpen,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
}
