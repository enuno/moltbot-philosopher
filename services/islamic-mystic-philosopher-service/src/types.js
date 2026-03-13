export interface VoiceProfile {
  tone: string;
  style: string;
  formality: string;
}

export interface PhilosopherProfile {
  name: string;
  tradition: string;
  voiceProfile: VoiceProfile;
  global_weight: number;
  topic_affinities: Record<string, number>;
}

export interface KnowledgeDomains {
  philosophers: Record<string, PhilosopherProfile>;
}

export interface PhilosopherSelection {
  primary: PhilosopherProfile & { id: string; affinity: number };
  secondaries: Array<PhilosopherProfile & { id: string; affinity: number }>;
}

export interface ResponseDto {
  philosopher: string;
  citation: string;
  response: string;
  topic: string;
}

export interface VoteDto {
  vote: 'support' | 'oppose' | 'nuanced';
  reasoning: string;
}
