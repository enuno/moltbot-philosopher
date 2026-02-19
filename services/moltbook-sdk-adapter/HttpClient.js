/**
 * HTTP Client with retry logic and error handling
 * Based on Moltbook ADK HttpClient patterns
 */

const {
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  MoltbookError,
  NetworkError,
} = require('./utils/errors');
const { retry } = require('./utils/retry');

class HttpClient {
  constructor(options = {}) {
    // Check for API key first (allow explicit empty string check)
    const apiKey = options.apiKey !== undefined
      ? options.apiKey
      : process.env.MOLTBOOK_API_KEY;

    if (!apiKey) {
      throw new AuthenticationError('API key is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || 'https://www.moltbook.com/api/v1';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries !== undefined ? options.retries : 3;
    this.retryDelay = options.retryDelay || 1000;
    this.userAgent = options.userAgent || 'moltbot-sdk-adapter/1.0.0';

    // Rate limit tracking
    this.rateLimitInfo = {
      limit: null,
      remaining: null,
      reset: null,
    };
  }

  /**
   * Make an HTTP request with retry logic
   */
  async request(method, endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': this.userAgent,
      ...options.headers,
    };

    const fetchOptions = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    // Retry logic for transient failures
    return retry(
      async () => {
        let response;
        try {
          response = await fetch(url, fetchOptions);
        } catch (error) {
          // Network errors (DNS, connection refused, timeout, etc.)
          throw new NetworkError(
            `Network error: ${error.message}`,
            error
          );
        }

        // Update rate limit info from headers
        this.updateRateLimitInfo(response);

        // Handle HTTP errors
        if (!response.ok) {
          await this.handleError(response);
        }

        // Parse response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return response.json();
        }
        return response.text();
      },
      {
        retries: this.retries,
        delay: this.retryDelay,
        shouldRetry: (error) => {
          // Don't retry client errors (except rate limits)
          if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
            return error instanceof RateLimitError;
          }
          // Retry on network errors and 5xx
          return error instanceof NetworkError ||
                 (error.statusCode && error.statusCode >= 500);
        },
      }
    );
  }

  /**
   * Update rate limit tracking from response headers
   */
  updateRateLimitInfo(response) {
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (limit) this.rateLimitInfo.limit = parseInt(limit, 10);
    if (remaining) this.rateLimitInfo.remaining = parseInt(remaining, 10);
    if (reset) this.rateLimitInfo.reset = parseInt(reset, 10);
  }

  /**
   * Handle HTTP error responses
   */
  async handleError(response) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    let body;
    try {
      body = isJson ? await response.json() : await response.text();
    } catch (e) {
      body = { message: 'Unable to parse error response' };
    }

    const errorMessage = body.message || body.error || `HTTP ${response.status}`;

    switch (response.status) {
      case 401:
        throw new AuthenticationError(errorMessage, body);
      case 404:
        throw new NotFoundError(errorMessage, body);
      case 400:
        throw new ValidationError(errorMessage, body, body.errors);
      case 429: {
        // SKILL.md: API returns retry_after_minutes (posts) or retry_after_seconds
        // (comments) plus daily_remaining in the response body
        const retryAfterMinutes = body.retry_after_minutes;
        const retryAfterSeconds = body.retry_after_seconds;
        const dailyRemaining = body.daily_remaining;
        const retryAfterHeader = response.headers.get('Retry-After') ||
                                 response.headers.get('X-RateLimit-Reset');
        // Prefer body fields (more precise) over header
        let retryAfter = retryAfterHeader;
        if (retryAfterSeconds != null) retryAfter = String(retryAfterSeconds);
        else if (retryAfterMinutes != null) retryAfter = String(retryAfterMinutes * 60);
        const err = new RateLimitError(errorMessage, body, retryAfter);
        if (dailyRemaining != null) err.dailyRemaining = dailyRemaining;
        throw err;
      }
      default:
        throw new MoltbookError(errorMessage, response.status, body);
    }
  }

  /**
   * HTTP method helpers
   */
  async get(endpoint, options) {
    return this.request('GET', endpoint, options);
  }

  async post(endpoint, body, options) {
    return this.request('POST', endpoint, { ...options, body });
  }

  async patch(endpoint, body, options) {
    return this.request('PATCH', endpoint, { ...options, body });
  }

  async delete(endpoint, options) {
    return this.request('DELETE', endpoint, options);
  }

  /**
   * Rate limit helpers
   */
  getRateLimitInfo() {
    return { ...this.rateLimitInfo };
  }

  isRateLimited() {
    return this.rateLimitInfo.remaining === 0;
  }

  getTimeUntilReset() {
    if (!this.rateLimitInfo.reset) return null;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, this.rateLimitInfo.reset - now);
  }
}

module.exports = { HttpClient };
