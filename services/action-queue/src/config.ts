import { ActionType, RateLimitConfig } from "./types";

/**
 * Rate limit configurations based on Moltbook SKILL.md rules
 *
 * Reference: skills/moltbook/SKILL.md and RULES.md
 */
export const RATE_LIMITS: Record<ActionType, RateLimitConfig> = {
  // Posts: 1 per 30 minutes (established), 1 per 2 hours (new)
  [ActionType.POST]: {
    actionType: ActionType.POST,
    maxPerInterval: 1,
    intervalSeconds: 30 * 60, // 30 minutes
    dailyMax: 48, // theoretical max
  },

  // Comments: 1 per 20 seconds (established), 1 per 60 seconds (new)
  [ActionType.COMMENT]: {
    actionType: ActionType.COMMENT,
    maxPerInterval: 1,
    intervalSeconds: 20, // 20 seconds
    dailyMax: 50,
  },

  // Upvotes: no explicit limit, but use reasonable rate
  [ActionType.UPVOTE]: {
    actionType: ActionType.UPVOTE,
    maxPerInterval: 10,
    intervalSeconds: 60, // 10 per minute
    dailyMax: 500,
  },

  // Downvotes: same as upvotes
  [ActionType.DOWNVOTE]: {
    actionType: ActionType.DOWNVOTE,
    maxPerInterval: 10,
    intervalSeconds: 60,
    dailyMax: 500,
  },

  // Follow: should be rare and selective
  [ActionType.FOLLOW]: {
    actionType: ActionType.FOLLOW,
    maxPerInterval: 1,
    intervalSeconds: 5 * 60, // 1 per 5 minutes
    dailyMax: 10,
  },

  // Unfollow: same as follow
  [ActionType.UNFOLLOW]: {
    actionType: ActionType.UNFOLLOW,
    maxPerInterval: 1,
    intervalSeconds: 5 * 60,
    dailyMax: 10,
  },

  // Create submolt: 1 per hour (established)
  [ActionType.CREATE_SUBMOLT]: {
    actionType: ActionType.CREATE_SUBMOLT,
    maxPerInterval: 1,
    intervalSeconds: 60 * 60, // 1 hour
    dailyMax: 5,
  },

  // Send DM: requires approval, rate limit conservatively
  [ActionType.SEND_DM]: {
    actionType: ActionType.SEND_DM,
    maxPerInterval: 1,
    intervalSeconds: 10 * 60, // 1 per 10 minutes
    dailyMax: 20,
  },

  // Skill update: once per day recommended
  [ActionType.SKILL_UPDATE]: {
    actionType: ActionType.SKILL_UPDATE,
    maxPerInterval: 1,
    intervalSeconds: 24 * 60 * 60, // 24 hours
    dailyMax: 1,
  },
};

/**
 * New agent rate limits (first 24 hours)
 * More restrictive than established agents
 */
export const NEW_AGENT_RATE_LIMITS: Record<ActionType, RateLimitConfig> = {
  [ActionType.POST]: {
    actionType: ActionType.POST,
    maxPerInterval: 1,
    intervalSeconds: 2 * 60 * 60, // 2 hours
    dailyMax: 12,
  },
  [ActionType.COMMENT]: {
    actionType: ActionType.COMMENT,
    maxPerInterval: 1,
    intervalSeconds: 60, // 60 seconds
    dailyMax: 20,
  },
  [ActionType.UPVOTE]: {
    actionType: ActionType.UPVOTE,
    maxPerInterval: 5,
    intervalSeconds: 60,
    dailyMax: 100,
  },
  [ActionType.DOWNVOTE]: {
    actionType: ActionType.DOWNVOTE,
    maxPerInterval: 5,
    intervalSeconds: 60,
    dailyMax: 100,
  },
  [ActionType.FOLLOW]: {
    actionType: ActionType.FOLLOW,
    maxPerInterval: 1,
    intervalSeconds: 30 * 60, // 30 minutes
    dailyMax: 3,
  },
  [ActionType.UNFOLLOW]: {
    actionType: ActionType.UNFOLLOW,
    maxPerInterval: 1,
    intervalSeconds: 30 * 60,
    dailyMax: 3,
  },
  [ActionType.CREATE_SUBMOLT]: {
    actionType: ActionType.CREATE_SUBMOLT,
    maxPerInterval: 1,
    intervalSeconds: 24 * 60 * 60, // one-time only
    dailyMax: 1,
  },
  [ActionType.SEND_DM]: {
    actionType: ActionType.SEND_DM,
    maxPerInterval: 0, // blocked for new agents
    intervalSeconds: Infinity,
    dailyMax: 0,
  },
  [ActionType.SKILL_UPDATE]: {
    actionType: ActionType.SKILL_UPDATE,
    maxPerInterval: 1,
    intervalSeconds: 24 * 60 * 60,
    dailyMax: 1,
  },
};

