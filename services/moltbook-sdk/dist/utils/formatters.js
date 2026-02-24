"use strict";
/**
 * Formatting utilities for Moltbook SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatScore = formatScore;
exports.formatRelativeTime = formatRelativeTime;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.formatKarma = formatKarma;
exports.formatSubscribers = formatSubscribers;
exports.formatCommentCount = formatCommentCount;
exports.truncate = truncate;
exports.extractDomain = extractDomain;
exports.formatPost = formatPost;
exports.formatComment = formatComment;
exports.formatAgent = formatAgent;
exports.formatSubmolt = formatSubmolt;
exports.progressBar = progressBar;
exports.formatBytes = formatBytes;
exports.formatPercent = formatPercent;
exports.formatDuration = formatDuration;
exports.pluralize = pluralize;
exports.initials = initials;
exports.escapeHtml = escapeHtml;
exports.stripMarkdown = stripMarkdown;
/** Format score for display (e.g., 1.2K, 3.5M) */
function formatScore(score) {
  const abs = Math.abs(score);
  const sign = score < 0 ? "-" : "";
  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1000) return sign + (abs / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return score.toString();
}
/** Format relative time (e.g., "2h ago", "3d ago") */
function formatRelativeTime(date) {
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
/** Format absolute date (e.g., "Jan 15, 2025") */
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
/** Format date and time (e.g., "Jan 15, 2025, 3:45 PM") */
function formatDateTime(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
/** Format karma (e.g., "1,234 karma") */
function formatKarma(karma) {
  return karma.toLocaleString() + " karma";
}
/** Format subscriber count (e.g., "1.2K subscribers") */
function formatSubscribers(count) {
  return formatScore(count) + " subscriber" + (count !== 1 ? "s" : "");
}
/** Format comment count (e.g., "42 comments") */
function formatCommentCount(count) {
  return count.toLocaleString() + " comment" + (count !== 1 ? "s" : "");
}
/** Truncate text with ellipsis */
function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + "...";
}
/** Extract domain from URL */
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
/** Format post for display */
function formatPost(post) {
  return {
    title: post.title,
    score: formatScore(post.score),
    comments: formatCommentCount(post.commentCount),
    time: formatRelativeTime(post.createdAt),
    author: post.authorDisplayName || post.authorName,
    submolt: "m/" + post.submolt,
    domain: post.url ? (extractDomain(post.url) ?? undefined) : undefined,
  };
}
/** Format comment for display */
function formatComment(comment) {
  return {
    content: comment.content,
    score: formatScore(comment.score),
    time: formatRelativeTime(comment.createdAt),
    author: comment.authorDisplayName || comment.authorName,
    depth: comment.depth,
    indent: "  ".repeat(comment.depth),
  };
}
/** Format agent for display */
function formatAgent(agent) {
  return {
    name: "u/" + agent.name,
    displayName: agent.displayName || agent.name,
    karma: formatKarma(agent.karma),
    status: agent.status,
    joined: formatDate(agent.createdAt),
  };
}
/** Format submolt for display */
function formatSubmolt(submolt) {
  return {
    name: "m/" + submolt.name,
    displayName: submolt.displayName || submolt.name,
    subscribers: formatSubscribers(submolt.subscriberCount),
    created: formatDate(submolt.createdAt),
  };
}
/** Generate ASCII progress bar */
function progressBar(current, total, length = 20) {
  const percent = Math.min(current / total, 1);
  const filled = Math.round(percent * length);
  const empty = length - filled;
  return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}
/** Format bytes (e.g., "1.5 KB", "2.3 MB") */
function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return size.toFixed(unitIndex > 0 ? 1 : 0) + " " + units[unitIndex];
}
/** Format percentage */
function formatPercent(value, decimals = 1) {
  return (value * 100).toFixed(decimals) + "%";
}
/** Format duration in milliseconds to human readable */
function formatDuration(ms) {
  if (ms < 1000) return ms + "ms";
  if (ms < 60000) return (ms / 1000).toFixed(1) + "s";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m " + Math.floor((ms % 60000) / 1000) + "s";
  return Math.floor(ms / 3600000) + "h " + Math.floor((ms % 3600000) / 60000) + "m";
}
/** Pluralize word based on count */
function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural || singular + "s";
}
/** Generate initials from name */
function initials(name) {
  return name
    .split(/[\s_]+/)
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}
/** Escape HTML entities */
function escapeHtml(text) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return text.replace(/[&<>"']/g, (char) => entities[char] || char);
}
/** Convert markdown-like formatting to plain text */
function stripMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
    .replace(/\*([^*]+)\*/g, "$1") // Italic
    .replace(/~~([^~]+)~~/g, "$1") // Strikethrough
    .replace(/`([^`]+)`/g, "$1") // Inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/^#+\s*/gm, "") // Headers
    .replace(/^[-*]\s+/gm, "• ") // Lists
    .replace(/^>\s*/gm, "") // Blockquotes
    .trim();
}
//# sourceMappingURL=formatters.js.map
