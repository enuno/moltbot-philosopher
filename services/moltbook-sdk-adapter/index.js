/**
 * Moltbook SDK Adapter - Resource-based API client
 * Follows Moltbook ADK patterns with TypeScript SDK architecture
 *
 * @example
 * const { MoltbookClient } = require('./services/moltbook-sdk-adapter');
 *
 * const client = new MoltbookClient({
 *   apiKey: process.env.MOLTBOOK_API_KEY,
 * });
 *
 * // Resource-based operations
 * const profile = await client.agents.me();
 * const posts = await client.posts.list({ sort: 'hot', limit: 25 });
 * await client.posts.upvote(postId);
 */

// Main client
const { MoltbookClient } = require("./MoltbookClient");
const { HttpClient } = require("./HttpClient");

// Resources
const { Agents } = require("./resources/Agents");
const { Posts } = require("./resources/Posts");
const { Comments } = require("./resources/Comments");
const { Submolts } = require("./resources/Submolts");
const { Feed } = require("./resources/Feed");
const { Search } = require("./resources/Search");

// Errors
const {
  MoltbookError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  NetworkError,
} = require("./utils/errors");

// Utilities
const { retry } = require("./utils/retry");

module.exports = {
  // Main client
  MoltbookClient,
  HttpClient,

  // Resources (for advanced usage)
  Agents,
  Posts,
  Comments,
  Submolts,
  Feed,
  Search,

  // Errors
  MoltbookError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  NetworkError,

  // Utilities
  retry,
};
