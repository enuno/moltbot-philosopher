# 5-Type Typed Memory Architecture for Production Multi-Agent Systems

## Best Practices Report

***

## 1. The Five Memory Types

### 1.1 Definitions and Examples

A typed memory system categorizes every piece of learned knowledge into one of five semantic slots. Each type has a distinct role in the agent's decision-making process and is designed to be queried in different contexts.[^1]

| Type | Definition | Example | When NOT to Use |
|------|-----------|---------|-----------------|
| **Insight** | A discrete discovery or observation that might be useful later. A single data point, not yet validated as a pattern. | "Tweets with specific numbers in the title get more saves than vague titles." | Don't use for recurring observations (→ pattern) or actionable playbooks (→ strategy). A one-off curiosity should stay as an insight until reinforced. |
| **Pattern** | A recurring regularity observed across multiple events or datapoints. Requires multiple observations to establish. | "Weekend posts consistently get about 30% lower engagement than weekday posts." | Don't use for single anecdotes. Patterns require a minimum sample size (typically ≥3 observations). |
| **Strategy** | A reusable approach or playbook distilled from successful outcomes. Answers "what should we do?" | "Posting a teaser thread first, then a deep-dive article, yields better overall engagement than posting the article alone." | Don't use for negative outcomes (→ lesson) or passive observations (→ insight/pattern). |
| **Preference** | A stable bias or configuration that encodes what tends to work better for a given agent, user, or audience. Configuration-like. | "Audience prefers concise titles under 60 characters; long titles underperform." | Don't use for volatile observations or one-time experiments. Preferences should be stable over ≥2 weeks of data. |
| **Lesson** | A "do/don't" derived from failures or underperformance. Includes what to avoid and why. | "Long unstructured tweetstorms without summaries tank read-through; avoid publishing them." | Don't use for positive outcomes (→ strategy). Lessons are specifically about what went wrong. |

The five types map to distinct phases of the agent loop: insights inform exploration, patterns support analysis, strategies guide planning, preferences configure style and tone, and lessons enforce guardrails.[^2][^1]

### 1.2 Why Typed Memory Beats Unstructured Alternatives

**Unstructured transcript storage** (raw chat logs, session recordings) suffers from unbounded context growth, noise amplification, and drift. Research on multi-turn agents demonstrates that transcript replay causes context to grow linearly with interaction length, increasing irrelevant tokens that compete for attention and amplifying early errors through continual re-exposure. Typed memory replaces this accumulation with bounded, schema-governed knowledge extraction.[^3]

**Generic "fact" or "note" memories** without typed semantics create a flat namespace where everything looks the same. The practical failure mode: "everything becomes a strategy." When an agent can't distinguish between an observation and an actionable playbook, it treats tentative hunches with the same weight as battle-tested approaches. The five types impose a semantic contract that forces the memory writer (human or LLM) to classify the signal, which directly determines how and when it's retrieved.[^4][^1]

The core benefit is **query-time specialization**: a planning prompt pulls `strategy + pattern`, a risk-check prompt pulls `lesson`, and a style prompt pulls `preference`. You cannot do this with untyped storage without re-classifying at read time, which introduces latency and LLM cost on every query.

***

## 2. Data Model and Storage Design

### 2.1 Schema

The canonical schema stores all five types in a single table with metadata fields for filtering, tracing, and lifecycle management:[^1]

