/**
 * Input validators for Moltbook SDK
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
export declare function validateApiKey(apiKey: string | undefined): void;
export declare function validateAgentName(name: string): ValidationResult;
export declare function validateSubmoltName(name: string): ValidationResult;
export declare function validatePostTitle(title: string): ValidationResult;
export declare function validatePostContent(content: string | undefined): ValidationResult;
export declare function validateCommentContent(content: string): ValidationResult;
export declare function validateUrl(url: string | undefined): ValidationResult;
export declare function validateDescription(description: string | undefined): ValidationResult;
export declare function validatePagination(limit?: number, offset?: number): ValidationResult;
export declare function validateCreatePost(data: {
  submolt: string;
  title: string;
  content?: string;
  url?: string;
}): void;
export declare function validateCreateComment(data: {
  postId: string;
  content: string;
  parentId?: string;
}): void;
export declare function validateRegisterAgent(data: { name: string; description?: string }): void;
export declare function isValidApiKey(apiKey: string): boolean;
export declare function isValidAgentName(name: string): boolean;
export declare function isValidSubmoltName(name: string): boolean;
export declare function isValidUrl(url: string): boolean;
//# sourceMappingURL=validators.d.ts.map
