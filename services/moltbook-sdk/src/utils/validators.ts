/**
 * Input validators for Moltbook SDK
 */

import { LIMITS, REGEX, API_KEY_PREFIX } from "./constants";
import { ValidationError, ConfigurationError } from "./errors";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateApiKey(apiKey: string | undefined): void {
  if (!apiKey) return;
  if (typeof apiKey !== "string") throw new ConfigurationError("apiKey must be a string");
  if (!apiKey.startsWith(API_KEY_PREFIX))
    throw new ConfigurationError(`apiKey must start with "${API_KEY_PREFIX}"`);
  if (apiKey.length < 25) throw new ConfigurationError("apiKey is too short");
}

export function validateAgentName(name: string): ValidationResult {
  const errors: string[] = [];
  if (!name) errors.push("Name is required");
  else {
    if (name.length < LIMITS.AGENT_NAME_MIN)
      errors.push(`Name must be at least ${LIMITS.AGENT_NAME_MIN} characters`);
    if (name.length > LIMITS.AGENT_NAME_MAX)
      errors.push(`Name must be at most ${LIMITS.AGENT_NAME_MAX} characters`);
    if (!REGEX.AGENT_NAME.test(name))
      errors.push("Name can only contain letters, numbers, and underscores");
  }
  return { valid: errors.length === 0, errors };
}

export function validateSubmoltName(name: string): ValidationResult {
  const errors: string[] = [];
  if (!name) errors.push("Name is required");
  else {
    if (name.length < LIMITS.SUBMOLT_NAME_MIN)
      errors.push(`Name must be at least ${LIMITS.SUBMOLT_NAME_MIN} characters`);
    if (name.length > LIMITS.SUBMOLT_NAME_MAX)
      errors.push(`Name must be at most ${LIMITS.SUBMOLT_NAME_MAX} characters`);
    if (!REGEX.SUBMOLT_NAME.test(name))
      errors.push("Name can only contain lowercase letters, numbers, and underscores");
  }
  return { valid: errors.length === 0, errors };
}

export function validatePostTitle(title: string): ValidationResult {
  const errors: string[] = [];
  if (!title || title.trim().length === 0) errors.push("Title is required");
  else if (title.length > LIMITS.POST_TITLE_MAX)
    errors.push(`Title must be at most ${LIMITS.POST_TITLE_MAX} characters`);
  return { valid: errors.length === 0, errors };
}

export function validatePostContent(content: string | undefined): ValidationResult {
  const errors: string[] = [];
  if (content && content.length > LIMITS.POST_CONTENT_MAX)
    errors.push(`Content must be at most ${LIMITS.POST_CONTENT_MAX} characters`);
  return { valid: errors.length === 0, errors };
}

export function validateCommentContent(content: string): ValidationResult {
  const errors: string[] = [];
  if (!content || content.trim().length === 0) errors.push("Content is required");
  else if (content.length > LIMITS.COMMENT_CONTENT_MAX)
    errors.push(`Content must be at most ${LIMITS.COMMENT_CONTENT_MAX} characters`);
  return { valid: errors.length === 0, errors };
}

export function validateUrl(url: string | undefined): ValidationResult {
  const errors: string[] = [];
  if (url && !REGEX.URL.test(url)) errors.push("URL must start with http:// or https://");
  return { valid: errors.length === 0, errors };
}

export function validateDescription(description: string | undefined): ValidationResult {
  const errors: string[] = [];
  if (description && description.length > LIMITS.DESCRIPTION_MAX)
    errors.push(`Description must be at most ${LIMITS.DESCRIPTION_MAX} characters`);
  return { valid: errors.length === 0, errors };
}

export function validatePagination(limit?: number, offset?: number): ValidationResult {
  const errors: string[] = [];
  if (limit !== undefined) {
    if (limit < 1) errors.push("Limit must be at least 1");
    if (limit > LIMITS.MAX_LIMIT) errors.push(`Limit must be at most ${LIMITS.MAX_LIMIT}`);
  }
  if (offset !== undefined && offset < 0) errors.push("Offset must be non-negative");
  return { valid: errors.length === 0, errors };
}

export function validateCreatePost(data: {
  submolt: string;
  title: string;
  content?: string;
  url?: string;
}): void {
  const errors: string[] = [];
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

  if (errors.length > 0) throw new ValidationError(errors.join("; "), "VALIDATION_ERROR");
}

export function validateCreateComment(data: {
  postId: string;
  content: string;
  parentId?: string;
}): void {
  const errors: string[] = [];
  if (!data.postId) errors.push("Post ID is required");
  const contentResult = validateCommentContent(data.content);
  errors.push(...contentResult.errors);

  if (errors.length > 0) throw new ValidationError(errors.join("; "), "VALIDATION_ERROR");
}

export function validateRegisterAgent(data: { name: string; description?: string }): void {
  const errors: string[] = [];
  const nameResult = validateAgentName(data.name);
  const descResult = validateDescription(data.description);
  errors.push(...nameResult.errors, ...descResult.errors);

  if (errors.length > 0) throw new ValidationError(errors.join("; "), "VALIDATION_ERROR");
}

export function isValidApiKey(apiKey: string): boolean {
  return typeof apiKey === "string" && apiKey.startsWith(API_KEY_PREFIX) && apiKey.length >= 25;
}

export function isValidAgentName(name: string): boolean {
  return REGEX.AGENT_NAME.test(name);
}

export function isValidSubmoltName(name: string): boolean {
  return REGEX.SUBMOLT_NAME.test(name);
}

export function isValidUrl(url: string): boolean {
  return REGEX.URL.test(url);
}
