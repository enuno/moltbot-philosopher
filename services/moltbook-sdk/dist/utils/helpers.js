"use strict";
/**
 * Utility functions and helpers for Moltbook SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = sleep;
exports.retry = retry;
exports.paginate = paginate;
exports.flattenComments = flattenComments;
exports.countComments = countComments;
exports.getMaxDepth = getMaxDepth;
exports.formatScore = formatScore;
exports.formatRelativeTime = formatRelativeTime;
exports.isValidApiKey = isValidApiKey;
exports.isValidAgentName = isValidAgentName;
exports.isValidSubmoltName = isValidSubmoltName;
exports.truncate = truncate;
exports.extractDomain = extractDomain;
exports.isLinkPost = isLinkPost;
exports.isTextPost = isTextPost;
exports.debounce = debounce;
exports.throttle = throttle;
exports.createEventEmitter = createEventEmitter;
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Retry a function with exponential backoff
 */
async function retry(fn, options = {}) {
  const { retries = 3, delay = 1000, maxDelay = 30000, onRetry } = options;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
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
  throw lastError;
}
/**
 * Paginate through results
 */
async function* paginate(fetchFn, options = {}) {
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
function flattenComments(comments) {
  const result = [];
  function traverse(items) {
    for (const item of items) {
      const { replies, ...comment } = item;
      result.push(comment);
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
function countComments(comments) {
  let total = 0;
  function traverse(items) {
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
function getMaxDepth(comments) {
  let maxDepth = 0;
  function traverse(items, currentDepth) {
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
function formatScore(score) {
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
/**
 * Validate API key format
 */
function isValidApiKey(apiKey) {
  return typeof apiKey === "string" && apiKey.startsWith("moltbook_") && apiKey.length > 20;
}
/**
 * Validate agent name format
 */
function isValidAgentName(name) {
  return /^[a-z0-9_]{2,32}$/i.test(name);
}
/**
 * Validate submolt name format
 */
function isValidSubmoltName(name) {
  return /^[a-z0-9_]{2,24}$/i.test(name);
}
/**
 * Truncate text with ellipsis
 */
function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
/**
 * Extract domain from URL
 */
function extractDomain(url) {
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
function isLinkPost(post) {
  return post.postType === "link" && !!post.url;
}
/**
 * Check if post is a text post
 */
function isTextPost(post) {
  return post.postType === "text" && !!post.content;
}
/**
 * Debounce function
 */
function debounce(fn, wait) {
  let timeout = null;
  return (...args) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => fn(...args), wait);
  };
}
/**
 * Throttle function
 */
function throttle(fn, limit) {
  let inThrottle = false;
  return (...args) => {
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
function createEventEmitter() {
  const listeners = new Map();
  return {
    on(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(callback);
      return () => {
        listeners.get(event)?.delete(callback);
      };
    },
    emit(event, ...args) {
      listeners.get(event)?.forEach((cb) => cb(...args));
    },
    off(event, callback) {
      if (callback) {
        listeners.get(event)?.delete(callback);
      } else {
        listeners.delete(event);
      }
    },
  };
}
//# sourceMappingURL=helpers.js.map
