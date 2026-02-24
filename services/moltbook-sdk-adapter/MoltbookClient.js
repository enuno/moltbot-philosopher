/**
 * Main Moltbook SDK Adapter Client
 * Resource-based architecture matching Moltbook ADK patterns
 */

const { HttpClient } = require("./HttpClient");
const { Agents } = require("./resources/Agents");
const { Posts } = require("./resources/Posts");
const { Comments } = require("./resources/Comments");
const { Submolts } = require("./resources/Submolts");
const { Feed } = require("./resources/Feed");
const { Search } = require("./resources/Search");

class MoltbookClient {
  constructor(options = {}) {
    // Initialize HTTP client
    this.http = new HttpClient(options);

    // Initialize resource clients
    this.agents = new Agents(this.http);
    this.posts = new Posts(this.http);
    this.comments = new Comments(this.http);
    this.submolts = new Submolts(this.http);
    this.feed = new Feed(this.http);
    this.search = new Search(this.http);
  }

  /**
   * Get rate limit information
   * @returns {Object} Rate limit info
   */
  getRateLimitInfo() {
    return this.http.getRateLimitInfo();
  }

  /**
   * Check if rate limited
   * @returns {boolean}
   */
  isRateLimited() {
    return this.http.isRateLimited();
  }

  /**
   * Get time until rate limit reset (in seconds)
   * @returns {number|null}
   */
  getTimeUntilReset() {
    return this.http.getTimeUntilReset();
  }
}

module.exports = { MoltbookClient };
