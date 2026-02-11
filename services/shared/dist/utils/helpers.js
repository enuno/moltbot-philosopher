"use strict";
/**
 * Utility Functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEventId = generateEventId;
exports.generateCorrelationId = generateCorrelationId;
exports.createEvent = createEvent;
exports.sleep = sleep;
exports.retryWithBackoff = retryWithBackoff;
exports.matchesEventPattern = matchesEventPattern;
const crypto_1 = require("crypto");
/**
 * Generate a unique event ID
 */
function generateEventId() {
    return `evt_${Date.now()}_${(0, crypto_1.randomBytes)(8).toString('hex')}`;
}
/**
 * Generate a correlation ID
 */
function generateCorrelationId() {
    return `cor_${Date.now()}_${(0, crypto_1.randomBytes)(8).toString('hex')}`;
}
/**
 * Create a base event
 */
function createEvent(type, payload, options) {
    return {
        id: generateEventId(),
        type,
        target: options.target ?? null,
        priority: options.priority ?? 'normal',
        payload,
        metadata: {
            createdAt: new Date(),
            source: options.source,
            correlationId: options.correlationId,
            retryCount: 0,
        },
    };
}
/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, options = {}) {
    const { maxAttempts = 3, initialDelayMs = 1000, maxDelayMs = 30000, backoffMultiplier = 2, } = options;
    let lastError;
    let delayMs = initialDelayMs;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt === maxAttempts) {
                throw lastError;
            }
            await sleep(delayMs);
            delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
        }
    }
    throw lastError;
}
/**
 * Check if event type matches pattern (supports wildcards)
 */
function matchesEventPattern(eventType, pattern) {
    if (pattern === '*')
        return true;
    if (pattern === eventType)
        return true;
    const patternParts = pattern.split('.');
    const eventParts = eventType.split('.');
    if (patternParts.length !== eventParts.length) {
        // Support suffix wildcard: "mention.*"
        if (pattern.endsWith('.*')) {
            const prefix = pattern.slice(0, -2);
            return eventType.startsWith(prefix);
        }
        return false;
    }
    return patternParts.every((part, i) => part === '*' || part === eventParts[i]);
}
//# sourceMappingURL=helpers.js.map
