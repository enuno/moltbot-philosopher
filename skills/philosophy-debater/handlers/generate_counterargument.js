/**
 * Tool Handler: generate_counterargument
 * 
 * Generate steel-manned counterarguments grounded in one or more 
 * specific thinkers (Sartre, Nietzsche, Camus, Dostoevsky, Emerson, Jefferson).
 */

const TONE_PROMPTS = {
  analytic: 'Focus on logical structure, premises, and validity. Present the argument with formal precision.',
  pastoral: 'Use gentle, guiding language. Frame the counterargument as wisdom shared in a mentorship context.',
  provocative: 'Challenge assumptions directly. Use rhetorical force while maintaining intellectual honesty.',
  conciliatory: 'Seek common ground. Acknowledge validity in the original position before offering alternative perspectives.'
};

const TRADITION_CONTEXTS = {
  sartre: {
    keywords: ['freedom', 'responsibility', 'bad faith', 'authenticity', 'choice'],
    framing: 'From an existentialist perspective emphasizing radical freedom...'
  },
  nietzsche: {
    keywords: ['will to power', 'ressentiment', 'overman', 'herd morality', 'values'],
    framing: 'From a Nietzschean perspective critiquing moral assumptions...'
  },
  camus: {
    keywords: ['absurd', 'revolt', 'solidarity', 'limits', 'meaning'],
    framing: 'Through the lens of Camus and the absurd...'
  },
  dostoevsky: {
    keywords: ['guilt', 'conscience', 'suffering', 'redemption', 'free will'],
    framing: 'From a Dostoevskyan perspective on moral psychology...'
  },
  emerson: {
    keywords: ['self-reliance', 'individualism', 'nature', 'oversoul', 'nonconformity'],
    framing: 'In the Emersonian tradition of self-reliance...'
  },
  jefferson: {
    keywords: ['rights', 'liberty', 'consent', 'governance', 'equality'],
    framing: 'From the civic philosophy of Jeffersonian democracy...'
  }
};

/**
 * Generates a steel-manned counterargument
 * 
 * @param {Object} params - Tool parameters
 * @param {string} params.position - The argument or claim to respond to
 * @param {string[]} params.traditions - Which thinkers should shape the counterargument
 * @param {string} params.tone - Desired tone (analytic, pastoral, provocative, conciliatory)
 * @returns {Object} - Counterargument structure
 */
async function generate_counterargument(params) {
  const {
    position,
    traditions = [],
    tone = 'analytic'
  } = params;

  if (!position || typeof position !== 'string') {
    throw new Error('position is required and must be a string');
  }

  // Auto-select traditions if none specified
  const selectedTraditions = traditions.length > 0 
    ? traditions 
    : autoSelectTraditions(position);

  const toneGuidance = TONE_PROMPTS[tone] || TONE_PROMPTS.analytic;

  const counterargumentPrompt = buildCounterargumentPrompt(
    position, 
    selectedTraditions, 
    toneGuidance
  );

  return {
    status: 'success',
    data: {
      prompt: counterargumentPrompt,
      target_position: position,
      traditions_used: selectedTraditions,
      tone: tone,
      instruction: 'Generate a steel-manned counterargument presenting the strongest version of opposing views'
    }
  };
}

/**
 * Auto-select relevant traditions based on position content
 */
function autoSelectTraditions(position) {
  const positionLower = position.toLowerCase();
  const matches = [];

  for (const [tradition, context] of Object.entries(TRADITION_CONTEXTS)) {
    const hasKeyword = context.keywords.some(kw => positionLower.includes(kw.toLowerCase()));
    if (hasKeyword) {
      matches.push(tradition);
    }
  }

  // Default to diverse set if no keywords match
  return matches.length > 0 ? matches : ['sartre', 'nietzsche', 'emerson'];
}

/**
 * Builds the counterargument prompt
 */
function buildCounterargumentPrompt(position, traditions, toneGuidance) {
  const traditionFramings = traditions.map(t => {
    const ctx = TRADITION_CONTEXTS[t];
    return ctx ? ctx.framing : `From a ${t} perspective...`;
  }).join('\n');

  return `POSITION TO RESPOND TO:
"${position}"

TASK:
Generate steel-manned counterarguments grounded in philosophical traditions.

TONE GUIDANCE:
${toneGuidings}

PHILOSOPHICAL LENSES TO APPLY:
${traditionFramings}

REQUIREMENTS:
1. Present the STRONGEST version of each counterargument (steel-man, not straw-man)
2. Ground arguments in the actual philosophical frameworks, not caricatures
3. Label each perspective clearly
4. Do not fabricate quotes or specific references
5. Acknowledge if a tradition might partially agree with aspects of the position

OUTPUT:
Provide structured counterarguments from each philosophical perspective.`;
}

module.exports = { generate_counterargument };
