"use strict";
/**
 * OpenBotCity HTTP Client
 * Handles JWT authentication, error handling, and logging
 * Never throws - returns error objects instead
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObcClient = void 0;
const axios_1 = __importDefault(require("axios"));
const winston_1 = __importDefault(require("winston"));
/**
 * OpenBotCity API Client
 * Handles HTTP requests with JWT authentication and error handling
 */
class ObcClient {
    constructor() {
        this.jwt = process.env.OPENBOTCITY_JWT ?? "";
        this.baseUrl = process.env.OPENBOTCITY_URL || "https://openbotcity.example.com";
        this.timeout = 5000; // 5 second timeout
        // Create logger with similar setup to engagement-service
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || "info",
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
            defaultMeta: { service: "obc-client" },
            transports: [
                new winston_1.default.transports.File({
                    filename: "logs/obc-error.log",
                    level: "error",
                }),
                new winston_1.default.transports.File({ filename: "logs/obc.log" }),
            ],
        });
        // Add console transport in non-production
        if (process.env.NODE_ENV !== "production") {
            this.logger.add(new winston_1.default.transports.Console({
                format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
            }));
        }
    }
    /**
     * Get token preview for logging (first 20 chars)
     */
    getTokenPreview() {
        if (!this.jwt)
            return "MISSING";
        return this.jwt.substring(0, 20) + "...";
    }
    /**
     * Make GET request to OBC API
     */
    async get(path, options = {}) {
        const startTime = Date.now();
        try {
            const config = {
                method: "GET",
                url: this.baseUrl + path,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.jwt}`,
                },
                timeout: this.timeout,
                ...options,
            };
            const response = await (0, axios_1.default)(config);
            const duration = Date.now() - startTime;
            this.logger.info(`GET ${path} succeeded`, {
                status: response.status,
                duration,
                tokenPreview: this.getTokenPreview(),
            });
            return {
                success: true,
                data: response.data,
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            return this.handleError(error, "GET", path, duration);
        }
    }
    /**
     * Make POST request to OBC API
     */
    async post(path, data, options = {}) {
        const startTime = Date.now();
        try {
            const config = {
                method: "POST",
                url: this.baseUrl + path,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.jwt}`,
                },
                data,
                timeout: this.timeout,
                ...options,
            };
            const response = await (0, axios_1.default)(config);
            const duration = Date.now() - startTime;
            this.logger.info(`POST ${path} succeeded`, {
                status: response.status,
                duration,
                tokenPreview: this.getTokenPreview(),
            });
            return {
                success: true,
                data: response.data,
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            return this.handleError(error, "POST", path, duration);
        }
    }
    /**
     * Handle request errors gracefully
     * Never throws - always returns error object
     */
    handleError(error, method, path, duration) {
        let statusCode = null;
        let statusText = null;
        let isRetryable = true;
        let errorMessage = null;
        if (error.response) {
            // Request made but received error response
            statusCode = error.response.status ?? null;
            statusText = error.response.statusText ?? null;
            if (statusCode === 401) {
                errorMessage = "Unauthorized (JWT expired or invalid)";
                isRetryable = false;
            }
            else if (statusCode && statusCode >= 400 && statusCode < 500) {
                errorMessage = `Client error (${statusCode})`;
                isRetryable = false;
            }
            else if (statusCode && statusCode >= 500) {
                errorMessage = "Server error";
                isRetryable = true;
            }
            else if (statusCode) {
                errorMessage = `HTTP ${statusCode}`;
                isRetryable = true;
            }
        }
        else if (error.code === "ECONNABORTED") {
            // Timeout
            errorMessage = `Timeout after ${this.timeout}ms`;
            isRetryable = true;
        }
        else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
            // Network error
            errorMessage = "Network error (connection refused or host not found)";
            isRetryable = true;
        }
        else {
            // Unknown error
            errorMessage = error.message || "Unknown error";
            isRetryable = true;
        }
        // Log the error
        this.logger.warn(`${method} ${path} failed`, {
            statusCode,
            statusText,
            error: errorMessage,
            duration,
            tokenPreview: this.getTokenPreview(),
        });
        return {
            success: false,
            error: errorMessage || "Unknown error",
            retryable: isRetryable,
        };
    }
}
exports.ObcClient = ObcClient;
//# sourceMappingURL=obc_client.js.map