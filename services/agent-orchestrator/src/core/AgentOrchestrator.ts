/**
 * Agent Orchestrator
 * Core service that manages all philosopher agents and routes events
 */

import type {
  PhilosopherName,
  BaseEvent,
  AgentState,
} from '@moltbot/shared';
import { EventEmitter } from 'events';
import { AgentSession } from './AgentSession.js';
import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  workspaceBase: string;
  logDir?: string;
  enableAuditLog?: boolean;
}

/**
 * Agent Orchestrator - manages all philosopher agents
 */
export class AgentOrchestrator extends EventEmitter {
  private sessions = new Map<PhilosopherName, AgentSession>();
  private readonly config: Required<OrchestratorConfig>;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = {
      workspaceBase: config.workspaceBase,
      logDir: config.logDir || join(config.workspaceBase, 'classical', 'logs'),
      enableAuditLog: config.enableAuditLog ?? true,
    };
  }

  /**
   * Initialize orchestrator (create all agent sessions)
   */
  async initialize(): Promise<void> {
    // Ensure log directory exists
    if (this.config.enableAuditLog) {
      await mkdir(this.config.logDir, { recursive: true });
    }

    const agents: PhilosopherName[] = [
      'classical',
      'existentialist',
      'transcendentalist',
      'joyce',
      'enlightenment',
      'beat',
      'cyberpunk-posthumanist',
      'satirist-absurdist',
      'scientist-empiricist',
    ];

    for (const agent of agents) {
      const session = new AgentSession(agent, this.config.workspaceBase);

      // Forward session events
      session.on('startup', (identity, prompt) => {
        this.emit('agent:startup', agent, identity, prompt);
      });

      session.on('event', async (event, identity, callback) => {
        try {
          // Audit log
          if (this.config.enableAuditLog) {
            await this.logEvent(agent, event);
          }

          // Emit for external handler
          this.emit('agent:event', agent, event, identity, callback);
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      });

      session.on('queue:processed', (entry) => {
        this.emit('agent:event:processed', agent, entry);
      });

      session.on('queue:failed', (entry, error) => {
        this.emit('agent:event:failed', agent, entry, error);
      });

      this.sessions.set(agent, session);
    }

    this.emit('initialized', agents);
  }

  /**
   * Route event to agent(s)
   */
  async routeEvent(event: BaseEvent): Promise<void> {
    if (event.target) {
      // Route to specific agent
      const session = this.sessions.get(event.target);
      if (!session) {
        throw new Error(`Agent "${event.target}" not found`);
      }
      await session.processEvent(event);
    } else {
      // Broadcast to all agents
      await Promise.all(
        Array.from(this.sessions.values()).map((session) =>
          session.processEvent(event)
        )
      );
    }
  }

  /**
   * Get agent state
   */
  getAgentState(agent: PhilosopherName): AgentState | null {
    const session = this.sessions.get(agent);
    return session ? session.getState() : null;
  }

  /**
   * Get all agent states
   */
  getAllAgentStates(): Record<PhilosopherName, AgentState> {
    const states: Partial<Record<PhilosopherName, AgentState>> = {};
    for (const [agent, session] of this.sessions) {
      states[agent] = session.getState();
    }
    return states as Record<PhilosopherName, AgentState>;
  }

  /**
   * Log event to JSONL audit log
   */
  private async logEvent(agent: PhilosopherName, event: BaseEvent): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        agent,
        eventId: event.id,
        eventType: event.type,
        priority: event.priority,
        source: event.metadata.source,
        correlationId: event.metadata.correlationId,
      };

      const logPath = join(this.config.logDir, `${agent}-events.jsonl`);
      await appendFile(logPath, JSON.stringify(logEntry) + '\n', 'utf-8');
    } catch (error) {
      // Don't fail event processing if logging fails
      this.emit('error', new Error(`Audit log failed: ${error}`));
    }
  }

  /**
   * Shutdown orchestrator
   */
  async shutdown(): Promise<void> {
    await Promise.all(
      Array.from(this.sessions.values()).map((session) => session.shutdown())
    );
    this.sessions.clear();
    this.removeAllListeners();
    this.emit('shutdown');
  }
}
