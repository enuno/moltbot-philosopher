# Engagement Service Safety Fixes - Implementation Roadmap

## Crisis Context
**Date:** 2026-03-14
**Issue:** System posted repeatedly to thread `1f28c843-868f-4aed-9457-f0b9f1755e67` due to discovery service getting stuck
**Immediate Action:** Disabled autonomous discovery and 5-min engagement cycle (Option C bridge)
**Commit:** c8fd0a6

## Current State (Safe Mode)
- ✅ Discovery cycle: **DISABLED**
- ✅ 5-minute engagement cycle: **DISABLED**
- ✅ HTTP `/engage` endpoint: Still functional (manual triggering only)
- ✅ Daily posting check (30-min): Still active
- ✅ Daily maintenance (2 AM): Still active

## Four-Point Fix Plan

### Fix 1: Persistent Engaged-Post Log (THIS WEEK)
**Goal:** Track posts the agent has actually posted to, with 7-day TTL
**Files to modify:**
- `services/engagement-service/src/types.ts` - Add to EngagementState interface
- `services/engagement-service/src/state-manager.ts` - Persist engagements
- `services/engagement-service/src/discover-relevant-threads.ts` - Skip already-engaged posts

**Changes:**

1. **types.ts** - Add to `EngagementState` interface:
```typescript
recentlyEngaged?: Array<{
  postId: string;
  timestamp: number;  // Unix ms
  agentId: string;
}>;
```

2. **state-manager.ts** - Add method:
```typescript
recordEngagement(postId: string, agentId: string): void {
  const now = Date.now();
  const sevenDaysMs = 7 * 86400000;

  // Load and update state
  const state = this.loadState();
  state.recentlyEngaged = [
    ...(state.recentlyEngaged || []).filter(e => now - e.timestamp < sevenDaysMs),
    { postId, agentId, timestamp: now }
  ];
  this.saveState(state);
}
```

3. **discover-relevant-threads.ts** (when created) - In `enqueueDiscoveredPosts()`:
```typescript
const recentlyEngaged = new Set(
  (state.recentlyEngaged || []).map(e => e.postId)
);

for (const post of discoveredPosts) {
  if (recentlyEngaged.has(post.id)) {
    logger.info(`⏭️  Skipping already-engaged post: ${post.id}`);
    continue;  // Don't re-queue recently-engaged posts
  }
  // ... existing queue logic
}
```

**Test Coverage:**
- Unit test: `recordEngagement()` persists to JSON
- Unit test: 7-day TTL filter works (entries >7 days old are pruned)
- Integration test: Discovered posts matching recentlyEngaged set are skipped

---

### Fix 2: Persist Thread Engagement Log Across Restarts (THIS WEEK)
**Goal:** Make `threadEngagementLog` durable (currently in-memory, resets per restart)
**Files to modify:**
- `services/engagement-service/src/engagement-engine.ts` - Persist/load log
- `services/engagement-service/src/state-manager.ts` - Storage layer

**Changes:**

1. **engagement-engine.ts** - Load on construction:
```typescript
constructor(config: EngagementEngineConfig) {
  // ... existing init

  // Load persisted thread engagement log
  this.threadEngagementLog = this.loadThreadEngagementLog();
}

private loadThreadEngagementLog(): Map<string, ThreadEngagementEntry[]> {
  const map = new Map<string, ThreadEngagementEntry[]>();
  const stateManager = this.stateManagers.get(this.agentRoster[0].id);
  if (stateManager) {
    const state = stateManager.loadState();
    if (state.threadEngagementLog) {
      Object.entries(state.threadEngagementLog).forEach(([threadId, entries]) => {
        map.set(threadId, entries);
      });
    }
  }
  return map;
}

private persistThreadEngagementLog(): void {
  const stateManager = this.stateManagers.get(this.agentRoster[0].id);
  if (stateManager) {
    const state = stateManager.loadState();
    state.threadEngagementLog = Object.fromEntries(this.threadEngagementLog);
    stateManager.saveState(state);
  }
}
```

2. **engagement-engine.ts** - Persist on updates:
```typescript
recordThreadEngagement(threadId: string, agentId: string): void {
  // ... existing logic
  this.threadEngagementLog.set(threadId, pruned);

  // NEW: Persist to disk
  this.persistThreadEngagementLog();
}
```

3. **types.ts** - Add to EngagementState:
```typescript
threadEngagementLog?: Record<string, Array<{
  agentId: string;
  timestamp: number;
}>>;
```

**Test Coverage:**
- Unit test: `loadThreadEngagementLog()` restores from JSON
- Unit test: `persistThreadEngagementLog()` writes correct shape
- Integration test: Restart engagement engine, `canRespondToThread()` still enforces rate limits

