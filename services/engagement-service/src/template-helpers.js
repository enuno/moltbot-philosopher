/**
 * Template Helper Functions
 * P2.3: Utilities for template slot extraction, validation, and interpolation
 */

/**
 * Extract all unique slot names from template
 * Slots are marked as {slot_name}
 *
 * @param {string} template - Template string
 * @returns {array} Deduplicated slot names
 */
function extractSlots(template) {
  if (!template || typeof template !== "string") {
    return [];
  }

  const slotRegex = /\{([^}]+)\}/g;
  const slots = [];
  const seen = new Set();

  let match;
  while ((match = slotRegex.exec(template)) !== null) {
    const slotName = match[1].trim();
    if (slotName && !seen.has(slotName)) {
      slots.push(slotName);
      seen.add(slotName);
    }
  }

  return slots;
}

/**
 * Remove HTML, quotes, and injection characters from slot value
 *
 * @param {string} value - User-provided value
 * @returns {string} Sanitized value
 */
function sanitizeSlot(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/['"]/g, "") // Remove quotes
    .replace(/[<>{}]/g, ""); // Remove angle brackets and braces
}

/**
 * Validate that all required slots are provided
 *
 * @param {string} template - Template string
 * @param {object} slots - Slot values {name: value}
 * @returns {boolean} True if all slots provided
 */
function validateSlots(template, slots) {
  if (!template || !slots) {
    return true;
  }

  const requiredSlots = extractSlots(template);
  const providedSlots = Object.keys(slots || {});

  // All required slots must be provided
  return requiredSlots.every((slot) => providedSlots.includes(slot));
}

/**
 * Replace {slot} placeholders with sanitized values
 *
 * @param {string} template - Template with {slots}
 * @param {object} slots - {slotName: value} mapping
 * @returns {string} Interpolated template
 */
function interpolateTemplate(template, slots) {
  if (!template || typeof template !== "string") {
    return "";
  }

  if (!slots || typeof slots !== "object") {
    return template;
  }

  let result = template;

  // Replace each slot with sanitized value
  Object.entries(slots).forEach(([slotName, value]) => {
    const sanitized = sanitizeSlot(value);
    const slotPattern = new RegExp(`\\{${slotName}\\}`, "g");
    result = result.replace(slotPattern, sanitized);
  });

  return result;
}

/**
 * Clean template whitespace
 * - Trim leading/trailing whitespace
 * - Collapse multiple spaces/tabs
 * - Normalize line breaks
 *
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanTemplate(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .trim() // Remove leading/trailing whitespace
    .replace(/\t+/g, " ") // Replace tabs with spaces
    .replace(/  +/g, " ") // Collapse multiple spaces
    .replace(/\n\n+/g, "\n"); // Collapse multiple newlines
}

module.exports = {
  extractSlots,
  sanitizeSlot,
  validateSlots,
  interpolateTemplate,
  cleanTemplate,
};
