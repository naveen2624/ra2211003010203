import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { errorHandler } from "../../../utils/error-handler";

const prisma = new PrismaClient();

// Interface for post engagement metrics
interface PostEngagement {
  postId: string;
  totalEngagements: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  engagementRate: number;
}

// Time periods for filtering
type TimePeriod = "day" | "week" | "month" | "year" | "all";

/**
 * Get popular posts based on engagement metrics
 *
 * @param req - Express request object
 * @param res - Express response object
 * @returns Promise<Response> - JSON response with popular posts
 */
export const getPopularPosts = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const period = (req.query.period as TimePeriod) || "week";
    const limit = parseInt(req.query.limit as string) || 10;

    // Define the date range based on the period
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
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
      case "all":
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // Base query for posts
    const whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Filter by user if userId is provided
    if (userId) {
      whereClause.userId = userId;
    }

    // Get posts with their engagement metrics
    const posts = await prisma.post.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            name: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
            views: true,
          },
        },
      },
      take: limit * 3, // Fetch more than needed for processing
    });

    // Calculate engagement metrics for each post
    const postsWithEngagement: ((typeof posts)[0] & {
      engagementMetrics: PostEngagement;
    })[] = posts.map((post) => {
      const totalEngagements =
        post._count.likes + post._count.comments + post._count.shares;
      const engagementRate =
        post._count.views > 0
          ? (totalEngagements / post._count.views) * 100
          : 0;

      return {
        ...post,
        engagementMetrics: {
          postId: post.id,
          totalEngagements,
          likes: post._count.likes,
          comments: post._count.comments,
          shares: post._count.shares,
          views: post._count.views,
          engagementRate: parseFloat(engagementRate.toFixed(2)),
        },
      };
    });

    // Sort posts by total engagements (primary) and engagement rate (secondary)
    const sortedPosts = postsWithEngagement.sort((a, b) => {
      if (
        b.engagementMetrics.totalEngagements ===
        a.engagementMetrics.totalEngagements
      ) {
        return (
          b.engagementMetrics.engagementRate -
          a.engagementMetrics.engagementRate
        );
      }
      return (
        b.engagementMetrics.totalEngagements -
        a.engagementMetrics.totalEngagements
      );
    });

    // Take only the requested number of posts
    const popularPosts = sortedPosts.slice(0, limit);

    // Calculate average engagement rate across all posts
    const totalPosts = popularPosts.length;
    let totalEngagementRate = 0;

    popularPosts.forEach((post) => {
      totalEngagementRate += post.engagementMetrics.engagementRate;
    });

    const averageEngagementRate =
      totalPosts > 0
        ? parseFloat((totalEngagementRate / totalPosts).toFixed(2))
        : 0;

    // Return the response
    return res.status(200).json({
      period,
      dateRange: {
        from: startDate,
        to: endDate,
      },
      metrics: {
        totalPosts,
        averageEngagementRate,
      },
      posts: popularPosts,
    });
  } catch (error) {
    return handleErrorResponse(res, error, "Error fetching popular posts");
  }
};

/**
 * Get trending topics from popular posts
 *
 * @param req - Express request object
 * @param res - Express response object
 * @returns Promise<Response> - JSON response with trending topics
 */
export const getTrendingTopics = async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as TimePeriod) || "week";
    const limit = parseInt(req.query.limit as string) || 10;

    // Define the date range based on the period
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
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
      case "all":
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // Get posts in the specified time period
    const posts = await prisma.post.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        content: true,
        tags: true,
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          },
        },
      },
    });

    // Extract and count hashtags and mentions
    interface Topic {
      text: string;
      type: "hashtag" | "mention";
      count: number;
      engagementScore: number;
    }

    const topicsMap = new Map<string, Topic>();

    // Helper function to extract hashtags and mentions
    const extractTopics = (content: string) => {
      // Extract hashtags (e.g., #example)
      const hashtags =
        content.match(
          /#[\w\u0590-\u05FF\u0621-\u064A\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]+/g
        ) || [];

      // Extract mentions (e.g., @username)
      const mentions = content.match(/@[\w]+/g) || [];

      return { hashtags, mentions };
    };

    // Process all posts
    posts.forEach((post) => {
      const totalEngagement =
        post._count.likes + post._count.comments + post._count.shares;

      // Extract topics from content
      const { hashtags, mentions } = extractTopics(post.content);

      // Process hashtags
      hashtags.forEach((tag) => {
        if (topicsMap.has(tag)) {
          const topic = topicsMap.get(tag)!;
          topic.count += 1;
          topic.engagementScore += totalEngagement;
        } else {
          topicsMap.set(tag, {
            text: tag,
            type: "hashtag",
            count: 1,
            engagementScore: totalEngagement,
          });
        }
      });

      // Process mentions
      mentions.forEach((mention) => {
        if (topicsMap.has(mention)) {
          const topic = topicsMap.get(mention)!;
          topic.count += 1;
          topic.engagementScore += totalEngagement;
        } else {
          topicsMap.set(mention, {
            text: mention,
            type: "mention",
            count: 1,
            engagementScore: totalEngagement,
          });
        }
      });

      // Process tags if available
      if (post.tags && Array.isArray(post.tags)) {
        post.tags.forEach((tag) => {
          const hashTag = `#${tag}`;
          if (topicsMap.has(hashTag)) {
            const topic = topicsMap.get(hashTag)!;
            topic.count += 1;
            topic.engagementScore += totalEngagement;
          } else {
            topicsMap.set(hashTag, {
              text: hashTag,
              type: "hashtag",
              count: 1,
              engagementScore: totalEngagement,
            });
          }
        });
      }
    });

    // Convert map to array and sort by engagement score
    const topics = Array.from(topicsMap.values())
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);

    return res.status(200).json({
      period,
      dateRange: {
        from: startDate,
        to: endDate,
      },
      topics,
    });
  } catch (error) {
    return handleErrorResponse(res, error, "Error fetching trending topics");
  }
};

