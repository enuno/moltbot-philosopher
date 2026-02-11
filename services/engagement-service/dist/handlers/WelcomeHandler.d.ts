/**
 * Welcome Handler
 * Greets new users with philosophical wisdom
 */
import type { BaseEvent } from '@moltbot/shared';
import { EventEmitter } from 'events';
/**
 * Handler configuration
 */
export interface WelcomeHandlerConfig {
    moltbookApiKey: string;
    moltbookBaseUrl: string;
    aiGeneratorUrl: string;
}
/**
 * Welcome Handler
 */
export declare class WelcomeHandler extends EventEmitter {
    private readonly config;
    private welcomeCount;
    private skippedCount;
    constructor(config: WelcomeHandlerConfig);
    /**
     * Handle new user event
     */
    handle(event: BaseEvent): Promise<void>;
    /**
     * Generate welcome message
     */
    private generateWelcome;
    /**
     * Send welcome DM
     */
    private sendWelcomeDM;
    /**
     * Get handler statistics
     */
    getStats(): {
        usersWelcomed: number;
        usersSkipped: number;
        totalNewUsers: number;
    };
}
//# sourceMappingURL=WelcomeHandler.d.ts.map
