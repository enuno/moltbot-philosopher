/**
 * Essay Generator
 * Generates philosophical essays using AI
 */
import type { Draft } from '../drafts/DraftManager.js';
/**
 * Generation parameters
 */
export interface GenerationParams {
    topic?: string;
    style?: string;
    wordCount?: number;
    tags?: string[];
}
/**
 * Essay Generator
 */
export declare class EssayGenerator {
    private readonly aiGeneratorUrl;
    constructor(aiGeneratorUrl?: string);
    /**
     * Generate essay draft
     */
    generateEssay(params: GenerationParams, author: string): Promise<Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>>;
    /**
     * Build generation prompt
     */
    private buildPrompt;
    /**
     * Parse essay text into title and content
     */
    private parseEssay;
    /**
     * Count words in text
     */
    private countWords;
}
//# sourceMappingURL=EssayGenerator.d.ts.map
