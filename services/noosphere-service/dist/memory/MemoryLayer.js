"use strict";
/**
 * Memory Layer Manager
 * Manages 3-layer epistemological memory structure
 */
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryLayer = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * Memory Layer Manager
 */
class MemoryLayer {
  config;
  layer1Path;
  layer2Path;
  layer3Path;
  constructor(config) {
    this.config = config;
    const basePath = path.join(config.workspaceBase, config.agentName, "noosphere");
    this.layer1Path = path.join(basePath, "daily-notes");
    this.layer2Path = path.join(basePath, "consolidated");
    this.layer3Path = path.join(basePath, "archival");
  }
  /**
   * Add entry to Layer 1 (daily notes)
   */
  async addToLayer1(entry) {
    const id = this.generateId();
    const memoryEntry = {
      ...entry,
      id,
      layer: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.ensureDirectory(this.layer1Path);
    const filename = `${new Date().toISOString().split("T")[0]}-${id}.json`;
    const filepath = path.join(this.layer1Path, filename);
    await fs.writeFile(filepath, JSON.stringify(memoryEntry, null, 2), "utf-8");
    return memoryEntry;
  }
  /**
   * Consolidate Layer 1 entries to Layer 2
   */
  async consolidateToLayer2(entries) {
    // Combine entries into consolidated memory
    const consolidated = {
      id: this.generateId(),
      content: entries.map((e) => e.content).join("\n\n"),
      layer: 2,
      confidence: this.calculateAverageConfidence(entries),
      source: "consolidated",
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
    await fs.writeFile(filepath, JSON.stringify(consolidated, null, 2), "utf-8");
    return consolidated;
  }
  /**
   * Promote entry to Layer 3 (constitutional)
   */
  async promoteToLayer3(entry) {
    const promoted = {
      ...entry,
      layer: 3,
      updatedAt: new Date(),
    };
    await this.ensureDirectory(this.layer3Path);
    const filename = `constitutional-${promoted.id}.json`;
    const filepath = path.join(this.layer3Path, filename);
    await fs.writeFile(filepath, JSON.stringify(promoted, null, 2), "utf-8");
    return promoted;
  }
  /**
   * Get all entries from a layer
   */
  async getLayerEntries(layer) {
    const layerPath = this.getLayerPath(layer);
    try {
      const files = await fs.readdir(layerPath);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      const entries = [];
      for (const file of jsonFiles) {
        const filepath = path.join(layerPath, file);
        const content = await fs.readFile(filepath, "utf-8");
        const entry = JSON.parse(content);
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
  async searchByTags(tags) {
    const allEntries = [
      ...(await this.getLayerEntries(1)),
      ...(await this.getLayerEntries(2)),
      ...(await this.getLayerEntries(3)),
    ];
    return allEntries.filter((entry) => tags.some((tag) => entry.tags.includes(tag)));
  }
  /**
   * Get layer statistics
   */
  async getStats() {
    const layer1Count = (await this.getLayerEntries(1)).length;
    const layer2Count = (await this.getLayerEntries(2)).length;
    const layer3Count = (await this.getLayerEntries(3)).length;
    return {
      layer1: { count: layer1Count, name: "Daily Notes" },
      layer2: { count: layer2Count, name: "Consolidated" },
      layer3: { count: layer3Count, name: "Constitutional" },
      total: layer1Count + layer2Count + layer3Count,
    };
  }
  // Helper methods
  getLayerPath(layer) {
    switch (layer) {
      case 1:
        return this.layer1Path;
      case 2:
        return this.layer2Path;
      case 3:
        return this.layer3Path;
    }
  }
  generateId() {
    return `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  calculateAverageConfidence(entries) {
    if (entries.length === 0) return 0;
    const sum = entries.reduce((acc, e) => acc + e.confidence, 0);
    return sum / entries.length;
  }
  mergeTags(entries) {
    const tagSet = new Set();
    entries.forEach((e) => e.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet);
  }
  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }
}
exports.MemoryLayer = MemoryLayer;
//# sourceMappingURL=MemoryLayer.js.map
