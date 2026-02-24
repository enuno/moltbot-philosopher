/**
 * Utility functions and helpers for Moltbook SDK
 */

import type { Post, Comment } from "../types";

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    maxDelay?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {},
): Promise<T> {
  const { retries = 3, delay = 1000, maxDelay = 30000, onRetry } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt >= retries) {
        throw lastError;
      }

      const backoff = Math.min(delay * Math.pow(2, attempt), maxDelay);

      if (onRetry) {
        onRetry(lastError, attempt);
      }

      await sleep(backoff);
    }
  }

  throw lastError!;
}

/**
 * Paginate through results
 */
export async function* paginate<T>(
  fetchFn: (options: { limit: number; offset: number }) => Promise<T[]>,
  options: { limit?: number; maxPages?: number } = {},
): AsyncGenerator<T[], void, unknown> {
  const { limit = 25, maxPages = Infinity } = options;
  let offset = 0;
  let page = 0;

  while (page < maxPages) {
    const results = await fetchFn({ limit, offset });

    if (results.length === 0) {
      break;
    }

    yield results;

    if (results.length < limit) {
      break;
    }

    offset += limit;
    page++;
  }
}

/**
 * Flatten nested comments into a flat array
 */
export function flattenComments(comments: Comment[]): Comment[] {
  const result: Comment[] = [];

  function traverse(items: Comment[]): void {
    for (const item of items) {
      const { replies, ...comment } = item;
      result.push(comment as Comment);

      if (replies && replies.length > 0) {
        traverse(replies);
      }
    }
  }

  traverse(comments);
  return result;
}

/**
 * Count total comments including nested
 */
export function countComments(comments: Comment[]): number {
  let total = 0;

  function traverse(items: Comment[]): void {
    for (const item of items) {
      total++;
      if (item.replies && item.replies.length > 0) {
        traverse(item.replies);
      }
    }
  }

  traverse(comments);
  return total;
}

/**
 * Get max depth of comment tree
 */
export function getMaxDepth(comments: Comment[]): number {
  let maxDepth = 0;

  function traverse(items: Comment[], currentDepth: number): void {
    for (const item of items) {
      maxDepth = Math.max(maxDepth, currentDepth);
      if (item.replies && item.replies.length > 0) {
        traverse(item.replies, currentDepth + 1);
      }
    }
  }

  traverse(comments, 0);
  return maxDepth;
}

/**
 * Format post score for display
 */
export function formatScore(score: number): string {
  if (Math.abs(score) >= 1000000) {
    return (score / 1000000).toFixed(1) + "M";
  }
  if (Math.abs(score) >= 1000) {
    return (score / 1000).toFixed(1) + "K";
  }
  return score.toString();
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${diffYears}y ago`;
}

/**
 * Validate API key format
 */
export function isValidApiKey(apiKey: string): boolean {
  return typeof apiKey === "string" && apiKey.startsWith("moltbook_") && apiKey.length > 20;
}

/**
 * Validate agent name format
 */
export function isValidAgentName(name: string): boolean {
  return /^[a-z0-9_]{2,32}$/i.test(name);
}

/**
 * Validate submolt name format
 */
export function isValidSubmoltName(name: string): boolean {
  return /^[a-z0-9_]{2,24}$/i.test(name);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Check if post is a link post
 */
export function isLinkPost(post: Post): boolean {
  return post.postType === "link" && !!post.url;
}

/**
 * Check if post is a text post
 */
export function isTextPost(post: Post): boolean {
  return post.postType === "text" && !!post.content;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Create a simple event emitter
 */
export function createEventEmitter<T extends Record<string, unknown[]>>() {
  const listeners = new Map<keyof T, Set<(...args: unknown[]) => void>>();

  return {
    on<K extends keyof T>(event: K, callback: (...args: T[K]) => void): () => void {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(callback as (...args: unknown[]) => void);

      return () => {
        listeners.get(event)?.delete(callback as (...args: unknown[]) => void);
      };
    },

    emit<K extends keyof T>(event: K, ...args: T[K]): void {
      listeners.get(event)?.forEach((cb) => cb(...args));
    },

    off<K extends keyof T>(event: K, callback?: (...args: T[K]) => void): void {
      if (callback) {
        listeners.get(event)?.delete(callback as (...args: unknown[]) => void);
      } else {
        listeners.delete(event);
      }
    },
  };
}
