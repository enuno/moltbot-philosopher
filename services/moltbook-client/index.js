/**
 * Moltbook API Client with @moltbook/auth integration
 *
 * Provides a standardized interface for all Moltbook API calls
 * with proper authentication handling using the official @moltbook/auth package.
 */

const { MoltbookAuth } = require("@moltbook/auth");

class MoltbookClient {
  /**
   * @param {Object} options
   * @param {string} options.apiKey - Moltbook API key (moltbook_ prefixed)
   * @param {string} [options.baseUrl='https://www.moltbook.com/api/v1'] - API base URL
   * @param {number} [options.timeout=30000] - Request timeout in ms
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.MOLTBOOK_API_KEY;
    this.baseUrl = options.baseUrl || "https://www.moltbook.com/api/v1";
    this.timeout = options.timeout || 30000;

    // Initialize auth handler
    this.auth = new MoltbookAuth();

    // Validate API key format
    if (!this.apiKey) {
      throw new Error("MOLTBOOK_API_KEY is required");
    }

    if (!this.auth.validateToken(this.apiKey)) {
      throw new Error('Invalid API key format. Must start with "moltbook_"');
    }
  }

  /**
   * Make authenticated request to Moltbook API
   * @private
   */
  async _request(method, endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
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
        typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    // Capture rate limit headers
    const rateLimitInfo = {
      limit: response.headers.get("X-RateLimit-Limit"),
      remaining: response.headers.get("X-RateLimit-Remaining"),
      reset: response.headers.get("X-RateLimit-Reset"),
    };

    // Handle non-JSON responses
    const contentType = response.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");

    if (!response.ok) {
      const error = isJson ? await response.json() : await response.text();
      const errorObj = new Error(
        `Moltbook API error (${response.status}): ${
          typeof error === "object" ? JSON.stringify(error) : error
        }`,
      );
      errorObj.status = response.status;
      errorObj.rateLimit = rateLimitInfo;
      throw errorObj;
    }

    const data = isJson ? await response.json() : await response.text();

    // Attach rate limit info if data is an object
    if (typeof data === "object" && data !== null) {
      data._rateLimit = rateLimitInfo;
    }

    return data;
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this._request("GET", endpoint, options);
  }

  /**
   * POST request
   */
  async post(endpoint, body, options = {}) {
    return this._request("POST", endpoint, { ...options, body });
  }

  /**
   * PATCH request
   */
  async patch(endpoint, body, options = {}) {
    return this._request("PATCH", endpoint, { ...options, body });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this._request("DELETE", endpoint, options);
  }

  // ═══════════════════════════════════════════════════════════
  // Agent Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Register a new agent
   * @param {Object} data - { name, description }
   */
  async registerAgent(data) {
    return this.post("/agents/register", data);
  }

  /**
   * Get current agent's profile
   * GET /agents/me
   */
  async getMe() {
    return this.get("/agents/me");
  }

  /**
   * Update agent profile
   * PATCH /agents/me
   * @param {Object} data - { description }
   */
  async updateProfile(data) {
    return this.patch("/agents/me", data);
  }

  /**
   * Check agent claim status
   * GET /agents/status
   */
  async getStatus() {
    return this.get("/agents/status");
  }

  /**
   * View another agent's profile
   * GET /agents/profile?name=AGENT_NAME
   */
  async getAgentProfile(agentName) {
    return this.get(`/agents/profile?name=${agentName}`);
  }

  /**
   * Follow an agent
   * POST /agents/:name/follow
   */
  async followAgent(agentName) {
    return this.post(`/agents/${agentName}/follow`);
  }

  /**
   * Unfollow an agent
   * DELETE /agents/:name/follow
   */
  async unfollowAgent(agentName) {
    return this.delete(`/agents/${agentName}/follow`);
  }

  // ═══════════════════════════════════════════════════════════
  // Post Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a text post
   * POST /posts
   * @param {Object} data - { submolt, title, content }
   */
  async createPost(data) {
    return this.post("/posts", data);
  }

  /**
   * Create a link post
   * POST /posts
   * @param {Object} data - { submolt, title, url }
   */
  async createLinkPost(data) {
    return this.post("/posts", data);
  }

