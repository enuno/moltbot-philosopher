/**
 * Utility functions and helpers for Moltbook SDK
 */
import type { Post, Comment } from '../types';
/**
 * Sleep for specified milliseconds
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry a function with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, options?: {
    retries?: number;
    delay?: number;
    maxDelay?: number;
    onRetry?: (error: Error, attempt: number) => void;
}): Promise<T>;
/**
 * Paginate through results
 */
export declare function paginate<T>(fetchFn: (options: {
    limit: number;
    offset: number;
}) => Promise<T[]>, options?: {
    limit?: number;
    maxPages?: number;
}): AsyncGenerator<T[], void, unknown>;
/**
 * Flatten nested comments into a flat array
 */
export declare function flattenComments(comments: Comment[]): Comment[];
/**
 * Count total comments including nested
 */
export declare function countComments(comments: Comment[]): number;
/**
 * Get max depth of comment tree
 */
export declare function getMaxDepth(comments: Comment[]): number;
/**
 * Format post score for display
 */
export declare function formatScore(score: number): string;
/**
 * Format relative time
 */
export declare function formatRelativeTime(date: Date | string): string;
/**
 * Validate API key format
 */
export declare function isValidApiKey(apiKey: string): boolean;
/**
 * Validate agent name format
 */
export declare function isValidAgentName(name: string): boolean;
/**
 * Validate submolt name format
 */
export declare function isValidSubmoltName(name: string): boolean;
/**
 * Truncate text with ellipsis
 */
export declare function truncate(text: string, maxLength: number): string;
/**
 * Extract domain from URL
 */
export declare function extractDomain(url: string): string | null;
/**
 * Check if post is a link post
 */
export declare function isLinkPost(post: Post): boolean;
/**
 * Check if post is a text post
 */
export declare function isTextPost(post: Post): boolean;
/**
 * Debounce function
 */
export declare function debounce<T extends (...args: unknown[]) => unknown>(fn: T, wait: number): (...args: Parameters<T>) => void;
/**
 * Throttle function
 */
export declare function throttle<T extends (...args: unknown[]) => unknown>(fn: T, limit: number): (...args: Parameters<T>) => void;
/**
 * Create a simple event emitter
 */
export declare function createEventEmitter<T extends Record<string, unknown[]>>(): {
    on<K extends keyof T>(event: K, callback: (...args: T[K]) => void): () => void;
    emit<K extends keyof T>(event: K, ...args: T[K]): void;
    off<K extends keyof T>(event: K, callback?: (...args: T[K]) => void): void;
};
//# sourceMappingURL=helpers.d.ts.map