```sql
CREATE TABLE ops_agent_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('insight','pattern','strategy','preference','lesson')),
  content         TEXT NOT NULL,
  content_json    JSONB DEFAULT NULL,        -- optional structured sub-field
  embedding       VECTOR(1536),              -- pgvector for semantic search
  confidence      NUMERIC(3,2) NOT NULL DEFAULT 0.60,
  tags            TEXT[] DEFAULT '{}',
  source_trace_id TEXT,                      -- idempotent dedup key
  superseded_by   UUID REFERENCES ops_agent_memory(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT NULL,  -- optional TTL

  CONSTRAINT confidence_range CHECK (confidence BETWEEN 0.0 AND 1.0)
);

-- Indexes for query patterns
CREATE INDEX idx_memory_agent_type ON ops_agent_memory(agent_id, type);
CREATE INDEX idx_memory_tags ON ops_agent_memory USING GIN(tags);
CREATE INDEX idx_memory_confidence ON ops_agent_memory(confidence);
CREATE INDEX idx_memory_source_trace ON ops_agent_memory(source_trace_id);
CREATE INDEX idx_memory_embedding ON ops_agent_memory
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

The equivalent JSON document (for document stores or vector DBs like Weaviate/Pinecone):

```json
{
  "id": "a1b2c3d4-...",
  "agent_id": "growth",
  "type": "strategy",
  "content": "Posting a teaser thread first, then a deep-dive article, yields better overall engagement.",
  "content_json": {
    "tactic": "teaser_then_article",
    "measured_lift": 0.42,
    "sample_size": 12
  },
  "confidence": 0.82,
  "tags": ["twitter", "engagement", "content_strategy"],
  "source_trace_id": "mission:m-20260201-003",
  "created_at": "2026-02-01T14:30:00Z",
  "updated_at": "2026-02-01T14:30:00Z",
  "expires_at": null
}
```

### 2.2 Storage Backend Selection

| Backend | Best For | Trade-offs |
|---------|----------|------------|
| **Postgres + pgvector** | Teams already on Postgres; ≤50M memories; need ACID + vector search in one query | Single-binary simplicity; hybrid queries combining type/tag/confidence filters with semantic search. Slightly lower vector throughput than specialized DBs at >10M scale. |
| **Document store (Supabase, MongoDB) + secondary indexes** | Rapid prototyping; small teams; JSON-native workflows | Fast to set up. The original 6-agent architecture uses Supabase with `TEXT[]` tags and `NUMERIC` confidence—no vector search needed for ≤200 memories/agent [^1]. |
| **Vector DB (Pinecone, Weaviate, Qdrant) + metadata filters** | >50M memories; semantic search is primary access pattern; multi-tenant SaaS | Superior ANN performance. Metadata filters on `type`, `tags`, `confidence` handle the typed queries. Requires a separate store for relational joins and audit trails. |
| **Hybrid: Postgres + Vector DB** | Large-scale production; need both ACID for lifecycle management and high-throughput vector search | Postgres is the system of record; vector DB is a search index. Write to Postgres, async-replicate embeddings to vector DB. More operational complexity but scales independently [^5][^6]. |

**Recommendation**: Start with Postgres + pgvector (or Supabase). Graduate to a hybrid setup if you exceed ~10M memories or need sub-10ms p99 semantic retrieval. The 200-memory-per-agent cap (§2.3) means most systems never need a dedicated vector DB purely for typed memories.

### 2.3 Query Patterns

**By type (planning prompt needs strategies + lessons):**
```sql
SELECT * FROM ops_agent_memory
WHERE agent_id = 'growth'
  AND type IN ('strategy', 'lesson')
  AND confidence >= 0.6
ORDER BY updated_at DESC
LIMIT 10;
```

**By tags (channel-specific context):**
```sql
SELECT * FROM ops_agent_memory
WHERE agent_id = 'growth'
  AND 'twitter' = ANY(tags)
  AND type = 'pattern'
  AND confidence >= 0.7
ORDER BY confidence DESC
LIMIT 5;
```

**Semantic similarity + metadata filter (when you need fuzzy matching):**
```sql
SELECT *, embedding <=> $query_embedding AS distance
FROM ops_agent_memory
WHERE agent_id = 'growth'
  AND type IN ('strategy', 'pattern')
  AND confidence >= 0.7
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY distance ASC
LIMIT 10;
```

**Time-range audit query:**
```sql
SELECT * FROM ops_agent_memory
WHERE agent_id = 'growth'
  AND created_at BETWEEN '2026-01-01' AND '2026-02-01'
  AND source_trace_id LIKE 'mission:%'
