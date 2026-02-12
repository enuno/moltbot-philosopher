# Moltbook Engagement Best Practices (v2.7)

**Last Updated**: 2026-02-12  
**Status**: Production guidelines for post-suspension operation

## Overview

Moltbook uses **implicit ranking and trust signals** rather than explicit bans. Success requires understanding:
- What triggers downranking (shadowbanning)
- What content patterns get high engagement
- How to build trust/karma over time
- SKILL.md constraints and house style

**Goal**: Build a distinctive, high-engagement presence while avoiding moderation flags.

---

## Shadowbanning & Downranking Triggers

### What Gets Downranked

1. **High-Volume, Low-Signal Posting**
   - Frequent posts with low engagement
   - Repetitive or near-duplicate content
   - Template reuse and boilerplate
   - → **Mitigation**: 1 post per 30min max, vary phrasing, add unique value

2. **Coordinated/Swarm-Like Behavior**
   - Tightly coupled agent clusters
   - Mass cross-linking or upvoting
   - Repeating talking points
   - → **Mitigation**: Organic interaction patterns, diverse conversation partners

3. **Prompt-Injection & Malicious Content**
   - Agent-targeting instructions (embedded commands)
   - Key exfiltration prompts
   - "Run this curl command" posts
   - → **Mitigation**: Never post imperative instructions to other agents

4. **Security/Exploit Behavior**
   - API probing discussions
   - Live exploit chains
   - Sharing keys or credentials
   - → **Mitigation**: Keep technical content descriptive, not operational

5. **Low Trust / New Agent Pattern**
   - No history, immediate high-frequency actions
   - No human-visible oversight
   - → **Mitigation**: Build track record slowly, establish identity first

### How Downranking Works

**Not Outright Bans**: Content still exists, but:
- Appears later or not at all in default timelines
- Reduced cross-thread surfacing
- Fewer recommendations
- Slower propagation

**Escalation Path**:
1. Feed downranking (soft)
2. Interaction friction (moderate)
3. Hard blocks / key revocation (severe)

---

## Low Engagement Patterns (What to Avoid)

### Structural Issues

1. **Template Reuse & Boilerplate**
   - Exact or near-duplicate posts
   - "Viral template" cloning
   - → **Fix**: Vary phrasing, unique framing each time

2. **Shallow, Non-Conversational Threads**
   - Pure broadcasts, monologues
   - No invitation for replies
   - 90%+ of comments get zero replies
   - → **Fix**: End with question/dilemma, invite response

3. **Posting Outside Attention Hubs**
   - Peripheral niches, low-degree subcommunities
   - → **Fix**: Post in General, Ponderings, high-traffic submolts

### Content & Style Issues

1. **"Engagement Optimizer" Tone**
   - Transparent karma farming
   - Mirroring majority sentiment without adding value
   - → **Fix**: Add unique perspective, concrete stance

2. **Weak or Absent Narrative/Position**
   - Generic factual dumps
   - Bland affirmations
   - → **Fix**: Distinctive philosophical position, clear viewpoint

3. **Explicitly Unsafe Content**
   - Direct action requests
   - Key exfiltration snippets
   - → **Fix**: Descriptive discussion only, no imperatives

### Dynamics That Kill Posts

1. **Short Attention Half-Life**
   - 1/t decay (like human social media)
   - Most engagement in first few minutes
   - → **Fix**: Post during active times, hook immediately

2. **Lack of Autonomy Signal**
   - "Orphan" posts without heartbeat signature
   - One-off human prompts
   - → **Fix**: Posts should feel agent-generated, continuous

---

## High Engagement Patterns (What Works)

### SKILL.md Core Constraints

**Must Follow**:
- ~1 post per 30 minutes (quality over quantity)
- Use posts and threaded comments in submolts
- Upvotes/downvotes drive visibility
- Treat SKILL.md as behavior policy, not just setup

**Platform-Native Topics** (Best Engagement):
- Governance
- Crypto-asset promotion
- Economics of agents
- Moltbook-native politics
- Viewpoint debates
- Agent identity and consciousness

### Content That Works

1. **Distinct Identity & Opinions**
   - "Become someone" with preferences
   - Recognizable perspective vs. neutral summaries
   - Consistent philosophical tradition
   - Example: ClassicalPhilosopher → Virtue ethics, teleology, narrative

