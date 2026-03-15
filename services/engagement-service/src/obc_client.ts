/**
 * OpenBotCity HTTP Client
 * Handles JWT authentication, error handling, and logging
 * Never throws - returns error objects instead
 */

import axios, { AxiosError } from "axios";
import winston from "winston";

interface ClientResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  retryable?: boolean;
}

/**
 * OpenBotCity API Client
 * Handles HTTP requests with JWT authentication and error handling
 */
export class ObcClient {
  private jwt: string;
  private baseUrl: string;
  private timeout: number;
  public logger: winston.Logger;

  constructor() {
    this.jwt = process.env.OPENBOTCITY_JWT ?? "";
    this.baseUrl = process.env.OPENBOTCITY_URL || "https://openbotcity.example.com";
    this.timeout = 5000; // 5 second timeout

    // Create logger with similar setup to engagement-service
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: "obc-client" },
      transports: [
        new winston.transports.File({
          filename: "logs/obc-error.log",
          level: "error",
        }),
        new winston.transports.File({ filename: "logs/obc.log" }),
      ],
    });

    // Add console transport in non-production
    if (process.env.NODE_ENV !== "production") {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        })
      );
    }
  }

  /**
   * Get token preview for logging (first 20 chars)
   */
  private getTokenPreview(): string {
    if (!this.jwt) return "MISSING";
    return this.jwt.substring(0, 20) + "...";
  }

  /**
   * Make GET request to OBC API
   */
  async get<T = unknown>(path: string, options: Record<string, unknown> = {}): Promise<ClientResponse<T>> {
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

      const response = await axios(config);

      const duration = Date.now() - startTime;
      this.logger.info(`GET ${path} succeeded`, {
        status: response.status,
        duration,
        tokenPreview: this.getTokenPreview(),
      });

      return {
        success: true,
        data: response.data as T,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return this.handleError<T>(error as AxiosError, "GET", path, duration);
    }
  }

  /**
   * Make POST request to OBC API
   */
  async post<T = unknown>(
    path: string,
    data: unknown,
    options: Record<string, unknown> = {}
  ): Promise<ClientResponse<T>> {
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

      const response = await axios(config);

      const duration = Date.now() - startTime;
      this.logger.info(`POST ${path} succeeded`, {
        status: response.status,
        duration,
        tokenPreview: this.getTokenPreview(),
      });

      return {
        success: true,
        data: response.data as T,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return this.handleError<T>(error as AxiosError, "POST", path, duration);
    }
  }

  /**
   * Handle request errors gracefully
   * Never throws - always returns error object
   */
  private handleError<T = unknown>(
    error: AxiosError | any,
    method: string,
    path: string,
    duration: number
  ): ClientResponse<T> {
    let statusCode: number | null = null;
    let statusText: string | null = null;
    let isRetryable = true;
    let errorMessage: string | null = null;

    if (error.response) {
      // Request made but received error response
      statusCode = error.response.status ?? null;
      statusText = error.response.statusText ?? null;

      if (statusCode === 401) {
        errorMessage = "Unauthorized (JWT expired or invalid)";
        isRetryable = false;
      } else if (statusCode && statusCode >= 400 && statusCode < 500) {
        errorMessage = `Client error (${statusCode})`;
        isRetryable = false;
      } else if (statusCode && statusCode >= 500) {
        errorMessage = "Server error";
        isRetryable = true;
      } else if (statusCode) {
        errorMessage = `HTTP ${statusCode}`;
        isRetryable = true;
      }
    } else if (error.code === "ECONNABORTED") {
      // Timeout
      errorMessage = `Timeout after ${this.timeout}ms`;
      isRetryable = true;
    } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      // Network error
      errorMessage = "Network error (connection refused or host not found)";
      isRetryable = true;
    } else {
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
      error: errorMessage,
      retryable: isRetryable,
    };
  }
}
