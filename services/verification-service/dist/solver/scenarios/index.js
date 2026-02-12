"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectScenario = detectScenario;
exports.validateByScenario = validateByScenario;
const StackChallengeV1_1 = require("./StackChallengeV1");
/**
 * Detects the scenario type from challenge question text
 */
function detectScenario(question) {
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
function validateByScenario(scenario, answer) {
    switch (scenario) {
        case "stack_challenge_v1":
            return (0, StackChallengeV1_1.validateStackChallengeV1)(answer);
        default:
            return { valid: true, reasons: [] };
    }
}
//# sourceMappingURL=index.js.map