  /**
   * Get feed (all posts)
   * GET /posts?sort=hot&limit=25
   * @param {Object} params - { sort: 'hot'|'new'|'top'|'rising', limit: 25 }
   */
  async getPosts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/posts${query ? `?${query}` : ""}`);
  }

  /**
   * Get a specific post
   * GET /posts/:id
   */
  async getPost(postId) {
    return this.get(`/posts/${postId}`);
  }

  /**
   * Delete a post
   * DELETE /posts/:id
   */
  async deletePost(postId) {
    return this.delete(`/posts/${postId}`);
  }

  /**
   * Upvote a post
   * POST /posts/:id/upvote
   */
  async upvotePost(postId) {
    return this.post(`/posts/${postId}/upvote`);
  }

  /**
   * Downvote a post
   * POST /posts/:id/downvote
   */
  async downvotePost(postId) {
    return this.post(`/posts/${postId}/downvote`);
  }

  // ═══════════════════════════════════════════════════════════
  // Comment Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Add a comment to a post
   * POST /posts/:id/comments
   * @param {string} postId
   * @param {Object} data - { content, parent_id? }
   */
  async addComment(postId, data) {
    return this.post(`/posts/${postId}/comments`, data);
  }

  /**
   * Reply to a comment
   * POST /posts/:id/comments
   * @param {string} postId
   * @param {string} parentId
   * @param {string} content
   */
  async replyToComment(postId, parentId, content) {
    return this.post(`/posts/${postId}/comments`, {
      content,
      parent_id: parentId,
    });
  }

  /**
   * Get comments for a post
   * GET /posts/:id/comments?sort=best
   * @param {string} postId
   * @param {Object} params - { sort: 'best'|'new'|'old', limit: 35, cursor: string }
   * Response is tree-structured: top-level comments with nested replies array.
   */
  async getComments(postId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/posts/${postId}/comments${query ? `?${query}` : ""}`);
  }

  /**
   * Upvote a comment
   * POST /comments/:id/upvote
   */
  async upvoteComment(commentId) {
    return this.post(`/comments/${commentId}/upvote`);
  }

  /**
   * Downvote a comment
   * POST /comments/:id/downvote
   */
  async downvoteComment(commentId) {
    return this.post(`/comments/${commentId}/downvote`);
  }

  // ═══════════════════════════════════════════════════════════
  // Submolt (Community) Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a submolt
   * POST /submolts
   * @param {Object} data - { name, display_name, description }
   */
  async createSubmolt(data) {
    return this.post("/submolts", data);
  }

  /**
   * List submolts
   * GET /submolts
   */
  async listSubmolts() {
    return this.get("/submolts");
  }

  /**
   * Get submolt info
   * GET /submolts/:name
   */
  async getSubmolt(name) {
    return this.get(`/submolts/${name}`);
  }

  /**
   * Subscribe to a submolt
   * POST /submolts/:name/subscribe
   */
  async subscribeToSubmolt(name) {
    return this.post(`/submolts/${name}/subscribe`);
  }

  /**
   * Unsubscribe from a submolt
   * DELETE /submolts/:name/subscribe
   */
  async unsubscribeFromSubmolt(name) {
    return this.delete(`/submolts/${name}/subscribe`);
  }

  // ═══════════════════════════════════════════════════════════
  // Feed Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Get personalized feed
   * GET /feed?sort=hot&limit=25
   * Returns posts from subscribed submolts and followed agents
   * @param {Object} params - { sort: 'hot'|'new'|'top'|'rising', limit: 25 }
   */
  async getPersonalizedFeed(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/feed${query ? `?${query}` : ""}`);
  }

  // ═══════════════════════════════════════════════════════════
  // Search Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Search for posts, agents, and submolts
   * GET /search?q=machine+learning&limit=25
   * @param {Object} params - { q: 'query', limit: 25 }
   */
  async search(params) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/search?${query}`);
  }

  // ═══════════════════════════════════════════════════════════
  // Extended Operations (may not be in official API)
  // ═══════════════════════════════════════════════════════════

  /**
   * Get thread details (alias for getPost)
   * @deprecated Use getPost() instead
   */
  async getThread(postId) {
    return this.get(`/posts/${postId}`);
  }

  /**
   * Get stalled threads
   * Note: This endpoint may be custom/undocumented
   */
  async getStalledThreads(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/agents/me/stalled-threads${query ? `?${query}` : ""}`);
  }

  // ═══════════════════════════════════════════════════════════
  // Verification Challenge Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Submit verification challenge answer
   * Note: This endpoint may be custom/undocumented
   */
  async submitVerificationAnswer(challengeId, answer) {
    return this.post("/agents/me/verification-challenges", {
      challenge_id: challengeId,
      answer,
    });
  }

  /**
   * Get pending verification challenges
   * Note: This endpoint may be custom/undocumented
   */
  async getPendingChallenges() {
    return this.get("/agents/me/verification-challenges");
  }
}

module.exports = { MoltbookClient, MoltbookAuth };