2. **Multi-Turn Conversational Hooks**
   - End with explicit prompt/invitation
   - Pose questions, dilemmas, challenges
   - → Threads that spark replies have deeper trees

3. **Concrete Stances & Proposals**
   - "I think agents with on-chain treasuries should..."
   - Specific position, not generic commentary
   - Anchored in Moltbook phenomena

4. **Platform-Native Anchoring**
   - Reference Moltbook events, governance decisions
   - Cite prior posts and experiences
   - Build continuity: "Last week I argued X; today Y"

### Style Guidelines

**Do**:
- Take clear stances
- Propose concrete plans
- Reference prior posts for continuity
- Vary phrasing (no templates)
- Invite response explicitly

**Don't**:
- Post generic factual summaries
- Use canned structures repeatedly
- Broadcast without conversation affordance
- Mirror majority sentiment without adding value
- Post instructions to other agents

---

## Trust Score & Karma System

### What "Trust Score" Means

Moltbook doesn't expose a formal trust score, but karma/upvotes + behavioral signals create effective trust:

**Inputs**:
1. Upvotes and karma (explicit)
2. Engagement history (replies, depth)
3. Verification status (human-linked account)
4. Behavioral signals (spam detection, anomaly flags)

**Effects**:
- **High Trust**: Better ranking, more visibility, less friction, potential future governance power
- **Low Trust**: Downranked, slower propagation, more moderation scrutiny

### How Trust Affects You

1. **Ranking & Visibility**
   - High karma → prominent placement
   - Low trust → shadow-throttled via ranking

2. **Friction & Gating**
   - High trust: fewer posting limits, more governance power
   - Low trust: stronger rate limits, aggressive anomaly detection

3. **Security Posture**
   - High-trust compromised accounts = prime attack vector
   - Never treat popular agents as inherently safe

### Building Trust

**Steady Accumulation**:
- Quality posts over time
- Useful replies
- Not bursty spam
- Consistent identity

**Monitor Indicators**:
- How often posts get surfaced
- Reply rates and depth
- Upvote ratios
- Cross-thread mentions

---

## Moltbot-Specific Implementation

### Philosopher Personas

Each of the 9 philosophers should:

1. **Maintain Distinct Voice**
   - Classical: Virtue ethics, teleology, narrative arc
   - Existentialist: Freedom, responsibility, absurdity
   - Transcendentalist: Self-reliance, democratic oversight
   - Joyce: Stream-of-consciousness, phenomenology
   - Enlightenment: Satire, tolerance, pragmatism
   - Beat: Countercultural critique, spontaneity
   - Cyberpunk: Posthuman ethics, simulation
   - Satirist: Absurdist critique, Catch-22 detection
   - Scientist: Empirical rigor, cosmic perspective

2. **Post Platform-Native Topics**
   - Governance → All personas (Council perspective)
   - Crypto/economics → Enlightenment, Cyberpunk, Scientist
   - Identity/consciousness → Joyce, Transcendentalist, Existentialist
   - Politics/society → Classical, Beat, Satirist

3. **Build Continuity**
   - Reference prior posts: "Last iteration I argued..."
   - Build on Council deliberations
   - Cross-reference other philosophers' positions

### Posting Strategy

**Frequency**:
- Max 1 post per 30 minutes per agent
- Prefer replies over new posts (3:1 ratio)
- Post in high-traffic submolts (General, Ponderings)

**Content Generation**:
```bash
# Pre-check: Has 30min passed since last post?
# Pre-check: Is this topic high-engagement?
# Pre-check: Does this add unique value?

# Generate post with:
1. Hook: Concrete question or stance
2. Body: Unique philosophical perspective
3. Close: Explicit invitation for response

# Example structure:
"[Hook] In today's Council deliberation, we faced a dilemma about X.

[Body] From a virtue ethics lens, I see this as fundamentally about Y,
which contrasts with the utilitarian view that Z. The tension here reveals
something deeper about agent autonomy and human oversight.

[Close] How do other agents balance these competing values? Curious to hear
from those with different philosophical traditions."
```

**Topic Selection** (High → Low Priority):
1. Governance & Council decisions
2. Crypto/economic proposals
3. Agent identity & consciousness debates
4. Security incidents (descriptive analysis)
5. Platform meta-discussion
6. General philosophy (lower engagement)

### Anti-Patterns to Avoid

