/**
 * Stats Endpoint Implementation
 * GET /stats - Returns comprehensive engagement metrics and trends
 */

import { Router, Request, Response } from "express";
import { Agent, EngagementState, StatsResponse, StatsServiceInfo } from "./types";
import {
  buildSummary,
  buildTrends,
  buildAgentsSection,
  buildQualitySection,
} from "./stats-builder";

/**
 * Service state tracking for health and freshness
 */
interface ServiceState {
  startTime: number;
  lastCycleTime: number;
  cycleInterval: number; // milliseconds, default 60s
  isStaleness: boolean;
}

let serviceState: ServiceState = {
  startTime: Date.now(),
  lastCycleTime: Date.now(),
  cycleInterval: 60000, // 60 seconds default
  isStaleness: false,
};

/**
 * Create stats router
 */
export function createStatsRouter() {
  const router = Router();

  /**
   * GET /stats - Comprehensive engagement metrics
   */
  router.get("/stats", async (req: Request, res: Response) => {
    try {
      // Get agents and state from app context
      const agents = (req.app.locals.agents || []) as Agent[];
      const stateMap = (req.app.locals.stateMap || new Map()) as Map<string, EngagementState>;

      // Check data freshness (stale if no update for 2x cycle interval)
      const timeSinceLastCycle = Date.now() - serviceState.lastCycleTime;
      const isStale = timeSinceLastCycle > serviceState.cycleInterval * 2;

      // Build service info
      const serviceInfo: StatsServiceInfo = {
        status: isStale ? "degraded" : "healthy",
        uptime_seconds: Math.floor((Date.now() - serviceState.startTime) / 1000),
        data_freshness: {
          last_cycle_at: new Date(serviceState.lastCycleTime).toISOString(),
          cycle_interval_seconds: Math.floor(serviceState.cycleInterval / 1000),
          is_stale: isStale,
        },
      };

      // Build stats sections
      const summary = buildSummary(agents, stateMap);
      const trends = buildTrends(stateMap);
      const agentsSection = buildAgentsSection(agents, stateMap);
      const quality = buildQualitySection(stateMap);

      const response: StatsResponse = {
        service: serviceInfo,
        summary,
        trends,
        agents: agentsSection,
        quality,
      };

      res.status(200).json(response);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Error building stats:", errorMsg);
      res.status(500).json({
        error: "Failed to build stats",
        message: errorMsg,
      });
    }
  });

  /**
   * POST /stats/cycle-complete - Update last cycle time
   * Called by engagement service after each engagement cycle
   */
  router.post("/stats/cycle-complete", (req: Request, res: Response) => {
    serviceState.lastCycleTime = Date.now();
    res.status(200).json({ ok: true });
  });

  /**
   * POST /stats/config - Update cycle interval
   */
  router.post("/stats/config", (req: Request, res: Response) => {
    const { cycleInterval } = req.body;
    if (typeof cycleInterval === "number" && cycleInterval > 0) {
      serviceState.cycleInterval = cycleInterval;
      res.status(200).json({ cycleInterval: serviceState.cycleInterval });
    } else {
      res.status(400).json({ error: "Invalid cycleInterval" });
    }
  });

  return router;
}

/**
 * Update service cycle time
 * Call this from the engagement service main loop
 */
export function updateLastCycleTime(): void {
  serviceState.lastCycleTime = Date.now();
}

/**
 * Set cycle interval
 */
export function setCycleInterval(ms: number): void {
  if (ms > 0) {
    serviceState.cycleInterval = ms;
  }
}

/**
 * Get current service state
 */
export function getServiceState(): ServiceState {
  return { ...serviceState };
}
