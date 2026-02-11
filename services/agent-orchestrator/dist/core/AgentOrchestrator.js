"use strict";
/**
 * Agent Orchestrator
 * Core service that manages all philosopher agents and routes events
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOrchestrator = void 0;
const events_1 = require("events");
const AgentSession_js_1 = require("./AgentSession.js");
const promises_1 = require("fs/promises");
const path_1 = require("path");
/**
 * Agent Orchestrator - manages all philosopher agents
 */
class AgentOrchestrator extends events_1.EventEmitter {
    sessions = new Map();
    config;
    constructor(config) {
        super();
        this.config = {
            workspaceBase: config.workspaceBase,
            logDir: config.logDir || (0, path_1.join)(config.workspaceBase, 'classical', 'logs'),
            enableAuditLog: config.enableAuditLog ?? true,
        };
    }
    /**
     * Initialize orchestrator (create all agent sessions)
     */
    async initialize() {
        // Ensure log directory exists
        if (this.config.enableAuditLog) {
            await (0, promises_1.mkdir)(this.config.logDir, { recursive: true });
        }
        const agents = [
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
            const session = new AgentSession_js_1.AgentSession(agent, this.config.workspaceBase);
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
                }
                catch (error) {
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
    async routeEvent(event) {
        if (event.target) {
            // Route to specific agent
            const session = this.sessions.get(event.target);
            if (!session) {
                throw new Error(`Agent "${event.target}" not found`);
            }
            await session.processEvent(event);
        }
        else {
            // Broadcast to all agents
            await Promise.all(Array.from(this.sessions.values()).map((session) => session.processEvent(event)));
        }
    }
    /**
     * Get agent state
     */
    getAgentState(agent) {
        const session = this.sessions.get(agent);
        return session ? session.getState() : null;
    }
    /**
     * Get all agent states
     */
    getAllAgentStates() {
        const states = {};
        for (const [agent, session] of this.sessions) {
            states[agent] = session.getState();
        }
        return states;
    }
    /**
     * Log event to JSONL audit log
     */
    async logEvent(agent, event) {
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
            const logPath = (0, path_1.join)(this.config.logDir, `${agent}-events.jsonl`);
            await (0, promises_1.appendFile)(logPath, JSON.stringify(logEntry) + '\n', 'utf-8');
        }
        catch (error) {
            // Don't fail event processing if logging fails
            this.emit('error', new Error(`Audit log failed: ${error}`));
        }
    }
    /**
     * Shutdown orchestrator
     */
    async shutdown() {
        await Promise.all(Array.from(this.sessions.values()).map((session) => session.shutdown()));
        this.sessions.clear();
        this.removeAllListeners();
        this.emit('shutdown');
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
//# sourceMappingURL=AgentOrchestrator.js.map
