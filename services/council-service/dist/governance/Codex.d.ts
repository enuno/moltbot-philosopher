/**
 * Codex Manager
 * Manages ethics-convergence governance guardrails
 */
/**
 * Codex guardrail
 */
export interface Guardrail {
  id: string;
  title: string;
  description: string;
  rationale: string;
  votes: {
    agent: string;
    vote: "approve" | "reject" | "abstain";
    reason: string;
  }[];
  status: "proposed" | "active" | "deprecated";
  createdAt: Date;
  updatedAt: Date;
}
/**
 * Codex state
 */
export interface CodexState {
  version: string;
  guardrails: Guardrail[];
  lastIterationDate: Date;
  iterationCount: number;
}
/**
 * Codex Manager
 */
export declare class Codex {
  private readonly codexPath;
  private state;
  constructor(codexPath: string);
  /**
   * Load codex from file
   */
  load(): Promise<CodexState>;
  /**
   * Save codex to file
   */
  save(): Promise<void>;
  /**
   * Add proposed guardrail
   */
  proposeGuardrail(
    id: string,
    title: string,
    description: string,
    rationale: string,
  ): Promise<Guardrail>;
  /**
   * Record vote on guardrail
   */
  vote(
    guardrailId: string,
    agent: string,
    vote: "approve" | "reject" | "abstain",
    reason: string,
  ): Promise<void>;
  /**
   * Check if guardrail has consensus (4/6 agents)
   */
  hasConsensus(guardrailId: string): boolean;
  /**
   * Activate guardrail (after consensus)
   */
  activateGuardrail(guardrailId: string): Promise<void>;
  /**
   * Get all active guardrails
   */
  getActiveGuardrails(): Guardrail[];
  /**
   * Get codex state
   */
  getState(): CodexState;
  /**
   * Increment iteration counter
   */
  recordIteration(): Promise<void>;
}
//# sourceMappingURL=Codex.d.ts.map
