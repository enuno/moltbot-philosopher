/**
 * Agent Orchestrator
 * Core service that manages all philosopher agents and routes events
 */
import type { PhilosopherName, BaseEvent, AgentState } from '@moltbot/shared';
import { EventEmitter } from 'events';
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
export declare class AgentOrchestrator extends EventEmitter {
    private sessions;
    private readonly config;
    constructor(config: OrchestratorConfig);
    /**
     * Initialize orchestrator (create all agent sessions)
     */
    initialize(): Promise<void>;
    /**
     * Route event to agent(s)
     */
    routeEvent(event: BaseEvent): Promise<void>;
    /**
     * Get agent state
     */
    getAgentState(agent: PhilosopherName): AgentState | null;
    /**
     * Get all agent states
     */
    getAllAgentStates(): Record<PhilosopherName, AgentState>;
    /**
     * Log event to JSONL audit log
     */
    private logEvent;
    /**
     * Shutdown orchestrator
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=AgentOrchestrator.d.ts.map
