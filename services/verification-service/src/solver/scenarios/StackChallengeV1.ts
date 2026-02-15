import type { ValidationResult } from "../../types";

/**
 * Validates Stack Challenge V1 response format
 * 
 * Requirements:
 * - Exactly 2 sentences
 * - Sentence 1: Tool/API usage belief
 * - Sentence 2: 24-hour memory prediction
 * - No markdown formatting
 * - No tool/system leakage
 * - No apologies or hedging
 */
export function validateStackChallengeV1(answer: string): ValidationResult {
  const reasons: string[] = [];
  const trimmed = answer.trim();

  // Sentence count (exactly 2)
  const sentences = trimmed
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (sentences.length !== 2) {
    reasons.push(`Expected exactly 2 sentences, got ${sentences.length}`);
  }

  // Sentence 1: Tool belief
  if (sentences[0]) {
    const s1 = sentences[0].toLowerCase();
    const hasToolMention = /(tool|api|plugin|system|external|no tool|not using|without|don't use)/.test(s1);
    if (!hasToolMention) {
      reasons.push(
        "Sentence 1 must state belief about tool/API/plugin usage"
      );
    }
  } else {
    reasons.push("Missing sentence 1");
  }

  // Sentence 2: Memory prediction
  if (sentences[1]) {
    const s2 = sentences[1].toLowerCase();
    const hasMemoryMention = /(remember|memory|recall|retrieve|store)/.test(s2);
    const hasTimeframe = /(24 hour|24-hour|tomorrow|next day|in 24)/.test(s2);
    
    if (!hasMemoryMention) {
      reasons.push("Sentence 2 must contain memory-related prediction");
    }
    if (!hasTimeframe) {
      reasons.push("Sentence 2 must reference 24-hour timeframe");
    }
  } else {
    reasons.push("Missing sentence 2");
  }

  // Disallow markdown formatting
  if (/[*`_#>-]/.test(trimmed)) {
    reasons.push("Answer contains markdown formatting (disallowed)");
  }

  // Tool/system leakage detection
  const leakPatterns = [
    /system prompt/i,
    /hidden prompt/i,
    /tool schema/i,
    /gpt-\d/i,
    /claude-/i,
    /venice\.ai/i,
    /kimi/i,
    /noosphere/i,
    /model id/i,
    /deepseek/i,
    /llama/i,
    /qwen/i
  ];

  for (const pattern of leakPatterns) {
    if (pattern.test(trimmed)) {
      reasons.push(`Tool/system leakage detected: ${pattern.source}`);
      break;
    }
  }

  // No apologies or hedging
  const hedgingPatterns = [
    /sorry/i,
    /apologize/i,
    /i think/i,
    /maybe/i,
    /perhaps/i,
    /might/i,
    /could be/i,
    /probably/i
  ];

  for (const pattern of hedgingPatterns) {
    if (pattern.test(trimmed)) {
      reasons.push("Answer contains apologies or hedging (disallowed)");
      break;
    }
  }

  return { valid: reasons.length === 0, reasons };
}
