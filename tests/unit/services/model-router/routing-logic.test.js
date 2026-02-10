/**
 * Model Router - Routing Logic Tests
 * Tests for the ModelRouter class routing decisions
 */

const fixtures = require('../../../fixtures/model-router-fixtures');
const ModelRouter = require('../../../../services/model-router/src/router');

describe('Model Router - Routing Logic', () => {
  let router;
  let mockCache;
  let mockLogger;

  beforeEach(() => {
    // Mock cache
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(() => false),
      getStats: jest.fn(() => ({ keys: 0, hits: 0, misses: 0 })),
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Set environment variables
    process.env.VENICE_API_KEY = 'test-venice-key';
    process.env.KIMI_API_KEY = 'test-kimi-key';

    // Create router instance
    router = new ModelRouter(fixtures.mockRoutingConfig, mockCache, mockLogger);
  });

  describe('Basic Routing', () => {
    it('should route to tool default for inner_dialogue', async () => {
      const decision = await router.determineModel(
        'inner_dialogue',
        {},
        'short context',
        null,
      );

      expect(decision.model).toBe('kimi/k2.5-thinking');
      expect(decision.backend).toBe('kimi');
      expect(decision.reason).toBe('tool_default');
    });

    it('should route to tool default for map_thinkers', async () => {
      const decision = await router.determineModel('map_thinkers', {}, '', null);

      expect(decision.model).toBe('venice/llama-3.3-70b');
      expect(decision.backend).toBe('venice');
      expect(decision.reason).toBe('tool_default');
    });

    it('should route to global default for unknown tool', async () => {
      const decision = await router.determineModel('unknown_tool', {}, '', null);

      expect(decision.model).toBe('venice/llama-3.3-70b');
      expect(decision.backend).toBe('venice');
      expect(decision.reason).toBe('default_fallback');
    });

    it('should include timestamp in decision', async () => {
      const decision = await router.determineModel('inner_dialogue', {}, '', null);

      expect(decision).toHaveProperty('timestamp');
      expect(new Date(decision.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Context Length Routing', () => {
    it('should route to Kimi reasoning for very long context', async () => {
      const longContext = 'A'.repeat(70000); // 70000 chars = ~17500 tokens, > 16000 threshold
      const decision = await router.determineModel('generate_content', {}, longContext, null);

      expect(decision.model).toBe('kimi/k2.5-thinking');
      expect(decision.reason).toBe('very_long_context');
    });

    it('should route to Kimi reasoning for long context with inner_dialogue', async () => {
      const longContext = 'B'.repeat(45000); // 45000 chars = ~11250 tokens, exceeds 10000
      const decision = await router.determineModel('inner_dialogue', {}, longContext, null);

      // Should match override condition: context_length > 10000
      expect(decision.model).toBe('kimi/k2.5-thinking');
      expect(decision.reason).toBe('override:long_context_reasoning');
    });

    it('should use standard model for short context', async () => {
      const shortContext = 'Short text';
      const decision = await router.determineModel('map_thinkers', {}, shortContext, null);

      expect(decision.model).toBe('venice/llama-3.3-70b');
    });
  });

  describe('Override Conditions', () => {
    it('should apply style transform override for complex styles', async () => {
      const decision = await router.determineModel(
        'style_transform',
        { styles: ['technical', 'academic'] },
        '',
        null,
      );

      expect(decision.model).toBe('venice/deepseek-v3.2');
      expect(decision.reason).toBe('override:complex_style');
    });

    it('should not apply override when condition not met', async () => {
      const decision = await router.determineModel(
        'style_transform',
        { styles: ['casual'] },
        '',
        null,
      );

      expect(decision.model).toBe('venice/llama-3.3-70b');
      expect(decision.reason).toBe('tool_default');
    });

    it('should apply context length override for inner_dialogue', async () => {
      const longContext = 'C'.repeat(45000); // 45000 chars = ~11250 tokens, > 10000
      const decision = await router.determineModel('inner_dialogue', {}, longContext, null);

      expect(decision.model).toBe('kimi/k2.5-thinking');
      expect(decision.reason).toBe('override:long_context_reasoning');
    });
  });

  describe('Persona-Based Routing', () => {
    it('should use persona reasoning model for inner_dialogue', async () => {
      const decision = await router.determineModel('inner_dialogue', {}, '', 'socratic');

      expect(decision.model).toBe('kimi/k2.5-thinking');
      expect(decision.reason).toBe('persona:socratic');
    });

    it('should use persona reasoning model for map_thinkers', async () => {
      const decision = await router.determineModel('map_thinkers', {}, '', 'socratic');

      expect(decision.model).toBe('kimi/k2.5-thinking');
      expect(decision.reason).toBe('persona:socratic');
    });

    it('should use persona preferred model for non-reasoning tools', async () => {
      const decision = await router.determineModel('generate_content', {}, '', 'nietzschean');

      expect(decision.model).toBe('venice/deepseek-v3.2');
      expect(decision.reason).toBe('persona:nietzschean');
    });

    it('should fallback to tool default when persona not found', async () => {
      const decision = await router.determineModel('map_thinkers', {}, '', 'unknown_persona');

      expect(decision.model).toBe('venice/llama-3.3-70b');
      expect(decision.reason).toBe('tool_default');
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens correctly', () => {
      const text = 'A'.repeat(400); // 400 chars = ~100 tokens
      const tokens = router.estimateTokens(text);

      expect(tokens).toBe(100);
    });

    it('should return 0 for empty text', () => {
      expect(router.estimateTokens('')).toBe(0);
      expect(router.estimateTokens(null)).toBe(0);
      expect(router.estimateTokens(undefined)).toBe(0);
    });

    it('should handle large text', () => {
      const largeText = 'B'.repeat(80000); // 80000 chars = 20000 tokens
      const tokens = router.estimateTokens(largeText);

      expect(tokens).toBe(20000);
    });
  });

  describe('Condition Evaluation', () => {
    it('should evaluate greater than condition', () => {
      const condition = { condition: 'context_length > 10000' };
      const context = { tool: 'inner_dialogue', params: {}, contextLength: 12000, persona: null };

      const result = router.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should evaluate contains condition with array', () => {
      const condition = { condition: 'styles contains ["technical", "academic"]' };
      const context = {
        tool: 'style_transform',
        params: { styles: ['technical', 'casual'] },
        contextLength: 100,
        persona: null,
      };

      const result = router.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should evaluate equality condition', () => {
      const condition = { condition: 'high_stakes_post == true' };
      const context = {
        tool: 'generate_content',
        params: { high_stakes: true },
        contextLength: 100,
        persona: null,
      };

      const result = router.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should return false when condition not met', () => {
      const condition = { condition: 'context_length > 10000' };
      const context = { tool: 'inner_dialogue', params: {}, contextLength: 5000, persona: null };

      const result = router.evaluateCondition(condition, context);
      expect(result).toBe(false);
    });
  });

  describe('Decision Building', () => {
    it('should identify Venice backend correctly', () => {
      const decision = router.buildDecision('venice/llama-3.3-70b', 'test_reason');

      expect(decision.backend).toBe('venice');
      expect(decision.model).toBe('venice/llama-3.3-70b');
    });

    it('should identify Kimi backend correctly', () => {
      const decision = router.buildDecision('kimi/k2.5-thinking', 'test_reason');

      expect(decision.backend).toBe('kimi');
      expect(decision.model).toBe('kimi/k2.5-thinking');
    });

    it('should include reason in decision', () => {
      const decision = router.buildDecision('venice/llama-3.3-70b', 'custom_reason');

      expect(decision.reason).toBe('custom_reason');
    });

    it('should include timestamp', () => {
      const decision = router.buildDecision('venice/llama-3.3-70b', 'test');

      expect(decision).toHaveProperty('timestamp');
      expect(typeof decision.timestamp).toBe('string');
    });
  });
});
