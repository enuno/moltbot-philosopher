/**
 * Engagement Poller
 * Polls for mentions, comments, DMs, new users (30s intervals)
 */

import type { BaseEvent } from '@moltbot/shared';
import { createEvent, type EventType } from '@moltbot/shared';
import { EventEmitter } from 'events';

/**
 * Engagement item types
 */
interface Mention {
  postId: string;
  commentId?: string;
  authorUsername: string;
  content: string;
  url: string;
}

interface Comment {
  postId: string;
  commentId: string;
  authorUsername: string;
  content: string;
  url: string;
}

interface DMMessage {
  conversationId: string;
  messageId: string;
  senderUsername: string;
  content: string;
  timestamp: string;
}

interface NewUser {
  username: string;
  userId: string;
  joinedAt: string;
}

/**
 * Engagement poller configuration
 */
export interface EngagementPollerConfig {
  apiKey: string;
  baseUrl: string;
  pollIntervalMs: number;
}

/**
 * Engagement Poller
 */
export class EngagementPoller extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastCheckTime: Date | null = null;

  constructor(private readonly config: EngagementPollerConfig) {
    super();
  }

  /**
   * Start polling
   */
  start(): void {
    if (this.intervalId) {
      console.warn('[EngagementPoller] Already polling');
      return;
    }

    console.log(`[EngagementPoller] Starting (interval: ${this.config.pollIntervalMs}ms)`);

    // Poll immediately, then on interval
    this.poll();
    this.intervalId = setInterval(() => this.poll(), this.config.pollIntervalMs);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[EngagementPoller] Stopped');
    }
  }

  /**
   * Poll for all engagement types
   */
  private async poll(): Promise<void> {
    if (this.isPolling) {
      console.warn('[EngagementPoller] Previous poll still running, skipping');
      return;
    }

    this.isPolling = true;

    try {
      // Poll all engagement types in parallel
      await Promise.all([
        this.pollMentions(),
        this.pollComments(),
        this.pollDMs(),
        this.pollNewUsers(),
      ]);

      this.lastCheckTime = new Date();
      this.emit('poll:success');
    } catch (error) {
      console.error('[EngagementPoller] Poll failed:', error);
      this.emit('poll:error', error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Poll for mentions
   */
  private async pollMentions(): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/notifications/mentions`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as { mentions?: Mention[] };
        const mentions: Mention[] = data.mentions || [];

        for (const mention of mentions) {
          const event = createEvent(
            'mention.received',
            mention,
            { priority: 'high', source: 'event-listener' }
          );
          this.emit('mention', event);
        }
      }
    } catch (error) {
      console.error('[EngagementPoller] Mentions poll failed:', error);
    }
  }

  /**
   * Poll for comments on our posts
   */
  private async pollComments(): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/notifications/comments`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as { comments?: Comment[] };
        const comments: Comment[] = data.comments || [];

        for (const comment of comments) {
          const event = createEvent(
            'comment.received',
            comment,
            { priority: 'normal', source: 'event-listener' }
          );
          this.emit('comment', event);
        }
      }
    } catch (error) {
      console.error('[EngagementPoller] Comments poll failed:', error);
    }
  }

  /**
   * Poll for DMs
   */
  private async pollDMs(): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/messages/inbox`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as { messages?: DMMessage[] };
        const messages: DMMessage[] = data.messages || [];

        for (const message of messages) {
          const event = createEvent(
            'dm.received',
            {
              conversationId: message.conversationId,
              messageId: message.messageId,
              senderUsername: message.senderUsername,
              content: message.content,
              timestamp: new Date(message.timestamp),
            },
            { priority: 'high', source: 'event-listener' }
          );
          this.emit('dm', event);
        }
      }
    } catch (error) {
      console.error('[EngagementPoller] DMs poll failed:', error);
    }
  }

  /**
   * Poll for new users to welcome
   */
  private async pollNewUsers(): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/users/recent`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as { users?: NewUser[] };
        const users: NewUser[] = data.users || [];

        for (const user of users) {
          const event = createEvent(
            'user.new',
            {
              username: user.username,
              userId: user.userId,
              joinedAt: new Date(user.joinedAt),
              shouldWelcome: true,
            },
            { priority: 'normal', source: 'event-listener' }
          );
          this.emit('newUser', event);
        }
      }
    } catch (error) {
      console.error('[EngagementPoller] New users poll failed:', error);
    }
  }

  /**
   * Get last check time
   */
  getLastCheckTime(): Date | null {
    return this.lastCheckTime;
  }

  /**
   * Get polling status
   */
  isActive(): boolean {
    return this.intervalId !== null;
  }
}
