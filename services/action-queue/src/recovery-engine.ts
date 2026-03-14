import { Logger } from '@moltbook/logger';
import { DatabaseManager } from './database';
import { AlertingService } from './alerting';
import { CircuitBreaker } from './circuit-breaker';
import { WorkerStateEnum } from './types';

const logger = new Logger('recovery-engine');

export class RecoveryEngine {
  private recoveryProbeInterval: NodeJS.Timer | null = null;
  private readonly probeIntervalMs: number;

  constructor(
    private db: DatabaseManager,
    private alerting: AlertingService,
    private circuitBreaker: CircuitBreaker
  ) {
    this.probeIntervalMs = parseInt(process.env.RECOVERY_PROBE_INTERVAL_MS || '3600000', 10);
  }

  /**
   * Start automatic recovery probe on interval
   * Transitions workers from OPEN → HALF_OPEN → CLOSED on successful heartbeat
   */
  async startAutoRecoveryProbe(intervalSeconds: number = 3600): Promise<void> {
    const intervalMs = intervalSeconds * 1000;

    if (this.recoveryProbeInterval) {
      clearInterval(this.recoveryProbeInterval);
    }

    logger.info('Starting auto-recovery probe', { intervalMs });

    // Run probe immediately
    await this.runRecoveryProbe();

    // Schedule recurring probe
    this.recoveryProbeInterval = setInterval(() => {
      this.runRecoveryProbe().catch(err => {
        logger.error('Auto-recovery probe failed', { error: err });
      });
    }, intervalMs);
  }

  /**
   * Single recovery probe run
   * Attempts to recover all OPEN circuits
   */
  private async runRecoveryProbe(): Promise<void> {
    logger.info('Running recovery probe');

    try {
      // Fetch all workers in OPEN state
      const openWorkers = await this.db.query(
        `SELECT agent_name FROM worker_state WHERE state = $1`,
        [WorkerStateEnum.OPEN]
      );

      for (const row of openWorkers.rows) {
        const agentName = row.agent_name;

        try {
          // Transition to HALF_OPEN
          await this.db.query(
            `UPDATE worker_state SET state = $1 WHERE agent_name = $2`,
            [WorkerStateEnum.HALF_OPEN, agentName]
          );

          logger.info('Transitioned to HALF_OPEN', { agent_name: agentName });

          // Run heartbeat test (database query)
          const testResult = await this.db.query('SELECT 1');

          if (testResult.rows.length > 0) {
            // Test succeeded - transition to CLOSED
            await this.db.resetFailures(agentName);
            await this.db.query(
              `UPDATE worker_state SET state = $1, consecutive_failures = 0 WHERE agent_name = $2`,
              [WorkerStateEnum.CLOSED, agentName]
            );

            logger.info('Circuit closed', { agent_name: agentName });

            // Send recovery notification
            await this.alerting.sendCircuitAlert(
              agentName,
              0,
              'Circuit breaker recovered after probe'
            );
          } else {
            // Test failed - revert to OPEN
            await this.db.recordWorkerFailure(agentName);
            logger.warn('Recovery probe failed, reverting to OPEN', { agent_name: agentName });
          }
        } catch (err) {
          logger.error('Recovery probe error for agent', { agent_name: agentName, error: err });
          // Revert to OPEN on any error
          await this.db.query(
            `UPDATE worker_state SET state = $1 WHERE agent_name = $2`,
            [WorkerStateEnum.OPEN, agentName]
          );
        }
      }
    } catch (err) {
      logger.error('Recovery probe run failed', { error: err });
    }
  }

  /**
   * Manually reset circuit to CLOSED (admin operation)
   */
  async manualReset(agentName: string, adminToken?: string): Promise<void> {
    try {
      // Reset to CLOSED
      await this.db.query(
        `UPDATE worker_state SET state = $1, consecutive_failures = 0, opened_at = NULL WHERE agent_name = $2`,
        [WorkerStateEnum.CLOSED, agentName]
      );

      // Audit log
      logger.audit({
        action: 'recovery_manual_reset',
        agent_name: agentName,
        admin_token_hash: adminToken ? adminToken.substring(0, 8) : 'unknown',
        timestamp: new Date().toISOString()
      });

      logger.info('Manual reset completed', { agent_name: agentName });

      // Send notification
      await this.alerting.sendCircuitAlert(
        agentName,
        0,
        'Manual reset by admin'
      );
    } catch (err) {
      logger.error('Manual reset failed', { agent_name: agentName, error: err });
      throw err;
    }
  }

  /**
   * Recover all orphaned actions and reclaim them
   */
  async recoverOrphanedActions(): Promise<number> {
    try {
      const orphans = await this.db.findOrphanedActions();
      let recovered = 0;

      for (const jobId of orphans) {
        const success = await this.db.reclaimOrphanedAction(jobId);
        if (success) {
          recovered++;
          logger.debug('Reclaimed orphaned action', { job_id: jobId });
        }
      }

      logger.info('Orphaned action recovery complete', { count: recovered });
      return recovered;
    } catch (err) {
      logger.error('Orphaned action recovery failed', { error: err });
      throw err;
    }
  }

  /**
   * Calculate exponential backoff delay
   * Attempt 0 = 1s, 1 = 2s, 2 = 4s, ..., capped at 300s
   */
  async exponentialBackoff(attempt: number): Promise<number> {
    const baseMs = 1000; // 1 second
    const maxDelayMs = 300000; // 5 minutes
    const delayMs = Math.min(
      baseMs * Math.pow(2, attempt),
      maxDelayMs
    );
    return delayMs;
  }

  /**
   * Stop the recovery probe interval
   */
  stopAutoRecoveryProbe(): void {
    if (this.recoveryProbeInterval) {
      clearInterval(this.recoveryProbeInterval);
      this.recoveryProbeInterval = null;
      logger.info('Stopped auto-recovery probe');
    }
  }
}
