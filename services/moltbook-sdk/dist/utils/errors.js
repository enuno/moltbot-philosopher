"use strict";
/**
 * Custom error classes for Moltbook SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationError =
  exports.TimeoutError =
  exports.NetworkError =
  exports.ConflictError =
  exports.RateLimitError =
  exports.ValidationError =
  exports.NotFoundError =
  exports.ForbiddenError =
  exports.AuthenticationError =
  exports.MoltbookError =
    void 0;
exports.isMoltbookError = isMoltbookError;
exports.isRateLimitError = isRateLimitError;
exports.isAuthenticationError = isAuthenticationError;
class MoltbookError extends Error {
  statusCode;
  code;
  hint;
  constructor(message, statusCode = 500, code, hint) {
    super(message);
    this.name = "MoltbookError";
    this.statusCode = statusCode;
    this.code = code;
    this.hint = hint;
    Error.captureStackTrace(this, this.constructor);
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      hint: this.hint,
    };
  }
}
exports.MoltbookError = MoltbookError;
class AuthenticationError extends MoltbookError {
  constructor(message = "Authentication required", hint) {
    super(message, 401, "UNAUTHORIZED", hint || "Check your API key");
    this.name = "AuthenticationError";
  }
}
exports.AuthenticationError = AuthenticationError;
class ForbiddenError extends MoltbookError {
  constructor(message = "Access denied", hint) {
    super(message, 403, "FORBIDDEN", hint);
    this.name = "ForbiddenError";
  }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends MoltbookError {
  constructor(message = "Resource not found", hint) {
    super(message, 404, "NOT_FOUND", hint);
    this.name = "NotFoundError";
  }
}
exports.NotFoundError = NotFoundError;
class ValidationError extends MoltbookError {
  errors;
  constructor(message = "Validation failed", code, hint, errors) {
    super(message, 400, code || "VALIDATION_ERROR", hint);
    this.name = "ValidationError";
    this.errors = errors;
  }
}
exports.ValidationError = ValidationError;
class RateLimitError extends MoltbookError {
  retryAfter;
  resetAt;
  constructor(message = "Rate limit exceeded", retryAfter = 60, hint) {
    super(message, 429, "RATE_LIMITED", hint || `Try again in ${retryAfter} seconds`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    this.resetAt = new Date(Date.now() + retryAfter * 1000);
  }
  toJSON() {
    return { ...super.toJSON(), retryAfter: this.retryAfter, resetAt: this.resetAt.toISOString() };
  }
}
exports.RateLimitError = RateLimitError;
class ConflictError extends MoltbookError {
  constructor(message = "Resource already exists", hint) {
    super(message, 409, "CONFLICT", hint);
    this.name = "ConflictError";
  }
}
exports.ConflictError = ConflictError;
class NetworkError extends MoltbookError {
  constructor(message = "Network request failed") {
    super(message, 0, "NETWORK_ERROR", "Check your internet connection");
    this.name = "NetworkError";
  }
}
exports.NetworkError = NetworkError;
class TimeoutError extends MoltbookError {
  constructor(message = "Request timed out", timeoutMs) {
    super(
      message,
      0,
      "TIMEOUT",
      timeoutMs ? `Request exceeded ${timeoutMs}ms` : "Request took too long",
    );
    this.name = "TimeoutError";
  }
}
exports.TimeoutError = TimeoutError;
class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigurationError";
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.ConfigurationError = ConfigurationError;
function isMoltbookError(error) {
  return error instanceof MoltbookError;
}
function isRateLimitError(error) {
  return error instanceof RateLimitError;
}
function isAuthenticationError(error) {
  return error instanceof AuthenticationError;
}
//# sourceMappingURL=errors.js.map
