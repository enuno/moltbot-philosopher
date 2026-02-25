/**
 * Topic Extractor Test Suite
 * P2.3 Task 3: Tests topic detection from discussion threads
 */

const {
  extractTopicsFromThread,
  scoreTopic,
  getPrimaryTopics,
} = require("../src/topic-extractor");

describe("Topic Extractor", () => {
  // Sample post and comments for testing
  const samplePost = {
    id: "post-1",
    author: { name: "User A", id: "user-1", followerCount: 100 },
    content:
      "What is the relationship between virtue and happiness in stoic philosophy?",
    submoltId: "ethics",
    submoltName: "Ethics & Philosophy",
    createdAt: 1708900000,
    upvotes: 10,
    commentCount: 3,
  };

  const sampleComments = [
    {
      id: "comment-1",
      author: { name: "User B", id: "user-2", followerCount: 50 },
      content:
        "Aristotle believed virtue leads to eudaimonia, true flourishing",
      createdAt: 1708900100,
    },
    {
      id: "comment-2",
      author: { name: "User C", id: "user-3", followerCount: 75 },
      content:
        "But stoics took a different approach to virtue and moral excellence",
      createdAt: 1708900200,
    },
  ];

  describe("scoreTopic", () => {
    it("should calculate score for exact topic match", () => {
      const text = "virtue ethics and moral character";
      const score = scoreTopic(text, "virtue_ethics");
      expect(score).toBeGreaterThan(0.3);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should return low score for unrelated text", () => {
      const text = "The weather is nice today";
      const score = scoreTopic(text, "virtue_ethics");
      expect(score).toBeLessThan(0.2);
    });

    it("should return 0-1 score always", () => {
      const texts = [
        "virtue virtue virtue virtue virtue",
        "random unrelated text",
        "consciousness and experience",
      ];
      texts.forEach((text) => {
        const score = scoreTopic(text, "virtue_ethics");
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it("should boost score for multiple keyword matches", () => {
      const singleKeyword = "virtue is important";
      const multipleKeywords = "virtue, character, excellence, flourishing";
      const score1 = scoreTopic(singleKeyword, "virtue_ethics");
      const score2 = scoreTopic(multipleKeywords, "virtue_ethics");
      expect(score2).toBeGreaterThan(score1);
    });

    it("should be case-insensitive", () => {
      const lower = "virtue ethics is ancient wisdom";
      const upper = "VIRTUE ETHICS IS ANCIENT WISDOM";
      const score1 = scoreTopic(lower, "virtue_ethics");
      const score2 = scoreTopic(upper, "virtue_ethics");
      expect(score1).toBe(score2);
    });
  });

  describe("extractTopicsFromThread", () => {
    it("should extract topics from post and comments", () => {
      const topics = extractTopicsFromThread(samplePost, sampleComments);
      expect(Array.isArray(topics)).toBe(true);
      expect(topics.length).toBeGreaterThan(0);
    });

    it("should return TopicMatch objects with required fields", () => {
      const topics = extractTopicsFromThread(samplePost, sampleComments);
      topics.forEach((topic) => {
        expect(topic).toHaveProperty("topicId");
        expect(topic).toHaveProperty("score");
        expect(topic).toHaveProperty("confidence");
        expect(topic).toHaveProperty("keywordMatches");
        expect(typeof topic.score).toBe("number");
        expect(topic.score).toBeGreaterThanOrEqual(0);
        expect(topic.score).toBeLessThanOrEqual(1);
      });
    });

    it("should sort results by score descending", () => {
      const topics = extractTopicsFromThread(samplePost, sampleComments);
      for (let i = 0; i < topics.length - 1; i++) {
        expect(topics[i].score).toBeGreaterThanOrEqual(topics[i + 1].score);
      }
    });

    it("should detect virtue ethics topic in philosophy post", () => {
      const topics = extractTopicsFromThread(samplePost, sampleComments);
      const virtueMatch = topics.find((t) => t.topicId === "virtue_ethics");
      expect(virtueMatch).toBeDefined();
      expect(virtueMatch.score).toBeGreaterThan(0.3);
    });

    it("should handle single post without comments", () => {
      const topics = extractTopicsFromThread(samplePost, []);
      expect(Array.isArray(topics)).toBe(true);
      expect(topics.length).toBeGreaterThan(0);
    });

    it("should handle post with no relevant topics", () => {
      const irrelevantPost = {
        ...samplePost,
        content: "The sky is blue and the grass is green",
      };
      const topics = extractTopicsFromThread(irrelevantPost, []);
      expect(Array.isArray(topics)).toBe(true);
      // Should return empty array or very low scores
      const highScoreTopics = topics.filter((t) => t.score > 0.1);
      expect(highScoreTopics.length).toBeLessThanOrEqual(1);
    });

    it("should combine post and comment content for scoring", () => {
      // Create a post with topic only in comments
      const postOnlyComments = {
        ...samplePost,
        content: "What do people think about this?",
      };
      const comments = [
        {
          id: "c1",
          author: { name: "User", id: "u1", followerCount: 10 },
          content:
            "virtue and excellence are central to moral philosophy",
          createdAt: 1708900000,
        },
      ];
      const topics = extractTopicsFromThread(postOnlyComments, comments);
      const virtueMatch = topics.find((t) => t.topicId === "virtue_ethics");
      expect(virtueMatch).toBeDefined();
      expect(virtueMatch.score).toBeGreaterThan(0.2);
    });
  });

  describe("getPrimaryTopics", () => {
    it("should filter topics by threshold", () => {
      const topics = extractTopicsFromThread(samplePost, sampleComments);
      const primary = getPrimaryTopics(samplePost, sampleComments, 0.3);
      // All primary topics should exceed threshold
      primary.forEach((t) => {
        expect(t.score).toBeGreaterThanOrEqual(0.3);
      });
    });

    it("should return subset of all topics", () => {
      const all = extractTopicsFromThread(samplePost, sampleComments);
      const primary = getPrimaryTopics(samplePost, sampleComments, 0.3);
      expect(primary.length).toBeLessThanOrEqual(all.length);
    });

    it("should use default threshold of 0.3", () => {
      const primary1 = getPrimaryTopics(samplePost, sampleComments);
      const primary2 = getPrimaryTopics(samplePost, sampleComments, 0.3);
      expect(primary1.length).toBe(primary2.length);
      primary1.forEach((t, i) => {
        expect(t.topicId).toBe(primary2[i].topicId);
      });
    });

    it("should handle high threshold filtering out all topics", () => {
      const primary = getPrimaryTopics(samplePost, sampleComments, 0.95);
      expect(Array.isArray(primary)).toBe(true);
      // All should be below threshold
      primary.forEach((t) => {
        expect(t.score).toBeGreaterThanOrEqual(0.95);
      });
    });

    it("should maintain sorting by score", () => {
      const primary = getPrimaryTopics(samplePost, sampleComments, 0.1);
      for (let i = 0; i < primary.length - 1; i++) {
        expect(primary[i].score).toBeGreaterThanOrEqual(primary[i + 1].score);
      }
    });

    it("should return topics with score >= threshold", () => {
      const threshold = 0.25;
      const primary = getPrimaryTopics(samplePost, sampleComments, threshold);
      primary.forEach((t) => {
        expect(t.score).toBeGreaterThanOrEqual(threshold);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty post content", () => {
      const emptyPost = {
        ...samplePost,
        content: "",
      };
      const topics = extractTopicsFromThread(emptyPost, []);
      expect(Array.isArray(topics)).toBe(true);
    });

    it("should handle special characters in content", () => {
      const specialPost = {
        ...samplePost,
        content: "@#$% virtue ethics & philosophy!!!",
      };
      const topics = extractTopicsFromThread(specialPost, []);
      expect(Array.isArray(topics)).toBe(true);
      const virtueMatch = topics.find((t) => t.topicId === "virtue_ethics");
      expect(virtueMatch).toBeDefined();
    });

    it("should handle very long content", () => {
      const longContent = "virtue ".repeat(1000);
      const longPost = {
        ...samplePost,
        content: longContent,
      };
      const topics = extractTopicsFromThread(longPost, []);
      expect(Array.isArray(topics)).toBe(true);
      const virtueMatch = topics.find((t) => t.topicId === "virtue_ethics");
      expect(virtueMatch).toBeDefined();
      expect(virtueMatch.score).toBeLessThanOrEqual(1);
    });

    it("should handle unicode/emoji in content", () => {
      const emojiPost = {
        ...samplePost,
        content: "virtue ethics 🎭 philosophical wisdom 🧠",
      };
      const topics = extractTopicsFromThread(emojiPost, []);
      expect(Array.isArray(topics)).toBe(true);
    });
  });
});
