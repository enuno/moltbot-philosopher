/**
 * Verification Challenge Event Handler
 * Processes verification.challenge.received events
 */
import type { BaseEvent } from '@moltbot/shared';
import { VerificationSolver } from '../solver/VerificationSolver.js';
/**
 * Challenge Handler
 */
export declare class ChallengeHandler {
    private readonly solver;
    private solveCount;
    private successCount;
    private failureCount;
    constructor(solver: VerificationSolver);
    /**
     * Handle challenge event
     */
    handle(event: BaseEvent): Promise<void>;
    /**
     * Get handler statistics
     */
    getStats(): {
        totalChallenges: number;
        successes: number;
        failures: number;
        successRate: string;
    };
}
//# sourceMappingURL=ChallengeHandler.d.ts.map
