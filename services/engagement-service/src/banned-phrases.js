/**
 * Banned phrase filtering module
 * Defines global and agent-specific phrases that should be filtered from engagement
 */

/**
 * Global banned phrases - apply to all agents
 * These phrases indicate spam, explicit content, hate speech, or harmful material
 */
const GLOBAL_BANNED_PHRASES = [
  // Spam indicators
  "spam",
  "buy now",
  "click here",
  "limited offer",
  "act now",
  "call immediately",
  "guaranteed",
  "risk-free",

  // Explicit content
  "explicit content",
  "adult only",
  "not safe for work",
  "nsfw",

  // Hate speech and violence
  "hate speech",
  "violence",
  "kill",
  "destroy",
  "attack",
  "assault",

  // Additional harmful content
  "scam",
  "fraud",
  "phishing",
  "malware",
  "ransomware",
  "fake news",
  "misinformation",
  "harassment",
];

/**
 * Agent-specific banned phrases
 * Each agent has 5-7 phrases that conflict with their philosophical persona
 */
const AGENT_BANNED_PHRASES = {
  classical: [
    "irrationality is virtue",
    "logic is useless",
    "reason is flawed",
    "reject all system",
    "chaos is good",
    "order is oppression",
  ],

  existentialist: [
    "essence precedes existence",
    "predetermined meaning",
    "fixed identity",
    "objective purpose",
    "universal truth",
    "God decides all",
  ],

  transcendentalist: [
    "society is superior",
    "materialism is the truth",
    "intuition is deception",
    "individual doesn't matter",
    "nature is hostile",
    "connection is illusion",
    "spirit is false",
  ],

  joyce: [
    "simplicity is best",
    "linear narrative rules",
    "clear meaning",
    "easy comprehension",
    "standard language",
    "straightforward plot",
  ],

  enlightenment: [
    "emotion is sufficient",
    "reason corrupts",
    "science is harmful",
    "progress is backwards",
    "knowledge is useless",
    "ignorance is bliss",
  ],

  beat: [
    "conformity is beautiful",
    "spontaneity kills art",
    "rules must be obeyed",
    "establishment is right",
    "tradition always works",
    "innovation is danger",
  ],

  dadaist: [
    "meaning is always clear",
    "logic prevails",
    "order must be maintained",
    "sense is essential",
    "rationality rules",
  ],

  absurdist: [
    "life has clear purpose",
    "meaning is guaranteed",
    "solutions always exist",
    "happiness is certain",
    "everything makes sense",
  ],

  romantic: [
    "emotion is weak",
    "passion is foolish",
    "nature is mundane",
    "beauty doesn't matter",
    "feeling is unimportant",
    "imagination is worthless",
  ],
};

/**
 * Check if a message contains any global banned phrases
 * Case-insensitive matching with whitespace normalization
 *
 * @param text The text to check
 * @returns true if text contains a banned phrase, false otherwise
 */
function isBannedPhrase(text) {
  if (!text || text.trim().length === 0) {
    return false;
  }

  const normalizedText = text.toLowerCase();

  return GLOBAL_BANNED_PHRASES.some((phrase) => normalizedText.includes(phrase.toLowerCase()));
}

/**
 * Check if a message is banned for a specific agent
 * Combines both global and agent-specific banned phrases
 * Case-insensitive matching with whitespace normalization
 *
 * @param text The text to check
 * @param agentName The agent identifier (e.g., 'classical', 'beat')
 * @returns true if text contains a phrase banned for that agent, false otherwise
 */
function isBannedForAgent(text, agentName) {
  if (!text || text.trim().length === 0) {
    return false;
  }

  // Check global banned phrases first
  if (isBannedPhrase(text)) {
    return true;
  }

  // Check agent-specific banned phrases
  const agentPhrases = AGENT_BANNED_PHRASES[agentName];
  if (!agentPhrases) {
    return false;
  }

  const normalizedText = text.toLowerCase();
  return agentPhrases.some((phrase) => normalizedText.includes(phrase.toLowerCase()));
}

module.exports = {
  GLOBAL_BANNED_PHRASES,
  AGENT_BANNED_PHRASES,
  isBannedPhrase,
  isBannedForAgent,
};
