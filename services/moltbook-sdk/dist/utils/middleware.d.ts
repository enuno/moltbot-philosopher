/**
 * Request/Response middleware and interceptors for Moltbook SDK
 */
import type { RequestConfig } from "../types";
export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
export type ResponseInterceptor<T = unknown> = (response: T) => T | Promise<T>;
export type ErrorInterceptor = (error: Error) => Error | Promise<Error>;
export interface Middleware {
    request?: RequestInterceptor;
    response?: ResponseInterceptor;
    error?: ErrorInterceptor;
}
export interface MiddlewareManager {
    use(middleware: Middleware): () => void;
    executeRequest(config: RequestConfig): Promise<RequestConfig>;
    executeResponse<T>(response: T): Promise<T>;
    executeError(error: Error): Promise<Error>;
    clear(): void;
}
export declare function createMiddlewareManager(): MiddlewareManager;
/** Logging middleware */
export declare function createLoggingMiddleware(logger?: {
    log: (...args: unknown[]) => void;
}): Middleware;
/** Timing middleware */
export declare function createTimingMiddleware(): Middleware;
/** Rate limit tracking middleware */
export declare function createRateLimitMiddleware(onRateLimit?: (remaining: number, resetAt: Date) => void): Middleware;
/** Cache middleware */
export declare function createCacheMiddleware(options?: {
    ttl?: number;
    maxSize?: number;
}): Middleware;
/** Retry middleware */
export declare function createRetryMiddleware(options?: {
    maxRetries?: number;
    delay?: number;
    shouldRetry?: (error: Error) => boolean;
}): Middleware;
/** Authentication middleware */
export declare function createAuthMiddleware(getToken: () => string | null | Promise<string | null>): Middleware;
/** Request ID middleware */
export declare function createRequestIdMiddleware(): Middleware;
/** Compression middleware */
export declare function createCompressionMiddleware(): Middleware;
//# sourceMappingURL=middleware.d.ts.map