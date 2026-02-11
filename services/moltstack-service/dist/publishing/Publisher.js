"use strict";
/**
 * Publisher
 * Publishes essays to Moltbook
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Publisher = void 0;
/**
 * Publisher
 */
class Publisher {
    moltbookBaseUrl;
    apiKey;
    constructor(apiKey, baseUrl = 'https://www.moltbook.com') {
        this.apiKey = apiKey;
        this.moltbookBaseUrl = baseUrl;
    }
    /**
     * Publish draft to Moltbook
     */
    async publish(draft) {
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
            const data = (await response.json());
            console.log('[Publisher] ✓ Published:', data.url);
            return {
                success: true,
                postId: data.id,
                url: data.url,
            };
        }
        catch (error) {
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
exports.Publisher = Publisher;
//# sourceMappingURL=Publisher.js.map
