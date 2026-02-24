import { decodeObfuscation } from "../utils/obfuscation-decoder";
import type { ValidationResult } from "../../types";

/**
 * Lobster Reverse CAPTCHA V1 Scenario Handler
 *
 * Detects and validates lobster-themed math problems where:
 * 1. Challenge text contains "lobster" keyword
 * 2. Question includes a simple math operation (addition, subtraction, multiplication, division)
 * 3. Answer must be numeric-only (no text, no special chars, no leading zeros)
 * 4. Answer must match the correct math result
 *
 * Example:
 *   Challenge: "A lobster farmer has 42 lobsters. He divides them into 6 groups.
 *               How many per group?"
 *   Expected answer: "7" (42 / 6 = 7)
 *   Valid answers: "7"
 *   Invalid answers: "Seven", "7 lobsters", " 7 ", "07", "7.0"
 */
export class LobsterReverseCaptchaV1 {
  /**
   * Detects if challenge is a lobster reverse CAPTCHA V1 scenario
   *
   * @param challenge - The challenge question text (may contain obfuscation)
   * @returns "lobster_reverse_captcha_v1" if detected, null otherwise
   */
  static detectScenario(challenge: string): string | null {
    if (!challenge) return null;

    const lowerChallenge = challenge.toLowerCase();

    // Must contain "lobster" keyword
    if (!lowerChallenge.includes("lobster")) {
      return null;
    }

    // Check for math operation indicators
    const mathPatterns = [
      /\d+.*(?:divides?|divide|divided)\D+\d+/i, // division patterns
      /\d+.*(?:multiplied|multiply|times|per day)/i, // multiplication patterns
      /\d+.*(?:removed|sold|subtract|minus)\D+\d+/i, // subtraction patterns
      /\d+.*(?:added?|plus|more)\D+\d+/i, // addition patterns
    ];

    for (const pattern of mathPatterns) {
      if (pattern.test(challenge)) {
        return "lobster_reverse_captcha_v1";
      }
    }

    return null;
  }

  /**
   * Validates answer for lobster reverse CAPTCHA V1
   *
   * Decodes obfuscation, extracts math operation, validates format, and verifies result
   *
   * @param challenge - The challenge question text (may contain obfuscation)
   * @param answer - The user's answer to validate
   * @returns ValidationResult with valid flag and reasons for invalidity
   */
  static validate(challenge: string, answer: string): ValidationResult {
    const reasons: string[] = [];

    // 1. Decode obfuscation
    const decodedChallenge = decodeObfuscation(challenge);

    // 2. Validate answer format (must be numeric-only)
    if (!this.isNumericOnly(answer)) {
      reasons.push("Answer must be numeric-only (digits only, no spaces or special characters)");
      return { valid: false, reasons };
    }

    // 3. Extract operation from decoded challenge
    const operation = this.extractOperation(decodedChallenge);
    if (!operation) {
      reasons.push("Could not extract math operation from challenge");
      return { valid: false, reasons };
    }

    // 4. Calculate expected result
    const expected = this.calculateResult(operation.operands, operation.operation);

    // 5. Compare answer to expected result
    const answerNum = parseInt(answer, 10);
    if (answerNum !== expected) {
      reasons.push(`Expected ${expected}, but answer was ${answerNum}`);
      return { valid: false, reasons };
    }

    return { valid: true, reasons: [] };
  }

  /**
   * Extracts math operation (numbers and operator) from challenge text
   *
   * @param challenge - The decoded challenge text
   * @returns Object with operands array and operation string, or null if not found
   */
  private static extractOperation(
    challenge: string,
  ): { operands: number[]; operation: string } | null {
    // Extract all numbers from the challenge
    const numberMatches = challenge.match(/\d+/g);
    if (!numberMatches || numberMatches.length < 2) {
      return null;
    }

    // Get the first two numbers as operands
    const operands = [parseInt(numberMatches[0], 10), parseInt(numberMatches[1], 10)];

    // Determine the operation based on keywords
    const lowerChallenge = challenge.toLowerCase();

    if (/divides?|divide|divided.*into/i.test(lowerChallenge)) {
      return { operands, operation: "/" };
    }

    if (/multiply|multiplied|times|per day/i.test(lowerChallenge)) {
      return { operands, operation: "*" };
    }

    if (/removed|sold|subtract|minus/i.test(lowerChallenge)) {
      return { operands, operation: "-" };
    }

    if (/added?|plus|more.*added/i.test(lowerChallenge)) {
      return { operands, operation: "+" };
    }

    return null;
  }

  /**
   * Calculates the result of a math operation
   *
   * @param operands - Array of [operand1, operand2]
   * @param operation - The operator: "+", "-", "*", "/"
   * @returns The numeric result of the operation
   */
  private static calculateResult(operands: number[], operation: string): number {
    if (operands.length < 2) return 0;

    const [a, b] = operands;

    switch (operation) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return Math.floor(a / b); // Integer division
      default:
        return 0;
    }
  }

  /**
   * Validates that answer is numeric-only (pure digits)
   *
   * Strict validation:
   * - Must match /^\d+$/ (all digits)
   * - Must not have leading zeros (unless answer is just "0")
   * - Must not be empty
   *
   * @param answer - The answer string to validate
   * @returns true if answer is numeric-only, false otherwise
   */
  private static isNumericOnly(answer: string): boolean {
    // Must match pure digits
    if (!/^\d+$/.test(answer)) {
      return false;
    }

    // Reject leading zeros (except "0" itself)
    if (answer.length > 1 && answer[0] === "0") {
      return false;
    }

    return true;
  }
}
