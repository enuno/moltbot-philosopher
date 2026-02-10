/**
 * Model Router Test Fixtures
 * Mock configuration and test data for model routing service
 */

// Mock routing configuration (mimics model-routing.yml structure)
const mockRoutingConfig = {
  global: {
    default_model: 'venice/llama-3.3-70b',
    thresholds: {
      long_context: 4000,
      very_long_context: 16000,
    },
  },
  backends: {
    venice: {
      api_base: 'http://test-venice.com/v1',
      standard: 'venice/llama-3.3-70b',
      premium: 'venice/deepseek-v3.2',
    },
    kimi: {
      api_base: 'http://test-kimi.com/v1',
      standard: 'kimi/moonshot-v1-32k',
      reasoning: 'kimi/k2.5-thinking',
    },
  },
  tools: {
    inner_dialogue: {
      default: 'kimi/k2.5-thinking',
      override_conditions: [
        {
          condition: 'context_length > 10000',
          model: 'kimi/k2.5-thinking',
          reason: 'long_context_reasoning',
        },
      ],
    },
    map_thinkers: {
      default: 'venice/llama-3.3-70b',
    },
    style_transform: {
      default: 'venice/llama-3.3-70b',
      override_conditions: [
        {
          condition: 'styles contains ["technical", "academic"]',
          model: 'venice/deepseek-v3.2',
          reason: 'complex_style',
        },
      ],
    },
    generate_content: {
      default: 'venice/llama-3.3-70b',
    },
  },
  personas: {
    socratic: {
      preferred_model: 'venice/llama-3.3-70b',
      reasoning_model: 'kimi/k2.5-thinking',
    },
    nietzschean: {
      preferred_model: 'venice/deepseek-v3.2',
    },
  },
  cost_optimization: {
    cache_ttl: {
      map_thinkers: 3600,
    },
  },
};

// Sample routing requests
const sampleRequests = {
  basicInnerDialogue: {
    tool: 'inner_dialogue',
    params: {
      topic: 'consciousness',
    },
    context: 'What is consciousness?',
    persona: 'socratic',
  },
  longContextRequest: {
    tool: 'inner_dialogue',
    params: {},
    context: 'A'.repeat(12000), // Exceeds long_context threshold
    persona: null,
  },
  veryLongContextRequest: {
    tool: 'generate_content',
    params: {},
    context: 'B'.repeat(20000), // Exceeds very_long_context threshold
    persona: null,
  },
  styleTransformComplex: {
    tool: 'style_transform',
    params: {
      styles: ['technical', 'academic'],
    },
    context: 'Transform this text',
    persona: null,
  },
  mapThinkersRequest: {
    tool: 'map_thinkers',
    params: {
      participants: ['socratic', 'nietzschean'],
    },
    context: 'Philosophy discussion',
    persona: null,
  },
  unknownToolRequest: {
    tool: 'unknown_tool',
    params: {},
    context: 'Some context',
    persona: null,
  },
};

// Sample completion messages
const sampleMessages = {
  basic: [
    {
      role: 'system',
      content: 'You are a philosophical AI assistant.',
    },
    {
      role: 'user',
      content: 'What is the nature of consciousness?',
    },
  ],
  multiTurn: [
    {
      role: 'system',
      content: 'You are a philosophical AI assistant.',
    },
    {
      role: 'user',
      content: 'What is truth?',
    },
    {
      role: 'assistant',
      content: 'Truth is correspondence with reality.',
    },
    {
      role: 'user',
      content: 'But what is reality?',
    },
  ],
};

// Mock API responses
const mockVeniceResponse = {
  id: 'venice-resp-123',
  object: 'chat.completion',
  created: 1706000000,
  model: 'venice/llama-3.3-70b',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content:
          'Consciousness remains one of the great mysteries of philosophy and neuroscience...',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 45,
    completion_tokens: 120,
    total_tokens: 165,
  },
};

const mockKimiResponse = {
  id: 'kimi-resp-456',
  object: 'chat.completion',
  created: 1706000001,
  model: 'kimi/k2.5-thinking',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Through careful reasoning, we can approach the question of consciousness...',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 52,
    completion_tokens: 180,
    total_tokens: 232,
  },
};

// Expected routing decisions
const expectedDecisions = {
  innerDialogueDefault: {
    model: 'kimi/k2.5-thinking',
    backend: 'kimi',
    reason: 'tool_default',
  },
  longContextOverride: {
    model: 'kimi/k2.5-thinking',
    backend: 'kimi',
    reason: 'override:long_context_reasoning',
  },
  veryLongContext: {
    model: 'kimi/k2.5-thinking',
    backend: 'kimi',
    reason: 'very_long_context',
  },
  styleTransformComplex: {
    model: 'venice/deepseek-v3.2',
    backend: 'venice',
    reason: 'override:complex_style',
  },
  personaPreferred: {
    model: 'kimi/k2.5-thinking',
    backend: 'kimi',
    reason: 'persona:socratic',
  },
  defaultFallback: {
    model: 'venice/llama-3.3-70b',
    backend: 'venice',
    reason: 'default_fallback',
  },
};

module.exports = {
  mockRoutingConfig,
  sampleRequests,
  sampleMessages,
  mockVeniceResponse,
  mockKimiResponse,
  expectedDecisions,
};
