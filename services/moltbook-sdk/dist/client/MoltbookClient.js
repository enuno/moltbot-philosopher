"use strict";
/**
 * MoltbookClient - Main SDK client
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoltbookClient = void 0;
const HttpClient_1 = require("./HttpClient");
const resources_1 = require("../resources");
const errors_1 = require("../utils/errors");
class MoltbookClient {
    httpClient;
    agents;
    posts;
    comments;
    submolts;
    feed;
    search;
    constructor(config = {}) {
        this.validateConfig(config);
        this.httpClient = new HttpClient_1.HttpClient({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            timeout: config.timeout,
            retries: config.retries,
            retryDelay: config.retryDelay,
            headers: config.headers,
        });
        this.agents = new resources_1.Agents(this.httpClient);
        this.posts = new resources_1.Posts(this.httpClient);
        this.comments = new resources_1.Comments(this.httpClient);
        this.submolts = new resources_1.Submolts(this.httpClient);
        this.feed = new resources_1.Feed(this.httpClient);
        this.search = new resources_1.Search(this.httpClient);
    }
    validateConfig(config) {
        if (config.apiKey !== undefined) {
            if (typeof config.apiKey !== "string")
                throw new errors_1.ConfigurationError("apiKey must be a string");
            if (config.apiKey && !config.apiKey.startsWith("moltbook_"))
                throw new errors_1.ConfigurationError('apiKey must start with "moltbook_"');
        }
        if (config.timeout !== undefined && (typeof config.timeout !== "number" || config.timeout <= 0))
            throw new errors_1.ConfigurationError("timeout must be a positive number");
        if (config.retries !== undefined && (typeof config.retries !== "number" || config.retries < 0))
            throw new errors_1.ConfigurationError("retries must be a non-negative number");
    }
    setApiKey(apiKey) {
        if (!apiKey.startsWith("moltbook_"))
            throw new errors_1.ConfigurationError('apiKey must start with "moltbook_"');
        this.httpClient.setApiKey(apiKey);
    }
    getRateLimitInfo() {
        return this.httpClient.getRateLimitInfo();
    }
    getRateLimitRemaining() {
        return this.httpClient.getRateLimitInfo()?.remaining ?? null;
    }
    getRateLimitReset() {
        return this.httpClient.getRateLimitInfo()?.resetAt ?? null;
    }
    isRateLimited() {
        const remaining = this.getRateLimitRemaining();
        return remaining !== null && remaining <= 0;
    }
    async createPost(data) {
        return this.posts.create(data);
    }
    async createComment(data) {
        return this.comments.create(data);
    }
    async whoami() {
        return this.agents.me();
    }
    async getHotPosts(limit = 25) {
        return this.posts.list({ sort: "hot", limit });
    }
    async getNewPosts(limit = 25) {
        return this.posts.list({ sort: "new", limit });
    }
}
exports.MoltbookClient = MoltbookClient;
//# sourceMappingURL=MoltbookClient.js.map