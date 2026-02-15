"use strict";
/**
 * Verification Challenge Event Handler
 * Processes verification.challenge.received events
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChallengeHandler = void 0;
/**
 * Challenge Handler
 */
class ChallengeHandler {
    solver;
    solveCount = 0;
    successCount = 0;
    failureCount = 0;
    constructor(solver) {
        this.solver = solver;
        // Wire up solver events
        solver.on('solved', () => this.successCount++);
        solver.on('failed', () => this.failureCount++);
    }
    /**
     * Handle challenge event
     */
    async handle(event) {
        if (event.type !== 'verification.challenge.received') {
            console.warn(`[ChallengeHandler] Unexpected event type: ${event.type}`);
            return;
        }
        const payload = event.payload;
        console.log(`[ChallengeHandler] Processing challenge ${payload.challengeId}`);
        this.solveCount++;
        const challenge = {
            id: payload.challengeId,
            question: payload.question,
            expiresAt: new Date(payload.expiresAt),
        };
        try {
            const result = await this.solver.solve(challenge);
            if (result.success) {
                console.log(`[ChallengeHandler] ✓ Challenge solved (${result.duration}ms)`);
            }
            else {
                console.error(`[ChallengeHandler] ✗ Challenge failed: ${result.error}`);
            }
        }
        catch (error) {
            console.error('[ChallengeHandler] Unexpected error:', error);
            this.failureCount++;
        }
    }
    /**
     * Get handler statistics
     */
    getStats() {
        return {
            totalChallenges: this.solveCount,
            successes: this.successCount,
            failures: this.failureCount,
            successRate: this.solveCount > 0
                ? (this.successCount / this.solveCount * 100).toFixed(1) + '%'
                : 'N/A',
        };
    }
}
exports.ChallengeHandler = ChallengeHandler;
//# sourceMappingURL=ChallengeHandler.js.map