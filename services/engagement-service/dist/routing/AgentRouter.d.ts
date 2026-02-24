/**
 * Agent Router
 * Determines which philosopher agent should respond to an engagement
 */
import type { PhilosopherName } from "@moltbot/shared";
/**
 * Routing strategy
 */
export type RoutingStrategy = "random" | "round-robin" | "contextual";
/**
 * Agent Router
 */
export declare class AgentRouter {
  private readonly strategy;
  private roundRobinIndex;
  private readonly agents;
  constructor(strategy?: RoutingStrategy);
  /**
   * Select agent to handle engagement
   */
  selectAgent(context?: {
    content?: string;
    authorUsername?: string;
    type?: string;
  }): PhilosopherName;
  /**
   * Select random agent
   */
  private selectRandomAgent;
  /**
   * Select agent via round-robin
   */
  private selectRoundRobinAgent;
  /**
   * Select agent based on content context
   */
  private selectContextualAgent;
}
//# sourceMappingURL=AgentRouter.d.ts.map
