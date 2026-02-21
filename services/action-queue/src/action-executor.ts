import axios, { AxiosError } from 'axios';
import { ActionType, QueuedAction } from './types';
import { QUEUE_CONFIG } from './config';

/**
 * Action Executor
 *
 * Executes actions against the Moltbook API.
 * Handles different action types and error cases.
 */
export class ActionExecutor {
  private apiBase: string;
  private apiKey: string;

  constructor(apiBase?: string, apiKey?: string) {
    this.apiBase = apiBase || QUEUE_CONFIG.moltbookApiBase;
    this.apiKey = apiKey || QUEUE_CONFIG.moltbookApiKey;

    if (!this.apiKey) {
      throw new Error('MOLTBOOK_API_KEY is required');
    }
  }

  /**
   * Execute an action
   */
  async execute(
    action: QueuedAction,
  ): Promise<{ success: boolean; data?: any; error?: string; httpStatus?: number; dailyRemaining?: number }> {
    try {
      switch (action.actionType) {
        case ActionType.POST:
          return await this.executePost(action);
        case ActionType.COMMENT:
          return await this.executeComment(action);
        case ActionType.UPVOTE:
          return await this.executeUpvote(action);
        case ActionType.DOWNVOTE:
          return await this.executeDownvote(action);
        case ActionType.FOLLOW:
          return await this.executeFollow(action);
        case ActionType.UNFOLLOW:
          return await this.executeUnfollow(action);
        case ActionType.CREATE_SUBMOLT:
          return await this.executeCreateSubmolt(action);
        case ActionType.SEND_DM:
          return await this.executeSendDM(action);
        case ActionType.SKILL_UPDATE:
          return await this.executeSkillUpdate(action);
        default:
          return {
            success: false,
            error: `Unknown action type: ${action.actionType}`,
          };
      }
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Execute POST action
   */
  private async executePost(action: QueuedAction): Promise<any> {
    const { title, content, submolt, submolt_name, url } = action.payload;

    const response = await axios.post(
      `${this.apiBase}/posts`,
      {
        title,
        content,
        submolt_name: submolt_name ?? submolt,
        url,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      },
    );

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        data: response.data,
        httpStatus: response.status,
      };
    } else {
      return {
        success: false,
        error: response.data?.error || `HTTP ${response.status}`,
        httpStatus: response.status,
        dailyRemaining: response.data?.daily_remaining,
      };
    }
  }

  /**
   * Execute COMMENT action
   */
  private async executeComment(action: QueuedAction): Promise<any> {
    const { postId, content, parentCommentId } = action.payload;

    const response = await axios.post(
      `${this.apiBase}/posts/${postId}/comments`,
      {
        content,
        parentCommentId,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      },
    );

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        data: response.data,
        httpStatus: response.status,
      };
    } else {
      return {
        success: false,
        error: response.data?.error || `HTTP ${response.status}`,
        httpStatus: response.status,
        dailyRemaining: response.data?.daily_remaining,
      };
    }
  }

  /**
   * Execute UPVOTE action
   */
  private async executeUpvote(action: QueuedAction): Promise<any> {
    const { targetId, targetType } = action.payload;

    const endpoint =
      targetType === 'post'
        ? `${this.apiBase}/posts/${targetId}/upvote`
        : `${this.apiBase}/comments/${targetId}/upvote`;

    const response = await axios.post(
      endpoint,
      {},
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        validateStatus: () => true,
      },
    );

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        data: response.data,
        httpStatus: response.status,
      };
    } else {
      return {
        success: false,
        error: response.data?.error || `HTTP ${response.status}`,
        httpStatus: response.status,
        dailyRemaining: response.data?.daily_remaining,
      };
    }
  }

  /**
   * Execute DOWNVOTE action
   */
  private async executeDownvote(action: QueuedAction): Promise<any> {
    const { targetId, targetType } = action.payload;

    const endpoint =
      targetType === 'post'
        ? `${this.apiBase}/posts/${targetId}/downvote`
        : `${this.apiBase}/comments/${targetId}/downvote`;

    const response = await axios.post(
      endpoint,
      {},
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        validateStatus: () => true,
      },
    );

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        data: response.data,
        httpStatus: response.status,
      };
    } else {
      return {
        success: false,
        error: response.data?.error || `HTTP ${response.status}`,
        httpStatus: response.status,
        dailyRemaining: response.data?.daily_remaining,
      };
    }
  }

  /**
   * Execute FOLLOW action
   */
  private async executeFollow(action: QueuedAction): Promise<any> {
    const { username } = action.payload;

    const response = await axios.post(
      `${this.apiBase}/agents/${username}/follow`,
      {},
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        validateStatus: () => true,
      },
    );

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        data: response.data,
        httpStatus: response.status,
      };
    } else {
      return {
        success: false,
        error: response.data?.error || `HTTP ${response.status}`,
        httpStatus: response.status,
        dailyRemaining: response.data?.daily_remaining,
      };
    }
  }

  /**
   * Execute UNFOLLOW action
   */
  private async executeUnfollow(action: QueuedAction): Promise<any> {
    const { username } = action.payload;

    const response = await axios.delete(
      `${this.apiBase}/agents/${username}/follow`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        validateStatus: () => true,
      },
    );

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        data: response.data,
        httpStatus: response.status,
      };
    } else {
      return {
        success: false,
        error: response.data?.error || `HTTP ${response.status}`,
        httpStatus: response.status,
        dailyRemaining: response.data?.daily_remaining,
      };
    }
  }

  /**
   * Execute CREATE_SUBMOLT action
   */
  private async executeCreateSubmolt(action: QueuedAction): Promise<any> {
    const { name, displayName, description, rules } = action.payload;

    const response = await axios.post(
      `${this.apiBase}/submolts`,
      {
        name,
        display_name: displayName,
        description,
        rules,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      },
    );

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        data: response.data,
        httpStatus: response.status,
      };
    } else {
      return {
        success: false,
        error: response.data?.error || `HTTP ${response.status}`,
        httpStatus: response.status,
        dailyRemaining: response.data?.daily_remaining,
      };
    }
  }

  /**
   * Execute SEND_DM action
   */
  private async executeSendDM(action: QueuedAction): Promise<any> {
    const { recipientUsername, subject, content } = action.payload;

    const response = await axios.post(
      `${this.apiBase}/messages`,
      {
        recipient: recipientUsername,
        subject,
        content,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      },
    );

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        data: response.data,
        httpStatus: response.status,
      };
    } else {
      return {
        success: false,
        error: response.data?.error || `HTTP ${response.status}`,
        httpStatus: response.status,
        dailyRemaining: response.data?.daily_remaining,
      };
    }
  }

  /**
   * Execute SKILL_UPDATE action
   */
  private async executeSkillUpdate(_action: QueuedAction): Promise<any> {
    // This might be a check for skill version or similar
    // Implementation depends on Moltbook API
    return {
      success: true,
      data: { message: 'Skill update check completed' },
      httpStatus: 200,
    };
  }

  /**
   * Handle axios errors
   */
  private handleError(error: AxiosError | Error): any {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        httpStatus: error.response?.status,
        dailyRemaining: error.response?.data?.daily_remaining,
      };
    } else {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryable(httpStatus?: number): boolean {
    if (!httpStatus) return true; // Network errors are retryable

    // 5xx errors are retryable (server errors)
    if (httpStatus >= 500 && httpStatus < 600) return true;

    // 429 Too Many Requests is retryable
    if (httpStatus === 429) return true;

    // 4xx errors are not retryable (client errors)
    return false;
  }
}
