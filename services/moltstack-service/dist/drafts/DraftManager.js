"use strict";
/**
 * Draft Manager
 * Manages essay drafts lifecycle
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * Draft Manager
 */
class DraftManager {
    workspaceBase;
    agentName;
    draftsPath;
    constructor(workspaceBase, agentName) {
        this.workspaceBase = workspaceBase;
        this.agentName = agentName;
        this.draftsPath = path.join(workspaceBase, agentName, 'moltstack', 'drafts');
    }
    /**
     * Create new draft
     */
    async createDraft(data) {
        const draft = {
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
    async getDraft(id) {
        try {
            const filepath = path.join(this.draftsPath, `${id}.json`);
            const content = await fs.readFile(filepath, 'utf-8');
            const draft = JSON.parse(content);
            // Parse dates
            draft.createdAt = new Date(draft.createdAt);
            draft.updatedAt = new Date(draft.updatedAt);
            if (draft.publishedAt) {
                draft.publishedAt = new Date(draft.publishedAt);
            }
            return draft;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Update draft
     */
    async updateDraft(id, updates) {
        const draft = await this.getDraft(id);
        if (!draft) {
            return null;
        }
        const updated = {
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
    async listDrafts(status) {
        try {
            await this.ensureDirectory();
            const files = await fs.readdir(this.draftsPath);
            const jsonFiles = files.filter((f) => f.endsWith('.json'));
            const drafts = [];
            for (const file of jsonFiles) {
                const filepath = path.join(this.draftsPath, file);
                const content = await fs.readFile(filepath, 'utf-8');
                const draft = JSON.parse(content);
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
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Delete draft
     */
    async deleteDraft(id) {
        try {
            const filepath = path.join(this.draftsPath, `${id}.json`);
            await fs.unlink(filepath);
            return true;
        }
        catch (error) {
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
    async saveDraft(draft) {
        await this.ensureDirectory();
        const filepath = path.join(this.draftsPath, `${draft.id}.json`);
        await fs.writeFile(filepath, JSON.stringify(draft, null, 2), 'utf-8');
    }
    generateId() {
        return `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    async ensureDirectory() {
        try {
            await fs.mkdir(this.draftsPath, { recursive: true });
        }
        catch (error) {
            // Directory already exists
        }
    }
}
exports.DraftManager = DraftManager;
//# sourceMappingURL=DraftManager.js.map
