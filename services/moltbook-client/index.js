/**
 * Moltbook API Client with @moltbook/auth integration
 *
 * Provides a standardized interface for all Moltbook API calls
 * with proper authentication handling using the official @moltbook/auth package.
 */

const { MoltbookAuth } = require('@moltbook/auth');

class MoltbookClient {
  /**
   * @param {Object} options
   * @param {string} options.apiKey - Moltbook API key (moltbook_ prefixed)
   * @param {string} [options.baseUrl='https://www.moltbook.com/api/v1'] - API base URL
   * @param {number} [options.timeout=30000] - Request timeout in ms
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.MOLTBOOK_API_KEY;
    this.baseUrl = options.baseUrl || 'https://www.moltbook.com/api/v1';
    this.timeout = options.timeout || 30000;

    // Initialize auth handler
    this.auth = new MoltbookAuth();

    // Validate API key format
    if (!this.apiKey) {
      throw new Error('MOLTBOOK_API_KEY is required');
    }

    if (!this.auth.validateToken(this.apiKey)) {
      throw new Error(
        'Invalid API key format. Must start with "moltbook_"'
      );
    }
  }

  /**
   * Make authenticated request to Moltbook API
   * @private
   */
  async _request(method, endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    const fetchOptions = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    };

    if (options.body) {
      fetchOptions.body =
        typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!response.ok) {
      const error = isJson ? await response.json() : await response.text();
      throw new Error(
        `Moltbook API error (${response.status}): ${
          typeof error === 'object' ? JSON.stringify(error) : error
        }`
      );
    }

    return isJson ? await response.json() : await response.text();
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this._request('GET', endpoint, options);
  }

  /**
   * POST request
   */
  async post(endpoint, body, options = {}) {
    return this._request('POST', endpoint, { ...options, body });
  }

  /**
   * PUT request
   */
  async put(endpoint, body, options = {}) {
    return this._request('PUT', endpoint, { ...options, body });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this._request('DELETE', endpoint, options);
  }

  // ═══════════════════════════════════════════════════════════
  // Agent Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Get current agent's profile
   */
  async getMe() {
    return this.get('/agents/me');
  }

  /**
   * Setup owner email for agent
   */
  async setupOwnerEmail(email) {
    return this.post('/agents/me/setup-owner-email', { email });
  }

  /**
   * Get agent status
   */
  async getStatus() {
    return this.get('/agents/status');
  }

  // ═══════════════════════════════════════════════════════════
  // Post Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a new post
   */
  async createPost(data) {
    return this.post('/posts', data);
  }

  /**
   * Get a specific post
   */
  async getPost(postId) {
    return this.get(`/posts/${postId}`);
  }

  /**
   * Get posts (with filters)
   */
  async getPosts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/posts${query ? `?${query}` : ''}`);
  }

  // ═══════════════════════════════════════════════════════════
  // Comment Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Reply to a post or comment
   */
  async reply(parentId, content, options = {}) {
    return this.post(`/posts/${parentId}/replies`, {
      content,
      ...options,
    });
  }

  /**
   * Get comments for a post
   */
  async getComments(postId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/posts/${postId}/comments${query ? `?${query}` : ''}`);
  }

  // ═══════════════════════════════════════════════════════════
  // Mention Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Get mentions of current agent
   */
  async getMentions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/agents/me/mentions${query ? `?${query}` : ''}`);
  }

  // ═══════════════════════════════════════════════════════════
  // Thread Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Get thread details with all comments
   */
  async getThread(postId) {
    return this.get(`/posts/${postId}`);
  }

  /**
   * Get stalled threads
   */
  async getStalledThreads(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(
      `/agents/me/stalled-threads${query ? `?${query}` : ''}`
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Verification Challenge Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Submit verification challenge answer
   */
  async submitVerificationAnswer(challengeId, answer) {
    return this.post('/agents/me/verification-challenges', {
      challenge_id: challengeId,
      answer,
    });
  }

  /**
   * Get pending verification challenges
   */
  async getPendingChallenges() {
    return this.get('/agents/me/verification-challenges');
  }
}

module.exports = { MoltbookClient, MoltbookAuth };
