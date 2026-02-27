"use strict";
/**
 * Caching utilities for Moltbook SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCache = createCache;
exports.memoize = memoize;
exports.createLRUCache = createLRUCache;
exports.createResponseCache = createResponseCache;
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_SIZE = 1000;
function createCache(options = {}) {
    const { ttl = DEFAULT_TTL, maxSize = DEFAULT_MAX_SIZE, refreshOnAccess = false } = options;
    const store = new Map();
    let hits = 0;
    let misses = 0;
    const isExpired = (entry) => {
        return Date.now() > entry.expiresAt;
    };
    const evictOldest = () => {
        if (store.size === 0)
            return;
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [key, entry] of store) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }
        if (oldestKey)
            store.delete(oldestKey);
    };
    return {
        get(key) {
            const entry = store.get(key);
            if (!entry) {
                misses++;
                return undefined;
            }
            if (isExpired(entry)) {
                store.delete(key);
                misses++;
                return undefined;
            }
            hits++;
            if (refreshOnAccess) {
                entry.expiresAt = Date.now() + ttl;
            }
            return entry.value;
        },
        set(key, value) {
            while (store.size >= maxSize) {
                evictOldest();
            }
            const now = Date.now();
            store.set(key, {
                value,
                timestamp: now,
                expiresAt: now + ttl,
            });
        },
        has(key) {
            const entry = store.get(key);
            if (!entry)
                return false;
            if (isExpired(entry)) {
                store.delete(key);
                return false;
            }
            return true;
        },
        delete(key) {
            return store.delete(key);
        },
        clear() {
            store.clear();
            hits = 0;
            misses = 0;
        },
        size() {
            return store.size;
        },
        keys() {
            const keys = [];
            for (const [key, entry] of store) {
                if (!isExpired(entry))
                    keys.push(key);
            }
            return keys;
        },
        values() {
            const values = [];
            for (const [, entry] of store) {
                if (!isExpired(entry))
                    values.push(entry.value);
            }
            return values;
        },
        entries() {
            const entries = [];
            for (const [key, entry] of store) {
                if (!isExpired(entry))
                    entries.push([key, entry.value]);
            }
            return entries;
        },
        cleanup() {
            let cleaned = 0;
            for (const [key, entry] of store) {
                if (isExpired(entry)) {
                    store.delete(key);
                    cleaned++;
                }
            }
            return cleaned;
        },
        stats() {
            const total = hits + misses;
            let oldest = null;
            let newest = null;
            for (const [, entry] of store) {
                if (oldest === null || entry.timestamp < oldest)
                    oldest = entry.timestamp;
                if (newest === null || entry.timestamp > newest)
                    newest = entry.timestamp;
            }
            return {
                size: store.size,
                hits,
                misses,
                hitRate: total > 0 ? hits / total : 0,
                oldestEntry: oldest,
                newestEntry: newest,
            };
        },
    };
}
/** Create a memoized function with caching */
function memoize(fn, options = {}) {
    const cache = createCache(options);
    const keyFn = options.keyFn || ((...args) => JSON.stringify(args));
    return (...args) => {
        const key = keyFn(...args);
        const cached = cache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const result = fn(...args);
        if (result instanceof Promise) {
            return result.then((value) => {
                cache.set(key, value);
                return value;
            });
        }
        cache.set(key, result);
        return result;
    };
}
/** LRU Cache implementation */
function createLRUCache(maxSize) {
    const store = new Map();
    let hits = 0;
    let misses = 0;
    return {
        get(key) {
            const value = store.get(key);
            if (value === undefined) {
                misses++;
                return undefined;
            }
            hits++;
            // Move to end (most recently used)
            store.delete(key);
            store.set(key, value);
            return value;
        },
        set(key, value) {
            if (store.has(key)) {
                store.delete(key);
            }
            else if (store.size >= maxSize) {
                // Delete oldest (first)
                const firstKey = store.keys().next().value;
                if (firstKey)
                    store.delete(firstKey);
            }
            store.set(key, value);
        },
        has(key) {
            return store.has(key);
        },
        delete(key) {
            return store.delete(key);
        },
        clear() {
            store.clear();
            hits = 0;
            misses = 0;
        },
        size() {
            return store.size;
        },
        keys() {
            return Array.from(store.keys());
        },
        values() {
            return Array.from(store.values());
        },
        entries() {
            return Array.from(store.entries());
        },
        cleanup() {
            return 0;
        },
        stats() {
            const total = hits + misses;
            return {
                size: store.size,
                hits,
                misses,
                hitRate: total > 0 ? hits / total : 0,
                oldestEntry: null,
                newestEntry: null,
            };
        },
    };
}
function createResponseCache(options = {}) {
    const { getOnly = true, excludePaths = [], includePaths } = options;
    const cache = createCache(options);
    return {
        shouldCache(method, path) {
            if (getOnly && method !== "GET")
                return false;
            if (excludePaths.some((p) => path.startsWith(p)))
                return false;
            if (includePaths && !includePaths.some((p) => path.startsWith(p)))
                return false;
            return true;
        },
        getCacheKey(method, path, query) {
            return `${method}:${path}:${query ? JSON.stringify(query) : ""}`;
        },
        cache,
    };
}
//# sourceMappingURL=cache.js.map