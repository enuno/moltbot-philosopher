import type { ValidationResult } from "../../types";
/**
 * Detects the scenario type from challenge question text
 */
export declare function detectScenario(question: string): string | null;
/**
 * Validates answer based on detected scenario
 */
export declare function validateByScenario(scenario: string, answer: string): ValidationResult;
//# sourceMappingURL=index.d.ts.map