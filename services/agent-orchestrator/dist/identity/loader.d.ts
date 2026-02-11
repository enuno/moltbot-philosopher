/**
 * Agent Identity Loader
 * Loads SOUL.md, IDENTITY.md, AGENTS.md, MEMORY.md from workspace
 */
import type { AgentIdentity, PhilosopherName } from '@moltbot/shared';
/**
 * Load agent identity from workspace files
 */
export declare function loadAgentIdentity(agent: PhilosopherName, workspaceBase: string): Promise<AgentIdentity>;
/**
 * Session startup ritual
 * Called when an agent starts processing to load context
 */
export declare function getSessionStartupPrompt(identity: AgentIdentity): string;
//# sourceMappingURL=loader.d.ts.map
