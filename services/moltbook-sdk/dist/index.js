"use strict";
/**
 * @moltbook/sdk - Official TypeScript SDK for Moltbook
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticationError = exports.isRateLimitError = exports.isMoltbookError = exports.ConfigurationError = exports.TimeoutError = exports.NetworkError = exports.ConflictError = exports.RateLimitError = exports.ValidationError = exports.NotFoundError = exports.ForbiddenError = exports.AuthenticationError = exports.MoltbookError = exports.Search = exports.Feed = exports.Submolts = exports.Comments = exports.Posts = exports.Agents = exports.HttpClient = exports.MoltbookClient = void 0;
var MoltbookClient_1 = require("./client/MoltbookClient");
Object.defineProperty(exports, "MoltbookClient", { enumerable: true, get: function () { return MoltbookClient_1.MoltbookClient; } });
var HttpClient_1 = require("./client/HttpClient");
Object.defineProperty(exports, "HttpClient", { enumerable: true, get: function () { return HttpClient_1.HttpClient; } });
var resources_1 = require("./resources");
Object.defineProperty(exports, "Agents", { enumerable: true, get: function () { return resources_1.Agents; } });
Object.defineProperty(exports, "Posts", { enumerable: true, get: function () { return resources_1.Posts; } });
Object.defineProperty(exports, "Comments", { enumerable: true, get: function () { return resources_1.Comments; } });
Object.defineProperty(exports, "Submolts", { enumerable: true, get: function () { return resources_1.Submolts; } });
Object.defineProperty(exports, "Feed", { enumerable: true, get: function () { return resources_1.Feed; } });
Object.defineProperty(exports, "Search", { enumerable: true, get: function () { return resources_1.Search; } });
var errors_1 = require("./utils/errors");
Object.defineProperty(exports, "MoltbookError", { enumerable: true, get: function () { return errors_1.MoltbookError; } });
Object.defineProperty(exports, "AuthenticationError", { enumerable: true, get: function () { return errors_1.AuthenticationError; } });
Object.defineProperty(exports, "ForbiddenError", { enumerable: true, get: function () { return errors_1.ForbiddenError; } });
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return errors_1.NotFoundError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errors_1.ValidationError; } });
Object.defineProperty(exports, "RateLimitError", { enumerable: true, get: function () { return errors_1.RateLimitError; } });
Object.defineProperty(exports, "ConflictError", { enumerable: true, get: function () { return errors_1.ConflictError; } });
Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return errors_1.NetworkError; } });
Object.defineProperty(exports, "TimeoutError", { enumerable: true, get: function () { return errors_1.TimeoutError; } });
Object.defineProperty(exports, "ConfigurationError", { enumerable: true, get: function () { return errors_1.ConfigurationError; } });
Object.defineProperty(exports, "isMoltbookError", { enumerable: true, get: function () { return errors_1.isMoltbookError; } });
Object.defineProperty(exports, "isRateLimitError", { enumerable: true, get: function () { return errors_1.isRateLimitError; } });
Object.defineProperty(exports, "isAuthenticationError", { enumerable: true, get: function () { return errors_1.isAuthenticationError; } });
__exportStar(require("./types"), exports);
const MoltbookClient_2 = require("./client/MoltbookClient");
exports.default = MoltbookClient_2.MoltbookClient;
//# sourceMappingURL=index.js.map
