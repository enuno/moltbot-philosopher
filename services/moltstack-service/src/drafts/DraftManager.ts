/**
 * Draft Manager
 * Manages essay drafts lifecycle
 */

import * as fs from 'fs/promises';
import * as path from 'path';

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
export class DraftManager {
  private readonly draftsPath: string;

  constructor(private readonly workspaceBase: string, private readonly agentName: string) {
    this.draftsPath = path.join(workspaceBase, agentName, 'moltstack', 'drafts');
  }

  /**
   * Sanitize draft ID to prevent path traversal
   */
  private sanitizeId(id: string): string {
    // Only allow alphanumeric, hyphens, and underscores
    const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitized !== id || sanitized.length === 0) {
      throw new Error('Invalid draft ID format');
    }
    return sanitized;
  }

  /**
   * Create new draft
   */
  async createDraft(data: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>): Promise<Draft> {
    const draft: Draft = {
      ...data,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveDraft(draft);

    return draft;
  }

  /**
   * Get draft by ID
   */
  async getDraft(id: string): Promise<Draft | null> {
    try {
      const safeId = this.sanitizeId(id);
      const filepath = path.join(this.draftsPath, `${safeId}.json`);
      const content = await fs.readFile(filepath, 'utf-8');
      const draft = JSON.parse(content) as Draft;

      // Parse dates
      draft.createdAt = new Date(draft.createdAt);
      draft.updatedAt = new Date(draft.updatedAt);
      if (draft.publishedAt) {
        draft.publishedAt = new Date(draft.publishedAt);
      }

      return draft;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update draft
   */
  async updateDraft(id: string, updates: Partial<Draft>): Promise<Draft | null> {
    const draft = await this.getDraft(id);
    if (!draft) {
      return null;
    }

    const updated: Draft = {
      ...draft,
      ...updates,
      id: draft.id, // Preserve ID
      createdAt: draft.createdAt, // Preserve creation date
      updatedAt: new Date(),
    };

    await this.saveDraft(updated);

    return updated;
  }

  /**
   * List drafts by status
   */
  async listDrafts(status?: DraftStatus): Promise<Draft[]> {
    try {
      await this.ensureDirectory();

      const files = await fs.readdir(this.draftsPath);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const drafts: Draft[] = [];
      for (const file of jsonFiles) {
        const filepath = path.join(this.draftsPath, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const draft = JSON.parse(content) as Draft;

        // Parse dates
        draft.createdAt = new Date(draft.createdAt);
        draft.updatedAt = new Date(draft.updatedAt);
        if (draft.publishedAt) {
          draft.publishedAt = new Date(draft.publishedAt);
        }

        if (!status || draft.status === status) {
          drafts.push(draft);
        }
      }

      // Sort by updatedAt descending
      drafts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return drafts;
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete draft
   */
  async deleteDraft(id: string): Promise<boolean> {
    try {
      const safeId = this.sanitizeId(id);
      const filepath = path.join(this.draftsPath, `${safeId}.json`);
      await fs.unlink(filepath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get draft statistics
   */
  async getStats() {
    const allDrafts = await this.listDrafts();

    const byStatus = {
      generating: allDrafts.filter((d) => d.status === 'generating').length,
      review: allDrafts.filter((d) => d.status === 'review').length,
      approved: allDrafts.filter((d) => d.status === 'approved').length,
      published: allDrafts.filter((d) => d.status === 'published').length,
      archived: allDrafts.filter((d) => d.status === 'archived').length,
    };

    return {
      total: allDrafts.length,
      byStatus,
      latest: allDrafts[0],
    };
  }

  // Helper methods

  private async saveDraft(draft: Draft): Promise<void> {
    await this.ensureDirectory();

    const filepath = path.join(this.draftsPath, `${draft.id}.json`);
    await fs.writeFile(filepath, JSON.stringify(draft, null, 2), 'utf-8');
  }

  private generateId(): string {
    return `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.draftsPath, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }
}
