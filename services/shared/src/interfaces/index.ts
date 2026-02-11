/**
 * Interface Types
 * Core interfaces for service architecture
 */

import type { BaseEvent, EventSubscription } from '../types/event.js';
import type { ServiceName, ServiceRequest, ServiceResponse } from '../types/service.js';
import type { AgentIdentity, PhilosopherName } from '../types/agent.js';

/**
 * Event Bus interface (publish/subscribe pattern)
 */
export interface IEventBus {
  /**
   * Publish an event to the bus
   */
  publish<T = unknown>(event: BaseEvent<T>): Promise<void>;

  /**
   * Subscribe to events
   */
  subscribe(subscription: EventSubscription): string;

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): void;

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): EventSubscription[];

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void;
}

/**
 * Agent Service interface
 */
export interface IAgentService {
  /**
   * Get agent name
   */
  getName(): PhilosopherName;

  /**
   * Load agent identity from workspace files
   */
  loadIdentity(): Promise<AgentIdentity>;

  /**
   * Get loaded identity
   */
  getIdentity(): AgentIdentity | null;

  /**
   * Process an event
   */
  processEvent<T = unknown>(event: BaseEvent<T>): Promise<void>;

  /**
   * Get agent state
   */
  getState(): Promise<{
    status: 'idle' | 'processing' | 'waiting' | 'error';
    queueSize: number;
    lastActivity: Date | null;
  }>;

  /**
   * Shutdown the agent service
   */
  shutdown(): Promise<void>;
}

/**
 * Service Client interface (for service-to-service communication)
 */
export interface IServiceClient {
  /**
   * Make a request to another service
   */
  request<T = unknown, R = unknown>(
    request: ServiceRequest<T>
  ): Promise<ServiceResponse<R>>;

  /**
   * Check service health
   */
  healthCheck(service: ServiceName): Promise<ServiceResponse>;

  /**
   * Get service base URL
   */
  getServiceUrl(service: ServiceName): string;
}

/**
 * Logger interface
 */
export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}
