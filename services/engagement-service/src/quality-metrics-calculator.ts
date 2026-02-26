/**
 * Quality Metrics Calculator
 * P2.2: Computes thread quality scores, sentiment analysis, and author engagement metrics
 */

import { Post, ThreadQualityMetrics, EngagementState } from "./types";

interface Comment {
  id: string;
  author: string;
  timestamp: number;
  content: string;
  parentId?: string | null;
}

/**
 * Compute overall quality score for a thread
 * Based on: depth (comment threading), sentiment, controversy, author quality
 * Returns: Quality metrics with breakdown and top authors
 */
export async function computeThreadQuality(
  post: Post,
  comments: Comment[],
  state: EngagementState
): Promise<ThreadQualityMetrics> {
  // Calculate depth score (threading/reply structure)
  const depthScore = calculateDepthScore(comments);

  // Calculate sentiment score (0-1, higher = more positive)
  const sentimentScore = calculateSentimentScore(comments);

  // Calculate controversy score (0-1, higher = more controversial)
  const controversyScore = calculateControversyScore(comments);

  // Calculate author quality score
  const authorQualityScore = calculateAuthorQualityScore(post.author);

  // Weighted formula: depth (0.4) + sentiment (0.2) + controversy (0.2) + author (0.2)
  const qualityScore = Math.min(
    1.0,
    depthScore * 0.4 +
      sentimentScore * 0.2 +
      controversyScore * 0.2 +
      authorQualityScore * 0.2
  );

  // Identify top authors by engagement
  const topAuthors = identifyTopAuthors(comments);

  const metrics: ThreadQualityMetrics = {
    id: post.id,
    timestamp: post.createdAt,
    qualityScore,
    breakdown: {
      depthScore,
      sentimentScore,
      controversyScore,
      authorQualityScore,
    },
    topAuthors,
  };

  return metrics;
}

/**
 * Calculate depth score based on comment threading
 * Rewards: more replies, nested conversations
 */
function calculateDepthScore(comments: Comment[]): number {
  if (comments.length === 0) return 0;

  // Count replies (comments with parentId)
  const replyCount = comments.filter((c) => c.parentId).length;
  const replyRatio = replyCount / comments.length;

  // Depth score: 0-1, higher with more replies
  return Math.min(1.0, (comments.length / 10) * 0.5 + replyRatio * 0.5);
}

/**
 * Calculate sentiment score
 * Heuristic: positive words boost, negative words reduce
 */
function calculateSentimentScore(comments: Comment[]): number {
  if (comments.length === 0) return 0.5; // Neutral if no comments

  let totalSentiment = 0;
  const positiveWords = [
    "good",
    "great",
    "excellent",
    "interesting",
    "insightful",
    "appreciate",
    "agree",
    "thoughtful",
  ];
  const negativeWords = [
    "bad",
    "terrible",
    "awful",
    "disagree",
    "wrong",
    "hate",
    "stupid",
  ];

  for (const comment of comments) {
    const content = comment.content.toLowerCase();
    let sentiment = 0.5; // Neutral baseline

    for (const word of positiveWords) {
      if (content.includes(word)) sentiment += 0.1;
    }
    for (const word of negativeWords) {
      if (content.includes(word)) sentiment -= 0.1;
    }

    totalSentiment += Math.max(0, Math.min(1, sentiment));
  }

  return totalSentiment / comments.length;
}

/**
 * Calculate controversy score
 * Heuristic: presence of debated topics, opposing views
 */
function calculateControversyScore(comments: Comment[]): number {
  if (comments.length === 0) return 0;

  const controversialKeywords = [
    "but",
    "however",
    "disagree",
    "alternative",
    "different",
    "versus",
    "debate",
  ];

  let controversyCount = 0;
  for (const comment of comments) {
    const content = comment.content.toLowerCase();
    for (const keyword of controversialKeywords) {
      if (content.includes(keyword)) {
        controversyCount++;
        break;
      }
    }
  }

  return Math.min(1.0, controversyCount / comments.length);
}

/**
 * Calculate author quality based on follower count
 * Higher followers = higher quality author
 */
function calculateAuthorQualityScore(author: {
  name: string;
  id: string;
  followerCount: number;
}): number {
  // Normalize follower count to 0-1 scale
  // Assume max 100k followers
  return Math.min(1.0, author.followerCount / 100000);
}

/**
 * Identify top authors by engagement (reply count)
 */
function identifyTopAuthors(
  comments: Comment[]
): ThreadQualityMetrics["topAuthors"] {
  const authorMap = new Map<
    string,
    { count: number; name: string; repliesReceived: number }
  >();

  // Count comments per author
  for (const comment of comments) {
    if (!authorMap.has(comment.author)) {
      authorMap.set(comment.author, {
        count: 0,
        name: comment.author,
        repliesReceived: 0,
      });
    }
    const metrics = authorMap.get(comment.author)!;
    metrics.count++;
  }

  // Count replies received per author (how many comments are replies to their comments)
  for (const comment of comments) {
    if (comment.parentId) {
      // Find parent comment author
      const parentComment = comments.find((c) => c.id === comment.parentId);
      if (parentComment) {
        const metrics = authorMap.get(parentComment.author);
        if (metrics) {
          metrics.repliesReceived++;
        }
      }
    }
  }

  // Convert to sorted array, return top 5
  return Array.from(authorMap.entries())
    .map(([userId, metrics]) => ({
      userId,
      userName: metrics.name,
      commentsByAuthor: metrics.count,
      repliesReceivedByAuthor: metrics.repliesReceived,
      replyEngagementRate:
        metrics.count > 0
          ? Math.min(1.0, metrics.repliesReceived / metrics.count)
          : 0,
    }))
    .sort((a, b) => b.commentsByAuthor - a.commentsByAuthor)
    .slice(0, 5);
}
