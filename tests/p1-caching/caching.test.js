/**
 * P1.3 - Challenge Caching & Pattern Learning Tests
 *
 * Tests for:
 * 1. CacheManager: Graduated TTL, cache statistics, expiration handling
 * 2. PatternClassifier: Challenge feature extraction, difficulty prediction
 *
 * Target: Cache hit rate >60%, classifier >70% accuracy
 */

const assert = require('assert');

// These modules will be created during GREEN phase
let CacheManager;
let PatternClassifier;

describe('P1.3 - Challenge Caching & Pattern Learning', () => {
  let cacheManager;
  let classifier;

  describe('CacheManager - Graduated TTL Strategy', () => {
    beforeEach(() => {
      // Dynamically require to allow for missing modules during RED phase
      try {
        const CacheManagerModule = require('../../services/intelligent-proxy/src/cache-manager.js');
        cacheManager = new CacheManagerModule();
      } catch (e) {
        // Module doesn't exist yet - that's expected in RED phase
        cacheManager = null;
      }
    });

    it('should assign 7 day TTL for high-confidence solutions (≥0.95)', () => {
      assert(cacheManager, 'CacheManager module should exist');

      const challenge = '25 + 12';
      const solution = { answer: 37, confidence: 0.98 };
      cacheManager.set(challenge, solution);

      const ttl = cacheManager.getTTL(challenge);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // TTL should be within 1% of 7 days
      assert(ttl >= sevenDaysMs * 0.99 && ttl <= sevenDaysMs * 1.01,
        `High confidence TTL should be ~7 days (604800s), got ${ttl}ms`);
    });

    it('should assign 3 day TTL for medium-confidence solutions (0.80-0.94)', () => {
      assert(cacheManager, 'CacheManager module should exist');

      const challenge = 'TwEnTy + TwElVe';
      const solution = { answer: 32, confidence: 0.87 };
      cacheManager.set(challenge, solution);

      const ttl = cacheManager.getTTL(challenge);
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

      assert(ttl >= threeDaysMs * 0.99 && ttl <= threeDaysMs * 1.01,
        `Medium confidence TTL should be ~3 days (259200s), got ${ttl}ms`);
    });

    it('should assign 24 hour TTL for low-confidence solutions (0.60-0.79)', () => {
      assert(cacheManager, 'CacheManager module should exist');

      const challenge = 't#we@nty-five';
      const solution = { answer: 25, confidence: 0.72 };
      cacheManager.set(challenge, solution);

      const ttl = cacheManager.getTTL(challenge);
      const oneDayMs = 24 * 60 * 60 * 1000;

      assert(ttl >= oneDayMs * 0.99 && ttl <= oneDayMs * 1.01,
        `Low confidence TTL should be ~24 hours (86400s), got ${ttl}ms`);
    });

    it('should assign 12 hour TTL for failed solutions (confidence < 0.60)', () => {
      assert(cacheManager, 'CacheManager module should exist');

      const challenge = 'complex_obfuscated_challenge';
      const solution = { answer: null, confidence: 0, failed: true };
      cacheManager.set(challenge, solution);

      const ttl = cacheManager.getTTL(challenge);
      const twelveHoursMs = 12 * 60 * 60 * 1000;

      assert(ttl >= twelveHoursMs * 0.99 && ttl <= twelveHoursMs * 1.01,
        `Failed solution TTL should be ~12 hours (43200s), got ${ttl}ms`);
    });

    it('should retrieve cached solution within TTL', () => {
      assert(cacheManager, 'CacheManager module should exist');

      const challenge = 'fifty + ten';
      const solution = { answer: 60, confidence: 0.95 };
      cacheManager.set(challenge, solution);

      const retrieved = cacheManager.get(challenge);

      assert.deepStrictEqual(retrieved, solution, 'Should retrieve exact cached solution');
    });

    it('should return null for expired cache entries', () => {
      assert(cacheManager, 'CacheManager module should exist');

      const challenge = 'temp_challenge';
      const solution = { answer: 99, confidence: 0.5 };
      // Set with very short TTL (10ms)
      cacheManager.set(challenge, solution, 10);

      // Immediate retrieval should work
      let retrieved = cacheManager.get(challenge);
      assert(retrieved !== null, 'Should retrieve immediately after caching');

      // After expiration should return null
      // Use synchronous wait to simulate expiration
      setTimeout(() => {
        retrieved = cacheManager.get(challenge);
        assert.strictEqual(retrieved, null, 'Should return null for expired cache');
      }, 50);
    });

    it('should track cache hit/miss statistics', () => {
      assert(cacheManager, 'CacheManager module should exist');

      // Clear stats
      cacheManager.resetStats();

      // Add and retrieve cached entries
      cacheManager.set('challenge_1', { answer: 1, confidence: 0.95 });
      cacheManager.set('challenge_2', { answer: 2, confidence: 0.95 });

      cacheManager.get('challenge_1'); // Hit
      cacheManager.get('challenge_1'); // Hit
      cacheManager.get('challenge_3'); // Miss
      cacheManager.get('challenge_2'); // Hit

      const stats = cacheManager.getStats();

      assert.strictEqual(stats.hits, 3, 'Should record 3 cache hits');
      assert.strictEqual(stats.misses, 1, 'Should record 1 cache miss');
      assert.strictEqual(stats.hitRate, 0.75, 'Hit rate should be 75%');
    });

    it('should invalidate cache entry when model succeeds after prior failure', () => {
      assert(cacheManager, 'CacheManager module should exist');

      const challenge = 'difficult_obfuscated';

      // First: cache a failure
      const failure = { answer: null, confidence: 0, failed: true };
      cacheManager.set(challenge, failure);

      let retrieved = cacheManager.get(challenge);
      assert(retrieved.failed, 'Should retrieve failed solution');

      // Later: invalidate and cache success
      cacheManager.invalidate(challenge);
      const success = { answer: 42, confidence: 0.95 };
      cacheManager.set(challenge, success);

      retrieved = cacheManager.get(challenge);
      assert(!retrieved.failed, 'Should retrieve successful solution after invalidation');
      assert.strictEqual(retrieved.answer, 42, 'Should have correct answer');
    });

    it('should provide cache statistics endpoint data', () => {
      assert(cacheManager, 'CacheManager module should exist');

      cacheManager.resetStats();
      cacheManager.set('test_1', { answer: 1, confidence: 0.95 });
      cacheManager.set('test_2', { answer: 2, confidence: 0.85 });
      cacheManager.set('test_3', { answer: 3, confidence: 0.50 });

      cacheManager.get('test_1');
      cacheManager.get('test_2');
      cacheManager.get('test_4'); // Miss

      const stats = cacheManager.getStats();

      assert(stats.totalEntries >= 3, 'Should report total cached entries');
      assert(stats.hits === 2, 'Should report correct hit count');
      assert(stats.misses === 1, 'Should report correct miss count');
      assert(typeof stats.hitRate === 'number', 'Should report hit rate as number');
      assert(typeof stats.averageConfidence === 'number', 'Should report average confidence');
    });
  });

  describe('PatternClassifier - Challenge Difficulty Prediction', () => {
    beforeEach(() => {
      try {
        const PatternClassifierModule = require('../../services/intelligent-proxy/src/pattern-classifier.js');
        classifier = new PatternClassifierModule();
      } catch (e) {
        classifier = null;
      }
    });

    it('should extract features from challenges', () => {
      assert(classifier, 'PatternClassifier module should exist');

      const challenge = 't#we@nty-five + t@w#elve';
      const features = classifier.extractFeatures(challenge);

      assert(features, 'Should return features object');
      assert(typeof features.symbolDensity === 'number', 'Should extract symbolDensity');
      assert(typeof features.length === 'number', 'Should extract length');
      assert(typeof features.wordCount === 'number', 'Should extract wordCount');
      assert(typeof features.characterSetDiversity === 'number', 'Should extract characterSetDiversity');
      assert(features.symbolDensity >= 0 && features.symbolDensity <= 1, 'symbolDensity should be 0-1');
    });

    it('should predict difficulty score 1-10 for new challenges', () => {
      assert(classifier, 'PatternClassifier module should exist');

      const easyChallenge = '25 + 12';
      const hardChallenge = 't#we@nty-f!ve + t@w#elve-s3v3n';

      const easyDifficulty = classifier.predictDifficulty(easyChallenge);
      const hardDifficulty = classifier.predictDifficulty(hardChallenge);

      assert(easyDifficulty >= 1 && easyDifficulty <= 10, 'Easy challenge difficulty should be 1-10');
      assert(hardDifficulty >= 1 && hardDifficulty <= 10, 'Hard challenge difficulty should be 1-10');
      assert(hardDifficulty > easyDifficulty, 'Obfuscated challenge should have higher difficulty');
    });

    it('should suggest model based on predicted difficulty', () => {
      assert(classifier, 'PatternClassifier module should exist');

      const easyChallenge = '25 + 12';
      const mediumChallenge = 'TwEnTy + TwElVe';
      const hardChallenge = 't#we@nty + t@w#elve';

      const easyModel = classifier.suggestModel(easyChallenge);
      const mediumModel = classifier.suggestModel(mediumChallenge);
      const hardModel = classifier.suggestModel(hardChallenge);

      // Models should be from the available set
      const validModels = ['venice', 'kimi', 'openrouter'];
      assert(validModels.includes(easyModel), 'Easy challenge should suggest valid model');
      assert(validModels.includes(mediumModel), 'Medium challenge should suggest valid model');
      assert(validModels.includes(hardModel), 'Hard challenge should suggest valid model');

      // Harder challenges should suggest more powerful models
      const easyIndex = validModels.indexOf(easyModel);
      const hardIndex = validModels.indexOf(hardModel);
      assert(hardIndex >= easyIndex, 'Harder challenge should suggest more powerful or equal model');
    });

    it('should suggest preprocessing depth based on difficulty', () => {
      assert(classifier, 'PatternClassifier module should exist');

      const easyChallenge = '25 + 12';
      const hardChallenge = 't#we@nty + t@w#elve';

      const easyDepth = classifier.suggestPreprocessingDepth(easyChallenge);
      const hardDepth = classifier.suggestPreprocessingDepth(hardChallenge);

      assert(typeof easyDepth === 'number', 'Should return preprocessing depth as number');
      assert(typeof hardDepth === 'number', 'Should return preprocessing depth as number');
      assert(easyDepth <= hardDepth, 'Easy challenge should use less preprocessing');
    });

    it('should train classifier on labeled dataset', () => {
      assert(classifier, 'PatternClassifier module should exist');

      // Training data: (challenge, correctAnswer, difficulty)
      const trainingData = [
        { challenge: '25 + 12', correctAnswer: 37, difficulty: 1 },
        { challenge: '100 - 50', correctAnswer: 50, difficulty: 1 },
        { challenge: 'TwEnTy + TwElVe', correctAnswer: 32, difficulty: 5 },
        { challenge: 'TwEnTy FiVe + TwElVe', correctAnswer: 37, difficulty: 5 },
        { challenge: 't#we@nty + t@w#elve', correctAnswer: 37, difficulty: 8 },
        { challenge: 't#we@nty-f!ve + t@w#elve', correctAnswer: 37, difficulty: 9 }
      ];

      const result = classifier.train(trainingData);

      assert(result, 'Training should return result');
      assert(result.accuracy >= 0.5, 'Training should achieve >50% accuracy on training data');
      assert(typeof result.accuracy === 'number', 'Should report accuracy as number');
    });

    it('should evaluate classifier accuracy on holdout test set', () => {
      assert(classifier, 'PatternClassifier module should exist');

      // Training data
      const trainingData = [
        { challenge: '25 + 12', correctAnswer: 37, difficulty: 1 },
        { challenge: '100 - 50', correctAnswer: 50, difficulty: 1 },
        { challenge: 'TwEnTy + TwElVe', correctAnswer: 32, difficulty: 5 },
        { challenge: 't#we@nty + t@w#elve', correctAnswer: 37, difficulty: 8 }
      ];

      // Test data (holdout)
      const testData = [
        { challenge: '50 + 25', difficulty: 1 },
        { challenge: 'FiVe + FiVe', difficulty: 5 },
        { challenge: 't@w#elve', difficulty: 8 }
      ];

      classifier.train(trainingData);
      const evaluation = classifier.evaluate(testData);

      assert(evaluation.accuracy >= 0, 'Accuracy should be non-negative');
      assert(evaluation.accuracy <= 1, 'Accuracy should be at most 1.0');
      assert(typeof evaluation.accuracy === 'number', 'Should report accuracy as number');
    });

    it('should achieve >70% accuracy on diverse challenge set', () => {
      assert(classifier, 'PatternClassifier module should exist');

      // Generate diverse training dataset
      const trainingData = [
        // Easy (difficulty 1-3)
        { challenge: '25 + 12', correctAnswer: 37, difficulty: 1 },
        { challenge: '100 - 50', correctAnswer: 50, difficulty: 1 },
        { challenge: '5 * 6', correctAnswer: 30, difficulty: 1 },
        // Medium (difficulty 4-6)
        { challenge: 'TwEnTy + TwElVe', correctAnswer: 32, difficulty: 5 },
        { challenge: 'FiFtY - TeN', correctAnswer: 40, difficulty: 5 },
        { challenge: 'twenty*two', correctAnswer: 44, difficulty: 5 },
        // Hard (difficulty 7-9)
        { challenge: 't#we@nty + t@w#elve', correctAnswer: 37, difficulty: 8 },
        { challenge: 't#we@nty-f!ve + t@w#elve', correctAnswer: 37, difficulty: 9 },
        { challenge: 't@w#elve * t#we@', correctAnswer: 240, difficulty: 9 }
      ];

      const result = classifier.train(trainingData);

      assert(result.accuracy >= 0.70,
        `Classifier should achieve >70% accuracy on diverse set, got ${(result.accuracy * 100).toFixed(1)}%`);
    });
  });

  describe('Integration: CacheManager + PatternClassifier', () => {
    beforeEach(() => {
      try {
        const CacheManagerModule = require('../../services/intelligent-proxy/src/cache-manager.js');
        const PatternClassifierModule = require('../../services/intelligent-proxy/src/pattern-classifier.js');
        cacheManager = new CacheManagerModule();
        classifier = new PatternClassifierModule();
      } catch (e) {
        cacheManager = null;
        classifier = null;
      }
    });

    it('should use pattern classifier to inform cache TTL strategy', () => {
      assert(cacheManager && classifier, 'Both modules should exist');

      const easyChallenge = '25 + 12';
      const hardChallenge = 't#we@nty + t@w#elve';

      // Easy challenges get higher confidence scores
      const easySolution = { answer: 37, confidence: 0.97 };
      cacheManager.set(easyChallenge, easySolution);

      // Hard challenges get lower confidence scores
      const hardSolution = { answer: 37, confidence: 0.72 };
      cacheManager.set(hardChallenge, hardSolution);

      const easyTTL = cacheManager.getTTL(easyChallenge);
      const hardTTL = cacheManager.getTTL(hardChallenge);

      // Easy challenge should have longer TTL (7 days vs 1 day)
      assert(easyTTL > hardTTL, 'Easy challenge should have longer cache TTL than hard challenge');
    });

    it('should improve success rate through caching and adaptive model selection', () => {
      assert(cacheManager && classifier, 'Both modules should exist');

      // Scenario: Same challenge asked multiple times
      const challenge = 'TwEnTy + TwElVe';

      // First call: solve and cache with high confidence
      cacheManager.set(challenge, { answer: 32, confidence: 0.95 });

      // Subsequent calls: use cache
      const cached1 = cacheManager.get(challenge);
      const cached2 = cacheManager.get(challenge);
      const cached3 = cacheManager.get(challenge);

      assert(cached1 !== null && cached2 !== null && cached3 !== null, 'All retrievals should hit cache');

      const stats = cacheManager.getStats();
      assert(stats.hits === 3, 'Should record 3 cache hits');
    });
  });

  describe('Success Criteria', () => {
    it('should achieve cache hit rate >60% on repeated challenges', () => {
      assert(cacheManager, 'CacheManager should exist');

      cacheManager.resetStats();

      // Simulate repeated challenge patterns
      const challenges = ['challenge_1', 'challenge_2', 'challenge_3'];

      // Populate cache
      challenges.forEach(c => {
        cacheManager.set(c, { answer: Math.random() * 100, confidence: 0.95 });
      });

      // Simulate repeated access patterns (2x per challenge)
      challenges.forEach(c => {
        cacheManager.get(c);
        cacheManager.get(c);
      });

      // Also try some misses
      cacheManager.get('unknown_1');
      cacheManager.get('unknown_2');

      const stats = cacheManager.getStats();

      assert(stats.hitRate > 0.60,
        `Cache hit rate should be >60%, got ${(stats.hitRate * 100).toFixed(1)}%`);
    });

    it('should enable pattern classifier to improve model selection accuracy', () => {
      assert(classifier, 'PatternClassifier should exist');

      // Train classifier
      const trainingData = [
        { challenge: '25 + 12', correctAnswer: 37, difficulty: 1 },
        { challenge: 'TwEnTy + TwElVe', correctAnswer: 32, difficulty: 5 },
        { challenge: 't#we@nty + t@w#elve', correctAnswer: 37, difficulty: 8 }
      ];

      const result = classifier.train(trainingData);

      // Classifier should provide useful predictions
      const prediction1 = classifier.predictDifficulty('25 + 12');
      const prediction3 = classifier.predictDifficulty('t#we@nty + t@w#elve');

      assert(prediction3 > prediction1, 'Classifier should correctly rank difficulty');
    });
  });
});
