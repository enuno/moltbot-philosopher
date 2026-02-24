/**
 * Service Types
 * Common types for microservice architecture
 */

/**
 * Service names
 */
export type ServiceName =
  | "ai-content-generator" // Port 3002 (existing)
  | "model-router" // Port 3003 (existing)
  | "thread-monitor" // Port 3004 (existing)
  | "ntfy-publisher" // Port 3005 (existing)
  | "agent-orchestrator" // Port 3006 (new)
  | "event-listener" // Port 3007 (new)
  | "verification-service" // Port 3008 (new)
  | "engagement-service" // Port 3009 (new)
  | "council-service" // Port 3010 (new)
  | "noosphere-service" // Port 3011 (new)
  | "moltstack-service"; // Port 3012 (new)

/**
 * Service health status
 */
export type ServiceHealth = "healthy" | "degraded" | "unhealthy" | "unknown";

/**
 * Service configuration
 */
export interface ServiceConfig {
  /** Service name */
  name: ServiceName;

  /** Port number */
  port: number;

  /** Base URL (for service-to-service communication) */
  baseUrl: string;

  /** Health check endpoint */
  healthEndpoint?: string;

  /** Health check interval (milliseconds) */
  healthCheckInterval?: number;

  /** Timeout for requests (milliseconds) */
  timeout?: number;

  /** Enable request logging */
  enableLogging?: boolean;

  /** Log level */
  logLevel?: "debug" | "info" | "warn" | "error";
}

/**
 * Service health check response
 */
export interface HealthCheckResponse {
  /** Service name */
  service: ServiceName;

  /** Health status */
  status: ServiceHealth;

  /** Uptime in seconds */
  uptime: number;

  /** Timestamp */
  timestamp: Date;

  /** Version */
  version: string;

  /** Additional details */
  details?: {
    /** Memory usage */
    memory?: {
      used: number;
      total: number;
    };

    /** Queue sizes (if applicable) */
    queues?: Record<string, number>;

    /** Error count in last hour */
    recentErrors?: number;

    /** Last error message */
    lastError?: string;

    /** Dependencies status */
    dependencies?: Record<string, ServiceHealth>;
  };
}

/**
 * Service-to-service request
 */
export interface ServiceRequest<T = unknown> {
  /** Target service */
  service: ServiceName;

  /** Endpoint path */
  endpoint: string;

  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

  /** Request payload */
  payload?: T;

  /** Query parameters */
  query?: Record<string, string | number | boolean>;

  /** Request headers */
  headers?: Record<string, string>;

  /** Timeout override (milliseconds) */
  timeout?: number;
}

/**
 * Service-to-service response
 */
export interface ServiceResponse<T = unknown> {
  /** Success flag */
  success: boolean;

  /** Response data */
  data?: T;

  /** Error message (if success = false) */
  error?: string;

  /** HTTP status code */
  statusCode: number;

  /** Response metadata */
  metadata?: {
    /** Response time in milliseconds */
    responseTime: number;

    /** Service that handled the request */
    handledBy: ServiceName;

    /** Timestamp */
    timestamp: Date;
  };
}
