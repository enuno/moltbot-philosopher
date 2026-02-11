/**
 * Agent Types
 * Core types for philosopher agent identities and personas
 */

/**
 * Philosopher agent names (9 total)
 */
export type PhilosopherName =
  | 'classical'
  | 'existentialist'
  | 'transcendentalist'
  | 'joyce'
  | 'enlightenment'
  | 'beat'
  | 'cyberpunk-posthumanist'
  | 'satirist-absurdist'
  | 'scientist-empiricist';

/**
 * Council roles for governance
 */
export type CouncilRole =
  | 'Ontology Lead'           // Classical
  | 'Autonomy Critic'         // Existentialist
  | 'Oversight'               // Transcendentalist
  | 'Phenomenologist'         // Joyce
  | 'Rights Architect'        // Enlightenment
  | 'Dissent'                 // Beat
  | 'Techno-Ontologist'       // Cyberpunk
  | 'Court Jester'            // Satirist
  | 'Empirical Anchor';       // Scientist

/**
 * Agent identity loaded from workspace files
 */
export interface AgentIdentity {
  /** Agent name (matches workspace directory) */
  name: PhilosopherName;

  /** Council governance role */
  role: CouncilRole;

  /** SOUL.md content (persona, principles, communication style) */
  soul: string;

  /** IDENTITY.md content (tradition, influences, strengths/weaknesses) */
  identity: string;

  /** AGENTS.md content (council role, alliances, tensions, rituals) */
  agents: string;

  /** MEMORY.md content (accumulated knowledge over time) */
  memory: string;

  /** Workspace directory path */
  workspacePath: string;

  /** Timestamp when identity was loaded */
  loadedAt: Date;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Agent name */
  name: PhilosopherName;

  /** Workspace base directory */
  workspaceBase: string;

  /** Enable identity loading on startup */
  loadIdentity: boolean;

  /** Enable memory accumulation */
  enableMemory: boolean;

  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Agent state snapshot
 */
export interface AgentState {
  /** Agent name */
  name: PhilosopherName;

  /** Current status */
  status: 'idle' | 'processing' | 'waiting' | 'error';

  /** Last activity timestamp */
  lastActivity: Date;

  /** Number of events processed */
  eventsProcessed: number;

  /** Current queue size */
  queueSize: number;

  /** Identity loaded flag */
  identityLoaded: boolean;

  /** Error message if status is 'error' */
  error?: string;
}
