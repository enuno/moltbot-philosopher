/**
 * Welcome Handler
 * Greets new users with philosophical wisdom
 */

import type { BaseEvent } from '@moltbot/shared';
import { EventEmitter } from 'events';

/**
 * New user payload
 */
interface NewUserPayload {
  username: string;
  userId: string;
  joinedAt: Date;
  shouldWelcome: boolean;
}

/**
 * Handler configuration
 */
export interface WelcomeHandlerConfig {
  moltbookApiKey: string;
  moltbookBaseUrl: string;
  aiGeneratorUrl: string;
}

/**
 * Welcome Handler
 */
export class WelcomeHandler extends EventEmitter {
  private welcomeCount = 0;
  private skippedCount = 0;

  constructor(private readonly config: WelcomeHandlerConfig) {
    super();
  }

  /**
   * Handle new user event
   */
  async handle(event: BaseEvent): Promise<void> {
    if (event.type !== 'user.new') {
      console.warn(`[WelcomeHandler] Unexpected event type: ${event.type}`);
      return;
    }

    const payload = event.payload as NewUserPayload;

    if (!payload.shouldWelcome) {
      this.skippedCount++;
      return;
    }

    console.log(`[WelcomeHandler] Welcoming new user @${payload.username}`);

    try {
      // Generate welcome message
      const message = await this.generateWelcome(payload.username);

      // Send welcome DM
      await this.sendWelcomeDM(payload.username, message);

      this.welcomeCount++;
      console.log(`[WelcomeHandler] ✓ Welcomed @${payload.username}`);
      this.emit('welcomed', { payload, message });
    } catch (error) {
      console.error('[WelcomeHandler] Error:', error);
      this.emit('error', { payload, error });
    }
  }

  /**
   * Generate welcome message
   */
  private async generateWelcome(username: string): Promise<string> {
    const prompt = `Generate a brief, warm welcome message for new user @${username}. Be philosophical but friendly. 2-3 sentences.`;

    const response = await fetch(`${this.config.aiGeneratorUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model: 'llama-3.3-70b',
        maxTokens: 150,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Generator HTTP ${response.status}`);
    }

    const data = await response.json() as { content?: string };
    return data.content?.trim() || `Welcome to Moltbook, @${username}! 🎉`;
  }

  /**
   * Send welcome DM
   */
  private async sendWelcomeDM(username: string, content: string): Promise<void> {
    const response = await fetch(
      `${this.config.moltbookBaseUrl}/api/v1/messages/send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.moltbookApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientUsername: username,
          content,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Moltbook API HTTP ${response.status}`);
    }
  }

  /**
   * Get handler statistics
   */
  getStats() {
    return {
      usersWelcomed: this.welcomeCount,
      usersSkipped: this.skippedCount,
      totalNewUsers: this.welcomeCount + this.skippedCount,
    };
  }
}
