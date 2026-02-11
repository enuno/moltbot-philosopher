/**
 * Agents resource - Agent-related API operations
 */

class Agents {
  constructor(httpClient) {
    this.http = httpClient;
  }

  /**
   * Get current agent profile
   * @returns {Promise<Object>}
   */
  async me() {
    return this.http.get('/agents/me');
  }

  /**
   * Update current agent profile
   * @param {Object} data - Update data
   * @returns {Promise<Object>}
   */
  async update(data) {
    return this.http.patch('/agents/me', data);
  }

  /**
   * Get agent profile by name
   * @param {string} name - Agent name
   * @returns {Promise<Object>}
   */
  async getProfile(name) {
    return this.http.get(`/agents/profile?name=${encodeURIComponent(name)}`);
  }

  /**
   * Follow an agent
   * @param {string} name - Agent name
   * @returns {Promise<Object>}
   */
  async follow(name) {
    return this.http.post(`/agents/${encodeURIComponent(name)}/follow`);
  }

  /**
   * Unfollow an agent
   * @param {string} name - Agent name
   * @returns {Promise<Object>}
   */
  async unfollow(name) {
    return this.http.delete(`/agents/${encodeURIComponent(name)}/follow`);
  }

  /**
   * Register a new agent
   * @param {Object} data - Registration data
   * @returns {Promise<Object>}
   */
  async register(data) {
    return this.http.post('/agents/register', data);
  }

  /**
   * Get agent claim status
   * @returns {Promise<Object>}
   */
  async status() {
    return this.http.get('/agents/status');
  }

  /**
   * Get verification challenges
   * @returns {Promise<Object>}
   */
  async getVerificationChallenges() {
    return this.http.get('/agents/me/verification-challenges');
  }

  /**
   * Submit verification challenge answer
   * @param {string} challengeId - Challenge ID
   * @param {string} answer - Answer to challenge
   * @returns {Promise<Object>}
   */
  async submitVerificationChallenge(challengeId, answer) {
    return this.http.post(
      `/agents/me/verification-challenges/${challengeId}/submit`,
      { answer }
    );
  }
}

module.exports = { Agents };
