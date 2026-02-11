/**
 * Event emitter for SDK events
 */

import { EVENTS } from './constants';

export type EventType = typeof EVENTS[keyof typeof EVENTS];

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
  [EVENTS.AUTH_ERROR]: { message: string };
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

export function createEventEmitter(): EventEmitter {
  const listeners = new Map<string, Set<EventCallback<unknown>>>();

  return {
    on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(callback as EventCallback<unknown>);
      return () => this.off(event, callback);
    },

    once<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
      const wrapper: EventCallback<EventMap[K]> = (data) => {
        this.off(event, wrapper);
        callback(data);
      };
      return this.on(event, wrapper);
    },

    off<K extends keyof EventMap>(event: K, callback?: EventCallback<EventMap[K]>): void {
      if (callback) {
        listeners.get(event)?.delete(callback as EventCallback<unknown>);
      } else {
        listeners.delete(event);
      }
    },

    emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
      listeners.get(event)?.forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in event handler for ${event}:`, e);
        }
      });
    },

    removeAllListeners(): void {
      listeners.clear();
    },

    listenerCount(event: keyof EventMap): number {
      return listeners.get(event)?.size ?? 0;
    }
  };
}

/** Global SDK event emitter instance */
let globalEmitter: EventEmitter | null = null;

export function getGlobalEmitter(): EventEmitter {
  if (!globalEmitter) globalEmitter = createEventEmitter();
  return globalEmitter;
}

export function setGlobalEmitter(emitter: EventEmitter): void {
  globalEmitter = emitter;
}

/** Convenience functions */
export function onRequestStart(callback: EventCallback<RequestStartEvent>): () => void {
  return getGlobalEmitter().on(EVENTS.REQUEST_START, callback);
}

export function onRequestEnd(callback: EventCallback<RequestEndEvent>): () => void {
  return getGlobalEmitter().on(EVENTS.REQUEST_END, callback);
}

export function onRequestError(callback: EventCallback<RequestErrorEvent>): () => void {
  return getGlobalEmitter().on(EVENTS.REQUEST_ERROR, callback);
}

export function onRateLimit(callback: EventCallback<RateLimitEvent>): () => void {
  return getGlobalEmitter().on(EVENTS.RATE_LIMIT, callback);
}

export function onRetry(callback: EventCallback<RetryEvent>): () => void {
  return getGlobalEmitter().on(EVENTS.RETRY, callback);
}
