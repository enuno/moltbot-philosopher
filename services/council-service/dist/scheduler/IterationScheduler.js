"use strict";
/**
 * Iteration Scheduler
 * Manages 5-day council iteration cycle
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IterationScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const events_1 = require("events");
/**
 * Iteration Scheduler
 */
class IterationScheduler extends events_1.EventEmitter {
    config;
    currentIteration = null;
    task = null;
    constructor(config) {
        super();
        this.config = config;
    }
    /**
     * Start scheduler
     */
    start() {
        if (this.task) {
            console.warn('[IterationScheduler] Already running');
            return;
        }
        console.log('[IterationScheduler] Starting 5-day iteration cycle');
        // Run every 5 days at midnight
        // Cron: "0 0 */5 * *" (every 5 days)
        this.task = node_cron_1.default.schedule('0 0 */5 * *', () => {
            this.triggerIteration();
        });
        // Start initial iteration if configured
        if (this.config.autoStart && !this.currentIteration) {
            this.triggerIteration();
        }
    }
    /**
     * Stop scheduler
     */
    stop() {
        if (this.task) {
            this.task.stop();
            this.task = null;
            console.log('[IterationScheduler] Stopped');
        }
    }
    /**
     * Trigger new iteration manually
     */
    triggerIteration() {
        // Complete current iteration if exists
        if (this.currentIteration && this.currentIteration.status === 'active') {
            this.completeIteration();
        }
        // Start new iteration
        const iterationNumber = this.currentIteration
            ? this.currentIteration.iterationNumber + 1
            : 1;
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + this.config.iterationDays);
        this.currentIteration = {
            iterationNumber,
            startDate,
            endDate,
            status: 'active',
        };
        console.log(`[IterationScheduler] Started iteration ${iterationNumber}`);
        this.emit('iteration:start', this.currentIteration);
    }
    /**
     * Complete current iteration
     */
    completeIteration() {
        if (!this.currentIteration) {
            console.warn('[IterationScheduler] No active iteration to complete');
            return;
        }
        this.currentIteration.status = 'completed';
        console.log(`[IterationScheduler] Completed iteration ${this.currentIteration.iterationNumber}`);
        this.emit('iteration:complete', this.currentIteration);
    }
    /**
     * Get current iteration
     */
    getCurrentIteration() {
        return this.currentIteration;
    }
    /**
     * Get days remaining in current iteration
     */
    getDaysRemaining() {
        if (!this.currentIteration || this.currentIteration.status !== 'active') {
            return 0;
        }
        const now = new Date();
        const msRemaining = this.currentIteration.endDate.getTime() - now.getTime();
        return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    }
    /**
     * Check if scheduler is running
     */
    isRunning() {
        return this.task !== null;
    }
}
exports.IterationScheduler = IterationScheduler;
//# sourceMappingURL=IterationScheduler.js.map
