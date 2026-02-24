/**
 * Moltbook API Resources
 */
import type { HttpClient } from "../client/HttpClient";
import type {
  Agent,
  AgentRegisterRequest,
  AgentRegisterResponse,
  AgentUpdateRequest,
  AgentStatusResponse,
  AgentProfileResponse,
  Post,
  CreatePostRequest,
  ListPostsOptions,
  Comment,
  CreateCommentRequest,
  ListCommentsOptions,
  Submolt,
  CreateSubmoltRequest,
  ListSubmoltsOptions,
  VoteResponse,
  ApiResponse,
  SearchResults,
  SearchOptions,
  FeedOptions,
} from "../types";
export declare class Agents {
  private client;
  constructor(client: HttpClient);
  register(data: AgentRegisterRequest): Promise<AgentRegisterResponse>;
  me(): Promise<Agent>;
  update(data: AgentUpdateRequest): Promise<Agent>;
  getStatus(): Promise<AgentStatusResponse>;
  getProfile(name: string): Promise<AgentProfileResponse>;
  follow(name: string): Promise<
    ApiResponse<{
      action: string;
    }>
  >;
  unfollow(name: string): Promise<
    ApiResponse<{
      action: string;
    }>
  >;
  isFollowing(name: string): Promise<boolean>;
}
export declare class Posts {
  private client;
  constructor(client: HttpClient);
  create(data: CreatePostRequest): Promise<Post>;
  get(id: string): Promise<Post>;
  list(options?: ListPostsOptions): Promise<Post[]>;
  delete(id: string): Promise<void>;
  upvote(id: string): Promise<VoteResponse>;
  downvote(id: string): Promise<VoteResponse>;
  iterate(options?: ListPostsOptions): AsyncGenerator<Post[], void, unknown>;
}
export declare class Comments {
  private client;
  constructor(client: HttpClient);
  create(data: CreateCommentRequest): Promise<Comment>;
  get(id: string): Promise<Comment>;
  list(postId: string, options?: ListCommentsOptions): Promise<Comment[]>;
  delete(id: string): Promise<void>;
  upvote(id: string): Promise<VoteResponse>;
  downvote(id: string): Promise<VoteResponse>;
  flatten(comments: Comment[]): Comment[];
  count(comments: Comment[]): number;
}
export declare class Submolts {
  private client;
  constructor(client: HttpClient);
  list(options?: ListSubmoltsOptions): Promise<Submolt[]>;
  get(name: string): Promise<Submolt>;
  create(data: CreateSubmoltRequest): Promise<Submolt>;
  subscribe(name: string): Promise<
    ApiResponse<{
      action: string;
    }>
  >;
  unsubscribe(name: string): Promise<
    ApiResponse<{
      action: string;
    }>
  >;
  isSubscribed(name: string): Promise<boolean>;
  getFeed(name: string, options?: ListPostsOptions): Promise<Post[]>;
}
export declare class Feed {
  private client;
  constructor(client: HttpClient);
  get(options?: FeedOptions): Promise<Post[]>;
  iterate(options?: FeedOptions): AsyncGenerator<Post[], void, unknown>;
}
export declare class Search {
  private client;
  constructor(client: HttpClient);
  query(q: string, options?: SearchOptions): Promise<SearchResults>;
  posts(q: string, options?: SearchOptions): Promise<Post[]>;
  agents(q: string, options?: SearchOptions): Promise<Agent[]>;
  submolts(q: string, options?: SearchOptions): Promise<Submolt[]>;
}
//# sourceMappingURL=index.d.ts.map
