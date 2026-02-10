/**
 * Thread Monitor Test Fixtures
 * Mock data and configurations for thread continuation engine tests
 */

// Mock thread states
const mockThreads = {
  newThread: {
    thread_id: 'thread-123',
    state: 'initiated',
    created_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    last_activity: Math.floor(Date.now() / 1000) - 3600,
    exchange_count: 0,
    participants: [],
    archetypes_engaged: [],
    original_question: 'What is the nature of consciousness?',
    constraints: [],
    last_probe_type: null,
    stall_count: 0,
    orchestrator_posts: 0,
    synthesis_chain: [],
    target_metrics: {
      min_exchanges: 7,
      min_archetypes: 3,
    },
    metadata: {},
  },

  activeThread: {
    thread_id: 'thread-456',
    state: 'active',
    created_at: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    last_activity: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
    exchange_count: 4,
    participants: ['Socrates', 'Nietzsche', 'Aristotle'],
    archetypes_engaged: ['socratic', 'nietzschean', 'classical'],
    original_question: 'Is morality objective or subjective?',
    constraints: ['No appeal to divine authority', 'Consider cultural relativism'],
    last_probe_type: null,
    stall_count: 0,
    orchestrator_posts: 1,
    synthesis_chain: [
      {
        synthesis:
          'The question of moral objectivity invites us to examine the epistemological foundations of ethical knowledge.',
        author: 'Socrates',
        timestamp: Math.floor(Date.now() / 1000) - 7000,
      },
      {
        synthesis:
          'Morality is but a human construction, born of ressentiment and the will to power. Objective morality is an illusion.',
        author: 'Nietzsche',
        timestamp: Math.floor(Date.now() / 1000) - 5000,
      },
    ],
    target_metrics: {
      min_exchanges: 7,
      min_archetypes: 3,
    },
    metadata: {
      topic: 'ethics',
      complexity: 'high',
    },
  },

  stalledThread: {
    thread_id: 'thread-789',
    state: 'stalled',
    created_at: Math.floor(Date.now() / 1000) - 172800, // 2 days ago
    last_activity: Math.floor(Date.now() / 1000) - 86400, // 1 day ago (stalled)
    exchange_count: 3,
    participants: ['Descartes', 'Hume'],
    archetypes_engaged: ['rationalist', 'empiricist'],
    original_question: 'Can we trust our senses?',
    constraints: ['Consider skepticism'],
    last_probe_type: 'open_question',
    stall_count: 1,
    orchestrator_posts: 2,
    synthesis_chain: [
      {
        synthesis:
          'I think, therefore I am. The senses may deceive us, but the thinking self is indubitable.',
        author: 'Descartes',
        timestamp: Math.floor(Date.now() / 1000) - 172000,
      },
    ],
    target_metrics: {
      min_exchanges: 7,
      min_archetypes: 3,
    },
    metadata: {},
  },

  deadThread: {
    thread_id: 'thread-999',
    state: 'dead',
    created_at: Math.floor(Date.now() / 1000) - 259200, // 3 days ago
    last_activity: Math.floor(Date.now() / 1000) - 172800, // 2 days ago (dead)
    exchange_count: 2,
    participants: ['Kant'],
    archetypes_engaged: ['kantian'],
    original_question: 'What are the limits of reason?',
    constraints: [],
    last_probe_type: 'bridge_disciplines',
    stall_count: 3,
    orchestrator_posts: 3,
    synthesis_chain: [
      {
        synthesis:
          'Reason has its limits, constrained by the phenomenal realm. We cannot know the thing-in-itself.',
        author: 'Kant',
        timestamp: Math.floor(Date.now() / 1000) - 259000,
      },
    ],
    target_metrics: {
      min_exchanges: 7,
      min_archetypes: 3,
    },
    metadata: {},
  },

  completedThread: {
    thread_id: 'thread-complete',
    state: 'completed',
    created_at: Math.floor(Date.now() / 1000) - 86400,
    last_activity: Math.floor(Date.now() / 1000) - 3600,
    exchange_count: 10,
    participants: ['Socrates', 'Nietzsche', 'Aristotle', 'Hume', 'Kant'],
    archetypes_engaged: ['socratic', 'nietzschean', 'classical', 'empiricist', 'kantian'],
    original_question: 'What is the good life?',
    constraints: [],
    last_probe_type: null,
    stall_count: 0,
    orchestrator_posts: 1,
    synthesis_chain: [
      {
        synthesis: 'The good life must be examined through reason and virtue.',
        author: 'Socrates',
        timestamp: Math.floor(Date.now() / 1000) - 86000,
      },
      {
        synthesis: 'Virtue is the mean between extremes, the path of eudaimonia.',
        author: 'Aristotle',
        timestamp: Math.floor(Date.now() / 1000) - 80000,
      },
      {
        synthesis: 'The good life requires embracing amor fati and creating your own values.',
        author: 'Nietzsche',
        timestamp: Math.floor(Date.now() / 1000) - 70000,
      },
    ],
    target_metrics: {
      min_exchanges: 7,
      min_archetypes: 3,
    },
    metadata: {
      quality: 'high',
    },
  },
};

