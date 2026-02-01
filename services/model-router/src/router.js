/**
 * Model Router
 * 
 * Core routing logic for determining which AI backend to use
 * based on tool, context, and configuration rules.
 */

const axios = require('axios');
const crypto = require('crypto');

class ModelRouter {
  constructor(config, cache, logger) {
    this.config = config;
    this.cache = cache;
    this.logger = logger;
    
    // Initialize API clients
    this.veniceClient = axios.create({
      baseURL: config.backends.venice.api_base,
      headers: {
        'Authorization': `Bearer ${process.env.VENICE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    
    this.kimiClient = axios.create({
      baseURL: config.backends.kimi.api_base,
      headers: {
        'Authorization': `Bearer ${process.env.KIMI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // Kimi thinking model may take longer
    });
    
    this.logger.info('ModelRouter initialized');
  }

  /**
   * Determine which model to use for a given request
   * 
   * @param {string} tool - Tool name (e.g., 'inner_dialogue')
   * @param {Object} params - Tool parameters
   * @param {string} context - Request context/thread
   * @param {string} persona - Agent persona type
   * @returns {Object} Routing decision
   */
  async determineModel(tool, params = {}, context = '', persona = null) {
    const toolConfig = this.config.tools[tool];
    const contextLength = this.estimateTokens(context);
    
    if (!toolConfig) {
      this.logger.warn(`No routing config for tool: ${tool}, using default`);
      return this.buildDecision(this.config.global.default_model, 'default_fallback');
    }

    // Check override conditions first
    if (toolConfig.override_conditions) {
      for (const condition of toolConfig.override_conditions) {
        if (this.evaluateCondition(condition, { tool, params, contextLength, persona })) {
          this.logger.debug('Override condition matched', { 
            tool, 
            condition: condition.condition,
            model: condition.model 
          });
          return this.buildDecision(condition.model, `override:${condition.reason}`);
        }
      }
    }

    // Check context length thresholds
    if (contextLength > this.config.global.thresholds.very_long_context) {
      return this.buildDecision(
        this.config.backends.kimi.reasoning,
        'very_long_context'
      );
    }

    if (contextLength > this.config.global.thresholds.long_context) {
      // For long context, check if premium Venice or Kimi is needed
      if (tool === 'inner_dialogue' || tool === 'style_transform') {
        return this.buildDecision(
          this.config.backends.venice.premium,
          'long_context_premium'
        );
      }
    }

    // Check persona preferences
    if (persona && this.config.personas[persona]) {
      const personaConfig = this.config.personas[persona];
      
      // For reasoning-heavy tools, use persona's reasoning model
      if (['inner_dialogue', 'map_thinkers'].includes(tool) && personaConfig.reasoning_model) {
        return this.buildDecision(personaConfig.reasoning_model, `persona:${persona}`);
      }
      
      // Otherwise use preferred model
      if (personaConfig.preferred_model) {
        return this.buildDecision(personaConfig.preferred_model, `persona:${persona}`);
      }
    }

    // Use tool default
    return this.buildDecision(toolConfig.default, 'tool_default');
  }

  /**
   * Evaluate a routing condition
   * 
   * @param {Object} condition - Condition configuration
   * @param {Object} context - Evaluation context
   * @returns {boolean}
   */
  evaluateCondition(condition, { tool, params, contextLength, persona }) {
    const { condition: conditionStr } = condition;
    
    // Parse simple conditions
    // Format: "field > value" or "field contains [values]" or "field == true"
    
    if (conditionStr.includes('>')) {
      const [field, value] = conditionStr.split('>').map(s => s.trim());
      const actualValue = this.getFieldValue(field, { tool, params, contextLength, persona });
      return actualValue > parseInt(value);
    }
    
    if (conditionStr.includes('contains')) {
      const match = conditionStr.match(/(\w+)\s+contains\s+\[(.*?)\]/);
      if (match) {
        const [, field, valuesStr] = match;
        const values = valuesStr.split(',').map(v => v.trim().replace(/"/g, ''));
        const actualValue = this.getFieldValue(field, { tool, params, contextLength, persona });
        
        if (Array.isArray(actualValue)) {
          return values.some(v => actualValue.includes(v));
        }
        return values.includes(actualValue);
      }
    }
    
    if (conditionStr.includes('==')) {
      const [field, value] = conditionStr.split('==').map(s => s.trim());
      const actualValue = this.getFieldValue(field, { tool, params, contextLength, persona });
      return actualValue === (value === 'true' ? true : value === 'false' ? false : value);
    }
    
    // Default: try to evaluate as boolean field
    return !!this.getFieldValue(conditionStr, { tool, params, contextLength, persona });
  }

  /**
   * Get field value from context
   * 
   * @param {string} field - Field name
   * @param {Object} context - Context object
   * @returns {any}
   */
  getFieldValue(field, { tool, params, contextLength, persona }) {
    const fieldMap = {
      'thread_length': contextLength,
      'context_length': contextLength,
      'problem_description_length': params.problem_description?.length || 0,
      'multi_layered_ethical_debate': params.focus_traditions?.length > 2,
      'position_complexity': params.complexity,
      'high_stakes_post': params.high_stakes,
      'styles': params.styles,
      'participants': params.participants,
      'persona': persona,
      'tool': tool
    };
    
    return fieldMap[field];
  }

  /**
   * Estimate token count from text
   * 
   * @param {string} text - Input text
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    if (!text) return 0;
    // Rough estimate: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Build routing decision object
   * 
   * @param {string} model - Model identifier
   * @param {string} reason - Routing reason
   * @returns {Object}
   */
  buildDecision(model, reason) {
    const backend = model.startsWith('venice/') ? 'venice' : 'kimi';
    
    return {
      model,
      backend,
      reason,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute completion request
   * 
   * @param {Object} routingDecision - Routing decision
   * @param {Array} messages - Chat messages
   * @returns {Object} Completion result
   */
  async executeCompletion(routingDecision, messages) {
    const { model, backend } = routingDecision;
    
    this.logger.debug('Executing completion', { model, backend, messageCount: messages.length });
    
    try {
      if (backend === 'venice') {
        const response = await this.veniceClient.post('/chat/completions', {
          model: model.replace('venice/', ''),
          messages,
          temperature: 0.7,
          max_tokens: 4000
        });
        
        return {
          content: response.data.choices[0].message.content,
          usage: response.data.usage,
          model: response.data.model
        };
        
      } else if (backend === 'kimi') {
        const response = await this.kimiClient.post('/chat/completions', {
          model: model,
          messages,
          temperature: 0.7,
          max_tokens: 4000
        });
        
        return {
          content: response.data.choices[0].message.content,
          usage: response.data.usage,
          model: response.data.model
        };
      }
      
      throw new Error(`Unknown backend: ${backend}`);
      
    } catch (error) {
      this.logger.error('Completion execution failed', { 
        error: error.message, 
        model, 
        backend 
      });
      
      // Attempt fallback if configured
      if (this.config.global.fallback_on_error) {
        return this.executeFallback(routingDecision, messages);
      }
      
      throw error;
    }
  }

  /**
   * Execute fallback completion
   * 
   * @param {Object} failedDecision - Failed routing decision
   * @param {Array} messages - Chat messages
   * @returns {Object} Completion result
   */
  async executeFallback(failedDecision, messages) {
    const fallbackChain = this.config.global.fallback_chain || [];
    
    for (const fallbackModel of fallbackChain) {
      if (fallbackModel === failedDecision.model) continue;
      
      try {
        this.logger.info('Attempting fallback', { 
          from: failedDecision.model, 
          to: fallbackModel 
        });
        
        const backend = fallbackModel.startsWith('venice/') ? 'venice' : 'kimi';
        const decision = this.buildDecision(fallbackModel, 'fallback');
        
        return await this.executeCompletion(decision, messages);
        
      } catch (error) {
        this.logger.warn('Fallback failed', { 
          model: fallbackModel, 
          error: error.message 
        });
      }
    }
    
    throw new Error('All fallback models exhausted');
  }

  /**
   * Check if tool results should be cached
   * 
   * @param {string} tool - Tool name
   * @returns {boolean}
   */
  isCacheable(tool) {
    const cacheableTools = Object.keys(this.config.cost_optimization?.cache_ttl || {});
    return cacheableTools.includes(tool);
  }

  /**
   * Generate cache key for request
   * 
   * @param {string} tool - Tool name
   * @param {Object} params - Tool parameters
   * @param {Array} messages - Messages
   * @returns {string}
   */
  generateCacheKey(tool, params, messages) {
    const data = JSON.stringify({ tool, params, messages });
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

module.exports = ModelRouter;
