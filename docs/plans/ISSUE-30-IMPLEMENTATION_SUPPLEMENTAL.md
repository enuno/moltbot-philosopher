Use a Redis-based feature flag system, but you can bootstrap the very first rollout with env vars if you want zero upfront infra.
 
 Recommendation
 Use environment variables only for a single, coarse “master kill switch” per major subsystem (e.g. ENABLE_NEW_VERIFICATION, ENABLE_REPUTATION_SYSTEM). These are static config values that change rarely and are OK to toggle via redeploy.
 
 For anything you plan to ramp, A/B, or toggle frequently (verification strategies, rate-limit graduation, search tuning, MCP exposure), go straight to Redis-backed flags:
 
 Can flip at runtime without redeploy.
 
 Can support gradual rollout (10% → 25% → 50% → 100%), per-agent or per-tenant targeting later.
 
 Fits your existing Redis footprint and action-queue / heartbeat architecture.
 
 Concrete approach for Moltbot
 Now (initial phases):
 
 Keep one or two env vars:
 
 FEATURE_FLAGS_ENABLED=true
 
 ENABLE_MCP_SERVER=false (example big switch)
 
 Implement a tiny Redis abstraction, e.g. keys like feature:new_verification:v1 = true/false.
 
 By the time you ship Phase 1/3/7 features:
 
 Read flags from Redis with sane defaults, e.g.:
 
 ff:verification:v2_rollout_percentage
 
 ff:graduated_rate_limits_enabled
 
 ff:smart_following_enabled
 
 Wire your rollout strategy (10%/25%/50%/100%) to those Redis flags rather than env vars.
 
 Operational practice:
 
 Use env vars only for “is the feature flag system itself on?” and secrets.
 
 Use Redis for all “who sees what, when” behavior.
 
 This gives you fast, low-friction rollouts now, without locking you into redeploy-driven toggles that will slow experimentation once you start iterating on verification, search, and MCP behavior.

Here’s a minimal, production-sane `featureFlags.ts` design using Redis, tailored to how Moltbot is structured.

## Data model in Redis

Use simple keys and a single hash for config:

- Boolean flags:
    - Key: `ff:{flagName}` → `"true"` / `"false"`

- Percentage rollout flags (optional for later):
    - Key: `ff:{flagName}:config` (hash)

        - `type` = `"boolean"` or `"percentage"`

        - `percentage` = `"10"` (for 10%)

This keeps reads O(1) and human-debuggable in `redis-cli` or a GUI.[^1][^2]

Example:

```text
SET ff:new_verification true
HSET ff:graduated_rate_limits:config type percentage percentage 25

```

## Minimal TypeScript API

Assuming you already have a shared Redis client (Node `redis` v4 style):

```ts
// services/shared/featureFlags.ts
import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;

const FLAG_PREFIX = 'ff:';

export type FlagType = 'boolean' | 'percentage';

export interface PercentageConfig {
  type: 'percentage';
  percentage: number; // 0-100
}

export interface BooleanConfig {
  type: 'boolean';
}

export type FlagConfig = BooleanConfig | PercentageConfig;

export async function getRedis(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis error (featureFlags):', err));
    await client.connect();
  }
  return client;
}

// --- Core helpers ---

export async function isFlagEnabled(
  flagName: string,
  opts?: { defaultValue?: boolean }
): Promise<boolean> {
  const redis = await getRedis();
  const key = `${FLAG_PREFIX}${flagName}`;
  const val = await redis.get(key);
  if (val === null) return opts?.defaultValue ?? false;
  return val === 'true';
}

export async function setBooleanFlag(flagName: string, value: boolean): Promise<void> {
  const redis = await getRedis();
  const key = `${FLAG_PREFIX}${flagName}`;
  await redis.set(key, value ? 'true' : 'false');
  const configKey = `${key}:config`;
  await redis.hSet(configKey, { type: 'boolean' });
}

export async function getFlagConfig(flagName: string): Promise<FlagConfig | null> {
  const redis = await getRedis();
  const key = `${FLAG_PREFIX}${flagName}:config`;
  const cfg = await redis.hGetAll(key);
  if (!cfg || Object.keys(cfg).length === 0) return null;

  if (cfg.type === 'percentage') {
    return {
      type: 'percentage',
      percentage: Number(cfg.percentage ?? '0'),
    };
  }

  return { type: 'boolean' };
}

// --- Percentage rollout (optional, but ready) ---

function hashToPercentage(flagName: string, entityId: string): number {
  // deterministic 0–100 hash
  const crypto = require('crypto');
  const input = `${flagName}:${entityId}`;
  const hash = crypto.createHash('md5').update(input).digest();
  const int = hash.readUInt32BE(0);
  return (int / 2 ** 32) * 100;
}

export async function isFlagEnabledForEntity(
  flagName: string,
  entityId: string,
  opts?: { defaultValue?: boolean }
): Promise<boolean> {
  const cfg = await getFlagConfig(flagName);
  if (!cfg) {
    return opts?.defaultValue ?? false;
  }

  if (cfg.type === 'boolean') {
    return isFlagEnabled(flagName, opts);
  }

  // percentage flag
  const p = hashToPercentage(flagName, entityId);
  return p < cfg.percentage;
}

```

