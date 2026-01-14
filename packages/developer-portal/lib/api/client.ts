import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ApiRequest, ApiResponseData } from '@/types';

export class ApiClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.apiKey) {
          config.headers.Authorization = `Bearer ${this.apiKey}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          console.error('Unauthorized: Invalid or missing API key');
        } else if (error.response?.status === 429) {
          // Handle rate limiting
          console.error('Rate limit exceeded');
        }
        return Promise.reject(error);
      }
    );
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  async executeRequest(
    request: ApiRequest,
    signal?: AbortSignal
  ): Promise<ApiResponseData> {
    const startTime = performance.now();

    try {
      const response: AxiosResponse = await this.client.request({
        method: request.method as any,
        url: request.endpoint,
        headers: request.headers,
        params: request.queryParams,
        data: request.body,
        signal,
      });

      const duration = performance.now() - startTime;
      const size = JSON.stringify(response.data).length;

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as Record<string, string>,
        body: response.data,
        duration: Math.round(duration),
        size,
      };
    } catch (error) {
      const duration = performance.now() - startTime;

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout');
        }

        if (error.response) {
          return {
            status: error.response.status,
            statusText: error.response.statusText,
            headers: error.response.headers as Record<string, string>,
            body: error.response.data,
            duration: Math.round(duration),
            size: JSON.stringify(error.response.data).length,
          };
        }

        if (error.request) {
          throw new Error('No response received from server');
        }
      }

      throw error;
    }
  }

  async get<T = any>(
    endpoint: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponseData> {
    return this.executeRequest({
      endpoint,
      method: 'GET',
      headers: config?.headers || {},
      queryParams: config?.params || {},
      pathParams: {},
      contentType: 'application/json',
    });
  }

  async post<T = any>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponseData> {
    return this.executeRequest({
      endpoint,
      method: 'POST',
      headers: config?.headers || {},
      queryParams: config?.params || {},
      pathParams: {},
      body: data,
      contentType: 'application/json',
    });
  }

  async put<T = any>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponseData> {
    return this.executeRequest({
      endpoint,
      method: 'PUT',
      headers: config?.headers || {},
      queryParams: config?.params || {},
      pathParams: {},
      body: data,
      contentType: 'application/json',
    });
  }

  async patch<T = any>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponseData> {
    return this.executeRequest({
      endpoint,
      method: 'PATCH',
      headers: config?.headers || {},
      queryParams: config?.params || {},
      pathParams: {},
      body: data,
      contentType: 'application/json',
    });
  }

  async delete<T = any>(
    endpoint: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponseData> {
    return this.executeRequest({
      endpoint,
      method: 'DELETE',
      headers: config?.headers || {},
      queryParams: config?.params || {},
      pathParams: {},
      contentType: 'application/json',
    });
  }
}

// Singleton instance
let apiClientInstance: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || 'https://api.claudeflare.dev';
    apiClientInstance = new ApiClient(baseUrl);
  }
  return apiClientInstance;
}

export function setApiClientApiKey(apiKey: string) {
  const client = getApiClient();
  client.setApiKey(apiKey);
}
