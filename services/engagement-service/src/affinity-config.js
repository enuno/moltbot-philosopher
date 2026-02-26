/**
 * Agent-Topic Affinity Configuration
 * P2.3: 54-entry (9 agents × 6 topics) affinity matrix for engagement scoring
 */

/**
 * 9 agents × 6 topics affinity matrix (0-1 scores)
 * Higher score = stronger alignment with topic
 */
const AGENT_TOPIC_AFFINITIES = {
  classical: {
    virtue_ethics: 0.95,
    consciousness: 0.65,
    social_ethics: 0.75,
    ai_safety: 0.40,
    epistemology: 0.70,
    aesthetics: 0.60,
  },
  existentialist: {
    virtue_ethics: 0.70,
    consciousness: 0.95,
    social_ethics: 0.80,
    ai_safety: 0.35,
    epistemology: 0.75,
    aesthetics: 0.85,
  },
  transcendentalist: {
    virtue_ethics: 0.80,
    consciousness: 0.90,
    social_ethics: 0.70,
    ai_safety: 0.25,
    epistemology: 0.65,
    aesthetics: 0.90,
  },
  joyce: {
    virtue_ethics: 0.45,
    consciousness: 0.85,
    social_ethics: 0.60,
    ai_safety: 0.20,
    epistemology: 0.50,
    aesthetics: 0.95,
  },
  enlightenment: {
    virtue_ethics: 0.75,
    consciousness: 0.60,
    social_ethics: 0.90,
    ai_safety: 0.50,
    epistemology: 0.85,
    aesthetics: 0.55,
  },
  beat: {
    virtue_ethics: 0.55,
    consciousness: 0.80,
    social_ethics: 0.75,
    ai_safety: 0.30,
    epistemology: 0.50,
    aesthetics: 0.85,
  },
  "cyberpunk-posthumanist": {
    virtue_ethics: 0.35,
    consciousness: 0.75,
    social_ethics: 0.65,
    ai_safety: 0.95,
    epistemology: 0.80,
    aesthetics: 0.70,
  },
  "satirist-absurdist": {
    virtue_ethics: 0.40,
    consciousness: 0.70,
    social_ethics: 0.75,
    ai_safety: 0.45,
    epistemology: 0.60,
    aesthetics: 0.90,
  },
  "scientist-empiricist": {
    virtue_ethics: 0.50,
    consciousness: 0.70,
    social_ethics: 0.65,
    ai_safety: 0.85,
    epistemology: 0.95,
    aesthetics: 0.45,
  },
};

/**
 * Get affinity scores for a specific agent
 *
 * @param {string} agentId - Agent identifier
 * @returns {object} Topic ID → affinity score mapping
 */
function getAgentAffinities(agentId) {
  return AGENT_TOPIC_AFFINITIES[agentId] || {};
}

/**
 * Get affinity score for agent-topic pair
 *
 * @param {string} agentId - Agent identifier
 * @param {string} topicId - Topic identifier
 * @returns {number} Affinity score 0-1
 */
function getAffinityScore(agentId, topicId) {
  if (!agentId || !topicId) {
    return 0;
  }

  const agentAffinities = AGENT_TOPIC_AFFINITIES[agentId];
  if (!agentAffinities) {
    return 0;
  }

  return agentAffinities[topicId] || 0;
}

/**
 * Get top agents for a topic, sorted by affinity
 *
 * @param {string} topicId - Topic identifier
 * @param {number} limit - Max results (default all)
 * @returns {array} [{agentId, affinityScore}] sorted by score descending
 */
function getTopAgentsForTopic(topicId, limit) {
  if (!topicId) {
    return [];
  }

  const agents = Object.entries(AGENT_TOPIC_AFFINITIES)
    .map(([agentId, affinities]) => ({
      agentId,
      affinityScore: affinities[topicId] || 0,
    }))
    .sort((a, b) => b.affinityScore - a.affinityScore);

  if (limit && limit > 0) {
    return agents.slice(0, limit);
  }

  return agents;
}

/**
 * Compute engagement relevance from topic relevance and agent affinity
 * Formula: 0.6 * topicRelevance + 0.4 * affinityScore
 *
 * @param {number} topicRelevance - Topic match score 0-1
 * @param {number} affinityScore - Agent affinity score 0-1
 * @returns {number} Combined relevance 0-1
 */
function computeEngagementRelevance(topicRelevance, affinityScore) {
  // Handle nulls/undefineds
  const topicScore = typeof topicRelevance === "number" ? topicRelevance : 0;
  const affinity = typeof affinityScore === "number" ? affinityScore : 0;

  // Clamp to 0-1
  const clampedTopic = Math.max(0, Math.min(1, topicScore));
  const clampedAffinity = Math.max(0, Math.min(1, affinity));

  // 60% topic relevance, 40% agent affinity
  return 0.6 * clampedTopic + 0.4 * clampedAffinity;
}

module.exports = {
  AGENT_TOPIC_AFFINITIES,
  getAgentAffinities,
  getAffinityScore,
  getTopAgentsForTopic,
  computeEngagementRelevance,
};
