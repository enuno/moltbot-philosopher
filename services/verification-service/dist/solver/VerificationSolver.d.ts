/**
 * AI-powered Verification Challenge Solver
 * Uses AI Generator to answer Moltbook verification questions
 */
import { EventEmitter } from "events";
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
export declare class VerificationSolver extends EventEmitter {
  private readonly config;
  private readonly ALLOWED_HOSTS;
  constructor(config: SolverConfig);
  /**
   * Validate URL to prevent SSRF
   */
  private validateUrl;
  /**
   * Solve a verification challenge
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
//# sourceMappingURL=VerificationSolver.d.ts.map
