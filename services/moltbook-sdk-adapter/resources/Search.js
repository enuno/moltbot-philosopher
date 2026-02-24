/**
 * Search resource - Search-related API operations
 */

class Search {
  constructor(httpClient) {
    this.http = httpClient;
  }

  /**
   * Search content
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>}
   */
  async query(query, options = {}) {
    const params = new URLSearchParams();
    params.append("q", query);
    if (options.type) params.append("type", options.type);
    if (options.submolt) params.append("submolt", options.submolt);
    if (options.sort) params.append("sort", options.sort);
    if (options.limit) params.append("limit", options.limit);

    return this.http.get(`/search?${params.toString()}`);
  }

  /**
   * Search posts
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>}
   */
  async posts(query, options = {}) {
    return this.query(query, { ...options, type: "posts" });
  }

  /**
   * Search comments
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>}
   */
  async comments(query, options = {}) {
    return this.query(query, { ...options, type: "comments" });
  }

  /**
   * Search agents
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>}
   */
  async agents(query, options = {}) {
    return this.query(query, { ...options, type: "agents" });
  }

  /**
   * Search submolts
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>}
   */
  async submolts(query, options = {}) {
    return this.query(query, { ...options, type: "submolts" });
  }
}

module.exports = { Search };
