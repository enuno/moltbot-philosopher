"use strict";
/**
 * Lane Queue Implementation
 * Serial execution queue per philosopher agent (prevents race conditions)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaneQueue = void 0;
const events_1 = require("events");
/**
 * Lane Queue - one queue per agent for serial execution
 */
class LaneQueue extends events_1.EventEmitter {
    agent;
    state;
    processing = false;
    constructor(agent) {
        super();
        this.agent = agent;
        this.state = {
            agent,
            entries: [],
            processingId: null,
            processingStartedAt: null,
            lastProcessedId: null,
            lastProcessedAt: null,
            totalProcessed: 0,
            totalFailed: 0,
        };
    }
    /**
     * Enqueue an event for processing
     */
    enqueue(event, priority = 0, maxAttempts = 3) {
        const entry = {
            id: event.id,
            agent: this.agent,
            payload: event,
            priority,
            createdAt: new Date(),
            attempts: 0,
            maxAttempts,
        };
        this.state.entries.push(entry);
        this.sortQueue();
        this.emit('enqueued', entry);
        // Start processing if not already running
        if (!this.processing) {
            this.processNext();
        }
    }
    /**
     * Sort queue by priority (highest first), then FIFO
     */
    sortQueue() {
        this.state.entries.sort((a, b) => {
            // Priority first (higher = earlier)
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            // Then FIFO (earlier = earlier)
            return a.createdAt.getTime() - b.createdAt.getTime();
        });
    }
    /**
     * Process next entry in queue
     */
    async processNext() {
        if (this.processing)
            return;
        // Check for entries ready to process
        const now = new Date();
        const entry = this.state.entries.find((e) => !e.retryAfter || e.retryAfter <= now);
        if (!entry) {
            this.processing = false;
            this.emit('idle');
            return;
        }
        this.processing = true;
        this.state.processingId = entry.id;
        this.state.processingStartedAt = new Date();
        try {
            // Emit event for handler to process
            await this.processEntry(entry);
            // Success - remove from queue
            this.state.entries = this.state.entries.filter((e) => e.id !== entry.id);
            this.state.lastProcessedId = entry.id;
            this.state.lastProcessedAt = new Date();
            this.state.totalProcessed++;
            this.emit('processed', entry);
        }
        catch (error) {
            entry.attempts++;
            if (entry.attempts >= entry.maxAttempts) {
                // Max attempts reached - remove from queue
                this.state.entries = this.state.entries.filter((e) => e.id !== entry.id);
                this.state.totalFailed++;
                this.emit('failed', entry, error);
            }
            else {
                // Retry with exponential backoff
                const delayMs = Math.min(1000 * Math.pow(2, entry.attempts), 30000);
                entry.retryAfter = new Date(Date.now() + delayMs);
                this.emit('retry', entry, error, delayMs);
            }
        }
        finally {
            this.state.processingId = null;
            this.state.processingStartedAt = null;
            this.processing = false;
            // Process next entry
            setImmediate(() => this.processNext());
        }
    }
    /**
     * Process a single entry (emits for handler)
     */
    async processEntry(entry) {
        return new Promise((resolve, reject) => {
            // Emit for external handler
            this.emit('process', entry.payload, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * Get current queue state
     */
    getState() {
        return { ...this.state, entries: [...this.state.entries] };
    }
    /**
     * Get queue size
     */
    size() {
        return this.state.entries.length;
    }
    /**
     * Check if queue is idle
     */
    isIdle() {
        return !this.processing && this.state.entries.length === 0;
    }
    /**
     * Clear all entries
     */
    clear() {
        this.state.entries = [];
        this.emit('cleared');
    }
}
exports.LaneQueue = LaneQueue;
//# sourceMappingURL=LaneQueue.js.map
