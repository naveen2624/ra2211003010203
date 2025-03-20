// utils/error-handler.ts
import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";

// Standard API error response type
export interface ErrorResponse {
  success: false;
  error: string;
  code: number;
  details?: unknown;
}

// Custom API error class
export class ApiError extends Error {
  code: number;
  details?: unknown;

  constructor(message: string, code = 500, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

// Error handler middleware for API routes
export function errorHandler(
  error: unknown,
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse>
) {
  console.error("API Error:", error);

  // Handle known error types
  if (error instanceof ApiError) {
    return res.status(error.code).json({
      success: false,
      error: error.message,
      code: error.code,
      details: error.details,
    });
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle unique constraint violations
    if (error.code === "P2002") {
      const field = (error.meta?.target as string[]) || ["record"];
      const fieldName = field.join(", ");

      return res.status(409).json({
        success: false,
        error: `A ${fieldName} with this value already exists.`,
        code: 409,
        details: { fields: field },
      });
    }

    // Handle not found records
    if (error.code === "P2001" || error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Record not found",
        code: 404,
        details: error.meta,
      });
    }

    // Other Prisma errors
    return res.status(400).json({
      success: false,
      error: "Database operation failed",
      code: 400,
      details: {
        code: error.code,
        message: error.message,
      },
    });
  }

  // Handle validation errors
  if (error instanceof Error && error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: error.message || "Validation failed",
      code: 400,
    });
  }

  // Handle general errors
  if (error instanceof Error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      code: 500,
    });
  }

  // Default case for unknown errors
  return res.status(500).json({
    success: false,
    error: "An unexpected error occurred",
    code: 500,
  });
}

// Wrapper for async API handlers to catch errors
export function withErrorHandling(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      errorHandler(error, req, res);
    }
  };
}

// Common error factory functions
export const ErrorFactory = {
  notFound: (message = "Resource not found", details?: unknown) =>
    new ApiError(message, 404, details),

  badRequest: (message = "Bad request", details?: unknown) =>
    new ApiError(message, 400, details),

  unauthorized: (message = "Unauthorized", details?: unknown) =>
    new ApiError(message, 401, details),

  forbidden: (message = "Forbidden", details?: unknown) =>
    new ApiError(message, 403, details),

  conflict: (message = "Resource conflict", details?: unknown) =>
    new ApiError(message, 409, details),

  serverError: (message = "Internal server error", details?: unknown) =>
    new ApiError(message, 500, details),
};

// Logger utility for tracking errors
export const logger = {
  error: (error: unknown, context = {}) => {
    console.error("[ERROR]", {
      timestamp: new Date().toISOString(),
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
      context,
    });
  },

  warn: (message: string, context = {}) => {
    console.warn("[WARN]", {
      timestamp: new Date().toISOString(),
      message,
      context,
    });
  },

  info: (message: string, context = {}) => {
    console.info("[INFO]", {
      timestamp: new Date().toISOString(),
      message,
      context,
    });
  },
};
