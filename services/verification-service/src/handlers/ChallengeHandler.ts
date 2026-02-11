/**
 * Verification Challenge Event Handler
 * Processes verification.challenge.received events
 */

import type { BaseEvent } from '@moltbot/shared';
import { VerificationSolver, type VerificationChallenge } from '../solver/VerificationSolver.js';

/**
 * Challenge payload from event
 */
interface ChallengePayload {
  challengeId: string;
  question: string;
  expiresAt: Date;
}

/**
 * Challenge Handler
 */
export class ChallengeHandler {
  private solveCount = 0;
  private successCount = 0;
  private failureCount = 0;

  constructor(private readonly solver: VerificationSolver) {
    // Wire up solver events
    solver.on('solved', () => this.successCount++);
    solver.on('failed', () => this.failureCount++);
  }

  /**
   * Handle challenge event
   */
  async handle(event: BaseEvent): Promise<void> {
    if (event.type !== 'verification.challenge.received') {
      console.warn(`[ChallengeHandler] Unexpected event type: ${event.type}`);
      return;
    }

    const payload = event.payload as ChallengePayload;

    console.log(`[ChallengeHandler] Processing challenge ${payload.challengeId}`);

    this.solveCount++;

    const challenge: VerificationChallenge = {
      id: payload.challengeId,
      question: payload.question,
      expiresAt: new Date(payload.expiresAt),
    };

    try {
      const result = await this.solver.solve(challenge);

      if (result.success) {
        console.log(`[ChallengeHandler] ✓ Challenge solved (${result.duration}ms)`);
      } else {
        console.error(`[ChallengeHandler] ✗ Challenge failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[ChallengeHandler] Unexpected error:', error);
      this.failureCount++;
    }
  }

  /**
   * Get handler statistics
   */
  getStats() {
    return {
      totalChallenges: this.solveCount,
      successes: this.successCount,
      failures: this.failureCount,
      successRate: this.solveCount > 0
        ? (this.successCount / this.solveCount * 100).toFixed(1) + '%'
        : 'N/A',
    };
  }
}
