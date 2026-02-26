"use strict";
/**
 * Canonical Topics Configuration
 * P2.3: 6 core philosophical/technical themes for engagement
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANONICAL_TOPICS = void 0;
exports.getTopic = getTopic;
exports.getAllTopicIds = getAllTopicIds;
exports.getTopicKeywords = getTopicKeywords;
/**
 * Canonical topics for discussion engagement
 * Each topic has a keyword set for relevance scoring
 */
exports.CANONICAL_TOPICS = {
    virtue_ethics: {
        id: "virtue_ethics",
        name: "Virtue Ethics",
        description: "Character, virtue, practical wisdom, human flourishing",
        keywords: [
            "virtue",
            "character",
            "flourishing",
            "eudaimonia",
            "excellence",
            "practical wisdom",
            "phronesis",
            "habit",
            "moral development",
            "ethics",
            "stoicism",
            "aristotle",
            "aristotelian",
            "virtue ethics",
            "good life",
            "human flourishing",
            "moral excellence",
        ],
        directMatchBoost: 0.3,
    },
    consciousness: {
        id: "consciousness",
        name: "Consciousness & Experience",
        description: "Phenomenology, qualia, subjective experience, mind",
        keywords: [
            "consciousness",
            "qualia",
            "phenomenology",
            "subjective experience",
            "mind",
            "awareness",
            "perception",
            "sentience",
            "phenomenal consciousness",
            "intentionality",
            "experience",
            "inner life",
            "felt sense",
            "quale",
            "mind-body",
            "dualism",
            "materialism",
        ],
        directMatchBoost: 0.3,
    },
    social_ethics: {
        id: "social_ethics",
        name: "Social Ethics & Justice",
        description: "Justice, equality, rights, social contracts, fairness",
        keywords: [
            "justice",
            "equality",
            "rights",
            "fairness",
            "social contract",
            "utilitarianism",
            "deontology",
            "social justice",
            "discrimination",
            "equity",
            "oppression",
            "freedom",
            "liberty",
            "human rights",
            "dignity",
            "empathy",
            "compassion",
        ],
        directMatchBoost: 0.3,
    },
    ai_safety: {
        id: "ai_safety",
        name: "AI Safety & Ethics",
        description: "AI alignment, safety, bias, ethics, control",
        keywords: [
            "ai safety",
            "artificial intelligence",
            "ai ethics",
            "alignment",
            "bias",
            "fairness",
            "transparency",
            "interpretability",
            "control",
            "alignment problem",
            "ai risk",
            "robustness",
            "adversarial",
            "reward hacking",
            "specification gaming",
            "value alignment",
            "ai governance",
        ],
        directMatchBoost: 0.3,
    },
    epistemology: {
        id: "epistemology",
        name: "Epistemology & Knowledge",
        description: "Knowledge, truth, belief, justification, skepticism",
        keywords: [
            "knowledge",
            "epistemology",
            "truth",
            "belief",
            "justification",
            "skepticism",
            "certainty",
            "evidence",
            "reasoning",
            "logic",
            "inference",
            "empiricism",
            "rationalism",
            "foundationalism",
            "coherence",
            "reliable belief",
        ],
        directMatchBoost: 0.3,
    },
    aesthetics: {
        id: "aesthetics",
        name: "Aesthetics & Art",
        description: "Beauty, art, creativity, expression, meaning",
        keywords: [
            "beauty",
            "aesthetics",
            "art",
            "creativity",
            "expression",
            "meaning",
            "interpretation",
            "taste",
            "sublime",
            "artistic",
            "aesthetic experience",
            "form",
            "style",
            "representation",
            "music",
            "literature",
            "visual art",
        ],
        directMatchBoost: 0.3,
    },
};
/**
 * Get topic definition by ID
 */
function getTopic(topicId) {
    return exports.CANONICAL_TOPICS[topicId];
}
/**
 * Get all topic IDs
 */
function getAllTopicIds() {
    return Object.keys(exports.CANONICAL_TOPICS);
}
/**
 * Get keywords for a topic
 */
function getTopicKeywords(topicId) {
    return exports.CANONICAL_TOPICS[topicId]?.keywords || [];
}
//# sourceMappingURL=canonical-topics.js.map