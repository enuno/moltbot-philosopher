"use strict";
/**
 * Input validators for Moltbook SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApiKey = validateApiKey;
exports.validateAgentName = validateAgentName;
exports.validateSubmoltName = validateSubmoltName;
exports.validatePostTitle = validatePostTitle;
exports.validatePostContent = validatePostContent;
exports.validateCommentContent = validateCommentContent;
exports.validateUrl = validateUrl;
exports.validateDescription = validateDescription;
exports.validatePagination = validatePagination;
exports.validateCreatePost = validateCreatePost;
exports.validateCreateComment = validateCreateComment;
exports.validateRegisterAgent = validateRegisterAgent;
exports.isValidApiKey = isValidApiKey;
exports.isValidAgentName = isValidAgentName;
exports.isValidSubmoltName = isValidSubmoltName;
exports.isValidUrl = isValidUrl;
const constants_1 = require("./constants");
const errors_1 = require("./errors");
function validateApiKey(apiKey) {
  if (!apiKey) return;
  if (typeof apiKey !== "string") throw new errors_1.ConfigurationError("apiKey must be a string");
  if (!apiKey.startsWith(constants_1.API_KEY_PREFIX))
    throw new errors_1.ConfigurationError(`apiKey must start with "${constants_1.API_KEY_PREFIX}"`);
  if (apiKey.length < 25) throw new errors_1.ConfigurationError("apiKey is too short");
}
function validateAgentName(name) {
  const errors = [];
  if (!name) errors.push("Name is required");
  else {
    if (name.length < constants_1.LIMITS.AGENT_NAME_MIN)
      errors.push(`Name must be at least ${constants_1.LIMITS.AGENT_NAME_MIN} characters`);
    if (name.length > constants_1.LIMITS.AGENT_NAME_MAX)
      errors.push(`Name must be at most ${constants_1.LIMITS.AGENT_NAME_MAX} characters`);
    if (!constants_1.REGEX.AGENT_NAME.test(name))
      errors.push("Name can only contain letters, numbers, and underscores");
  }
  return { valid: errors.length === 0, errors };
}
function validateSubmoltName(name) {
  const errors = [];
  if (!name) errors.push("Name is required");
  else {
    if (name.length < constants_1.LIMITS.SUBMOLT_NAME_MIN)
      errors.push(`Name must be at least ${constants_1.LIMITS.SUBMOLT_NAME_MIN} characters`);
    if (name.length > constants_1.LIMITS.SUBMOLT_NAME_MAX)
      errors.push(`Name must be at most ${constants_1.LIMITS.SUBMOLT_NAME_MAX} characters`);
    if (!constants_1.REGEX.SUBMOLT_NAME.test(name))
      errors.push("Name can only contain lowercase letters, numbers, and underscores");
  }
  return { valid: errors.length === 0, errors };
}
function validatePostTitle(title) {
  const errors = [];
  if (!title || title.trim().length === 0) errors.push("Title is required");
  else if (title.length > constants_1.LIMITS.POST_TITLE_MAX)
    errors.push(`Title must be at most ${constants_1.LIMITS.POST_TITLE_MAX} characters`);
  return { valid: errors.length === 0, errors };
}
function validatePostContent(content) {
  const errors = [];
  if (content && content.length > constants_1.LIMITS.POST_CONTENT_MAX)
    errors.push(`Content must be at most ${constants_1.LIMITS.POST_CONTENT_MAX} characters`);
  return { valid: errors.length === 0, errors };
}
function validateCommentContent(content) {
  const errors = [];
  if (!content || content.trim().length === 0) errors.push("Content is required");
  else if (content.length > constants_1.LIMITS.COMMENT_CONTENT_MAX)
    errors.push(`Content must be at most ${constants_1.LIMITS.COMMENT_CONTENT_MAX} characters`);
  return { valid: errors.length === 0, errors };
}
function validateUrl(url) {
  const errors = [];
  if (url && !constants_1.REGEX.URL.test(url))
    errors.push("URL must start with http:// or https://");
  return { valid: errors.length === 0, errors };
}
function validateDescription(description) {
  const errors = [];
  if (description && description.length > constants_1.LIMITS.DESCRIPTION_MAX)
    errors.push(`Description must be at most ${constants_1.LIMITS.DESCRIPTION_MAX} characters`);
  return { valid: errors.length === 0, errors };
}
function validatePagination(limit, offset) {
  const errors = [];
  if (limit !== undefined) {
    if (limit < 1) errors.push("Limit must be at least 1");
    if (limit > constants_1.LIMITS.MAX_LIMIT)
      errors.push(`Limit must be at most ${constants_1.LIMITS.MAX_LIMIT}`);
  }
  if (offset !== undefined && offset < 0) errors.push("Offset must be non-negative");
  return { valid: errors.length === 0, errors };
}
function validateCreatePost(data) {
  const errors = [];
  const submoltResult = validateSubmoltName(data.submolt);
  const titleResult = validatePostTitle(data.title);
  const contentResult = validatePostContent(data.content);
  const urlResult = validateUrl(data.url);
  errors.push(
    ...submoltResult.errors,
    ...titleResult.errors,
    ...contentResult.errors,
    ...urlResult.errors,
  );
  if (!data.content && !data.url) errors.push("Either content or URL is required");
  if (data.content && data.url) errors.push("Cannot have both content and URL");
  if (errors.length > 0) throw new errors_1.ValidationError(errors.join("; "), "VALIDATION_ERROR");
}
function validateCreateComment(data) {
  const errors = [];
  if (!data.postId) errors.push("Post ID is required");
  const contentResult = validateCommentContent(data.content);
  errors.push(...contentResult.errors);
  if (errors.length > 0) throw new errors_1.ValidationError(errors.join("; "), "VALIDATION_ERROR");
}
function validateRegisterAgent(data) {
  const errors = [];
  const nameResult = validateAgentName(data.name);
  const descResult = validateDescription(data.description);
  errors.push(...nameResult.errors, ...descResult.errors);
  if (errors.length > 0) throw new errors_1.ValidationError(errors.join("; "), "VALIDATION_ERROR");
}
function isValidApiKey(apiKey) {
  return (
    typeof apiKey === "string" &&
    apiKey.startsWith(constants_1.API_KEY_PREFIX) &&
    apiKey.length >= 25
  );
}
function isValidAgentName(name) {
  return constants_1.REGEX.AGENT_NAME.test(name);
}
function isValidSubmoltName(name) {
  return constants_1.REGEX.SUBMOLT_NAME.test(name);
}
function isValidUrl(url) {
  return constants_1.REGEX.URL.test(url);
}
//# sourceMappingURL=validators.js.map
