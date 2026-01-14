/**
 * API Client
 *
 * HTTP client with retry logic, caching, and offline support.
 */

import { offlineDb } from '../pwa/offline-db';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface ApiRequestOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  cache?: boolean;
  cacheTTL?: number;
  retries?: number;
  timeout?: number;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
}

class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number = 30000;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Set default header
   */
  setDefaultHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  /**
   * Set auth token
   */
  setAuthToken(token: string): void {
    this.setDefaultHeader('Authorization', `Bearer ${token}`);
  }

  /**
   * Clear auth token
   */
  clearAuthToken(): void {
    delete this.defaultHeaders['Authorization'];
  }

  /**
   * Make API request with retry logic
   */
  async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      cache = false,
      cacheTTL = 5 * 60 * 1000,
      retries = 3,
      timeout = this.defaultTimeout,
    } = options;

    const url = `${this.baseURL}${endpoint}`;

    // Try cache first for GET requests
    if (method === 'GET' && cache) {
      const cached = await offlineDb.getCachedResponse(url);
      if (cached) {
        return {
          data: cached,
          status: 200,
          headers: new Headers(),
        };
      }
    }

    // Attempt request with retries
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers: {
            ...this.defaultHeaders,
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle errors
        if (!response.ok) {
          const error = await this.handleError(response);
          throw error;
        }

        const data = await response.json();

        // Cache GET responses
        if (method === 'GET' && cache) {
          await offlineDb.cacheResponse(url, data, cacheTTL);
        }

        return {
          data,
          status: response.status,
          headers: response.headers,
        };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx errors
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < retries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<T> {
    const response = await this.request<T>(endpoint, { ...options, method: 'GET' });
    return response.data;
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    const response = await this.request<T>(endpoint, { ...options, method: 'POST', body });
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    const response = await this.request<T>(endpoint, { ...options, method: 'PUT', body });
    return response.data;
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    const response = await this.request<T>(endpoint, { ...options, method: 'PATCH', body });
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<T> {
    const response = await this.request<T>(endpoint, { ...options, method: 'DELETE' });
    return response.data;
  }

  /**
   * Streaming request (for chat)
   */
  async *stream(endpoint: string, body?: any): AsyncGenerator<string> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...this.defaultHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw await this.handleError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last line if it's incomplete
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            yield data;
          } catch (error) {
            console.error('Failed to parse SSE data:', error);
          }
        }
      }
    }
  }

  /**
   * Handle API errors
   */
  private async handleError(response: Response): Promise<ApiError> {
    let message = 'An error occurred';

    try {
      const data = await response.json();
      message = data.message || data.error || message;
    } catch {
      message = response.statusText || message;
    }

    return new ApiError(message, response.status);
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// Singleton instance
export const apiClient = new ApiClient();

/**
 * API endpoints
 */
export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  logout: () => apiClient.post('/auth/logout'),
  register: (email: string, password: string, name: string) =>
    apiClient.post('/auth/register', { email, password, name }),

  // Projects
  getProjects: () => apiClient.get('/projects', { cache: true, cacheTTL: 60 * 1000 }),
  getProject: (id: string) => apiClient.get(`/projects/${id}`, { cache: true }),
  createProject: (data: any) => apiClient.post('/projects', data),
  updateProject: (id: string, data: any) => apiClient.put(`/projects/${id}`, data),
  deleteProject: (id: string) => apiClient.delete(`/projects/${id}`),

  // Chat
  sendMessage: (conversationId: string, content: string) =>
    apiClient.post('/chat/messages', { conversationId, content }),
  streamMessage: (conversationId: string, content: string) =>
    apiClient.stream(`/chat/stream`, { conversationId, content }),
  getConversations: () =>
    apiClient.get('/chat/conversations', { cache: true, cacheTTL: 30 * 1000 }),
  getConversation: (id: string) =>
    apiClient.get(`/chat/conversations/${id}`, { cache: true }),

  // Code Review
  getPullRequests: () =>
    apiClient.get('/review/pull-requests', { cache: true, cacheTTL: 60 * 1000 }),
  getPullRequest: (id: string) =>
    apiClient.get(`/review/pull-requests/${id}`, { cache: true }),
  reviewPullRequest: (id: string) =>
    apiClient.post(`/review/pull-requests/${id}/review`),
  addComment: (prId: string, file: string, line: number, comment: string) =>
    apiClient.post(`/review/pull-requests/${prId}/comments`, { file, line, comment }),

  // Notifications
  getNotifications: () =>
    apiClient.get('/notifications', { cache: true, cacheTTL: 30 * 1000 }),
  markNotificationRead: (id: string) =>
    apiClient.put(`/notifications/${id}/read`),
  subscribeToPush: (subscription: PushSubscription) =>
    apiClient.post('/notifications/subscribe', { subscription }),

  // User
  getProfile: () => apiClient.get('/user/profile', { cache: true }),
  updateProfile: (data: any) => apiClient.put('/user/profile', data),
  updateSettings: (settings: any) => apiClient.put('/user/settings', settings),
};
