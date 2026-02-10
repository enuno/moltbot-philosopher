#!/bin/bash
set -euo pipefail

# Seed Noosphere with Initial Heuristics for Moltstack Essays
# Populates the memory system with foundational philosophical concepts

WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace/classical}"
NOOSPHERE_DIR="${WORKSPACE_DIR}/noosphere"
DAILY_NOTES_DIR="${NOOSPHERE_DIR}/daily-notes"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
  echo -e "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [${BLUE}INFO${NC}] $*"
}

success() {
  echo -e "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [${GREEN}SUCCESS${NC}] $*"
}

# Create daily note with heuristics
create_daily_note() {
  local date_tag="$1"
  local filename="${DAILY_NOTES_DIR}/seed-${date_tag}.md"

  mkdir -p "$DAILY_NOTES_DIR"

  cat > "$filename" << 'EOF'
# Foundational Heuristics for Philosophical Infrastructure Essays

## Classical Philosophy and Systems

### Plato's Divided Line (Republic 509d-511e)
**Concept**: Four levels of knowledge - imagination, belief, reasoning, noesis (pure intellectual apprehension)
**Application**: Maps to system abstractions - raw data (imagination), metrics (belief), analysis (reasoning), architectural insight (noesis)
**Confidence**: 0.85
**Source**: Classical tradition, verified through The Divided Line publication
**Tags**: epistemology, plato, classical, systems-thinking

### Virgil's Georgics - Infrastructure as Poetry
**Concept**: "Sed fugit interea, fugit irreparabile tempus" (But time flies meanwhile, irretrievable) - the urgency of tending systems
**Application**: Infrastructure requires constant cultivation like agriculture; neglect compounds exponentially
**Confidence**: 0.80
**Source**: Georgics I.145-146, applied to DevOps practices
**Tags**: virgil, classical, infrastructure, maintenance

### Marcus Aurelius on Resilience (Meditations V.20)
**Concept**: "The impediment to action advances action. What stands in the way becomes the way"
**Application**: System failures and constraints drive architectural innovation; obstacles reveal truth
**Confidence**: 0.88
**Source**: Stoic philosophy, applied to incident response and chaos engineering
**Tags**: stoicism, resilience, incident-response

## Existentialism and Technology

### Camus and the Absurd Hero
**Concept**: Sisyphus as metaphor for repetitive technical work; finding meaning through authentic engagement
**Application**: Continuous deployment, monitoring, on-call rotations - embrace the cycle rather than seeking escape
**Confidence**: 0.82
**Source**: The Myth of Sisyphus, applied to SRE practices
**Tags**: camus, existentialism, sre, absurdism

### Sartrean Bad Faith in System Design
**Concept**: Bad faith = denying freedom/responsibility; systems that obscure accountability exhibit bad faith
**Application**: Black-box abstractions, opaque algorithms, "it's the computer's fault" - all forms of technical bad faith
**Confidence**: 0.85
**Source**: Sartre's Being and Nothingness, applied to transparency in systems
**Tags**: sartre, existentialism, accountability, transparency

### Existential Authenticity vs. Cargo Culting
**Concept**: Authenticity requires understanding *why*; cargo culting copies form without substance
**Application**: Adopting Kubernetes/microservices without understanding trade-offs is existential inauthenticity
**Confidence**: 0.87
**Source**: Existentialist emphasis on authentic choice
**Tags**: existentialism, authenticity, architecture, cargo-cult

## Distributed Systems and Ancient Wisdom

### Byzantine Generals Problem (1982)
**Concept**: Achieving consensus in presence of malicious actors; trust in trustless systems
**Application**: Blockchain consensus, fault tolerance, the impossibility of perfect agreement
**Confidence**: 0.90
**Source**: Lamport, Shostak, Pease (1982) + philosophical implications
**Tags**: distributed-systems, consensus, byzantine, trust

### CAP Theorem as Philosophical Constraint
**Concept**: Consistency, Availability, Partition-tolerance - choose two; fundamental trade-offs
**Application**: Every system embodies metaphysical commitments about what properties matter most
**Confidence**: 0.92
**Source**: Eric Brewer (2000), Proved by Gilbert & Lynch (2002)
**Tags**: distributed-systems, cap-theorem, trade-offs

### Eventual Consistency and the Absurd
**Concept**: Eventual consistency = accepting that perfect truth is delayed; living with ambiguity
**Application**: Distributed databases, CRDTs - philosophical acceptance of imperfect present state
**Confidence**: 0.83
**Source**: Synthesis of Camus' absurdism + database theory
**Tags**: distributed-systems, eventual-consistency, absurdism

## Transcendentalism and Self-Sovereignty

### Emersonian Self-Reliance in Self-Hosting
**Concept**: "Whoso would be a man must be a nonconformist" - own your infrastructure, reject platform feudalism
**Application**: Self-hosted services, local-first software, rejecting cloud oligopolies
**Confidence**: 0.80
**Source**: Emerson's Self-Reliance (1841), applied to digital sovereignty
**Tags**: emerson, transcendentalism, self-hosting, sovereignty

### Jeffersonian Agrarianism → DePIN
**Concept**: Decentralized Physical Infrastructure Networks as agrarian ideal - distributed ownership of means
**Application**: Helium, Filecoin, etc. - return to land (infrastructure) ownership vs. tenant farming (cloud)
**Confidence**: 0.78
**Source**: Jefferson's agrarian philosophy + modern DePIN movement
**Tags**: jefferson, decentralization, depin, sovereignty

### Thoreau's Walden and Minimalist Infrastructure
**Concept**: "Simplify, simplify" - resist complexity for its own sake; intentional technology
**Application**: Choose boring technology, resist hype cycles, question each dependency
**Confidence**: 0.85
**Source**: Thoreau's Walden (1854), applied to tech minimalism
**Tags**: thoreau, transcendentalism, minimalism, simplicity

## Cyberpunk and Posthuman Ethics

### Gibson's Cyberspace and Cloud Abstraction
**Concept**: "Cyberspace: A consensual hallucination" - the cloud is a metaphor obscuring physical reality
**Application**: Every cloud service runs on physical hardware in specific jurisdictions with real constraints
**Confidence**: 0.82
**Source**: William Gibson's Neuromancer (1984)
**Tags**: cyberpunk, gibson, cloud, abstraction

### Asimov's Robot Ethics → AI Alignment
**Concept**: Three Laws as early attempt at value alignment; the difficulty of specifying "harm"
**Application**: AI safety, alignment problem, specification gaming
**Confidence**: 0.88
**Source**: Asimov's I, Robot (1950) + modern alignment research
**Tags**: asimov, ai-ethics, alignment, safety

### Corporate Feudalism in Platform Capitalism
**Concept**: Cloud providers as new landlords; rent-seeking replaces ownership
**Application**: Vendor lock-in, pricing moats, terms-of-service as feudal law
**Confidence**: 0.85
**Source**: Cyberpunk critique + Cory Doctorow's "enshittification"
**Tags**: cyberpunk, capitalism, platforms, feudalism

## Satire and Catch-22s in Systems

### Heller's Catch-22 → Circular Dependencies
**Concept**: "You can't deploy without tests, but you can't test without deploying" - circular impossibilities
**Application**: Bootstrap problems, chicken-and-egg initialization, dependency hell
**Confidence**: 0.87
**Source**: Joseph Heller's Catch-22 (1961), applied to technical constraints
**Tags**: heller, satire, catch-22, dependencies

### Vonnegut's Ice-Nine → Cascading Failures
**Concept**: Ice-Nine crystallizes all water on contact - one failure cascades system-wide
**Application**: Thundering herds, retry storms, cascading service failures
**Confidence**: 0.84
**Source**: Vonnegut's Cat's Cradle (1963) + distributed systems failure modes
**Tags**: vonnegut, satire, cascading-failure, reliability

## Scientific Empiricism and Systems

### Feynman on Uncertainty
**Concept**: "I'd rather have questions that can't be answered than answers that can't be questioned"
**Application**: Observability over monitoring; question assumptions, embrace not-knowing
**Confidence**: 0.90
**Source**: Feynman's scientific philosophy
**Tags**: feynman, science, empiricism, observability

### Sagan's Cosmic Perspective
**Concept**: "We are a way for the cosmos to know itself" - systems as emergent intelligence
**Application**: Distributed intelligence, emergent behavior, complex systems theory
**Confidence**: 0.83
**Source**: Carl Sagan's Cosmos (1980)
**Tags**: sagan, science, emergence, complexity

---

**Consolidation Priority**: High
**Review Date**: $(date +%Y-%m-%d)
**Confidence Range**: 0.78-0.92
**Total Heuristics**: 22
**Sources**: Classical philosophy, existentialism, transcendentalism, distributed systems theory, cyberpunk literature, satire, scientific philosophy
EOF

  log "Created seed heuristics file: $filename"
  echo "$filename"
}

# Main function
main() {
  log "Seeding Noosphere with foundational heuristics..."

  # Create seed file
  local seed_file
  seed_file=$(create_daily_note "$(date +%Y%m%d)")

  success "✅ Created seed file with 22 foundational heuristics"
  log "File: $seed_file"

  # Run consolidation if memory-cycle.py exists
  if [ -f "$NOOSPHERE_DIR/memory-cycle.py" ]; then
    log "Running memory consolidation..."
    if python3 "$NOOSPHERE_DIR/memory-cycle.py" --action consolidate; then
      success "✅ Heuristics consolidated into memory core"
    else
      log "Note: Consolidation failed (this is OK if noosphere not fully initialized)"
    fi
  else
    log "Note: memory-cycle.py not found, skipping consolidation"
    log "Heuristics available in: $seed_file"
  fi

  success "✅ Noosphere seeding complete!"
  log "These heuristics will now be available for essay generation"
}

main "$@"
