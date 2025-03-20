import ApiClient from "@/lib/api";
import {
  User,
  Post,
  Comment,
  UserWithStats,
  PostWithStats,
  CacheData,
  Credentials,
} from "@/lib/types";

const CACHE_DURATION = 10 * 1000;

class DataService {
  private apiClient: ApiClient;
  private cache: CacheData;
  private refreshPromise: Promise<void> | null = null;

  constructor(credentials: Credentials) {
    this.apiClient = new ApiClient(credentials);
    this.cache = {
      rawData: {
        users: [],
        posts: [],
        comments: [],
      },
      computed: {
        topUsers: [],
        latestPosts: [],
        popularPosts: [],
      },
      lastFetched: 0,
    };
  }

  private getCacheExpiry(): number {
    return this.cache.lastFetched + CACHE_DURATION;
  }

  private isCacheFresh(): boolean {
    return this.cache.lastFetched > 0 && Date.now() < this.getCacheExpiry();
  }

  public async refreshData(force = false): Promise<void> {
    if (!force && this.isCacheFresh()) {
      return;
    }
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<void> {
    try {
      console.log("Refreshing data from API...");
      const { users, posts, comments } = await this.apiClient.fetchAllData();

      this.cache.rawData.users = users || [];
      this.cache.rawData.posts = posts || [];
      this.cache.rawData.comments = comments || [];

      this.computeTopUsers();
      this.computeLatestPosts();
      this.computePopularPosts();

      this.cache.lastFetched = Date.now();

      console.log("Data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
      throw error;
    }
  }

  private computeTopUsers(): void {
    const userPostCounts = new Map<string, number>();

    for (const post of this.cache.rawData.posts) {
      const userId = post.userId;
      userPostCounts.set(userId, (userPostCounts.get(userId) || 0) + 1);
    }

    const usersWithCounts: UserWithStats[] = this.cache.rawData.users.map(
      (user) => ({
        ...user,
        postCount: userPostCounts.get(user.id) || 0,
      })
    );

    this.cache.computed.topUsers = usersWithCounts
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, 5);
  }

  private computeLatestPosts(): void {
    const userMap = new Map<string, User>();
    this.cache.rawData.users.forEach((user) => userMap.set(user.id, user));

    const postCommentCounts = new Map<string, number>();
    this.cache.rawData.comments.forEach((comment) => {
      const postId = comment.postId;
      postCommentCounts.set(postId, (postCommentCounts.get(postId) || 0) + 1);
    });

    this.cache.computed.latestPosts = [...this.cache.rawData.posts]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 5)
      .map((post) => ({
        ...post,
        commentCount: postCommentCounts.get(post.id) || 0,
        userName: userMap.get(post.userId)?.name,
      }));
  }

  private computePopularPosts(): void {
    const userMap = new Map<string, User>();
    this.cache.rawData.users.forEach((user) => userMap.set(user.id, user));

    const postCommentCounts = new Map<string, number>();

    for (const comment of this.cache.rawData.comments) {
      const postId = comment.postId;
      postCommentCounts.set(postId, (postCommentCounts.get(postId) || 0) + 1);
    }

    let maxCommentCount = 0;
    const countsArray = Array.from(postCommentCounts.values());
    for (const count of countsArray) {
      if (count > maxCommentCount) {
        maxCommentCount = count;
      }
    }

    this.cache.computed.popularPosts = this.cache.rawData.posts
      .filter(
        (post) => (postCommentCounts.get(post.id) || 0) === maxCommentCount
      )
      .map((post) => ({
        ...post,
        commentCount: postCommentCounts.get(post.id) || 0,
        userName: userMap.get(post.userId)?.name,
      }));
  }

  public async getTopUsers(): Promise<UserWithStats[]> {
    await this.refreshData();
    return this.cache.computed.topUsers;
  }

  public async getLatestPosts(): Promise<PostWithStats[]> {
    await this.refreshData();
    return this.cache.computed.latestPosts;
  }

  public async getPopularPosts(): Promise<PostWithStats[]> {
    await this.refreshData();
    return this.cache.computed.popularPosts;
  }

  public startBackgroundRefresh(): NodeJS.Timeout {
    return setInterval(() => {
      this.refreshData(true).catch((error) => {
        console.error("Background refresh failed:", error);
      });
    }, CACHE_DURATION);
  }
}

export default DataService;
