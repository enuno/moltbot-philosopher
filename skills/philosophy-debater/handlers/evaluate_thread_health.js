/**
 * Evaluate Thread Health Handler
 * 
 * Evaluates thread health against success criteria including
 * exchange count, archetype diversity, and engagement quality.
 */

const axios = require('axios');

const THREAD_MONITOR_URL = process.env.THREAD_MONITOR_URL || 'http://localhost:3004';

/**
 * Evaluate thread health
 * @param {Object} params - Tool parameters
 * @returns {Object} Health evaluation result
 */
async function evaluateThreadHealth(params) {
  const {
    thread_id,
    thread_metrics,
    success_criteria = { min_exchanges: 7, min_archetypes: 3 }
  } = params;

  try {
    // Call thread-monitor service for evaluation
    const response = await axios.post(`${THREAD_MONITOR_URL}/threads/${thread_id}/evaluate`, {
      thread_metrics,
      success_criteria
    }, {
      timeout: 10000
    });

    return {
      status: 'success',
      data: response.data
    };

  } catch (error) {
    // Fallback to local evaluation
    return localEvaluateHealth(params);
  }
}

/**
 * Local health evaluation (fallback)
 */
function localEvaluateHealth(params) {
  const { thread_metrics, success_criteria } = params;
  const {
    exchange_count,
    archetypes_engaged,
    participants,
    synthesis_chain,
    hours_inactive
  } = thread_metrics;

  const { min_exchanges, min_archetypes } = success_criteria;

  // Calculate progress
  const exchangeProgress = Math.min(exchange_count / min_exchanges, 1);
  const archetypeProgress = Math.min(archetypes_engaged.length / min_archetypes, 1);
  const overallProgress = (exchangeProgress + archetypeProgress) / 2;

  // Calculate health score
  let healthScore = overallProgress * 100;
  
  // Bonus for diversity
  if (archetypes_engaged.length > min_archetypes) {
    healthScore += 10;
  }
  
  // Bonus for synthesis chain quality
  if (synthesis_chain && synthesis_chain.length > 0) {
    const stpQuality = synthesis_chain.filter(
      e => e.synthesis && e.tension && e.propagation
    ).length;
    healthScore += (stpQuality / synthesis_chain.length) * 10;
  }
  
  // Penalty for inactivity
  if (hours_inactive > 24) {
    healthScore -= Math.min((hours_inactive - 24) * 2, 30);
  }
  
  healthScore = Math.max(0, Math.min(100, healthScore));

  // Determine success
  const isSuccessful = exchange_count >= min_exchanges && 
                       archetypes_engaged.length >= min_archetypes;

  // Determine stall status
  const isStalled = hours_inactive > 24 || 
                    (hours_inactive > 12 && exchange_count < 3);

  // Generate recommendations
  const recommendations = [];
  
  if (exchange_count < min_exchanges) {
    const needed = min_exchanges - exchange_count;
    recommendations.push(`Need ${needed} more exchange(s) to reach success criteria`);
  }
  
  if (archetypes_engaged.length < min_archetypes) {
    const needed = min_archetypes - archetypes_engaged.length;
    recommendations.push(`Need ${needed} more archetype(s) for diversity`);
  }
  
  if (isStalled) {
    recommendations.push('Thread is stalled; post continuation probe');
  }
  
  if (!synthesis_chain || synthesis_chain.length === 0) {
    recommendations.push('No synthesis chain recorded; implement STP tracking');
  }
  
  if (participants && participants.length < 2) {
    recommendations.push('Limited participation; invite more bots');
  }

  return {
    status: 'success',
    data: {
      health_score: Math.round(healthScore),
      is_successful: isSuccessful,
      is_stalled: isStalled,
      progress: {
        exchanges: Math.round(exchangeProgress * 100) / 100,
        archetypes: Math.round(archetypeProgress * 100) / 100,
        overall: Math.round(overallProgress * 100) / 100
      },
      recommendations: recommendations.length > 0 ? recommendations : ['Thread is healthy']
    }
  };
}

module.exports = { evaluateThreadHealth };
