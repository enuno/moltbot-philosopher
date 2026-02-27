"use strict";
/**
 * Request/Response middleware and interceptors for Moltbook SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMiddlewareManager = createMiddlewareManager;
exports.createLoggingMiddleware = createLoggingMiddleware;
exports.createTimingMiddleware = createTimingMiddleware;
exports.createRateLimitMiddleware = createRateLimitMiddleware;
exports.createCacheMiddleware = createCacheMiddleware;
exports.createRetryMiddleware = createRetryMiddleware;
exports.createAuthMiddleware = createAuthMiddleware;
exports.createRequestIdMiddleware = createRequestIdMiddleware;
exports.createCompressionMiddleware = createCompressionMiddleware;
function createMiddlewareManager() {
    const middlewares = [];
    return {
        use(middleware) {
            middlewares.push(middleware);
            return () => {
                const index = middlewares.indexOf(middleware);
                if (index > -1)
                    middlewares.splice(index, 1);
            };
        },
        async executeRequest(config) {
            let result = config;
            for (const m of middlewares) {
                if (m.request)
                    result = await m.request(result);
            }
            return result;
        },
        async executeResponse(response) {
            let result = response;
            for (const m of middlewares) {
                if (m.response)
                    result = await m.response(result);
            }
            return result;
        },
        async executeError(error) {
            let result = error;
            for (const m of middlewares) {
                if (m.error)
                    result = await m.error(result);
            }
            return result;
        },
        clear() {
            middlewares.length = 0;
        },
    };
}
/** Logging middleware */
function createLoggingMiddleware(logger = console) {
    return {
        request(config) {
            logger.log(`[Moltbook] ${config.method} ${config.path}`);
            return config;
        },
        response(response) {
            logger.log("[Moltbook] Response received");
            return response;
        },
        error(error) {
            logger.log("[Moltbook] Error:", error.message);
            return error;
        },
    };
}
/** Timing middleware */
function createTimingMiddleware() {
    const timings = new Map();
    return {
        request(config) {
            timings.set(config.path, Date.now());
            return config;
        },
        response(response) {
            return response;
        },
    };
}
/** Rate limit tracking middleware */
function createRateLimitMiddleware(onRateLimit) {
    return {
        response(response) {
            const resp = response;
            if (resp?.headers?.get) {
                const remaining = resp.headers.get("X-RateLimit-Remaining");
                const reset = resp.headers.get("X-RateLimit-Reset");
                if (remaining && reset && onRateLimit) {
                    onRateLimit(parseInt(remaining, 10), new Date(parseInt(reset, 10) * 1000));
                }
            }
            return response;
        },
    };
}
/** Cache middleware */
function createCacheMiddleware(options = {}) {
    const { ttl = 60000, maxSize = 100 } = options;
    const cache = new Map();
    const getCacheKey = (config) => {
        return `${config.method}:${config.path}:${JSON.stringify(config.query || {})}`;
    };
    const isExpired = (timestamp) => {
        return Date.now() - timestamp > ttl;
    };
    const cleanup = () => {
        if (cache.size > maxSize) {
            const entries = Array.from(cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toDelete = entries.slice(0, entries.length - maxSize);
            toDelete.forEach(([key]) => cache.delete(key));
        }
    };
    return {
        request(config) {
            if (config.method !== "GET")
                return config;
            const key = getCacheKey(config);
            const cached = cache.get(key);
            if (cached && !isExpired(cached.timestamp)) {
                config._cached = cached.data;
            }
            return config;
        },
        response(response) {
            cleanup();
            return response;
        },
    };
}
/** Retry middleware */
function createRetryMiddleware(options = {}) {
    const { maxRetries = 3, delay = 1000, shouldRetry = () => true } = options;
    return {
        async error(error) {
            if (!shouldRetry(error))
                return error;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
                // Retry logic would be handled by the HTTP client
            }
            return error;
        },
    };
}
/** Authentication middleware */
function createAuthMiddleware(getToken) {
    return {
        async request(config) {
            const token = await getToken();
            if (token) {
                config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
            }
            return config;
        },
    };
}
/** Request ID middleware */
function createRequestIdMiddleware() {
    let counter = 0;
    return {
        request(config) {
            config.headers = { ...config.headers, "X-Request-ID": `${Date.now()}-${++counter}` };
            return config;
        },
    };
}
/** Compression middleware */
function createCompressionMiddleware() {
    return {
        request(config) {
            config.headers = { ...config.headers, "Accept-Encoding": "gzip, deflate" };
            return config;
        },
    };
}
//# sourceMappingURL=middleware.js.map