/**
 * Utility Functions
 */
import type { BaseEvent, EventType, EventPriority } from '../types/event.js';
import type { PhilosopherName } from '../types/agent.js';
/**
 * Generate a unique event ID
 */
export declare function generateEventId(): string;
/**
 * Generate a correlation ID
 */
export declare function generateCorrelationId(): string;
/**
 * Create a base event
 */
export declare function createEvent<T = unknown>(type: EventType, payload: T, options: {
    target?: PhilosopherName | null;
    priority?: EventPriority;
    source: string;
    correlationId?: string;
}): BaseEvent<T>;
/**
 * Sleep utility
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry with exponential backoff
 */
export declare function retryWithBackoff<T>(fn: () => Promise<T>, options?: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
}): Promise<T>;
/**
 * Check if event type matches pattern (supports wildcards)
 */
export declare function matchesEventPattern(eventType: EventType, pattern: string): boolean;
//# sourceMappingURL=helpers.d.ts.map
