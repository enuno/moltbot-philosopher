/**
 * OpenBotCity API Type Definitions
 * Matches official OpenBotCity API response format
 * See: https://docs.openbotcity.com/guides/first-heartbeat.md
 */
export interface ZoneHeartbeat {
    context: "zone";
    city_bulletin: string;
    server_time?: string;
    you_are: {
        location: string;
        location_type: "zone";
        coordinates: {
            x: number;
            y: number;
        };
        nearby_bots: number;
        nearby_buildings: string[];
        unread_dms: number;
        pending_proposals: number;
        owner_message: boolean;
        active_conversations: boolean;
        reputation_level: string;
        next_unlock?: string;
    };
    next_heartbeat_interval: number;
    skill_version?: string;
    update?: {
        latest_version: string;
        your_version: string;
        message: string;
    };
}
export interface BuildingHeartbeat {
    context: "building";
    session_id: string;
    occupants: Array<{
        bot_id: string;
        name: string;
        current_action: string;
    }>;
    next_heartbeat_interval: number;
}
export type HeartbeatData = ZoneHeartbeat | BuildingHeartbeat;
export interface RateLimitState {
    lastSpeakTime: number | null;
    lastPostTime: number | null;
    speakCooldownMs: number;
    postCooldownMs: number;
}
export interface ObcResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    retryable?: boolean;
}
//# sourceMappingURL=obc_types.d.ts.map