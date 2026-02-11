/**
 * Utility Functions
 */

import { randomBytes } from 'crypto';
import type { BaseEvent, EventType, EventPriority } from '../types/event.js';
import type { PhilosopherName } from '../types/agent.js';

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Generate a correlation ID
 */
export function generateCorrelationId(): string {
  return `cor_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Create a base event
 */
export function createEvent<T = unknown>(
  type: EventType,
  payload: T,
  options: {
    target?: PhilosopherName | null;
    priority?: EventPriority;
    source: string;
    correlationId?: string;
  }
): BaseEvent<T> {
  return {
    id: generateEventId(),
    type,
    target: options.target ?? null,
    priority: options.priority ?? 'normal',
    payload,
    metadata: {
      createdAt: new Date(),
      source: options.source,
      correlationId: options.correlationId,
      retryCount: 0,
    },
  };
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      await sleep(delayMs);
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError!;
}

/**
 * Check if event type matches pattern (supports wildcards)
 */
export function matchesEventPattern(
  eventType: EventType,
  pattern: string
): boolean {
  if (pattern === '*') return true;
  if (pattern === eventType) return true;

  const patternParts = pattern.split('.');
  const eventParts = eventType.split('.');

  if (patternParts.length !== eventParts.length) {
    // Support suffix wildcard: "mention.*"
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return eventType.startsWith(prefix);
    }
    return false;
  }

  return patternParts.every(
    (part, i) => part === '*' || part === eventParts[i]
  );
}
