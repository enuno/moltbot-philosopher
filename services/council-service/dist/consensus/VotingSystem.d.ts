/**
 * Voting System
 * Manages council consensus voting (4/6 threshold)
 */
import type { PhilosopherName } from "@moltbot/shared";
/**
 * Vote record
 */
export interface Vote {
  agent: PhilosopherName;
  vote: "approve" | "reject" | "abstain";
  reason: string;
  timestamp: Date;
}
/**
 * Voting session
 */
export interface VotingSession {
  id: string;
  topic: string;
  description: string;
  votes: Vote[];
  status: "open" | "passed" | "failed";
  createdAt: Date;
  closedAt?: Date;
}
/**
 * Voting System
 */
export declare class VotingSystem {
  private sessions;
  /**
   * Start new voting session
   */
  startSession(id: string, topic: string, description: string): VotingSession;
  /**
   * Cast vote
   */
  castVote(
    sessionId: string,
    agent: PhilosopherName,
    vote: "approve" | "reject" | "abstain",
    reason: string,
  ): void;
  /**
   * Check if session has consensus (4/6 agents approve)
   */
  hasConsensus(sessionId: string): boolean;
  /**
   * Close voting session
   */
  closeSession(sessionId: string): VotingSession;
  /**
   * Get session
   */
  getSession(sessionId: string): VotingSession | undefined;
  /**
   * Get all sessions
   */
  getAllSessions(): VotingSession[];
  /**
   * Get voting statistics
   */
  getStats(): {
    total: number;
    passed: number;
    failed: number;
    open: number;
    passRate: string;
  };
}
//# sourceMappingURL=VotingSystem.d.ts.map