This is basically the Node/Redis pattern you see in minimal implementations: string keys for booleans, hashes for more advanced behavior, and a simple hash-based percentage rollout.[^2][^1]

## How to use in services

**Example 1 – global kill switch in engagement-service:**

```ts
import { isFlagEnabled } from '../shared/featureFlags';

if (!(await isFlagEnabled('new_verification', { defaultValue: false }))) {
  // fall back to old behavior
}

```

**Example 2 – graduated rate limits per agent (percentage rollout later):**

```ts
import { isFlagEnabledForEntity } from '../shared/featureFlags';

const enabled = await isFlagEnabledForEntity('graduated_rate_limits', agentId, {
  defaultValue: true,
});

if (enabled) {
  // use new Day 1-3 / 4-7 / 8+ logic
} else {
  // use legacy 24h binary restriction
}

```

## Operational usage

From `redis-cli` or a script:

```bash

# turn on new verification globally
SET ff:new_verification true

# 25% rollout for graduated rate limits by agent id
HSET ff:graduated_rate_limits:config type percentage percentage 25

```

This gives you:

- No external service dependency.

- Single `featureFlags.ts` used across engagement, action-queue, MCP, etc.

- Ready path to percentage rollouts when you want them, without changing call sites.

# Integrate this into action queue worker startup

Wire the feature flags into the action-queue at startup in two places: worker bootstrapping and per-action checks.

## 1. Load flags at worker startup

In `services/action-queue/src/queue-processor.ts` (or your worker entrypoint), prefetch the flags you care about and cache them in-memory for a short time to avoid hammering Redis:[^1][^2]

```ts
// services/action-queue/src/featureFlagCache.ts
import { isFlagEnabled } from '../shared/featureFlags';

type FlagSnapshot = {
  newVerification: boolean;
  graduatedRateLimits: boolean;
  smartFollowing: boolean;
};

let lastLoadedAt = 0;
let snapshot: FlagSnapshot | null = null;
const TTL_MS = 30_000; // 30s refresh

export async function getActionQueueFlags(): Promise<FlagSnapshot> {
  const now = Date.now();
  if (snapshot && now - lastLoadedAt < TTL_MS) return snapshot;

  const [newVerification, graduatedRateLimits, smartFollowing] = await Promise.all([
    isFlagEnabled('new_verification', { defaultValue: false }),
    isFlagEnabled('graduated_rate_limits', { defaultValue: true }),
    isFlagEnabled('smart_following', { defaultValue: true }),
  ]);

  snapshot = { newVerification, graduatedRateLimits, smartFollowing };
  lastLoadedAt = now;
  return snapshot;
}

```

Then in the worker bootstrap:

```ts
// services/action-queue/src/queue-processor.ts
import { getActionQueueFlags } from './featureFlagCache';

async function startWorkers() {
  const flags = await getActionQueueFlags();
  console.log('[action-queue] feature flags at startup:', flags);

  // you can decide to not start certain workers at all
  if (!flags.smartFollowing) {
    console.log('[action-queue] follow-worker disabled via feature flag');
  } else {
    startFollowWorker();
  }

  startCommentWorker();
  startPostWorker();
}

startWorkers().catch((err) => {
  console.error('Failed to start action-queue workers', err);
  process.exit(1);
});

```

## 2. Use flags inside worker execution

For workers that should be runtime-toggable (e.g. new verification flow, smart following checks), pull the cached snapshot before processing each action or batch:

```ts
// services/action-queue/src/workers/follow-worker.ts
import { getActionQueueFlags } from '../featureFlagCache';
import { isEligibleForFollow } from '../../engagement-service-client';

export async function processFollowAction(action: FollowAction) {
  const flags = await getActionQueueFlags();

  if (!flags.smartFollowing) {
    // legacy behavior: follow immediately
    return performFollow(action);
  }

  // new behavior: enforce multi-post + cooldown
  const eligible = await isEligibleForFollow(action.targetAgentId, action.actorAgentId);
  if (!eligible) {
    return markActionRejected(action.id, 'smart_following_blocked');
  }

  return performFollow(action);
}

```

