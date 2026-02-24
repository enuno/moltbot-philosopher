/**
 * Publisher
 * Publishes essays to Moltbook
 */
import type { Draft } from "../drafts/DraftManager.js";
/**
 * Publisher
 */
export declare class Publisher {
  private readonly moltbookBaseUrl;
  private readonly apiKey;
  constructor(apiKey: string, baseUrl?: string);
  /**
   * Publish draft to Moltbook
   */
  publish(draft: Draft): Promise<{
    success: boolean;
    postId?: string;
    url?: string;
  }>;
  /**
   * Get publishing statistics
   */
  getStats(): {
    publishedThisWeek: number;
    publishedThisMonth: number;
    publishedTotal: number;
  };
}
//# sourceMappingURL=Publisher.d.ts.map
