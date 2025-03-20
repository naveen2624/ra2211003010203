import axios from "axios";
import { Credentials, AuthResponse, User, Post, Comment } from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_TEST_SERVER_URL || "http://20.244.56.144/test";

class ApiClient {
  private authToken: string | null = null;
  private tokenExpiry: number = 0;
  private credentials: Credentials;

  constructor(credentials: Credentials) {
    this.credentials = credentials;
  }

  public async authenticate(): Promise<void> {
    try {
      const response = await axios.post<AuthResponse>(
        `${BASE_URL}/auth`,
        this.credentials
      );

      if (response.data && response.data.access_token) {
        this.authToken = response.data.access_token;
        const expiresIn = response.data.expires_in || 3600;
        this.tokenExpiry = Date.now() + expiresIn * 1000;
        console.log("Authentication successful");
      } else {
        throw new Error("Invalid authentication response");
      }
    } catch (error) {
      console.error("Authentication error:", error);
      throw error;
    }
  }

  private isTokenValid(): boolean {
    return !!this.authToken && Date.now() < this.tokenExpiry - 60000; // 1 minute buffer
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.isTokenValid()) {
      await this.authenticate();
    }
  }

  private async authenticatedGet<T>(endpoint: string): Promise<T> {
    await this.ensureAuthenticated();

    try {
      const response = await axios.get<T>(`${BASE_URL}/${endpoint}`, {
        headers: { Authorization: `Bearer ${this.authToken}` },
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      throw error;
    }
  }

  public async getUsers(): Promise<User[]> {
    return this.authenticatedGet<User[]>("users");
  }

  public async getPosts(): Promise<Post[]> {
    return this.authenticatedGet<Post[]>("posts");
  }

  public async getComments(): Promise<Comment[]> {
    return this.authenticatedGet<Comment[]>("comments");
  }

  public async fetchAllData() {
    try {
      const [users, posts, comments] = await Promise.all([
        this.getUsers(),
        this.getPosts(),
        this.getComments(),
      ]);

      return { users, posts, comments };
    } catch (error) {
      console.error("Error fetching all data:", error);
      throw error;
    }
  }
}

export default ApiClient;
