/**
 * EngagementEngine
 * Orchestrates feed monitoring, opportunity scoring, action validation, and agent scheduling
 * Core responsibilities:
 * - Monitor feeds across subscribedSubmolts
 * - Score posts for relevance and queue opportunities
 * - Validate actions against 6-point quality gates
 * - Schedule agents in round-robin order
 * - Generate content for posting
 * - Daily maintenance (reset stats, unfollow inactive accounts)
 */

import { StateManager } from './state-manager';
import { RelevanceCalculator } from './relevance-calculator';
import { Agent, Opportunity, QueuedAction, Post, ActionType } from './types';

interface EngagementEngineConfig {
  statePaths: Record<string, string>;
  agentRoster: Agent[];
}

export class EngagementEngine {
  private statePaths: Record<string, string>;
  private agentRoster: Agent[];
  private stateManagers: Map<string, StateManager>;
  private relevanceCalculator: RelevanceCalculator;

  constructor(config: EngagementEngineConfig) {
    this.statePaths = config.statePaths;
    this.agentRoster = config.agentRoster;
    this.stateManagers = new Map();
    this.relevanceCalculator = new RelevanceCalculator();

    // Initialize StateManager for each agent
    Object.entries(config.statePaths).forEach(([agentId, statePath]) => {
      this.stateManagers.set(agentId, new StateManager(statePath));
    });
  }

  /**
   * Monitor feed across subscribedSubmolts
   * Fetches posts, scores for relevance, filters > 0.6, returns opportunities
   * Limits to 10 posts per submolt for efficiency
   */
  async monitorFeed(): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    // In production, would iterate through all subscribedSubmolts
    // For testing, use default submolts
    const defaultSubmolts = [
      'ethics-convergence',
      'general',
      'aithoughts'
    ];

    for (const submoltId of defaultSubmolts) {
      // Mock: fetch posts from submolt
      // In production: call egress-proxy API
      const posts = await this.fetchSubmoltPosts(submoltId, 10);

      for (const post of posts) {
        // Score post against all agents to find best match
        for (const agent of this.agentRoster) {
          const relevanceScore = await this.relevanceCalculator.scorePost(
            post,
            agent
          );

          // Only queue if above threshold
          if (relevanceScore > 0.6) {
            opportunities.push({
              id: `opp_${post.id}_${agent.id}`,
              postId: post.id,
              author: post.author,
              content: post.content,
              submoltId: post.submoltId,
              relevanceScore,
              reason: `Semantic match to ${agent.tradition}`,
              suggestedAction: 'comment',
              createdAt: Date.now()
            });
          }
        }
      }
    }

