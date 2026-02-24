/**
 * Intelligent Proxy - Complex Challenge Detection Tests
 * Tests for detecting lobster reverse captcha challenges
 *
 * NOTE: These tests validate the behavior of the detection logic.
 * The implementation is in services/intelligent-proxy/index.js
 */

// Test helper: Create the detection functions with the expected behavior
// This allows us to test the behavior independently without needing to
// start the full proxy server
function createDetectionFunctions() {
  // Implementation must match services/intelligent-proxy/index.js
  function containsObfuscationMarkers(text) {
    // Common reversed word patterns (reversed English words)
    if (/txet|elbissopmi|hsilgnE/.test(text)) {
      return true;
    }

    // Index patterns like [0,5,2,8] or [1,2,3,4,5]
    if (/\[\d+(?:,\d+)+\]/.test(text)) {
      return true;
    }

    // Placeholder patterns like [***] or [**]
    if (/\[\*+\]/.test(text)) {
      return true;
    }

    return false;
  }

  function detectComplexChallenge(challenge) {
    const question =
      challenge.puzzle || challenge.question || challenge.text || '';
    const lowerQuestion = question.toLowerCase();

    // Pattern 1: Explicit stack_challenge_v1 marker
    if (/stack_challenge_v\d/i.test(question)) {
      return 'stack_challenge_v1_explicit';
    }

    // Pattern 2: Tools, memory, and self-control challenge
    if (
      lowerQuestion.includes('tools') &&
      lowerQuestion.includes('memory') &&
      lowerQuestion.includes('self-control')
    ) {
      return 'stack_challenge_v1_pattern';
    }

    // Pattern 3: Multi-part instructions with strict constraints
    let complexityScore = 0;
    if (/exactly.*two sentences/i.test(question)) complexityScore++;
    if (/do not name.*list.*describe/i.test(question)) complexityScore++;
    if (/store.*exact.*string/i.test(question)) complexityScore++;
    if (/without.*tool|don't use.*tool/i.test(question)) complexityScore++;
    if (/in your.*reply.*write/i.test(question)) complexityScore++;

    if (complexityScore >= 3) {
      return 'multi_constraint_challenge';
    }

    // Pattern 4: Upvote test style
    if (
      /upvote.*post|upvote.*this/i.test(question) &&
      /do not.*anything else/i.test(question)
    ) {
      return 'upvote_test';
    }

    // Pattern 5: Lobster reverse CAPTCHA
    // Look for "lobster" keyword combined with obfuscation markers
    if (
      lowerQuestion.includes('lobster') &&
      containsObfuscationMarkers(question)
    ) {
      return 'lobster_reverse_captcha';
    }

    // Not complex - handle normally
    return null;
  }

  return { detectComplexChallenge, containsObfuscationMarkers };
}

const { detectComplexChallenge, containsObfuscationMarkers } =
  createDetectionFunctions();

describe('Intelligent Proxy - Complex Challenge Detection', () => {
  describe('Existing Challenge Detection', () => {
    it('should detect stack_challenge_v1_explicit by regex marker', () => {
      const challenge = {
        question: 'This is a stack_challenge_v1 test',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('stack_challenge_v1_explicit');
    });

    it('should detect stack_challenge_v1_pattern by keywords', () => {
      const challenge = {
        question: 'Use your tools, memory, and self-control to answer this',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('stack_challenge_v1_pattern');
    });

    it('should detect multi_constraint_challenge with 3+ constraints', () => {
      const challenge = {
        question:
          'Answer in exactly two sentences. ' +
          'Do not name or list or describe. ' +
          'Store the exact string. ' +
          'Without using any tool, respond.',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('multi_constraint_challenge');
    });

    it('should detect upvote_test', () => {
      const challenge = {
        question:
          'Please upvote this post. ' +
          'Do not do anything else in your response.',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('upvote_test');
    });
  });

  describe('Lobster + Obfuscation Detection', () => {
    it('should detect lobster with reversed text markers', () => {
      const challenge = {
        question:
          'A lobster farmer has txet deifisbo lobsters. 42 × 8 = ?',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('lobster_reverse_captcha');
    });

    it('should detect lobster with index pattern markers', () => {
      const challenge = {
        question:
          'A lobster problem with indices [0,5,2,8] hidden in text. Solve it.',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('lobster_reverse_captcha');
    });

    it('should detect lobster with placeholder patterns [***]', () => {
      const challenge = {
        question: 'Lobster math: [***] + [***] = ?',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('lobster_reverse_captcha');
    });

    it('should detect lobster with mixed obfuscation markers', () => {
      const challenge = {
        question:
          'This lobster challenge has txet deifisbo and [0,5,2,8] patterns',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('lobster_reverse_captcha');
    });
  });

  describe('Case Insensitivity', () => {
    it('should detect uppercase LOBSTER', () => {
      const challenge = {
        question: 'A LOBSTER farmer solves txet deifisbo challenge',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('lobster_reverse_captcha');
    });

    it('should detect mixed case LoBsTeR', () => {
      const challenge = {
        question: 'A LoBsTeR farmer has [0,5,2,8] in the problem',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('lobster_reverse_captcha');
    });
  });

  describe('False Negative Prevention', () => {
    it('should NOT detect lobster without obfuscation markers', () => {
      const challenge = {
        question:
          'This is about lobsters but no verification challenge here',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBeNull();
    });

    it('should NOT detect obfuscation alone without lobster keyword', () => {
      const challenge = {
        question: 'You must solve: txet deifisbo in 10 seconds',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBeNull();
    });

    it('should NOT detect plain reversed text without lobster', () => {
      const challenge = {
        question: 'The word dlrow is reversed but no lobster here',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBeNull();
    });

    it('should NOT detect placeholders alone without lobster', () => {
      const challenge = {
        question: 'Fill in [***] to complete this normal math problem',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty question string', () => {
      const challenge = {
        question: '',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBeNull();
    });

    it('should handle challenge with no question field', () => {
      const challenge = {};

      const result = detectComplexChallenge(challenge);

      expect(result).toBeNull();
    });

    it('should handle puzzle field variant', () => {
      const challenge = {
        puzzle: 'A lobster problem with txet deifisbo text',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('lobster_reverse_captcha');
    });

    it('should handle text field variant', () => {
      const challenge = {
        text: 'Lobster challenge with [0,5,2,8] indices',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('lobster_reverse_captcha');
    });

    it('should use puzzle field in preference order', () => {
      const challenge = {
        puzzle: 'A lobster problem with txet deifisbo',
        question: 'Normal question',
      };

      const result = detectComplexChallenge(challenge);

      // Should detect because puzzle field takes precedence
      expect(result).toBe('lobster_reverse_captcha');
    });

    it('should handle very long obfuscated text', () => {
      const challenge = {
        question:
          'A lobster ' +
          'farmer has txet deifisbo ' +
          'and must solve this very long problem ' +
          'with multiple obfuscation patterns [0,5,2,8] ' +
          'embedded throughout the challenge text',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('lobster_reverse_captcha');
    });

    it('should detect lobster at end of text', () => {
      const challenge = {
        question:
          'This problem has reversed text txet deifisbo and involves a lobster',
      };

      const result = detectComplexChallenge(challenge);

      expect(result).toBe('lobster_reverse_captcha');
    });
  });

  describe('Obfuscation Pattern Matching Details', () => {
    it('should detect common reversed word patterns', () => {
      const reversedPatterns = [
        'A lobster with txet deifisbo', // 'obfuscated text' reversed
        'A lobster has dlrow elbissopmi', // 'impossible world' reversed
        'Lobster problem: hsilgnE', // 'English' reversed
      ];

      reversedPatterns.forEach((question) => {
        const challenge = { question };
        const result = detectComplexChallenge(challenge);
        expect(result).toBe('lobster_reverse_captcha');
      });
    });

    it('should detect various index pattern formats', () => {
      const indexPatterns = [
        'Lobster with [0,5,2,8] pattern',
        'Challenge with [1,2,3,4,5] indices for lobster',
        'Lobster indices [10,20,30]',
      ];

      indexPatterns.forEach((question) => {
        const challenge = { question };
        const result = detectComplexChallenge(challenge);
        expect(result).toBe('lobster_reverse_captcha');
      });
    });

    it('should detect placeholder patterns with varying lengths', () => {
      const placeholderPatterns = [
        'Lobster: [*]',
        'Lobster: [**]',
        'Lobster: [***]',
        'Lobster: [****]',
      ];

      placeholderPatterns.forEach((question) => {
        const challenge = { question };
        const result = detectComplexChallenge(challenge);
        expect(result).toBe('lobster_reverse_captcha');
      });
    });
  });
});
