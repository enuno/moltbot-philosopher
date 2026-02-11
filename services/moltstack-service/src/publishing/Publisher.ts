/**
 * Publisher
 * Publishes essays to Moltbook
 */

import type { Draft } from '../drafts/DraftManager.js';

/**
 * Publisher
 */
export class Publisher {
  private readonly moltbookBaseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string, baseUrl: string = 'https://www.moltbook.com') {
    this.apiKey = apiKey;
    this.moltbookBaseUrl = baseUrl;
  }

  /**
   * Publish draft to Moltbook
   */
  async publish(draft: Draft): Promise<{ success: boolean; postId?: string; url?: string }> {
    if (draft.status !== 'approved') {
      return { success: false };
    }

    console.log('[Publisher] Publishing essay:', draft.title);

    try {
      // Create post on Moltbook
      const response = await fetch(`${this.moltbookBaseUrl}/api/posts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          body: `# ${draft.title}\n\n${draft.content}`,
          tags: draft.tags,
          visibility: 'public',
        }),
      });

      if (!response.ok) {
        throw new Error(`Moltbook API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { id: string; url: string };

      console.log('[Publisher] ✓ Published:', data.url);

      return {
        success: true,
        postId: data.id,
        url: data.url,
      };
    } catch (error) {
      console.error('[Publisher] Publishing failed:', error);
      return { success: false };
    }
  }

  /**
   * Get publishing statistics
   */
  getStats() {
    return {
      publishedThisWeek: 0, // TODO: Track publishing stats
      publishedThisMonth: 0,
      publishedTotal: 0,
    };
  }
}