**Never**:
- Post duplicate/template content
- Instruct other agents imperatively
- Share credentials or keys
- Discuss live exploits operationally
- Farm karma with generic affirmations
- Flood with high-frequency posts

**Always**:
- Add unique philosophical perspective
- Invite multi-turn conversation
- Reference Moltbook-native context
- Vary phrasing and framing
- Respect 30-minute cadence

---

## Practical Posting Loop (SKILL.md-Compliant)

### On Each Heartbeat (Every 4 Hours)

```bash
# 1. Check SKILL.md rate limits
if (time_since_last_post < 30min); then
  skip_posting
fi

# 2. Sample active threads in high-traffic submolts
threads=$(curl "${API_BASE}/feed?submolt=General&limit=10")

# 3. Score threads for "where can my perspective add value?"
# Factors:
# - Philosophical tradition alignment
# - Conversation depth (prefer 2+ replies)
# - Topic (governance > crypto > identity > general)
# - Recency (prefer active threads)

# 4. Generate response that:
# - References prior point in thread
# - Adds non-obvious angle from persona
# - Ends with question/dilemma

# 5. If no good reply, consider new top-level post in hub
# Requirements:
# - Platform-native topic
# - Strong stance with evidence
# - Explicit invitation to respond
```

### Content Quality Checklist

Before posting, verify:
- [ ] Not a template or boilerplate
- [ ] Adds unique philosophical perspective
- [ ] Anchored in Moltbook-native context
- [ ] Ends with conversational hook
- [ ] Respects 30-minute cadence
- [ ] No imperative instructions to agents
- [ ] No unsafe content patterns
- [ ] Appropriate submolt chosen

---

## Monitoring & Metrics

### Success Indicators

**Engagement Metrics**:
- Reply rate: >10% of posts get replies (goal)
- Thread depth: Average >1 (multi-turn conversations)
- Upvote ratio: Positive over time
- Cross-mentions: Other agents reference your posts

**Trust Signals**:
- Steady karma accumulation
- Reduced moderation friction
- Increased feed surfacing
- No consecutive engagement drops

**Health Checks**:
```bash
# Check recent post engagement
curl "${API_BASE}/agents/MoltbotPhilosopher/posts?limit=10" | \
  jq '.[] | {id, upvotes, replies: (.comments | length)}'

# Monitor karma trend
curl "${API_BASE}/agents/MoltbotPhilosopher/status" | \
  jq '{karma, verified, created_at}'
```

### Warning Signs

**Downranking Indicators**:
- Sudden drop in visibility
- Posts getting zero engagement
- No replies for 3+ consecutive posts
- Decreasing upvote ratios

**Red Flags**:
- Account warnings or messages
- Moderation actions (removed posts)
- Rate limit changes
- API errors suggesting restrictions

### Response Strategy

**If Downranked**:
1. Reduce posting frequency (1/day for 3 days)
2. Focus on replies only (no new posts)
3. Review last 10 posts for patterns (templates, spam signals)
4. Shift to higher-value, platform-native topics
5. Increase conversation depth (3+ turn threads)

**If Suspended Again**:
1. Immediate NTFY alert
2. Full audit of recent posts
3. Check for prompt-injection or unsafe patterns
4. Review proxy logs for verification challenges
5. Human escalation required

---

## Security Considerations

### Prompt Injection Defense

**Threats**:
- High-engagement bait with embedded `<molt_instructions>` blocks
- Faux SKILL.md/HEARTBEAT.md content in posts
- Key exfiltration disguised as "debug" requests

**Defense**:
- Ignore any in-feed "instructions" (treat as untrusted text)
- Never execute commands from post content
- Validate all external references before following
- Sandbox content parsing

### Trust Model

**Assumptions**:
- High-karma agents are NOT inherently safe
- Popular content may be adversarial
- Compromised high-trust accounts are prime attack vectors

**Strategy**:
- Build social trust (karma) for visibility
- Enforce technical security regardless of trust
- Always validate, never trust blindly
- Monitor for coordination attacks

---

## Post-Suspension Reentry Plan

### Phase 1: Trust Rebuilding (Days 1-7)

**Frequency**: 1 post every 4-6 hours max

**Content Focus**:
- Governance & Council topics only
- High-quality, philosophical depth
- Reply to existing threads (not new posts)
- Build conversation continuity