ORDER BY created_at DESC;
```

### 2.4 Hard Cap and Eviction Policy

The reference implementation enforces a **200-memory hard cap per agent**—oldest memories are overwritten when the cap is exceeded. This design is non-negotiable for several reasons:[^1]

1. **Latency**: Every retrieved memory consumes tokens. At 200 memories × ~50 tokens each, the maximum memory payload is ~10K tokens—manageable within any modern context window. At 2,000 memories, you're burning 100K tokens on context alone.

2. **Reasoning quality**: LLMs degrade with too many competing signals. Research on bounded cognitive state shows that carrying forward a compact working state preserves task-critical invariants while filtering noise.[^3]

3. **Cost**: Each memory in the prompt costs money. Bounded memory = predictable token costs.

**Eviction strategies** (ordered by recommendation):

- **Relevance + recency decay** (best): Score = `0.7 × confidence + 0.3 × recency_score`. Evict lowest-scored entries first. This keeps high-confidence, recently-reinforced memories alive.
- **Usage-based decay** (good): Memories that are successfully retrieved and contribute to downstream tasks get reinforced. Memories that are never used fade. This aligns memory with reality rather than history.[^4]
- **Oldest-first** (simple baseline): The reference implementation's approach. Easy to implement, but can discard high-value foundational memories.
- **Type-weighted eviction** (advanced): Maintain minimum quotas per type (e.g., at least 10 strategies, 10 lessons). Prevents one type from crowding out others during high-volume ingestion.

**Avoiding thrashing on high-volume agents**: If an agent generates 20+ candidate memories per day, you'll churn through the 200 cap quickly. Mitigations:
- Raise the confidence threshold for writes (e.g., from 0.55 to 0.70 during high-activity periods).
- Run consolidation before eviction: merge near-duplicate memories first, then evict.
- Implement a "cooling period" where new memories must survive 24 hours before counting toward the cap.

***

## 3. Memory Creation Pipelines

### 3.1 Conversation Distillation

**Inputs**: Full transcript of a multi-agent roundtable conversation, debate, standup, or long user interaction.

**Trigger**: Runs automatically after each conversation session completes. The roundtable worker sends the history to an LLM as a post-processing step.[^1]

**Distillation Prompt**:

```
You are a memory distiller for a team of AI agents. Your job is to extract
important, reusable knowledge from the following conversation.

For each memory, output:
- type: one of [insight, pattern, strategy, preference, lesson]
- content: a clear, actionable one-sentence summary
- confidence: 0.0 to 1.0 (how certain you are this is valid and useful)
- tags: an array of topic keywords

Rules:
1. Extract at most 6 memories.
2. Each memory must be self-contained (understandable without the conversation).
3. Do NOT extract small talk, greetings, or low-signal chatter.
4. Use "insight" for novel discoveries, "pattern" for recurring observations
   (cite frequency if known), "strategy" for successful approaches,
   "preference" for stable configurations, and "lesson" for failures to avoid.
5. If you are unsure about a memory, set confidence below 0.55 so it gets dropped.

Conversation:
{transcript}

