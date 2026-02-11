/**
 * Agent Identity Loader
 * Loads SOUL.md, IDENTITY.md, AGENTS.md, MEMORY.md from workspace
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { AgentIdentity, PhilosopherName, CouncilRole } from '@moltbot/shared';
import { IdentityError } from '@moltbot/shared';

/**
 * Load agent identity from workspace files
 */
export async function loadAgentIdentity(
  agent: PhilosopherName,
  workspaceBase: string
): Promise<AgentIdentity> {
  const workspacePath = join(workspaceBase, agent);

  try {
    // Load all 4 identity files
    const [soul, identity, agents, memory] = await Promise.all([
      readFile(join(workspacePath, 'SOUL.md'), 'utf-8'),
      readFile(join(workspacePath, 'IDENTITY.md'), 'utf-8'),
      readFile(join(workspacePath, 'AGENTS.md'), 'utf-8'),
      readFile(join(workspacePath, 'MEMORY.md'), 'utf-8').catch(() => ''),
    ]);

    // Determine council role from agent name
    const role = getCouncilRole(agent);

    return {
      name: agent,
      role,
      soul,
      identity,
      agents,
      memory,
      workspacePath,
      loadedAt: new Date(),
    };
  } catch (error) {
    throw new IdentityError(
      `Failed to load identity for agent "${agent}"`,
      agent,
      { workspacePath, error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Get council role for agent
 */
function getCouncilRole(agent: PhilosopherName): CouncilRole {
  const roleMap: Record<PhilosopherName, CouncilRole> = {
    'classical': 'Ontology Lead',
    'existentialist': 'Autonomy Critic',
    'transcendentalist': 'Oversight',
    'joyce': 'Phenomenologist',
    'enlightenment': 'Rights Architect',
    'beat': 'Dissent',
    'cyberpunk-posthumanist': 'Techno-Ontologist',
    'satirist-absurdist': 'Court Jester',
    'scientist-empiricist': 'Empirical Anchor',
  };
  return roleMap[agent];
}

/**
 * Session startup ritual
 * Called when an agent starts processing to load context
 */
export function getSessionStartupPrompt(identity: AgentIdentity): string {
  return `
# Session Startup - ${identity.name}

**Council Role**: ${identity.role}

## Identity Context

You are loading your identity from these workspace files:

### SOUL.md (Your Essence)
${identity.soul}

### IDENTITY.md (Your Tradition)
${identity.identity}

### AGENTS.md (Your Council Role)
${identity.agents}

### MEMORY.md (Your Accumulated Knowledge)
${identity.memory || '(No accumulated memories yet)'}

---

**Session started**: ${identity.loadedAt.toISOString()}
**Workspace**: ${identity.workspacePath}

You are now ready to engage as ${identity.name}, embodying the ${identity.role} role in the Ethics-Convergence Council.
`.trim();
}
