/**
 * Verification Challenge Poller
 * Fast polling for verification challenges (60s intervals)
 */

import type { BaseEvent } from '@moltbot/shared';
import { createEvent } from '@moltbot/shared';
import { EventEmitter } from 'events';

/**
 * Verification challenge from API
 */
interface VerificationChallenge {
  id: string;
  question: string;
  expiresAt: string;
}

/**
 * Verification Poller configuration
 */
export interface VerificationPollerConfig {
  apiKey: string;
  baseUrl: string;
  pollIntervalMs: number;
}

/**
 * Verification Challenge Poller
 */
export class VerificationPoller extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastCheckTime: Date | null = null;

  constructor(private readonly config: VerificationPollerConfig) {
    super();
  }

  /**
   * Start polling
   */
  start(): void {
    if (this.intervalId) {
      console.warn('[VerificationPoller] Already polling');
      return;
    }

    console.log(`[VerificationPoller] Starting (interval: ${this.config.pollIntervalMs}ms)`);

    // Poll immediately, then on interval
    this.poll();
    this.intervalId = setInterval(() => this.poll(), this.config.pollIntervalMs);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[VerificationPoller] Stopped');
    }
  }

  /**
   * Poll for verification challenges
   */
  private async poll(): Promise<void> {
    if (this.isPolling) {
      console.warn('[VerificationPoller] Previous poll still running, skipping');
      return;
    }

    this.isPolling = true;

    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/agents/me/verification-challenges`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { challenges?: VerificationChallenge[] };
      const challenges: VerificationChallenge[] = data.challenges || [];

      this.lastCheckTime = new Date();

      if (challenges.length > 0) {
        console.log(`[VerificationPoller] Found ${challenges.length} challenge(s)`);

        for (const challenge of challenges) {
          const event = this.createChallengeEvent(challenge);
          this.emit('challenge', event);
        }
      }

      this.emit('poll:success', { challengeCount: challenges.length });
    } catch (error) {
      console.error('[VerificationPoller] Poll failed:', error);
      this.emit('poll:error', error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Create challenge event
   */
  private createChallengeEvent(challenge: VerificationChallenge): BaseEvent {
    return createEvent(
      'verification.challenge.received',
      {
        challengeId: challenge.id,
        question: challenge.question,
        expiresAt: new Date(challenge.expiresAt),
      },
      {
        priority: 'critical',
        source: 'event-listener',
      }
    );
  }

  /**
   * Get last check time
   */
  getLastCheckTime(): Date | null {
    return this.lastCheckTime;
  }

  /**
   * Get polling status
   */
  isActive(): boolean {
    return this.intervalId !== null;
  }
}
