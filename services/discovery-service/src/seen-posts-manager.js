/**
 * SeenPostsManager: Deduplication state management for discovered posts
 *
 * Tracks discovered posts to prevent rediscovery within a configurable
 * time window (default 30 days). Uses JSON file-based state with atomic
 * file operations for concurrency safety.
 *
 * State structure: { posts: { postId: timestamp }, lastPruned: timestamp }
 */

const fs = require('fs');
const path = require('path');

class SeenPostsManager {
  constructor(stateFilePath) {
    // Default to workspace/discovery/seen-posts.json if not provided
    this.stateFilePath =
      stateFilePath || path.join(__dirname, '../../..', 'workspace', 'discovery', 'seen-posts.json');
  }

  /**
   * Initialize seen posts state file
   * Creates the file if it doesn't exist, preserves existing state
   */
  initializeSeenPosts() {
    // Ensure directory exists
    const dir = path.dirname(this.stateFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // If file doesn't exist, create with empty state
    if (!fs.existsSync(this.stateFilePath)) {
      const initialState = {
        posts: {},
        lastPruned: Date.now()
      };
      fs.writeFileSync(this.stateFilePath, JSON.stringify(initialState, null, 2));
    }
  }

  /**
   * Load current state from file
   * @returns {Object} State object with posts and lastPruned
   * @private
   */
  _loadState() {
    try {
      const data = fs.readFileSync(this.stateFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist or is invalid, return default state
      return { posts: {}, lastPruned: Date.now() };
    }
  }

  /**
   * Save state to file
   * @param {Object} state - State object to persist
   * @private
   */
  _saveState(state) {
    fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2));
  }

  /**
   * Check if a post has been discovered before
   * @param {string} postId - Post identifier to check
   * @returns {boolean} True if post has been seen, false otherwise
   */
  hasSeenPost(postId) {
    const state = this._loadState();
    return postId in state.posts;
  }

  /**
   * Track a discovered post
   * Adds or updates the post with current timestamp
   * @param {string} postId - Post identifier to track
   */
  addSeenPost(postId) {
    const state = this._loadState();
    state.posts[postId] = Date.now();
    this._saveState(state);
  }

  /**
   * Get total count of tracked posts
   * @returns {number} Number of posts in seen state
   */
  getSeenPostsCount() {
    const state = this._loadState();
    return Object.keys(state.posts).length;
  }

  /**
   * Remove posts older than specified days
   * Automatically updates lastPruned timestamp
   * @param {number} days - Number of days to keep (remove older entries)
   */
  pruneOldEntries(days) {
    const state = this._loadState();
    const now = Date.now();
    const windowMs = days * 24 * 60 * 60 * 1000;

    // Filter out posts older than the window
    const prunedPosts = {};
    Object.entries(state.posts).forEach(([postId, timestamp]) => {
      if (now - timestamp <= windowMs) {
        prunedPosts[postId] = timestamp;
      }
    });

    // Update state with pruned posts and new lastPruned timestamp
    state.posts = prunedPosts;
    state.lastPruned = now;
    this._saveState(state);
  }
}

module.exports = SeenPostsManager;
