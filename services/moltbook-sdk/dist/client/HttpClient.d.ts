/**
 * HTTP Client for Moltbook API
 */
import { RequestConfig, RateLimitInfo } from "../types";
export interface HttpClientConfig {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    headers?: Record<string, string>;
}
export declare class HttpClient {
    private apiKey?;
    private baseUrl;
    private timeout;
    private retries;
    private retryDelay;
    private customHeaders;
    private rateLimitInfo;
    constructor(config?: HttpClientConfig);
    setApiKey(apiKey: string): void;
    getRateLimitInfo(): RateLimitInfo | null;
    private buildHeaders;
    private buildUrl;
    private parseRateLimitHeaders;
    private handleErrorResponse;
    private shouldRetry;
    private getRetryDelay;
    private sleep;
    request<T>(config: RequestConfig): Promise<T>;
    get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    patch<T>(path: string, body?: unknown): Promise<T>;
    delete<T>(path: string): Promise<T>;
}
//# sourceMappingURL=HttpClient.d.ts.map