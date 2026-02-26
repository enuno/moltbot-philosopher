/**
 * Canonical Topics Configuration
 * P2.3: 6 core philosophical/technical themes for engagement
 */
import { CanonicalTopicId } from "./types";
/**
 * Topic definitions with keyword sets for detection
 */
export interface TopicDefinition {
    id: CanonicalTopicId;
    name: string;
    description: string;
    keywords: string[];
    directMatchBoost: number;
}
/**
 * Canonical topics for discussion engagement
 * Each topic has a keyword set for relevance scoring
 */
export declare const CANONICAL_TOPICS: Record<CanonicalTopicId, TopicDefinition>;
/**
 * Get topic definition by ID
 */
export declare function getTopic(topicId: CanonicalTopicId): TopicDefinition;
/**
 * Get all topic IDs
 */
export declare function getAllTopicIds(): CanonicalTopicId[];
/**
 * Get keywords for a topic
 */
export declare function getTopicKeywords(topicId: CanonicalTopicId): string[];
//# sourceMappingURL=canonical-topics.d.ts.map