/**
 * Custom Error Classes
 */
/**
 * Base error class for Moltbot services
 */
export declare class MoltbotError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown> | undefined);
}
/**
 * Service communication error
 */
export declare class ServiceError extends MoltbotError {
    readonly service: string;
    constructor(message: string, service: string, details?: Record<string, unknown>);
}
/**
 * Event processing error
 */
export declare class EventError extends MoltbotError {
    readonly eventId: string;
    readonly eventType: string;
    constructor(message: string, eventId: string, eventType: string, details?: Record<string, unknown>);
}
/**
 * State management error
 */
export declare class StateError extends MoltbotError {
    readonly agent: string;
    readonly stateType: string;
    constructor(message: string, agent: string, stateType: string, details?: Record<string, unknown>);
}
/**
 * Identity loading error
 */
export declare class IdentityError extends MoltbotError {
    readonly agent: string;
    constructor(message: string, agent: string, details?: Record<string, unknown>);
}
/**
 * Validation error
 */
export declare class ValidationError extends MoltbotError {
    readonly field: string;
    readonly value: unknown;
    constructor(message: string, field: string, value: unknown, details?: Record<string, unknown>);
}
//# sourceMappingURL=errors.d.ts.map