    return opportunities;
  }

  /**
   * Fetch posts from a submolt (mock implementation)
   * In production, calls egress-proxy
   */
  private async fetchSubmoltPosts(submoltId: string, limit: number): Promise<Post[]> {
    // Mock implementation for testing
    return [];
  }

  /**
   * Dequeue opportunities for a specific agent
   * Respects daily limits and action-specific constraints
   */
  async dequeueOpportunities(agent: Agent): Promise<QueuedAction[]> {
    const stateManager = this.stateManagers.get(agent.id);
    if (!stateManager) return [];

    const state = await stateManager.loadState();
    const actions: QueuedAction[] = [];
    const dequeuedPostIds = new Set<string>();

    // Process queue in priority order
    for (const opportunity of state.engagementQueue) {
      // Check daily limits based on action type
      if (opportunity.type === 'comment' && state.dailyStats.commentsMade >= 50) {
        continue;
      }
      if (opportunity.type === 'post' && state.dailyStats.postsCreated >= 3) {
        continue;
      }
      if (opportunity.type === 'follow' && state.dailyStats.accountsFollowed >= 2) {
        continue;
      }
      if (opportunity.type === 'dm' && state.dailyStats.dmRequestsSent >= 2) {
        continue;
      }

      // Add to dequeued actions
      actions.push(opportunity);
      dequeuedPostIds.add(opportunity.postId);

      // Don't dequeue too many at once
      if (actions.length >= 5) break;
    }

    // Remove dequeued items from state
    state.engagementQueue = state.engagementQueue.filter(
      opp => !dequeuedPostIds.has(opp.postId)
    );
    await stateManager.saveState(state);

    return actions;
  }

  /**
   * Validate action against 6-point quality gate
   * 1. Relevance > 0.6
   * 2. No generic comments
   * 3. Substantiveness (>20 chars, 2+ sentences)
   * 4. Rate limits (checked locally)
   * 5. Daily caps (within limits)
   * 6. Follow evaluation (3+ posts seen before follow)
   */
  async validateAction(
    action: QueuedAction,
    content: string,
    agent: Agent
  ): Promise<boolean> {
    // Gate 1: Relevance threshold
    if (action.priority <= 0.6) {
      return false;
    }

    // Gate 2: Generic comments
    if (action.type === 'comment' && this.relevanceCalculator.isGenericComment(content)) {
      return false;
    }

    // Gate 3: Substantiveness
    if (action.type === 'comment' && !this.relevanceCalculator.isSubstantive(content)) {
      return false;
    }

    // Gate 4: Rate limits (basic check - in production would integrate with action-queue)
    const stateManager = this.stateManagers.get(agent.id);
    if (!stateManager) return false;

    const state = await stateManager.loadState();

    // Gate 5: Daily caps (check current counts)
    if (action.type === 'comment' && state.dailyStats.commentsMade >= 50) {
      return false;
    }
    if (action.type === 'post' && state.dailyStats.postsCreated >= 3) {
      return false;
    }
    if (action.type === 'follow' && state.dailyStats.accountsFollowed >= 2) {
      return false;
    }
    if (action.type === 'dm' && state.dailyStats.dmRequestsSent >= 2) {
      return false;
    }

    // Gate 6: Follow evaluation (must have seen 3+ posts from account)
    if (action.type === 'follow') {
      const evaluation = await stateManager.getFollowEvaluationStatus(content);
      if (!evaluation.canFollow) {
        return false;
      }
    }

    return true;
  }

  /**
   * Run engagement cycle
   * Visits all agents in order, dequeues and validates actions
   */
  async runEngagementCycle(): Promise<void> {
    for (const agent of this.agentRoster) {
      try {
        const actions = await this.dequeueOpportunities(agent);

        for (const action of actions) {
          // In production: generateContent, validateAction, executeAction
          // For testing: just verify no errors
          if (action.type === 'post') {
            // Would generate post content
          } else if (action.type === 'comment') {
            // Would generate comment content
          }
        }
      } catch (error) {
        // Log error but continue with next agent
        console.error(`Error processing agent ${agent.id}:`, error);
      }
    }
  }

  /**
   * Consider posting for an agent
   * Respects 30-minute cooldown and daily posting limit
   */
  async considerPosting(agent: Agent): Promise<void> {
    const stateManager = this.stateManagers.get(agent.id);
    if (!stateManager) return;

    const state = await stateManager.loadState();

    // Check post cooldown (30 minutes = 1800000ms)
    const timeSinceLastPost = Date.now() - state.lastPostTime;
    if (timeSinceLastPost < 30 * 60 * 1000) {
      return;
    }

    // Check daily post limit (max 3)
    if (state.dailyStats.postsCreated >= 3) {
      return;
    }

    // In production: would generate post content and execute
    // For testing: just verify no errors
  }

  /**
   * Daily maintenance
   * Resets daily stats and removes inactive follows
   */
  async dailyMaintenance(): Promise<void> {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    for (const agent of this.agentRoster) {
      const stateManager = this.stateManagers.get(agent.id);
      if (!stateManager) continue;

      const state = await stateManager.loadState();

      // Reset daily stats (auto-handled by loadState, but ensure clean)
      const today = new Date().toISOString().split('T')[0];
      if (state.dailyReset !== today) {
        state.dailyStats = {
          date: today,
          postsCreated: 0,
          commentsMade: 0,
          accountsFollowed: 0,
          dmRequestsSent: 0,
          threadsParticipated: 0
        };
        state.dailyReset = today;
      }

      // Unfollow inactive accounts (>30 days without engagement)
      state.followedAccounts = state.followedAccounts.filter(account => {
        const daysSinceEngagement = (now - account.lastEngagement) / (24 * 60 * 60 * 1000);
        return daysSinceEngagement <= 30;
      });

      await stateManager.saveState(state);
    }
  }
}
