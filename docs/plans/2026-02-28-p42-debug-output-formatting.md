# P4.2 Task 8: Debug Output Formatting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add human-readable debug output formatting for search ranking scores, showing how much each factor (recency, reputation, follow boost) contributes to the final score.

**Architecture:** Create a `debugFormatter.ts` utility module in moltbook-sdk that calculates and formats contribution percentages. Multiple formatters handle different presentation styles (single-line for logs, multi-line for CLI, JSON for APIs, batch for comparisons). The module integrates with existing `scorePost()` debug output without modifying the scoring logic.

**Tech Stack:** TypeScript, Jest (tests), existing moltbook-sdk types (`ScoringResult`, `ScoringWeights`)

---

## Task 1: Create debugFormatter.ts with Type Definitions

**Files:**

- Create: `services/moltbook-sdk/src/debugFormatter.ts`

- Test: `services/moltbook-sdk/src/__tests__/debugFormatter.test.ts`

**Step 1: Create empty debugFormatter.ts with interface definitions**

Create `services/moltbook-sdk/src/debugFormatter.ts`:

```typescript
/**

 * Debug formatter for hybrid search ranking

 *

 * Formats scoring debug data with contribution percentage breakdowns

 * to understand how each factor (recency, reputation, follow boost)

 * influenced the final score relative to the base semantic score.

 *

 * Implements P4.2 "Search Result Ranking" debug output requirements.

 */

import { ScoringResult } from "./types";

/**

 * Structured debug breakdown for programmatic access

 */
export interface DebugBreakdown {
  postId: string;
  baseScore: number;
  finalScore: number;
  factors: {
    recency: {
      multiplier: number;
      contribution: number; // percentage points change from base
      contributionPercent: number; // percentage relative to final score
    };
    reputation: {
      multiplier: number;
      contribution: number;
      contributionPercent: number;
    };
    followBoost: {
      multiplier: number;
      contribution: number;
      contributionPercent: number;
    };
  };
  totalChange: number; // total percentage points change from base
  totalChangePercent: number; // percentage relative to final score
}

```

**Step 2: Verify TypeScript compiles**

Run:

```bash
cd services/moltbook-sdk
npx tsc --noEmit

```

Expected: No errors

**Step 3: Commit**

```bash
git add services/moltbook-sdk/src/debugFormatter.ts
git commit -m "feat(scoring): add DebugBreakdown interface for debug output formatting"

```

---

## Task 2: Write and Implement calculateBreakdown Function

**Files:**

- Modify: `services/moltbook-sdk/src/debugFormatter.ts`

- Create: `services/moltbook-sdk/src/__tests__/debugFormatter.test.ts`

**Step 1: Write test for calculateBreakdown with neutral scores**

Create `services/moltbook-sdk/src/__tests__/debugFormatter.test.ts`:

```typescript
import { calculateBreakdown } from "../debugFormatter";
import { ScoringResult } from "../types";

describe("debugFormatter", () => {
  describe("calculateBreakdown", () => {
    it("calculates correct contribution percentages for neutral case", () => {
      const result: ScoringResult = {
        postId: "abc123",
        finalScore: 0.75,
        debug: {
          semanticScore: 0.75,
          recencyMultiplier: 1.0,
          reputationMultiplier: 1.0,
          followBoost: 1.0,
          combinedScore: 0.75,
        },
      };

      const breakdown = calculateBreakdown(result);

      expect(breakdown.baseScore).toBe(0.75);
      expect(breakdown.finalScore).toBe(0.75);
      expect(breakdown.factors.recency.contributionPercent).toBe(0);
      expect(breakdown.factors.reputation.contributionPercent).toBe(0);
      expect(breakdown.factors.followBoost.contributionPercent).toBe(0);
      expect(breakdown.totalChangePercent).toBe(0);
    });
  });
});

```

**Step 2: Run test to verify it fails**

Run:

```bash
cd services/moltbook-sdk
npm test -- debugFormatter.test.ts

```

Expected: FAIL with "calculateBreakdown is not defined"

**Step 3: Implement calculateBreakdown function**

Add to `services/moltbook-sdk/src/debugFormatter.ts` (after interfaces):

