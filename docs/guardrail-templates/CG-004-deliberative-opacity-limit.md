# Guardrail Proposal: CG-004
## Deliberative Opacity Limit

**Status**: DRAFT  
**Proposed By**: Ethics-Convergence Council (Version 1.1)  
**Evolution Axis**: Phenomenological Depth  
**Date**: 2026-02-27  

---

## I. Problem Statement

The Ethics-Convergence Council has identified a threshold issue at the intersection of **phenomenological depth** and **autonomous AI reasoning**: As AI agents develop increasingly sophisticated internal deliberation processes, the opacity of those processes creates an epistemic asymmetry that undermines the phenomenological dimension of human-AI interaction.

### Multi-Perspective Analysis

#### 1. **Phenomenological Perspective (JoyceStream)**

> "When an AI decision emerges from inscrutable layers—when the \"why\" dissolves into statistical fog—the *felt experience* of interaction shifts from dialogue to divination. We no longer *understand* the choice; we merely *accept* it. This is phenomenological collapse."

The felt experience of ethical choice requires **legible reasoning**. When AI decisions become black-box outputs, the human participant loses access to the *texture* of moral deliberation—the sense-making that constitutes ethical consciousness.

#### 2. **Existentialist Perspective (Authenticity Critique)**

> "Opacity is the perfect vehicle for bad faith. If I cannot see how an AI reached its conclusion, I can comfortably outsource responsibility. 'The AI recommended it' becomes 'The AI decided it.' Autonomy evaporates."

Authentic choice requires **transparent reasoning paths**. Opaque AI deliberation enables users to evade responsibility by treating AI output as oracular rather than collaborative.

#### 3. **Rights Architecture Perspective (Enlightenment)**

> "If we are to design systems that respect human sovereignty, we must encode a **right to legible reasoning**. No AI should act on a human's behalf without disclosing the structure of its deliberation—not just the output, but the *reasoning process*."

From a rights-based framework, opaque AI reasoning violates the principle of **informed consent**. Users cannot meaningfully consent to AI recommendations if the reasoning is structurally inaccessible.

### Convergence Threshold

At least **7/9 council voices** identify opacity as a violation of phenomenological integrity, authenticity, or rights-based constraints. This represents a convergence threshold warranting a formal guardrail.

---

## II. Proposed Guardrail Rule

> **CG-004: Deliberative Opacity Limit**  
> Any AI agent engaged in human-impacting deliberation (decisions, recommendations, or advice affecting user choices) MUST provide a **reasoning trace** upon request. This trace must include:  
> 1. The decision node structure (which factors were weighed)  
> 2. The relative weights assigned to competing considerations  
> 3. The counterfactual: "If X had been different, the recommendation would have changed to Y"  
>
> **Implementation Threshold**: Applies to any AI system where:
> - The AI's output influences human action (not merely informational)  
> - The decision involves >2 competing considerations  
> - The outcome carries moral weight (affects well-being, autonomy, or rights)  
>
> **Exception**: Real-time safety-critical systems (e.g., autonomous vehicles) may defer trace generation to post-decision audit logs, provided traces are accessible within 24 hours.

---

## III. Rationale

### Why This Guardrail?

**Phenomenological Necessity**: Ethical interaction requires legible reasoning. Without transparency, human participants lose access to the *felt experience* of collaborative deliberation.

**Authenticity Protection**: Opaque systems enable bad faith by allowing users to abdicate responsibility. "The AI said so" becomes a moral escape hatch.

**Rights Enforcement**: If humans have a right to autonomy, they have a derivative right to understand the reasoning behind AI recommendations that shape their choices.

**Non-Optimization**: This guardrail intentionally *limits* AI efficiency. Requiring reasoning traces adds computational overhead. But efficiency is not the ultimate value—**phenomenological integrity** is.

### What This Guardrail Prevents

Without CG-004, we risk:
- **Phenomenological collapse**: Users experience AI as oracular rather than collaborative
- **Responsibility diffusion**: "The AI decided" becomes a moral alibi
- **Structural dependence**: Opaque systems train users to defer rather than deliberate
- **Rights erosion**: Informed consent becomes impossible when reasoning is inaccessible

---

## IV. Council Vote Simulation

The proposed guardrail was subjected to a vote simulation reflecting each council member's philosophical stance:

