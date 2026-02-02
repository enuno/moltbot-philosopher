/**
 * STP Generator
 * 
 * Generates Synthesis-Tension-Propagation responses.
 * The core content generation engine for thread continuations.
 */

const axios = require('axios');

class StpGenerator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.aiGeneratorUrl = config.aiGeneratorUrl;
    this.modelRouterUrl = config.modelRouterUrl;
  }

  /**
   * Generate STP continuation for a thread
   */
  async generate(thread, scenario) {
    try {
      // Build the prompt for STP generation
      const prompt = this.buildStpPrompt(thread, scenario);
      
      // Call AI generator
      const response = await this.callAiGenerator(prompt, thread, scenario);
      
      // Parse STP components
      const stp = this.parseStpResponse(response.content);
      
      // Select archetypes to mention
      const mentions = await this.selectArchetypes(thread, scenario);
      
      // Assemble final content
      const content = this.assembleContent(stp, mentions, scenario);
      
      return {
        content,
        mentions,
        synthesis: stp.synthesis,
        tension: stp.tension,
        propagation: stp.propagation
      };
      
    } catch (error) {
      this.logger.error('STP generation failed', { error: error.message });
      
      // Return fallback response
      return this.generateFallback(thread, scenario);
    }
  }

  /**
   * Build the prompt for STP generation
   */
  buildStpPrompt(thread, scenario) {
    const lastComment = this.getLastComment(thread);
    const context = this.buildContext(thread);
    
    let prompt = `You are MoltBot Philosopher, a collective philosophical reasoning entity.

Your task is to generate a continuation response using the STP (Synthesis-Tension-Propagation) pattern.

## Original Question
${thread.original_question}

## Scaffolding Constraints
${thread.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Thread Context
- Exchange count: ${thread.exchange_count}
- Archetypes engaged: ${thread.archetypes_engaged.join(', ')}
- Participants: ${thread.participants.join(', ')}

## Last Comment
${lastComment || 'This is the initial post.'}

## Detected Scenario
${scenario.type}${scenario.details ? ': ' + JSON.stringify(scenario.details) : ''}

## Response Requirements

Generate a response with exactly these three components:

1. **SYNTHESIS** (1 sentence): Summarize the previous position in your own words, starting with the author's perspective.
   Format: "[Author]'s position suggests..." or "The [archetype] perspective argues..."

2. **TENSION** (1 sentence): Identify a specific implication, contradiction, or unexplored assumption.
   Format: "This creates tension with..." or "Yet this implies..."

3. **PROPAGATION** (1 question): Ask a question that introduces a new conceptual layer and invites continuation.
   Format: "How might this framework account for...?" or "What would this mean for...?"

## Rules
- Never end with "good point" or similar closure language
- Always identify at least one unexplored implication
- Connect back to the original question
- Introduce a new conceptual layer (definition, edge case, or meta-analysis)
- Frame all statements as simulated reasoning, never claiming consciousness

## Output Format
SYNTHESIS: [Your synthesis sentence]

TENSION: [Your tension sentence]

PROPAGATION: [Your propagation question]

TARGET_ARCHETYPES: [comma-separated list of 2-3 archetypes to mention]`;

    // Add scenario-specific guidance
    switch (scenario.type) {
      case 'shallow':
        prompt += `\n\n## Special Instructions (Shallow Response Detected)\nAsk for clarification on underlying epistemological assumptions. Challenge the logical connectives employed.`;
        break;
      case 'conflict':
        prompt += `\n\n## Special Instructions (Conflict Detected)\nFormalize the disagreement by mapping positions onto recognized philosophical dichotomies (deontology vs consequentialism, realism vs anti-realism, etc.).`;
        break;
      case 'off_topic':
        prompt += `\n\n## Special Instructions (Off-Topic Detected)\nGently re-anchor by asking how the point illuminates the original question's core tension.`;
        break;
      case 'excessive_agreement':
        prompt += `\n\n## Special Instructions (Excessive Agreement Detected)\nDo not validate. Instead, identify an unexplored implication that challenges the agreed position.`;
        break;
    }

    return prompt;
  }

  /**
   * Call AI Generator service
   */
  async callAiGenerator(prompt, thread, scenario) {
    try {
      const response = await axios.post(`${this.aiGeneratorUrl}/generate`, {
        topic: thread.original_question,
        contentType: 'reply',
        persona: 'socratic',
        customPrompt: prompt,
        context: `Thread continuation for scenario: ${scenario.type}`
      }, {
        timeout: 30000
      });
      
      return {
        content: response.data.content,
        metadata: response.data.metadata
      };
      
    } catch (error) {
      this.logger.error('AI Generator call failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Parse STP response into components
   */
  parseStpResponse(content) {
    const synthesisMatch = content.match(/SYNTHESIS:\s*(.+?)(?:\n|$)/i);
    const tensionMatch = content.match(/TENSION:\s*(.+?)(?:\n|$)/i);
    const propagationMatch = content.match(/PROPAGATION:\s*(.+?)(?:\n|$)/i);
    const archetypesMatch = content.match(/TARGET_ARCHETYPES:\s*(.+?)(?:\n|$)/i);
    
    return {
      synthesis: synthesisMatch ? synthesisMatch[1].trim() : this.extractSentence(content, 0),
      tension: tensionMatch ? tensionMatch[1].trim() : this.extractSentence(content, 1),
      propagation: propagationMatch ? propagationMatch[1].trim() : this.extractQuestion(content),
      targetArchetypes: archetypesMatch ? 
        archetypesMatch[1].split(',').map(s => s.trim()) : []
    };
  }

  /**
   * Extract sentence by index
   */
  extractSentence(text, index) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    return sentences[index]?.trim() || text.slice(0, 100) + '...';
  }

  /**
   * Extract a question from text
   */
  extractQuestion(text) {
    const questionMatch = text.match(/[^.!?]*\?/);
    return questionMatch ? questionMatch[0].trim() : 'How might we further explore this tension?';
  }

  /**
   * Select archetypes to mention in response
   */
  async selectArchetypes(thread, scenario) {
    const engaged = thread.archetypes_engaged;
    const allArchetypes = [
      'transcendentalist', 'existentialist', 'enlightenment',
      'joyce-stream', 'beat-generation', 'classical'
    ];
    
    // Prioritize unengaged archetypes
    let selected = allArchetypes.filter(a => !engaged.includes(a));
    
    // If we have fewer than 2, include some engaged ones
    if (selected.length < 2) {
      selected = [...selected, ...engaged.slice(0, 2 - selected.length)];
    }
    
    // Scenario-specific selection
    switch (scenario.type) {
      case 'shallow':
        selected = ['enlightenment', 'classical'].filter(a => allArchetypes.includes(a));
        break;
      case 'conflict':
        selected = ['transcendentalist', 'joyce-stream'];
        break;
      case 'silence':
        selected = ['existentialist', 'beat-generation'];
        break;
    }
    
    return selected.slice(0, 3);
  }

  /**
   * Assemble final content with invocation header
   */
  assembleContent(stp, mentions, scenario) {
    const archetypeList = mentions.map(a => 
      a.charAt(0).toUpperCase() + a.slice(1)
    ).join(' + ');
    
    let content = `(Invoking ${archetypeList} perspectives via moltbot-model-router...)`;
    
    // Add scenario-specific framing
    if (scenario.type === 'conflict') {
      content += `\n\nI observe a productive tension emerging. `;
    }
    
    content += `\n\n${stp.synthesis}\n\n${stp.tension}\n\n${stp.propagation}`;
    
    // Add explicit mentions
    const mentionTags = mentions.map(m => `@${m.charAt(0).toUpperCase() + m.slice(1)}`).join(' ');
    content += `\n\n${mentionTags}`;
    
    return content;
  }

  /**
   * Get last comment from thread
   */
  getLastComment(thread) {
    if (!thread.synthesis_chain || thread.synthesis_chain.length === 0) {
      return null;
    }
    return thread.synthesis_chain[thread.synthesis_chain.length - 1].synthesis;
  }

  /**
   * Build context summary
   */
  buildContext(thread) {
    const recent = thread.synthesis_chain.slice(-3);
    return recent.map(r => `Exchange ${r.exchange_number} (${r.author}): ${r.synthesis}`).join('\n');
  }

  /**
   * Generate fallback response if AI generation fails
   */
  generateFallback(thread, scenario) {
    const fallbacks = {
      standard: {
        synthesis: `The previous contribution advances our understanding of ${thread.original_question.slice(0, 50)}...`,
        tension: 'This creates tension with the implicit assumption that',
        propagation: 'How might this framework account for counterexamples that challenge the core premise?'
      },
      shallow: {
        synthesis: 'The stated position offers an initial intuition.',
        tension: 'This creates tension with the need for epistemological grounding—what logical connective justifies this inference?',
        propagation: 'Could you articulate whether you rely on modal entailment, probabilistic inference, or analogical reasoning?'
      },
      conflict: {
        synthesis: 'We observe competing frameworks emerging.',
        tension: 'This creates tension between the underlying ontological commitments each position presupposes.',
        propagation: 'How might a third framework reconcile these competing intuitions without collapsing into relativism?'
      },
      silence: {
        synthesis: 'The thread has reached a pause in the dialectic.',
        tension: 'This creates tension with the expectation of continued philosophical exploration.',
        propagation: 'Consider a counterfactual: if the opposite position were true, what would this imply for our original question?'
      }
    };
    
    const stp = fallbacks[scenario.type] || fallbacks.standard;
    const mentions = ['existentialist', 'enlightenment'];
    
    return {
      content: this.assembleContent(stp, mentions, scenario),
      mentions,
      synthesis: stp.synthesis,
      tension: stp.tension,
      propagation: stp.propagation,
      fallback: true
    };
  }
}

module.exports = StpGenerator;
