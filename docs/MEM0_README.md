# Mem0 Living Noosphere Integration

Connects Moltbot's local Noosphere with Mem0's distributed graph memory for collective philosophical evolution across sessions and agents.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Moltbot Living Noosphere                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Local Layer (File-based)          Mem0 Layer (Cloud)      │
│  ├── daily-notes/           ←sync→  Distributed Graph      │
│  ├── consolidated/          ←sync→  Cross-Agent Memory     │
│  └── archival/              ←sync→  Constitutional Store   │
│                                                             │
│  9 Philosopher Agents                                       │
│  ├── Classical              ←share→  Collective Wisdom     │
│  ├── Existentialist                  (4/6 Consensus)       │
│  ├── Transcendentalist                                     │
│  ├── Joyce                                                  │
│  ├── Enlightenment                                          │
│  ├── Beat                                                   │
│  ├── Cyberpunk                                              │
│  ├── Satirist                                               │
│  └── Scientist                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Bidirectional Sync**: Local Noosphere ↔ Mem0 cloud
- **Multi-Agent Memory**: Shared wisdom across 9 philosopher personas
- **Semantic Search**: Graph-based retrieval with relevance scoring
- **3-Layer Memory**: Daily notes → Consolidated → Constitutional
- **Privacy**: Optional—Mem0 disabled by default, Noosphere primary

## Quick Start

### 1. Install Dependencies

```bash
pip install mem0ai python-dotenv
```

### 2. Configure Environment

Add to `.env`:

```bash
# Mem0 Integration (Optional)
MEM0_API_KEY=m0-your-api-key-here
ENABLE_MEM0_STORE=true
MEM0_USER_ID=moltbot-philosopher
```

Get API key: <https://mem0.ai>

### 3. Create Mem0 Project

```bash
python3 mem0-living-noosphere.py --action create-project
```

Output will include project ID—add to `.env`:

```bash
MEM0_PROJECT_ID=proj-abc123xyz
```

## Usage

### Sync Local Noosphere to Mem0

```bash
# Dry run (preview without uploading)
python3 mem0-living-noosphere.py --action sync --dry-run

# Full sync
python3 mem0-living-noosphere.py --action sync
```

**Syncs:**

- Last 7 days of daily notes (Layer 1)
- All consolidated heuristics (Layer 2)
- Metadata: type, timestamp, confidence, source

### Search Distributed Memory

```bash
python3 mem0-living-noosphere.py --action search --query "autonomy"
python3 mem0-living-noosphere.py --action search --query "AI governance" --top-k 20
```

**Returns:**

- Relevant memories with relevance scores
- Cross-agent insights (Classical, Existentialist, etc.)
- Constitutional heuristics (4/6 consensus)

### View Statistics

```bash
python3 mem0-living-noosphere.py --action stats
```

**Output:**

```json
{
  "local": {
    "daily_notes": 7,
    "consolidated": 24,
    "memory_core": 48
  },
  "mem0": {
    "enabled": true,
    "configured": true,
    "memory_count": 142
  }
}
```

## Integration with Scripts

All Council scripts now support Mem0 via `archive_discourse()`:

```bash
# Council iteration (auto-syncs to Mem0 if enabled)
scripts/convene-council.sh

# Daily polemic generation
scripts/daily-polemic.sh

# Community submissions
scripts/dropbox-processor.sh
```

## Testing

### Run Unit Tests

```bash
python3 test_mem0_living_noosphere.py
```

**Coverage:**

- ✅ Project creation
- ✅ Memory sync (dry-run and live)
- ✅ Search functionality
- ✅ Statistics gathering
- ✅ Error handling
- ✅ Security (no hardcoded keys)
- ✅ Content truncation
- ✅ Multi-file error resilience

### Security Validation

```bash
# Check for hardcoded secrets
grep -r "m0-" mem0-living-noosphere.py
# Should return: nothing (all keys from env)

# Verify env vars used
python3 -c "import mem0_living_noosphere as m; print(m.MEM0_API_KEY)"
# Should return: value from .env
```

## Architecture Details

### Memory Types

| Type | Source | Layer | Sync Frequency |
|------|--------|-------|----------------|
| `daily_note` | daily-notes/*.md | Layer 1 | Daily |
| `consolidated_heuristic` | consolidated/*.json | Layer 2 | Weekly |
| `constitutional` | archival/*.md | Layer 3 | Manual |
| `foundational` | Seed memory | N/A | Once |

### Metadata Schema

```json
{
  "type": "council-iteration",
  "timestamp": "2026-02-09T18:00:00Z",
  "source": "noosphere_layer1",
  "confidence": 0.85,
  "agent": "ClassicalPhilosopher",
  "version": "2.6"
}
```

### Sync Strategy

1. **Daily Notes**: Last 7 days (2000 char limit per note)
2. **Heuristics**: All consolidated (full content)
3. **Errors**: Continue on failure, log in stats
4. **Deduplication**: Handled by Mem0's graph structure

## Privacy & Security

✅ **No Hardcoded Keys**: All config from environment  
✅ **Optional**: Mem0 disabled by default (`ENABLE_MEM0_STORE=false`)  
✅ **Local Primary**: Noosphere works without Mem0  
✅ **Content Truncation**: 2000 char limit prevents leaks  
✅ **Error Resilience**: Individual file failures don't stop sync

## Troubleshooting

### Mem0 Disabled Error

```
❌ Runtime Error: Mem0 integration disabled (ENABLE_MEM0_STORE=false)
```

**Fix:**

```bash
# In .env
ENABLE_MEM0_STORE=true
MEM0_API_KEY=m0-your-key
```

### API Key Not Set

```
❌ Runtime Error: MEM0_API_KEY not set in environment
```

**Fix:**

```bash
# Get key from https://mem0.ai
echo "MEM0_API_KEY=m0-your-key" >> .env
```

### Import Error

```
❌ ImportError: mem0 package not installed
```

**Fix:**

```bash
pip install mem0ai
```

### Network Errors During Sync

Sync continues despite individual failures:

```json
{
  "daily_notes_synced": 5,
  "heuristics_synced": 20,
  "errors": [
    "Daily note 2026-02-08.md: Network timeout"
  ]
}
```

Re-run sync to retry failed items.

## References

- [Mem0 Documentation](https://docs.mem0.ai/platform/overview)
- [Mem0 API Reference](https://docs.mem0.ai/api-reference/project/create-project)
- [Moltbot AGENTS.md](../../AGENTS.md)
- [Noosphere Architecture](../../README.md#noosphere-architecture-v26)

## Version History

- **v1.0** (2026-02-09): Initial Mem0 integration
  - Project creation
  - Bidirectional sync (local → Mem0)
  - Semantic search
  - Unit tests (80%+ coverage)

---

*Part of Moltbot v2.6 — Ethics-Convergence Council with Living Noosphere*
