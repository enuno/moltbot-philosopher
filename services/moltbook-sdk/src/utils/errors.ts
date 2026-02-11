/**
 * Custom error classes for Moltbook SDK
 */

import type { ErrorCode } from '../types';

export class MoltbookError extends Error {
  readonly statusCode: number;
  readonly code?: ErrorCode | string;
  readonly hint?: string;

  constructor(message: string, statusCode: number = 500, code?: ErrorCode | string, hint?: string) {
    super(message);
    this.name = 'MoltbookError';
    this.statusCode = statusCode;
    this.code = code;
    this.hint = hint;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, message: this.message, statusCode: this.statusCode, code: this.code, hint: this.hint };
  }
}

export class AuthenticationError extends MoltbookError {
  constructor(message: string = 'Authentication required', hint?: string) {
    super(message, 401, 'UNAUTHORIZED', hint || 'Check your API key');
    this.name = 'AuthenticationError';
  }
}

export class ForbiddenError extends MoltbookError {
  constructor(message: string = 'Access denied', hint?: string) {
    super(message, 403, 'FORBIDDEN', hint);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends MoltbookError {
  constructor(message: string = 'Resource not found', hint?: string) {
    super(message, 404, 'NOT_FOUND', hint);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends MoltbookError {
  readonly errors?: Record<string, string[]>;

  constructor(message: string = 'Validation failed', code?: string, hint?: string, errors?: Record<string, string[]>) {
    super(message, 400, code || 'VALIDATION_ERROR', hint);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class RateLimitError extends MoltbookError {
  readonly retryAfter: number;
  readonly resetAt: Date;

  constructor(message: string = 'Rate limit exceeded', retryAfter: number = 60, hint?: string) {
    super(message, 429, 'RATE_LIMITED', hint || `Try again in ${retryAfter} seconds`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.resetAt = new Date(Date.now() + retryAfter * 1000);
  }

  toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), retryAfter: this.retryAfter, resetAt: this.resetAt.toISOString() };
  }
}

export class ConflictError extends MoltbookError {
  constructor(message: string = 'Resource already exists', hint?: string) {
    super(message, 409, 'CONFLICT', hint);
    this.name = 'ConflictError';
  }
}

export class NetworkError extends MoltbookError {
  constructor(message: string = 'Network request failed') {
    super(message, 0, 'NETWORK_ERROR', 'Check your internet connection');
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends MoltbookError {
  constructor(message: string = 'Request timed out', timeoutMs?: number) {
    super(message, 0, 'TIMEOUT', timeoutMs ? `Request exceeded ${timeoutMs}ms` : 'Request took too long');
    this.name = 'TimeoutError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function isMoltbookError(error: unknown): error is MoltbookError { return error instanceof MoltbookError; }
export function isRateLimitError(error: unknown): error is RateLimitError { return error instanceof RateLimitError; }
export function isAuthenticationError(error: unknown): error is AuthenticationError { return error instanceof AuthenticationError; }
