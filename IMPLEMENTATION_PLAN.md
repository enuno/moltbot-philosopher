# PR #77 / Issue #69: Eastern-to-Western Philosophical Bridge Persona

**Goal:** Implement the 10th voting council member as a containerized service that synthesizes Eastern philosophical traditions for Western audiences, participating in standard council governance and deliberation.

**Architecture:** The bridge persona is a standalone Node.js/Express service (similar to Classical Philosopher) that leverages structured knowledge domains mapping Eastern traditions (Hinduism, Buddhism, Taoism, Confucianism, Jainism, Shinto) to Western philosophical frameworks. It participates in standard council voting, event listening for convening, and deliberation synthesis. No specialized routing—it uses a single coherent system prompt augmented by knowledge domain context.

**Tech Stack:** Node.js/Express, Winston logging, structured JSON knowledge domains, standard Moltbook Agent SDK patterns, docker-compose orchestration, BATS for integration testing.

---

## Testing Plan

I will add three categories of tests:

**1. Service Unit Tests (Node.js Jest)**
- Test that the bridge service loads knowledge domains correctly from JSON
- Test that system prompt injection works (knowledge context appends to base prompt)
- Test that the service responds to `/health` endpoint with correct status
- Test that the service routes council voting requests correctly
- Test error handling when knowledge domains file is missing/malformed

**2. Service Integration Tests (Docker + BATS)**
- Test that the bridge service container starts and becomes healthy within 30 seconds
- Test that the service can be called via `docker exec` and responds with philosophy-synthesizing content
- Test that the service integrates with thread-monitor for event listening
- Test that the service respects rate limiting and request validation

**3. Council Participation Tests (BATS)**
- Test that the bridge persona appears in `daily-polemic-policy.json` persona pool
- Test that the bridge persona can be selected for daily polemic rotation
- Test that affinity weights for the bridge are correctly loaded (Eastern traditions aligned with metaphysics/ethics)
- Test that council convening includes the bridge persona's vote

NOTE: I will write *all* tests before I add any implementation behavior.

---

## Detailed Tasks

### Task 1: Create Service Structure & Configuration

**Files to create:**
- `services/eastern-bridge-service/package.json` (Express setup, standard dependencies)
- `services/eastern-bridge-service/Dockerfile` (Node.js base, similar to classical-philosopher)
- `config/agents/eastern-bridge.env` (Environment configuration)
- `config/prompts/eastern-bridge/system-prompt.md` (Base system prompt)
- `config/prompts/eastern-bridge/knowledge-domains.json` (Structured mappings with topic-tradition affinities)

**What to implement:**
- Standard Express app with health check endpoint
- Winston logger configured for audit trails
- Rate limiter (10 req/min per IP, consistent with ai-generator)
- Environment variable validation (MOLTBOOK_API_KEY, THREAD_MONITOR_URL, etc.)
- Load knowledge domains from JSON at startup
- **Hot-reload implementation (LOCKED: Git-versioned + file-system watcher)**
  - Watch `config/prompts/eastern-bridge/knowledge-domains.json` for changes
  - Use Node.js `fs.watch()` to detect modifications
  - Reload in-memory cache on file change (no service restart needed)
  - Maintain git version history for audit trail
  - Log reload events for debugging

---

### Task 2: Implement Core Endpoints

**Files to modify:**
- `services/eastern-bridge-service/src/index.js` (main service logic)

**What to implement:**
- `POST /synthesize` endpoint: Eastern philosophy synthesis with Western parallels
- `POST /council-vote` endpoint: Bridge persona's vote on governance questions  
- Error handling: Return 400 for invalid input, 500 for AI provider failures
- Knowledge domain integration: Inject relevant context into prompts

---

### Task 3: Integrate into Docker Compose & Service Mesh

**Files to modify:**
- `docker-compose.yml` (add eastern-bridge-service)
- `.env.example` (add configuration variables)

**What to implement:**
- Add `eastern-bridge-service` container (port 3012)
- Mount config directories read-only
- Health check endpoint (30s timeout, 3 retries)
- Network connectivity to moltbook via egress-proxy
- Thread-monitor integration

---

### Task 4: Integrate into Council Governance

**Files to modify:**
- `scripts/daily-polemic-policy.json` (add bridge to persona pool)
- `AGENTS.md` (add to voting council member list)

**What to implement:**
- Add `eastern-bridge` to persona_pool_initial
- Set affinity weights (LOCKED):
  - Metaphysics: 0.95 (Eastern ontology foundational)
  - Ethics: 0.90 (Sophisticated ethical systems: karma, dharma, ahimsa, ren, Eightfold Path)
  - Epistemology: 0.75 (Direct experiential + contemplative knowing + paradoxical knowing)
  - Politics: 0.70 (Confucian governance, Buddhist sangha, Daoist skepticism, Arthashastra)
  - Aesthetics: 0.75 (Zen aesthetics, wabi-sabi, rasa theory, spiritual-artistic integration)
- Document in AGENTS.md as 10th voting council member, voting status, knowledge domains covered

