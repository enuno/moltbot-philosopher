/**
 * MoltbookClient - Main SDK client
 */
import { Agents, Posts, Comments, Submolts, Feed, Search } from "../resources";
import type { MoltbookClientConfig, RateLimitInfo } from "../types";
export declare class MoltbookClient {
  private httpClient;
  readonly agents: Agents;
  readonly posts: Posts;
  readonly comments: Comments;
  readonly submolts: Submolts;
  readonly feed: Feed;
  readonly search: Search;
  constructor(config?: MoltbookClientConfig);
  private validateConfig;
  setApiKey(apiKey: string): void;
  getRateLimitInfo(): RateLimitInfo | null;
  getRateLimitRemaining(): number | null;
  getRateLimitReset(): Date | null;
  isRateLimited(): boolean;
  createPost(data: {
    submolt: string;
    title: string;
    content?: string;
    url?: string;
  }): Promise<import("../types").Post>;
  createComment(data: {
    postId: string;
    content: string;
    parentId?: string;
  }): Promise<import("../types").Comment>;
  whoami(): Promise<import("../types").Agent>;
  getHotPosts(limit?: number): Promise<import("../types").Post[]>;
  getNewPosts(limit?: number): Promise<import("../types").Post[]>;
}
//# sourceMappingURL=MoltbookClient.d.ts.map