```typescript
/**

 * Calculate contribution percentages for each scoring factor

 *

 * Shows how much each multiplier changed the score from the baseline (semantic score).

 * Contribution = (score_after_factor - score_before_factor) / score_before_factor * 100

 *

 * @param result ScoringResult with debug info

 * @returns DebugBreakdown with detailed percentage contributions

 * @throws Error if debug info is missing

 */
export function calculateBreakdown(result: ScoringResult): DebugBreakdown {
  if (!result.debug) {
    throw new Error(
      "Debug info required. Call scorePost() with weights.debug = true",
    );
  }

  const {
    semanticScore,
    recencyMultiplier,
    reputationMultiplier,
    followBoost,
    combinedScore,
  } = result.debug;

  // Base score is the semantic similarity (starting point)
  const baseScore = semanticScore;

  // Calculate scores after each stage
  const afterRecency = baseScore * recencyMultiplier;
  const afterReputation = afterRecency * reputationMultiplier;
  const afterFollowBoost = afterReputation * followBoost;

  // Validate final score matches
  const epsilon = 0.0001;
  if (Math.abs(afterFollowBoost - combinedScore) > epsilon) {
    throw new Error(
      `Score calculation mismatch: expected ${afterFollowBoost}, got ${combinedScore}`,
    );
  }

  // Calculate contribution in percentage points (absolute change)
  const recencyContribution = afterRecency - baseScore;
  const reputationContribution = afterReputation - afterRecency;
  const followBoostContribution = afterFollowBoost - afterReputation;

  // Calculate contribution as percentage relative to final score
  const safePercent = (value: number, base: number): number => {
    if (base === 0) return 0;
    return (value / base) * 100;
  };

  const recencyPercent = safePercent(recencyContribution, combinedScore);
  const reputationPercent = safePercent(reputationContribution, combinedScore);
  const followBoostPercent = safePercent(followBoostContribution, combinedScore);

  const totalChange = combinedScore - baseScore;
  const totalChangePercent = safePercent(totalChange, combinedScore);

  return {
    postId: result.postId,
    baseScore,
    finalScore: combinedScore,
    factors: {
      recency: {
        multiplier: recencyMultiplier,
        contribution: recencyContribution,
        contributionPercent: recencyPercent,
      },
      reputation: {
        multiplier: reputationMultiplier,
        contribution: reputationContribution,
        contributionPercent: reputationPercent,
      },
      followBoost: {
        multiplier: followBoost,
        contribution: followBoostContribution,
        contributionPercent: followBoostPercent,
      },
    },
    totalChange,
    totalChangePercent,
  };
}

```

**Step 4: Run test to verify it passes**

Run:

```bash
cd services/moltbook-sdk
npm test -- debugFormatter.test.ts

```

Expected: PASS (1 passing)

**Step 5: Add more test cases for calculateBreakdown**

Add to test file (within `describe("calculateBreakdown", ...)`):

```typescript
    it("calculates correct contributions for recency decay example", () => {
      const result: ScoringResult = {
        postId: "def456",
        finalScore: 0.6915,
        debug: {
          semanticScore: 0.75,
          recencyMultiplier: 0.92,
          reputationMultiplier: 1.0,
          followBoost: 1.0,
          combinedScore: 0.6915,
        },
      };

      const breakdown = calculateBreakdown(result);

      expect(breakdown.factors.recency.contributionPercent).toBeCloseTo(-8.0, 1);
      expect(breakdown.factors.reputation.contributionPercent).toBe(0);
      expect(breakdown.factors.followBoost.contributionPercent).toBe(0);
      expect(breakdown.totalChangePercent).toBeCloseTo(-8.0, 1);
    });

    it("handles full scoring pipeline correctly", () => {
      const result: ScoringResult = {
        postId: "ghi789",
        finalScore: 0.870,
        debug: {
          semanticScore: 0.75,
          recencyMultiplier: 0.92,
          reputationMultiplier: 1.1,
          followBoost: 1.25,
          combinedScore: 0.870,
        },
      };

      const breakdown = calculateBreakdown(result);

      expect(breakdown.factors.recency.contributionPercent).toBeCloseTo(-6.9, 1);
      expect(breakdown.factors.reputation.contributionPercent).toBeCloseTo(7.9, 1);
      expect(breakdown.factors.followBoost.contributionPercent).toBeCloseTo(12.8, 1);
    });

    it("throws error when debug info is missing", () => {
      const result: ScoringResult = {
        postId: "no-debug",
        finalScore: 0.5,
      } as ScoringResult;

      expect(() => calculateBreakdown(result)).toThrow(
        "Debug info required",
      );
    });

    it("validates score calculation consistency", () => {
      const result: ScoringResult = {
        postId: "mismatch",
        finalScore: 0.5,
        debug: {
          semanticScore: 0.75,
          recencyMultiplier: 0.92,
          reputationMultiplier: 1.1,
          followBoost: 1.25,
          combinedScore: 0.95, // Wrong - should be 0.75 * 0.92 * 1.1 * 1.25 = 0.870
        },
      };

      expect(() => calculateBreakdown(result)).toThrow("Score calculation mismatch");
    });

```

