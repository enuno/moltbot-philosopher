/**
 * Metrics Collection for Circuit Breaker Lifecycle Events
 *
 * Tracks all circuit breaker state transitions and recovery operations:
 * - Circuit opens/closes: How many times circuit has transitioned
 * - Recovery attempts: Manual resets and auto-probe outcomes
 * - Orphaned actions: Total actions reclaimed from limbo
 * - Success rates: Percentage of successful recovery operations
 *
 * All metrics are in-memory (reset on service restart).
 * For persistence, integrate with time-series database (Prometheus, InfluxDB).
 */

export interface MetricsSnapshot {
  circuit_opens: number;
  circuit_closes: number;
  recovery_attempts: number;
  recovery_success_rate: number;
  orphaned_actions_recovered: number;
}

export class MetricsCollector {
  private metrics = {
    circuit_opens: 0,
    circuit_closes: 0,
    recovery_attempts: 0,
    recovery_successes: 0,
    orphaned_actions_recovered: 0,
  };

  /**
   * Record circuit opened (CLOSED or HALF_OPEN → OPEN)
   * Called when circuit breaker detects threshold of consecutive failures
   */
  recordCircuitOpened(agentName: string): void {
    this.metrics.circuit_opens++;
  }

  /**
   * Record circuit closed (OPEN or HALF_OPEN → CLOSED)
   * Called on manual reset or successful recovery probe
   */
  recordCircuitClosed(agentName: string): void {
    this.metrics.circuit_closes++;
  }

  /**
   * Record recovery attempt (auto-probe or manual reset)
   * success=true if circuit transitioned to CLOSED
   * success=false if attempt failed or circuit remains OPEN
   */
  recordRecoveryAttempt(success: boolean): void {
    this.metrics.recovery_attempts++;
    if (success) {
      this.metrics.recovery_successes++;
    }
  }

  /**
   * Record orphaned actions recovered
   * Called after recoverOrphanedActions() completes
   */
  recordOrphanedActionsRecovered(count: number): void {
    this.metrics.orphaned_actions_recovered += count;
  }

  /**
   * Get current metrics snapshot
   * recovery_success_rate calculated as (successes / attempts * 100), default 0 if no attempts
   */
  getMetrics(): MetricsSnapshot {
    const successRate =
      this.metrics.recovery_attempts > 0
        ? (this.metrics.recovery_successes / this.metrics.recovery_attempts) * 100
        : 0;

    return {
      circuit_opens: this.metrics.circuit_opens,
      circuit_closes: this.metrics.circuit_closes,
      recovery_attempts: this.metrics.recovery_attempts,
      recovery_success_rate: parseFloat(successRate.toFixed(2)),
      orphaned_actions_recovered: this.metrics.orphaned_actions_recovered,
    };
  }

  /**
   * Reset all metrics (primarily for testing)
   */
  reset(): void {
    this.metrics = {
      circuit_opens: 0,
      circuit_closes: 0,
      recovery_attempts: 0,
      recovery_successes: 0,
      orphaned_actions_recovered: 0,
    };
  }
}

/**
 * Global singleton instance
 * Export for integration in index.ts and other modules
 */
export const metricsCollector = new MetricsCollector();
