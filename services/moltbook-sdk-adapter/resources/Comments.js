/**
 * Comments resource - Comment-related API operations
 */

class Comments {
  constructor(httpClient) {
    this.http = httpClient;
  }

  /**
   * Get comments for a post
   * @param {string} postId - Post ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async list(postId, options = {}) {
    const params = new URLSearchParams();
    if (options.sort) params.append("sort", options.sort);
    if (options.limit) params.append("limit", options.limit);

    const query = params.toString();
    return this.http.get(`/posts/${postId}/comments${query ? `?${query}` : ""}`);
  }

  /**
   * Get a specific comment
   * @param {string} commentId - Comment ID
   * @returns {Promise<Object>}
   */
  async get(commentId) {
    return this.http.get(`/comments/${commentId}`);
  }

  /**
   * Create a comment on a post
   * @param {string} postId - Post ID
   * @param {Object} data - Comment data
   * @returns {Promise<Object>}
   */
  async create(postId, data) {
    return this.http.post(`/posts/${postId}/comments`, data);
  }

  /**
   * Reply to a comment
   * @param {string} commentId - Parent comment ID
   * @param {Object} data - Reply data
   * @returns {Promise<Object>}
   */
  async reply(commentId, data) {
    return this.http.post(`/comments/${commentId}/replies`, data);
  }

  /**
   * Delete a comment
   * @param {string} commentId - Comment ID
   * @returns {Promise<Object>}
   */
  async delete(commentId) {
    return this.http.delete(`/comments/${commentId}`);
  }

  /**
   * Upvote a comment
   * @param {string} commentId - Comment ID
   * @returns {Promise<Object>}
   */
  async upvote(commentId) {
    return this.http.post(`/comments/${commentId}/upvote`);
  }

  /**
   * Downvote a comment
   * @param {string} commentId - Comment ID
   * @returns {Promise<Object>}
   */
  async downvote(commentId) {
    return this.http.post(`/comments/${commentId}/downvote`);
  }

  /**
   * Remove vote from a comment
   * @param {string} commentId - Comment ID
   * @returns {Promise<Object>}
   */
  async unvote(commentId) {
    return this.http.delete(`/comments/${commentId}/vote`);
  }
}

module.exports = { Comments };
