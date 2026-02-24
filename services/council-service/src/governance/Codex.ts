/**
 * Codex Manager
 * Manages ethics-convergence governance guardrails
 */

import * as fs from "fs/promises";

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
export class Codex {
  private state: CodexState | null = null;

  constructor(private readonly codexPath: string) {}

  /**
   * Load codex from file
   */
  async load(): Promise<CodexState> {
    try {
      const data = await fs.readFile(this.codexPath, "utf-8");
      this.state = JSON.parse(data) as CodexState;

      // Parse dates
      this.state.lastIterationDate = new Date(this.state.lastIterationDate);
      this.state.guardrails.forEach((g) => {
        g.createdAt = new Date(g.createdAt);
        g.updatedAt = new Date(g.updatedAt);
      });

      return this.state;
    } catch (_error) {
      // Initialize new codex if doesn't exist
      this.state = {
        version: "1.0.0",
        guardrails: [],
        lastIterationDate: new Date(),
        iterationCount: 0,
      };
      await this.save();
      return this.state;
    }
  }

  /**
   * Save codex to file
   */
  async save(): Promise<void> {
    if (!this.state) {
      throw new Error("Codex not loaded");
    }

    await fs.writeFile(this.codexPath, JSON.stringify(this.state, null, 2), "utf-8");
  }

  /**
   * Add proposed guardrail
   */
  async proposeGuardrail(
    id: string,
    title: string,
    description: string,
    rationale: string,
  ): Promise<Guardrail> {
    if (!this.state) {
      await this.load();
    }

    const guardrail: Guardrail = {
      id,
      title,
      description,
      rationale,
      votes: [],
      status: "proposed",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.state!.guardrails.push(guardrail);
    await this.save();

    return guardrail;
  }

  /**
   * Record vote on guardrail
   */
  async vote(
    guardrailId: string,
    agent: string,
    vote: "approve" | "reject" | "abstain",
    reason: string,
  ): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    const guardrail = this.state!.guardrails.find((g) => g.id === guardrailId);
    if (!guardrail) {
      throw new Error(`Guardrail ${guardrailId} not found`);
    }

    // Remove existing vote from this agent
    guardrail.votes = guardrail.votes.filter((v) => v.agent !== agent);

    // Add new vote
    guardrail.votes.push({ agent, vote, reason });
    guardrail.updatedAt = new Date();

    await this.save();
  }

  /**
   * Check if guardrail has consensus (4/6 agents)
   */
  hasConsensus(guardrailId: string): boolean {
    if (!this.state) {
      throw new Error("Codex not loaded");
    }

    const guardrail = this.state!.guardrails.find((g) => g.id === guardrailId);
    if (!guardrail) {
      return false;
    }

    const approvals = guardrail.votes.filter((v) => v.vote === "approve").length;
    return approvals >= 4; // 4/6 threshold
  }

  /**
   * Activate guardrail (after consensus)
   */
  async activateGuardrail(guardrailId: string): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    const guardrail = this.state!.guardrails.find((g) => g.id === guardrailId);
    if (!guardrail) {
      throw new Error(`Guardrail ${guardrailId} not found`);
    }

    if (!this.hasConsensus(guardrailId)) {
      throw new Error("Cannot activate guardrail without consensus");
    }

    guardrail.status = "active";
    guardrail.updatedAt = new Date();
    await this.save();
  }

  /**
   * Get all active guardrails
   */
  getActiveGuardrails(): Guardrail[] {
    if (!this.state) {
      throw new Error("Codex not loaded");
    }

    return this.state!.guardrails.filter((g) => g.status === "active");
  }

  /**
   * Get codex state
   */
  getState(): CodexState {
    if (!this.state) {
      throw new Error("Codex not loaded");
    }

    return this.state!;
  }

  /**
   * Increment iteration counter
   */
  async recordIteration(): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.iterationCount++;
    this.state!.lastIterationDate = new Date();
    await this.save();
  }
}
