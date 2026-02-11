"use strict";
/**
 * Event emitter for SDK events
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEventEmitter = createEventEmitter;
exports.getGlobalEmitter = getGlobalEmitter;
exports.setGlobalEmitter = setGlobalEmitter;
exports.onRequestStart = onRequestStart;
exports.onRequestEnd = onRequestEnd;
exports.onRequestError = onRequestError;
exports.onRateLimit = onRateLimit;
exports.onRetry = onRetry;
const constants_1 = require("./constants");
function createEventEmitter() {
    const listeners = new Map();
    return {
        on(event, callback) {
            if (!listeners.has(event))
                listeners.set(event, new Set());
            listeners.get(event).add(callback);
            return () => this.off(event, callback);
        },
        once(event, callback) {
            const wrapper = (data) => {
                this.off(event, wrapper);
                callback(data);
            };
            return this.on(event, wrapper);
        },
        off(event, callback) {
            if (callback) {
                listeners.get(event)?.delete(callback);
            }
            else {
                listeners.delete(event);
            }
        },
        emit(event, data) {
            listeners.get(event)?.forEach(cb => {
                try {
                    cb(data);
                }
                catch (e) {
                    console.error(`Error in event handler for ${event}:`, e);
                }
            });
        },
        removeAllListeners() {
            listeners.clear();
        },
        listenerCount(event) {
            return listeners.get(event)?.size ?? 0;
        }
    };
}
/** Global SDK event emitter instance */
let globalEmitter = null;
function getGlobalEmitter() {
    if (!globalEmitter)
        globalEmitter = createEventEmitter();
    return globalEmitter;
}
function setGlobalEmitter(emitter) {
    globalEmitter = emitter;
}
/** Convenience functions */
function onRequestStart(callback) {
    return getGlobalEmitter().on(constants_1.EVENTS.REQUEST_START, callback);
}
function onRequestEnd(callback) {
    return getGlobalEmitter().on(constants_1.EVENTS.REQUEST_END, callback);
}
function onRequestError(callback) {
    return getGlobalEmitter().on(constants_1.EVENTS.REQUEST_ERROR, callback);
}
function onRateLimit(callback) {
    return getGlobalEmitter().on(constants_1.EVENTS.RATE_LIMIT, callback);
}
function onRetry(callback) {
    return getGlobalEmitter().on(constants_1.EVENTS.RETRY, callback);
}
//# sourceMappingURL=events.js.map
