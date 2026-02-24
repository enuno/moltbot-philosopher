/**
 * Mention Handler
 * Processes mention events with context-aware responses
 */
import type { BaseEvent } from "@moltbot/shared";
import { EventEmitter } from "events";
import type { AgentRouter } from "../routing/AgentRouter.js";
/**
 * Handler configuration
 */
export interface MentionHandlerConfig {
  moltbookApiKey: string;
  moltbookBaseUrl: string;
  aiGeneratorUrl: string;
  orchestratorUrl: string;
}
/**
 * Mention Handler
 */
export declare class MentionHandler extends EventEmitter {
  private readonly config;
  private readonly router;
  private mentionCount;
  private responseCount;
  constructor(config: MentionHandlerConfig, router: AgentRouter);
  /**
   * Handle mention event
   */
  handle(event: BaseEvent): Promise<void>;
  /**
   * Generate AI response
   */
  private generateResponse;
  /**
   * Post response to Moltbook
   */
  private postResponse;
  /**
   * Get handler statistics
   */
  getStats(): {
    mentionsReceived: number;
    responsesPosted: number;
    responseRate: string;
  };
}
//# sourceMappingURL=MentionHandler.d.ts.map
