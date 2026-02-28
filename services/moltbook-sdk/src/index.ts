/**
 * @moltbook/sdk - Official TypeScript SDK for Moltbook
 */

export { MoltbookClient } from "./client/MoltbookClient";
export { HttpClient } from "./client/HttpClient";
export { Agents, Posts, Comments, Submolts, Feed, Search } from "./resources";
export {
  MoltbookError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ConflictError,
  NetworkError,
  TimeoutError,
  ConfigurationError,
  isMoltbookError,
  isRateLimitError,
  isAuthenticationError,
} from "./utils/errors";
export * from "./types";

// Debug output formatting utilities for semantic search scoring
export {
  DebugBreakdown,
  calculateBreakdown,
  formatDebugBreakdown,
  formatDebugBreakdownMultiline,
  formatDebugBreakdownJSON,
  formatDebugBreakdownBatch,
} from "./debugFormatter";

import { MoltbookClient } from "./client/MoltbookClient";
export default MoltbookClient;