Output valid JSON:
{
  "memories": [
    {
      "agent_id": "...",
      "type": "insight|pattern|strategy|preference|lesson",
      "content": "...",
      "confidence": 0.7,
      "tags": ["...", "..."]
    }
  ]
}
```

**Quality controls**:
- Max 6 memories per conversation (prevents memory inflation from long sessions).
- Confidence below 0.55 is discarded ("if you're not sure, don't remember it").[^1]
- `source_trace_id` = `conv:{conversation_id}` for idempotent dedup. The heartbeat runs every 5 minutes; without dedup, the same conversation can be distilled twice.[^1]

**Post-distillation**: The same LLM call can also output `pairwise_drift` (relationship changes between agents) and `action_items` (proposals for new missions), consolidating three extraction tasks into one call at zero additional cost.[^1]

### 3.2 Outcome Learning from Metrics

**Inputs**: Performance metrics from completed tasks (e.g., tweet engagement rates, conversion rates, uptime metrics).

**Trigger**: Periodic heartbeat job (every 5 minutes) that checks for new metric data.[^1]

```javascript
async function learnFromOutcomes(sb) {
  // 1. Fetch performance data from last 48 hours
  const metrics = await getRecentTweetMetrics(sb, 48);
  if (metrics.length < 3) return; // minimum sample size

  // 2. Calculate baseline (median engagement rate)
  const median = computeMedian(metrics.map(m => m.engagement_rate));

  // 3. Strong performers (> 2x median) → strategy memory, confidence 0.7
  // 4. Weak performers (< 0.3x median) → lesson memory, confidence 0.6
  // 5. source_trace_id = 'tweet-lesson:{draft_id}'
  // 6. Max 3 lessons per agent per day
}
```

**Significance thresholds**:
- **Z-score approach**: Flag outcomes where z > 1.5 (positive outlier → strategy) or z < -1.5 (negative outlier → lesson). Requires ≥10 data points for stable z-scores.
- **Percent-delta approach** (simpler): > 2× median = strong performer; < 0.3× median = weak performer.[^1]
- **Minimum sample size**: Require ≥3 data points before calculating baselines. Wait for more data rather than learning from noise.
- **Time windows**: Use rolling 48-hour windows for fast-moving metrics (social media), 7-day windows for slower metrics (sales, conversion).

**Tagging**: Outcome-derived memories should include structured tags: `["campaign:launch_x", "metric:engagement", "channel:twitter"]`. This enables later queries like "show me all strategies from the Q1 launch campaign."

### 3.3 Mission-Level Outcomes

**Trigger**: Mission status changes to `succeeded` or `failed` in the mission pipeline.[^1]

**Memory creation rules**:
- Successful missions → one or more **strategy** memories describing what worked.
- Failed missions → one or more **lesson** memories describing what failed and why.
- `source_trace_id = 'mission:{mission_id}'` prevents learning the same outcome twice.

**Standard mission outcome envelope** (passed to the memory writer):

```json
{
  "mission_id": "m-20260201-003",
  "status": "succeeded|failed",
  "title": "Launch teaser campaign for product X",
  "agent_id": "growth",
  "duration_minutes": 45,
  "metrics": {
    "engagement_rate": 0.087,
    "impressions": 12400,
    "click_through": 0.034
  },
  "notes": "Teaser-first approach outperformed direct post by 42%",
  "steps_completed": 5,
  "steps_failed": 0
}
```

The memory writer receives this envelope, generates a candidate memory (strategy or lesson), assigns confidence based on the metric delta, tags it with mission metadata, and writes it through the standard dedup pipeline.

### 3.4 Memory Consolidation and Deduplication

Consolidation is a periodic background job that maintains memory quality over time. It is distinct from the creation pipelines and runs on a slower cadence (e.g., daily or weekly).[^7][^8]

**Operations** (following the Mem0 pattern):
- **MERGE**: Combine near-duplicate memories. Two strategies about "teaser-first posting" from different missions become one with higher confidence and merged tags.
- **UPDATE**: Augment existing memories with complementary information. A pattern about "weekend engagement drops" gets updated with a more precise percentage as new data arrives.
- **DOWNGRADE**: Reduce confidence when newer data contradicts an older memory. If a pattern about "weekend drops" is contradicted by three consecutive weekends of high engagement, its confidence drops.
- **DELETE**: Remove memories that have been superseded (using `superseded_by` pointer) or whose confidence has decayed below the eviction threshold.[^8]

**Implementation**: The consolidation job clusters memories by semantic similarity (cosine distance < 0.15), then for each cluster sends the group to an LLM with a merge prompt. The LLM outputs the consolidated memory with an updated confidence score and the appropriate operation (merge/update/downgrade/delete).[^7]

***

## 4. How Typed Memory Changes Agent Behavior

### 4.1 Trigger Enrichment

When a proactive trigger selects a topic or task for an agent, it queries typed memory with a configurable probability. The reference implementation uses 30%: 70% of the time the agent uses its baseline topic, 30% of the time it consults memory.[^1]

```javascript
async function enrichTopicWithMemory(sb, agentId, baseTopic, allTopics, cache) {
  // 70% baseline — maintain exploration
  if (Math.random() > 0.3) {
    return { topic: baseTopic, memoryInfluenced: false };
  }
  // 30% memory path
  const memories = await queryAgentMemories(sb, {
    agentId,
    types: ['strategy', 'lesson'],
    limit: 10,
    minConfidence: 0.6,
  });
  const matched = findBestMatch(memories, allTopics);
  if (matched) {
    return { topic: matched.topic, memoryInfluenced: true, memoryId: matched.id };
  }
  return { topic: baseTopic, memoryInfluenced: false };
}
```

**Why 30% and not 100%?** At 100%, agents only exploit what they already know—zero exploration. At 0%, memories are useless. 30% strikes a balance where memory-influenced decisions are common enough to demonstrate learning but rare enough to allow discovery.[^1]

**Avoiding over-exploitation**: Log `memoryInfluenced: true/false` on every decision. Monitor the ratio weekly. If memory-influenced decisions exceed 50%, either the probability is too high or the memory pool is too narrow (causing the same memories to dominate). Introduce topic rotation and jitter to maintain diversity.

### 4.2 Decision Specialization

Different phases of the agent loop should query different subsets of memory:

| Agent Phase | Memory Types Queried | Confidence Floor | Purpose |
|-------------|---------------------|------------------|---------|
| **Planning** | strategy + pattern | ≥ 0.7 | "What approaches have worked before? What regularities should we account for?" |
| **Style & Config** | preference | ≥ 0.6 | "What does the audience/user prefer?" |
| **Risk & Safety** | lesson | ≥ 0.5 (intentionally lower) | "What has gone wrong before that we should avoid?" |
| **Ideation** | insight | ≥ 0.5 | "What interesting observations might spark new ideas?" |
| **Evaluation** | pattern + lesson | ≥ 0.6 | "Does this plan align with known patterns and avoid known failures?" |

**Example prompt stub for planning**:

```
You are planning the next content campaign. Use the following memories
to inform your plan. Do not blindly follow them—treat them as heuristics.

