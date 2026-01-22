import { CommunityPost, CodeShare, Plugin } from '@/types';

export class CommunityClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  async getPosts(category?: string, limit = 50): Promise<CommunityPost[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    if (category && category !== 'all') {
      params.set('category', category);
    }

    const response = await fetch(
      `${this.baseUrl}/v1/community/posts?${params}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }

    return response.json();
  }

  async getPost(postId: string): Promise<CommunityPost> {
    const response = await fetch(
      `${this.baseUrl}/v1/community/posts/${postId}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch post: ${response.statusText}`);
    }

    return response.json();
  }

  async createPost(post: {
    title: string;
    content: string;
    category: string;
    tags?: string[];
  }): Promise<CommunityPost> {
    const response = await fetch(`${this.baseUrl}/v1/community/posts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(post),
    });

    if (!response.ok) {
      throw new Error(`Failed to create post: ${response.statusText}`);
    }

    return response.json();
  }

  async createReply(postId: string, content: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/v1/community/posts/${postId}/replies`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ content }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create reply: ${response.statusText}`);
    }

    return response.json();
  }

  async likePost(postId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/v1/community/posts/${postId}/like`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to like post: ${response.statusText}`);
    }
  }

  async getCodeSnippets(language?: string, limit = 50): Promise<CodeShare[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    if (language && language !== 'all') {
      params.set('language', language);
    }

    const response = await fetch(
      `${this.baseUrl}/v1/community/code?${params}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch code snippets: ${response.statusText}`);
    }

    return response.json();
  }

  async shareCode(snippet: {
    title: string;
    description: string;
    code: string;
    language: string;
    tags?: string[];
  }): Promise<CodeShare> {
    const response = await fetch(`${this.baseUrl}/v1/community/code`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(snippet),
    });

    if (!response.ok) {
      throw new Error(`Failed to share code: ${response.statusText}`);
    }

    return response.json();
  }

  async likeSnippet(snippetId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/v1/community/code/${snippetId}/like`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to like snippet: ${response.statusText}`);
    }
  }

  async forkSnippet(snippetId: string): Promise<CodeShare> {
    const response = await fetch(
      `${this.baseUrl}/v1/community/code/${snippetId}/fork`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fork snippet: ${response.statusText}`);
    }

    return response.json();
  }

  async getPlugins(tag?: string, limit = 50): Promise<Plugin[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    if (tag && tag !== 'all') {
      params.set('tag', tag);
    }

    const response = await fetch(
      `${this.baseUrl}/v1/community/plugins?${params}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch plugins: ${response.statusText}`);
    }

    return response.json();
  }

  async installPlugin(pluginId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/v1/community/plugins/${pluginId}/install`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to install plugin: ${response.statusText}`);
    }
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/v1/community/plugins/${pluginId}/uninstall`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to uninstall plugin: ${response.statusText}`);
    }
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }
}

// Singleton instance
let communityClientInstance: CommunityClient | null = null;

export function getCommunityClient(): CommunityClient {
  if (!communityClientInstance) {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || 'https://api.claudeflare.dev';
    communityClientInstance = new CommunityClient(baseUrl);
  }
  return communityClientInstance;
}

export function setCommunityApiKey(apiKey: string) {
  const client = getCommunityClient();
  client.setApiKey(apiKey);
}
