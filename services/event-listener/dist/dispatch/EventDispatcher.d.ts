/**
 * Event Dispatcher
 * Dispatches events to Agent Orchestrator
 */
import type { BaseEvent } from "@moltbot/shared";
import { EventEmitter } from "events";
/**
 * Dispatcher configuration
 */
export interface DispatcherConfig {
  orchestratorUrl: string;
  retryAttempts: number;
  retryDelayMs: number;
}
/**
 * Event Dispatcher
 */
export declare class EventDispatcher extends EventEmitter {
  private readonly config;
  constructor(config: DispatcherConfig);
  /**
   * Dispatch event to orchestrator
   */
  dispatch(event: BaseEvent): Promise<void>;
  /**
   * Sleep utility
   */
  private sleep;
}
//# sourceMappingURL=EventDispatcher.d.ts.map
