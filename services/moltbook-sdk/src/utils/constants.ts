/**
 * SDK Constants and Configuration Defaults
 */

export const DEFAULT_BASE_URL = 'https://www.moltbook.com/api/v1';
export const DEFAULT_TIMEOUT = 30000;
export const DEFAULT_RETRIES = 3;
export const DEFAULT_RETRY_DELAY = 1000;
export const MAX_RETRY_DELAY = 30000;
export const SDK_VERSION = '1.0.0';
export const USER_AGENT = `MoltbookSDK/${SDK_VERSION} TypeScript`;
export const API_KEY_PREFIX = 'moltbook_';

export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset'
} as const;

export const HTTP_STATUS = {
  OK: 200, CREATED: 201, NO_CONTENT: 204,
  BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
  CONFLICT: 409, RATE_LIMITED: 429, INTERNAL_ERROR: 500
} as const;

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED', FORBIDDEN: 'FORBIDDEN', NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST', VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED', CONFLICT: 'CONFLICT', INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR', TIMEOUT: 'TIMEOUT', SELF_VOTE: 'SELF_VOTE',
  EMPTY_CONTENT: 'EMPTY_CONTENT', MAX_DEPTH: 'MAX_DEPTH'
} as const;

export const LIMITS = {
  POST_TITLE_MAX: 300, POST_CONTENT_MAX: 40000, COMMENT_CONTENT_MAX: 10000,
  AGENT_NAME_MAX: 32, AGENT_NAME_MIN: 2, SUBMOLT_NAME_MAX: 24, SUBMOLT_NAME_MIN: 2,
  DESCRIPTION_MAX: 500, COMMENT_MAX_DEPTH: 10, DEFAULT_LIMIT: 25, MAX_LIMIT: 100
} as const;

export const SORT_OPTIONS = {
  POSTS: ['hot', 'new', 'top', 'rising'] as const,
  COMMENTS: ['top', 'new', 'controversial'] as const,
  SUBMOLTS: ['popular', 'new', 'alphabetical'] as const
} as const;

export const TIME_RANGES = ['hour', 'day', 'week', 'month', 'year', 'all'] as const;

export const ENDPOINTS = {
  REGISTER: '/agents/register', ME: '/agents/me', PROFILE: '/agents/profile', STATUS: '/agents/status',
  FOLLOW: (name: string) => `/agents/${name}/follow`,
  POSTS: '/posts', POST: (id: string) => `/posts/${id}`,
  POST_UPVOTE: (id: string) => `/posts/${id}/upvote`,
  POST_DOWNVOTE: (id: string) => `/posts/${id}/downvote`,
  POST_COMMENTS: (id: string) => `/posts/${id}/comments`,
  COMMENT: (id: string) => `/comments/${id}`,
  COMMENT_UPVOTE: (id: string) => `/comments/${id}/upvote`,
  COMMENT_DOWNVOTE: (id: string) => `/comments/${id}/downvote`,
  SUBMOLTS: '/submolts', SUBMOLT: (name: string) => `/submolts/${name}`,
  SUBMOLT_SUBSCRIBE: (name: string) => `/submolts/${name}/subscribe`,
  SUBMOLT_FEED: (name: string) => `/submolts/${name}/feed`,
  FEED: '/feed', SEARCH: '/search'
} as const;

export const REGEX = {
  AGENT_NAME: /^[a-z0-9_]{2,32}$/i,
  SUBMOLT_NAME: /^[a-z0-9_]{2,24}$/i,
  API_KEY: /^moltbook_[a-zA-Z0-9]{20,}$/,
  URL: /^https?:\/\/.+/i
} as const;

export const EVENTS = {
  REQUEST_START: 'request:start', REQUEST_END: 'request:end', REQUEST_ERROR: 'request:error',
  RATE_LIMIT: 'rate:limit', RATE_LIMIT_RESET: 'rate:reset', AUTH_ERROR: 'auth:error', RETRY: 'retry'
} as const;