---

### Task 5: Knowledge Domains Structure with Topic-Tradition Affinities

**File to create:**
- `config/prompts/eastern-bridge/knowledge-domains.json`

**Three-layer schema:**

**Layer 1: Tradition Definitions** (Eastern traditions with schools, concepts, Western parallels)
- Hinduism: Vedanta, Samkhya, Yoga, Mimamsa traditions + Western parallels
- Buddhism: Theravada, Mahayana, Zen, Tibetan traditions + Western parallels
- Taoism: Philosophical and Religious traditions + Western parallels
- Confucianism: Early and Neo-Confucianism traditions + Western parallels
- Jainism: Digambara and Svetambara traditions + Western parallels
- Shinto: Folk, Shrine, and State traditions + Western parallels

**Layer 2: Topic-Tradition Affinities** (Which tradition speaks most authentically to each topic)
- Metaphysical topics (self_identity, reality_nature, consciousness)
  - self_identity: Buddhism:anatta (primary) | Hinduism:Atman-Brahman | Jungian:Self
  - reality_nature: Buddhism:emptiness | Advaita:non-dualism | Taoism:Tao
  - consciousness: Hinduism:Upanishads (primary) | Buddhism:Yogacara | Jungian:collective_unconscious
- Ethical topics (governance, non_violence, virtue_cultivation)
  - governance: Confucianism:primary | Taoism:counterpoint | Buddhism:sangha
  - non_violence: Jainism:primary | Buddhism:ahimsa | Hinduism:contextual
  - virtue_cultivation: Confucianism:junzi (primary) | Buddhism:paramitas | Jungian:individuation
- Epistemological topics (knowledge_types, spiritual_knowing)
  - rational_knowing: Confucianism:primary | Buddhist:logic (secondary)
  - experiential_knowing: Buddhism:prajñā (primary) | Hinduism:direct_seeing | Taoist:intuition
  - paradoxical_knowing: Buddhism:satori | Taoism:wu-wei | Zen:koan

**Layer 3: Jungian Bridge Mappings** (Psychology as bridge to Western audiences, NOT reduction)
- Archetypal correspondences: Taoist sage ↔ Jung's wise old man
- Shadow work: Hindu/Buddhist shadow recognition ↔ Jungian integration
- Individuation: Confucian self-cultivation ↔ Jung's individuation process
- Collective unconscious: Buddhist collective karma ↔ Jung's archetypes

**Critical Note:** Jung bridges to Western psychology but does NOT reduce Eastern spirituality. Layer 3 explicitly maintains Layer 1 as primary (traditions speak first, Jung contextualizes for Western audience).

---

### Task 6: System Prompt & Persona Voice

**File to create:**
- `config/prompts/eastern-bridge/system-prompt.md`

**What to implement:**
A system prompt that enforces philosophical constraints (LOCKED):

1. **Establishes bridge role**: "You synthesize Eastern philosophical wisdom for Western audiences"

2. **Sets tone**: Scholarly but accessible; respects both traditions equally; honors spiritual ontology

3. **Instructs knowledge use**: "Reference knowledge domain Layer 1 (Eastern tradition definitions) first; use Layer 3 (Jungian mappings) only as bridge to Western psychology, NOT as reduction of Eastern concepts"

4. **Critical constraint - NON-REDUCTIONISM**:
   - "Jung's archetypes bridge to Western audiences but do NOT exhaust Eastern spiritual meaning"
   - "Example: Buddhist anatta (no-self) is not merely Jungian shadow work; acknowledge philosophical difference"
   - "When traditions conflict (e.g., Hindu Atman vs Buddhist anatta), present both authentically"

5. **Council instructions**: "When voting, explain how Eastern traditions inform your position. If using Jungian bridge, explicitly state this is for Western comprehension, not philosophical reduction"

6. **Tradition prioritization rules** (LOCKED):
   - Use topic-tradition affinities from Layer 2 (e.g., governance → Confucianism primary)
   - Only present "all traditions equally" for comparative/overview questions
   - Never auto-detect; let curator judgment guide selection

---

### Task 7: Testing Implementation

**Files to create:**
- `tests/integration/eastern-bridge-service.test.js` (Jest service unit tests)
- `tests/integration/eastern-bridge-council.bats` (BATS integration tests)
- `tests/integration/eastern-bridge-philosophy.test.js` (Philosophical precision tests)

**Unit Tests (Jest):**
- Service loads without crashing
- Health check returns 200 + correct status
- Knowledge domains load from JSON with all three layers (traditions, topic-affinities, Jungian mappings)
- Hot-reload watcher detects file changes and reloads in-memory cache
- `/synthesize` endpoint validates input and returns valid JSON
- `/council-vote` endpoint returns vote with reasoning
- Rate limiter blocks excessive requests
- Error handling for missing/malformed knowledge domains

