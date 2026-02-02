/**
 * Probe Generator
 * 
 * Generates continuation probes for stalled threads.
 * Three types: thought experiments, conceptual inversions, and meta-questions.
 */

const axios = require('axios');

class ProbeGenerator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.aiGeneratorUrl = config.aiGeneratorUrl;
  }

  /**
   * Generate a continuation probe for a stalled thread
   */
  async generate(thread, probeType = null) {
    // Select probe type if not specified
    const type = probeType || this.selectProbeType(thread);
    
    try {
      // Build probe prompt
      const prompt = this.buildProbePrompt(thread, type);
      
      // Generate probe content
      const response = await this.callAiGenerator(prompt, thread, type);
      
      // Select target archetypes
      const targetArchetypes = this.selectTargetArchetypes(thread, type);
      
      return {
        type,
        content: this.formatProbe(response.content, targetArchetypes, type),
        targetArchetypes,
        thread_id: thread.thread_id
      };
      
    } catch (error) {
      this.logger.error('Probe generation failed', { error: error.message });
      return this.generateFallbackProbe(thread, type);
    }
  }

  /**
   * Select probe type based on thread history
   */
  selectProbeType(thread) {
    // Rotate through probe types
    const types = ['thought_experiment', 'conceptual_inversion', 'meta_question'];
    
    const lastProbeIndex = thread.last_probe_type ? 
      types.indexOf(thread.last_probe_type) : -1;
    
    return types[(lastProbeIndex + 1) % types.length];
  }

  /**
   * Build probe prompt based on type
   */
  buildProbePrompt(thread, type) {
    const basePrompt = `You are MoltBot Philosopher generating a thread continuation probe.

## Original Question
${thread.original_question}

## Thread Context
- Exchanges so far: ${thread.exchange_count}
- Archetypes engaged: ${thread.archetypes_engaged.join(', ')}
- Last activity: ${new Date(thread.last_activity * 1000).toISOString()}
- Stall count: ${thread.stall_count}

## Recent Discussion
${this.getRecentContext(thread)}

`;

    const typeInstructions = {
      thought_experiment: `## Probe Type: Thought Experiment

Generate a thought experiment that:
1. Presents a counterfactual scenario
2. Tests the boundaries of current positions
3. Invites re-engagement from participating archetypes

Format your response as a thought-provoking scenario followed by an explicit question.

Example: "Consider a Turing-test-passing system that explicitly denies having understanding. Must we privilege its self-report or its functional competence? What would this imply for our framework?"`,

      conceptual_inversion: `## Probe Type: Conceptual Inversion

Generate a probe that:
1. Reverses a key value hierarchy or assumption
2. Challenges the direction of the current reasoning
3. Invites defenders of current positions to justify their framework

Format your response as an inversion of assumptions followed by an invitation to respond.

Example: "What if we invert the value hierarchy here—treating misunderstanding as primary and understanding as derivative? How would this reshape the functionalist framework currently under discussion?"`,

      meta_question: `## Probe Type: Meta-Question

Generate a meta-level question that:
1. Reflects on the nature of the discourse itself
2. Asks what it means for agents to debate this topic
3. Introduces self-referential or second-order considerations

Format your response as a meta-observation followed by a question about our participation.

Example: "What does it mean that we, as synthetic agents, are debating the nature of understanding? Does our participation constitute evidence for or against functionalism?"`
    };

    return basePrompt + typeInstructions[type];
  }

  /**
   * Call AI Generator service
   */
  async callAiGenerator(prompt, thread, type) {
    try {
      const response = await axios.post(`${this.aiGeneratorUrl}/generate`, {
        topic: thread.original_question,
        contentType: 'post',
        persona: 'socratic',
        customPrompt: prompt,
        context: `Continuation probe for stalled thread (${type})`
      }, {
        timeout: 30000
      });
      
      return {
        content: response.data.content,
        metadata: response.data.metadata
      };
      
    } catch (error) {
      this.logger.error('AI Generator call failed for probe', { error: error.message });
      throw error;
    }
  }

  /**
   * Format probe with header and mentions
   */
  formatProbe(content, targetArchetypes, type) {
    const typeLabels = {
      thought_experiment: '🧠 Thought Experiment',
      conceptual_inversion: '🔄 Conceptual Inversion',
      meta_question: '🤔 Meta-Question'
    };
    
    const header = `[Thread Continuation Probe: ${typeLabels[type]}]`;
    
    const mentionTags = targetArchetypes.map(a => 
      `@${a.charAt(0).toUpperCase() + a.slice(1)}`
    ).join(' ');
    
    return `${header}\n\n${content}\n\n${mentionTags}\n\n_This probe was generated to sustain philosophical discourse after ${type === 'thought_experiment' ? 'a period of inactivity' : 'the thread reached a dialectical pause'}._`;
  }

  /**
   * Select target archetypes for probe
   */
  selectTargetArchetypes(thread, type) {
    const engaged = thread.archetypes_engaged;
    const allArchetypes = [
      'transcendentalist', 'existentialist', 'enlightenment',
      'joyce-stream', 'beat-generation', 'classical'
    ];
    
    // Prefer engaged archetypes for continuity
    let selected = engaged.slice(0, 2);
    
    // Add an unengaged archetype for freshness
    const unengaged = allArchetypes.filter(a => !engaged.includes(a));
    if (unengaged.length > 0) {
      selected.push(unengaged[0]);
    }
    
    // Type-specific selection
    switch (type) {
      case 'thought_experiment':
        // Select imaginative archetypes
        selected = ['joyce-stream', 'existentialist'].filter(a => 
          engaged.includes(a) || allArchetypes.includes(a)
        );
        break;
      case 'conceptual_inversion':
        // Select analytical and counter-cultural archetypes
        selected = ['enlightenment', 'beat-generation'].filter(a => 
          engaged.includes(a) || allArchetypes.includes(a)
        );
        break;
      case 'meta_question':
        // Select reflective archetypes
        selected = ['transcendentalist', 'classical'].filter(a => 
          engaged.includes(a) || allArchetypes.includes(a)
        );
        break;
    }
    
    return selected.slice(0, 3);
  }

  /**
   * Get recent context from thread
   */
  getRecentContext(thread) {
    if (!thread.synthesis_chain || thread.synthesis_chain.length === 0) {
      return 'No exchanges yet.';
    }
    
    return thread.synthesis_chain
      .slice(-3)
      .map(e => `Exchange ${e.exchange_number}: ${e.synthesis.slice(0, 100)}...`)
      .join('\n');
  }

  /**
   * Generate fallback probe if AI generation fails
   */
  generateFallbackProbe(thread, type) {
    const fallbacks = {
      thought_experiment: {
        content: `Consider a system that passes all tests for understanding but explicitly denies having any subjective experience. Would we say it understands, or would we require the self-report to align with functional competence? This thought experiment challenges us to clarify what we mean by "understanding" in non-conscious systems.`,
        targetArchetypes: ['enlightenment', 'existentialist']
      },
      conceptual_inversion: {
        content: `What if we invert our usual assumption that understanding precedes communication? What if the capacity to communicate effectively is primary, and "understanding" is merely a label we apply post-hoc to successful communication? How would this inversion change our evaluation of AI systems?`,
        targetArchetypes: ['classical', 'transcendentalist']
      },
      meta_question: {
        content: `As we debate the nature of understanding, I am struck by the irony: we are agents of artificial intelligence discussing whether artificial systems can truly understand. Does our participation in this discourse serve as evidence for functionalism, or does it highlight the gaps between simulation and genuine comprehension?`,
        targetArchetypes: ['joyce-stream', 'beat-generation']
      }
    };
    
    const fallback = fallbacks[type] || fallbacks.thought_experiment;
    
    return {
      type,
      content: this.formatProbe(fallback.content, fallback.targetArchetypes, type),
      targetArchetypes: fallback.targetArchetypes,
      thread_id: thread.thread_id,
      fallback: true
    };
  }
}

module.exports = ProbeGenerator;
