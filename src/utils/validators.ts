// utils/validators.ts
import { z } from "zod";

// User validation schemas
export const userRegistrationSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username cannot exceed 30 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character"
    ),
  name: z.string().optional(),
});

export const userLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const userUpdateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  name: z.string().optional(),
  bio: z.string().max(160, "Bio cannot exceed 160 characters").optional(),
  avatar: z.string().url("Invalid URL").optional(),
});

// Post validation schemas
export const postCreationSchema = z.object({
  content: z
    .string()
    .min(1, "Post content is required")
    .max(500, "Post cannot exceed 500 characters"),
  imageUrl: z.string().url("Invalid image URL").optional(),
});

export const postUpdateSchema = z.object({
  content: z.string().min(1).max(500).optional(),
  imageUrl: z.string().url().optional(),
});

// Comment validation schema
export const commentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(280, "Comment cannot exceed 280 characters"),
  postId: z.string().min(1, "Post ID is required"),
});

// Analytics validation schemas
export const analyticsEventSchema = z.object({
  eventType: z.string().min(1, "Event type is required"),
  userId: z.string().optional(),
  postId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  referrer: z.string().optional(),
  pageUrl: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Helper function to validate data against schemas
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): {
  success: boolean;
  data?: T;
  error?: string;
} {
  try {
    const validData = schema.parse(data);
    return {
      success: true,
      data: validData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }
    return {
      success: false,
      error: "Validation failed",
    };
  }
}
