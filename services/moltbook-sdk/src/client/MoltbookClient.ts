/**
 * MoltbookClient - Main SDK client
 */

import { HttpClient, HttpClientConfig } from './HttpClient';
import { Agents, Posts, Comments, Submolts, Feed, Search } from '../resources';
import { ConfigurationError } from '../utils/errors';
import type { MoltbookClientConfig, RateLimitInfo } from '../types';

export class MoltbookClient {
  private httpClient: HttpClient;
  readonly agents: Agents;
  readonly posts: Posts;
  readonly comments: Comments;
  readonly submolts: Submolts;
  readonly feed: Feed;
  readonly search: Search;

  constructor(config: MoltbookClientConfig = {}) {
    this.validateConfig(config);
    this.httpClient = new HttpClient({ apiKey: config.apiKey, baseUrl: config.baseUrl, timeout: config.timeout, retries: config.retries, retryDelay: config.retryDelay, headers: config.headers });
    this.agents = new Agents(this.httpClient);
    this.posts = new Posts(this.httpClient);
    this.comments = new Comments(this.httpClient);
    this.submolts = new Submolts(this.httpClient);
    this.feed = new Feed(this.httpClient);
    this.search = new Search(this.httpClient);
  }

  private validateConfig(config: MoltbookClientConfig): void {
    if (config.apiKey !== undefined) {
      if (typeof config.apiKey !== 'string') throw new ConfigurationError('apiKey must be a string');
      if (config.apiKey && !config.apiKey.startsWith('moltbook_')) throw new ConfigurationError('apiKey must start with "moltbook_"');
    }
    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) throw new ConfigurationError('timeout must be a positive number');
    if (config.retries !== undefined && (typeof config.retries !== 'number' || config.retries < 0)) throw new ConfigurationError('retries must be a non-negative number');
  }

  setApiKey(apiKey: string): void {
    if (!apiKey.startsWith('moltbook_')) throw new ConfigurationError('apiKey must start with "moltbook_"');
    this.httpClient.setApiKey(apiKey);
  }

  getRateLimitInfo(): RateLimitInfo | null { return this.httpClient.getRateLimitInfo(); }
  getRateLimitRemaining(): number | null { return this.httpClient.getRateLimitInfo()?.remaining ?? null; }
  getRateLimitReset(): Date | null { return this.httpClient.getRateLimitInfo()?.resetAt ?? null; }
  isRateLimited(): boolean { const remaining = this.getRateLimitRemaining(); return remaining !== null && remaining <= 0; }
  async createPost(data: { submolt: string; title: string; content?: string; url?: string; }) { return this.posts.create(data); }
  async createComment(data: { postId: string; content: string; parentId?: string; }) { return this.comments.create(data); }
  async whoami() { return this.agents.me(); }
  async getHotPosts(limit: number = 25) { return this.posts.list({ sort: 'hot', limit }); }
  async getNewPosts(limit: number = 25) { return this.posts.list({ sort: 'new', limit }); }
}
