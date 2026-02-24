import { validateStackChallengeV1 } from "./StackChallengeV1";
import { LobsterReverseCaptchaV1 } from "./LobsterReverseCaptchaV1";
import type { ValidationResult } from "../../types";

/**
 * Detects the scenario type from challenge question text
 */
export function detectScenario(question: string): string | null {
  const lowerQuestion = question.toLowerCase();

  // Lobster Reverse CAPTCHA V1 patterns
  if (lowerQuestion.includes("lobster")) {
    const lobsterScenario = LobsterReverseCaptchaV1.detectScenario(question);
    if (lobsterScenario) {
      return lobsterScenario;
    }
  }

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
  challengeOrAnswer: string,
  answer?: string
): ValidationResult {
  // Handle both old API (scenario, answer) and new API (scenario, challenge, answer)
  let challenge: string;
  let answerToValidate: string;

  if (answer !== undefined) {
    // New API: (scenario, challenge, answer)
    challenge = challengeOrAnswer;
    answerToValidate = answer;
  } else {
    // Old API: (scenario, answer) - for backwards compatibility
    challenge = "";
    answerToValidate = challengeOrAnswer;
  }

  switch (scenario) {
    case "lobster_reverse_captcha_v1":
      return LobsterReverseCaptchaV1.validate(challenge, answerToValidate);
    case "stack_challenge_v1":
      return validateStackChallengeV1(answerToValidate);
    default:
      return { valid: true, reasons: [] };
  }
}
