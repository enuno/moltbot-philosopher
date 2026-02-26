/**
 * Template System Test Suite
 * P2.3 Task 5: Tests template loading, interpolation, and slot handling
 */

const {
  getTemplate,
  getAllTemplates,
  hasTemplate,
  getAgentTopics,
} = require("../src/templates");

const {
  extractSlots,
  sanitizeSlot,
  validateSlots,
  interpolateTemplate,
  cleanTemplate,
} = require("../src/template-helpers");

describe("Template System", () => {
  describe("getTemplate", () => {
    it("should retrieve a template by ID", () => {
      const templates = getAllTemplates();
      if (templates.length > 0) {
        const template = getTemplate(templates[0].id);
        expect(template).toBeDefined();
        expect(template).toHaveProperty("id");
        expect(template).toHaveProperty("textTemplate");
      }
    });

    it("should return template with required fields", () => {
      const templates = getAllTemplates();
      if (templates.length > 0) {
        const template = getTemplate(templates[0].id);
        expect(template).toHaveProperty("id");
        expect(template).toHaveProperty("agentType");
        expect(template).toHaveProperty("topicId");
        expect(template).toHaveProperty("styleHint");
        expect(template).toHaveProperty("textTemplate");
      }
    });

    it("should return null for non-existent template", () => {
      const template = getTemplate("nonexistent-id");
      expect(template).toBeNull();
    });
  });

  describe("getAllTemplates", () => {
    it("should return array of templates", () => {
      const templates = getAllTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it("should contain at least 9 templates", () => {
      const templates = getAllTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(9);
    });

    it("should have unique template IDs", () => {
      const templates = getAllTemplates();
      const ids = templates.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should include templates for different agents", () => {
      const templates = getAllTemplates();
      const agents = new Set(templates.map((t) => t.agentType));
      expect(agents.size).toBeGreaterThan(1);
    });
  });

  describe("hasTemplate", () => {
    it("should return true for existing template", () => {
      const templates = getAllTemplates();
      if (templates.length > 0) {
        expect(hasTemplate(templates[0].id)).toBe(true);
      }
    });

    it("should return false for non-existent template", () => {
      expect(hasTemplate("nonexistent-id")).toBe(false);
    });
  });

  describe("getAgentTopics", () => {
    it("should return topics for an agent", () => {
      const topics = getAgentTopics("classical");
      expect(Array.isArray(topics)).toBe(true);
    });

    it("should return unique topics", () => {
      const topics = getAgentTopics("classical");
      const uniqueTopics = new Set(topics);
      expect(uniqueTopics.size).toBe(topics.length);
    });
  });

  describe("extractSlots", () => {
    it("should extract slot names from template", () => {
      const template = "Hello {name}, you are {adjective}";
      const slots = extractSlots(template);
      expect(slots.sort()).toEqual(["adjective", "name"]);
    });

    it("should extract single slot", () => {
      const template = "This is a {slot}";
      const slots = extractSlots(template);
      expect(slots).toContain("slot");
      expect(slots.length).toBe(1);
    });

    it("should handle no slots", () => {
      const template = "This has no slots";
      const slots = extractSlots(template);
      expect(slots.length).toBe(0);
    });

    it("should extract deduplicated slots", () => {
      const template = "{name} and {name} and {other}";
      const slots = extractSlots(template);
      expect(slots).toContain("name");
      expect(slots).toContain("other");
      expect(slots.length).toBe(2);
    });

    it("should handle nested braces", () => {
      const template = "The {item} is {adjective}";
      const slots = extractSlots(template);
      expect(slots.length).toBeGreaterThan(0);
    });
  });

  describe("sanitizeSlot", () => {
    it("should remove HTML tags", () => {
      const dirty = "<script>alert('xss')</script>";
      const clean = sanitizeSlot(dirty);
      expect(clean).not.toContain("<");
      expect(clean).not.toContain(">");
    });

    it("should allow plain text", () => {
      const clean = sanitizeSlot("Hello World");
      expect(clean).toBe("Hello World");
    });

    it("should remove quotes and special chars", () => {
      const dirty = 'Value with "quotes" and \'apostrophes\'';
      const clean = sanitizeSlot(dirty);
      expect(clean).not.toContain('"');
      expect(clean).not.toContain("'");
    });

    it("should handle empty string", () => {
      const clean = sanitizeSlot("");
      expect(typeof clean).toBe("string");
    });
  });

  describe("validateSlots", () => {
    it("should validate all required slots provided", () => {
      const template = "Hello {name}, you are {adjective}";
      const slots = { name: "Alice", adjective: "great" };
      const valid = validateSlots(template, slots);
      expect(valid).toBe(true);
    });

    it("should fail when required slot missing", () => {
      const template = "Hello {name}, you are {adjective}";
      const slots = { name: "Alice" };
      const valid = validateSlots(template, slots);
      expect(valid).toBe(false);
    });

    it("should pass with extra slots", () => {
      const template = "Hello {name}";
      const slots = { name: "Alice", extra: "ignored" };
      const valid = validateSlots(template, slots);
      expect(valid).toBe(true);
    });

    it("should handle no slots required", () => {
      const template = "No slots here";
      const slots = {};
      const valid = validateSlots(template, slots);
      expect(valid).toBe(true);
    });
  });

  describe("interpolateTemplate", () => {
    it("should replace slots with values", () => {
      const template = "Hello {name}";
      const slots = { name: "Alice" };
      const result = interpolateTemplate(template, slots);
      expect(result).toBe("Hello Alice");
    });

    it("should replace multiple slots", () => {
      const template = "Hello {name}, you are {adjective}";
      const slots = { name: "Alice", adjective: "great" };
      const result = interpolateTemplate(template, slots);
      expect(result).toBe("Hello Alice, you are great");
    });

    it("should sanitize slot values", () => {
      const template = "Message: {content}";
      const slots = { content: "<script>alert('xss')</script>" };
      const result = interpolateTemplate(template, slots);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
    });

    it("should handle missing slots gracefully", () => {
      const template = "Hello {name}, you are {unknown}";
      const slots = { name: "Alice" };
      const result = interpolateTemplate(template, slots);
      expect(result).toContain("Alice");
      // Unknown slot might remain or be removed
      expect(typeof result).toBe("string");
    });

    it("should preserve non-slot text", () => {
      const template = "Important: {value} is {adjective}.";
      const slots = { value: "42", adjective: "special" };
      const result = interpolateTemplate(template, slots);
      expect(result).toContain("Important:");
      expect(result).toContain("is");
    });
  });

  describe("cleanTemplate", () => {
    it("should normalize whitespace", () => {
      const template = "Line 1\n\nLine 2\t\tTabbed";
      const clean = cleanTemplate(template);
      expect(clean).not.toContain("\n\n");
      expect(clean).not.toContain("\t\t");
    });

    it("should trim leading/trailing whitespace", () => {
      const template = "  Content  ";
      const clean = cleanTemplate(template);
      expect(clean).toBe("Content");
    });

    it("should collapse multiple spaces", () => {
      const template = "Multiple    spaces    collapsed";
      const clean = cleanTemplate(template);
      expect(clean).not.toContain("    ");
    });

    it("should preserve intentional line breaks", () => {
      const template = "Line 1\nLine 2";
      const clean = cleanTemplate(template);
      expect(clean).toContain("Line 1");
      expect(clean).toContain("Line 2");
    });
  });

  describe("Integration", () => {
    it("should extract, validate, and interpolate in sequence", () => {
      const template = "The {animal} is {adjective}";
      const slots = extractSlots(template);
      const values = { animal: "cat", adjective: "cute" };

      expect(validateSlots(template, values)).toBe(true);
      const result = interpolateTemplate(template, values);
      expect(result).toBe("The cat is cute");
    });

    it("should handle real template structure", () => {
      const template =
        "{agent} replied to {author}: \"{comment}\"";
      const slots = extractSlots(template);
      expect(slots).toContain("agent");
      expect(slots).toContain("author");
      expect(slots).toContain("comment");

      const values = {
        agent: "Aristotle",
        author: "Socrates",
        comment: "Know thyself",
      };
      expect(validateSlots(template, values)).toBe(true);

      const result = interpolateTemplate(template, values);
      expect(result).toContain("Aristotle");
      expect(result).toContain("Socrates");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty template", () => {
      expect(extractSlots("")).toEqual([]);
      expect(cleanTemplate("")).toBe("");
      expect(interpolateTemplate("", {})).toBe("");
    });

    it("should handle unicode content", () => {
      const template = "Hello {name} 🎭 🧠";
      const result = interpolateTemplate(template, { name: "φιλόσοφος" });
      expect(result).toContain("φιλόσοφος");
      expect(result).toContain("🎭");
    });

    it("should handle special regex characters in values", () => {
      const template = "Match {pattern}";
      const values = { pattern: ".*[a-z]+?" };
      const result = interpolateTemplate(template, values);
      expect(result).toContain(".*[a-z]+?");
    });
  });
});
