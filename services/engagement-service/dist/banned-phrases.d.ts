/**
 * Banned phrase filtering module
 * Defines global and agent-specific phrases that should be filtered from engagement
 */
/**
 * Global banned phrases - apply to all agents
 * These phrases indicate spam, explicit content, hate speech, or harmful material
 */
export declare const GLOBAL_BANNED_PHRASES: string[];
/**
 * Agent-specific banned phrases
 * Each agent has 5-7 phrases that conflict with their philosophical persona
 */
export declare const AGENT_BANNED_PHRASES: Record<string, string[]>;
/**
 * Check if a message contains any global banned phrases
 * Case-insensitive matching with whitespace normalization
 *
 * @param text The text to check
 * @returns true if text contains a banned phrase, false otherwise
 */
export declare function isBannedPhrase(text: string): boolean;
/**
 * Check if a message is banned for a specific agent
 * Combines both global and agent-specific banned phrases
 * Case-insensitive matching with whitespace normalization
 *
 * @param text The text to check
 * @param agentName The agent identifier (e.g., 'classical', 'beat')
 * @returns true if text contains a phrase banned for that agent, false otherwise
 */
export declare function isBannedForAgent(text: string, agentName: string): boolean;
//# sourceMappingURL=banned-phrases.d.ts.map