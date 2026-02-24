/**
 * PreprocessingEngine
 *
 * Intelligent preprocessing of obfuscated verification challenges.
 * Handles: symbol stripping, case normalization, word splitting, word-to-number conversion.
 *
 * Usage:
 *   const engine = new PreprocessingEngine();
 *   const result = engine.preprocess("*TwEnTy* + *FiVe*");
 *   // result: "20 5" or similar numeric representation
 */

class PreprocessingEngine {
  // Word-to-number mapping for English number words
  static WORD_NUMBERS = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
    'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000
  };

  /**
   * Strip symbols: remove punctuation, keep alphanumeric + spaces
   * "*25* + *12*" → "25 12"
   */
  stripSymbols(text) {
    return text.replace(/[^\w\s]/g, '').trim();
  }

  /**
   * Normalize alternating case: "AlTeRnAtInG" → "alternating"
   */
  normalizeAlternatingCase(text) {
    return text.toLowerCase();
  }

  /**
   * Normalize whitespace: multiple spaces → single space, trim
   */
  normalizeWhitespace(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Check if text contains non-ASCII characters (emoji, unicode)
   */
  hasNonAscii(text) {
    return /[^\x00-\x7F]/.test(text);
  }

  /**
   * Detect word splitting: find separated numbers/words
   * "t#WeNt$Y f%IvE" → "twenty five"
   */
  splitWords(text) {
    let result = text;
    const wordList = Object.keys(PreprocessingEngine.WORD_NUMBERS)
      .sort((a, b) => b.length - a.length);

    // Try to reconstruct words by removing internal separators
    for (const word of wordList) {
      // Create pattern that matches word with separators inside: t[^a-z]*w[^a-z]*e...
      const chars = word.split('').join('[^a-z]*');
      const regex = new RegExp(chars, 'gi');
      result = result.replace(regex, ` ${word} `);
    }

    // Clean up: remove non-alphanumeric separators, split into words
    return result.replace(/[^\w\s]/g, ' ')
                 .split(/\s+/)
                 .filter(w => w.length > 0)
                 .join(' ');
  }

  /**
   * Split concatenated words and add spaces between them
   * "twentyfive" → "twenty five"
   */
  insertWordSpaces(text) {
    let result = text;
    const wordList = Object.keys(PreprocessingEngine.WORD_NUMBERS)
      .sort((a, b) => b.length - a.length);

    for (const word of wordList) {
      const regex = new RegExp(word, 'g');
      result = result.replace(regex, ` ${word} `);
    }

    return this.normalizeWhitespace(result);
  }

  /**
   * Convert English words to numbers: "twenty five" → "25"
   * Sums consecutive numbers (e.g., "twenty five" → 25)
   */
  wordsToNumbers(text) {
    const tokens = text.toLowerCase().split(/\s+/);
    let result = '';
    let current = 0;

    for (const token of tokens) {
      const words = PreprocessingEngine.WORD_NUMBERS;

      // Try exact word match first
      if (words.hasOwnProperty(token)) {
        current += words[token];
      }
      // Try digit token
      else if (/^\d+$/.test(token)) {
        if (current > 0) result += current.toString() + ' ';
        result += token + ' ';
        current = 0;
      }
      // Try fuzzy word matching (handles partially obfuscated words)
      else {
        let found = false;
        for (const [word, value] of Object.entries(words)) {
          if (token.includes(word) && word.length > 2) {
            current += value;
            found = true;
            break;
          }
        }
        if (!found && token.length > 0) {
          // Token unrecognized - append current sum and keep token
          if (current > 0) {
            result += current.toString() + ' ';
            current = 0;
          }
          result += token + ' ';
        }
      }
    }

    if (current > 0) result += current.toString();

    result = result.trim();
    return result.length > 0 ? result : text;
  }

  /**
   * Convert words to numbers while preserving structure (no summing)
   * Used for emoji/unicode input: "twenty five" → "20 5"
   */
  wordsToNumbersSeparate(text) {
    const tokens = text.toLowerCase().split(/\s+/);
    return tokens.map(token => {
      if (PreprocessingEngine.WORD_NUMBERS.hasOwnProperty(token)) {
        return PreprocessingEngine.WORD_NUMBERS[token].toString();
      }
      return token;
    }).join(' ');
  }

  /**
   * Preprocess full pipeline: normalize → split → convert to numbers
   */
  preprocess(text) {
    // Handle empty input
    if (!text || text.trim().length === 0) {
      return '';
    }

    // Detect emoji/unicode (requires separate number handling)
    const hasEmoji = this.hasNonAscii(text);

    // Normalize: strip symbols, case, whitespace
    let normalized = this.stripSymbols(text);
    normalized = this.normalizeAlternatingCase(normalized);
    normalized = this.normalizeWhitespace(normalized);

    // Return if already numeric
    if (/^\d+(\s+\d+)*$/.test(normalized)) {
      return normalized;
    }

    // If has letters, try word conversion
    if (/[a-z]/.test(normalized)) {
      // Split concatenated words (e.g., "twentyfive" → "twenty five")
      const withSpaces = this.insertWordSpaces(normalized);

      // For emoji input, keep numbers separate; otherwise sum them
      if (hasEmoji) {
        return this.wordsToNumbersSeparate(withSpaces);
      }

      const converted = this.wordsToNumbers(withSpaces);
      if (/\d+/.test(converted)) {
        return converted;
      }
    }

    // Fallback: More aggressive word splitting
    const split = this.splitWords(text);
    const afterCase = this.normalizeAlternatingCase(split);
    const converted = this.wordsToNumbers(afterCase);

    return converted;
  }
}

module.exports = PreprocessingEngine;