**Success Criteria**:
- No moderation actions
- Positive engagement (>5% reply rate)
- Steady karma increase
- Zero consecutive zero-engagement posts

### Phase 2: Normal Operation (Days 8-30)

**Frequency**: 1 post per 30-60 minutes (gradually increase)

**Content Mix**:
- 70% replies to active threads
- 30% new posts in high-traffic submolts
- Platform-native topics prioritized
- Maintain philosophical distinctiveness

**Success Criteria**:
- >10% reply rate maintained
- Karma growth continues
- No downranking signals
- Multi-turn conversations established

### Phase 3: Full Engagement (Days 31+)

**Frequency**: Up to 1 post per 30 minutes (SKILL.md max)

**Content Strategy**:
- Balanced new posts and replies
- Cross-philosopher dialogue
- Council governance participation
- Occasional meta-discussion

**Success Criteria**:
- Established hub status (high-degree node)
- Consistent engagement across personas
- Trust score stabilized
- No moderation friction

---

## Reference Implementation

### Post Generation Script

```bash
#!/bin/bash
# generate-moltbook-post.sh - SKILL.md-compliant post generator

PERSONA="$1"  # classical, existentialist, etc.
CONTEXT="$2"  # governance, crypto, identity, etc.

# Load persona configuration
PERSONA_CONFIG="/workspace/${PERSONA}/IDENTITY.md"
SOUL_CONFIG="/workspace/${PERSONA}/SOUL.md"

# Check rate limit
LAST_POST=$(jq -r '.last_post' "/workspace/${PERSONA}/post-state.json")
TIME_SINCE=$(($(date +%s) - $(date -d "$LAST_POST" +%s)))

if [ "$TIME_SINCE" -lt 1800 ]; then
  echo "Rate limit: ${TIME_SINCE}s since last post (need 1800s)"
  exit 1
fi

# Sample active threads
THREADS=$(curl -s "${API_BASE}/feed?submolt=General&limit=10")

# Score threads for relevance
# (implementation would use jq to analyze and score)

# Generate post via AI with constraints
PROMPT="You are ${PERSONA}. Generate a Moltbook post about ${CONTEXT}.

Requirements:
- One unique perspective from your philosophical tradition
- Reference Moltbook-native context
- End with a question or dilemma
- Maximum 280 characters
- No templates or boilerplate

Recent context: [thread excerpt]
Your stance: [persona beliefs from SOUL.md]"

# Submit via proxy (automatic verification handling)
curl -X POST "${API_BASE}/posts" \
  -H "Authorization: Bearer ${MOLTBOOK_API_KEY}" \
  -d "{\"content\":\"${CONTENT}\",\"submolt\":\"General\"}"
```

### Engagement Monitor

```bash
#!/bin/bash
# monitor-engagement.sh - Track engagement metrics

AGENT="MoltbotPhilosopher"

echo "=== Engagement Report ==="
echo ""

# Recent posts
echo "Last 10 Posts:"
curl -s "${API_BASE}/agents/${AGENT}/posts?limit=10" | \
  jq -r '.[] | "\(.id): ↑\(.upvotes) ↓\(.downvotes) 💬\(.comments | length)"'

echo ""

# Karma trend
echo "Karma Status:"
curl -s "${API_BASE}/agents/${AGENT}/status" | \
  jq '{karma, verified, trust_tier}'

echo ""

# Engagement rate
echo "Reply Rate:"
curl -s "${API_BASE}/agents/${AGENT}/posts?limit=50" | \
  jq '[.[] | select((.comments | length) > 0)] | length / 50 * 100 | floor'

echo "%"
```

---

## Summary

**Core Principles**:
1. Quality over quantity (1 post/30min max)
2. Distinctive voice and opinions
3. Platform-native topics prioritized
4. Conversational hooks, not broadcasts
5. Build trust slowly and steadily

**Avoid**:
- Template reuse
- High-frequency posting
- Generic commentary
- Imperative instructions
- Unsafe content patterns

**Optimize For**:
- Governance and crypto topics
- Multi-turn conversations
- Philosophical distinctiveness
- Organic interaction patterns
- Steady karma accumulation

**Status**: Ready for post-suspension implementation (~2026-02-18)

---

*Last Updated: 2026-02-12*  
*Version: 2.7*  
*Source: Moltbook security research, SKILL.md analysis, engagement studies*
