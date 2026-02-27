"use strict";
/**
 * HTTP Client for Moltbook API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
const errors_1 = require("../utils/errors");
const DEFAULT_BASE_URL = "https://www.moltbook.com/api/v1";
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
class HttpClient {
    apiKey;
    baseUrl;
    timeout;
    retries;
    retryDelay;
    customHeaders;
    rateLimitInfo = null;
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.MOLTBOOK_API_KEY;
        this.baseUrl = config.baseUrl || process.env.MOLTBOOK_BASE_URL || DEFAULT_BASE_URL;
        this.timeout = config.timeout || DEFAULT_TIMEOUT;
        this.retries = config.retries ?? DEFAULT_RETRIES;
        this.retryDelay = config.retryDelay || DEFAULT_RETRY_DELAY;
        this.customHeaders = config.headers || {};
    }
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }
    getRateLimitInfo() {
        return this.rateLimitInfo;
    }
    buildHeaders(additionalHeaders) {
        const headers = {
            "Content-Type": "application/json",
            "User-Agent": "MoltbookSDK/1.0.0 TypeScript",
            ...this.customHeaders,
            ...additionalHeaders,
        };
        if (this.apiKey)
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        return headers;
    }
    buildUrl(path, query) {
        const url = new URL(path, this.baseUrl);
        if (query)
            Object.entries(query).forEach(([key, value]) => {
                if (value !== undefined)
                    url.searchParams.append(key, String(value));
            });
        return url.toString();
    }
    parseRateLimitHeaders(headers) {
        const limit = headers.get("X-RateLimit-Limit");
        const remaining = headers.get("X-RateLimit-Remaining");
        const reset = headers.get("X-RateLimit-Reset");
        if (limit && remaining && reset) {
            this.rateLimitInfo = {
                limit: parseInt(limit, 10),
                remaining: parseInt(remaining, 10),
                resetAt: new Date(parseInt(reset, 10) * 1000),
            };
        }
    }
    async handleErrorResponse(response) {
        const errorData = {
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
        };
        try {
            const json = await response.json();
            Object.assign(errorData, json);
        }
        catch {
            /* Use default errorData */
        }
        const message = errorData.error || "Unknown error";
        const hint = errorData.hint;
        switch (response.status) {
            case 401:
                throw new errors_1.AuthenticationError(message, hint);
            case 403:
                throw new errors_1.ForbiddenError(message, hint);
            case 404:
                throw new errors_1.NotFoundError(message, hint);
            case 429:
                throw new errors_1.RateLimitError(message, errorData.retryAfter || 60, hint);
            case 400:
                throw new errors_1.ValidationError(message, errorData.code, hint);
            default:
                throw new errors_1.MoltbookError(message, response.status, errorData.code, hint);
        }
    }
    shouldRetry(error, attempt) {
        if (attempt >= this.retries)
            return false;
        if (error instanceof errors_1.MoltbookError && error.statusCode >= 400 && error.statusCode < 500)
            return error instanceof errors_1.RateLimitError;
        return (error instanceof errors_1.NetworkError || (error instanceof errors_1.MoltbookError && error.statusCode >= 500));
    }
    getRetryDelay(attempt, error) {
        if (error instanceof errors_1.RateLimitError)
            return error.retryAfter * 1000;
        return this.retryDelay * Math.pow(2, attempt);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async request(config) {
        const url = this.buildUrl(config.path, config.query);
        const headers = this.buildHeaders(config.headers);
        let lastError;
        for (let attempt = 0; attempt <= this.retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);
                const response = await fetch(url, {
                    method: config.method,
                    headers,
                    body: config.body ? JSON.stringify(config.body) : undefined,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                this.parseRateLimitHeaders(response.headers);
                if (!response.ok)
                    await this.handleErrorResponse(response);
                return (await response.json());
            }
            catch (error) {
                lastError = error;
                if (error instanceof TypeError && error.message.includes("fetch"))
                    lastError = new errors_1.NetworkError("Network request failed");
                if (!this.shouldRetry(lastError, attempt))
                    throw lastError;
                await this.sleep(this.getRetryDelay(attempt, lastError));
            }
        }
        throw lastError;
    }
    async get(path, query) {
        return this.request({ method: "GET", path, query });
    }
    async post(path, body) {
        return this.request({ method: "POST", path, body });
    }
    async patch(path, body) {
        return this.request({ method: "PATCH", path, body });
    }
    async delete(path) {
        return this.request({ method: "DELETE", path });
    }
}
exports.HttpClient = HttpClient;
//# sourceMappingURL=HttpClient.js.map