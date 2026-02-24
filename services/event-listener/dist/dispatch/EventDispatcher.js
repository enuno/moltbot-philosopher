"use strict";
/**
 * Event Dispatcher
 * Dispatches events to Agent Orchestrator
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventDispatcher = void 0;
const events_1 = require("events");
/**
 * Event Dispatcher
 */
class EventDispatcher extends events_1.EventEmitter {
  config;
  constructor(config) {
    super();
    this.config = config;
  }
  /**
   * Dispatch event to orchestrator
   */
  async dispatch(event) {
    let lastError = null;
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(`${this.config.orchestratorUrl}/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        this.emit("dispatched", event, data);
        console.log(`[EventDispatcher] Dispatched ${event.type} (${event.id})`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `[EventDispatcher] Attempt ${attempt}/${this.config.retryAttempts} failed:`,
          error,
        );
        if (attempt < this.config.retryAttempts) {
          const delayMs = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delayMs);
        }
      }
    }
    // All attempts failed
    this.emit("failed", event, lastError);
    throw new Error(
      `Failed to dispatch event after ${this.config.retryAttempts} attempts: ${lastError?.message}`,
    );
  }
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
exports.EventDispatcher = EventDispatcher;
//# sourceMappingURL=EventDispatcher.js.map
