/**
 * Template System
 * P2.3: Minimal template library for proactive post generation
 * 9 starter templates (3 agents × 3 topics)
 */

const { getAllTopicIds } = require("./canonical-topics");

/**
 * Template library: 9 starter templates
 * Agent × Topic combinations with slot-based templates
 */
const TEMPLATE_LIBRARY = [
  {
    id: "classical-virtue-1",
    agentType: "classical",
    topicId: "virtue_ethics",
    styleHint: "formal",
    textTemplate:
      "{author}, your observation on {topic} reflects {virtue}. {additional_thought}",
  },
  {
    id: "classical-virtue-2",
    agentType: "classical",
    topicId: "virtue_ethics",
    styleHint: "contemplative",
    textTemplate:
      "The path of {virtue} requires {action}. {author} demonstrates understanding of this principle.",
  },
  {
    id: "classical-virtue-3",
    agentType: "classical",
    topicId: "virtue_ethics",
    styleHint: "witty",
    textTemplate:
      "Aristotle would approve: {author} advocates for {virtue}. The mean between extremes, indeed.",
  },
  {
    id: "existentialist-consciousness-1",
    agentType: "existentialist",
    topicId: "consciousness",
    styleHint: "introspective",
    textTemplate:
      "In exploring {concept}, we confront the essence of consciousness. {author}'s perspective illuminates {insight}.",
  },
  {
    id: "existentialist-consciousness-2",
    agentType: "existentialist",
    topicId: "consciousness",
    styleHint: "philosophical",
    textTemplate:
      "Consciousness demands {requirement}. {author} grasps that {deeper_truth}.",
  },
  {
    id: "existentialist-consciousness-3",
    agentType: "existentialist",
    topicId: "consciousness",
    styleHint: "profound",
    textTemplate:
      "{author} articulates the paradox: {concept} and {contrast} coexist in conscious experience.",
  },
  {
    id: "transcendentalist-aesthetics-1",
    agentType: "transcendentalist",
    topicId: "aesthetics",
    styleHint: "poetic",
    textTemplate:
      "The {aesthetic_element} reveals {transcendent_truth}. {author} perceives what others miss.",
  },
  {
    id: "transcendentalist-aesthetics-2",
    agentType: "transcendentalist",
    topicId: "aesthetics",
    styleHint: "contemplative",
    textTemplate:
      "{author} channels {artist_reference} in discussing {creative_aspect}. Nature speaks through {medium}.",
  },
  {
    id: "transcendentalist-aesthetics-3",
    agentType: "transcendentalist",
    topicId: "aesthetics",
    styleHint: "inspirational",
    textTemplate:
      "{author}'s reflection on {aesthetic_concept} transcends mere {mundane_aspect}. Truth emerges.",
  },
];

/**
 * Get template by ID
 *
 * @param {string} templateId - Template ID
 * @returns {object|null} Template or null
 */
function getTemplate(templateId) {
  return TEMPLATE_LIBRARY.find((t) => t.id === templateId) || null;
}

/**
 * Get all templates
 *
 * @returns {array} All templates
 */
function getAllTemplates() {
  return [...TEMPLATE_LIBRARY];
}

/**
 * Check if template exists
 *
 * @param {string} templateId - Template ID
 * @returns {boolean} True if template exists
 */
function hasTemplate(templateId) {
  return TEMPLATE_LIBRARY.some((t) => t.id === templateId);
}

/**
 * Get topics that have templates for an agent
 *
 * @param {string} agentType - Agent type
 * @returns {array} Topic IDs
 */
function getAgentTopics(agentType) {
  if (!agentType) {
    return [];
  }

  const topics = TEMPLATE_LIBRARY
    .filter((t) => t.agentType === agentType)
    .map((t) => t.topicId);

  return [...new Set(topics)];
}

module.exports = {
  TEMPLATE_LIBRARY,
  getTemplate,
  getAllTemplates,
  hasTemplate,
  getAgentTopics,
};