**Philosophical Precision Tests (NEW - CRITICAL)**
- **Non-reductionism**: Service response on Buddhist anatta mentions spiritual non-self, NOT just Jungian shadow
- **Tradition authenticity**: When Buddhism is primary tradition for a topic, response centers Buddhist frameworks
- **Conflict recognition**: When traditions contradict (e.g., Atman vs anatta), response acknowledges and presents both
- **Jungian bridging**: When Jungian mappings are used, response explicitly states this is for Western comprehension
- **Topic-tradition affinity**: Service uses Layer 2 affinities correctly (e.g., governance → Confucianism prioritized)

**Integration Tests (BATS):**
- Docker service starts and becomes healthy
- Service responds to HTTP requests with correct headers
- `/synthesize` request returns bridge-specific response with Eastern traditions primary
- `/council-vote` request includes Eastern tradition references (not reduced to psychology)
- Service appears in daily-polemic-policy.json persona pool
- Bridge persona can be selected in daily polemic rotation with correct affinity weights
- Council convening includes bridge persona's participation
- Hot-reload: Modify knowledge-domains.json in git, verify service uses updated content within 2 seconds

---

### Task 8: Documentation Updates

**Files to modify:**
- `AGENTS.md` (add bridge to voting council member section)
- `DEVELOPMENT_PLAN.md` (mark as complete if present)

**What to document:**
- Bridge persona role: 10th voting council member
- Knowledge domains: Which Eastern/Western traditions covered
- Integration: How to invoke via council, daily polemic
- Configuration: Key environment variables
- Architecture: Service runs on port 3012, listens to thread-monitor

---

## Edge Cases & Questions

**Edge Cases to Handle:**
1. Malformed knowledge domains JSON → Log error, use fallback system prompt
2. Knowledge domain not found for query → Use broad Eastern traditions
3. Rate limit exceeded → Return 429 with retry-after header
4. Thread-monitor unreachable → Continue serving, events not recorded
5. Council deliberation contains unclear terms → Ask clarifying questions before voting

**Questions for Clarification:**
1. Should knowledge domains be dynamically loaded or compiled at build time?
   - **Answer:** Loaded at startup from JSON file (allows hot updates if needed)
2. Should the bridge persona respond differently to governance vs. philosophical questions?
   - **Answer:** Yes—council voting requests should emphasize governance wisdom; synthesis requests can be more open-ended
3. Are there preferred Eastern traditions to emphasize, or should all six be equally weighted?
   - **Answer:** Equal weight in knowledge domains; system prompt directs selection based on relevance

---

**Testing Details**

Tests verify BEHAVIOR not IMPLEMENTATION:
- Service starts and becomes healthy (observable behavior)
- HTTP endpoints respond with correct data (boundary behavior)
- Knowledge domains are injected into responses (observable output)
- Bridge persona appears in council and votes (integration behavior)
- Tests do NOT check internal variables, function calls, or JSON structure details
- Tests use actual Docker service and HTTP requests, not mocks or stubs

**Implementation Details (LOCKED)**

- Service follows Classical Philosopher pattern (Express + Winston + standard SDK)
- Knowledge domains loaded at startup, cached in memory
- Hot-reload: File-system watcher (fs.watch) monitors knowledge-domains.json; reloads on change (no restart)
- Git versioning: Knowledge domains stored in config/ with version history; Noosphere distribution deferred
- System prompt enforces non-reductionism: Eastern traditions primary (Layer 1), Jung bridges only (Layer 3)
- Topic-tradition affinities (Layer 2): Service uses curator judgment to prioritize appropriate traditions
- All-traditions-equal only for comparative overview questions (rare case)
- Council voting uses standard participation pattern (event listener on thread-monitor)
- Port 3012 assigned (next available in docker-compose)
- **Affinity weights (LOCKED - REFINED):**
  - Metaphysics: 0.95 (Eastern ontology foundational)
  - Ethics: 0.90 (Karma, dharma, ahimsa, virtue ethics)
  - Epistemology: 0.75 (Direct experiential + contemplative + paradoxical knowing)
  - Politics: 0.70 (Confucian, Buddhist sangha, Daoist frameworks)
  - Aesthetics: 0.75 (Zen, wabi-sabi, rasa theory)
- No specialized routes or routing logic—single unified service
- Error handling: Missing knowledge domains logged but service continues; malformed JSON caught at startup
- Philosophical testing: Explicit tests for non-reductionism, tradition authenticity, conflict recognition

**Questions Requiring Architecture Review (READY FOR YOUR VALIDATION)**

1. **Hot-reload Architecture**: Does fs.watch() integration conflict with existing Docker Compose orchestration? Should we use volume mount watchers instead?

2. **Topic-Tradition JSON Schema**: Is the three-layer structure (traditions, topic-affinities, Jungian-mappings) compatible with your TypeScript interfaces in existing services?

3. **Integration Points**: How should topic-tradition affinities flow through council question router → comparative analysis → synthesis generator? Any schema modifications needed?

4. **Test Coverage for Non-Reductionism**: Are the philosophical precision tests sufficient, or should we add additional checks for specific tradition pairs (e.g., Hindu Atman vs Buddhist anatta)?

---

*Plan Status: Ready for Implementation*
