/**
 * Unit tests for seen-posts-manager
 * TDD approach: tests written first, implementation follows
 */

const fs = require('fs');
const path = require('path');
const SeenPostsManager = require('../src/seen-posts-manager');

describe('SeenPostsManager', () => {
  let testStateFile;
  let manager;

  beforeEach(() => {
    // Use temp file for each test to avoid interference
    testStateFile = path.join(__dirname, `test-state-${Date.now()}.json`);
    // Clean up any existing test file
    if (fs.existsSync(testStateFile)) {
      fs.unlinkSync(testStateFile);
    }
    manager = new SeenPostsManager(testStateFile);
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testStateFile)) {
      fs.unlinkSync(testStateFile);
    }
  });

  describe('initializeSeenPosts', () => {
    it('should create state file if it does not exist', () => {
      expect(fs.existsSync(testStateFile)).toBe(false);

      manager.initializeSeenPosts();

      expect(fs.existsSync(testStateFile)).toBe(true);
      const content = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(content).toEqual({
        posts: {},
        lastPruned: expect.any(Number)
      });
    });

    it('should preserve existing state file if it already exists', () => {
      // Create initial state
      const initialState = {
        posts: { 'post-1': Date.now() },
        lastPruned: Date.now()
      };
      fs.writeFileSync(testStateFile, JSON.stringify(initialState));

      manager.initializeSeenPosts();

      const content = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(content.posts).toEqual(initialState.posts);
      expect(content.lastPruned).toBe(initialState.lastPruned);
    });
  });

  describe('addSeenPost', () => {
    it('should add a post and track its timestamp', () => {
      manager.initializeSeenPosts();
      const postId = 'post-123';
      const beforeTime = Date.now();

      manager.addSeenPost(postId);

      const afterTime = Date.now();
      const content = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(content.posts[postId]).toBeDefined();
      expect(content.posts[postId]).toBeGreaterThanOrEqual(beforeTime);
      expect(content.posts[postId]).toBeLessThanOrEqual(afterTime);
    });

    it('should add multiple posts independently', () => {
      manager.initializeSeenPosts();

      manager.addSeenPost('post-1');
      const time1 = Date.now();
      manager.addSeenPost('post-2');

      const content = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(Object.keys(content.posts)).toHaveLength(2);
      expect(content.posts['post-1']).toBeDefined();
      expect(content.posts['post-2']).toBeDefined();
    });

    it('should update timestamp when re-adding the same post', () => {
      manager.initializeSeenPosts();
      const postId = 'post-update';

      manager.addSeenPost(postId);
      const firstTimestamp = JSON.parse(fs.readFileSync(testStateFile, 'utf-8')).posts[postId];

      // Small delay to ensure different timestamp
      const delay = new Promise(resolve => setTimeout(resolve, 10));
      return delay.then(() => {
        manager.addSeenPost(postId);
        const secondTimestamp = JSON.parse(fs.readFileSync(testStateFile, 'utf-8')).posts[postId];
        expect(secondTimestamp).toBeGreaterThanOrEqual(firstTimestamp);
      });
    });
  });

  describe('hasSeenPost', () => {
    it('should return true for posts that have been added', () => {
      manager.initializeSeenPosts();
      const postId = 'post-seen';

      manager.addSeenPost(postId);

      expect(manager.hasSeenPost(postId)).toBe(true);
    });

    it('should return false for posts that have not been added', () => {
      manager.initializeSeenPosts();

      expect(manager.hasSeenPost('unknown-post')).toBe(false);
    });

    it('should handle multiple simultaneous checks correctly', () => {
      manager.initializeSeenPosts();
      const postId = 'post-concurrent';
      manager.addSeenPost(postId);

      // Simulate concurrent reads
      const results = [
        manager.hasSeenPost(postId),
        manager.hasSeenPost(postId),
        manager.hasSeenPost(postId)
      ];

      expect(results).toEqual([true, true, true]);
    });
  });

  describe('getSeenPostsCount', () => {
    it('should return 0 for empty state', () => {
      manager.initializeSeenPosts();

      expect(manager.getSeenPostsCount()).toBe(0);
    });

    it('should return correct count after adding posts', () => {
      manager.initializeSeenPosts();
      manager.addSeenPost('post-1');
      manager.addSeenPost('post-2');
      manager.addSeenPost('post-3');

      expect(manager.getSeenPostsCount()).toBe(3);
    });

    it('should return accurate count after re-adding same post', () => {
      manager.initializeSeenPosts();
      manager.addSeenPost('post-1');
      manager.addSeenPost('post-1'); // re-add same post

      // Count should still be 1 (same post updated, not duplicated)
      expect(manager.getSeenPostsCount()).toBe(1);
    });
  });

  describe('pruneOldEntries', () => {
    it('should remove entries older than specified days', () => {
      manager.initializeSeenPosts();
      const thirtyDaysAgoMs = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      // Manually create state with old and new entries
      const state = {
        posts: {
          'old-post': now - thirtyDaysAgoMs - 1000, // older than 30 days
          'recent-post': now - (2 * 24 * 60 * 60 * 1000) // 2 days old
        },
        lastPruned: now
      };
      fs.writeFileSync(testStateFile, JSON.stringify(state));

      manager.pruneOldEntries(30);

      const content = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(content.posts['old-post']).toBeUndefined();
      expect(content.posts['recent-post']).toBeDefined();
    });

    it('should preserve entries within the window', () => {
      manager.initializeSeenPosts();
      const now = Date.now();
      const oneDayAgoMs = 1 * 24 * 60 * 60 * 1000;

      const state = {
        posts: {
          'recent-1': now - oneDayAgoMs,
          'recent-2': now - (10 * 60 * 1000) // 10 minutes ago
        },
        lastPruned: now
      };
      fs.writeFileSync(testStateFile, JSON.stringify(state));

      manager.pruneOldEntries(30);

      const content = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(content.posts['recent-1']).toBeDefined();
      expect(content.posts['recent-2']).toBeDefined();
    });

    it('should handle empty state without errors', () => {
      manager.initializeSeenPosts();

      expect(() => {
        manager.pruneOldEntries(30);
      }).not.toThrow();

      const content = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(content.posts).toEqual({});
    });

    it('should update lastPruned timestamp', () => {
      manager.initializeSeenPosts();
      const beforeTime = Date.now();

      manager.pruneOldEntries(30);

      const afterTime = Date.now();
      const content = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(content.lastPruned).toBeGreaterThanOrEqual(beforeTime);
      expect(content.lastPruned).toBeLessThanOrEqual(afterTime);
    });

    it('should handle custom window sizes', () => {
      manager.initializeSeenPosts();
      const now = Date.now();
      const fourtyFiveDaysMs = 45 * 24 * 60 * 60 * 1000;

      const state = {
        posts: {
          'forty-days-old': now - (40 * 24 * 60 * 60 * 1000),
          'fifty-days-old': now - (50 * 24 * 60 * 60 * 1000)
        },
        lastPruned: now
      };
      fs.writeFileSync(testStateFile, JSON.stringify(state));

      // Prune entries older than 45 days
      manager.pruneOldEntries(45);

      const content = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(content.posts['forty-days-old']).toBeDefined(); // within 45-day window
      expect(content.posts['fifty-days-old']).toBeUndefined(); // older than 45 days
    });
  });

  describe('edge cases and concurrency', () => {
    it('should handle rapid sequential writes', () => {
      manager.initializeSeenPosts();

      for (let i = 0; i < 50; i++) {
        manager.addSeenPost(`post-${i}`);
      }

      expect(manager.getSeenPostsCount()).toBe(50);
    });

    it('should not corrupt state with special characters in postId', () => {
      manager.initializeSeenPosts();
      const postId = 'post-with-special-chars-!@#$%^&*()';

      manager.addSeenPost(postId);

      expect(manager.hasSeenPost(postId)).toBe(true);
    });

    it('should handle state file as string representation correctly', () => {
      manager.initializeSeenPosts();
      manager.addSeenPost('numeric-looking-id-123');

      const content = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      // Verify it's stored as string key
      expect(typeof Object.keys(content.posts)[0]).toBe('string');
      expect(manager.hasSeenPost('numeric-looking-id-123')).toBe(true);
    });
  });
});
