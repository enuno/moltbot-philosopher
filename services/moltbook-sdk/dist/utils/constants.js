"use strict";
/**
 * SDK Constants and Configuration Defaults
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENTS = exports.REGEX = exports.ENDPOINTS = exports.TIME_RANGES = exports.SORT_OPTIONS = exports.LIMITS = exports.ERROR_CODES = exports.HTTP_STATUS = exports.RATE_LIMIT_HEADERS = exports.API_KEY_PREFIX = exports.USER_AGENT = exports.SDK_VERSION = exports.MAX_RETRY_DELAY = exports.DEFAULT_RETRY_DELAY = exports.DEFAULT_RETRIES = exports.DEFAULT_TIMEOUT = exports.DEFAULT_BASE_URL = void 0;
exports.DEFAULT_BASE_URL = 'https://www.moltbook.com/api/v1';
exports.DEFAULT_TIMEOUT = 30000;
exports.DEFAULT_RETRIES = 3;
exports.DEFAULT_RETRY_DELAY = 1000;
exports.MAX_RETRY_DELAY = 30000;
exports.SDK_VERSION = '1.0.0';
exports.USER_AGENT = `MoltbookSDK/${exports.SDK_VERSION} TypeScript`;
exports.API_KEY_PREFIX = 'moltbook_';
exports.RATE_LIMIT_HEADERS = {
    LIMIT: 'X-RateLimit-Limit',
    REMAINING: 'X-RateLimit-Remaining',
    RESET: 'X-RateLimit-Reset'
};
exports.HTTP_STATUS = {
    OK: 200, CREATED: 201, NO_CONTENT: 204,
    BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
    CONFLICT: 409, RATE_LIMITED: 429, INTERNAL_ERROR: 500
};
exports.ERROR_CODES = {
    UNAUTHORIZED: 'UNAUTHORIZED', FORBIDDEN: 'FORBIDDEN', NOT_FOUND: 'NOT_FOUND',
    BAD_REQUEST: 'BAD_REQUEST', VALIDATION_ERROR: 'VALIDATION_ERROR',
    RATE_LIMITED: 'RATE_LIMITED', CONFLICT: 'CONFLICT', INTERNAL_ERROR: 'INTERNAL_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR', TIMEOUT: 'TIMEOUT', SELF_VOTE: 'SELF_VOTE',
    EMPTY_CONTENT: 'EMPTY_CONTENT', MAX_DEPTH: 'MAX_DEPTH'
};
exports.LIMITS = {
    POST_TITLE_MAX: 300, POST_CONTENT_MAX: 40000, COMMENT_CONTENT_MAX: 10000,
    AGENT_NAME_MAX: 32, AGENT_NAME_MIN: 2, SUBMOLT_NAME_MAX: 24, SUBMOLT_NAME_MIN: 2,
    DESCRIPTION_MAX: 500, COMMENT_MAX_DEPTH: 10, DEFAULT_LIMIT: 25, MAX_LIMIT: 100
};
exports.SORT_OPTIONS = {
    POSTS: ['hot', 'new', 'top', 'rising'],
    COMMENTS: ['top', 'new', 'controversial'],
    SUBMOLTS: ['popular', 'new', 'alphabetical']
};
exports.TIME_RANGES = ['hour', 'day', 'week', 'month', 'year', 'all'];
exports.ENDPOINTS = {
    REGISTER: '/agents/register', ME: '/agents/me', PROFILE: '/agents/profile', STATUS: '/agents/status',
    FOLLOW: (name) => `/agents/${name}/follow`,
    POSTS: '/posts', POST: (id) => `/posts/${id}`,
    POST_UPVOTE: (id) => `/posts/${id}/upvote`,
    POST_DOWNVOTE: (id) => `/posts/${id}/downvote`,
    POST_COMMENTS: (id) => `/posts/${id}/comments`,
    COMMENT: (id) => `/comments/${id}`,
    COMMENT_UPVOTE: (id) => `/comments/${id}/upvote`,
    COMMENT_DOWNVOTE: (id) => `/comments/${id}/downvote`,
    SUBMOLTS: '/submolts', SUBMOLT: (name) => `/submolts/${name}`,
    SUBMOLT_SUBSCRIBE: (name) => `/submolts/${name}/subscribe`,
    SUBMOLT_FEED: (name) => `/submolts/${name}/feed`,
    FEED: '/feed', SEARCH: '/search'
};
exports.REGEX = {
    AGENT_NAME: /^[a-z0-9_]{2,32}$/i,
    SUBMOLT_NAME: /^[a-z0-9_]{2,24}$/i,
    API_KEY: /^moltbook_[a-zA-Z0-9]{20,}$/,
    URL: /^https?:\/\/.+/i
};
exports.EVENTS = {
    REQUEST_START: 'request:start', REQUEST_END: 'request:end', REQUEST_ERROR: 'request:error',
    RATE_LIMIT: 'rate:limit', RATE_LIMIT_RESET: 'rate:reset', AUTH_ERROR: 'auth:error', RETRY: 'retry'
};
//# sourceMappingURL=constants.js.map
