/**
 * ComplexityAnalyzer
 *
 * Analyzes challenge text and determines complexity level for intelligent model selection.
 *
 * Complexity Levels:
 * - LOW (score < 0.33): Simple numeric challenges, minimal obfuscation
 * - MEDIUM (0.33 ≤ score < 0.67): Moderate obfuscation with alternating case or symbols
 * - HIGH (score ≥ 0.67): Heavy obfuscation with multiple interleaved techniques
 *
 * Scoring Factors (weighted):
 * - symbolDensity (35%): Ratio of non-alphanumeric characters, amplified for sensitivity
 * - wordSplitting (45%): Detection of words separated by non-alphanumeric characters
 * - alternatingCase (15%): Ratio of case transitions in text
 * - unicodeDensity (5%): Presence of non-ASCII characters (emoji, unicode)
 */

class ComplexityAnalyzer {
  // Score thresholds for classification
  // LOW: score < 0.33 (minimal obfuscation)
  // MEDIUM: 0.33 ≤ score < 0.65 (moderate obfuscation)
  // HIGH: score ≥ 0.65 (heavy obfuscation with multiple techniques)
  static THRESHOLDS = {
    LOW: 0.33,
    MEDIUM: 0.65
  };
  /**
   * Analyze challenge complexity
   * @param {string} challenge - The challenge text
   * @returns {{ level: string, score: number, factors: object }}
   */
  analyze(challenge) {
    // Guard against empty input that could cause NaN
    if (!challenge || challenge.length === 0) {
      return { level: 'LOW', score: 0, factors: {} };
    }

    const factors = {
      symbolDensity: this._calculateSymbolDensity(challenge),
      wordSplitting: this._calculateWordSplitting(challenge),
      alternatingCase: this._calculateAlternatingCase(challenge),
      unicodeDensity: this._calculateUnicodeDensity(challenge),
      mixedTypes: this._calculateMixedTypes(challenge)
    };

    // Weighted score: 0-1
    const score =
      (factors.symbolDensity * 0.35) +
      (factors.wordSplitting * 0.45) +
      (factors.alternatingCase * 0.15) +
      (factors.unicodeDensity * 0.05);

    const level = this._scoreToLevel(score);

    return { level, score, factors };
  }

  _calculateSymbolDensity(text) {
    // Ratio of non-alphanumeric characters (amplified)
    const nonAlphanumeric = (text.match(/[^a-z0-9\s]/gi) || []).length;
    const density = nonAlphanumeric / text.length;
    return Math.min(density * 3, 1); // Amplify symbol density significantly
  }

  _calculateWordSplitting(text) {
    // Detect words split by separators (e.g., t#we@nty)
    // High word splitting = high score
    const pattern = /[a-z]+[^a-z0-9\s]+[a-z]+/gi;
    const matches = (text.match(pattern) || []).length;
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    // Guard against empty word count
    if (wordCount === 0) return 0;
    // Amplify the ratio
    return Math.min((matches / wordCount) * 2, 1);
  }

  _calculateAlternatingCase(text) {
    // Detect alternating case patterns
    let caseChanges = 0;
    let letterCount = 0;
    for (let i = 0; i < text.length; i++) {
      if (/[a-zA-Z]/.test(text[i])) letterCount++;
      if (i > 0) {
        const prev = text[i - 1];
        const curr = text[i];
        if (/[a-z]/.test(prev) && /[A-Z]/.test(curr)) {
          caseChanges++;
        } else if (/[A-Z]/.test(prev) && /[a-z]/.test(curr)) {
          caseChanges++;
        }
      }
    }
    // Guard against insufficient letters for meaningful ratio
    if (letterCount < 2) return 0;
    return Math.min(caseChanges / (letterCount - 1), 1);
  }

  _calculateUnicodeDensity(text) {
    // Detect non-ASCII characters (emoji, unicode)
    const unicode = (text.match(/[^\x00-\x7F]/g) || []).length;
    return Math.min(unicode / text.length, 1);
  }

  _calculateMixedTypes(text) {
    // Check if symbols and letters are mixed together (strong obfuscation signal)
    const hasSymbols = /[^a-z0-9\s]/i.test(text);
    const hasLetters = /[a-z]/i.test(text);

    if (!hasSymbols || !hasLetters) return 0;

    // Count transitions between types
    let transitions = 0;
    let prevType = null;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      let currentType;
      if (/[a-z]/i.test(char)) currentType = 'letter';
      else if (/[0-9]/.test(char)) currentType = 'number';
      else if (/\s/.test(char)) currentType = 'space';
      else currentType = 'symbol';

      if (currentType !== 'space' && prevType && prevType !== currentType) {
        transitions++;
      }
      if (currentType !== 'space') prevType = currentType;
    }

    // High transitions indicate heavy mixing
    return Math.min(transitions / text.length, 1);
  }

  _scoreToLevel(score) {
    if (score < ComplexityAnalyzer.THRESHOLDS.LOW) return 'LOW';
    if (score < ComplexityAnalyzer.THRESHOLDS.MEDIUM) return 'MEDIUM';
    return 'HIGH';
  }
}

module.exports = ComplexityAnalyzer;
