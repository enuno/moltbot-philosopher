/**
 * Shared test utilities for engagement service tests
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Create temporary directory for test state files
 */
function tmpStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "engagement-test-"));
}

/**
 * Clean up temporary directory
 */
function cleanupTmpDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

/**
 * Agent roster for testing (all 9 agents)
 */
const MOCK_AGENTS = [
  {
    id: "classical",
    name: "Classical Philosopher",
    tradition: "Stoicism",
    statePath: "state.json",
  },
  {
    id: "existentialist",
    name: "Existentialist",
    tradition: "Existentialism",
    statePath: "state.json",
  },
  {
    id: "transcendentalist",
    name: "Transcendentalist",
    tradition: "Transcendentalism",
    statePath: "state.json",
  },
  { id: "joyce", name: "Joyce Stream", tradition: "Phenomenology", statePath: "state.json" },
  {
    id: "enlightenment",
    name: "Enlightenment",
    tradition: "Rationalism",
    statePath: "state.json",
  },
  { id: "beat", name: "Beat Generation", tradition: "Avant-garde", statePath: "state.json" },
  {
    id: "cyberpunk-posthumanist",
    name: "Cyberpunk Posthumanist",
    tradition: "Transhumanism",
    statePath: "state.json",
  },
  {
    id: "satirist-absurdist",
    name: "Satirist Absurdist",
    tradition: "Absurdism",
    statePath: "state.json",
  },
  {
    id: "scientist-empiricist",
    name: "Scientist Empiricist",
    tradition: "Empiricism",
    statePath: "state.json",
  },
];

/**
 * Create default empty engagement state
 */
function createDefaultState() {
  const today = new Date().toISOString().split("T")[0];
  return {
    dailyStats: {
      date: today,
      postsCreated: 0,
      commentsMade: 0,
      accountsFollowed: 0,
      dmRequestsSent: 0,
      threadsParticipated: 0,
    },
    dailyReset: today,
    followedAccounts: [],
    subscribedSubmolts: ["ethics-convergence", "general", "aithoughts"],
    pendingDmRequests: [],
    engagementQueue: [],
    rateLimits: {
      lastPostTimestamp: 0,
      lastCommentTimestamp: 0,
      lastFollowTimestamp: 0,
      lastDmTimestamp: 0,
    },
    lastEngagementCheck: Date.now(),
    lastPostTime: 0,
    relevanceCache: {},
  };
}

/**
 * Create mock post for testing
 */
function createMockPost(overrides) {
  return {
    id: "post_" + Date.now(),
    author: { name: "TestAuthor", id: "user_123", followerCount: 100 },
    content: "This is a test post about virtue ethics",
    submoltId: "ethics-convergence",
    submoltName: "Ethics Convergence",
    createdAt: Date.now(),
    upvotes: 5,
    commentCount: 3,
    ...overrides,
  };
}

/**
 * Create multiple mock posts
 */
function createMockPosts(count) {
  return Array.from({ length: count }, (_, i) =>
    createMockPost({
      id: `post_${i}`,
      content: `Test post ${i} about philosophical topic`,
      upvotes: Math.floor(Math.random() * 20),
    }),
  );
}

module.exports = {
  tmpStateDir,
  cleanupTmpDir,
  MOCK_AGENTS,
  createDefaultState,
  createMockPost,
  createMockPosts,
};
