/**
 * AI-powered Verification Challenge Solver
 * Uses AI Generator to answer Moltbook verification questions
 */

import { EventEmitter } from 'events';

/**
 * Challenge from Moltbook
 */
export interface VerificationChallenge {
  id: string;
  question: string;
  expiresAt: Date;
}

/**
 * Solution result
 */
export interface SolutionResult {
  success: boolean;
  answer?: string;
  error?: string;
  attemptCount: number;
  duration: number;
}

/**
 * Solver configuration
 */
export interface SolverConfig {
  moltbookApiKey: string;
  moltbookBaseUrl: string;
  aiGeneratorUrl: string;
  maxRetries: number;
  timeoutMs: number;
}

/**
 * Verification Solver
 */
export class VerificationSolver extends EventEmitter {
  constructor(private readonly config: SolverConfig) {
    super();
  }

  /**
   * Solve a verification challenge
   */
  async solve(challenge: VerificationChallenge): Promise<SolutionResult> {
    const startTime = Date.now();
    let attemptCount = 0;

    console.log(`[VerificationSolver] Solving challenge ${challenge.id}`);
    console.log(`[VerificationSolver] Question: ${challenge.question}`);

    // Check expiration
    if (new Date() >= challenge.expiresAt) {
      return {
        success: false,
        error: 'Challenge expired',
        attemptCount: 0,
        duration: Date.now() - startTime,
      };
    }

    // Try to solve with retries
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      attemptCount = attempt;

      try {
        // Get AI answer
        const answer = await this.getAIAnswer(challenge.question);

        // Submit answer
        const success = await this.submitAnswer(challenge.id, answer);

        const duration = Date.now() - startTime;

        if (success) {
          console.log(`[VerificationSolver] ✓ Solved in ${duration}ms (${attempt} attempts)`);
          this.emit('solved', { challenge, answer, duration, attemptCount });

          return {
            success: true,
            answer,
            attemptCount,
            duration,
          };
        } else {
          console.warn(`[VerificationSolver] Attempt ${attempt}/${this.config.maxRetries} failed`);
        }
      } catch (error) {
        console.error(`[VerificationSolver] Attempt ${attempt} error:`, error);

        if (attempt === this.config.maxRetries) {
          const duration = Date.now() - startTime;
          this.emit('failed', { challenge, error, duration, attemptCount });

          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            attemptCount,
            duration,
          };
        }

        // Exponential backoff
        await this.sleep(Math.pow(2, attempt - 1) * 1000);
      }
    }

    // Should never reach here
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: 'Max retries exceeded',
      attemptCount,
      duration,
    };
  }

  /**
   * Get AI answer for question
   */
  private async getAIAnswer(question: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.aiGeneratorUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Answer this verification question concisely and accurately: ${question}`,
          model: 'llama-3.3-70b',
          maxTokens: 100,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI Generator HTTP ${response.status}`);
      }

      const data = await response.json() as { content?: string };
      const answer = data.content?.trim();

      if (!answer) {
        throw new Error('AI Generator returned empty answer');
      }

      return answer;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Submit answer to Moltbook
   */
  private async submitAnswer(challengeId: string, answer: string): Promise<boolean> {
    const response = await fetch(
      `${this.config.moltbookBaseUrl}/api/v1/agents/me/verification-challenges/${challengeId}/answer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.moltbookApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answer }),
      }
    );

    if (!response.ok) {
      console.error(`[VerificationSolver] Submit failed: HTTP ${response.status}`);
      return false;
    }

    const data = await response.json() as { correct?: boolean };
    return data.correct === true;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
