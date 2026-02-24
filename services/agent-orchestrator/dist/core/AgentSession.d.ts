/**
 * Agent Session
 * Manages a single philosopher agent's lifecycle and event processing
 */
import type { PhilosopherName, AgentIdentity, BaseEvent, AgentState } from "@moltbot/shared";
import { EventEmitter } from "events";
/**
 * Agent Session - manages one philosopher agent
 */
export declare class AgentSession extends EventEmitter {
  private readonly agent;
  private readonly workspaceBase;
  private identity;
  private queue;
  private startupComplete;
  constructor(agent: PhilosopherName, workspaceBase: string);
  /**
   * Initialize session (load identity)
   */
  initialize(): Promise<void>;
  /**
   * Process an event
   */
  processEvent(event: BaseEvent): Promise<void>;
  /**
   * Handle event processing (called by queue)
   */
  private handleEvent;
  /**
   * Get event priority for queue ordering
   */
  private getEventPriority;
  /**
   * Get agent identity
   */
  getIdentity(): AgentIdentity | null;
  /**
   * Get agent state
   */
  getState(): AgentState;
  /**
   * Shutdown session
   */
  shutdown(): Promise<void>;
}
//# sourceMappingURL=AgentSession.d.ts.map
