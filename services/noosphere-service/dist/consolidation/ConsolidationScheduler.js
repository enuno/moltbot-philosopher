"use strict";
/**
 * Consolidation Scheduler
 * Manages daily memory consolidation cycles
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsolidationScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const events_1 = require("events");
/**
 * Consolidation Scheduler
 */
class ConsolidationScheduler extends events_1.EventEmitter {
    config;
    memoryLayer;
    task = null;
    consolidationCount = 0;
    constructor(config, memoryLayer) {
        super();
        this.config = config;
        this.memoryLayer = memoryLayer;
    }
    /**
     * Start scheduler
     */
    start() {
        if (this.task) {
            console.warn('[ConsolidationScheduler] Already running');
            return;
        }
        console.log('[ConsolidationScheduler] Starting daily consolidation');
        console.log(`[ConsolidationScheduler] Schedule: ${this.config.dailySchedule}`);
        // Schedule daily consolidation (default: daily at 2am)
        this.task = node_cron_1.default.schedule(this.config.dailySchedule, () => {
            this.runConsolidation();
        });
        // Run immediately if autoStart
        if (this.config.autoStart) {
            this.runConsolidation();
        }
    }
    /**
     * Stop scheduler
     */
    stop() {
        if (this.task) {
            this.task.stop();
            this.task = null;
            console.log('[ConsolidationScheduler] Stopped');
        }
    }
    /**
     * Run consolidation cycle
     */
    async runConsolidation() {
        console.log('[ConsolidationScheduler] Starting consolidation cycle');
        try {
            // Get Layer 1 entries
            const layer1Entries = await this.memoryLayer.getLayerEntries(1);
            if (layer1Entries.length < this.config.minEntriesForConsolidation) {
                console.log(`[ConsolidationScheduler] Not enough entries (${layer1Entries.length}/${this.config.minEntriesForConsolidation})`);
                return;
            }
            console.log(`[ConsolidationScheduler] Consolidating ${layer1Entries.length} entries`);
            // Consolidate to Layer 2
            const consolidated = await this.memoryLayer.consolidateToLayer2(layer1Entries);
            this.consolidationCount++;
            console.log(`[ConsolidationScheduler] ✓ Consolidated to ${consolidated.id}`);
            this.emit('consolidated', { consolidated, sourceCount: layer1Entries.length });
        }
        catch (error) {
            console.error('[ConsolidationScheduler] Consolidation failed:', error);
            this.emit('error', error);
        }
    }
    /**
     * Get consolidation statistics
     */
    getStats() {
        return {
            consolidationsRun: this.consolidationCount,
            isRunning: this.task !== null,
            schedule: this.config.dailySchedule,
        };
    }
    /**
     * Check if scheduler is running
     */
    isRunning() {
        return this.task !== null;
    }
}
exports.ConsolidationScheduler = ConsolidationScheduler;
//# sourceMappingURL=ConsolidationScheduler.js.map