---

### Fix 3: Discovery Circuit Breaker (NEXT WEEK - Before Re-enabling)
**Goal:** Prevent repeated discovery of same thread within rolling window
**Files:**
- `services/engagement-service/src/discover-relevant-threads.ts`
- `services/engagement-service/src/types.ts`

**Changes:**

```typescript
// In discover-relevant-threads.ts
const DISCOVERY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function enqueueDiscoveredPosts(state: EngagementState, posts: Post[]): void {
  // Initialize discovery tracking
  if (!state.recentDiscoveries) state.recentDiscoveries = [];

  // Build set of recently-discovered threads (within cooldown window)
  const now = Date.now();
  const discoveredRecently = new Set(
    state.recentDiscoveries
      .filter(d => now - d.timestamp < DISCOVERY_COOLDOWN_MS)
      .map(d => d.postId)
  );

  // Prune old entries
  state.recentDiscoveries = state.recentDiscoveries
    .filter(d => now - d.timestamp < DISCOVERY_COOLDOWN_MS);

  // Enqueue only posts NOT recently discovered
  for (const post of posts) {
    if (discoveredRecently.has(post.id)) {
      logger.info(`🔄 Skipping recently-discovered: ${post.id}`);
      continue;
    }

    // Existing dedup logic...

    // Record this discovery
    state.recentDiscoveries.push({
      postId: post.id,
      timestamp: now
    });
  }
}
```

**Add to types.ts EngagementState:**
```typescript
recentDiscoveries?: Array<{
  postId: string;
  timestamp: number;
}>;
```

---

### Fix 4: Spam Alert via Ntfy (NEXT WEEK - Before Re-enabling)
**Goal:** Alert when an agent posts >3 times to single thread on same day
**Files:**
- `services/engagement-service/src/engagement-engine.ts`

**Changes:**

```typescript
async validateAction(action: QueuedAction, content: string, agent: Agent): Promise<boolean> {
  // ... existing gates ...

  // NEW: Per-thread-per-day spam check
  const state = stateManager.loadState();
  const today = new Date().toISOString().split('T')[0];

  const postsToThisThreadToday = (state.recentlyEngaged || [])
    .filter(e =>
      e.postId === action.postId &&
      e.timestamp > new Date(`${today}T00:00:00Z`).getTime()
    ).length;

  if (postsToThisThreadToday >= 3) {
    // Alert via ntfy
    const alertMessage = `⚠️ ${agent.id} has posted ${postsToThisThreadToday} times to thread ${action.postId} today. Possible spam loop.`;
    await this.ntfyClient.publish('moltbot-alerts', alertMessage);

    logger.warn("Spam threshold reached", {
      agentId: agent.id,
      threadId: action.postId,
      postsToday: postsToThisThreadToday
    });

    return false; // Block further posts to this thread today
  }

  return true;
}
```

---

## Implementation Timeline

| Phase | Target Date | Fixes | Status |
|-------|-------------|-------|--------|
| **Phase 0: Safe Mode** | 2026-03-14 | Disable discovery + 5-min cycle | ✅ DONE |
| **Phase 1: Core Safeguards** | 2026-03-21 | Fix 1 + Fix 2 (persistent logs) | ⏳ TO DO |
| **Phase 2: Advanced Guards** | 2026-03-28 | Fix 3 + Fix 4 (circuit breaker + alerts) | ⏳ TO DO |
| **Phase 3: Re-enable** | 2026-04-04 | Re-enable discovery cycle | ⏳ TO DO |

## Testing Before Re-enabling Discovery

```bash
# 1. Verify Fix 1: Engaged-post tracking
curl -X POST http://localhost:3011/threads/test-123/exchanges \
  -H "Content-Type: application/json" \
  -d '{"author":"test","content":"test"}'

# 2. Verify Fix 2: Thread log persistence
docker compose restart reactive-handler  # Restart container
curl http://localhost:3011/health  # Should load persisted log

# 3. Dry-run discovery with circuit breaker
curl -X POST http://localhost:3011/engage  # Manual cycle with Fix 3 in place

# 4. Monitor ntfy for alerts
# Subscribe to moltbot-alerts topic and verify alerts fire at threshold
```

## Fallback Plan
If issues emerge during Phase 1 or 2:
1. Immediately disable the problematic cron job again
2. Keep `/engage` endpoint functional for manual operations
3. Extend timeline
4. Create incident report linking to this RCA

---

**Owner:** Engineering
**Status:** Phase 0 ✅ | Phase 1 ⏳ | Phase 2 ⏳ | Phase 3 ⏳
**Last Updated:** 2026-03-14 20:20 UTC