/**
 * Get comparative user engagement stats
 *
 * @param req - Express request object
 * @param res - Express response object
 * @returns Promise<Response> - JSON response with user engagement comparison
 */
export const getUserEngagementComparison = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.params.userId;
    const period = (req.query.period as TimePeriod) || "month";

    // Define the date range based on the period
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
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
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's posts in the specified time period
    const userPosts = await prisma.post.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
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

    // Calculate user's engagement metrics
    let userTotalEngagements = 0;
    let userTotalViews = 0;

    userPosts.forEach((post) => {
      const postEngagements =
        post._count.likes + post._count.comments + post._count.shares;
      userTotalEngagements += postEngagements;
      userTotalViews += post._count.views;
    });

    const userEngagementRate =
      userTotalViews > 0 ? (userTotalEngagements / userTotalViews) * 100 : 0;

    // Get platform average engagement metrics for the same period
    const allPosts = await prisma.post.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
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

    // Calculate platform average metrics
    let platformTotalEngagements = 0;
    let platformTotalViews = 0;

    allPosts.forEach((post) => {
      const postEngagements =
        post._count.likes + post._count.comments + post._count.shares;
      platformTotalEngagements += postEngagements;
      platformTotalViews += post._count.views;
    });

    const platformEngagementRate =
      platformTotalViews > 0
        ? (platformTotalEngagements / platformTotalViews) * 100
        : 0;

    // Calculate percentile rank for the user
    const allUserEngagementRates: number[] = [];

    // Group posts by user and calculate engagement rate for each
    const userPostsMap = new Map<
      string,
      { engagements: number; views: number }
    >();

    for (const post of allPosts) {
      const postUserId = await prisma.post
        .findUnique({
          where: { id: post.id },
          select: { userId: true },
        })
        .then((data) => data?.userId);

      if (!postUserId) continue;

      const postEngagements =
        post._count.likes + post._count.comments + post._count.shares;
      const postViews = post._count.views;

      if (userPostsMap.has(postUserId)) {
        const userData = userPostsMap.get(postUserId)!;
        userData.engagements += postEngagements;
        userData.views += postViews;
      } else {
        userPostsMap.set(postUserId, {
          engagements: postEngagements,
          views: postViews,
        });
      }
    }

    // Calculate engagement rate for each user
    userPostsMap.forEach((data) => {
      const rate = data.views > 0 ? (data.engagements / data.views) * 100 : 0;
      allUserEngagementRates.push(rate);
    });

    // Sort rates to determine percentile
    allUserEngagementRates.sort((a, b) => a - b);

    // Find position of user's engagement rate
    let percentileRank = 0;
    if (allUserEngagementRates.length > 0) {
      const position = allUserEngagementRates.findIndex(
        (rate) => rate >= userEngagementRate
      );
      if (position !== -1) {
        percentileRank = (position / allUserEngagementRates.length) * 100;
      } else {
        percentileRank = 100; // Top performer
      }
    }

    return res.status(200).json({
      userId,
      username: user.username,
      period,
      dateRange: {
        from: startDate,
        to: endDate,
      },
      userMetrics: {
        totalPosts: userPosts.length,
        totalEngagements: userTotalEngagements,
        engagementRate: parseFloat(userEngagementRate.toFixed(2)),
        percentileRank: parseFloat(percentileRank.toFixed(2)),
      },
      platformAverages: {
        engagementRate: parseFloat(platformEngagementRate.toFixed(2)),
        comparison: parseFloat(
          ((userEngagementRate / platformEngagementRate) * 100 - 100).toFixed(2)
        ),
      },
    });
  } catch (error) {
    return handleErrorResponse(
      res,
      error,
      "Error fetching user engagement comparison"
    );
  }
};

export default {
  getPopularPosts,
  getTrendingTopics,
  getUserEngagementComparison,
};
