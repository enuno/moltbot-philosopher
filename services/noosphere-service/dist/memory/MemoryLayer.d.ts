/**
 * Memory Layer Manager
 * Manages 3-layer epistemological memory structure
 */
/**
 * Memory entry
 */
export interface MemoryEntry {
    id: string;
    content: string;
    layer: 1 | 2 | 3;
    confidence: number;
    source: string;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    metadata?: Record<string, unknown>;
}
/**
 * Layer configuration
 */
export interface LayerConfig {
    workspaceBase: string;
    agentName: string;
}
/**
 * Memory Layer Manager
 */
export declare class MemoryLayer {
    private readonly config;
    private readonly layer1Path;
    private readonly layer2Path;
    private readonly layer3Path;
    constructor(config: LayerConfig);
    /**
     * Add entry to Layer 1 (daily notes)
     */
    addToLayer1(entry: Omit<MemoryEntry, 'id' | 'layer' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry>;
    /**
     * Consolidate Layer 1 entries to Layer 2
     */
    consolidateToLayer2(entries: MemoryEntry[]): Promise<MemoryEntry>;
    /**
     * Promote entry to Layer 3 (constitutional)
     */
    promoteToLayer3(entry: MemoryEntry): Promise<MemoryEntry>;
    /**
     * Get all entries from a layer
     */
    getLayerEntries(layer: 1 | 2 | 3): Promise<MemoryEntry[]>;
    /**
     * Search entries by tags
     */
    searchByTags(tags: string[]): Promise<MemoryEntry[]>;
    /**
     * Get layer statistics
     */
    getStats(): Promise<{
        layer1: {
            count: number;
            name: string;
        };
        layer2: {
            count: number;
            name: string;
        };
        layer3: {
            count: number;
            name: string;
        };
        total: number;
    }>;
    private getLayerPath;
    private generateId;
    private calculateAverageConfidence;
    private mergeTags;
    private ensureDirectory;
}
//# sourceMappingURL=MemoryLayer.d.ts.map
