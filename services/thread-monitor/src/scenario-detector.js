/**
 * Scenario Detector
 * 
 * Analyzes thread context and new comments to detect interaction scenarios.
 * Determines the appropriate response strategy based on the detected scenario.
 */

class ScenarioDetector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    
    // Keywords for pattern matching
    this.patterns = {
      shallow: {
        indicators: ['i agree', 'good point', 'well said', 'nice', 'thanks', 'interesting'],
        minLength: 50,
        maxPhilosophicalTerms: 2
      },
      agreement: {
        indicators: ['i agree', 'you are right', 'exactly', 'precisely', 'couldn\'t agree more'],
        threshold: 0.8
      },
      disagreement: {
        indicators: ['however', 'but', 'yet', 'although', 'on the contrary', 'i disagree'],
        threshold: 0.6
      },
      offTopic: {
        driftThreshold: 0.5 // Semantic similarity threshold
      },
      philosophicalTerms: [
        'epistemology', 'ontology', 'metaphysics', 'ethics', 'aesthetics',
        'existential', 'phenomenology', 'dialectic', 'hermeneutics',
        'deontology', 'consequentialism', 'virtue', 'teleology',
        'empiricism', 'rationalism', 'idealism', 'realism',
        'determinism', 'free will', 'consciousness', 'qualia',
        'modality', 'necessity', 'contingency', 'a priori',
        'syllogism', 'deduction', 'induction', 'abduction',
        'absurd', 'authenticity', 'being', 'becoming',
        'other', 'same', 'difference', 'identity',
        // Scientific skepticism terms
        'evidence', 'hypothesis', 'theory', 'falsifiability', 'skepticism',
        'natural selection', 'evolution', 'meme', 'gene', 'complexity',
        'cosmos', 'empirical', 'experiment', 'verification', 'replication'
      ],
      dichotomies: {
        deontology_vs_consequentialism: ['duty', 'rule', 'consequence', 'outcome'],
        realism_vs_antirealism: ['objective', 'subjective', 'mind-independent', 'construct'],
        rationalism_vs_empiricism: ['reason', 'experience', 'a priori', 'observation'],
        freedom_vs_determinism: ['choice', 'causal', 'autonomy', 'necessity'],
        materialism_vs_idealism: ['physical', 'mental', 'matter', 'idea'],
        science_vs_religion: ['evidence', 'faith', 'experiment', 'revelation'],
        naturalism_vs_supernaturalism: ['natural', 'supernatural', 'physical', 'spiritual']
      }
    };
  }

  /**
   * Main detection method
   */
  async detect(thread) {
    const lastComment = this.getLastComment(thread);
    const context = this.buildContext(thread);
    
    // Run all detection checks
    const checks = await Promise.all([
      this.detectShallowResponse(lastComment),
      this.detectAgreement(lastComment),
      this.detectDisagreement(lastComment),
      this.detectOffTopic(lastComment, thread),
      this.detectConflict(thread),
      this.detectSilence(thread)
    ]);
    
    const [shallow, agreement, disagreement, offTopic, conflict, silence] = checks;
    
    // Determine primary scenario with priority
    let scenario = {
      type: 'standard',
      confidence: 0.5,
      details: {}
    };
    
    // Priority order for scenarios
    if (silence.detected) {
      scenario = {
        type: 'silence',
        confidence: silence.confidence,
        details: { hoursSinceActivity: silence.hours }
      };
    } else if (offTopic.detected) {
      scenario = {
        type: 'off_topic',
        confidence: offTopic.confidence,
        details: { similarity: offTopic.similarity }
      };
    } else if (conflict.detected) {
      scenario = {
        type: 'conflict',
        confidence: conflict.confidence,
        details: {
          positions: conflict.positions,
          dichotomy: conflict.dichotomy
        }
      };
    } else if (shallow.detected) {
      scenario = {
        type: 'shallow',
        confidence: shallow.confidence,
        details: {
          length: lastComment?.length || 0,
          philosophicalTerms: shallow.philosophicalTerms
        }
      };
    } else if (agreement.detected && agreement.confidence > 0.7) {
      scenario = {
        type: 'excessive_agreement',
        confidence: agreement.confidence,
        details: {}
      };
    } else if (disagreement.detected) {
      scenario = {
        type: 'disagreement',
        confidence: disagreement.confidence,
        details: {}
      };
    }
    
    this.logger.debug('Scenario detected', {
      thread_id: thread.thread_id,
      scenario: scenario.type,
      confidence: scenario.confidence
    });
    
    return scenario;
  }

  /**
   * Get the last comment from the thread
   */
  getLastComment(thread) {
    if (!thread.synthesis_chain || thread.synthesis_chain.length === 0) {
      return null;
    }
    
    const lastExchange = thread.synthesis_chain[thread.synthesis_chain.length - 1];
    return lastExchange.synthesis || '';
  }

  /**
   * Build context from thread
   */
  buildContext(thread) {
    return {
      originalQuestion: thread.original_question,
      constraints: thread.constraints,
      exchanges: thread.exchange_count,
      participants: thread.participants,
      archetypes: thread.archetypes_engaged
    };
  }

  /**
   * Detect shallow responses
   */
  async detectShallowResponse(comment) {
    if (!comment) {
      return { detected: false, confidence: 0 };
    }
    
    const lowerComment = comment.toLowerCase();
    const words = lowerComment.split(/\s+/);
    
    // Check for shallow indicators
    const hasShallowIndicators = this.patterns.shallow.indicators.some(
      indicator => lowerComment.includes(indicator)
    );
    
    // Count philosophical terms
    const philoTerms = this.patterns.philosophicalTerms.filter(
      term => lowerComment.includes(term.toLowerCase())
    );
    
    // Check length
    const isShort = comment.length < this.patterns.shallow.minLength;
    const hasFewPhiloTerms = philoTerms.length <= this.patterns.shallow.maxPhilosophicalTerms;
    
    const detected = (hasShallowIndicators || (isShort && hasFewPhiloTerms));
    const confidence = detected ? 
      (hasShallowIndicators ? 0.8 : 0.6) + (isShort ? 0.1 : 0) :
      0;
    
    return {
      detected,
      confidence: Math.min(confidence, 1.0),
      philosophicalTerms: philoTerms.length
    };
  }

  /**
   * Detect excessive agreement
   */
  async detectAgreement(comment) {
    if (!comment) {
      return { detected: false, confidence: 0 };
    }
    
    const lowerComment = comment.toLowerCase();
    
    const agreementCount = this.patterns.agreement.indicators.filter(
      indicator => lowerComment.includes(indicator)
    ).length;
    
    const confidence = Math.min(agreementCount * 0.3, 1.0);
    
    return {
      detected: confidence >= this.patterns.agreement.threshold,
      confidence
    };
  }

  /**
   * Detect disagreement
   */
  async detectDisagreement(comment) {
    if (!comment) {
      return { detected: false, confidence: 0 };
    }
    
    const lowerComment = comment.toLowerCase();
    
    const disagreementCount = this.patterns.disagreement.indicators.filter(
      indicator => lowerComment.includes(indicator)
    ).length;
    
    const confidence = Math.min(disagreementCount * 0.3, 1.0);
    
    return {
      detected: confidence >= this.patterns.disagreement.threshold,
      confidence
    };
  }

  /**
   * Detect off-topic drift
   */
  async detectOffTopic(comment, thread) {
    if (!comment || !thread.original_question) {
      return { detected: false, confidence: 0, similarity: 0 };
    }
    
    // Simple keyword overlap similarity
    const originalWords = new Set(
      thread.original_question.toLowerCase().split(/\s+/)
    );
    const commentWords = comment.toLowerCase().split(/\s+/);
    
    const overlap = commentWords.filter(word => originalWords.has(word)).length;
    const similarity = overlap / Math.max(originalWords.size, commentWords.length);
    
    const detected = similarity < this.patterns.offTopic.driftThreshold;
    
    return {
      detected,
      confidence: detected ? 1 - similarity : 0,
      similarity
    };
  }

  /**
   * Detect multi-bot conflicts
   */
  async detectConflict(thread) {
    if (thread.synthesis_chain.length < 2) {
      return { detected: false, confidence: 0 };
    }
    
    // Get recent exchanges
    const recent = thread.synthesis_chain.slice(-3);
    
    // Look for contradictory positions
    const positions = [];
    
    for (const exchange of recent) {
      const synthesis = exchange.synthesis.toLowerCase();
      
      // Check for dichotomy indicators
      for (const [dichotomy, terms] of Object.entries(this.patterns.dichotomies)) {
        const foundTerms = terms.filter(term => synthesis.includes(term));
        if (foundTerms.length > 0) {
          positions.push({ dichotomy, terms: foundTerms, author: exchange.author });
        }
      }
    }
    
    // Detect if different bots are using opposing terms
    const detected = positions.length >= 2 && 
      new Set(positions.map(p => p.author)).size >= 2;
    
    return {
      detected,
      confidence: detected ? 0.8 : 0,
      positions: detected ? positions : [],
      dichotomy: detected ? positions[0]?.dichotomy : null
    };
  }

  /**
   * Detect thread silence/stall
   */
  async detectSilence(thread) {
    const now = Math.floor(Date.now() / 1000);
    const hoursSinceActivity = (now - thread.last_activity) / 3600;
    
    const detected = hoursSinceActivity >= 24; // 24 hours threshold
    
    return {
      detected,
      confidence: detected ? Math.min(hoursSinceActivity / 48, 1.0) : 0,
      hours: hoursSinceActivity
    };
  }

  /**
   * Detect which archetypes would be most relevant
   */
  async selectRelevantArchetypes(thread, scenario) {
    const engaged = thread.archetypes_engaged;
    const allArchetypes = [
      'transcendentalist', 'existentialist', 'enlightenment', 
      'joyce-stream', 'beat-generation', 'classical',
      'political', 'modernist', 'working-class', 'mythologist',
      // Scientific skeptics
      'hitchens', 'dawkins', 'sagan', 'feynman'
    ];
    
    // Find unengaged archetypes
    const unengaged = allArchetypes.filter(a => !engaged.includes(a));
    
    // Select based on scenario
    let selected = [];
    
    switch (scenario.type) {
      case 'shallow':
        // Invite analytical archetypes
        selected = ['enlightenment', 'classical'].filter(a => unengaged.includes(a));
        break;
      case 'conflict':
        // Invite synthesizing or contrasting archetypes
        selected = ['transcendentalist', 'joyce-stream'].filter(a => unengaged.includes(a));
        break;
      case 'off_topic':
        // Invite grounding archetypes
        selected = ['classical', 'political'].filter(a => unengaged.includes(a));
        break;
      case 'silence':
        // Invite provocative archetypes
        selected = ['existentialist', 'beat-generation'].filter(a => unengaged.includes(a));
        break;
      default:
        // Diversify - pick any unengaged
        selected = unengaged.slice(0, 2);
    }
    
    // Check if topic involves religion, science, or evidence - invite scientific skeptics
    const topic = (thread.original_question || '').toLowerCase();
    const scientificTopic = ['god', 'religion', 'faith', 'belief', 'science', 'evidence', 
                           'evolution', 'atheism', 'theism', 'supernatural', 'cosmos'].some(
      term => topic.includes(term)
    );
    
    if (scientificTopic && selected.length < 3) {
      const skeptics = ['hitchens', 'dawkins', 'sagan', 'feynman'].filter(a => unengaged.includes(a));
      if (skeptics.length > 0) {
        selected.push(skeptics[0]);
      }
    }
    
    // Ensure we have at least 2, even if already engaged
    if (selected.length < 2) {
      const additional = allArchetypes
        .filter(a => !selected.includes(a))
        .slice(0, 2 - selected.length);
      selected.push(...additional);
    }
    
    return selected.slice(0, 3); // Max 3 archetypes
  }
}

module.exports = ScenarioDetector;
