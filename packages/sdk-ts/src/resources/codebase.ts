// @ts-nocheck
/**
 * Codebase RAG API
 */

import type {
  CodebaseUploadParams,
  CodebaseUploadResponse,
  CodebaseSearchParams,
  CodebaseSearchResponse,
  CodebaseFile,
} from '../types/index.js';
import type { ClaudeFlareClient } from '../client.js';
import { errorFromResponse } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Codebase Upload Resource
 */
export class CodebaseUpload {
  constructor(private client: ClaudeFlareClient) {}

  /**
   * Upload codebase for indexing
   */
  async create(params: CodebaseUploadParams): Promise<CodebaseUploadResponse> {
    const url = `/${this.client.config.apiVersion}/codebase/upload`;
    const formData = this.buildFormData(params);

    logger.debug('Uploading codebase', { params, url });

    const startTime = Date.now();

    try {
      const response = await this.client.request('POST', url, {
        body: formData,
        headers: {}, // Let browser set Content-Type for FormData
      });

      const duration = Date.now() - startTime;
      logger.logResponse(response.status, duration);

      const data = await response.json();

      if (!response.ok) {
        throw errorFromResponse(response.status, data, this.client.getRequestId(response));
      }

      return data;
    } catch (error) {
      logger.error('Codebase upload failed', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Upload files directly
   */
  async uploadFiles(files: CodebaseFile[]): Promise<CodebaseUploadResponse> {
    return this.create({ files });
  }

  /**
   * Upload repository from URL
   */
  async uploadRepository(
    repositoryUrl: string,
    branch?: string
  ): Promise<CodebaseUploadResponse> {
    return this.create({
      repositoryUrl,
      branch,
    });
  }

  /**
   * Build FormData from params
   */
  private buildFormData(params: CodebaseUploadParams): FormData {
    const formData = new FormData();

    if (params.repositoryUrl) {
      formData.append('repository_url', params.repositoryUrl);
    }

    if (params.branch) {
      formData.append('branch', params.branch);
    }

    if (params.includePatterns) {
      params.includePatterns.forEach((pattern, index) => {
        formData.append(`include_patterns[${index}]`, pattern);
      });
    }

    if (params.excludePatterns) {
      params.excludePatterns.forEach((pattern, index) => {
        formData.append(`exclude_patterns[${index}]`, pattern);
      });
    }

    if (params.maxFileSize) {
      formData.append('max_file_size', params.maxFileSize.toString());
    }

    if (params.files) {
      params.files.forEach((file, index) => {
        formData.append(`files[${index}][path]`, file.path);
        formData.append(`files[${index}][content]`, file.content);
      });
    }

    return formData;
  }
}

/**
 * Codebase Search Resource
 */
export class CodebaseSearch {
  constructor(private client: ClaudeFlareClient) {}

  /**
   * Search codebase
   */
  async query(params: CodebaseSearchParams): Promise<CodebaseSearchResponse> {
    const url = `/${this.client.config.apiVersion}/codebase/search`;
    const requestOptions = this.buildRequestOptions(params);

    logger.debug('Searching codebase', { params, url });

    const startTime = Date.now();

    try {
      const response = await this.client.request('POST', url, requestOptions);

      const duration = Date.now() - startTime;
      logger.logResponse(response.status, duration);

      const data = await response.json();

      if (!response.ok) {
        throw errorFromResponse(response.status, data, this.client.getRequestId(response));
      }

      return data;
    } catch (error) {
      logger.error('Codebase search failed', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Simple search with query string
   */
  async search(
    query: string,
    options?: Partial<CodebaseSearchParams>
  ): Promise<CodebaseSearchResponse> {
    return this.query({
      query,
      ...options,
    });
  }

  /**
   * Search by file path
   */
  async searchByPath(
    path: string,
    query: string,
    topK?: number
  ): Promise<CodebaseSearchResponse> {
    return this.query({
      query,
      topK,
      filters: {
        path,
      },
    });
  }

  /**
   * Search by language
   */
  async searchByLanguage(
    language: string,
    query: string,
    topK?: number
  ): Promise<CodebaseSearchResponse> {
    return this.query({
      query,
      topK,
      filters: {
        language,
      },
    });
  }

  /**
   * Build request options
   */
  private buildRequestOptions(params: CodebaseSearchParams): RequestInit {
    return {
      body: JSON.stringify({
        query: params.query,
        top_k: params.topK,
        filters: params.filters,
        include_snippets: params.includeSnippets,
      }),
    };
  }
}

/**
 * Codebase Management Resource
 */
export class CodebaseManagement {
  constructor(private client: ClaudeFlareClient) {}

  /**
   * Get codebase statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalChunks: number;
    totalSize: number;
    languages: Record<string, number>;
    lastIndexed: number;
  }> {
    const url = `/${this.client.config.apiVersion}/codebase/stats`;

    logger.debug('Getting codebase stats', { url });

    const startTime = Date.now();

    try {
      const response = await this.client.request('GET', url);

      const duration = Date.now() - startTime;
      logger.logResponse(response.status, duration);

      const data = await response.json();

      if (!response.ok) {
        throw errorFromResponse(response.status, data, this.client.getRequestId(response));
      }

      return data;
    } catch (error) {
      logger.error('Failed to get codebase stats', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Get a file from the codebase
   */
  async getFile(path: string): Promise<{
    path: string;
    content: string;
    language: string;
    size: number;
    lastModified: number;
  }> {
    const url = `/${this.client.config.apiVersion}/codebase/file?path=${encodeURIComponent(path)}`;

    logger.debug('Getting codebase file', { url, path });

    const startTime = Date.now();

    try {
      const response = await this.client.request('GET', url);

      const duration = Date.now() - startTime;
      logger.logResponse(response.status, duration);

      const data = await response.json();

      if (!response.ok) {
        throw errorFromResponse(response.status, data, this.client.getRequestId(response));
      }

      return data;
    } catch (error) {
      logger.error('Failed to get codebase file', { error, path, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Clear codebase index
   */
  async clear(): Promise<{
    success: boolean;
    timestamp: number;
  }> {
    const url = `/${this.client.config.apiVersion}/codebase`;

    logger.debug('Clearing codebase', { url });

    const startTime = Date.now();

    try {
      const response = await this.client.request('DELETE', url);

      const duration = Date.now() - startTime;
      logger.logResponse(response.status, duration);

      const data = await response.json();

      if (!response.ok) {
        throw errorFromResponse(response.status, data, this.client.getRequestId(response));
      }

      return data;
    } catch (error) {
      logger.error('Failed to clear codebase', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Reindex codebase
   */
  async reindex(): Promise<{
    status: string;
    timestamp: number;
  }> {
    const url = `/${this.client.config.apiVersion}/codebase/reindex`;

    logger.debug('Reindexing codebase', { url });

    const startTime = Date.now();

    try {
      const response = await this.client.request('POST', url);

      const duration = Date.now() - startTime;
      logger.logResponse(response.status, duration);

      const data = await response.json();

      if (!response.ok) {
        throw errorFromResponse(response.status, data, this.client.getRequestId(response));
      }

      return data;
    } catch (error) {
      logger.error('Failed to reindex codebase', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Batch upload files
   */
  async batchUpload(
    files: CodebaseFile[],
    batchSize: number = 100
  ): Promise<CodebaseUploadResponse[]> {
    const results: CodebaseUploadResponse[] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const result = await this.client.codebase.upload.create({ files: batch });
      results.push(result);
    }

    return results;
  }
}

/**
 * Codebase API namespace
 */
export class Codebase {
  constructor(
    public upload: CodebaseUpload,
    public search: CodebaseSearch,
    public management: CodebaseManagement
  ) {}
}
