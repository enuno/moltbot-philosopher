/**
 * Caching utilities for Moltbook SDK
 */
export interface CacheEntry<T> {
    value: T;
    timestamp: number;
    expiresAt: number;
}
export interface CacheOptions {
    /** Time to live in milliseconds */
    ttl?: number;
    /** Maximum number of entries */
    maxSize?: number;
    /** Whether to refresh TTL on access */
    refreshOnAccess?: boolean;
}
export interface Cache<T> {
    get(key: string): T | undefined;
    set(key: string, value: T): void;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    size(): number;
    keys(): string[];
    values(): T[];
    entries(): Array<[string, T]>;
    cleanup(): number;
    stats(): CacheStats;
}
export interface CacheStats {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    oldestEntry: number | null;
    newestEntry: number | null;
}
export declare function createCache<T>(options?: CacheOptions): Cache<T>;
/** Create a memoized function with caching */
export declare function memoize<Args extends unknown[], Result>(fn: (...args: Args) => Result | Promise<Result>, options?: CacheOptions & {
    keyFn?: (...args: Args) => string;
}): (...args: Args) => Result | Promise<Result>;
/** LRU Cache implementation */
export declare function createLRUCache<T>(maxSize: number): Cache<T>;
/** Response cache for HTTP requests */
export interface ResponseCacheOptions extends CacheOptions {
    /** Cache GET requests only */
    getOnly?: boolean;
    /** Paths to exclude from caching */
    excludePaths?: string[];
    /** Paths to include in caching */
    includePaths?: string[];
}
export declare function createResponseCache(options?: ResponseCacheOptions): {
    shouldCache: (method: string, path: string) => boolean;
    getCacheKey: (method: string, path: string, query?: Record<string, unknown>) => string;
    cache: Cache<unknown>;
};
//# sourceMappingURL=cache.d.ts.map