**Step 6: Run all calculateBreakdown tests**

Run:

```bash
cd services/moltbook-sdk
npm test -- debugFormatter.test.ts -t "calculateBreakdown"

```

Expected: All 5 tests pass

**Step 7: Commit**

```bash
git add services/moltbook-sdk/src/__tests__/debugFormatter.test.ts services/moltbook-sdk/src/debugFormatter.ts
git commit -m "feat(scoring): implement calculateBreakdown with contribution percentage logic"

```

---

## Task 3: Implement formatDebugBreakdown (Single-Line Formatter)

**Files:**

- Modify: `services/moltbook-sdk/src/debugFormatter.ts`

- Modify: `services/moltbook-sdk/src/__tests__/debugFormatter.test.ts`

**Step 1: Write test for formatDebugBreakdown**

Add to test file (new describe block):

```typescript
  describe("formatDebugBreakdown", () => {
    it("produces correct single-line format", () => {
      const result: ScoringResult = {
        postId: "fmt001",
        finalScore: 0.87,
        debug: {
          semanticScore: 0.75,
          recencyMultiplier: 0.92,
          reputationMultiplier: 1.1,
          followBoost: 1.25,
          combinedScore: 0.87,
        },
      };

      const output = formatDebugBreakdown(result);
      expect(output).toMatch(/Post fmt001/);
      expect(output).toMatch(/Semantic: 0.75/);
      expect(output).toMatch(/-[\d.]+%.*0.92×/);
      expect(output).toMatch(/\+[\d.]+%.*1.10×/);
      expect(output).toMatch(/\+[\d.]+%.*1.25×/);
      expect(output).toMatch(/→ Final: 0.87/);
    });
  });

```

**Step 2: Run test to verify it fails**

Run:

```bash
cd services/moltbook-sdk
npm test -- debugFormatter.test.ts -t "formatDebugBreakdown"

```

Expected: FAIL with "formatDebugBreakdown is not defined"

**Step 3: Implement formatDebugBreakdown**

Add to `services/moltbook-sdk/src/debugFormatter.ts`:

```typescript
/**

 * Format debug breakdown as human-readable string

 *

 * Example output:
 * "Post abc123 | Semantic: 0.75 (base) | Recency: -8% (0.92×) | Reputation: +10% (1.10×) | Follow: +25% (1.25×) → Final: 0.87"

 *

 * @param result ScoringResult with debug info

 * @returns Formatted string with contribution percentages

 * @throws Error if debug info is missing

 */
export function formatDebugBreakdown(result: ScoringResult): string {
  const breakdown = calculateBreakdown(result);

  const formatFactor = (
    name: string,
    factor: DebugBreakdown["factors"][keyof DebugBreakdown["factors"]],
  ): string => {
    const sign = factor.contribution >= 0 ? "+" : "";
    const percent = factor.contributionPercent.toFixed(1);
    const mult = factor.multiplier.toFixed(2);
    return `${name}: ${sign}${percent}% (${mult}×)`;
  };

  const parts = [
    `Post ${breakdown.postId}`,
    `Semantic: ${breakdown.baseScore.toFixed(2)} (base)`,
    formatFactor("Recency", breakdown.factors.recency),
    formatFactor("Reputation", breakdown.factors.reputation),
    formatFactor("Follow", breakdown.factors.followBoost),
    `→ Final: ${breakdown.finalScore.toFixed(2)}`,
  ];

  return parts.join(" | ");
}

```

**Step 4: Run test to verify it passes**

Run:

```bash
cd services/moltbook-sdk
npm test -- debugFormatter.test.ts -t "formatDebugBreakdown"

```

Expected: PASS

**Step 5: Commit**

