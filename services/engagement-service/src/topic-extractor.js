/**
 * Topic Extractor
 * P2.3: Detects canonical discussion topics from post and comment content
 * Uses keyword density and direct match scoring
 */

const { CANONICAL_TOPICS } = require("./canonical-topics");

/**
 * Score text against a topic using keyword density
 * Formula: (matches / wordCount) + directBoost if high match density
 *
 * @param {string} text - Content to score
 * @param {string} topicId - Topic ID to score against
 * @returns {number} Score 0-1
 */
function scoreTopic(text, topicId) {
  if (!text || typeof text !== "string") {
    return 0;
  }

  const topic = CANONICAL_TOPICS[topicId];
  if (!topic) {
    return 0;
  }

  // Normalize text
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = Math.max(words.length, 1);

  // Count keyword matches
  let matchCount = 0;
  const matchedKeywords = new Set();

  topic.keywords.forEach((keyword) => {
    const lowerKeyword = keyword.toLowerCase();
    // Match as whole word or substring
    if (normalizedText.includes(lowerKeyword)) {
      // Count occurrences
      const regex = new RegExp(`\\b${lowerKeyword}\\b`, "g");
      const matches = normalizedText.match(regex);
      if (matches) {
        matchCount += matches.length;
        matchedKeywords.add(lowerKeyword);
      } else {
        // Fallback to substring match
        const count = (normalizedText.split(lowerKeyword).length - 1);
        if (count > 0) {
          matchCount += count;
          matchedKeywords.add(lowerKeyword);
        }
      }
    }
  });

  if (matchCount === 0) {
    return 0;
  }

  // Calculate base score from keyword density
  const density = matchCount / wordCount;

  // Apply direct boost if we have matches
  const hasMultipleMatches = matchedKeywords.size > 1;
  const boost = hasMultipleMatches ? topic.directMatchBoost : 0;

  // Combine scores: density + boost, capped at 1.0
  const score = Math.min(1.0, density + boost);

  return score;
}

/**
 * Extract all topics from a post and its comments
 * Returns TopicMatch[] sorted by score descending
 *
 * @param {object} post - Post object with id, content, etc.
 * @param {array} comments - Array of comment objects
 * @returns {array} TopicMatch[] sorted by score
 */
function extractTopicsFromThread(post, comments = []) {
  if (!post) {
    return [];
  }

  // Combine all text content
  const contentParts = [];

  if (post.content) {
    contentParts.push(post.content);
  }

  if (Array.isArray(comments)) {
    comments.forEach((comment) => {
      if (comment && comment.content) {
        contentParts.push(comment.content);
      }
    });
  }

  const combinedText = contentParts.join(" ");

  // Score against all topics
  const topics = Object.keys(CANONICAL_TOPICS).map((topicId) => {
    const score = scoreTopic(combinedText, topicId);
    const confidence = Math.min(1, score * 1.2); // Slightly boost confidence
    const matchedKeywordCount = (
      CANONICAL_TOPICS[topicId].keywords.filter((kw) =>
        combinedText.toLowerCase().includes(kw.toLowerCase())
      ) || []
    ).length;

    return {
      topicId,
      score,
      confidence,
      keywordMatches: matchedKeywordCount,
    };
  });

  // Sort by score descending
  return topics.sort((a, b) => b.score - a.score);
}

/**
 * Get primary topics above a score threshold
 * Defaults to 0.3 threshold
 *
 * @param {object} post - Post object
 * @param {array} comments - Comment objects
 * @param {number} threshold - Score threshold (default 0.3)
 * @returns {array} Filtered TopicMatch[] sorted by score
 */
function getPrimaryTopics(post, comments = [], threshold = 0.3) {
  const allTopics = extractTopicsFromThread(post, comments);
  return allTopics.filter((t) => t.score >= threshold);
}

module.exports = {
  scoreTopic,
  extractTopicsFromThread,
  getPrimaryTopics,
};
