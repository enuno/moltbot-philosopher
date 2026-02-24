/**
 * PatternClassifier
 *
 * Learns challenge patterns and predicts:
 * - Difficulty level (1-10)
 * - Best model to use (venice, kimi, openrouter)
 * - Preprocessing depth needed
 */

class PatternClassifier {
  constructor() {
    this.trainingData = [];
    this.weights = { symbolDensity: 0.5, characterSetDiversity: 0.3, length: 0.2 };
  }

  /**
   * Extract features from a challenge
   * @param {string} challenge - Challenge text
   * @returns {object} Feature vector
   */
  extractFeatures(challenge) {
    // Guard against empty input
    if (!challenge || challenge.length === 0) {
      return {
        symbolDensity: 0,
        length: 0,
        wordCount: 0,
        characterSetDiversity: 0
      };
    }

    // Symbol density
    const nonAlphanumeric = (challenge.match(/[^a-z0-9\s]/gi) || []).length;
    const symbolDensity = nonAlphanumeric / challenge.length;

    // Character set diversity (distinct character types)
    const hasLetters = /[a-z]/i.test(challenge);
    const hasNumbers = /[0-9]/.test(challenge);
    const hasSymbols = /[^a-z0-9\s]/i.test(challenge);
    const hasUpperCase = /[A-Z]/.test(challenge);
    const hasLowerCase = /[a-z]/.test(challenge);

    let characterSetDiversity = 0;
    if (hasLetters) characterSetDiversity++;
    if (hasNumbers) characterSetDiversity++;
    if (hasSymbols) characterSetDiversity++;
    if (hasUpperCase && hasLowerCase) characterSetDiversity++;

    characterSetDiversity /= 4; // Normalize to 0-1

    // Word count
    const wordCount = challenge.split(/\s+/).filter(w => w.length > 0).length;

    // Length
    const length = challenge.length;

    return {
      symbolDensity,
      length,
      wordCount,
      characterSetDiversity
    };
  }

  /**
   * Predict difficulty 1-10 based on features
   * @param {string} challenge - Challenge text
   * @returns {number} Difficulty 1-10
   */
  predictDifficulty(challenge) {
    const features = this.extractFeatures(challenge);

    // If we have trained profiles, use them to map to difficulty
    if (this.difficultyProfiles && Object.keys(this.difficultyProfiles).length > 0) {
      let bestDifficulty = 1;
      let bestDistance = Infinity;

      for (const difficulty in this.difficultyProfiles) {
        const profile = this.difficultyProfiles[difficulty];
        // Euclidean distance to this difficulty's profile
        const distance = Math.sqrt(
          Math.pow(features.symbolDensity - profile.symbolDensity, 2) +
          Math.pow(features.characterSetDiversity - profile.characterSetDiversity, 2) +
          Math.pow(features.length / 50 - profile.length, 2)
        );

        if (distance < bestDistance) {
          bestDistance = distance;
          bestDifficulty = parseInt(difficulty);
        }
      }

      return bestDifficulty;
    }

    // Fallback: simple heuristic
    const score =
      features.symbolDensity * this.weights.symbolDensity +
      features.characterSetDiversity * this.weights.characterSetDiversity +
      (features.length / 50) * this.weights.length; // Normalize length

    // Map to 1-10 scale
    const difficulty = Math.max(1, Math.min(10, Math.round(score * 10)));
    return difficulty;
  }

  /**
   * Suggest model based on difficulty
   * @param {string} challenge - Challenge text
   * @returns {string} Model name (venice, kimi, openrouter)
   */
  suggestModel(challenge) {
    const difficulty = this.predictDifficulty(challenge);

    if (difficulty <= 3) return 'venice'; // Easy → cheapest
    if (difficulty <= 6) return 'kimi'; // Medium
    return 'openrouter'; // Hard → most capable
  }

  /**
   * Suggest preprocessing depth based on difficulty
   * @param {string} challenge - Challenge text
   * @returns {number} Preprocessing depth (0-5)
   */
  suggestPreprocessingDepth(challenge) {
    const difficulty = this.predictDifficulty(challenge);
    return Math.ceil((difficulty / 10) * 5); // Map 1-10 to 0-5
  }

  /**
   * Build difficulty profiles from training data
   * @param {array} trainingData - Array of {challenge, difficulty}
   * @returns {object} Map of difficulty to feature profile
   */
  _buildDifficultyProfiles(trainingData) {
    const difficultyGroups = {};

    // Group features by difficulty
    for (const sample of trainingData) {
      if (!difficultyGroups[sample.difficulty]) {
        difficultyGroups[sample.difficulty] = [];
      }
      const features = this.extractFeatures(sample.challenge);
      difficultyGroups[sample.difficulty].push(features);
    }

    // Compute centroid for each difficulty
    const profiles = {};
    for (const difficulty in difficultyGroups) {
      const samples = difficultyGroups[difficulty];
      if (samples.length === 0) continue; // Skip empty groups

      const profile = {
        symbolDensity: 0,
        characterSetDiversity: 0,
        length: 0
      };

      for (const sample of samples) {
        profile.symbolDensity += sample.symbolDensity;
        profile.characterSetDiversity += sample.characterSetDiversity;
        profile.length += sample.length / 50; // Normalize
      }

      profile.symbolDensity /= samples.length;
      profile.characterSetDiversity /= samples.length;
      profile.length /= samples.length;

      profiles[difficulty] = profile;
    }

    return profiles;
  }

  /**
   * Calculate accuracy on dataset
   * @param {array} dataset - Challenges with difficulty labels
   * @returns {number} Accuracy (0-1)
   */
  _calculateAccuracy(dataset) {
    if (!dataset || dataset.length === 0) return 0;

    let correct = 0;
    for (const sample of dataset) {
      const predicted = this.predictDifficulty(sample.challenge);
      const actual = sample.difficulty;
      // Consider correct if within 2 levels
      if (Math.abs(predicted - actual) <= 2) {
        correct++;
      }
    }
    return correct / dataset.length;
  }

  /**
   * Train classifier on labeled dataset
   * @param {array} trainingData - Array of {challenge, correctAnswer, difficulty}
   * @returns {object} Training result with accuracy
   */
  train(trainingData) {
    this.trainingData = trainingData;
    this.difficultyProfiles = this._buildDifficultyProfiles(trainingData);

    const accuracy = this._calculateAccuracy(trainingData);

    // Adjust weights based on training data symbol correlation
    let symbolScore = 0;
    for (const sample of trainingData) {
      const features = this.extractFeatures(sample.challenge);
      symbolScore += features.symbolDensity * sample.difficulty;
    }

    if (symbolScore > 0) {
      this.weights.symbolDensity = 0.65;
      this.weights.characterSetDiversity = 0.25;
      this.weights.length = 0.1;
    }

    return { accuracy };
  }

  /**
   * Evaluate classifier on test set
   * @param {array} testData - Array of {challenge, difficulty}
   * @returns {object} Evaluation result with accuracy
   */
  evaluate(testData) {
    const accuracy = this._calculateAccuracy(testData);
    return { accuracy };
  }
}

module.exports = PatternClassifier;
