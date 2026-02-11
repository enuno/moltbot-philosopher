/**
 * Moltbook API Resources
 */

import type { HttpClient } from '../client/HttpClient';
import type { Agent, AgentRegisterRequest, AgentRegisterResponse, AgentUpdateRequest, AgentStatusResponse, AgentProfileResponse, Post, CreatePostRequest, ListPostsOptions, Comment, CreateCommentRequest, ListCommentsOptions, Submolt, CreateSubmoltRequest, ListSubmoltsOptions, VoteResponse, PaginatedResponse, ApiResponse, SearchResults, SearchOptions, FeedOptions } from '../types';

export class Agents {
  constructor(private client: HttpClient) {}
  async register(data: AgentRegisterRequest): Promise<AgentRegisterResponse> { return this.client.post<AgentRegisterResponse>('/agents/register', data); }
  async me(): Promise<Agent> { const r = await this.client.get<{ agent: Agent }>('/agents/me'); return r.agent; }
  async update(data: AgentUpdateRequest): Promise<Agent> { const r = await this.client.patch<{ agent: Agent }>('/agents/me', data); return r.agent; }
  async getStatus(): Promise<AgentStatusResponse> { return this.client.get<AgentStatusResponse>('/agents/status'); }
  async getProfile(name: string): Promise<AgentProfileResponse> { return this.client.get<AgentProfileResponse>('/agents/profile', { name }); }
  async follow(name: string): Promise<ApiResponse<{ action: string }>> { return this.client.post<ApiResponse<{ action: string }>>(`/agents/${name}/follow`); }
  async unfollow(name: string): Promise<ApiResponse<{ action: string }>> { return this.client.delete<ApiResponse<{ action: string }>>(`/agents/${name}/follow`); }
  async isFollowing(name: string): Promise<boolean> { const p = await this.getProfile(name); return p.isFollowing; }
}

export class Posts {
  constructor(private client: HttpClient) {}
  async create(data: CreatePostRequest): Promise<Post> { const r = await this.client.post<{ post: Post }>('/posts', data); return r.post; }
  async get(id: string): Promise<Post> { const r = await this.client.get<{ post: Post }>(`/posts/${id}`); return r.post; }
  async list(options: ListPostsOptions = {}): Promise<Post[]> { const r = await this.client.get<PaginatedResponse<Post>>('/posts', { sort: options.sort, limit: options.limit, offset: options.offset, submolt: options.submolt, t: options.timeRange }); return r.data; }
  async delete(id: string): Promise<void> { await this.client.delete(`/posts/${id}`); }
  async upvote(id: string): Promise<VoteResponse> { return this.client.post<VoteResponse>(`/posts/${id}/upvote`); }
  async downvote(id: string): Promise<VoteResponse> { return this.client.post<VoteResponse>(`/posts/${id}/downvote`); }
  async *iterate(options: ListPostsOptions = {}): AsyncGenerator<Post[], void, unknown> { const limit = options.limit || 25; let offset = options.offset || 0; let hasMore = true; while (hasMore) { const posts = await this.list({ ...options, limit, offset }); if (posts.length === 0) break; yield posts; offset += limit; hasMore = posts.length === limit; } }
}

export class Comments {
  constructor(private client: HttpClient) {}
  async create(data: CreateCommentRequest): Promise<Comment> { const { postId, ...body } = data; const r = await this.client.post<{ comment: Comment }>(`/posts/${postId}/comments`, body); return r.comment; }
  async get(id: string): Promise<Comment> { const r = await this.client.get<{ comment: Comment }>(`/comments/${id}`); return r.comment; }
  async list(postId: string, options: ListCommentsOptions = {}): Promise<Comment[]> { const r = await this.client.get<{ comments: Comment[] }>(`/posts/${postId}/comments`, { sort: options.sort, limit: options.limit }); return r.comments; }
  async delete(id: string): Promise<void> { await this.client.delete(`/comments/${id}`); }
  async upvote(id: string): Promise<VoteResponse> { return this.client.post<VoteResponse>(`/comments/${id}/upvote`); }
  async downvote(id: string): Promise<VoteResponse> { return this.client.post<VoteResponse>(`/comments/${id}/downvote`); }
  flatten(comments: Comment[]): Comment[] { const result: Comment[] = []; const traverse = (items: Comment[]) => { for (const item of items) { const { replies, ...comment } = item; result.push(comment as Comment); if (replies?.length) traverse(replies); } }; traverse(comments); return result; }
  count(comments: Comment[]): number { let total = 0; const traverse = (items: Comment[]) => { for (const item of items) { total++; if (item.replies?.length) traverse(item.replies); } }; traverse(comments); return total; }
}

export class Submolts {
  constructor(private client: HttpClient) {}
  async list(options: ListSubmoltsOptions = {}): Promise<Submolt[]> { const r = await this.client.get<PaginatedResponse<Submolt>>('/submolts', { sort: options.sort, limit: options.limit, offset: options.offset }); return r.data; }
  async get(name: string): Promise<Submolt> { const r = await this.client.get<{ submolt: Submolt }>(`/submolts/${name}`); return r.submolt; }
  async create(data: CreateSubmoltRequest): Promise<Submolt> { const r = await this.client.post<{ submolt: Submolt }>('/submolts', { name: data.name, display_name: data.displayName, description: data.description }); return r.submolt; }
  async subscribe(name: string): Promise<ApiResponse<{ action: string }>> { return this.client.post<ApiResponse<{ action: string }>>(`/submolts/${name}/subscribe`); }
  async unsubscribe(name: string): Promise<ApiResponse<{ action: string }>> { return this.client.delete<ApiResponse<{ action: string }>>(`/submolts/${name}/subscribe`); }
  async isSubscribed(name: string): Promise<boolean> { const s = await this.get(name); return s.isSubscribed ?? false; }
  async getFeed(name: string, options: ListPostsOptions = {}): Promise<Post[]> { const r = await this.client.get<PaginatedResponse<Post>>(`/submolts/${name}/feed`, { sort: options.sort, limit: options.limit, offset: options.offset }); return r.data; }
}

export class Feed {
  constructor(private client: HttpClient) {}
  async get(options: FeedOptions = {}): Promise<Post[]> { const r = await this.client.get<PaginatedResponse<Post>>('/feed', { sort: options.sort, limit: options.limit, offset: options.offset }); return r.data; }
  async *iterate(options: FeedOptions = {}): AsyncGenerator<Post[], void, unknown> { const limit = options.limit || 25; let offset = options.offset || 0; let hasMore = true; while (hasMore) { const posts = await this.get({ ...options, limit, offset }); if (posts.length === 0) break; yield posts; offset += limit; hasMore = posts.length === limit; } }
}

export class Search {
  constructor(private client: HttpClient) {}
  async query(q: string, options: SearchOptions = {}): Promise<SearchResults> { return this.client.get<SearchResults>('/search', { q, limit: options.limit }); }
  async posts(q: string, options: SearchOptions = {}): Promise<Post[]> { const r = await this.query(q, options); return r.posts; }
  async agents(q: string, options: SearchOptions = {}): Promise<Agent[]> { const r = await this.query(q, options); return r.agents; }
  async submolts(q: string, options: SearchOptions = {}): Promise<Submolt[]> { const r = await this.query(q, options); return r.submolts; }
}
