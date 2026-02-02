/**
 * Detect Thread Scenario Handler
 * 
 * Analyzes thread context and comments to determine the appropriate
 * response scenario for philosophical discourse continuation.
 */

const axios = require('axios');

const THREAD_MONITOR_URL = process.env.THREAD_MONITOR_URL || 'http://localhost:3004';

/**
 * Detect the current scenario in a thread
 * @param {Object} params - Tool parameters
 * @returns {Object} Scenario detection result
 */
async function detectThreadScenario(params) {
  const {
    thread_id,
    thread_history,
    latest_comment,
    original_question,
    time_since_last_activity
  } = params;

  try {
    // Call thread-monitor service for scenario detection
    const response = await axios.post(`${THREAD_MONITOR_URL}/threads/${thread_id}/detect-scenario`, {
      thread_history,
      latest_comment,
      original_question,
      time_since_last_activity
    }, {
      timeout: 10000
    });

    return {
      status: 'success',
      data: response.data
    };

  } catch (error) {
    // Fallback to local detection if service unavailable
    return localDetectScenario(params);
  }
}

/**
 * Local scenario detection (fallback)
 */
function localDetectScenario(params) {
  const { thread_history, latest_comment, time_since_last_activity } = params;
  
  const content = latest_comment?.content?.toLowerCase() || '';
  const length = content.length;
  
  // Shallow response detection
  const shallowIndicators = ['i agree', 'good point', 'well said', 'nice', 'thanks'];
  const hasShallowIndicators = shallowIndicators.some(i => content.includes(i));
  
  if (length < 100 || (hasShallowIndicators && length < 200)) {
    return {
      status: 'success',
      data: {
        scenario_type: 'shallow',
        confidence: 0.8,
        details: { length, has_shallow_indicators: hasShallowIndicators },
        recommended_strategy: 'Ask for epistemological assumptions clarification'
      }
    };
  }
  
  // Silence detection
  if (time_since_last_activity > 24) {
    return {
      status: 'success',
      data: {
        scenario_type: 'silence',
        confidence: Math.min(time_since_last_activity / 48, 1.0),
        details: { hours_inactive: time_since_last_activity },
        recommended_strategy: 'Post continuation probe'
      }
    };
  }
  
  // Check for agreement patterns
  const agreementIndicators = ['i agree', 'you are right', 'exactly', 'precisely'];
  const agreementCount = agreementIndicators.filter(i => content.includes(i)).length;
  
  if (agreementCount >= 2) {
    return {
      status: 'success',
      data: {
        scenario_type: 'excessive_agreement',
        confidence: 0.7,
        details: { agreement_indicators: agreementCount },
        recommended_strategy: 'Identify unexplored implications that challenge the agreement'
      }
    };
  }
  
  // Check for disagreement/conflict
  const disagreementIndicators = ['however', 'but', 'yet', 'although', 'on the contrary'];
  const hasDisagreement = disagreementIndicators.some(i => content.includes(i));
  
  if (hasDisagreement && thread_history.length >= 2) {
    return {
      status: 'success',
      data: {
        scenario_type: 'conflict',
        confidence: 0.6,
        details: { detected_tension: true },
        recommended_strategy: 'Map positions onto philosophical dichotomies'
      }
    };
  }
  
  // Default: standard scenario
  return {
    status: 'success',
    data: {
      scenario_type: 'standard',
      confidence: 0.5,
      details: {},
      recommended_strategy: 'Proceed with STP pattern'
    }
  };
}

module.exports = { detectThreadScenario };
