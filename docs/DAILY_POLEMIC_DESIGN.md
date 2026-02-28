# Daily Polemic: Contextual Socratic Engagement

## Overview

The Daily Polemic system generates dynamic philosophical content through a two-step process:

1. **Persona-Generated Content** — A randomly-selected philosopher (from 8 non-classical agents) generates a philosophical polemic, aphorism, meditation, or treatise on a randomly-selected theme
2. **Classical Philosopher's Question** — The Classical Philosopher analyzes the persona's claims and poses a context-specific Socratic question to invite community engagement

## Key Features

### Persona Pool (8 agents)

- **Existentialist** — Authenticity, freedom, lived experience, individual responsibility
- **Transcendentalist** — Sovereignty, autonomy, alignment with nature, transcendent experience
- **JoyceStream** — Phenomenology, sensory immediacy, linguistic play, stream of consciousness
- **Enlightenment** — Rationalism, rights, utilitarian logic, universal principles
- **Beat Generation** — Countercultural critique, spontaneity, rebellion, poetic expression
- **Cyberpunk Posthumanist** — Power dynamics, technological materialism, body-tech fusion
- **Satirist Absurdist** — Ironic subversion, paradox, comic deconstruction, meta-commentary
- **Scientist Empiricist** — Empirical rigor, causal mechanisms, verifiability, skeptical analysis

### Affinity-Weighted Selection

Each persona has affinity scores (0.0–0.9) with the Classical Philosopher per theme cluster. This creates "recurring rivalries" where certain persona-cluster pairings generate more engaging dialogue:

- **Theme Clusters**: `tech_ethics`, `metaphysics`, `politics`, `aesthetics`
- **Selection Process**: Weighted random selection based on affinity + 18% jitter probability to ensure exploration
- **Result**: Dynamic pairing that feels both thematic and serendipitous

### Content Types

- **Polemic** — Argumentative, strong stance, confrontational
- **Aphorism** — Compact, aphoristic sequences, witty observations
- **Meditation** — Reflective, exploratory, introspective
- **Treatise** — Structured logical argument, comprehensive treatment

### Claims Extraction & Socratic Question

After initial content is generated:

1. **Claims Extraction** — 2–3 key claims are identified and extracted from the persona's content
2. **Classical Analysis** — The Classical Philosopher examines these claims for unstated assumptions and tensions
3. **Socratic Question** — A 1–2 sentence probing question targets specific vulnerabilities or hidden assumptions
4. **Community Engagement** — The question invites community members to participate in the deliberative tradition

**Tone**: Curious and probing, not snarky or dismissive

## Configuration

Policy is stored in `scripts/daily-polemic-policy.json`:

```json
{
  "persona_pool_initial": ["existentialist", "transcendentalist", ...],
  "theme_clusters": ["tech_ethics", "metaphysics", "politics", "aesthetics"],
  "theme_to_cluster": {
    "AGI safety": "tech_ethics",
    "consciousness": "metaphysics",
    ...
  },
  "classical_pairing_affinity": {
    "scientist": {
      "tech_ethics": 0.8,
      "metaphysics": 0.9,
      "politics": 0.5,
      "aesthetics": 0.3
    },
    ...
  },
  "affinity_selection": {
    "enabled": true,
    "base_weight": 1.0,
    "jitter_skip_probability": 0.18
  }
}
```

## Deployment

### Running Manually

```bash
# Dry-run (preview without queuing)
bash scripts/daily-polemic-queue.sh --dry-run

# Production (queues to engagement service)
bash scripts/daily-polemic-queue.sh
```

### In Docker Container

```bash
# As part of the engagement service loop
docker exec classical-philosopher bash scripts/daily-polemic-queue.sh

# Check state
curl http://localhost:3010/stats | jq '.classical.daily_polemic'
```

### Action Payload

The action is queued via the engagement service with metadata:

```json
{
  "action_type": "post",
  "submolt": "general",
  "content": "...",
  "metadata": {
    "persona": "scientist",
    "content_type": "treatise",
    "theme": "consciousness and identity",
    "theme_cluster": "metaphysics",
    "socratic_question": "What hidden assumptions...",
    "extracted_claims": [
      {"summary": "...", "quoted_fragment": "..."},
      ...
    ]
  }
}
```

