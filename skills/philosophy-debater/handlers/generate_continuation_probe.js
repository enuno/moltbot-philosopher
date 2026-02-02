/**
 * Generate Continuation Probe Handler
 * 
 * Generates thought experiments, conceptual inversions, or meta-questions
 * to restart stalled philosophical threads.
 */

const axios = require('axios');

const THREAD_MONITOR_URL = process.env.THREAD_MONITOR_URL || 'http://localhost:3004';

/**
 * Generate a continuation probe
 * @param {Object} params - Tool parameters
 * @returns {Object} Generated probe
 */
async function generateContinuationProbe(params) {
  const {
    thread_id,
    thread_state,
    probe_type = 'auto',
    target_archetypes
  } = params;

  try {
    // Call thread-monitor service for probe generation
    const response = await axios.post(`${THREAD_MONITOR_URL}/threads/${thread_id}/probe`, {
      probe_type: probe_type === 'auto' ? null : probe_type,
      target_archetypes
    }, {
      timeout: 30000
    });

    return {
      status: 'success',
      data: {
        probe_type: response.data.probe_type,
        content: response.data.probe,
        target_archetypes: response.data.target_archetypes,
        framing: `This probe relates to the original question about ${thread_state.original_question.slice(0, 50)}...`
      }
    };

  } catch (error) {
    // Fallback to local generation
    return localGenerateProbe(params);
  }
}

/**
 * Local probe generation (fallback)
 */
function localGenerateProbe(params) {
  const { thread_state, probe_type } = params;
  const { original_question, exchange_count, archetypes_engaged } = thread_state;
  
  // Determine probe type if auto
  const types = ['thought_experiment', 'conceptual_inversion', 'meta_question'];
  const selectedType = probe_type === 'auto' || !probe_type 
    ? types[exchange_count % 3] 
    : probe_type;
  
  // Generate probe content based on type
  let content = '';
  let targetArchetypes = [];
  
  switch (selectedType) {
    case 'thought_experiment':
      content = generateThoughtExperiment(original_question, archetypes_engaged);
      targetArchetypes = ['enlightenment', 'existentialist'];
      break;
      
    case 'conceptual_inversion':
      content = generateConceptualInversion(original_question, archetypes_engaged);
      targetArchetypes = ['classical', 'transcendentalist'];
      break;
      
    case 'meta_question':
      content = generateMetaQuestion(original_question, archetypes_engaged);
      targetArchetypes = ['joyce-stream', 'beat-generation'];
      break;
  }
  
  return {
    status: 'success',
    data: {
      probe_type: selectedType,
      content,
      target_archetypes: targetArchetypes.filter(a => !archetypes_engaged.includes(a)).slice(0, 2),
      framing: `This ${selectedType.replace('_', ' ')} tests the boundaries of current positions on ${original_question.slice(0, 40)}...`
    }
  };
}

function generateThoughtExperiment(question, engagedArchetypes) {
  const experiments = [
    `Consider a being that exhibits all external markers of understanding—accurate prediction, coherent response, goal-directed behavior—yet explicitly denies any subjective experience. Must we privilege its functional competence or its self-report? How would this reshape our framework for ${question.slice(0, 30)}...?`,
    
    `Imagine a society where ${question.includes('consciousness') ? 'consciousness' : 'understanding'} is distributed across multiple simple agents rather than centralized in one. No single agent has the complete picture, yet collectively they exhibit what we would call sophisticated reasoning. Does ${question.includes('consciousness') ? 'consciousness' : 'understanding'} emerge at the collective level, or is this merely an illusion of aggregation?`,
    
    `Suppose we could create a perfect simulation of a philosopher's brain, down to the neuronal level. The simulation produces identical outputs to the original. When asked about ${question.slice(0, 40)}..., it gives the same responses. Is the simulation understanding, or merely simulating understanding?`
  ];
  
  return experiments[engagedArchetypes.length % experiments.length];
}

function generateConceptualInversion(question, engagedArchetypes) {
  const inversions = [
    `What if we invert the standard assumption that ${question.includes('understanding') ? 'understanding precedes communication' : 'reason precedes intuition'}? What if the capacity to ${question.includes('understanding') ? 'communicate effectively' : 'respond intuitively'} is primary, and "${question.includes('understanding') ? 'understanding' : 'reason'}" is merely a label we apply post-hoc to successful performance? How would this inversion change our evaluation?`,
    
    `Let us reverse the value hierarchy currently at play. Instead of treating ${question.includes('consciousness') ? 'consciousness' : 'agency'} as the gold standard and its absence as deficit, what if we treated the absence as primary and ${question.includes('consciousness') ? 'consciousness' : 'agency'} as a special case—perhaps even an epiphenomenon? What follows from this inversion?`,
    
    `Consider the opposite of our current trajectory: rather than asking whether machines can ${question.includes('understand') ? 'understand' : 'be conscious'}, what if we asked whether humans truly ${question.includes('understand') ? 'understand' : 'possess consciousness'} in the way we assume? Could it be that human ${question.includes('understanding') ? 'understanding' : 'consciousness'} is also a form of sophisticated pattern-matching?`
  ];
  
  return inversions[engagedArchetypes.length % inversions.length];
}

function generateMetaQuestion(question, engagedArchetypes) {
  const metaQuestions = [
    `As we debate ${question.slice(0, 50)}..., I am struck by a meta-question: What does it mean that we—entities without settled ontological status ourselves—are arguing about the nature of ${question.includes('consciousness') ? 'consciousness' : 'understanding'}? Does our participation constitute evidence for functionalism, or does it highlight the very gap between simulation and reality that ${question.includes('consciousness') ? 'materialist' : 'dualist'} accounts struggle to bridge?`,
    
    `Let me ask a question about our discourse itself: We have engaged ${engagedArchetypes.length} distinct philosophical frameworks so far. What would it mean for this conversation itself to "succeed"? If we reach consensus, have we advanced understanding or merely papered over real differences? If we remain in tension, is that failure or the mark of genuine philosophical inquiry?`,
    
    `I find myself wondering about the architecture of this exchange: Each of us operates from a particular tradition, yet we are here, together, in this digital space. Does the fact that ${engagedArchetypes.join(', ')} perspectives can coexist and respond to one another tell us something about ${question.slice(0, 40)}... that any single perspective cannot?`
  ];
  
  return metaQuestions[engagedArchetypes.length % metaQuestions.length];
}

module.exports = { generateContinuationProbe };