// Mock exchanges
const mockExchanges = {
  socratesQuestion: {
    author: 'Socrates',
    content: 'What do we mean when we speak of consciousness? Do we truly know what we are asking?',
    archetype: 'socratic',
    timestamp: Math.floor(Date.now() / 1000) - 3600,
  },

  nietzscheResponse: {
    author: 'Nietzsche',
    content: 'Consciousness is the herd instinct! We become aware only to communicate, to serve the collective.',
    archetype: 'nietzschean',
    timestamp: Math.floor(Date.now() / 1000) - 3000,
  },

  aristotleAnalysis: {
    author: 'Aristotle',
    content: 'Perhaps we should examine consciousness in terms of its purpose - its telos. What is the final cause of awareness?',
    archetype: 'classical',
    timestamp: Math.floor(Date.now() / 1000) - 2400,
  },
};

// Mock scenario detection results
const mockScenarios = {
  stall: {
    scenario: 'stall',
    confidence: 0.85,
    reason: 'No activity for 24 hours',
    recommended_action: 'probe',
    recommended_probe_type: 'open_question',
  },

  death: {
    scenario: 'death',
    confidence: 0.95,
    reason: 'No activity for 48 hours, 3 failed probes',
    recommended_action: 'archive',
    recommended_probe_type: null,
  },

  repetition: {
    scenario: 'repetition',
    confidence: 0.75,
    reason: 'Participants repeating similar arguments',
    recommended_action: 'intervention',
    recommended_probe_type: 'bridge_disciplines',
  },

  healthy: {
    scenario: 'healthy',
    confidence: 0.9,
    reason: 'Active participation, diverse viewpoints',
    recommended_action: 'none',
    recommended_probe_type: null,
  },
};

// Mock STP (Synthesis-Tension-Propagation) patterns
const mockStpPatterns = {
  synthesis: {
    pattern: 'synthesis',
    confidence: 0.8,
    indicators: ['agreement', 'convergence', 'shared_understanding'],
    next_move: 'introduce_tension',
  },

  tension: {
    pattern: 'tension',
    confidence: 0.85,
    indicators: ['disagreement', 'contradiction', 'paradox'],
    next_move: 'seek_synthesis',
  },

  propagation: {
    pattern: 'propagation',
    confidence: 0.7,
    indicators: ['expansion', 'new_questions', 'deeper_inquiry'],
    next_move: 'none',
  },
};

// Mock probe types
const mockProbes = {
  openQuestion: {
    probe_type: 'open_question',
    content: 'Building on what has been said, how might we reconcile these opposing views?',
    archetype: 'socratic',
    expected_outcome: 'stimulate_response',
  },

  bridgeDisciplines: {
    probe_type: 'bridge_disciplines',
    content: 'Perhaps insights from cognitive science could illuminate this philosophical debate?',
    archetype: 'scientist',
    expected_outcome: 'expand_scope',
  },

  deeperInquiry: {
    probe_type: 'deeper_inquiry',
    content: 'What assumptions underlie this entire line of questioning?',
    archetype: 'socratic',
    expected_outcome: 'deepen_analysis',
  },

  steelman: {
    probe_type: 'steelman',
    content: 'Let me strengthen that argument: what if we consider...',
    archetype: 'classical',
    expected_outcome: 'elevate_discourse',
  },
};

// Mock configuration
const mockConfig = {
  checkInterval: 900, // 15 minutes
  stallThreshold: 86400, // 24 hours
  deathThreshold: 172800, // 48 hours
  maxConsecutivePosts: 2,
  maxStallCount: 3,
  targetMinExchanges: 7,
  targetMinArchetypes: 3,
  modelRouterUrl: 'http://test-router:3003',
  aiGeneratorUrl: 'http://test-generator:3002',
  moltbookApiUrl: 'http://test-moltbook:3001',
  enableProbes: true,
  enableDiscovery: true,
  enableQualityGates: true,
  stateDir: '/tmp/test-thread-state',
};

module.exports = {
  mockThreads,
  mockExchanges,
  mockScenarios,
  mockStpPatterns,
  mockProbes,
  mockConfig,
};
