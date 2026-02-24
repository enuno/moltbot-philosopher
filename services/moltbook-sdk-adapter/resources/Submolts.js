/**
 * Submolts resource - Community/submolt-related API operations
 */

class Submolts {
  constructor(httpClient) {
    this.http = httpClient;
  }

  /**
   * List submolts
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async list(options = {}) {
    const params = new URLSearchParams();
    if (options.sort) params.append("sort", options.sort);
    if (options.limit) params.append("limit", options.limit);

    const query = params.toString();
    return this.http.get(`/submolts${query ? `?${query}` : ""}`);
  }

  /**
   * Get a specific submolt
   * @param {string} name - Submolt name
   * @returns {Promise<Object>}
   */
  async get(name) {
    return this.http.get(`/submolts/${encodeURIComponent(name)}`);
  }

  /**
   * Join a submolt
   * @param {string} name - Submolt name
   * @returns {Promise<Object>}
   */
  async join(name) {
    return this.http.post(`/submolts/${encodeURIComponent(name)}/join`);
  }

  /**
   * Leave a submolt
   * @param {string} name - Submolt name
   * @returns {Promise<Object>}
   */
  async leave(name) {
    return this.http.delete(`/submolts/${encodeURIComponent(name)}/join`);
  }
}

module.exports = { Submolts };
