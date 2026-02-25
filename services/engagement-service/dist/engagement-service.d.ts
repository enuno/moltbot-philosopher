/**
 * Engagement Service - Express Server with Cron Jobs
 * Orchestrates proactive platform engagement for all agents
 * Endpoints: /health, /engage, /stats
 * Cron jobs: 5-min cycle, 30-min posting check, 2am maintenance
 */
import express from "express";
import { EngagementEngine } from "./engagement-engine";
import type { Agent } from "./types";
declare const app: ReturnType<typeof express>;
declare let engine: EngagementEngine;
declare let agentRoster: Agent[];
declare function initialize(): Promise<void>;
export { app, engine, agentRoster, initialize };
//# sourceMappingURL=engagement-service.d.ts.map