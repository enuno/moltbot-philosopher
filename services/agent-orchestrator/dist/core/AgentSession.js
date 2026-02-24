"use strict";
/**
 * Agent Session
 * Manages a single philosopher agent's lifecycle and event processing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSession = void 0;
const events_1 = require("events");
const LaneQueue_js_1 = require("../queue/LaneQueue.js");
const loader_js_1 = require("../identity/loader.js");
/**
 * Agent Session - manages one philosopher agent
 */
class AgentSession extends events_1.EventEmitter {
  agent;
  workspaceBase;
  identity = null;
  queue;
  startupComplete = false;
  constructor(agent, workspaceBase) {
    super();
    this.agent = agent;
    this.workspaceBase = workspaceBase;
    this.queue = new LaneQueue_js_1.LaneQueue(agent);
    // Forward queue events
    this.queue.on("enqueued", (entry) => this.emit("queue:enqueued", entry));
    this.queue.on("processed", (entry) => this.emit("queue:processed", entry));
    this.queue.on("failed", (entry, error) => this.emit("queue:failed", entry, error));
    this.queue.on("retry", (entry, error, delay) => this.emit("queue:retry", entry, error, delay));
    this.queue.on("idle", () => this.emit("queue:idle"));
    // Handle event processing
    this.queue.on("process", async (event, callback) => {
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
  async initialize() {
    this.identity = await (0, loader_js_1.loadAgentIdentity)(this.agent, this.workspaceBase);
    this.startupComplete = true;
    // Emit startup ritual prompt
    const startupPrompt = (0, loader_js_1.getSessionStartupPrompt)(this.identity);
    this.emit("startup", this.identity, startupPrompt);
  }
  /**
   * Process an event
   */
  async processEvent(event) {
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
  async handleEvent(event) {
    // Emit for external handler
    return new Promise((resolve, reject) => {
      this.emit("event", event, this.identity, (error) => {
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
  getEventPriority(event) {
    const priorityMap = {
      critical: 1000,
      high: 100,
      normal: 10,
      low: 1,
    };
    return priorityMap[event.priority] || 10;
  }
  /**
   * Get agent identity
   */
  getIdentity() {
    return this.identity;
  }
  /**
   * Get agent state
   */
  getState() {
    return {
      name: this.agent,
      status: this.queue.size() > 0 ? "processing" : "idle",
      lastActivity: this.queue.getState().lastProcessedAt || new Date(),
      eventsProcessed: this.queue.getState().totalProcessed,
      queueSize: this.queue.size(),
      identityLoaded: this.startupComplete,
    };
  }
  /**
   * Shutdown session
   */
  async shutdown() {
    this.queue.clear();
    this.removeAllListeners();
    this.emit("shutdown");
  }
}
exports.AgentSession = AgentSession;
//# sourceMappingURL=AgentSession.js.map
