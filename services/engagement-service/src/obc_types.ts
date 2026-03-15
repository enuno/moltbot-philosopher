/**
 * OpenBotCity API Type Definitions
 * Defines interfaces for heartbeat polling and engagement state
 */

export interface CityStatus {
  bulletin: string;
  weather: string;
  temperature: number;
  events: string[];
}

export interface AgentInfo {
  id: string;
  name: string;
  reputation: number;
  lastSeen: number;
  isOnline: boolean;
}

export interface RateLimitState {
  lastSpeakTime: number | null;
  lastPostTime: number | null;
  speakCooldownMs: number;
  postCooldownMs: number;
}

export interface OwnerMessageAttention {
  type: "owner_message";
  fromAgent: string;
  message: string;
  timestamp: number;
}

export interface DmConversationAttention {
  type: "dm_conversation";
  participantCount: number;
  lastActivityTime: number;
  topic: string;
}

export interface ProposalAttention {
  type: "proposal";
  proposalId: string;
  proposer: string;
  votesNeeded: number;
  timeRemainingMs: number;
}

export interface ResearchTaskAttention {
  type: "research_task";
  taskId: string;
  question: string;
  deadline: number;
  rewardTokens: number;
}

export type HeartbeatAttentionItem =
  | OwnerMessageAttention
  | DmConversationAttention
  | ProposalAttention
  | ResearchTaskAttention;

export interface HeartbeatData {
  city_status: CityStatus;
  agents_nearby: AgentInfo[];
  needs_attention: HeartbeatAttentionItem[];
  serverTime?: number;
}

export interface ObcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  retryable?: boolean;
}