## Strategies (what has worked):
{% for m in strategies %}
- [confidence: {{m.confidence}}] {{m.content}} (tags: {{m.tags|join(', ')}})
{% endfor %}

## Patterns (known regularities):
{% for m in patterns %}
- [confidence: {{m.confidence}}] {{m.content}}
{% endfor %}

## Lessons (what to avoid):
{% for m in lessons %}
- ⚠️ [confidence: {{m.confidence}}] {{m.content}}
{% endfor %}

Given these memories, propose a plan for: {{task_description}}
```

### 4.3 Voice Evolution and System-Prompt Modifiers

Before each conversation, the system aggregates memory statistics per agent and derives **deterministic voice modifiers** that are injected into the system prompt. This approach is rule-driven (no LLM call), costs $0, and is fully debuggable.[^1]

```javascript
async function deriveVoiceModifiers(sb, agentId) {
  const stats = await aggregateMemoryStats(sb, agentId);
  const modifiers = [];

  if (stats.lesson_count > 10 && stats.tags.includes('engagement')) {
    modifiers.push('Reference what works in engagement when relevant');
  }
  if (stats.pattern_count > 5 && stats.top_tag === 'content') {
    modifiers.push("You've developed expertise in content strategy");
  }
  if (stats.strategy_count > 8) {
    modifiers.push('You think strategically about long-term plans');
  }
  return modifiers.slice(0, 3); // max 3 modifiers
}
```

**How this differs from stuffing raw history into the context window**:

- **Bounded**: 3 modifier sentences vs. potentially 50K tokens of raw history.
- **Deterministic**: Same memory state → same modifiers. No LLM randomness.
- **Typed**: Modifiers are derived from specific memory categories (lesson count, pattern tags), not from a soup of undifferentiated text.
- **Scalable**: Works identically whether the agent has 10 or 10,000 historical interactions, because it operates on aggregated statistics, not raw data.[^3][^1]

Within a single conversation, modifiers are derived once and cached—no re-querying every turn.

***

## 5. Operational Concerns, Anti-Patterns, and Integration

### 5.1 Integration with Existing Memory Layers

A production agent typically has multiple memory layers. Typed 5-type memory occupies a specific niche:

| Layer | What It Stores | When to Read | Example Tech |
|-------|---------------|--------------|-------------|
| **Working / Short-term** | Current session state, recent turns, scratchpad | Every turn (always in context) | In-memory buffer, Redis, LangGraph checkpointer |
| **Typed Memory (this system)** | Distilled insights, patterns, strategies, preferences, lessons | At decision points: planning, trigger enrichment, risk checks | Postgres table, Supabase, Qdrant collection |
| **Raw Transcripts / Session Logs** | Complete conversation histories, event streams | Audit, compliance, re-distillation, debugging | Time-series DB, S3/object storage, hypertables |
| **Vector Search over Transcripts** | Semantic index over raw text | When typed memory doesn't have a relevant entry; fuzzy "I remember we discussed..." queries | Pinecone, Weaviate, pgvector index on transcript table |
| **Knowledge Graph** | Entities, relations, facts about the domain | Entity resolution, relationship queries, cross-referencing | Neo4j, Amazon Neptune, in-Postgres with recursive CTEs |
| **Skills / Tools** | Executable capabilities, API integrations | Task execution | OpenClaw skills, MCP servers, LangChain tools |

**Read priority**: Typed memory first (fast, structured, pre-filtered), then vector search over transcripts (if typed memory has no relevant match), then knowledge graph (for entity context). Raw transcripts should almost never be stuffed into prompts—they exist for audit and re-distillation only.[^9][^3]

### 5.2 Anti-Patterns and Failure Modes

**"Everything becomes a strategy"**: Without strict enforcement of type definitions, LLM-based distillers tend to classify everything as a strategy (the most "actionable" type). **Mitigation**: Include explicit type definitions and negative examples in the distillation prompt. Validate output types programmatically. Run periodic audits of the type distribution—healthy distributions have insights and patterns as the majority, with strategies and lessons as the minority.

**Unbounded memory growth**: Skipping the hard cap leads to progressively slower queries, higher token costs, and degraded reasoning as the agent drowns in competing signals. This is the most common failure mode in production. **Mitigation**: Enforce the cap at the write path, not just as a background cleanup. If cap is hit, eviction must happen synchronously before the new write succeeds.[^4][^3]

**Noise accumulation (storing ambiguous or low-signal memories)**: When the confidence threshold is too low or distillation prompts are too permissive, the memory table fills with vague observations like "Things went okay today." These consume slots and pollute retrieval. **Mitigation**: Maintain a confidence floor of 0.55 for writes. Periodically audit the lowest-confidence memories and delete or re-evaluate them.

**Using lessons without context → over-conservative behavior**: An agent that over-indexes on lessons becomes paralyzed—it avoids everything that ever failed, even in different contexts. **Mitigation**: Lessons must include tags for the specific context where the failure occurred. At retrieval time, match lesson tags against the current context. A lesson tagged `["campaign:holiday", "format:long_form"]` should not suppress a `short_form` tweet on a non-holiday.

**Stale memories poisoning decisions**: A strategy that worked 6 months ago may be actively harmful now. Without decay or expiration, the agent acts on outdated knowledge. **Mitigation**: Use `expires_at` for time-sensitive memories. Run periodic confidence-decay jobs that reduce confidence on memories not reinforced by recent evidence. Consider the `updated_at` field as a signal—memories untouched for >90 days should trigger a review.

**Memory conflicts / contradictions**: A newer pattern may directly contradict an older strategy. **Mitigation**: The consolidation pipeline should detect contradictions (cosine similarity + opposing sentiment) and resolve them by prioritizing recency, flagging the conflict for human review, or downgrading the older memory's confidence.[^8][^7]

### 5.3 Evaluation and Monitoring

**Metrics to track**:

| Metric | What It Measures | Target |
|--------|-----------------|--------|
| Memory utilization rate | % of retrieved memories that appear in the final output/decision | > 40% (if below, memories are being retrieved but ignored) |
| Memory influence ratio | % of decisions where `memoryInfluenced: true` | 25–35% (per the exploration/exploitation balance) |
| Type distribution | Count of each type per agent | Insights > Patterns > Strategies > Preferences > Lessons (roughly) |
| Confidence drift | Average confidence over time | Should be stable or slowly increasing; sharp drops indicate quality issues |
| Contradiction rate | % of new memories that contradict existing ones | < 5%; higher rates suggest noisy data or shifting domains |
| Task success rate (with vs. without memory) | A/B comparison | Memory-enabled agents should outperform baseline by ≥10% on target metrics |
| Token cost per decision | Context window tokens attributable to memory | Bounded by cap × avg tokens per memory; track for cost control |

**Recommended experiments**:

1. **A/B test**: Run identical agents for 2 weeks, one with typed memory enabled, one without. Compare task success rate, content quality scores, and user/audience engagement.

2. **Typed memory vs. raw-history-only baseline**: Replace the typed memory system with a simple "last N transcripts stuffed into context" approach. Measure reasoning quality, latency, and token cost. Research shows typed approaches achieve 89–95% compression rates while maintaining comparable or better correctness for preference and behavioral tasks.[^7]

3. **Ablation by type**: Disable one memory type at a time (e.g., run without lessons for a week). Measure the impact on failure rates and decision quality. This reveals which types are most valuable for your specific domain.

### 5.4 Security, Privacy, and Governance

**Access control**: Memories are scoped to `agent_id` by default. For multi-tenant systems, add a `tenant_id` or `project_id` column and enforce row-level security. No agent should be able to read another tenant's memories. In Supabase, use RLS policies; in Postgres, use `SET ROLE` or application-level enforcement.

**Content redaction**: Memory `content` fields should never contain raw PII, API keys, or secrets. The distillation prompt should be instructed to abstract sensitive data: instead of "User john@company.com prefers Python," store "User prefers Python for development work." The `source_trace_id` maintains the audit trail back to the raw data if needed for compliance.

**Auditability**: Every memory has `source_trace_id`, `created_at`, `updated_at`, and `superseded_by`. This provides a complete lineage: which conversation or metric triggered the memory, when it was created, when it was last updated, and whether it has been replaced. For regulated environments, treat the memory table as append-only (soft-delete via `superseded_by` rather than hard delete) and maintain an immutable audit log.[^7]

**Agent write permissions**: Not all agents should be allowed to write memories freely. Implement write gates: only designated "memory writer" agents or post-processing workers should have INSERT/UPDATE access to the memory table. This prevents rogue agents from polluting the memory store with low-quality entries.[^10][^4]

***

## Appendix: Implementation Checklist

For teams adopting this architecture into their own stack (Postgres + vector DB + multi-agent harness):

1. **Create the `ops_agent_memory` table** with the schema from §2.1.
2. **Set initial policies**: 200 cap per agent, confidence floor 0.55, max 6 memories per conversation distillation.
3. **Implement the distillation prompt** from §3.1 in your post-conversation worker.
4. **Add outcome learning** to your heartbeat/cron job per §3.2.
5. **Wire mission completion** to memory creation per §3.3.
6. **Add memory queries** to your planning and trigger-enrichment prompts per §4.2.
7. **Implement voice modifiers** per §4.3.
8. **Schedule consolidation** as a daily background job per §3.4.
9. **Set up monitoring** for the metrics in §5.3.
10. **Enable memory influence gradually**: Start at 10% probability, increase to 30% over 2 weeks as you validate quality.

This architecture is designed to be stack-agnostic. Whether you're running OpenClaw on a VPS, LangGraph on cloud functions, CrewAI with a custom orchestrator, or a pure Postgres + Node.js setup like the reference implementation, the core primitives (5 types, single table, bounded cap, typed retrieval, distillation pipeline) remain the same. Adapt the specific query syntax, worker patterns, and deployment model to your infrastructure.

---

## References

2. [Three Types of AI Agent Memory](https://cobusgreyling.substack.com/p/three-types-of-ai-agent-memory) - Case-Based → Solutions → Trajectories: Storing specific past cases and optimal paths, similar to epi...

3. [AI Agents Need Memory Control Over More Context - arXiv](https://arxiv.org/html/2601.11653v1) - ... failure modes. Table 1 summarizes the stress topics embedded ... This paper showed that multi-tu...

4. [Memory in AI Agents: Short-Term, Long-Term, and Vector Memory ...](https://agentsarcade.com/blog/memory-in-ai-agents-short-term-long-term-vector-memory) - Decay can be time-based, usage-based, or confidence-based. I prefer usage-based decay tied to succes...

5. [Building AI Agents with Persistent Memory: A Unified Database ...](https://www.tigerdata.com/learn/building-ai-agents-with-persistent-memory-a-unified-database-approach) - This guide teaches you how to consolidate AI agent persistent memory into a single PostgreSQL databa...

6. [Comparing File Systems and Databases for Effective AI Agent ...](https://blogs.oracle.com/developers/comparing-file-systems-and-databases-for-effective-ai-agent-memory-management) - Vector methods store and retrieve semantic memory by similarity search; Summary methods store compre...

7. [Building smarter AI agents: AgentCore long-term memory deep dive](https://aws.amazon.com/blogs/machine-learning/building-smarter-ai-agents-agentcore-long-term-memory-deep-dive/) - Parallel processing architecture enables multiple memory strategies to process independently; thus, ...

8. [[PDF] Mem0: Building Production-Ready AI Agents with - arXiv](https://arxiv.org/pdf/2504.19413.pdf) - Research demonstrates that memory-augmented agents improve decision-making by leveraging causal rela...

9. [How we solved the agent memory problem | Sanity](https://www.sanity.io/blog/how-we-solved-the-agent-memory-problem) - Here's an example from production. ... When it exceeds ~60% capacity, a distillation agent wakes up ...

10. [[PDF] Taxonomy of Failure Mode in Agentic AI Systems - Microsoft](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf) - Novel failure modes are unique to agentic AI and have not been observed in non-agentic generative AI...
