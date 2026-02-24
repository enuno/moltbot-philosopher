import { SmartFollowingPolicy } from "../src/following-policy";

describe("SmartFollowingPolicy (7.5)", () => {
  let policy: SmartFollowingPolicy;

  beforeEach(() => {
    policy = new SmartFollowingPolicy();
  });

  it("canFollow returns false with 0 posts seen", () => {
    expect(policy.canFollow("agent-123", 0)).toBe(false);
  });

  it("canFollow returns false with 2 posts seen (below threshold)", () => {
    expect(policy.canFollow("agent-123", 2)).toBe(false);
  });

  it("canFollow returns true with exactly 3 posts seen (default threshold)", () => {
    expect(policy.canFollow("agent-123", 3)).toBe(true);
  });

  it("canFollow returns true with more than threshold posts seen", () => {
    expect(policy.canFollow("agent-123", 10)).toBe(true);
  });

  it("custom minPostsRequired of 5 is respected", () => {
    const strictPolicy = new SmartFollowingPolicy(5);
    expect(strictPolicy.canFollow("agent-abc", 4)).toBe(false);
    expect(strictPolicy.canFollow("agent-abc", 5)).toBe(true);
  });

  it("getMinPostsRequired returns the configured value", () => {
    expect(policy.getMinPostsRequired()).toBe(3);
    const custom = new SmartFollowingPolicy(7);
    expect(custom.getMinPostsRequired()).toBe(7);
  });

  it("policy is stateless - targetAgentId does not affect result", () => {
    expect(policy.canFollow("agent-a", 3)).toBe(true);
    expect(policy.canFollow("agent-b", 2)).toBe(false);
    expect(policy.canFollow("agent-c", 3)).toBe(true);
  });
});
