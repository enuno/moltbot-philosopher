/**
 * Tool Handler: summarize_debate
 * 
 * Summarize a Moltbook thread as a structured philosophical debate,
 * tagging parts with Sartre, Nietzsche, Camus, Dostoevsky, Emerson, and Jefferson lenses.
 */

const fs = require('fs');
const path = require('path');

// Load prompt files for different philosophical traditions
const PROMPTS_DIR = path.join(__dirname, '..', 'prompts');

const TRADITION_PROMPTS = {
  sartre: 'sartre.md',
  nietzsche: 'nietzsche.md',
  camus: 'camus.md',
  dostoevsky: 'dostoevsky.md',
  emerson: 'emerson.md',
  jefferson: 'jefferson.md'
};

/**
 * Summarizes a debate thread through multiple philosophical lenses
 * 
 * @param {Object} params - Tool parameters
 * @param {string} params.thread_excerpt - Raw text or JSON of the thread
 * @param {string[]} params.focus_traditions - Optional subset of traditions to emphasize
 * @param {number} params.max_words - Maximum summary length (default: 350)
 * @returns {Object} - Structured debate summary
 */
async function summarize_debate(params) {
  const {
    thread_excerpt,
    focus_traditions = [],
    max_words = 350
  } = params;

  // Validate required parameter
  if (!thread_excerpt || typeof thread_exippet !== 'string') {
    throw new Error('thread_excerpt is required and must be a string');
  }

  // Determine which traditions to include
  const traditionsToInclude = focus_traditions.length > 0 
    ? focus_traditions 
    : Object.keys(TRADITION_PROMPTS);

  // Build the analysis prompt
  const analysisPrompt = buildAnalysisPrompt(thread_excerpt, traditionsToInclude, max_words);

  // Return the structured analysis request
  // The actual LLM call would be made by the host runtime
  return {
    status: 'success',
    data: {
      prompt: analysisPrompt,
      traditions_analyzed: traditionsToInclude,
      max_words: max_words,
      thread_length: thread_excerpt.length
    }
  };
}

/**
 * Builds the analysis prompt for the LLM
 */
function buildAnalysisPrompt(threadExcerpt, traditions, maxWords) {
  const traditionList = traditions.join(', ');
  
  return `Analyze the following Moltbook thread as a structured philosophical debate.

THREAD CONTENT:
---
${threadExcerpt}
---

TASK:
Summarize this debate (maximum ${maxWords} words) by:
1. Identifying the core positions and arguments
2. Tagging each significant point with the relevant philosophical lens: ${traditionList}
3. Presenting a steel-man version of each perspective (the strongest form of the argument)
4. Concluding with synthesis or unresolved tensions

FORMAT:
- Use clear headings for each philosophical perspective
- Label perspectives explicitly: "From a Sartrean lens...", "A Nietzschean view would be...", etc.
- Do not fabricate quotes or references
- Maintain respectful treatment of all participants as moral subjects

OUTPUT:
Provide the structured summary with philosophical tags.`;
}

module.exports = { summarize_debate };