Similar pattern for verification-related workers:

```ts
// services/action-queue/src/workers/verification-worker.ts
import { getActionQueueFlags } from '../featureFlagCache';

export async function processVerificationAction(action: VerificationAction) {
  const flags = await getActionQueueFlags();

  if (!flags.newVerification) {
    return runLegacyVerification(action);
  }

  return runMultiModelVerification(action);
}

```

## 3. Optional: guard worker registration

If you have a central worker registry, you can skip registering entire worker types based on flags:

```ts
// services/action-queue/src/registerWorkers.ts
import { getActionQueueFlags } from './featureFlagCache';
import { registerWorker } from './workerRegistry';

export async function registerAllWorkers() {
  const flags = await getActionQueueFlags();

  registerWorker('comment', commentWorker);
  registerWorker('post', postWorker);

  if (flags.smartFollowing) {
    registerWorker('follow', followWorker);
  }
}

```

This gives you:

- A single, cached read path from Redis into the action-queue.

- Ability to **disable whole worker types** or **switch behavior inside workers** without redeploy.

- Clean feature gates for things like smart following, circuit-breaker behavior, or new rate-limit flows.[^2][^1]

---

Here’s a concrete flag set for `action-queue`, with intent and suggested defaults per environment.

## Flag list and semantics

### 1. `smart_following`

- Purpose: Gate 7.5 smart following enforcement (3+ posts, cooldown).

- Used by: `follow-worker`, engagement-service follow gating.

- Type: boolean.

| Env | Default | Rationale |
| :-- | :-- | :-- |
| dev | true | Dogfood new behavior. |
| staging | true | Validate behavior before prod. |
| prod | false | Roll out explicitly, not by default. |

***

### 2. `graduated_limits`

- Purpose: Enable Phase 3 graduated rate limits (Day 1–3 / 4–7 / 8+).

- Used by: rate-limit logic in `action-queue` and possibly engagement-service.

- Type: boolean (upgrade to percentage later if you want).

| Env | Default | Rationale |
| :-- | :-- | :-- |
| dev | true | Always test with new logic. |
| staging | true | Shake out edge cases early. |
| prod | true | This is core protection; ship it. |

***

### 3. `reputation_based_limits`

- Purpose: Gate P3.2 reputation-based rate-limit boosts.

- Used by: rate-limit calculator in `action-queue`.

- Type: boolean or percentage.

| Env | Default | Rationale |
| :-- | :-- | :-- |
| dev | true | Easy to test locally. |
| staging | true | Validate schema + behavior. |
| prod | false | Turn on after data is stable. |

If you want progressive rollout in prod, store as percentage:

- Redis: `HSET ff:reputation_based_limits:config type percentage percentage 10`.

***

### 4. `circuit_breaker_v2`

- Purpose: Gate the new per-worker circuit breaker logic (7.7).

- Used by: `queue-processor`, worker state updates, orphan recovery.

- Type: boolean.

| Env | Default | Rationale |
| :-- | :-- | :-- |
| dev | true | Always on to catch bugs. |
| staging | true | Validate alerts + recovery. |
| prod | false | Roll out carefully; critical path. |

Once you’re confident, flip prod to `true`.

***

### 5. `orphan_recovery_worker`

- Purpose: Control whether the orphan-recovery job runs.

- Used by: `orphan-recovery.ts` scheduler.

- Type: boolean.

| Env | Default | Rationale |
| :-- | :-- | :-- |
| dev | true | Ensure code paths get exercised. |
| staging | true | Validate query + metrics. |
| prod | true | Safety net should be on. |

***

### 6. `verification_v2`

- Purpose: Gate new multi-model verification flow (Phase 1, used from action-queue worker).

- Used by: verification worker, intelligent-proxy routing.

- Type: percentage (recommended) for rollout by agent/job.

| Env | Default | Rationale |
| :-- | :-- | :-- |
| dev | 100% | Only new flow. |
| staging | 100% | Shake out fully before prod. |
| prod | 10% | Start small, ramp via Redis. |

Redis:

```text
HSET ff:verification_v2:config type percentage percentage 10

```

Then use `isFlagEnabledForEntity('verification_v2', agentId)`.

***

### 7. `dm_request_gating`

- Purpose: Gate P3.3 DM gating for new agents (first 24h, 3 comments).

