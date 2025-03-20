export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Post {
  id: string;
  userId: string;
  title: string;
  content: string;
  timestamp: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  timestamp: string;
}

export interface UserWithStats extends User {
  postCount: number;
}

export interface PostWithStats extends Post {
  commentCount: number;
  userName?: string;
}

export interface Credentials {
  companyName: string;
  clientID: string;
  clientSecret: string;
  ownerName: string;
  ownerEmail: string;
  rollNo: string;
}

export interface AuthResponse {
  token_type: string;
  access_token: string;
  expires_in: number;
}

export interface CacheData {
  rawData: {
    users: User[];
    posts: Post[];
    comments: Comment[];
  };
  computed: {
    topUsers: UserWithStats[];
    latestPosts: PostWithStats[];
    popularPosts: PostWithStats[];
  };
  lastFetched: number;
}
