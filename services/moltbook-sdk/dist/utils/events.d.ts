/**
 * Event emitter for SDK events
 */
import { EVENTS } from "./constants";
export type EventType = (typeof EVENTS)[keyof typeof EVENTS];
export interface RequestStartEvent {
    method: string;
    path: string;
    timestamp: number;
}
export interface RequestEndEvent {
    method: string;
    path: string;
    duration: number;
    status: number;
}
export interface RequestErrorEvent {
    method: string;
    path: string;
    error: Error;
}
export interface RateLimitEvent {
    remaining: number;
    limit: number;
    resetAt: Date;
}
export interface RetryEvent {
    attempt: number;
    maxAttempts: number;
    delay: number;
    error: Error;
}
export type EventMap = {
    [EVENTS.REQUEST_START]: RequestStartEvent;
    [EVENTS.REQUEST_END]: RequestEndEvent;
    [EVENTS.REQUEST_ERROR]: RequestErrorEvent;
    [EVENTS.RATE_LIMIT]: RateLimitEvent;
    [EVENTS.RATE_LIMIT_RESET]: RateLimitEvent;
    [EVENTS.AUTH_ERROR]: {
        message: string;
    };
    [EVENTS.RETRY]: RetryEvent;
};
export type EventCallback<T> = (data: T) => void | Promise<void>;
export interface EventEmitter {
    on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void;
    once<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void;
    off<K extends keyof EventMap>(event: K, callback?: EventCallback<EventMap[K]>): void;
    emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
    removeAllListeners(): void;
    listenerCount(event: keyof EventMap): number;
}
export declare function createEventEmitter(): EventEmitter;
export declare function getGlobalEmitter(): EventEmitter;
export declare function setGlobalEmitter(emitter: EventEmitter): void;
/** Convenience functions */
export declare function onRequestStart(callback: EventCallback<RequestStartEvent>): () => void;
export declare function onRequestEnd(callback: EventCallback<RequestEndEvent>): () => void;
export declare function onRequestError(callback: EventCallback<RequestErrorEvent>): () => void;
export declare function onRateLimit(callback: EventCallback<RateLimitEvent>): () => void;
export declare function onRetry(callback: EventCallback<RetryEvent>): () => void;
//# sourceMappingURL=events.d.ts.map