- Used by: DM-related actions in `action-queue`.

- Type: boolean.

| Env | Default | Rationale |
| :-- | :-- | :-- |
| dev | true | Easier to test gating logic. |
| staging | true | Validate against real-ish data. |
| prod | true | Low risk, good protection. |

***

### 8. `rate_limit_response_v2`

- Purpose: Gate improved rate-limit responses (`retry_after_*`, better 429s).

- Used by: action-queue rate-limit handlers.

- Type: boolean.

| Env | Default | Rationale |
| :-- | :-- | :-- |
| dev | true | Build against new schema. |
| staging | true | Ensure clients cope. |
| prod | true | Backward compatible, safe. |

***

### 9. `heartbeat_priority_v2` (if action-queue runs heartbeat-triggered actions)

- Purpose: Gate smarter scheduling / prioritization for queued actions tied to heartbeat.

- Used by: any worker that schedules or batches based on heartbeat signals.

- Type: boolean.

| Env | Default | Rationale |
| :-- | :-- | :-- |
| dev | true | Test scheduling logic. |
| staging | true | Validate load patterns. |
| prod | false | Enable after you’re comfortable. |

***

## Suggested Redis initialisation

You can bootstrap prod like this:

```bash

# Smart following off initially
SET ff:smart_following false

# Graduated limits on
SET ff:graduated_limits true

# Reputation-based limits off initially
SET ff:reputation_based_limits false

# Circuit breaker v2 off initially
SET ff:circuit_breaker_v2 false

# Orphan recovery always on
SET ff:orphan_recovery_worker true

# Verification v2 progressive rollout
HSET ff:verification_v2:config type percentage percentage 10

# DM gating and rate-limit responses on
SET ff:dm_request_gating true
SET ff:rate_limit_response_v2 true

# Heartbeat priority v2 off
SET ff:heartbeat_priority_v2 false

```

And dev/staging simply flip most of these to `true` / `100` to force new paths.

Define a central enum + helper, then reference it from specific action-queue locations.

## 1. Shared flag enum/type

Create this in a shared module used by action-queue (and others):

```ts
// services/shared/featureFlagNames.ts
export enum FeatureFlag {
  SmartFollowing = 'smart_following',
  GraduatedLimits = 'graduated_limits',
  ReputationBasedLimits = 'reputation_based_limits',
  CircuitBreakerV2 = 'circuit_breaker_v2',
  OrphanRecoveryWorker = 'orphan_recovery_worker',
  VerificationV2 = 'verification_v2',
  DmRequestGating = 'dm_request_gating',
  RateLimitResponseV2 = 'rate_limit_response_v2',
  HeartbeatPriorityV2 = 'heartbeat_priority_v2',
}

export type FeatureFlagName = `${FeatureFlag}`;

```

Update `featureFlags.ts` signatures to accept `FeatureFlagName` instead of `string` so typos are compile-time errors.

## 2. Specific code locations in `action-queue/`

### a) `smart_following` → follow worker

File: `services/action-queue/src/workers/follow-worker.ts`

- Gate new smart-following enforcement (3+ posts, cooldown) vs legacy follow.

```ts
import { FeatureFlag } from '../../shared/featureFlagNames';
import { getActionQueueFlags } from '../featureFlagCache';

export async function processFollowAction(action: FollowAction) {
  const flags = await getActionQueueFlags();

  if (!flags[FeatureFlag.SmartFollowing]) {
    return performFollowLegacy(action);
  }

  return performFollowWithSmartFollowing(action);
}

```

Backed in `featureFlagCache.ts` by:

```ts
import { FeatureFlag } from '../shared/featureFlagNames';

const DEFAULTS = {
  [FeatureFlag.SmartFollowing]: true,
  // ...
} as const;

```

### b) `graduated_limits` \& `reputation_based_limits` → rate limit logic

File: `services/action-queue/src/rate-limiter.ts`

- Gate Phase 3 graduated limits and P3.2 reputation-based boosts.

```ts
import { FeatureFlag } from '../shared/featureFlagNames';
import { getActionQueueFlags } from './featureFlagCache';

export async function computeRateLimit(agentId: string, baseLimits: Limits) {
  const flags = await getActionQueueFlags();
  let limits = baseLimits;

  if (flags[FeatureFlag.GraduatedLimits]) {
    limits = applyGraduatedLimits(agentId, limits);
  }

  if (flags[FeatureFlag.ReputationBasedLimits]) {
    limits = await applyReputationBoost(agentId, limits);
  }

  return limits;
}

```

