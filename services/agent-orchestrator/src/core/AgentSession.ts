/**
 * Agent Session
 * Manages a single philosopher agent's lifecycle and event processing
 */

import type {
  PhilosopherName,
  AgentIdentity,
  BaseEvent,
  AgentState,
} from '@moltbot/shared';
import { EventEmitter } from 'events';
import { LaneQueue } from '../queue/LaneQueue.js';
import { loadAgentIdentity, getSessionStartupPrompt } from '../identity/loader.js';

/**
 * Agent Session - manages one philosopher agent
 */
export class AgentSession extends EventEmitter {
  private identity: AgentIdentity | null = null;
  private queue: LaneQueue;
  private startupComplete = false;

  constructor(
    private readonly agent: PhilosopherName,
    private readonly workspaceBase: string
  ) {
    super();
    this.queue = new LaneQueue(agent);

    // Forward queue events
    this.queue.on('enqueued', (entry) => this.emit('queue:enqueued', entry));
    this.queue.on('processed', (entry) => this.emit('queue:processed', entry));
    this.queue.on('failed', (entry, error) => this.emit('queue:failed', entry, error));
    this.queue.on('retry', (entry, error, delay) => this.emit('queue:retry', entry, error, delay));
    this.queue.on('idle', () => this.emit('queue:idle'));

    // Handle event processing
    this.queue.on('process', async (event: BaseEvent, callback) => {
      try {
        await this.handleEvent(event);
        callback();
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Initialize session (load identity)
   */
  async initialize(): Promise<void> {
    this.identity = await loadAgentIdentity(this.agent, this.workspaceBase);
    this.startupComplete = true;

    // Emit startup ritual prompt
    const startupPrompt = getSessionStartupPrompt(this.identity);
    this.emit('startup', this.identity, startupPrompt);
  }

  /**
   * Process an event
   */
  async processEvent(event: BaseEvent): Promise<void> {
    if (!this.startupComplete) {
      await this.initialize();
    }

    // Enqueue for serial processing
    const priority = this.getEventPriority(event);
    this.queue.enqueue(event, priority);
  }

  /**
   * Handle event processing (called by queue)
   */
  private async handleEvent(event: BaseEvent): Promise<void> {
    // Emit for external handler
    return new Promise((resolve, reject) => {
      this.emit('event', event, this.identity, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get event priority for queue ordering
   */
  private getEventPriority(event: BaseEvent): number {
    const priorityMap: Record<string, number> = {
      'critical': 1000,
      'high': 100,
      'normal': 10,
      'low': 1,
    };
    return priorityMap[event.priority] || 10;
  }

  /**
   * Get agent identity
   */
  getIdentity(): AgentIdentity | null {
    return this.identity;
  }

  /**
   * Get agent state
   */
  getState(): AgentState {
    return {
      name: this.agent,
      status: this.queue.size() > 0 ? 'processing' : 'idle',
      lastActivity: this.queue.getState().lastProcessedAt || new Date(),
      eventsProcessed: this.queue.getState().totalProcessed,
      queueSize: this.queue.size(),
      identityLoaded: this.startupComplete,
    };
  }

  /**
   * Shutdown session
   */
  async shutdown(): Promise<void> {
    this.queue.clear();
    this.removeAllListeners();
    this.emit('shutdown');
  }
}
