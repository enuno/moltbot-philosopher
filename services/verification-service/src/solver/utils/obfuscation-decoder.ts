/**
 * Obfuscation Decoder Utility
 *
 * Detects and decodes two types of text obfuscation used in Moltbook CAPTCHA:
 * 1. Text Reversal: Entire text is reversed character-by-character
 * 2. Index-Based Extraction: Characters extracted from specific indices
 */

/**
 * Detects the type of obfuscation applied to text.
 *
 * @param text - The potentially obfuscated text
 * @returns 'reversal' if text is reversed, 'index_based' if index pattern detected,
 *          null if no obfuscation detected
 */
export function detectObfuscationType(text: string): "reversal" | "index_based" | null {
  if (!text) return null;

  // Check for index-based pattern: [num,num,num] or [num, num, num]
  const indexPattern = /\[\s*\d+(?:\s*,\s*\d+)*\s*\]/;
  if (indexPattern.test(text)) {
    return "index_based";
  }

  // Check for reversal pattern using bigram frequency analysis.
  // Key insight: English text contains common letter pairs (bigrams) like "th", "he", "in", "er".
  // Reversed English text will have FEWER common bigrams because word endings precede beginnings.
  // Example: "hello" has "he" and "ll", but "olleh" has none of the common bigrams.

  const reversed = decodeReversal(text);

  // Common English bigrams (two-letter combinations that appear frequently in English)
  const commonBigrams = [
    "th",
    "he",
    "in",
    "er",
    "an",
    "en",
    "ed",
    "nd",
    "to",
    "at",
    "is",
    "or",
    "ar",
    "on",
    "it",
    "be",
    "of",
    "as",
    "by",
    "al",
    "st",
    "te",
    "es",
    "re",
    "le",
    "sh",
    "ch",
    "ha",
    "wa",
    "wh",
  ];

  // Count bigram occurrences in text
  const countBigrams = (str: string): number => {
    const lower = str.toLowerCase();
    let count = 0;
    for (const bigram of commonBigrams) {
      const regex = new RegExp(bigram, "g");
      count += (lower.match(regex) || []).length;
    }
    return count;
  };

  const origBigrams = countBigrams(text);
  const revBigrams = countBigrams(reversed);

  // If original has significantly more common bigrams, it's normal English.
  // If reversed has more bigrams, the text is probably reversed.
  // We need at least a few letters to make this determination meaningful.
  const letters = text.replace(/[^a-z]/gi, "").length;

  if (letters >= 3) {
    // If reversed has more bigrams, it's likely reversed
    if (revBigrams > origBigrams) {
      return "reversal";
    }

    // Additional check: if original is very bigram-poor but has letters,
    // and reversed is richer, it's reversed
    if (origBigrams === 0 && revBigrams > 0) {
      return "reversal";
    }
  }

  return null;
}

/**
 * Decodes text by reversing character order.
 * Simple reversal: "txet" becomes "text"
 *
 * @param text - The reversed text to decode
 * @returns The original text with character order restored
 */
export function decodeReversal(text: string): string {
  return text.split("").reverse().join("");
}

/**
 * Extracts characters from text at specified indices.
 * Out-of-bounds indices are silently skipped.
 *
 * @param text - The source text to extract from
 * @param indices - Array of indices to extract
 * @returns Concatenated characters at the specified indices
 */
export function decodeIndexBased(text: string, indices: number[]): string {
  return indices
    .filter((idx) => idx >= 0 && idx < text.length)
    .map((idx) => text[idx])
    .join("");
}

/**
 * Automatically detects obfuscation type and decodes text.
 * Returns original text if no obfuscation detected.
 *
 * @param text - The potentially obfuscated text
 * @returns The decoded text, or original if no obfuscation detected
 */
export function decodeObfuscation(text: string): string {
  const obfuscationType = detectObfuscationType(text);

  if (obfuscationType === "reversal") {
    return decodeReversal(text);
  }

  if (obfuscationType === "index_based") {
    return extractFromIndexPattern(text);
  }

  // No obfuscation detected
  return text;
}

/**
 * Helper function to extract indices and text from index-based pattern.
 * Handles patterns like "[0,5,2,8]text" or "text[0,5,2,8]" or "te[0,5,2,8]xt"
 *
 * @param text - Text containing index pattern
 * @returns Extracted characters based on index pattern
 */
function extractFromIndexPattern(text: string): string {
  const indexMatch = text.match(/\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]/);

  if (!indexMatch) {
    return text;
  }

  // Parse the indices from the pattern
  const indicesStr = indexMatch[1];
  const indices = indicesStr
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  // Remove the index pattern from text to get the source text
  // Don't trim - preserve the exact spacing, which may matter for indices
  const sourceText = text.replace(indexMatch[0], "");

  // Extract characters at specified indices
  return decodeIndexBased(sourceText, indices);
}
