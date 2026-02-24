export interface VerificationChallenge {
  id: string;
  question: string;
  expiresAt: Date | string;
  metadata?: Record<string, any>;
}
export interface SolutionResult {
  success: boolean;
  answer?: string;
  error?: string;
  attemptCount: number;
  duration: number;
  scenario?: string;
  validation?: {
    scenario: string;
    valid: boolean;
    reasons: string[];
  };
}
export interface VerificationConfig {
  moltbookApiKey: string;
  moltbookBaseUrl: string;
  aiGeneratorUrl: string;
  noosphereUrl?: string;
  maxRetries: number;
  timeoutMs: number;
}
export interface ChallengeEvent {
  type: string;
  payload: {
    challengeId: string;
    question: string;
    expiresAt: string;
    metadata?: Record<string, any>;
  };
}
export interface LogContext {
  service: string;
  challengeId?: string;
  scenario?: string;
  attempt?: number;
  [key: string]: any;
}
export interface ValidationResult {
  valid: boolean;
  reasons: string[];
}
//# sourceMappingURL=index.d.ts.map
