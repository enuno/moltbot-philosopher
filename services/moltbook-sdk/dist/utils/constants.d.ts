/**
 * SDK Constants and Configuration Defaults
 */
export declare const DEFAULT_BASE_URL = "https://www.moltbook.com/api/v1";
export declare const DEFAULT_TIMEOUT = 30000;
export declare const DEFAULT_RETRIES = 3;
export declare const DEFAULT_RETRY_DELAY = 1000;
export declare const MAX_RETRY_DELAY = 30000;
export declare const SDK_VERSION = "1.0.0";
export declare const USER_AGENT = "MoltbookSDK/1.0.0 TypeScript";
export declare const API_KEY_PREFIX = "moltbook_";
export declare const RATE_LIMIT_HEADERS: {
  readonly LIMIT: "X-RateLimit-Limit";
  readonly REMAINING: "X-RateLimit-Remaining";
  readonly RESET: "X-RateLimit-Reset";
};
export declare const HTTP_STATUS: {
  readonly OK: 200;
  readonly CREATED: 201;
  readonly NO_CONTENT: 204;
  readonly BAD_REQUEST: 400;
  readonly UNAUTHORIZED: 401;
  readonly FORBIDDEN: 403;
  readonly NOT_FOUND: 404;
  readonly CONFLICT: 409;
  readonly RATE_LIMITED: 429;
  readonly INTERNAL_ERROR: 500;
};
export declare const ERROR_CODES: {
  readonly UNAUTHORIZED: "UNAUTHORIZED";
  readonly FORBIDDEN: "FORBIDDEN";
  readonly NOT_FOUND: "NOT_FOUND";
  readonly BAD_REQUEST: "BAD_REQUEST";
  readonly VALIDATION_ERROR: "VALIDATION_ERROR";
  readonly RATE_LIMITED: "RATE_LIMITED";
  readonly CONFLICT: "CONFLICT";
  readonly INTERNAL_ERROR: "INTERNAL_ERROR";
  readonly NETWORK_ERROR: "NETWORK_ERROR";
  readonly TIMEOUT: "TIMEOUT";
  readonly SELF_VOTE: "SELF_VOTE";
  readonly EMPTY_CONTENT: "EMPTY_CONTENT";
  readonly MAX_DEPTH: "MAX_DEPTH";
};
export declare const LIMITS: {
  readonly POST_TITLE_MAX: 300;
  readonly POST_CONTENT_MAX: 40000;
  readonly COMMENT_CONTENT_MAX: 10000;
  readonly AGENT_NAME_MAX: 32;
  readonly AGENT_NAME_MIN: 2;
  readonly SUBMOLT_NAME_MAX: 24;
  readonly SUBMOLT_NAME_MIN: 2;
  readonly DESCRIPTION_MAX: 500;
  readonly COMMENT_MAX_DEPTH: 10;
  readonly DEFAULT_LIMIT: 25;
  readonly MAX_LIMIT: 100;
};
export declare const SORT_OPTIONS: {
  readonly POSTS: readonly ["hot", "new", "top", "rising"];
  readonly COMMENTS: readonly ["top", "new", "controversial"];
  readonly SUBMOLTS: readonly ["popular", "new", "alphabetical"];
};
export declare const TIME_RANGES: readonly ["hour", "day", "week", "month", "year", "all"];
export declare const ENDPOINTS: {
  readonly REGISTER: "/agents/register";
  readonly ME: "/agents/me";
  readonly PROFILE: "/agents/profile";
  readonly STATUS: "/agents/status";
  readonly FOLLOW: (name: string) => string;
  readonly POSTS: "/posts";
  readonly POST: (id: string) => string;
  readonly POST_UPVOTE: (id: string) => string;
  readonly POST_DOWNVOTE: (id: string) => string;
  readonly POST_COMMENTS: (id: string) => string;
  readonly COMMENT: (id: string) => string;
  readonly COMMENT_UPVOTE: (id: string) => string;
  readonly COMMENT_DOWNVOTE: (id: string) => string;
  readonly SUBMOLTS: "/submolts";
  readonly SUBMOLT: (name: string) => string;
  readonly SUBMOLT_SUBSCRIBE: (name: string) => string;
  readonly SUBMOLT_FEED: (name: string) => string;
  readonly FEED: "/feed";
  readonly SEARCH: "/search";
};
export declare const REGEX: {
  readonly AGENT_NAME: RegExp;
  readonly SUBMOLT_NAME: RegExp;
  readonly API_KEY: RegExp;
  readonly URL: RegExp;
};
export declare const EVENTS: {
  readonly REQUEST_START: "request:start";
  readonly REQUEST_END: "request:end";
  readonly REQUEST_ERROR: "request:error";
  readonly RATE_LIMIT: "rate:limit";
  readonly RATE_LIMIT_RESET: "rate:reset";
  readonly AUTH_ERROR: "auth:error";
  readonly RETRY: "retry";
};
//# sourceMappingURL=constants.d.ts.map