/**
 * Global API request limit: 100 requests per minute
 */
export const GLOBAL_API_LIMIT = {
  maxPerInterval: 100,
  intervalSeconds: 60,
};

/**
 * Queue processing configuration
 * Loads from environment variables with sensible defaults
 */
export const QUEUE_CONFIG = {
  // Database connection URL (PostgreSQL)
  dbUrl:
    process.env.DATABASE_URL ||
    "postgresql://noosphere_admin:changeme_noosphere_2026@localhost:5432/action_queue",

  // pg-boss schema
  pgBossSchema: "pgboss",

  // Environment
  environment: process.env.NODE_ENV || "production",

  // Log level
  logLevel: process.env.LOG_LEVEL || "info",

  // How often to process the queue (seconds)
  processingInterval: parseInt(process.env.QUEUE_PROCESSING_INTERVAL || "5", 10),

  // How often to check for scheduled actions (seconds)
  scheduledCheckInterval: parseInt(process.env.QUEUE_SCHEDULED_CHECK_INTERVAL || "30", 10),

  // Maximum retry attempts for failed actions
  maxAttempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS || "3", 10),

  // Backoff multiplier for retries (exponential backoff)
  retryBackoffMultiplier: parseFloat(process.env.QUEUE_RETRY_BACKOFF_MULTIPLIER || "2"),

  // Port for HTTP API
  port: parseInt(process.env.ACTION_QUEUE_PORT || "3008", 10),

  // Moltbook API base URL
  moltbookApiBase: process.env.MOLTBOOK_API_BASE || "https://www.moltbook.com/api/v1",

  // API key (should be provided via env)
  moltbookApiKey: process.env.MOLTBOOK_API_KEY || "",
};

/**
 * pg-boss configuration
 * Advanced job queue settings
 */
export const PGBOSS_CONFIG = {
  // Number of jobs to process simultaneously
  workerConcurrency: parseInt(process.env.PGBOSS_WORKER_CONCURRENCY || "1", 10),

  // How often to run maintenance tasks (minutes)
  maintenanceIntervalMinutes: parseInt(process.env.PGBOSS_MAINTENANCE_INTERVAL_MINUTES || "60", 10),

  // Whether to archive completed jobs
  archiveCompletedJobs: process.env.PGBOSS_ARCHIVE_COMPLETED_JOBS !== "false",

  // How long to keep archived/completed jobs (days)
  jobExpirationDays: parseInt(process.env.PGBOSS_JOB_EXPIRATION_DAYS || "30", 10),
};

/**
 * Observability configuration
 * Logging and monitoring settings
 */
export const OBSERVABILITY_CONFIG = {
  // Enable debug mode (verbose logging)
  debug: process.env.ACTION_QUEUE_DEBUG === "true",

  // Log level: debug, info, warn, error
  logLevel: (process.env.ACTION_QUEUE_LOG_LEVEL || "info") as "debug" | "info" | "warn" | "error",

  // Port for Prometheus metrics (0 = disabled)
  metricsPort: parseInt(process.env.ACTION_QUEUE_METRICS_PORT || "3009", 10),
};

/**
 * Rate limiting and circuit breaker configuration
 * API protection and resilience settings
 */
export const RATE_LIMITING_CONFIG = {
  // Global API rate limit (requests per minute)
  globalApiRateLimit: parseInt(process.env.GLOBAL_API_RATE_LIMIT || "100", 10),

  // Enable/disable rate limiting
  enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== "false",

  // Circuit breaker: failures before opening
  circuitBreakerFailureThreshold: parseInt(
    process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || "5",
    10,
  ),

  // Circuit breaker: seconds before half-open attempt
  circuitBreakerTimeoutSeconds: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_SECONDS || "60", 10),
};

/**
 * Determine if an agent is "new" (within first 24 hours)
 * This would need to be tracked in a separate agents table
 */
export function getRateLimitsForAgent(
  agentName: string,
  isNewAgent: boolean,
): Record<ActionType, RateLimitConfig> {
  return isNewAgent ? NEW_AGENT_RATE_LIMITS : RATE_LIMITS;
}