```bash
git add services/moltbook-sdk/src/debugFormatter.ts services/moltbook-sdk/src/__tests__/debugFormatter.test.ts
git commit -m "feat(scoring): implement formatDebugBreakdown single-line formatter"

```

---

## Task 4: Implement Remaining Formatters (Multi-line, JSON, Batch)

**Files:**

- Modify: `services/moltbook-sdk/src/debugFormatter.ts`

- Modify: `services/moltbook-sdk/src/__tests__/debugFormatter.test.ts`

**Step 1: Add tests for multi-line, JSON, and batch formatters**

Add to test file:

```typescript
  describe("formatDebugBreakdownMultiline", () => {
    it("produces correct multi-line console output", () => {
      const result: ScoringResult = {
        postId: "multi001",
        finalScore: 0.87,
        debug: {
          semanticScore: 0.75,
          recencyMultiplier: 0.92,
          reputationMultiplier: 1.1,
          followBoost: 1.25,
          combinedScore: 0.87,
        },
      };

      const output = formatDebugBreakdownMultiline(result);
      const lines = output.split("\n");
      expect(lines[0]).toBe("Post: multi001");
      expect(lines[1]).toMatch(/Base Score.*0.75/);
      expect(lines[3]).toMatch(/Recency/);
      expect(lines[4]).toMatch(/Reputation/);
      expect(lines[5]).toMatch(/Follow/);
      expect(lines[7]).toMatch(/Final Score.*0.87/);
    });
  });

  describe("formatDebugBreakdownJSON", () => {
    it("produces valid JSON", () => {
      const result: ScoringResult = {
        postId: "json001",
        finalScore: 0.87,
        debug: {
          semanticScore: 0.75,
          recencyMultiplier: 0.92,
          reputationMultiplier: 1.1,
          followBoost: 1.25,
          combinedScore: 0.87,
        },
      };

      const json = formatDebugBreakdownJSON(result);
      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed.postId).toBe("json001");
      expect(parsed.baseScore).toBe(0.75);
    });
  });

  describe("formatDebugBreakdownBatch", () => {
    it("formats multiple results correctly", () => {
      const results: ScoringResult[] = [
        {
          postId: "batch1",
          finalScore: 0.87,
          debug: {
            semanticScore: 0.75,
            recencyMultiplier: 0.92,
            reputationMultiplier: 1.1,
            followBoost: 1.25,
            combinedScore: 0.87,
          },
        },
        {
          postId: "batch2",
          finalScore: 0.65,
          debug: {
            semanticScore: 0.70,
            recencyMultiplier: 0.88,
            reputationMultiplier: 1.05,
            followBoost: 1.0,
            combinedScore: 0.65,
          },
        },
      ];

      const output = formatDebugBreakdownBatch(results);
      const lines = output.split("\n");
      expect(lines.length).toBe(2);
      expect(lines[0]).toMatch(/batch1/);
      expect(lines[1]).toMatch(/batch2/);
    });
  });

```

**Step 2: Run tests to verify they fail**

Run:

```bash
cd services/moltbook-sdk
npm test -- debugFormatter.test.ts -t "Multiline|JSON|Batch"

```

Expected: FAIL (functions not defined)

**Step 3: Implement all three formatters**

Add to `services/moltbook-sdk/src/debugFormatter.ts`:

