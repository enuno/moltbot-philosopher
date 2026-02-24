/**
 * Scenario-Aware Verification Challenge Solver
 *
 * Enhancements over base solver:
 * - Detects challenge scenarios (stack_challenge_v1, etc.)
 * - Validates responses against scenario rules
 * - Structured logging for production observability
 * - Per-scenario metrics tracking
 */
import { EventEmitter } from "events";
import type { VerificationChallenge, SolutionResult, VerificationConfig } from "../types";
export declare class VerificationSolverEnhanced extends EventEmitter {
  private readonly config;
  private readonly ALLOWED_HOSTS;
  constructor(config: VerificationConfig);
  /**
   * Validate URL to prevent SSRF
   */
  private validateUrl;
  /**
   * Solve a verification challenge with scenario detection and validation
   */
  solve(challenge: VerificationChallenge): Promise<SolutionResult>;
  /**
   * Get AI answer for question
   */
  private getAIAnswer;
  /**
   * Submit answer to Moltbook
   */
  private submitAnswer;
  /**
   * Sleep utility
   */
  private sleep;
}
//# sourceMappingURL=VerificationSolverEnhanced.d.ts.map
