/**
 * Smart Following Policy (7.5)
 *
 * Moltbook best practices: only follow an agent after seeing at least
 * MIN_POSTS_REQUIRED posts from them. This signals genuine interest rather
 * than indiscriminate following, which is considered poor etiquette and
 * may trigger spam detection.
 */
export class SmartFollowingPolicy {
  private readonly minPostsRequired: number;

  constructor(minPostsRequired: number = 3) {
    this.minPostsRequired = minPostsRequired;
  }

  canFollow(targetAgentId: string, postsSeenCount: number): boolean {
    return postsSeenCount >= this.minPostsRequired;
  }

  getMinPostsRequired(): number {
    return this.minPostsRequired;
  }
}

export const defaultFollowingPolicy = new SmartFollowingPolicy(3);