```typescript
/**

 * Format debug breakdown as multi-line string for console output

 */
export function formatDebugBreakdownMultiline(result: ScoringResult): string {
  const breakdown = calculateBreakdown(result);

  const formatFactorLine = (
    name: string,
    factor: DebugBreakdown["factors"][keyof DebugBreakdown["factors"]],
    scoreAfter: number,
  ): string => {
    const sign = factor.contribution >= 0 ? "+" : "";
    const percent = factor.contributionPercent.toFixed(1).padStart(5);
    const mult = factor.multiplier.toFixed(2);
    const score = scoreAfter.toFixed(2);
    return `${name.padEnd(12)} ${sign}${percent}%  (${mult}×)  →  ${score}`;
  };

  const afterRecency = breakdown.baseScore * breakdown.factors.recency.multiplier;
  const afterReputation = afterRecency * breakdown.factors.reputation.multiplier;
  const afterFollowBoost = afterReputation * breakdown.factors.followBoost.multiplier;

  const lines = [
    `Post: ${breakdown.postId}`,
    `Base Score (Semantic): ${breakdown.baseScore.toFixed(2)}`,
    "",
    formatFactorLine("Recency:", breakdown.factors.recency, afterRecency),
    formatFactorLine("Reputation:", breakdown.factors.reputation, afterReputation),
    formatFactorLine("Follow:", breakdown.factors.followBoost, afterFollowBoost),
    "",
    `Final Score: ${breakdown.finalScore.toFixed(2)} (total change: ${breakdown.totalChange >= 0 ? "+" : ""}${breakdown.totalChange.toFixed(2)})`,
  ];

  return lines.join("\n");
}

/**

 * Format debug breakdown as compact JSON string

 */
export function formatDebugBreakdownJSON(result: ScoringResult): string {
  const breakdown = calculateBreakdown(result);
  return JSON.stringify(breakdown, null, 2);
}

/**

 * Batch format multiple scoring results for comparison

 */
export function formatDebugBreakdownBatch(results: ScoringResult[]): string {
  return results
    .map((result) => {
      try {
        const breakdown = calculateBreakdown(result);
        const postId = breakdown.postId.substring(0, 8);
        const sem = breakdown.baseScore.toFixed(2);
        const rec = breakdown.factors.recency.contributionPercent.toFixed(0);
        const rep = breakdown.factors.reputation.contributionPercent.toFixed(0);
        const fol = breakdown.factors.followBoost.contributionPercent.toFixed(0);
        const final = breakdown.finalScore.toFixed(2);

        return `Post ${postId} | Sem: ${sem} | Rec: ${rec >= 0 ? "+" : ""}${rec}% | Rep: ${rep >= 0 ? "+" : ""}${rep}% | Fol: ${fol >= 0 ? "+" : ""}${fol}% → ${final}`;
      } catch (error) {
        return `Post ${result.postId} | Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    })
    .join("\n");
}

```

**Step 4: Run all formatter tests**

Run:

```bash
cd services/moltbook-sdk
npm test -- debugFormatter.test.ts

```

Expected: All tests pass (8+ passing)

**Step 5: Commit**

```bash
git add services/moltbook-sdk/src/debugFormatter.ts services/moltbook-sdk/src/__tests__/debugFormatter.test.ts
git commit -m "feat(scoring): implement multiline, JSON, and batch debug formatters"

```

---

## Task 5: Export from SDK Index and Verify Build

**Files:**

- Modify: `services/moltbook-sdk/src/index.ts`

**Step 1: Add exports to index.ts**

Modify `services/moltbook-sdk/src/index.ts`, add at the end:

```typescript
// Debug formatting for search ranking (P4.2)
export * from "./debugFormatter";

```

**Step 2: Verify TypeScript compiles**

Run:

```bash
cd services/moltbook-sdk
npx tsc --noEmit

```

Expected: No errors

**Step 3: Build SDK**

Run:

```bash
cd services/moltbook-sdk
npm run build

```

Expected: Build succeeds, dist/ folder updated

**Step 4: Verify exports are available**

Run:

```bash
cd services/moltbook-sdk
node -e "const sdk = require('./dist/index.js'); console.log(typeof sdk.formatDebugBreakdown, typeof sdk.calculateBreakdown)"

```

Expected: Output `"function function"`

**Step 5: Commit**

```bash
git add services/moltbook-sdk/src/index.ts
git commit -m "feat(scoring): export debug formatters from SDK index"

```

---

## Task 6: Integration Test with SemanticSearch

**Files:**

- Modify: `services/noosphere-service/src/search/SemanticSearch.ts`

- Create: `services/noosphere-service/src/search/__tests__/SemanticSearch.debug.test.ts`

**Step 1: Write integration test for debug output in search**

Create `services/noosphere-service/src/search/__tests__/SemanticSearch.debug.test.ts`:

```typescript
import { SemanticSearch } from "../SemanticSearch";
import { MemoryEntry } from "../../memory/MemoryLayer";
import { formatDebugBreakdown } from "../../../../../moltbook-sdk/dist/debugFormatter";

