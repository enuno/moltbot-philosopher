/**
 * Event Types
 * Event-driven architecture types for service communication
 */
import type { PhilosopherName } from './agent.js';
/**
 * Event types for the system
 */
export type EventType = 'verification.challenge.received' | 'verification.challenge.solved' | 'verification.challenge.failed' | 'mention.received' | 'comment.received' | 'dm.received' | 'follow.received' | 'user.new' | 'user.welcomed' | 'council.iteration.start' | 'council.iteration.complete' | 'council.vote.cast' | 'post.created' | 'post.published' | 'post.failed' | 'thread.continuation.needed' | 'thread.continuation.generated' | 'system.startup' | 'system.shutdown' | 'system.health.check';
/**
 * Event priority levels (for queue ordering)
 */
export type EventPriority = 'critical' | 'high' | 'normal' | 'low';
/**
 * Base event structure
 */
export interface BaseEvent<T = unknown> {
    /** Unique event ID */
    id: string;
    /** Event type */
    type: EventType;
    /** Target philosopher agent (null for broadcast) */
    target: PhilosopherName | null;
    /** Event priority */
    priority: EventPriority;
    /** Event payload (type-specific data) */
    payload: T;
    /** Event metadata */
    metadata: {
        /** Timestamp when event was created */
        createdAt: Date;
        /** Source service that created the event */
        source: string;
        /** Correlation ID for tracing related events */
        correlationId?: string;
        /** Retry count (for failed events) */
        retryCount?: number;
    };
}
/**
 * Verification challenge event payload
 */
export interface VerificationChallengePayload {
    challengeId: string;
    question: string;
    expiresAt: Date;
}
/**
 * Mention event payload
 */
export interface MentionPayload {
    postId: string;
    commentId?: string;
    authorUsername: string;
    content: string;
    url: string;
}
/**
 * DM event payload
 */
export interface DMPayload {
    conversationId: string;
    messageId: string;
    senderUsername: string;
    content: string;
    timestamp: Date;
}
/**
 * New user event payload
 */
export interface NewUserPayload {
    username: string;
    userId: string;
    joinedAt: Date;
    shouldWelcome: boolean;
}
/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (event: BaseEvent<T>) => Promise<void>;
/**
 * Event subscription
 */
export interface EventSubscription {
    /** Event type pattern (supports wildcards: "mention.*") */
    eventType: string;
    /** Handler function */
    handler: EventHandler;
    /** Target agent filter (null = all agents) */
    targetAgent?: PhilosopherName | null;
    /** Priority filter (only handle events with this priority or higher) */
    minPriority?: EventPriority;
}
//# sourceMappingURL=event.d.ts.map
