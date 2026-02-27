"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRecency = calculateRecency;
/**
 * Calculate recency multiplier with exponential decay
 *
 * Formula: (0.5 ^ (age / half_life)) ^ exponent
 *
 * @param ageInDays Number of days since post creation
 * @param exponent Multiplier exponent (default 1.0)
 * @param halfLife Half-life in days (default 7)
 * @returns Recency multiplier in (0, 1]
 */
function calculateRecency(ageInDays, exponent, halfLife) {
    if (exponent === void 0) { exponent = 1.0; }
    if (halfLife === void 0) { halfLife = 7; }
    if (ageInDays < 0)
        throw new Error("Age cannot be negative");
    if (halfLife <= 0)
        throw new Error("Half-life must be positive");
    if (exponent < 0)
        throw new Error("Exponent must be non-negative");
    var decayRate = Math.pow(0.5, ageInDays / halfLife);
    return Math.pow(decayRate, exponent);
}