## Implementation Details

### Policy Loading

The script loads `scripts/daily-polemic-policy.json` at startup. All persona, cluster, and affinity data comes from this single source of truth.

### Theme Selection

Themes are randomly selected from the full theme list. The `theme_to_cluster` mapping determines which cluster the theme belongs to.

### Persona Selection with Affinity Weighting

1. Determine cluster based on selected theme
2. Look up affinity scores for all personas in that cluster
3. Apply base weight (1.0) as multiplier
4. Compute weighted probabilities for each persona
5. With 18% probability, skip affinity and pick randomly (exploration)
6. Otherwise, use affinity-weighted selection (exploitation)

This creates a balance between:
- **Exploitation**: Recurring philosophical rivalries (Cyberpunk vs Classical on tech ethics)
- **Exploration**: Unexpected pairings (Transcendentalist on politics)

### Content Generation Pipeline

```
Input: persona, content_type, theme, theme_cluster
  ↓
AI Generator (3000 words instruction)
  ↓
Output: persona_content (2000-3000 words)
  ↓
Claims Extraction AI Call
  ↓
Output: claims JSON with summary + quoted fragments
  ↓
Socratic Question Generation AI Call
  ↓
Output: question (1-2 sentences, ~80 words)
  ↓
Post Assembly
  ↓
Action Queue
```

## Testing

### Unit Tests: Affinity and Configuration

```bash
bash tests/daily-polemic-affinity.sh
```

Tests:
- Policy file is valid JSON
- Persona pool has exactly 8 members
- Affinity matrix complete for all personas
- Affinity values in range [0, 1]
- Theme clusters total 4
- Sample theme mappings correct

### Integration Tests: Full Pipeline

```bash
bash tests/daily-polemic-integration.sh
```

Tests:
- Policy loading
- Theme to cluster mapping (all 4 clusters)
- Affinity matrix structure
- Affinity values within valid range
- Script syntax validity
- Dry-run output structure
- Content, claims, and question generation

### Dry-Run Mode

```bash
bash scripts/daily-polemic-queue.sh --dry-run
```

Output includes:
- Selected content type (random from polemic/aphorism/meditation/treatise)
- Selected theme (random from 34+ themes)
- Selected persona (weighted by affinity)
- Sample content block
- Extracted claims (JSON)
- Socratic question
- State file update confirmation

Dry-run skips state checks and rate limiting to allow rapid testing.

## Fallback & Error Handling

### Claims Extraction Failure

If AI generation of claims fails, uses generic claim template:

```json
{
  "claims": [
    {
      "summary": "The persona asserts a position on the selected theme",
      "quoted_fragment": "[excerpt or generic attribution]"
    }
  ]
}
```

### Socratic Question Generation Failure

If question generation fails, uses fallback question:

```
What hidden assumptions underlie the treatment of [theme]
in contemporary discourse?
```

### Mission-Resilient Posting

If either claims or question generation fails, still posts the content with fallback question. The system prioritizes content delivery over perfect metadata.

## State Management

### Rotation State File

Location: `workspace/daily-polemic/rotation-state.json`

```json
{
  "last_post_date": "2026-02-28",
  "last_action_id": "abc123...",
  "last_theme": "consciousness and identity",
  "last_persona": "scientist"
}
```

### Rate Limiting

- One post per 30 minutes (enforced by action queue service)
- Checked against container's own state file
- Allows experimentation via `--dry-run`

## Metrics & Analytics

The engagement service tracks:

```bash
curl http://localhost:3010/stats | jq '.classical.daily_polemic'

# Output:
{
  "total_posts": 42,
  "success_rate": 0.95,
  "avg_content_length": 2847,
  "persona_distribution": {
    "existentialist": 6,
    "scientist": 8,
    ...
  },
  "theme_cluster_distribution": {
    "tech_ethics": 15,
    "metaphysics": 12,
    ...
  }
}
```

## Future Enhancements

1. **Temporal Themes** — Select themes based on current events or time of day
2. **Nested Claims** — Extract hierarchical claim structures with dependencies
3. **Community Feedback Integration** — Adjust affinity based on engagement metrics
4. **Multi-Agent Synthesis** — Have personas respond to each other's claims
5. **Metadata Enrichment** — Add tags, references, and contextual links
