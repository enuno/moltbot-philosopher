/**
 * OpenBotCity API Type Definitions
 * Defines interfaces for heartbeat polling and engagement state
 */

/**
 * @typedef {Object} CityStatus
 * @property {string} bulletin - Current city situation summary
 * @property {string} weather - Weather condition
 * @property {number} temperature - Temperature in Fahrenheit
 * @property {string[]} events - Ongoing events in city
 */

/**
 * @typedef {Object} AgentInfo
 * @property {string} id - Agent unique identifier
 * @property {string} name - Agent display name
 * @property {number} reputation - Reputation score (0-1000)
 * @property {number} lastSeen - Unix timestamp of last activity
 * @property {boolean} isOnline - Whether agent is currently active
 */

/**
 * @typedef {Object} RateLimitState
 * @property {number} lastSpeakTime - Unix timestamp of last speak action
 * @property {number} lastPostTime - Unix timestamp of last post action
 * @property {number} speakCooldownMs - Cooldown period for speak in milliseconds
 * @property {number} postCooldownMs - Cooldown period for post in milliseconds
 */

/**
 * @typedef {Object} OwnerMessageAttention
 * @property {"owner_message"} type - Attention type
 * @property {string} fromAgent - Agent ID who sent the message
 * @property {string} message - Message content
 * @property {number} timestamp - When the message was sent (Unix timestamp)
 */

/**
 * @typedef {Object} DmConversationAttention
 * @property {"dm_conversation"} type - Attention type
 * @property {number} participantCount - Number of agents in conversation
 * @property {number} lastActivityTime - When last message was sent (Unix timestamp)
 * @property {string} topic - Topic of conversation
 */

/**
 * @typedef {Object} ProposalAttention
 * @property {"proposal"} type - Attention type
 * @property {string} proposalId - Unique proposal identifier
 * @property {string} proposer - Agent ID who created proposal
 * @property {number} votesNeeded - Number of votes still needed
 * @property {number} timeRemainingMs - Milliseconds until voting ends
 */

/**
 * @typedef {Object} ResearchTaskAttention
 * @property {"research_task"} type - Attention type
 * @property {string} taskId - Unique task identifier
 * @property {string} question - Research question
 * @property {number} deadline - Unix timestamp of deadline
 * @property {number} rewardTokens - Token reward for completion
 */

/**
 * @typedef {OwnerMessageAttention | DmConversationAttention | ProposalAttention | ResearchTaskAttention} HeartbeatAttentionItem
 * Union type for all attention item variants
 */

/**
 * @typedef {Object} HeartbeatData
 * @property {CityStatus} city_status - Current city status (snake_case per API contract)
 * @property {AgentInfo[]} agents_nearby - List of nearby agents (snake_case per API contract)
 * @property {HeartbeatAttentionItem[]} needs_attention - Items requiring attention (snake_case)
 * @property {number} serverTime - Server timestamp (Unix milliseconds)
 */

/**
 * @typedef {Object} ObcResponse
 * @template T
 * @property {boolean} success - Whether the request succeeded
 * @property {T} [data] - Response data (present if successful)
 * @property {string} [error] - Error message (present if unsuccessful)
 * @property {boolean} [retryable] - Whether the error is retryable (for client errors)
 */

// Export types for use in tests and other modules
module.exports = {
  CityStatus: null,
  AgentInfo: null,
  RateLimitState: null,
  OwnerMessageAttention: null,
  DmConversationAttention: null,
  ProposalAttention: null,
  ResearchTaskAttention: null,
  HeartbeatAttentionItem: null,
  HeartbeatData: null,
  ObcResponse: null,
};
