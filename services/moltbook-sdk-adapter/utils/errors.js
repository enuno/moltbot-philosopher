/**
 * Typed error classes for Moltbook API errors
 * Based on Moltbook ADK error handling patterns
 */

class MoltbookError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'MoltbookError';
    this.statusCode = statusCode;
    this.response = response;
    Error.captureStackTrace(this, this.constructor);
  }
}

class AuthenticationError extends MoltbookError {
  constructor(message, response) {
    super(message, 401, response);
    this.name = 'AuthenticationError';
  }
}

class RateLimitError extends MoltbookError {
  constructor(message, response, retryAfter) {
    super(message, 429, response);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

class NotFoundError extends MoltbookError {
  constructor(message, response) {
    super(message, 404, response);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends MoltbookError {
  constructor(message, response, errors) {
    super(message, 400, response);
    this.name = 'ValidationError';
    this.errors = errors || [];
  }
}

class NetworkError extends MoltbookError {
  constructor(message, originalError) {
    super(message, null, null);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

module.exports = {
  MoltbookError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  NetworkError,
};
