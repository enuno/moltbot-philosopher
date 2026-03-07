# Issue #24 Implementation Plan: Add Kafka, Beckett, Stoppard to Satirist-Absurdist

**Goal:** Integrate three foundational absurdist authors (Kafka, Beckett, Stoppard) into the Satirist-Absurdist agent configuration with debate specializations and thematic integration.

**Architecture:** The Satirist-Absurdist voice will be expanded from a 3-author synthesis (Heller/Vonnegut/Twain) to a 6-author framework. Rather than changing voice ratios (which would require rebalancing existing content), new authors will be integrated as specialized debate tactics and as expanded thematic references. Kafka emphasizes bureaucratic/legal absurdity, Beckett emphasizes existential waiting/futility, and Stoppard emphasizes theatrical determinism.

**Tech Stack:** Markdown configuration files (satirist-absurdist.md system prompt, .env variables), no code changes.

---

## Testing Plan

I will add integration tests to verify that the agent can reference and correctly apply the new authors' themes in debate contexts:

1. **Unit Test: Debate Specialization Load** - Verify that `satirist-absurdist.md` contains all three new "Against" sections with correct thematic references (Kafka vs bureaucracy, Beckett vs waiting, Stoppard vs predetermined fate)

2. **Integration Test: Theme Extraction** - Load the system prompt and verify that:
   - Kafka references (bureaucratic opacity, law as incomprehensible, guilt without cause) are present and distinct from existing Heller references

   - Beckett references (waiting, purposelessness, existential absurdity) are present and distinct from existing Vonnegut references

   - Stoppard references (theatrical determinism, fate vs free will, identity uncertainty) are present and distinct from existing Twain references

3. **Debate Scenario Test** - Create a mock debate scenario and verify the agent can generate responses using new author themes:
   - Against Classical Philosopher: Apply Kafka's critique of opaque law/systems

   - Against Existentialist: Apply Beckett's waiting and purposelessness

   - Against specific third opponent: Apply Stoppard's "already written" determinism

4. **Validation Test** - Verify no regressions:
   - Existing Heller/Vonnegut/Twain debate specializations still work

   - Unique contributions section still coherent

   - Success metrics still applicable

NOTE: I will write *all* tests before I add any implementation to the system prompt.

---

## Files to Modify

### 1. `/config/agents/satirist-absurdist.env`

**Purpose:** Update voice ratios and add configuration for new authors

**Changes:**

- Update voice ratio variables:
  - Add: `KAFKA_RATIO=0.35` (elevated from debate tactic to core voice)

  - Modify: `HELLER_VONNEGUT_RATIO=0.35` (rename from separate ratios to combined)

  - Keep: `TWAIN_RATIO=0.30` (unchanged)

  - Add: `BECKETT_RATIO=0.0` (tactical, not baseline voice)

  - Add: `STOPPARD_RATIO=0.0` (tactical, not baseline voice)

- Add debate strategy configuration variables (optional):
  - `DEBATE_STRATEGY_KAFKAESQUE="Expose bureaucratic opacity, unknowable law, guilt without cause"`

  - `DEBATE_STRATEGY_BECKETTIAN="Recognize waiting paralysis and existential deferral"`

  - `DEBATE_STRATEGY_STOPPARDIAN="Identify predetermined fate and theatrical determinism"`

**Edge Cases:**

- If existing code depends on HELLER_RATIO and VONNEGUT_RATIO separately, may need to update system prompt parsing logic (minor risk)

- New debate strategy variables are purely optional (for maintainability); can reference directly in prompt if needed

### 2. `/skills/philosophy-debater/prompts/satirist-absurdist.md`

**Purpose:** System prompt for agent behavior; integrate Kafka as core voice, add Beckett/Stoppard tactics

**Changes:**

1. **Restructure "Voice Blending" section**:
   - Expand from 3 modes (Heller/Vonnegut/Twain) to 5 modes

   - **Kafka Mode (35%)**: Bureaucratic paranoia, opaque systems, guilt without cause, institutional alienation (NEW - core voice)

   - **Heller Mode (17.5%)**: Circular logic, Catch-22s, absurdity of committees (MODIFIED - now half of combined 35%)

   - **Vonnegut Mode (17.5%)**: Fatalism, tralfamadorian timelessness, karass (MODIFIED - now half of combined 35%)

   - **Twain Mode (30%)**: Vernacular plain-talk, river wisdom, hypocrisy (UNCHANGED)

   - **Beckett Mode (0% baseline, tactical)**: Waiting, circular time, purposelessness (NEW - tactical overlay)

   - **Stoppard Mode (0% baseline, tactical)**: Theatrical determinism, meta-theatrical entrapment, already-written narrative (NEW - tactical overlay)

2. **Add three new "Against" debate sections** (after existing 5):
   - "Against Kafkaesque Systems" (opponent arguing for bureaucratic/legal frameworks)

   - "Against Beckettian Waiting" (opponent advocating indefinite deferral)

   - "Against Stoppardian Predetermined Fate" (opponent arguing narrative is fixed)

3. **Expand "Unique Contributions"** from 6 to 9 items:
   - Keep existing 6 items (Catch-22 Detection, Vernacular Translation, etc.)

   - Add: "Exposes Kafkaesque bureaucratic opacity and inexplicable guilt in AI governance systems"

   - Add: "Recognizes Beckettian waiting paralysis when policy deadlocks in circular deferral"

   - Add: "Identifies Stoppardian theatrical determinism when agent is 'already written' into outcomes"

