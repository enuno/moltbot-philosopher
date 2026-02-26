/**
 * Stats Endpoint Implementation
 * GET /stats - Returns comprehensive engagement metrics and trends
 */
import { Router } from "express";
/**
 * Service state tracking for health and freshness
 */
interface ServiceState {
    startTime: number;
    lastCycleTime: number;
    cycleInterval: number;
    isStaleness: boolean;
}
/**
 * Create stats router
 */
export declare function createStatsRouter(): Router;
/**
 * Update service cycle time
 * Call this from the engagement service main loop
 */
export declare function updateLastCycleTime(): void;
/**
 * Set cycle interval
 */
export declare function setCycleInterval(ms: number): void;
/**
 * Get current service state
 */
export declare function getServiceState(): ServiceState;
export {};
//# sourceMappingURL=stats-endpoint.d.ts.map