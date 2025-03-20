import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
  validateUserInput,
  validateProfileUpdateInput,
} from "../utils/validators";
import { handleErrorResponse } from "../utils/error-handler";
import { hashPassword, comparePasswords } from "../utils/auth";

const router = express.Router();
const prisma = new PrismaClient();

// Get all users with pagination
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const users = await prisma.user.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalUsers = await prisma.user.count();

    return res.status(200).json({
      users,
      pagination: {
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit),
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (error) {
    return handleErrorResponse(res, error, "Error fetching users");
  }
});

// Get user by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    return handleErrorResponse(res, error, "Error fetching user");
  }
});

// Create new user
router.post("/", async (req: Request, res: Response) => {
  try {
    const { username, email, password, name } = req.body;

    const validationError = validateUserInput(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message:
          existingUser.username === username
            ? "Username already taken"
            : "Email already registered",
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        name,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return res.status(201).json(user);
  } catch (error) {
    return handleErrorResponse(res, error, "Error creating user");
  }
});

// Update user profile
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, bio, avatarUrl } = req.body;

    const validationError = validateProfileUpdateInput(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name: name || existingUser.name,
        bio,
        avatarUrl: avatarUrl || existingUser.avatarUrl,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(updatedUser);
  } catch (error) {
    return handleErrorResponse(res, error, "Error updating user profile");
  }
});

// Get user's posts
router.get("/:id/posts", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Verify user exists
    const userExists = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }

    const posts = await prisma.post.findMany({
      where: { userId: id },
      skip,
      take: limit,
      include: {
        _count: {
          select: { likes: true, comments: true, shares: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalPosts = await prisma.post.count({
      where: { userId: id },
    });

    return res.status(200).json({
      posts,
      pagination: {
        total: totalPosts,
        pages: Math.ceil(totalPosts / limit),
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (error) {
    return handleErrorResponse(res, error, "Error fetching user posts");
  }
});

// Get user analytics
router.get("/:id/analytics", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const timeframe = (req.query.timeframe as string) || "month"; // day, week, month, year

    const endDate = new Date();
    let startDate = new Date();

    // Set the start date based on timeframe
    switch (timeframe) {
      case "day":
        startDate.setDate(endDate.getDate() - 1);
        break;
      case "week":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 1);
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get posts created in the timeframe
    const postCount = await prisma.post.count({
      where: {
        userId: id,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get followers gained in the timeframe
    const newFollowersCount = await prisma.follows.count({
      where: {
        followingId: id,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get total post engagement in the timeframe
    const postsInTimeframe = await prisma.post.findMany({
      where: {
        userId: id,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
      },
    });

    const postIds = postsInTimeframe.map((post) => post.id);

    const likesCount = await prisma.like.count({
      where: {
        postId: {
          in: postIds,
        },
      },
    });

    const commentsCount = await prisma.comment.count({
      where: {
        postId: {
          in: postIds,
        },
      },
    });

    const sharesCount = await prisma.share.count({
      where: {
        postId: {
          in: postIds,
        },
      },
    });

    const totalEngagements = likesCount + commentsCount + sharesCount;
    const engagementPerPost = postCount > 0 ? totalEngagements / postCount : 0;

    return res.status(200).json({
      userId: id,
      username: user.username,
      timeframe,
      period: {
        start: startDate,
        end: endDate,
      },
      metrics: {
        totalFollowers: user._count.followers,
        newFollowers: newFollowersCount,
        followersGrowthRate:
          user._count.followers > 0
            ? (newFollowersCount / user._count.followers) * 100
            : 0,
        totalPosts: user._count.posts,
        newPosts: postCount,
        engagement: {
          likes: likesCount,
          comments: commentsCount,
          shares: sharesCount,
          total: totalEngagements,
          perPost: parseFloat(engagementPerPost.toFixed(2)),
        },
      },
    });
  } catch (error) {
    return handleErrorResponse(res, error, "Error fetching user analytics");
  }
});

export default router;
