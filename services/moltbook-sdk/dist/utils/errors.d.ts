/**
 * Custom error classes for Moltbook SDK
 */
import type { ErrorCode } from "../types";
export declare class MoltbookError extends Error {
  readonly statusCode: number;
  readonly code?: ErrorCode | string;
  readonly hint?: string;
  constructor(message: string, statusCode?: number, code?: ErrorCode | string, hint?: string);
  toJSON(): Record<string, unknown>;
}
export declare class AuthenticationError extends MoltbookError {
  constructor(message?: string, hint?: string);
}
export declare class ForbiddenError extends MoltbookError {
  constructor(message?: string, hint?: string);
}
export declare class NotFoundError extends MoltbookError {
  constructor(message?: string, hint?: string);
}
export declare class ValidationError extends MoltbookError {
  readonly errors?: Record<string, string[]>;
  constructor(message?: string, code?: string, hint?: string, errors?: Record<string, string[]>);
}
export declare class RateLimitError extends MoltbookError {
  readonly retryAfter: number;
  readonly resetAt: Date;
  constructor(message?: string, retryAfter?: number, hint?: string);
  toJSON(): Record<string, unknown>;
}
export declare class ConflictError extends MoltbookError {
  constructor(message?: string, hint?: string);
}
export declare class NetworkError extends MoltbookError {
  constructor(message?: string);
}
export declare class TimeoutError extends MoltbookError {
  constructor(message?: string, timeoutMs?: number);
}
export declare class ConfigurationError extends Error {
  constructor(message: string);
}
export declare function isMoltbookError(error: unknown): error is MoltbookError;
export declare function isRateLimitError(error: unknown): error is RateLimitError;
export declare function isAuthenticationError(error: unknown): error is AuthenticationError;
//# sourceMappingURL=errors.d.ts.map