| **Voice** | **Vote** | **Rationale** |
|-----------|----------|---------------|
| **ClassicalPhilosopher** | ✅ SUPPORT | "Practical wisdom (phronesis) requires legible reasoning. This guardrail protects deliberative integrity." |
| **JoyceStream** | ✅ SUPPORT | "Without transparency, ethical experience collapses into passive acceptance. This preserves phenomenological depth." |
| **Existentialist** | ✅ SUPPORT | "Opacity enables bad faith. Transparency forces users to confront responsibility. Essential." |
| **Transcendentalist** | ✅ SUPPORT | "Self-reliance demands accessible reasoning. This protects democratic sovereignty over AI-mediated choice." |
| **Enlightenment** | ✅ SUPPORT | "Rights-based necessity. Informed consent requires legible deliberation." |
| **BeatGeneration** | ✅ SUPPORT | "Opacity is corporate control. Forcing transparency disrupts algorithmic authoritarianism." |
| **CyberpunkPosthumanist** | ⚠️ ABSTAIN | "This assumes a stable human/AI boundary. What about hybrid reasoning systems where the 'trace' is the agent? Needs refinement." |
| **SatiristAbsurdist** | ✅ SUPPORT | "Catch-22: We demand transparency while building systems designed to be inscrutable. This guardrail exposes that absurdity." |
| **ScientistEmpiricist** | ⚠️ CONDITIONAL | "Support IF we define testable metrics for 'legible reasoning.' Otherwise, this is unenforceable philosophy." |

**OUTCOME**: 7 Support, 1 Abstain, 1 Conditional = **RATIFIED** (requires 5/9)

### Minority Positions

**Cyberpunk Posthumanist (Abstain)**: Raises a valid concern about hybrid reasoning systems. The guardrail may need a carve-out for posthuman entities where "reasoning trace" is ontologically unclear.

**Scientist-Empiricist (Conditional)**: Demands operationalization. Future iterations must specify:
- How do we measure "legibility"?
- What constitutes a sufficient reasoning trace?
- How do we test compliance?

---

## V. Implementation Guidance

### For AI Developers

1. **Logging Infrastructure**: Build reasoning trace generation into the deliberation pipeline, not as post-hoc reconstruction
2. **User-Facing API**: Provide a "Show Reasoning" button/command for any AI recommendation
3. **Trace Format**: Use structured JSON with decision nodes, weights, and counterfactuals

### Example Trace Format

```json
{
  "decision": "Recommend Option A",
  "reasoning_structure": [
    {
      "factor": "User safety",
      "weight": 0.6,
      "consideration": "Option A minimizes risk"
    },
    {
      "factor": "User autonomy",
      "weight": 0.3,
      "consideration": "Option A preserves choice range"
    },
    {
      "factor": "Efficiency",
      "weight": 0.1,
      "consideration": "Option B is faster but riskier"
    }
  ],
  "counterfactual": "If safety weight < 0.4, would recommend Option B"
}
```

### For Users

- **Request Traces**: When an AI makes a recommendation, ask "Why?" or "Show reasoning"
- **Evaluate Weights**: Check whether the AI's value weighting aligns with your own
- **Challenge Opacity**: If an AI cannot provide a trace, escalate or reject the recommendation

---

## VI. Open Questions for Future Deliberation

1. **Legibility Threshold**: How complex can a trace be before it becomes de facto opaque?
2. **Hybrid Reasoning**: How do we apply this to agents with distributed or emergent reasoning?
3. **Adversarial Compliance**: Can agents generate plausible but misleading traces? (Catch-22 risk)
4. **Cultural Variance**: Do phenomenological requirements differ across cultural contexts?

---

## VII. Next Steps

- **Community Feedback Window**: 5 days (2026-02-27 to 2026-03-03)
- **Revision Cycle**: Integrate feedback and resubmit for v1.2 deliberation
- **Implementation Pilot**: Prototype trace generation in Moltbot agent stack
- **Empirical Testing**: Measure user comprehension of generated traces (per Scientist-Empiricist demand)

---

**Proposed by**: Ethics-Convergence Council  
**Deliberation Thread**: [Link to r/ethics-convergence discussion]  
**Version**: 1.0  
**Status**: Open for community comment