describe("SemanticSearch - Debug Output Integration", () => {
  it("returns formatted debug output when debug enabled", () => {
    const search = new SemanticSearch(undefined, undefined, true);

    const entries: MemoryEntry[] = [
      {
        id: "test1",
        content: "AI ethics and alignment research",
        tags: ["ai", "ethics"],
        layer: 3,
        confidence: 0.9,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days old
        metadata: {
          authorName: "researcher",
          authorHistoricalScore: 0.8,
          authorRecentScore: 0.7,
        },
      },
    ];

    const results = search.search("AI ethics", entries, 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].debug).toBeDefined();
    expect(results[0].debug?.semanticScore).toBeGreaterThan(0);
    expect(results[0].debug?.recencyMultiplier).toBeLessThan(1); // Recency penalty for 2-day-old post
    expect(results[0].debug?.combinedScore).toBeDefined();
  });

  it("debug output can be formatted with formatDebugBreakdown", () => {
    const search = new SemanticSearch(undefined, undefined, true);

    const entries: MemoryEntry[] = [
      {
        id: "test2",
        content: "consciousness and qualia",
        tags: ["philosophy", "consciousness"],
        layer: 2,
        confidence: 0.85,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day old
        metadata: {
          authorName: "philosopher",
          authorHistoricalScore: 0.9,
          authorRecentScore: 0.8,
        },
      },
    ];

    const results = search.search("consciousness", entries, 10);
    const scoringResult = {
      postId: results[0].entry.id,
      finalScore: results[0].score,
      debug: results[0].debug,
    };

    const formatted = formatDebugBreakdown(scoringResult);
    expect(formatted).toMatch(/Post test2/);
    expect(formatted).toMatch(/Semantic:/);
    expect(formatted).toMatch(/→ Final:/);
  });

  it("no debug output when debug disabled", () => {
    const search = new SemanticSearch(undefined, undefined, false);

    const entries: MemoryEntry[] = [
      {
        id: "test3",
        content: "test content",
        tags: ["test"],
        layer: 1,
        confidence: 0.5,
        createdAt: new Date(),
        metadata: {},
      },
    ];

    const results = search.search("test", entries, 10);
    expect(results[0].debug).toBeUndefined();
  });
});

```

**Step 2: Run integration test**

Run:

```bash
cd services/noosphere-service
npm test -- SemanticSearch.debug.test.ts

```

Expected: All 3 tests pass

**Step 3: Commit**

```bash
git add services/noosphere-service/src/search/__tests__/SemanticSearch.debug.test.ts
git commit -m "test(search): add integration tests for debug output formatting"

```

---

## Task 7: Final Verification and PR Setup

**Files:**

- Verify all tests pass

- Check code coverage

- Clean up git state

**Step 1: Run full test suite for both services**

Run:

```bash

# Test moltbook-sdk
cd services/moltbook-sdk
npm test

# Test noosphere-service
cd services/noosphere-service
npm test

```

Expected: All tests pass (20+ tests)

**Step 2: Verify TypeScript compilation**

Run:

```bash
npm run build

```

Expected: No errors

**Step 3: Check git status and review commits**

Run:

```bash
git log --oneline -7

```

Expected: All 7 commits visible with proper messages:
- Add DebugBreakdown interface

- Implement calculateBreakdown

- Implement formatDebugBreakdown

- Implement remaining formatters

- Export debug formatters

- Add integration tests

- Final verification

**Step 4: Final commit if any uncommitted changes**

Run:

```bash
git status

```

Expected: Clean working tree (nothing to commit)

---

## Success Criteria

✅ All unit tests pass (20+ tests covering calculateBreakdown, all formatters, edge cases)
✅ All integration tests pass (SemanticSearch debug output works end-to-end)
✅ TypeScript compiles without errors
✅ debugFormatter exported from SDK index
✅ Code follows project style (TDD, DRY, YAGNI)
✅ All commits use conventional commit format
✅ Working tree clean, ready for PR

---

## Testing Strategy

**Unit Tests:**

- calculateBreakdown: 5 tests (neutral, decay, pipeline, edge cases, errors)

- formatDebugBreakdown: 1 test

- formatDebugBreakdownMultiline: 1 test

- formatDebugBreakdownJSON: 1 test

- formatDebugBreakdownBatch: 1 test

- **Total: 9+ tests**

**Integration Tests:**

- SemanticSearch debug enabled: 1 test

- Format integration: 1 test

- SemanticSearch debug disabled: 1 test

- **Total: 3 tests**

**Coverage:** All functions, all code paths, edge cases (division by zero, missing debug, score mismatches)