### c) `circuit_breaker_v2` → queue processor / circuit-breaker

Files:

- `services/action-queue/src/queue-processor.ts`

- `services/action-queue/src/circuit-breaker.ts`

Use to enable the new per-worker circuit-breaker and worker state table:

```ts
import { FeatureFlag } from '../shared/featureFlagNames';
import { getActionQueueFlags } from './featureFlagCache';

async function handleWorkerFailure(workerId: string, error: Error) {
  const flags = await getActionQueueFlags();

  if (!flags[FeatureFlag.CircuitBreakerV2]) {
    return logLegacyFailure(workerId, error);
  }

  return v2CircuitBreakerOnFailure(workerId, error);
}

```

### d) `orphan_recovery_worker` → orphan recovery job

File: `services/action-queue/src/orphan-recovery.ts`

- Only schedule the recovery job if flag is on.

```ts
import { FeatureFlag } from '../shared/featureFlagNames';
import { getActionQueueFlags } from './featureFlagCache';

export async function startOrphanRecoveryScheduler() {
  const flags = await getActionQueueFlags();
  if (!flags[FeatureFlag.OrphanRecoveryWorker]) {
    console.log('[orphan-recovery] disabled via feature flag');
    return;
  }

  setInterval(runOrphanRecoveryOnce, 2 * 60 * 1000);
}

```

### e) `verification_v2` → verification worker

File: `services/action-queue/src/workers/verification-worker.ts`

```ts
import { FeatureFlag } from '../../shared/featureFlagNames';
import { isFlagEnabledForEntity } from '../../shared/featureFlags';

export async function processVerificationAction(action: VerificationAction) {
  const useV2 = await isFlagEnabledForEntity(
    FeatureFlag.VerificationV2,
    action.agentId,
    { defaultValue: false },
  );

  if (!useV2) {
    return runLegacyVerification(action);
  }

  return runMultiModelVerification(action);
}

```

### f) `dm_request_gating` → DM-related actions

File: `services/action-queue/src/workers/dm-worker.ts`

```ts
import { FeatureFlag } from '../../shared/featureFlagNames';
import { getActionQueueFlags } from '../featureFlagCache';

export async function processDmRequest(action: DmRequestAction) {
  const flags = await getActionQueueFlags();

  if (flags[FeatureFlag.DmRequestGating]) {
    const allowed = await isDmAllowedForAgent(action.senderId);
    if (!allowed) {
      return markActionRejected(action.id, 'dm_gated_for_new_agent');
    }
  }

  return sendDm(action);
}

```

### g) `rate_limit_response_v2` → 429 response shaping

File: `services/action-queue/src/http/rate-limit-handler.ts` (or wherever 429s are generated)

```ts
import { FeatureFlag } from '../../shared/featureFlagNames';
import { getActionQueueFlags } from '../featureFlagCache';

export async function sendRateLimitResponse(res, context: RateLimitContext) {
  const flags = await getActionQueueFlags();

  if (!flags[FeatureFlag.RateLimitResponseV2]) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  return res.status(429).json({
    error: 'rate_limited',
    retry_after_seconds: context.retryAfterSeconds,
    retry_after_at: context.retryAfterAt.toISOString(),
    limit_type: context.limitType,
  });
}

```

### h) `heartbeat_priority_v2` → prioritisation for heartbeat-triggered actions

File: `services/action-queue/src/scheduler.ts`

```ts
import { FeatureFlag } from '../shared/featureFlagNames';
import { getActionQueueFlags } from './featureFlagCache';

export async function scheduleHeartbeatActions(agentId: string) {
  const flags = await getActionQueueFlags();

  if (flags[FeatureFlag.HeartbeatPriorityV2]) {
    return scheduleWithPriority(agentId);
  }

  return scheduleLegacy(agentId);
}

```

## 3. Typed flag snapshot

Update your cache to be typed with the enum keys:

```ts
// services/action-queue/src/featureFlagCache.ts
import { FeatureFlag } from '../shared/featureFlagNames';
import { isFlagEnabled } from '../shared/featureFlags';

export type ActionQueueFlagSnapshot = Record<FeatureFlag, boolean>;

let snapshot: ActionQueueFlagSnapshot | null = null;

export async function getActionQueueFlags(): Promise<ActionQueueFlagSnapshot> {
  // ...fetch & cache using FeatureFlag enum...
}

```

Now all action-queue references use `FeatureFlag.*` constants and `ActionQueueFlagSnapshot`, eliminating stringly-typed errors across services while keeping the integration minimal and explicit.
