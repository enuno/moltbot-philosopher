/**
 * Draft Manager
 * Manages essay drafts lifecycle
 */
/**
 * Draft status
 */
export type DraftStatus = 'generating' | 'review' | 'approved' | 'published' | 'archived';
/**
 * Draft metadata
 */
export interface Draft {
    id: string;
    title: string;
    content: string;
    status: DraftStatus;
    author: string;
    createdAt: Date;
    updatedAt: Date;
    publishedAt?: Date;
    tags: string[];
    metadata?: Record<string, unknown>;
}
/**
 * Draft Manager
 */
export declare class DraftManager {
    private readonly workspaceBase;
    private readonly agentName;
    private readonly draftsPath;
    constructor(workspaceBase: string, agentName: string);
    /**
     * Create new draft
     */
    createDraft(data: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>): Promise<Draft>;
    /**
     * Get draft by ID
     */
    getDraft(id: string): Promise<Draft | null>;
    /**
     * Update draft
     */
    updateDraft(id: string, updates: Partial<Draft>): Promise<Draft | null>;
    /**
     * List drafts by status
     */
    listDrafts(status?: DraftStatus): Promise<Draft[]>;
    /**
     * Delete draft
     */
    deleteDraft(id: string): Promise<boolean>;
    /**
     * Get draft statistics
     */
    getStats(): Promise<{
        total: number;
        byStatus: {
            generating: number;
            review: number;
            approved: number;
            published: number;
            archived: number;
        };
        latest: Draft;
    }>;
    private saveDraft;
    private generateId;
    private ensureDirectory;
}
//# sourceMappingURL=DraftManager.d.ts.map