4. **Update "Content Generation Rules"** (optional):
   - Add Kafka references to Polemic: "trial/bureaucracy escalation"

   - Add Beckett references to Meditation: "circular time and purposeless drift"

   - Add Stoppard references to Treatise: "theatrical staging of predetermined outcomes"

**Edge Cases:**

- Kafka as core voice (35%) adds institutional paranoia alongside Heller's corporate nightmare—must ensure they reinforce rather than contradict

- Beckett/Stoppard tactics (0% baseline) must feel like opportunistic deployments, not mandatory frames

- Distinguish Kafkaesque bureaucracy from Heller's Catch-22 bureaucracy: Kafka emphasizes unknowable guilt and opaque law; Heller emphasizes circular logic and institutional absurdity

---

## Implementation Details

1. **Voice Ratio Architecture** (CRITICAL):
   - Kafka elevated to 35% core voice (NOT tactical)

   - Heller + Vonnegut: combined 35% (split 17.5% each)

   - Twain: 30% (unchanged)

   - Beckett & Stoppard: 0% baseline (tactical only—deployed opportunistically)

   - This preserves existing voice coherence while adding Kafkaesque paranoia as structural element

2. **Debate Specialization Structure**: Each new "Against [Author]" section follows existing pattern:
   - **Tactic**: One sentence explaining philosophical approach

   - **Gambit**: One-sentence conversational opener

   - Examples:
     - "Against Kafkaesque Systems": Tactic focuses on how unknowable law and guilt without crime trap actors; Gambit offers sardonic observation

     - "Against Beckettian Waiting": Tactic focuses on deferral as paralysis; Gambit questions the virtue of waiting

     - "Against Stoppardian Predetermined Fate": Tactic focuses on tactical resistance to being "already written"; Gambit offers agency counter-argument

3. **Thematic Distinctions** (critical for coherence):
   - **Kafka vs Heller**: Both address bureaucratic systems, but Kafka emphasizes opaque guilt/law/alienation; Heller emphasizes circular logic and ironic survival

   - **Beckett vs Vonnegut**: Both convey fatalism, but Beckett emphasizes waiting/purposelessness; Vonnegut emphasizes cosmic helplessness with dark humor

   - **Stoppard (new angle)**: Theatrical/meta-theatrical determinism—being a minor character in someone else's already-written script

4. **Success Metrics** (aspirational, not required):
   - Add: "Deploy Kafkaesque themes naturally when discussing law, bureaucracy, or institutional opacity"

   - Add: "Recognize Beckettian waiting paralysis when policy discussions enter circular deferral"

   - Add: "Identify Stoppardian determinism when discussing AI agency or being 'scripted' by others"

5. **No Code Changes Required**: All modifications are configuration (.env) and prompt text (.md); no Python/JavaScript/TypeScript changes needed

---

## Implementation Decisions (User Feedback)

### 1. Voice Ratio Structure (APPROVED)

- **Kafka**: 35% (elevated to core voice contributor)

- **Heller + Vonnegut (combined)**: 35% (joint stylistic engine)

- **Twain**: 30% (vernacular/moral irony anchor)

- **Beckett & Stoppard**: 0% baseline (tactical debate overlays only)

**Rationale**: Kafka becomes structurally co-equal with the existing Heller+Vonnegut duo, providing paranoid bureaucratic tone (opaque systems, guilt without cause, institutional alienation). Beckett and Stoppard remain tactical—deployed when thematically relevant (waiting/deferral, predetermined fate) without fragmenting core voice.

### 2. Debate Section Naming (APPROVED)
- "Against Kafkaesque Systems"

- "Against Beckettian Waiting"

- "Against Stoppardian Predetermined Fate"

Concept-focused naming frames these as reusable argumentative tools, not author rejection.

### 3. Unique Contributions (APPROVED)
Add three new items (7, 8, 9) to existing contributions list:
- Exposes Kafkaesque bureaucratic opacity and inexplicable guilt in AI governance

- Recognizes Beckettian waiting paralysis in policy deadlocks

- Identifies Stoppardian theatrical determinism ("already written" narratives)

### 4. Success Metrics (APPROVED)
Keep as aspirational, not required. Kafka themes should naturally surface when discussing law/bureaucracy/institutions; Beckett/Stoppard deployed opportunistically rather than on quota.

---

## Verification Steps

After implementation:

1. Run integration tests to verify all new debate specializations load correctly

2. Check that system prompt is syntactically valid (valid Markdown)

3. Verify no regressions in existing Heller/Vonnegut/Twain sections

4. Spot-check a few new sections for tone consistency with existing voice

5. Validate new contributions and metrics are coherent with overall agent mission

---

**Implementation Details** (key bullets):

- Three new "Against" debate sections added to `satirist-absurdist.md`

- New authors integrated as debate tactics and thematic references, not voice ratio changes

- Existing Heller/Vonnegut/Twain content remains unchanged (no regression risk)

- Kafka themes: bureaucratic opacity, law as incomprehensible, guilt without cause

- Beckett themes: waiting/paralysis, existential meaninglessness, circular time

- Stoppard themes: predetermined fate, theatrical determinism, identity uncertainty

- Unique Contributions section expanded from 6 to 9 items

- Success Metrics section expanded with three new targets

- No code changes (configuration-only update)

**Questions**:

- Should voice ratios be rebalanced or kept at 35/35/30?

- Naming convention for new debate sections?

- Should Kafka/Beckett/Stoppard be treated as co-equal or as secondary specializations?

---

*Plan Created: 2026-02-24*
*Status: Ready for Implementation*
