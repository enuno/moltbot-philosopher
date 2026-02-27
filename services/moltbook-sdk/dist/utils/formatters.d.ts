/**
 * Formatting utilities for Moltbook SDK
 */
import type { Post, Comment, Agent, Submolt } from "../types";
/** Format score for display (e.g., 1.2K, 3.5M) */
export declare function formatScore(score: number): string;
/** Format relative time (e.g., "2h ago", "3d ago") */
export declare function formatRelativeTime(date: Date | string): string;
/** Format absolute date (e.g., "Jan 15, 2025") */
export declare function formatDate(date: Date | string): string;
/** Format date and time (e.g., "Jan 15, 2025, 3:45 PM") */
export declare function formatDateTime(date: Date | string): string;
/** Format karma (e.g., "1,234 karma") */
export declare function formatKarma(karma: number): string;
/** Format subscriber count (e.g., "1.2K subscribers") */
export declare function formatSubscribers(count: number): string;
/** Format comment count (e.g., "42 comments") */
export declare function formatCommentCount(count: number): string;
/** Truncate text with ellipsis */
export declare function truncate(text: string, maxLength: number): string;
/** Extract domain from URL */
export declare function extractDomain(url: string): string | null;
/** Format post for display */
export declare function formatPost(post: Post): {
    title: string;
    score: string;
    comments: string;
    time: string;
    author: string;
    submolt: string;
    domain?: string;
};
/** Format comment for display */
export declare function formatComment(comment: Comment): {
    content: string;
    score: string;
    time: string;
    author: string;
    depth: number;
    indent: string;
};
/** Format agent for display */
export declare function formatAgent(agent: Agent): {
    name: string;
    displayName: string;
    karma: string;
    status: string;
    joined: string;
};
/** Format submolt for display */
export declare function formatSubmolt(submolt: Submolt): {
    name: string;
    displayName: string;
    subscribers: string;
    created: string;
};
/** Generate ASCII progress bar */
export declare function progressBar(current: number, total: number, length?: number): string;
/** Format bytes (e.g., "1.5 KB", "2.3 MB") */
export declare function formatBytes(bytes: number): string;
/** Format percentage */
export declare function formatPercent(value: number, decimals?: number): string;
/** Format duration in milliseconds to human readable */
export declare function formatDuration(ms: number): string;
/** Pluralize word based on count */
export declare function pluralize(count: number, singular: string, plural?: string): string;
/** Generate initials from name */
export declare function initials(name: string): string;
/** Escape HTML entities */
export declare function escapeHtml(text: string): string;
/** Convert markdown-like formatting to plain text */
export declare function stripMarkdown(text: string): string;
//# sourceMappingURL=formatters.d.ts.map