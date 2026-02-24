"use strict";
/**
 * Custom Error Classes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError =
  exports.IdentityError =
  exports.StateError =
  exports.EventError =
  exports.ServiceError =
  exports.MoltbotError =
    void 0;
/**
 * Base error class for Moltbot services
 */
class MoltbotError extends Error {
  code;
  details;
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "MoltbotError";
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.MoltbotError = MoltbotError;
/**
 * Service communication error
 */
class ServiceError extends MoltbotError {
  service;
  constructor(message, service, details) {
    super(message, "SERVICE_ERROR", { service, ...details });
    this.service = service;
    this.name = "ServiceError";
  }
}
exports.ServiceError = ServiceError;
/**
 * Event processing error
 */
class EventError extends MoltbotError {
  eventId;
  eventType;
  constructor(message, eventId, eventType, details) {
    super(message, "EVENT_ERROR", { eventId, eventType, ...details });
    this.eventId = eventId;
    this.eventType = eventType;
    this.name = "EventError";
  }
}
exports.EventError = EventError;
/**
 * State management error
 */
class StateError extends MoltbotError {
  agent;
  stateType;
  constructor(message, agent, stateType, details) {
    super(message, "STATE_ERROR", { agent, stateType, ...details });
    this.agent = agent;
    this.stateType = stateType;
    this.name = "StateError";
  }
}
exports.StateError = StateError;
/**
 * Identity loading error
 */
class IdentityError extends MoltbotError {
  agent;
  constructor(message, agent, details) {
    super(message, "IDENTITY_ERROR", { agent, ...details });
    this.agent = agent;
    this.name = "IdentityError";
  }
}
exports.IdentityError = IdentityError;
/**
 * Validation error
 */
class ValidationError extends MoltbotError {
  field;
  value;
  constructor(message, field, value, details) {
    super(message, "VALIDATION_ERROR", { field, value, ...details });
    this.field = field;
    this.value = value;
    this.name = "ValidationError";
  }
}
exports.ValidationError = ValidationError;
//# sourceMappingURL=errors.js.map
