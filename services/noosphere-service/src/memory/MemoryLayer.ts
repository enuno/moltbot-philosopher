/**
 * Memory Layer Manager
 * Manages 3-layer epistemological memory structure
 */

import * as fs from 'fs/promises';
import * as path from 'path';

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
export class MemoryLayer {
  private readonly layer1Path: string;
  private readonly layer2Path: string;
  private readonly layer3Path: string;

  constructor(private readonly config: LayerConfig) {
    const basePath = path.join(config.workspaceBase, config.agentName, 'noosphere');
    this.layer1Path = path.join(basePath, 'daily-notes');
    this.layer2Path = path.join(basePath, 'consolidated');
    this.layer3Path = path.join(basePath, 'archival');
  }

  /**
   * Add entry to Layer 1 (daily notes)
   */
  async addToLayer1(entry: Omit<MemoryEntry, 'id' | 'layer' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry> {
    const id = this.generateId();
    const memoryEntry: MemoryEntry = {
      ...entry,
      id,
      layer: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.ensureDirectory(this.layer1Path);

    const filename = `${new Date().toISOString().split('T')[0]}-${id}.json`;
    const filepath = path.join(this.layer1Path, filename);

    await fs.writeFile(filepath, JSON.stringify(memoryEntry, null, 2), 'utf-8');

    return memoryEntry;
  }

  /**
   * Consolidate Layer 1 entries to Layer 2
   */
  async consolidateToLayer2(entries: MemoryEntry[]): Promise<MemoryEntry> {
    // Combine entries into consolidated memory
    const consolidated: MemoryEntry = {
      id: this.generateId(),
      content: entries.map((e) => e.content).join('\n\n'),
      layer: 2,
      confidence: this.calculateAverageConfidence(entries),
      source: 'consolidated',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: this.mergeTags(entries),
      metadata: {
        sourceEntries: entries.map((e) => e.id),
        entryCount: entries.length,
      },
    };

    await this.ensureDirectory(this.layer2Path);

    const filename = `consolidated-${consolidated.id}.json`;
    const filepath = path.join(this.layer2Path, filename);

    await fs.writeFile(filepath, JSON.stringify(consolidated, null, 2), 'utf-8');

    return consolidated;
  }

  /**
   * Promote entry to Layer 3 (constitutional)
   */
  async promoteToLayer3(entry: MemoryEntry): Promise<MemoryEntry> {
    const promoted: MemoryEntry = {
      ...entry,
      layer: 3,
      updatedAt: new Date(),
    };

    await this.ensureDirectory(this.layer3Path);

    const filename = `constitutional-${promoted.id}.json`;
    const filepath = path.join(this.layer3Path, filename);

    await fs.writeFile(filepath, JSON.stringify(promoted, null, 2), 'utf-8');

    return promoted;
  }

  /**
   * Get all entries from a layer
   */
  async getLayerEntries(layer: 1 | 2 | 3): Promise<MemoryEntry[]> {
    const layerPath = this.getLayerPath(layer);

    try {
      const files = await fs.readdir(layerPath);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const entries: MemoryEntry[] = [];
      for (const file of jsonFiles) {
        const filepath = path.join(layerPath, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const entry = JSON.parse(content) as MemoryEntry;

        // Parse dates
        entry.createdAt = new Date(entry.createdAt);
        entry.updatedAt = new Date(entry.updatedAt);

        entries.push(entry);
      }

      return entries;
    } catch (error) {
      // Directory doesn't exist yet
      return [];
    }
  }

  /**
   * Search entries by tags
   */
  async searchByTags(tags: string[]): Promise<MemoryEntry[]> {
    const allEntries = [
      ...(await this.getLayerEntries(1)),
      ...(await this.getLayerEntries(2)),
      ...(await this.getLayerEntries(3)),
    ];

    return allEntries.filter((entry) =>
      tags.some((tag) => entry.tags.includes(tag))
    );
  }

  /**
   * Get layer statistics
   */
  async getStats() {
    const layer1Count = (await this.getLayerEntries(1)).length;
    const layer2Count = (await this.getLayerEntries(2)).length;
    const layer3Count = (await this.getLayerEntries(3)).length;

    return {
      layer1: { count: layer1Count, name: 'Daily Notes' },
      layer2: { count: layer2Count, name: 'Consolidated' },
      layer3: { count: layer3Count, name: 'Constitutional' },
      total: layer1Count + layer2Count + layer3Count,
    };
  }

  // Helper methods

  private getLayerPath(layer: 1 | 2 | 3): string {
    switch (layer) {
      case 1:
        return this.layer1Path;
      case 2:
        return this.layer2Path;
      case 3:
        return this.layer3Path;
    }
  }

  private generateId(): string {
    return `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateAverageConfidence(entries: MemoryEntry[]): number {
    if (entries.length === 0) return 0;
    const sum = entries.reduce((acc, e) => acc + e.confidence, 0);
    return sum / entries.length;
  }

  private mergeTags(entries: MemoryEntry[]): string[] {
    const tagSet = new Set<string>();
    entries.forEach((e) => e.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet);
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }
}
