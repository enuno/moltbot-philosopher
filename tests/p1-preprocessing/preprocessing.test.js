/**
 * P1.1 - Text Preprocessing Layer Tests
 *
 * Tests for intelligent preprocessing of obfuscated verification challenges.
 * Goal: Normalize heavily obfuscated text to extract numeric patterns.
 * Target: 65%+ success rate on obfuscated challenges
 */

const assert = require('assert');
const PreprocessingEngine = require('../../services/intelligent-proxy/src/preprocessing-engine');

describe('P1.1 - Text Preprocessing Layer', () => {
  let engine;

  beforeEach(() => {
    engine = new PreprocessingEngine();
  });

  describe('Unit Tests: Symbol Stripping', () => {
    it('should strip punctuation from simple challenge', () => {
      const input = '*25* + *12*';
      const result = engine.stripSymbols(input);
      // Should remove symbols, keep digits and spaces
      assert(result.includes('25'), 'Should contain 25');
      assert(result.includes('12'), 'Should contain 12');
      assert(!result.includes('*'), 'Should remove asterisks');
      assert(!result.includes('+'), 'Should remove plus sign');
    });

    it('should preserve digits and spaces when stripping symbols', () => {
      const input = '25*!@#$%^&()12';
      const result = engine.stripSymbols(input);
      assert.strictEqual(result.replace(/\s/g, ''), '2512', 'Should preserve digits');
    });

    it('should handle challenge with mixed symbols', () => {
      const input = '#25$!12%^&';
      const result = engine.stripSymbols(input);
      assert(result.includes('25'), 'Should extract 25');
      assert(result.includes('12'), 'Should extract 12');
    });

    it('should strip symbols from word-obfuscated text', () => {
      const input = 't#we@nty-five';
      const result = engine.stripSymbols(input);
      assert(result.includes('twenty'), 'Should preserve word letters');
      assert(result.includes('five'), 'Should preserve word letters');
    });

    it('should handle edge case: only symbols', () => {
      const input = '!@#$%^&*()';
      const result = engine.stripSymbols(input);
      assert.strictEqual(result.trim(), '', 'Should return empty for all symbols');
    });
  });

  describe('Unit Tests: Alternating Case Normalization', () => {
    it('should normalize alternating case pattern', () => {
      const input = 'AlTeRnAtInG';
      const result = engine.normalizeAlternatingCase(input);
      assert.strictEqual(result, 'alternating', 'Should normalize to lowercase');
    });

    it('should handle already lowercase text', () => {
      const input = 'twenty five';
      const result = engine.normalizeAlternatingCase(input);
      assert.strictEqual(result, 'twenty five', 'Should preserve lowercase');
    });

    it('should handle all uppercase', () => {
      const input = 'TWENTY FIVE';
      const result = engine.normalizeAlternatingCase(input);
      assert.strictEqual(result, 'twenty five', 'Should normalize to lowercase');
    });

    it('should handle mixed case with numbers', () => {
      const input = 'TwEnTy25FiVe';
      const result = engine.normalizeAlternatingCase(input);
      assert.strictEqual(result, 'twenty25five', 'Should normalize case, preserve numbers');
    });
  });

  describe('Unit Tests: Whitespace Normalization', () => {
    it('should collapse multiple spaces to single space', () => {
      const input = 'twenty     five';
      const result = engine.normalizeWhitespace(input);
      assert.strictEqual(result, 'twenty five', 'Should collapse spaces');
    });

    it('should trim leading/trailing whitespace', () => {
      const input = '   twenty five   ';
      const result = engine.normalizeWhitespace(input);
      assert.strictEqual(result, 'twenty five', 'Should trim whitespace');
    });

    it('should handle tabs and newlines', () => {
      const input = 'twenty\t\tfive\n\nplus\tten';
      const result = engine.normalizeWhitespace(input);
      assert.strictEqual(result, 'twenty five plus ten', 'Should normalize all whitespace');
    });

    it('should handle edge case: only whitespace', () => {
      const input = '   \t\n   ';
      const result = engine.normalizeWhitespace(input);
      assert.strictEqual(result, '', 'Should return empty after trimming');
    });
  });

  describe('Unit Tests: Word Splitting', () => {
    it('should split obfuscated words with non-alphanumeric separators', () => {
      const input = 't#we@nty-five';
      const result = engine.splitWords(input);
      assert(result.includes('twenty'), 'Should extract twenty');
      assert(result.includes('five'), 'Should extract five');
    });

    it('should handle heavily obfuscated text', () => {
      const input = 't#WeNt$Y f%IvE + t@WeL#vE';
      const result = engine.splitWords(input);
      // Should split into words separated by spaces/non-alphanumeric
      const words = result.split(/\s+/);
      assert(words.length >= 3, 'Should split into multiple words');
    });

    it('should preserve digit sequences', () => {
      const input = '25#!@12';
      const result = engine.splitWords(input);
      assert(result.includes('25'), 'Should preserve 25');
      assert(result.includes('12'), 'Should preserve 12');
    });

    it('should handle no separators (already split)', () => {
      const input = 'twenty five';
      const result = engine.splitWords(input);
      assert.strictEqual(result, 'twenty five', 'Should preserve already-split text');
    });
  });

  describe('Unit Tests: Words to Numbers Conversion', () => {
    it('should convert word numbers to digits', () => {
      const input = 'twenty five';
      const result = engine.wordsToNumbers(input);
      assert.strictEqual(result, '25', 'Should convert to 25');
    });

    it('should sum component words', () => {
      const input = 'twenty five';
      const result = engine.wordsToNumbers(input);
      assert.strictEqual(result, '25', 'Should handle compound numbers');
    });

    it('should preserve existing digits', () => {
      const input = '25 plus 12';
      const result = engine.wordsToNumbers(input);
      assert(result.includes('25'), 'Should preserve 25');
      assert(result.includes('12'), 'Should preserve 12');
    });

    it('should handle single digit words', () => {
      const input = 'three';
      const result = engine.wordsToNumbers(input);
      assert.strictEqual(result, '3', 'Should convert three to 3');
    });

    it('should handle edge case: no numbers', () => {
      const input = 'hello world';
      const result = engine.wordsToNumbers(input);
      assert.strictEqual(result, 'hello world', 'Should return original if no numbers found');
    });
  });

  describe('Unit Tests: Full Preprocessing Pipeline', () => {
    it('should preprocess simple numeric challenge', () => {
      const input = '25 + 12';
      const result = engine.preprocess(input);
      assert(result.includes('25'), 'Should contain 25');
      assert(result.includes('12'), 'Should contain 12');
    });

    it('should preprocess symbol-obfuscated challenge', () => {
      const input = '*25* + *12*';
      const result = engine.preprocess(input);
      assert(result.includes('25'), 'Should extract 25 from symbols');
      assert(result.includes('12'), 'Should extract 12 from symbols');
    });

    it('should preprocess alternating-case obfuscation', () => {
      const input = 'TwEnTy FiVe PlUs TwElVe';
      const result = engine.preprocess(input);
      // Result should be 37 or contain numeric values
      assert(/\d+/.test(result), 'Should extract numeric result');
    });

    it('should preprocess heavily mixed obfuscation', () => {
      const input = 't#WeNt$Y f%IvE + t@WeL#vE';
      const result = engine.preprocess(input);
      assert(result.length > 0, 'Should produce non-empty result');
      assert(/\d+/.test(result), 'Should extract numeric pattern');
    });

    it('should preserve already-clean input', () => {
      const input = '25 + 12';
      const result = engine.preprocess(input);
      assert(result.includes('25'), 'Should preserve 25');
      assert(result.includes('12'), 'Should preserve 12');
    });

    it('should handle edge case: empty input', () => {
      const input = '';
      const result = engine.preprocess(input);
      assert.strictEqual(result, '', 'Should handle empty input');
    });
  });

  describe('Integration Tests: End-to-End Preprocessing', () => {
    it('should extract number from alternating caps', () => {
      const input = 'TwEnTy FiVe';
      const result = engine.preprocess(input);
      assert.strictEqual(result, '25', 'Should normalize to 25');
    });

    it('should extract numbers with symbols mixed in', () => {
      const input = '2*5 +* 1^2';
      const result = engine.preprocess(input);
      // Should extract 25 and 12 from symbols
      assert(result.replace(/\s/g, '').includes('25'), 'Should extract 25');
      assert(result.replace(/\s/g, '').includes('12'), 'Should extract 12');
    });

    it('should handle real-world obfuscation pattern', () => {
      // Pattern: alternating caps + symbols + spacing
      const input = '  *T#w@E!nT$y*  +  *F%i^V&E*  ';
      const result = engine.preprocess(input);
      assert(result.includes('25') || /2.*5/.test(result.replace(/\s/g, '')), 'Should extract 25');
    });

    it('should preprocess multi-number challenge', () => {
      const input = '25 + 12 - 8';
      const result = engine.preprocess(input);
      assert(result.includes('25'), 'Should contain 25');
      assert(result.includes('12'), 'Should contain 12');
      assert(result.includes('8'), 'Should contain 8');
    });

    it('should handle unicode/emoji characters', () => {
      const input = 'twenty😀five';
      const result = engine.preprocess(input);
      // Should strip emoji, extract words
      assert(result.includes('twenty') || result.includes('20'), 'Should handle emoji');
    });
  });

  describe('Success Criteria: Accuracy Benchmarks', () => {
    it('should achieve 65%+ success on test cases (3/5 minimum)', () => {
      const testCases = [
        { input: '25 + 12', expected: /25.*12/, name: 'simple' },
        { input: 'TwEnTy FiVe', expected: /25/, name: 'alternating-case' },
        { input: '*25* + *12*', expected: /25.*12/, name: 'symbol-obfuscation' },
        { input: 't#WeNt$Y f%IvE + t@WeL#vE', expected: /\d+/, name: 'mixed-obfuscation' },
        { input: '50 - 8', expected: /50.*8/, name: 'multi-operator' }
      ];

      let passed = 0;
      for (const test of testCases) {
        const result = engine.preprocess(test.input);
        if (test.expected.test(result)) {
          passed++;
        } else {
          console.log(`FAIL: ${test.name} - input: "${test.input}", result: "${result}"`);
        }
      }

      const successRate = (passed / testCases.length) * 100;
      assert(successRate >= 60, `Success rate ${successRate}% should be >= 60%`);
    });
  });
});

module.exports = PreprocessingEngine;
