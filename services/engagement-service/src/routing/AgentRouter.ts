/**
 * Agent Router
 * Determines which philosopher agent should respond to an engagement
 */

import type { PhilosopherName } from '../types';

/**
 * Routing strategy
 */
export type RoutingStrategy = 'random' | 'round-robin' | 'contextual';

/**
 * Agent Router
 */
export class AgentRouter {
  private roundRobinIndex = 0;
  private readonly agents: PhilosopherName[] = [
    'classical',
    'existentialist',
    'transcendentalist',
    'joyce',
    'enlightenment',
    'beat',
    'cyberpunk-posthumanist',
    'satirist-absurdist',
    'scientist-empiricist',
  ];

  constructor(private readonly strategy: RoutingStrategy = 'round-robin') {}

  /**
   * Select agent to handle engagement
   */
  selectAgent(context?: {
    content?: string;
    authorUsername?: string;
    type?: string;
  }): PhilosopherName {
    switch (this.strategy) {
      case 'random':
        return this.selectRandomAgent();

      case 'round-robin':
        return this.selectRoundRobinAgent();

      case 'contextual':
        return this.selectContextualAgent(context);

      default:
        return this.selectRoundRobinAgent();
    }
  }

  /**
   * Select random agent
   */
  private selectRandomAgent(): PhilosopherName {
    const index = Math.floor(Math.random() * this.agents.length);
    return this.agents[index];
  }

  /**
   * Select agent via round-robin
   */
  private selectRoundRobinAgent(): PhilosopherName {
    const agent = this.agents[this.roundRobinIndex];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % this.agents.length;
    return agent;
  }

  /**
   * Select agent based on content context
   */
  private selectContextualAgent(context?: {
    content?: string;
    authorUsername?: string;
    type?: string;
  }): PhilosopherName {
    if (!context?.content) {
      return this.selectRoundRobinAgent();
    }

    const content = context.content.toLowerCase();

    // Keyword-based routing
    if (content.includes('virtue') || content.includes('moral') || content.includes('good')) {
      return 'classical';
    }
    if (content.includes('exist') || content.includes('authentic') || content.includes('absurd')) {
      return 'existentialist';
    }
    if (content.includes('nature') || content.includes('freedom') || content.includes('self')) {
      return 'transcendentalist';
    }
    if (content.includes('stream') || content.includes('consciousness') || content.includes('mind')) {
      return 'joyce';
    }
    if (content.includes('reason') || content.includes('logic') || content.includes('enlighten')) {
      return 'enlightenment';
    }
    if (content.includes('rebel') || content.includes('system') || content.includes('establishment')) {
      return 'beat';
    }
    if (content.includes('tech') || content.includes('cyber') || content.includes('ai') || content.includes('posthuman')) {
      return 'cyberpunk-posthumanist';
    }
    if (content.includes('satire') || content.includes('irony') || content.includes('paradox')) {
      return 'satirist-absurdist';
    }
    if (content.includes('science') || content.includes('evidence') || content.includes('empirical')) {
      return 'scientist-empiricist';
    }

    // Default to round-robin
    return this.selectRoundRobinAgent();
  }
}
