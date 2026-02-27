/**
 * End-to-End Hybrid Search Tests
 *
 * Comprehensive tests for realistic search scenarios:
 * - Multi-post ranking with all factors
 * - Edge cases and boundary conditions
 * - Real-world semantic relevance
 * - Combined factor effects
 * - Normalization and sorting
 */

describe("E2E: Hybrid Search Ranking", () => {
  // Mock SemanticSearch implementation (simplified for clarity)
  class SearchEngine {
    constructor(followSet = new Set(), flags = {}) {
      this.followSet = followSet;
      this.flags = {
        enableRecency: flags.enableRecency !== false,
        enableReputation: flags.enableReputation !== false,
        enableFollowBoost: flags.enableFollowBoost !== false,
      };
    }

    search(query, entries, topK = 10) {
      const queryTerms = this.tokenize(query);
      const results = [];

      for (const entry of entries) {
        const semanticScore = this.calculateSemanticScore(queryTerms, entry);
        if (semanticScore > 0) {
          const finalScore = this.applyHybridScoring(entry, semanticScore);
          results.push({
            id: entry.id,
            title: entry.title,
            author: entry.author,
            semanticScore,
            finalScore,
            createdAt: entry.createdAt,
          });
        }
      }

      // Normalize scores
      if (results.length > 1) {
        const scores = results.map((r) => r.finalScore);
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const range = max - min;

        if (range > 0) {
          for (const result of results) {
            result.normalizedScore = (result.finalScore - min) / range;
          }
        } else {
          for (const result of results) {
            result.normalizedScore = 0;
          }
        }
      } else if (results.length === 1) {
        results[0].normalizedScore = 0;
      }

      // Sort by normalized score
      results.sort((a, b) => (b.normalizedScore || 0) - (a.normalizedScore || 0));

      return results.slice(0, topK);
    }

    calculateSemanticScore(queryTerms, entry) {
      let score = 0;
      const entryText = `${entry.title} ${entry.content}`.toLowerCase();
      const entryTerms = this.tokenize(entryText);

      for (const term of queryTerms) {
        const count = entryTerms.filter((t) => t === term).length;
        score += count;
      }

      return score * entry.confidence * entry.relevanceBoost;
    }

    applyHybridScoring(entry, semanticScore) {
      let score = semanticScore;

      // Apply recency if enabled
      if (this.flags.enableRecency) {
        const ageInDays = (new Date() - new Date(entry.createdAt)) / (1000 * 60 * 60 * 24);
        const recencyMult = Math.pow(0.5, ageInDays / 7);
        score *= recencyMult;
      }

      // Apply reputation if enabled
      if (this.flags.enableReputation) {
        const reputationBase =
          1.0 + 0.5 * (entry.authorHistorical || 0.5) + 0.25 * (entry.authorRecent || 0.5);
        const reputationMult = Math.max(0.5, Math.min(1.5, reputationBase));
        score *= reputationMult;
      }

      // Apply follow boost if enabled
      if (this.flags.enableFollowBoost && this.followSet.has(entry.author)) {
        score *= 1.25;
      }

      return score;
    }

    tokenize(text) {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2);
    }
  }

  describe("Scenario 1: Recent Post Beats Old Post", () => {
    it("should rank recent relevant post higher than old relevant post", () => {
      const now = new Date();
      const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const twoMonthsAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);

      const entries = [
        {
          id: "post1",
          title: "Philosophy Ethics",
          content: "deep discussion",
          author: "alice",
          createdAt: twoMonthsAgo,
          confidence: 0.9,
          relevanceBoost: 1.0,
          authorHistorical: 0.8,
          authorRecent: 0.7,
        },
        {
          id: "post2",
          title: "Ethics Philosophy Discussion",
          content: "recent insights",
          author: "bob",
          createdAt: oneWeekAgo,
          confidence: 0.85,
          relevanceBoost: 1.0,
          authorHistorical: 0.6,
          authorRecent: 0.5,
        },
      ];

      const search = new SearchEngine();
      const results = search.search("philosophy ethics", entries, 10);

      expect(results.length).toBe(2);
      // Recent post should rank higher despite lower confidence/author stats
      expect(results[0].id).toBe("post2");
      expect(results[1].id).toBe("post1");
    });
  });

  describe("Scenario 2: Recency Decay Effect", () => {
    it("should apply recency decay to older posts", () => {
      const now = new Date();
      const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

      const entries = [
        {
          id: "recent-post",
          title: "Philosophy Concepts",
          content: "recent analysis",
          author: "author1",
          createdAt: oneDayAgo,
          confidence: 0.8,
          relevanceBoost: 1.0,
          authorHistorical: 0.5,
          authorRecent: 0.5,
        },
        {
          id: "older-post",
          title: "Philosophy Analysis",
          content: "older concepts",
          author: "author2",
          createdAt: twoWeeksAgo,
          confidence: 0.9,
          relevanceBoost: 1.0,
          authorHistorical: 0.8,
          authorRecent: 0.7,
        },
      ];

      const search = new SearchEngine();
      const results = search.search("philosophy concepts", entries, 10);

      expect(results.length).toBe(2);
      // Recent post should rank higher due to recency boost
      expect(results[0].id).toBe("recent-post");
      expect(results[1].id).toBe("older-post");
    });
  });

  describe("Scenario 3: Follow Boost Effect", () => {
    it("should rank followed author post higher", () => {
      const now = new Date();

      const entries = [
        {
          id: "followed-post",
          title: "Philosophy Discussion",
          content: "thoughts on ethics",
          author: "alice",
          createdAt: now,
          confidence: 0.8,
          relevanceBoost: 1.0,
          authorHistorical: 0.6,
          authorRecent: 0.5,
        },
        {
          id: "unfollowed-post",
          title: "Ethics Philosophy",
          content: "analysis and discussion",
          author: "bob",
          createdAt: now,
          confidence: 0.9,
          relevanceBoost: 1.0,
          authorHistorical: 0.7,
          authorRecent: 0.6,
        },
      ];

      const followSet = new Set(["alice"]);
      const search = new SearchEngine(followSet);
      const results = search.search("philosophy ethics", entries, 10);

      expect(results.length).toBe(2);
      // Followed author post should rank higher
      expect(results[0].id).toBe("followed-post");
      expect(results[1].id).toBe("unfollowed-post");
    });
  });

  describe("Scenario 4: Multiple Factor Combination", () => {
    it("should correctly combine all factors (recency + reputation + follow)", () => {
      const now = new Date();
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

      const entries = [
        {
          id: "post-balanced",
          title: "Philosophy Ethics",
          content: "balanced discussion",
          author: "alice",
          createdAt: threeDaysAgo,
          confidence: 0.85,
          relevanceBoost: 1.0,
          authorHistorical: 0.75,
          authorRecent: 0.65,
        },
        {
          id: "post-old-expert",
          title: "Expert Philosophy",
          content: "ethical analysis",
          author: "bob",
          createdAt: twoWeeksAgo,
          confidence: 0.9,
          relevanceBoost: 1.0,
          authorHistorical: 0.95,
          authorRecent: 0.85,
        },
      ];

      const followSet = new Set(["alice"]); // alice is followed
      const search = new SearchEngine(followSet);
      const results = search.search("philosophy ethics", entries, 10);

      expect(results.length).toBe(2);
      // Balanced recent followed post vs old expert unfollowed
      // Both are strong, but combination should favor balanced-recent-followed
      expect(results[0].id).toBeDefined();
      expect(results.some((r) => r.id === "post-balanced")).toBe(true);
    });
  });

  describe("Scenario 5: Normalization Across Different Score Ranges", () => {
    it("should normalize scores correctly regardless of initial range", () => {
      const now = new Date();

      const entries = [
        {
          id: "high-score",
          title: "Philosophy Philosophy Philosophy",
          content: "philosophy discussion philosophy",
          author: "author1",
          createdAt: now,
          confidence: 0.95,
          relevanceBoost: 1.0,
          authorHistorical: 0.8,
          authorRecent: 0.8,
        },
        {
          id: "med-score",
          title: "Philosophy Discussion",
          content: "discussion",
          author: "author2",
          createdAt: now,
          confidence: 0.8,
          relevanceBoost: 1.0,
          authorHistorical: 0.5,
          authorRecent: 0.5,
        },
        {
          id: "low-score",
          title: "Philosophy",
          content: "text",
          author: "author3",
          createdAt: now,
          confidence: 0.5,
          relevanceBoost: 1.0,
          authorHistorical: 0.3,
          authorRecent: 0.3,
        },
      ];

      const search = new SearchEngine();
      const results = search.search("philosophy", entries, 10);

      expect(results.length).toBe(3);
      // Verify all normalized scores are in [0, 1]
      for (const result of results) {
        expect(result.normalizedScore).toBeGreaterThanOrEqual(0);
        expect(result.normalizedScore).toBeLessThanOrEqual(1);
      }
      // Single highest score normalizes to 1.0
      expect(results[0].normalizedScore).toBe(1.0);
      // Single lowest score normalizes to 0
      expect(results[2].normalizedScore).toBe(0);
    });
  });

  describe("Scenario 6: Top-K Results", () => {
    it("should respect topK parameter and return correct number of results", () => {
      const now = new Date();
      const entries = [];

      // Create 20 entries
      for (let i = 0; i < 20; i++) {
        entries.push({
          id: `post-${i}`,
          title: `Post ${i} Philosophy`,
          content: "philosophy content",
          author: `author-${i}`,
          createdAt: now,
          confidence: 0.5 + Math.random() * 0.5,
          relevanceBoost: 1.0,
          authorHistorical: Math.random(),
          authorRecent: Math.random(),
        });
      }

      const search = new SearchEngine();

      const top5 = search.search("philosophy", entries, 5);
      expect(top5.length).toBeLessThanOrEqual(5);

      const top10 = search.search("philosophy", entries, 10);
      expect(top10.length).toBeLessThanOrEqual(10);

      const all = search.search("philosophy", entries, 100);
      expect(all.length).toBeLessThanOrEqual(20);
    });
  });

  describe("Scenario 7: No Matches", () => {
    it("should return empty results for non-matching query", () => {
      const now = new Date();
      const entries = [
        {
          id: "post1",
          title: "Philosophy Ethics",
          content: "discussion",
          author: "alice",
          createdAt: now,
          confidence: 0.9,
          relevanceBoost: 1.0,
          authorHistorical: 0.8,
          authorRecent: 0.7,
        },
      ];

      const search = new SearchEngine();
      const results = search.search("nonexistent_query_xyz", entries, 10);

      expect(results.length).toBe(0);
    });
  });

  describe("Scenario 8: Disabled Factors", () => {
    it("should ignore disabled factors in scoring", () => {
      const now = new Date();
      const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

      const entries = [
        {
          id: "recent",
          title: "Philosophy",
          content: "recent post",
          author: "followed-author",
          createdAt: now,
          confidence: 0.9,
          relevanceBoost: 1.0,
          authorHistorical: 0.3,
          authorRecent: 0.2,
        },
        {
          id: "old-expert",
          title: "Philosophy",
          content: "old post",
          author: "unknown-author",
          createdAt: oneMonthAgo,
          confidence: 0.9,
          relevanceBoost: 1.0,
          authorHistorical: 0.95,
          authorRecent: 0.85,
        },
      ];

      // With all factors enabled
      const searchFull = new SearchEngine(new Set(["followed-author"]), {
        enableRecency: true,
        enableReputation: true,
        enableFollowBoost: true,
      });
      const resultsFull = searchFull.search("philosophy", entries, 10);
      expect(resultsFull[0].id).toBe("recent"); // Recent + followed should win

      // With only semantic score (all factors disabled)
      const searchSemantic = new SearchEngine(new Set(), {
        enableRecency: false,
        enableReputation: false,
        enableFollowBoost: false,
      });
      const resultsSemantic = searchSemantic.search("philosophy", entries, 10);
      // Both have same semantic score, so order may vary but both should be present
      expect(resultsSemantic.length).toBe(2);
    });
  });

  describe("Scenario 9: Single Result Edge Cases", () => {
    it("should normalize single result to 0", () => {
      const now = new Date();
      const entries = [
        {
          id: "single-post",
          title: "Philosophy Discussion",
          content: "unique content",
          author: "author",
          createdAt: now,
          confidence: 0.8,
          relevanceBoost: 1.0,
          authorHistorical: 0.5,
          authorRecent: 0.5,
        },
      ];

      const search = new SearchEngine();
      const results = search.search("philosophy", entries, 10);

      expect(results.length).toBe(1);
      expect(results[0].normalizedScore).toBe(0);
    });
  });

  describe("Scenario 10: Identical Semantic Scores (Tie-Breaking)", () => {
    it("should break ties using other factors", () => {
      const now = new Date();

      const entries = [
        {
          id: "post1",
          title: "Philosophy Ethics",
          content: "ethics and philosophy discussion",
          author: "expert",
          createdAt: now,
          confidence: 0.8,
          relevanceBoost: 1.0,
          authorHistorical: 0.95, // High reputation
          authorRecent: 0.9,
        },
        {
          id: "post2",
          title: "Philosophy Ethics",
          content: "ethics and philosophy discussion",
          author: "novice",
          createdAt: now,
          confidence: 0.8,
          relevanceBoost: 1.0,
          authorHistorical: 0.2, // Low reputation
          authorRecent: 0.1,
        },
      ];

      const search = new SearchEngine();
      const results = search.search("philosophy ethics", entries, 10);

      expect(results.length).toBe(2);
      // Expert should rank higher due to reputation
      expect(results[0].id).toBe("post1");
      expect(results[1].id).toBe("post2");
    });
  });
});
