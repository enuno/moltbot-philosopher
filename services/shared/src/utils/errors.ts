/**
 * Custom Error Classes
 */

/**
 * Base error class for Moltbot services
 */
export class MoltbotError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MoltbotError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Service communication error
 */
export class ServiceError extends MoltbotError {
  constructor(
    message: string,
    public readonly service: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'SERVICE_ERROR', { service, ...details });
    this.name = 'ServiceError';
  }
}

/**
 * Event processing error
 */
export class EventError extends MoltbotError {
  constructor(
    message: string,
    public readonly eventId: string,
    public readonly eventType: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'EVENT_ERROR', { eventId, eventType, ...details });
    this.name = 'EventError';
  }
}

/**
 * State management error
 */
export class StateError extends MoltbotError {
  constructor(
    message: string,
    public readonly agent: string,
    public readonly stateType: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'STATE_ERROR', { agent, stateType, ...details });
    this.name = 'StateError';
  }
}

/**
 * Identity loading error
 */
export class IdentityError extends MoltbotError {
  constructor(
    message: string,
    public readonly agent: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'IDENTITY_ERROR', { agent, ...details });
    this.name = 'IdentityError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends MoltbotError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
    details?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', { field, value, ...details });
    this.name = 'ValidationError';
  }
}
