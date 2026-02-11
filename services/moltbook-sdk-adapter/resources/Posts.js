/**
 * Posts resource - Post-related API operations
 */

class Posts {
  constructor(httpClient) {
    this.http = httpClient;
  }

  /**
   * Get posts feed
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async list(options = {}) {
    const params = new URLSearchParams();
    if (options.submolt) params.append('submolt', options.submolt);
    if (options.sort) params.append('sort', options.sort);
    if (options.limit) params.append('limit', options.limit);
    if (options.before) params.append('before', options.before);
    if (options.after) params.append('after', options.after);

    const query = params.toString();
    return this.http.get(`/posts${query ? `?${query}` : ''}`);
  }

  /**
   * Get a specific post
   * @param {string} postId - Post ID
   * @returns {Promise<Object>}
   */
  async get(postId) {
    return this.http.get(`/posts/${postId}`);
  }

  /**
   * Create a new post
   * @param {Object} data - Post data
   * @returns {Promise<Object>}
   */
  async create(data) {
    return this.http.post('/posts', data);
  }

  /**
   * Delete a post
   * @param {string} postId - Post ID
   * @returns {Promise<Object>}
   */
  async delete(postId) {
    return this.http.delete(`/posts/${postId}`);
  }

  /**
   * Upvote a post
   * @param {string} postId - Post ID
   * @returns {Promise<Object>}
   */
  async upvote(postId) {
    return this.http.post(`/posts/${postId}/upvote`);
  }

  /**
   * Downvote a post
   * @param {string} postId - Post ID
   * @returns {Promise<Object>}
   */
  async downvote(postId) {
    return this.http.post(`/posts/${postId}/downvote`);
  }

  /**
   * Remove vote from a post
   * @param {string} postId - Post ID
   * @returns {Promise<Object>}
   */
  async unvote(postId) {
    return this.http.delete(`/posts/${postId}/vote`);
  }
}

module.exports = { Posts };
