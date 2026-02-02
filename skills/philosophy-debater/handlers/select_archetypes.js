/**
 * Select Archetypes Handler
 * 
 * Selects philosopher archetypes most relevant to continue a thread,
 * ensuring diversity and productive philosophical friction.
 */

const axios = require('axios');

const THREAD_MONITOR_URL = process.env.THREAD_MONITOR_URL || 'http://localhost:3004';

/**
 * Select relevant archetypes for thread continuation
 * @param {Object} params - Tool parameters
 * @returns {Object} Selected archetypes
 */
async function selectArchetypes(params) {
  const {
    thread_tension,
    engaged_archetypes,
    scenario_type,
    available_philosophers,
    max_selection = 2
  } = params;

  try {
    // Call thread-monitor service for archetype selection
    const response = await axios.post(`${THREAD_MONITOR_URL}/philosophers/select`, {
      thread_tension,
      engaged_archetypes,
      scenario_type,
      available_philosophers,
      max_selection
    }, {
      timeout: 10000
    });

    return {
      status: 'success',
      data: response.data
    };

  } catch (error) {
    // Fallback to local selection
    return localSelectArchetypes(params);
  }
}

/**
 * Local archetype selection (fallback)
 */
function localSelectArchetypes(params) {
  const { thread_tension, engaged_archetypes, scenario_type, max_selection } = params;
  
  const allArchetypes = [
    'transcendentalist', 'existentialist', 'enlightenment',
    'joyce-stream', 'beat-generation', 'classical',
    'political', 'modernist', 'working-class', 'mythologist'
  ];
  
  // Find unengaged archetypes
  let unengaged = allArchetypes.filter(a => !engaged_archetypes.includes(a));
  
  // Scenario-specific selection
  let selected = [];
  let reasoning = '';
  
  switch (scenario_type) {
    case 'shallow':
      selected = ['enlightenment', 'classical'].filter(a => unengaged.includes(a));
      reasoning = 'Selected analytical archetypes to deepen epistemological inquiry';
      break;
      
    case 'conflict':
      selected = ['transcendentalist', 'joyce-stream'].filter(a => unengaged.includes(a));
      reasoning = 'Selected synthesizing archetypes to bridge conflicting positions';
      break;
      
    case 'off_topic':
      selected = ['classical', 'political'].filter(a => unengaged.includes(a));
      reasoning = 'Selected grounding archetypes to re-anchor discussion';
      break;
      
    case 'silence':
      selected = ['existentialist', 'beat-generation'].filter(a => unengaged.includes(a));
      reasoning = 'Selected provocative archetypes to restart discourse';
      break;
      
    case 'excessive_agreement':
      selected = ['nietzschean', 'beat-generation'].filter(a => unengaged.includes(a));
      reasoning = 'Selected challenging archetypes to introduce productive friction';
      break;
      
    default:
      // Diversify - pick unengaged archetypes
      selected = unengaged.slice(0, max_selection);
      reasoning = 'Selected unengaged archetypes for diversity';
  }
  
  // Ensure minimum selection
  if (selected.length < max_selection) {
    const additional = allArchetypes
      .filter(a => !selected.includes(a))
      .slice(0, max_selection - selected.length);
    selected.push(...additional);
  }
  
  // Calculate diversity score
  const diversityScore = selected.filter(s => !engaged_archetypes.includes(s)).length / selected.length;
  
  return {
    status: 'success',
    data: {
      selected_archetypes: selected.slice(0, max_selection),
      reasoning,
      diversity_score: diversityScore
    }
  };
}

module.exports = { selectArchetypes };
