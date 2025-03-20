import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { validatePostInput } from "../utils/validators";
import { handleErrorResponse } from "../utils/error-handler";

const router = express.Router();
const prisma = new PrismaClient();

// Get all posts with pagination
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const posts = await prisma.post.findMany({
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { likes: true, comments: true, shares: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalPosts = await prisma.post.count();

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
    return handleErrorResponse(res, error, "Error fetching posts");
  }
});

// Get post by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { likes: true, comments: true, shares: true },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    return res.status(200).json(post);
  } catch (error) {
    return handleErrorResponse(res, error, "Error fetching post");
  }
});

// Create new post
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, content, mediaUrls } = req.body;

    const validationError = validatePostInput(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const post = await prisma.post.create({
      data: {
        userId,
        content,
        mediaUrls: mediaUrls || [],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return res.status(201).json(post);
  } catch (error) {
    return handleErrorResponse(res, error, "Error creating post");
  }
});

// Update post
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, mediaUrls } = req.body;

    const existingPost = await prisma.post.findUnique({
      where: { id },
    });

    if (!existingPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Verify user is the owner of the post
    if (existingPost.userId !== req.body.userId) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this post" });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        content,
        mediaUrls: mediaUrls || existingPost.mediaUrls,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return res.status(200).json(updatedPost);
  } catch (error) {
    return handleErrorResponse(res, error, "Error updating post");
  }
});

// Delete post
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const existingPost = await prisma.post.findUnique({
      where: { id },
    });

    if (!existingPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Verify user is the owner of the post
    if (existingPost.userId !== userId) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this post" });
    }

    await prisma.post.delete({
      where: { id },
    });

    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    return handleErrorResponse(res, error, "Error deleting post");
  }
});

// Get post analytics
router.get("/:id/analytics", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
            views: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Get engagement rate
    const totalEngagements =
      post._count.likes + post._count.comments + post._count.shares;
    const engagementRate =
      post._count.views > 0 ? (totalEngagements / post._count.views) * 100 : 0;

    return res.status(200).json({
      postId: id,
      metrics: {
        likes: post._count.likes,
        comments: post._count.comments,
        shares: post._count.shares,
        views: post._count.views,
        totalEngagements,
        engagementRate: parseFloat(engagementRate.toFixed(2)),
      },
    });
  } catch (error) {
    return handleErrorResponse(res, error, "Error fetching post analytics");
  }
});

export default router;
