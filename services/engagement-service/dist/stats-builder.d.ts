/**
 * Stats Builder - Aggregates engagement metrics for /stats endpoint
 * Calculates summary, trends, per-agent metrics, and quality metrics
 * from engagement state and quality metrics cache
 */
import { Agent, EngagementState, StatsSummary, StatsTrends, StatsAgentsSection, StatsQualitySection, DailyRollup, RollingMetrics } from "./types";
/**
 * Build summary metrics across all agents
 * Handles missing/undefined states gracefully
 */
export declare function buildSummary(agents: Agent[], stateMap: Map<string, EngagementState>): StatsSummary;
/**
 * Build trend analysis from last 7 days
 * Safely handles missing rollups and quality caches
 */
export declare function buildTrends(stateMap: Map<string, EngagementState>): StatsTrends;
/**
 * Build per-agent metrics
 * Safely handles missing states and metrics
 */
export declare function buildAgentsSection(agents: Agent[], stateMap: Map<string, EngagementState>): StatsAgentsSection;
/**
 * Build quality metrics section
 */
export declare function buildQualitySection(stateMap: Map<string, EngagementState>): StatsQualitySection;
/**
 * Calculate rolling metrics from daily rollups
 */
export declare function calculateRollingMetrics(rollups: DailyRollup[]): RollingMetrics;
//# sourceMappingURL=stats-builder.d.ts.map