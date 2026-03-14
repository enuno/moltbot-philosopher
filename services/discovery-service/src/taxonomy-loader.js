const fs = require('fs');
const path = require('path');

let cachedTaxonomy = null;

/**
 * Load and validate the philosophical keyword taxonomy.
 * Validates that taxonomy has 5 categories, 50+ keywords, and balanced distribution.
 *
 * @returns {Object} Taxonomy object with category keys mapping to keyword arrays
 * @throws {Error} If taxonomy is invalid or cannot be loaded
 */
function loadTaxonomy() {
  if (cachedTaxonomy) {
    return cachedTaxonomy;
  }

  const taxonomyPath = path.join(__dirname, 'keyword-taxonomy.json');
  const taxonomyData = fs.readFileSync(taxonomyPath, 'utf8');
  const taxonomy = JSON.parse(taxonomyData);

  // Validate structure
  const requiredCategories = ['epistemology', 'ethics', 'metaphysics', 'logic', 'political'];
  const actualCategories = Object.keys(taxonomy);

  if (actualCategories.length !== 5) {
    throw new Error(`Expected 5 categories, found ${actualCategories.length}`);
  }

  requiredCategories.forEach((category) => {
    if (!taxonomy[category]) {
      throw new Error(`Missing required category: ${category}`);
    }
    if (!Array.isArray(taxonomy[category])) {
      throw new Error(`Category ${category} must be an array`);
    }
    if (taxonomy[category].length === 0) {
      throw new Error(`Category ${category} is empty`);
    }
  });

  // Validate total keyword count
  const totalKeywords = getTotalKeywordCount(taxonomy);
  if (totalKeywords < 50) {
    throw new Error(`Expected 50+ keywords, found ${totalKeywords}`);
  }

  // Validate balanced distribution
  const maxAllowed = Math.floor(totalKeywords * 0.4);
  requiredCategories.forEach((category) => {
    if (taxonomy[category].length > maxAllowed) {
      throw new Error(
        `Category ${category} has ${taxonomy[category].length} keywords, exceeds 40% limit of ${maxAllowed}`
      );
    }
  });

  cachedTaxonomy = taxonomy;
  return taxonomy;
}

/**
 * Get total count of keywords across all categories.
 *
 * @returns {number} Total keyword count
 */
function getTotalKeywords() {
  const taxonomy = loadTaxonomy();
  return getTotalKeywordCount(taxonomy);
}

/**
 * Get keywords for a specific category.
 *
 * @param {string} category - Category name (epistemology, ethics, metaphysics, logic, political)
 * @returns {Array<string>} Array of keywords in the category
 * @throws {Error} If category does not exist
 */
function getCategoryKeywords(category) {
  const taxonomy = loadTaxonomy();

  if (!taxonomy[category]) {
    throw new Error(`Category ${category} does not exist`);
  }

  return taxonomy[category];
}

/**
 * Get a single random keyword from the taxonomy.
 *
 * @returns {string} A randomly selected keyword
 */
function getRandomKeyword() {
  const taxonomy = loadTaxonomy();
  const allKeywords = getAllKeywords(taxonomy);
  const randomIndex = Math.floor(Math.random() * allKeywords.length);
  return allKeywords[randomIndex];
}

/**
 * Get multiple random keywords from the taxonomy.
 *
 * @param {number} count - Number of keywords to return
 * @returns {Array<string>} Array of randomly selected keywords
 * @throws {Error} If count exceeds total number of available keywords
 */
function getRandomKeywords(count) {
  const taxonomy = loadTaxonomy();
  const allKeywords = getAllKeywords(taxonomy);

  if (count > allKeywords.length) {
    throw new Error(
      `Requested ${count} keywords but only ${allKeywords.length} available`
    );
  }

  const selected = [];
  const indices = new Set();

  while (selected.length < count) {
    const randomIndex = Math.floor(Math.random() * allKeywords.length);
    if (!indices.has(randomIndex)) {
      indices.add(randomIndex);
      selected.push(allKeywords[randomIndex]);
    }
  }

  return selected;
}

/**
 * Helper: Get all keywords from all categories.
 *
 * @param {Object} taxonomy - Taxonomy object
 * @returns {Array<string>} Flattened array of all keywords
 * @private
 */
function getAllKeywords(taxonomy) {
  return Object.values(taxonomy).flat();
}

/**
 * Helper: Calculate total keyword count.
 *
 * @param {Object} taxonomy - Taxonomy object
 * @returns {number} Total keyword count
 * @private
 */
function getTotalKeywordCount(taxonomy) {
  return getAllKeywords(taxonomy).length;
}

module.exports = {
  loadTaxonomy,
  getTotalKeywords,
  getCategoryKeywords,
  getRandomKeyword,
  getRandomKeywords,
};
