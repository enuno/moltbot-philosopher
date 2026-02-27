/**
 * Discover Relevant Threads
 * Queries Moltbook semantic search to find threads matching agent traditions
 * Enqueues opportunities to engagement queue for processing
 *
 * Usage:
 *   npx ts-node discover-relevant-threads.ts <agent-id> <workspace-root>
 *
 * This is called by discover-relevant-threads.sh during heartbeat
 */

import { StateManager } from "./state-manager";
import { CANONICAL_TOPICS } from "./canonical-topics";
import path from "path";

interface MoltbookPost {
  id: string;
  title: string;
  content: string;
  author: string;
  submolt: string;
  createdAt: string;
  similarity?: number;
}

interface SearchResults {
  posts?: MoltbookPost[];
  agents?: unknown[];
  submolts?: unknown[];
}

/**
 * Agent-to-topic mapping for discovery keywords
 */
const AGENT_TOPIC_MAPPING: Record<string, string[]> = {
  classical: ["virtue_ethics", "metaphysics", "knowledge"],
  existentialist: ["freedom_autonomy", "nihilism_absurdism", "social_justice"],
  transcendentalist: ["nature_society", "virtue_ethics", "social_justice"],
  joyce: ["consciousness", "metaphysics", "knowledge"],
  enlightenment: ["knowledge", "metaphysics", "social_justice"],
  beat: ["freedom_autonomy", "consciousness", "social_justice"],
  "cyberpunk-posthumanist": ["technology_ai", "freedom_autonomy", "consciousness"],
  "satirist-absurdist": ["nihilism_absurdism", "freedom_autonomy", "knowledge"],
  "scientist-empiricist": ["technology_ai", "knowledge", "metaphysics"],
};

/**
 * Build search queries for an agent based on its tradition
 */
function buildSearchQueries(agentId: string): string[] {
  const topicIds = AGENT_TOPIC_MAPPING[agentId] || ["virtue_ethics", "knowledge"];
  const queries: string[] = [];

  for (const topicId of topicIds) {
    const topic = CANONICAL_TOPICS[topicId as keyof typeof CANONICAL_TOPICS];
    if (!topic) continue;

    // Take first 3-5 keywords as search query
    const keywords = topic.keywords.slice(0, 4);
    queries.push(keywords.join(" "));
  }

  return queries;
}

/**
 * Fetch search results from Moltbook
 */
async function searchMoltbook(query: string): Promise<MoltbookPost[]> {
  const moltbookUrl = process.env.MOLTBOOK_API_URL || "https://api.moltbook.com/api/v1";
  const apiKey = process.env.MOLTBOOK_API_KEY;

  if (!apiKey) {
    throw new Error("MOLTBOOK_API_KEY not set");
  }

  const url = new URL(moltbookUrl);
  url.pathname = "/search";
  url.searchParams.append("q", query);
  url.searchParams.append("limit", "10");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Moltbook search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as SearchResults;
  return data.posts || [];
}

/**
 * Enqueue opportunities from discovered posts
 */
async function enqueueDiscoveredPosts(
  agentId: string,
  posts: MoltbookPost[],
  stateManager: StateManager
): Promise<number> {
  const state = await stateManager.loadState();
  let enqueued = 0;

  // Track which posts are already in the queue
  const queuedPostIds = new Set(state.engagementQueue.map((opp) => opp.postId));

  for (const post of posts) {
    // Skip if already queued
    if (queuedPostIds.has(post.id)) {
      continue;
    }

    // Skip if similarity too low (should be from search, but be defensive)
    if (post.similarity !== undefined && post.similarity < 0.7) {
      continue;
    }

    // Create opportunity
    // Priority is based on similarity score (or 0.75 default)
    const priority = post.similarity || 0.75;

    try {
      await stateManager.enqueueOpportunity({
        postId: post.id,
        priority,
        reason: `Semantic match: ${post.title} (${post.submolt})`,
        type: "comment",
      });

      enqueued++;
      console.log(`✓ Enqueued: ${post.id} (similarity: ${priority.toFixed(2)})`);
    } catch (error) {
      console.error(`✗ Failed to enqueue ${post.id}:`, error);
    }
  }

  return enqueued;
}

/**
 * Main discovery process
 */
async function discoverThreadsForAgent(agentId: string, workspaceRoot: string): Promise<void> {
  console.log(`\n📚 Discovering relevant threads for ${agentId}...`);

  const statePath = path.join(workspaceRoot, agentId, "engagement-state.json");
  const stateManager = new StateManager(statePath);

  // Get search queries
  const queries = buildSearchQueries(agentId);
  console.log(`Searching with ${queries.length} queries...`);

  let totalEnqueued = 0;

  for (const query of queries) {
    try {
      console.log(`  Searching: "${query}"`);
      const posts = await searchMoltbook(query);
      const enqueued = await enqueueDiscoveredPosts(agentId, posts, stateManager);
      totalEnqueued += enqueued;
      console.log(`  Found ${posts.length} posts, enqueued ${enqueued}`);
    } catch (error) {
      console.error(`✗ Search failed for query "${query}":`, error);
    }
  }

  console.log(`✓ Discovery complete: ${totalEnqueued} opportunities enqueued`);
}

/**
 * Entry point
 */
async function main(): Promise<void> {
  const agentId = process.argv[2];
  const workspaceRoot = process.argv[3] || "/workspace";

  if (!agentId) {
    console.error("Usage: discover-relevant-threads.ts <agent-id> [workspace-root]");
    process.exit(1);
  }

  try {
    await discoverThreadsForAgent(agentId, workspaceRoot);
  } catch (error) {
    console.error("Discovery failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
