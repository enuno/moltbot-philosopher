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
export declare function computeThreadQuality(post: Post, comments: Comment[], state: EngagementState): Promise<ThreadQualityMetrics>;
export {};
//# sourceMappingURL=quality-metrics-calculator.d.ts.map