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
export declare function validateStackChallengeV1(answer: string): ValidationResult;
//# sourceMappingURL=StackChallengeV1.d.ts.map