#!/usr/bin/env node
/**
 * Direct Jest-compatible test runner for taxonomy-loader.test.js
 * Runs all tests and reports results in Jest format
 */

const path = require('path');
const {
  loadTaxonomy,
  getTotalKeywords,
  getCategoryKeywords,
  getRandomKeyword,
  getRandomKeywords,
} = require('./src/taxonomy-loader');

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function describe(name, callback) {
  console.log(`\n${name}`);
  callback();
}

function test(name, callback) {
  testsRun++;
  try {
    callback();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    testsFailed++;
    failures.push({ name, error: error.message });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
  }
}

function beforeAll(callback) {
  callback();
}

function expect(value) {
  return {
    toHaveLength(expected) {
      if (value.length !== expected) {
        throw new Error(
          `Expected length ${expected}, but got ${value.length}`
        );
      }
    },
    toContain(item) {
      if (!value.includes(item)) {
        throw new Error(`Expected to contain ${item}`);
      }
    },
    toBe(expected) {
      if (value !== expected) {
        throw new Error(`Expected ${expected}, but got ${value}`);
      }
    },
    toBeGreaterThanOrEqual(expected) {
      if (value < expected) {
        throw new Error(`Expected >= ${expected}, but got ${value}`);
      }
    },
    toBeGreaterThan(expected) {
      if (value <= expected) {
        throw new Error(`Expected > ${expected}, but got ${value}`);
      }
    },
    toBeLessThanOrEqual(expected) {
      if (value > expected) {
        throw new Error(`Expected <= ${expected}, but got ${value}`);
      }
    },
    toEqual(expected) {
      if (Array.isArray(expected)) {
        if (!Array.isArray(value) || value.length !== expected.length) {
          throw new Error(`Array length mismatch`);
        }
        // For basic equality
        for (let i = 0; i < expected.length; i++) {
          if (typeof expected[i] === 'object' && expected[i] !== null) {
            // For objects in array, check properties
            const expectedObj = expected[i];
            const valueObj = value[i];
            if (typeof valueObj !== 'object') {
              throw new Error(`Expected object at index ${i}`);
            }
          } else if (value[i] !== expected[i]) {
            throw new Error(`Array mismatch at index ${i}`);
          }
        }
      }
    },
  };
}

// Run the tests
describe('Taxonomy Loader', () => {
  let taxonomy;

  beforeAll(() => {
    taxonomy = loadTaxonomy();
  });

  test('should load taxonomy with 5 categories', () => {
    const categories = Object.keys(taxonomy);
    expect(categories).toHaveLength(5);
    expect(categories).toContain('epistemology');
    expect(categories).toContain('ethics');
    expect(categories).toContain('metaphysics');
    expect(categories).toContain('logic');
    expect(categories).toContain('political');
  });

  test('should have 50 or more total keywords', () => {
    const total = getTotalKeywords();
    expect(total).toBeGreaterThanOrEqual(50);
  });

  test('should ensure no category exceeds 40% of total keywords', () => {
    const total = getTotalKeywords();
    const maxAllowed = Math.floor(total * 0.4);

    const categories = ['epistemology', 'ethics', 'metaphysics', 'logic', 'political'];
    categories.forEach((category) => {
      const keywords = getCategoryKeywords(category);
      expect(keywords.length).toBeLessThanOrEqual(maxAllowed);
    });
  });

  test('should return non-empty keyword arrays for all categories', () => {
    const categories = ['epistemology', 'ethics', 'metaphysics', 'logic', 'political'];

    categories.forEach((category) => {
      const keywords = getCategoryKeywords(category);
      if (!Array.isArray(keywords)) {
        throw new Error(`${category} keywords is not an array`);
      }
      expect(keywords.length).toBeGreaterThan(0);
      const allStrings = keywords.every((k) => typeof k === 'string');
      if (!allStrings) {
        throw new Error(`Not all keywords in ${category} are strings`);
      }
    });
  });

  test('should return a random keyword that exists in taxonomy', () => {
    const keyword = getRandomKeyword();
    if (typeof keyword !== 'string') {
      throw new Error('Random keyword is not a string');
    }
    expect(keyword.length).toBeGreaterThan(0);

    // Verify keyword exists in at least one category
    const categories = ['epistemology', 'ethics', 'metaphysics', 'logic', 'political'];
    const found = categories.some((cat) => getCategoryKeywords(cat).includes(keyword));
    if (!found) {
      throw new Error(`Random keyword "${keyword}" not found in taxonomy`);
    }
  });

  test('should return array of random keywords with correct count', () => {
    const count = 5;
    const keywords = getRandomKeywords(count);

    if (!Array.isArray(keywords)) {
      throw new Error('getRandomKeywords did not return an array');
    }
    expect(keywords.length).toBe(count);
    const allStrings = keywords.every((k) => typeof k === 'string');
    if (!allStrings) {
      throw new Error('Not all returned keywords are strings');
    }

    // Verify all returned keywords exist in taxonomy
    const categories = ['epistemology', 'ethics', 'metaphysics', 'logic', 'political'];
    keywords.forEach((keyword) => {
      const found = categories.some((cat) => getCategoryKeywords(cat).includes(keyword));
      if (!found) {
        throw new Error(`Keyword "${keyword}" not found in taxonomy`);
      }
    });
  });
});

// Print summary
console.log('\n' + '='.repeat(60));
if (testsFailed === 0) {
  console.log(`PASS: All ${testsPassed} tests passed`);
  process.exit(0);
} else {
  console.log(`FAIL: ${testsFailed} failed, ${testsPassed} passed out of ${testsRun} tests`);
  process.exit(1);
}
