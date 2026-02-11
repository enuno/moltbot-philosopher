/**
 * Request/Response middleware and interceptors for Moltbook SDK
 */

import type { RequestConfig, ApiResponse } from '../types';
import { EVENTS } from './constants';

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

export function createMiddlewareManager(): MiddlewareManager {
  const middlewares: Middleware[] = [];

  return {
    use(middleware: Middleware): () => void {
      middlewares.push(middleware);
      return () => {
        const index = middlewares.indexOf(middleware);
        if (index > -1) middlewares.splice(index, 1);
      };
    },

    async executeRequest(config: RequestConfig): Promise<RequestConfig> {
      let result = config;
      for (const m of middlewares) {
        if (m.request) result = await m.request(result);
      }
      return result;
    },

    async executeResponse<T>(response: T): Promise<T> {
      let result = response;
      for (const m of middlewares) {
        if (m.response) result = await (m.response as ResponseInterceptor<T>)(result);
      }
      return result;
    },

    async executeError(error: Error): Promise<Error> {
      let result = error;
      for (const m of middlewares) {
        if (m.error) result = await m.error(result);
      }
      return result;
    },

    clear(): void {
      middlewares.length = 0;
    }
  };
}

/** Logging middleware */
export function createLoggingMiddleware(logger: { log: (...args: unknown[]) => void } = console): Middleware {
  return {
    request(config) {
      logger.log(`[Moltbook] ${config.method} ${config.path}`);
      return config;
    },
    response(response) {
      logger.log('[Moltbook] Response received');
      return response;
    },
    error(error) {
      logger.log('[Moltbook] Error:', error.message);
      return error;
    }
  };
}

/** Timing middleware */
export function createTimingMiddleware(): Middleware {
  const timings = new Map<string, number>();

  return {
    request(config) {
      timings.set(config.path, Date.now());
      return config;
    },
    response(response) {
      return response;
    }
  };
}

/** Rate limit tracking middleware */
export function createRateLimitMiddleware(onRateLimit?: (remaining: number, resetAt: Date) => void): Middleware {
  return {
    response(response: unknown) {
      const resp = response as { headers?: { get?: (key: string) => string | null } };
      if (resp?.headers?.get) {
        const remaining = resp.headers.get('X-RateLimit-Remaining');
        const reset = resp.headers.get('X-RateLimit-Reset');
        if (remaining && reset && onRateLimit) {
          onRateLimit(parseInt(remaining, 10), new Date(parseInt(reset, 10) * 1000));
        }
      }
      return response;
    }
  };
}

/** Cache middleware */
export function createCacheMiddleware(options: { ttl?: number; maxSize?: number } = {}): Middleware {
  const { ttl = 60000, maxSize = 100 } = options;
  const cache = new Map<string, { data: unknown; timestamp: number }>();

  const getCacheKey = (config: RequestConfig): string => {
    return `${config.method}:${config.path}:${JSON.stringify(config.query || {})}`;
  };

  const isExpired = (timestamp: number): boolean => {
    return Date.now() - timestamp > ttl;
  };

  const cleanup = (): void => {
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, entries.length - maxSize);
      toDelete.forEach(([key]) => cache.delete(key));
    }
  };

  return {
    request(config) {
      if (config.method !== 'GET') return config;

      const key = getCacheKey(config);
      const cached = cache.get(key);

      if (cached && !isExpired(cached.timestamp)) {
        (config as RequestConfig & { _cached?: unknown })._cached = cached.data;
      }

      return config;
    },
    response(response) {
      cleanup();
      return response;
    }
  };
}

/** Retry middleware */
export function createRetryMiddleware(options: { maxRetries?: number; delay?: number; shouldRetry?: (error: Error) => boolean } = {}): Middleware {
  const { maxRetries = 3, delay = 1000, shouldRetry = () => true } = options;

  return {
    async error(error) {
      if (!shouldRetry(error)) return error;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
        // Retry logic would be handled by the HTTP client
      }

      return error;
    }
  };
}

/** Authentication middleware */
export function createAuthMiddleware(getToken: () => string | null | Promise<string | null>): Middleware {
  return {
    async request(config) {
      const token = await getToken();
      if (token) {
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      }
      return config;
    }
  };
}

/** Request ID middleware */
export function createRequestIdMiddleware(): Middleware {
  let counter = 0;

  return {
    request(config) {
      config.headers = { ...config.headers, 'X-Request-ID': `${Date.now()}-${++counter}` };
      return config;
    }
  };
}

/** Compression middleware */
export function createCompressionMiddleware(): Middleware {
  return {
    request(config) {
      config.headers = { ...config.headers, 'Accept-Encoding': 'gzip, deflate' };
      return config;
    }
  };
}
