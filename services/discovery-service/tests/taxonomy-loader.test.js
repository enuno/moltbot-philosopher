const {
  loadTaxonomy,
  getTotalKeywords,
  getCategoryKeywords,
  getRandomKeyword,
  getRandomKeywords,
} = require('../src/taxonomy-loader');

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
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords.every((k) => typeof k === 'string')).toBe(true);
    });
  });

  test('should return a random keyword that exists in taxonomy', () => {
    const keyword = getRandomKeyword();
    expect(typeof keyword).toBe('string');
    expect(keyword.length).toBeGreaterThan(0);

    // Verify keyword exists in at least one category
    const categories = ['epistemology', 'ethics', 'metaphysics', 'logic', 'political'];
    const found = categories.some((cat) => getCategoryKeywords(cat).includes(keyword));
    expect(found).toBe(true);
  });

  test('should return array of random keywords with correct count', () => {
    const count = 5;
    const keywords = getRandomKeywords(count);

    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords).toHaveLength(count);
    expect(keywords.every((k) => typeof k === 'string')).toBe(true);

    // Verify all returned keywords exist in taxonomy
    const categories = ['epistemology', 'ethics', 'metaphysics', 'logic', 'political'];
    keywords.forEach((keyword) => {
      const found = categories.some((cat) => getCategoryKeywords(cat).includes(keyword));
      expect(found).toBe(true);
    });
  });
});
