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

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_SIZE = 1000;

export function createCache<T>(options: CacheOptions = {}): Cache<T> {
  const { ttl = DEFAULT_TTL, maxSize = DEFAULT_MAX_SIZE, refreshOnAccess = false } = options;
  const store = new Map<string, CacheEntry<T>>();
  let hits = 0;
  let misses = 0;

  const isExpired = (entry: CacheEntry<T>): boolean => {
    return Date.now() > entry.expiresAt;
  };

  const evictOldest = (): void => {
    if (store.size === 0) return;

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of store) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) store.delete(oldestKey);
  };

  return {
    get(key: string): T | undefined {
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

    set(key: string, value: T): void {
      while (store.size >= maxSize) {
        evictOldest();
      }

      const now = Date.now();
      store.set(key, {
        value,
        timestamp: now,
        expiresAt: now + ttl
      });
    },

    has(key: string): boolean {
      const entry = store.get(key);
      if (!entry) return false;
      if (isExpired(entry)) {
        store.delete(key);
        return false;
      }
      return true;
    },

    delete(key: string): boolean {
      return store.delete(key);
    },

    clear(): void {
      store.clear();
      hits = 0;
      misses = 0;
    },

    size(): number {
      return store.size;
    },

    keys(): string[] {
      const keys: string[] = [];
      for (const [key, entry] of store) {
        if (!isExpired(entry)) keys.push(key);
      }
      return keys;
    },

    values(): T[] {
      const values: T[] = [];
      for (const [, entry] of store) {
        if (!isExpired(entry)) values.push(entry.value);
      }
      return values;
    },

    entries(): Array<[string, T]> {
      const entries: Array<[string, T]> = [];
      for (const [key, entry] of store) {
        if (!isExpired(entry)) entries.push([key, entry.value]);
      }
      return entries;
    },

    cleanup(): number {
      let cleaned = 0;
      for (const [key, entry] of store) {
        if (isExpired(entry)) {
          store.delete(key);
          cleaned++;
        }
      }
      return cleaned;
    },

    stats(): CacheStats {
      const total = hits + misses;
      let oldest: number | null = null;
      let newest: number | null = null;

      for (const [, entry] of store) {
        if (oldest === null || entry.timestamp < oldest) oldest = entry.timestamp;
        if (newest === null || entry.timestamp > newest) newest = entry.timestamp;
      }

      return {
        size: store.size,
        hits,
        misses,
        hitRate: total > 0 ? hits / total : 0,
        oldestEntry: oldest,
        newestEntry: newest
      };
    }
  };
}

/** Create a memoized function with caching */
export function memoize<Args extends unknown[], Result>(
  fn: (...args: Args) => Result | Promise<Result>,
  options: CacheOptions & { keyFn?: (...args: Args) => string } = {}
): (...args: Args) => Result | Promise<Result> {
  const cache = createCache<Result>(options);
  const keyFn = options.keyFn || ((...args: Args) => JSON.stringify(args));

  return (...args: Args) => {
    const key = keyFn(...args);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);

    if (result instanceof Promise) {
      return result.then(value => {
        cache.set(key, value);
        return value;
      });
    }

    cache.set(key, result);
    return result;
  };
}

/** LRU Cache implementation */
export function createLRUCache<T>(maxSize: number): Cache<T> {
  const store = new Map<string, T>();
  let hits = 0;
  let misses = 0;

  return {
    get(key: string): T | undefined {
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

    set(key: string, value: T): void {
      if (store.has(key)) {
        store.delete(key);
      } else if (store.size >= maxSize) {
        // Delete oldest (first)
        const firstKey = store.keys().next().value;
        if (firstKey) store.delete(firstKey);
      }
      store.set(key, value);
    },

    has(key: string): boolean {
      return store.has(key);
    },

    delete(key: string): boolean {
      return store.delete(key);
    },

    clear(): void {
      store.clear();
      hits = 0;
      misses = 0;
    },

    size(): number {
      return store.size;
    },

    keys(): string[] {
      return Array.from(store.keys());
    },

    values(): T[] {
      return Array.from(store.values());
    },

    entries(): Array<[string, T]> {
      return Array.from(store.entries());
    },

    cleanup(): number {
      return 0;
    },

    stats(): CacheStats {
      const total = hits + misses;
      return {
        size: store.size,
        hits,
        misses,
        hitRate: total > 0 ? hits / total : 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
  };
}

/** Response cache for HTTP requests */
export interface ResponseCacheOptions extends CacheOptions {
  /** Cache GET requests only */
  getOnly?: boolean;
  /** Paths to exclude from caching */
  excludePaths?: string[];
  /** Paths to include in caching */
  includePaths?: string[];
}

export function createResponseCache(options: ResponseCacheOptions = {}): {
  shouldCache: (method: string, path: string) => boolean;
  getCacheKey: (method: string, path: string, query?: Record<string, unknown>) => string;
  cache: Cache<unknown>;
} {
  const { getOnly = true, excludePaths = [], includePaths } = options;
  const cache = createCache<unknown>(options);

  return {
    shouldCache(method: string, path: string): boolean {
      if (getOnly && method !== 'GET') return false;
      if (excludePaths.some(p => path.startsWith(p))) return false;
      if (includePaths && !includePaths.some(p => path.startsWith(p))) return false;
      return true;
    },

    getCacheKey(method: string, path: string, query?: Record<string, unknown>): string {
      return `${method}:${path}:${query ? JSON.stringify(query) : ''}`;
    },

    cache
  };
}
