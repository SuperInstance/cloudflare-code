/**
 * API client for communicating with ClaudeFlare backend
 */

import type {
  ApiResponse,
  DashboardStats,
  Project,
  CreateProjectForm,
  UpdateProjectForm,
  FileNode,
  ChatSession,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  AnalyticsData,
  UserSettings,
  UpdateUserForm,
  UpdatePreferencesForm,
  CreateAPIKeyForm,
  APIKey,
  PaginationParams,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.message || 'An error occurred',
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0
      );
    }
  }

  private get<T>(endpoint: string, params?: Record<string, unknown>) {
    const queryString = params
      ? '?' + new URLSearchParams(params as Record<string, string>)
      : '';
    return this.request<T>(`${endpoint}${queryString}`, {
      method: 'GET',
    });
  }

  private post<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  private put<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  private patch<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  private delete<T>(endpoint: string) {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Auth Endpoints
  // ============================================================================

  async login(email: string, password: string) {
    return this.post<{ token: string; user: unknown }>('/api/auth/login', {
      email,
      password,
    });
  }

  async logout() {
    return this.post('/api/auth/logout');
  }

  async register(email: string, password: string, name: string) {
    return this.post<{ token: string; user: unknown }>('/api/auth/register', {
      email,
      password,
      name,
    });
  }

  async refreshToken() {
    return this.post<{ token: string }>('/api/auth/refresh');
  }

  async resetPassword(email: string) {
    return this.post('/api/auth/reset-password', { email });
  }

  async confirmPasswordReset(token: string, password: string) {
    return this.post('/api/auth/confirm-reset', { token, password });
  }

  // ============================================================================
  // Dashboard Endpoints
  // ============================================================================

  async getDashboardStats(period: '24h' | '7d' | '30d' | '90d' = '7d') {
    return this.get<DashboardStats>('/api/dashboard/stats', { period });
  }

  async getRecentActivity(limit = 10) {
    return this.get('/api/dashboard/activity', { limit });
  }

  // ============================================================================
  // Project Endpoints
  // ============================================================================

  async getProjects(params?: PaginationParams) {
    return this.get<Project[]>('/api/projects', params as Record<string, unknown>);
  }

  async getProject(id: string) {
    return this.get<Project>(`/api/projects/${id}`);
  }

  async createProject(data: CreateProjectForm) {
    return this.post<Project>('/api/projects', data);
  }

  async updateProject(id: string, data: UpdateProjectForm) {
    return this.patch<Project>(`/api/projects/${id}`, data);
  }

  async deleteProject(id: string) {
    return this.delete(`/api/projects/${id}`);
  }

  async getProjectFiles(projectId: string, path?: string) {
    return this.get<FileNode[]>(`/api/projects/${projectId}/files`, {
      path: path || '',
    });
  }

  async getFileContent(projectId: string, path: string) {
    return this.get<{ content: string }>(`/api/projects/${projectId}/files/content`, {
      path,
    });
  }

  async updateFileContent(projectId: string, path: string, content: string) {
    return this.put(`/api/projects/${projectId}/files/content`, { path, content });
  }

  async createFile(projectId: string, path: string, content: string) {
    return this.post<FileNode>(`/api/projects/${projectId}/files`, {
      path,
      content,
    });
  }

  async deleteFile(projectId: string, path: string) {
    return this.delete(`/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`);
  }

  async renameFile(projectId: string, oldPath: string, newPath: string) {
    return this.patch(`/api/projects/${projectId}/files/rename`, {
      oldPath,
      newPath,
    });
  }

  // ============================================================================
  // Chat Endpoints
  // ============================================================================

  async getChatSessions(projectId?: string, params?: PaginationParams) {
    return this.get<ChatSession[]>('/api/chat/sessions', {
      ...(params as Record<string, unknown>),
      projectId,
    });
  }

  async getChatSession(id: string) {
    return this.get<ChatSession>(`/api/chat/sessions/${id}`);
  }

  async createChatSession(data: {
    projectId?: string;
    title: string;
    settings: ChatSession['settings'];
  }) {
    return this.post<ChatSession>('/api/chat/sessions', data);
  }

  async updateChatSession(id: string, data: Partial<ChatSession>) {
    return this.patch<ChatSession>(`/api/chat/sessions/${id}`, data);
  }

  async deleteChatSession(id: string) {
    return this.delete(`/api/chat/sessions/${id}`);
  }

  async getChatMessages(sessionId: string, params?: PaginationParams) {
    return this.get<ChatMessage[]>(`/api/chat/sessions/${sessionId}/messages`, params as Record<string, unknown>);
  }

  async sendChatMessage(data: ChatRequest & { sessionId: string }) {
    return this.post<ChatResponse>('/api/chat/completions', data);
  }

  async streamChatMessage(
    data: ChatRequest & { sessionId: string },
    onChunk: (chunk: string) => void,
    onComplete: (metadata?: unknown) => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    const response = await fetch(`${this.baseUrl}/api/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({ ...data, stream: true }),
    });

    if (!response.ok) {
      throw new ApiError('Failed to stream response', response.status);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is null');
    }

    let cancelled = false;

    const read = async (): Promise<void> => {
      try {
        while (!cancelled) {
          const { done, value } = await reader.read();

          if (done) {
            onComplete();
            return;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                onComplete();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  onChunk(parsed.content);
                }
                if (parsed.done) {
                  onComplete(parsed.metadata);
                  return;
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          onError(error instanceof Error ? error : new Error('Unknown error'));
        }
      }
    };

    read();

    return () => {
      cancelled = true;
      reader.cancel();
    };
  }

  // ============================================================================
  // Analytics Endpoints
  // ============================================================================

  async getAnalyticsData(
    period: '24h' | '7d' | '30d' | '90d' = '7d',
    metrics?: string[]
  ) {
    return this.get<AnalyticsData>('/api/analytics/data', {
      period,
      metrics: metrics?.join(','),
    });
  }

  async getProviderMetrics(period: '24h' | '7d' | '30d' | '90d' = '7d') {
    return this.get('/api/analytics/providers', { period });
  }

  async getModelUsage(period: '24h' | '7d' | '30d' | '90d' = '7d') {
    return this.get('/api/analytics/models', { period });
  }

  async getCostAnalysis(period: '24h' | '7d' | '30d' | '90d' = '7d') {
    return this.get('/api/analytics/costs', { period });
  }

  // ============================================================================
  // Settings Endpoints
  // ============================================================================

  async getUserSettings() {
    return this.get<UserSettings>('/api/settings');
  }

  async updateUserProfile(data: UpdateUserForm) {
    return this.patch('/api/settings/profile', data);
  }

  async updatePreferences(data: UpdatePreferencesForm) {
    return this.patch('/api/settings/preferences', data);
  }

  async getAPIKeys() {
    return this.get<APIKey[]>('/api/settings/api-keys');
  }

  async createAPIKey(data: CreateAPIKeyForm) {
    return this.post<APIKey>('/api/settings/api-keys', data);
  }

  async deleteAPIKey(id: string) {
    return this.delete(`/api/settings/api-keys/${id}`);
  }

  async getNotificationSettings() {
    return this.get('/api/settings/notifications');
  }

  async updateNotificationSettings(data: unknown) {
    return this.patch('/api/settings/notifications', data);
  }

  async getBillingInfo() {
    return this.get('/api/settings/billing');
  }

  // ============================================================================
  // Upload Endpoints
  // ============================================================================

  async uploadFile(
    projectId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; path: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.data);
        } else {
          reject(new ApiError(xhr.statusText, xhr.status));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      const formData = new FormData();
      formData.append('file', file);

      xhr.open('POST', `${this.baseUrl}/api/projects/${projectId}/upload`);
      if (this.token) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      }

      xhr.send(formData);
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for custom instances
export { ApiClient, ApiError };
