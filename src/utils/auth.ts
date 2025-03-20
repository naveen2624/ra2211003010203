// utils/auth.ts
import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient, User } from "@prisma/client";
import { sign, verify } from "jsonwebtoken";
import { hash, compare } from "bcryptjs";
import { ErrorFactory } from "./error-handler";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "your-default-secret-change-this";

// User authentication types
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  user: AuthUser;
  token: string;
}

// Password utilities
export const passwordUtils = {
  // Hash a password
  hashPassword: async (password: string): Promise<string> => {
    return hash(password, 12);
  },

  // Compare password with hash
  verifyPassword: async (
    password: string,
    hashedPassword: string
  ): Promise<boolean> => {
    return compare(password, hashedPassword);
  },
};

// Token utilities
export const tokenUtils = {
  // Generate JWT token
  generateToken: (user: AuthUser): string => {
    return sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
  },

  // Verify JWT token
  verifyToken: (token: string): AuthUser => {
    try {
      return verify(token, JWT_SECRET) as AuthUser;
    } catch (error) {
      throw ErrorFactory.unauthorized("Invalid or expired token");
    }
  },
};

// Parse token from authorization header
const getTokenFromHeader = (req: NextApiRequest): string | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7);
};

// Authentication middleware
export const authMiddleware = async (
  req: NextApiRequest,
  res: NextApiResponse,
  requireAdmin = false
): Promise<AuthUser> => {
  const token = getTokenFromHeader(req);

  if (!token) {
    throw ErrorFactory.unauthorized("Authentication required");
  }

  // Verify token
  const decodedUser = tokenUtils.verifyToken(token);

  // Check if user exists in database
  const user = await prisma.user.findUnique({
    where: { id: decodedUser.id },
  });

  if (!user) {
    throw ErrorFactory.unauthorized("User not found");
  }

  // Check for admin role if required
  if (requireAdmin && user.role !== "ADMIN") {
    throw ErrorFactory.forbidden("Admin privileges required");
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };
};

// Authentication handler
export const auth = {
  // Register a new user
  register: async (
    email: string,
    username: string,
    password: string,
    name?: string
  ): Promise<LoginResponse> => {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw ErrorFactory.conflict(
        existingUser.email === email
          ? "Email already in use"
          : "Username already taken"
      );
    }

    // Hash password
    const hashedPassword = await passwordUtils.hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name,
      },
    });

    // Generate auth user object
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    // Generate token
    const token = tokenUtils.generateToken(authUser);

    return {
      success: true,
      user: authUser,
      token,
    };
  },

  // Login user
  login: async (email: string, password: string): Promise<LoginResponse> => {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw ErrorFactory.unauthorized("Invalid email or password");
    }

    // Verify password
    const isPasswordValid = await passwordUtils.verifyPassword(
      password,
      user.password
    );

    if (!isPasswordValid) {
      throw ErrorFactory.unauthorized("Invalid email or password");
    }

    // Generate auth user object
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    // Generate token
    const token = tokenUtils.generateToken(authUser);

    return {
      success: true,
      user: authUser,
      token,
    };
  },

  // Get current user
  getCurrentUser: async (req: NextApiRequest): Promise<User | null> => {
    try {
      const token = getTokenFromHeader(req);

      if (!token) {
        return null;
      }

      const decodedUser = tokenUtils.verifyToken(token);

      return await prisma.user.findUnique({
        where: { id: decodedUser.id },
      });
    } catch (error) {
      return null;
    }
  },
};

// Helper to create authenticated API handler
export function withAuth(
  handler: (
    req: NextApiRequest,
    res: NextApiResponse,
    user: AuthUser
  ) => Promise<void>,
  requireAdmin = false
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const user = await authMiddleware(req, res, requireAdmin);
      await handler(req, res, user);
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = (error as any).code || 500;
        res.status(statusCode).json({
          success: false,
          error: error.message,
          code: statusCode,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Internal server error",
          code: 500,
        });
      }
    }
  };
}
