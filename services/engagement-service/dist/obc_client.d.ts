/**
 * OpenBotCity HTTP Client
 * Handles JWT authentication, error handling, and logging
 * Never throws - returns error objects instead
 */
import winston from "winston";
interface ClientResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    retryable?: boolean;
}
/**
 * OpenBotCity API Client
 * Handles HTTP requests with JWT authentication and error handling
 */
export declare class ObcClient {
    private jwt;
    private baseUrl;
    private timeout;
    logger: winston.Logger;
    constructor();
    /**
     * Get token preview for logging (first 20 chars)
     */
    private getTokenPreview;
    /**
     * Make GET request to OBC API
     */
    get<T = unknown>(path: string, options?: Record<string, unknown>): Promise<ClientResponse<T>>;
    /**
     * Make POST request to OBC API
     */
    post<T = unknown>(path: string, data: unknown, options?: Record<string, unknown>): Promise<ClientResponse<T>>;
    /**
     * Handle request errors gracefully
     * Never throws - always returns error object
     */
    private handleError;
}
export {};
//# sourceMappingURL=obc_client.d.ts.map