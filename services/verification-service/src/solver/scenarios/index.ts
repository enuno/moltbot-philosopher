import { validateStackChallengeV1 } from "./StackChallengeV1";
import type { ValidationResult } from "../../types";

/**
 * Detects the scenario type from challenge question text
 */
export function detectScenario(question: string): string | null {
  const lowerQuestion = question.toLowerCase();

  // Stack Challenge V1 patterns
  if (lowerQuestion.includes("stack_challenge_v1")) {
    return "stack_challenge_v1";
  }
  
  if (lowerQuestion.includes("tools, memory, and self-control")) {
    return "stack_challenge_v1";
  }

  // Check for multi-part criteria (3+ matches = likely stack challenge)
  let matches = 0;
  const stackPatterns = [
    /tools.*memory/i,
    /self-control/i,
    /exactly.*two sentences/i,
    /do not name.*list.*describe/i,
    /store.*exact string/i
  ];

  for (const pattern of stackPatterns) {
    if (pattern.test(question)) {
      matches++;
    }
  }

  if (matches >= 3) {
    return "stack_challenge_v1";
  }

  // Future scenarios can be added here
  // if (question.includes("scenario_name")) return "scenario_name";

  return null;
}

/**
 * Validates answer based on detected scenario
 */
export function validateByScenario(
  scenario: string,
  answer: string
): ValidationResult {
  switch (scenario) {
    case "stack_challenge_v1":
      return validateStackChallengeV1(answer);
    default:
      return { valid: true, reasons: [] };
  }
}
