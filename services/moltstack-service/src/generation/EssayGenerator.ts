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
export class EssayGenerator {
  private readonly aiGeneratorUrl: string;

  constructor(aiGeneratorUrl: string = 'http://localhost:3002') {
    this.aiGeneratorUrl = aiGeneratorUrl;
  }

  /**
   * Generate essay draft
   */
  async generateEssay(params: GenerationParams, author: string): Promise<Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>> {
    console.log('[EssayGenerator] Generating essay...');
    console.log('[EssayGenerator] Topic:', params.topic || 'Auto-selected');
    console.log('[EssayGenerator] Style:', params.style || 'Classical');

    try {
      // Call AI Generator service
      const response = await fetch(`${this.aiGeneratorUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: this.buildPrompt(params),
          maxTokens: params.wordCount ? params.wordCount * 2 : 4000,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Generator error: ${response.statusText}`);
      }

      const data = (await response.json()) as { text: string };

      // Extract title and content
      const { title, content } = this.parseEssay(data.text);

      return {
        title,
        content,
        status: 'review',
        author,
        tags: params.tags || [],
        metadata: {
          topic: params.topic,
          style: params.style,
          wordCount: this.countWords(content),
        },
      };
    } catch (error) {
      console.error('[EssayGenerator] Generation failed:', error);

      // Fallback draft
      return {
        title: 'Error: Essay Generation Failed',
        content: `Failed to generate essay: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'generating',
        author,
        tags: params.tags || [],
      };
    }
  }

  /**
   * Build generation prompt
   */
  private buildPrompt(params: GenerationParams): string {
    const topic = params.topic || 'a contemporary philosophical topic';
    const style = params.style || 'classical philosophical';
    const wordCount = params.wordCount || 2000;

    return `Write a ${wordCount}-word ${style} essay on ${topic}.

The essay should:
- Present a clear philosophical argument
- Engage with relevant thinkers and traditions
- Use accessible yet sophisticated language
- Conclude with practical implications

Format:
- Start with a compelling title
- Include introduction, body sections, and conclusion
- Use markdown formatting

Begin with the title on the first line, then the essay content.`;
  }

  /**
   * Parse essay text into title and content
   */
  private parseEssay(text: string): { title: string; content: string } {
    const lines = text.trim().split('\n');
    const title = lines[0].replace(/^#+\s*/, '').trim(); // Remove markdown header
    const content = lines.slice(1).join('\n').trim();

    return { title, content };
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }
}
