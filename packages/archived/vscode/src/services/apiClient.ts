/**
 * API client for ClaudeFlare backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

import {
  ClaudeFlareConfig,
  CodeExplanationRequest,
  CodeExplanationResponse,
  RefactorRequest,
  RefactorResponse,
  TestGenerationRequest,
  TestGenerationResponse,
  DocumentationRequest,
  DocumentationResponse,
  CodeReviewRequest,
  CodeReviewResponse,
  AgentOrchestrationRequest,
  AgentOrchestrationResponse,
  CompletionRequest,
  CompletionResponse,
  ApiError,
  StreamCallback,
  ChatMessage
} from '../types';
import { Logger } from '../utils/logger';

export class ApiClient {
  private client: AxiosInstance;
  private logger: Logger;
  private config: ClaudeFlareConfig;

  constructor(config: ClaudeFlareConfig) {
    this.config = config;
    this.logger = new Logger('ApiClient');

    this.client = axios.create({
      baseURL: config.apiEndpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'User-Agent': 'claudeflare-vscode/0.1.0'
      },
      timeout: config.agentTimeout
    });

    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors
   */
  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      config => {
        this.logger.debug('API Request', { method: config.method, url: config.url });
        return config;
      },
      error => {
        this.logger.error('Request error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      response => {
        this.logger.debug('API Response', { status: response.status, url: response.config.url });
        return response;
      },
      error => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: AxiosError): void {
    const apiError: ApiError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      statusCode: error.response?.status || 0,
      details: error.response?.data as Record<string, unknown>
    };

    this.logger.error('API Error', apiError);

    if (error.response?.status === 401) {
      vscode.window.showErrorMessage(
        'ClaudeFlare: Invalid API key. Please check your configuration.'
      );
    } else if (error.response?.status === 429) {
      vscode.window.showWarningMessage(
        'ClaudeFlare: Rate limit exceeded. Please try again later.'
      );
    } else if (error.response?.status === 500) {
      vscode.window.showErrorMessage(
        'ClaudeFlare: Server error. Please try again later.'
      );
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: ClaudeFlareConfig): void {
    this.config = config;
    this.client.defaults.baseURL = config.apiEndpoint;
    this.client.defaults.headers['Authorization'] = `Bearer ${config.apiKey}`;
    this.client.defaults.timeout = config.agentTimeout;
  }

  /**
   * Get code completion
   */
  async getCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const response = await this.client.post<CompletionResponse>('/v1/completions', {
        prompt: request.context.prefix,
        suffix: request.context.suffix,
        language: request.context.language,
        file_path: request.context.filePath,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        model: this.config.model
      });

      return response.data;
    } catch (error) {
      this.logger.error('Completion request failed', error);
      throw error;
    }
  }

  /**
   * Stream code completion
   */
  async streamCompletion(
    request: CompletionRequest,
    callback: StreamCallback
  ): Promise<void> {
    try {
      const response = await this.client.post('/v1/completions/stream', {
        prompt: request.context.prefix,
        suffix: request.context.suffix,
        language: request.context.language,
        file_path: request.context.filePath,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        model: this.config.model
      }, {
        responseType: 'stream'
      });

      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          if (event.data === '[DONE]') {
            callback('', true);
            return;
          }

          try {
            const data = JSON.parse(event.data);
            callback(data.content || data.text || '', false);
          } catch (e) {
            this.logger.error('Failed to parse stream data', e);
          }
        }
      });

      response.data.on('data', (chunk: Buffer) => {
        const str = chunk.toString();
        parser.feed(str);
      });

      response.data.on('end', () => {
        callback('', true);
      });

    } catch (error) {
      this.logger.error('Stream completion failed', error);
      callback('', true);
      throw error;
    }
  }

  /**
   * Get code explanation
   */
  async explainCode(request: CodeExplanationRequest): Promise<CodeExplanationResponse> {
    try {
      const response = await this.client.post<CodeExplanationResponse>('/v1/explain', {
        code: request.code,
        language: request.language,
        file_path: request.filePath,
        detail: request.detail || 'medium',
        model: this.config.model
      });

      return response.data;
    } catch (error) {
      this.logger.error('Explain request failed', error);
      throw error;
    }
  }

  /**
   * Stream code explanation
   */
  async streamExplain(
    request: CodeExplanationRequest,
    callback: StreamCallback
  ): Promise<void> {
    try {
      const response = await this.client.post('/v1/explain/stream', {
        code: request.code,
        language: request.language,
        file_path: request.filePath,
        detail: request.detail || 'medium',
        model: this.config.model
      }, {
        responseType: 'stream'
      });

      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          if (event.data === '[DONE]') {
            callback('', true);
            return;
          }

          try {
            const data = JSON.parse(event.data);
            callback(data.content || '', false);
          } catch (e) {
            this.logger.error('Failed to parse stream data', e);
          }
        }
      });

      response.data.on('data', (chunk: Buffer) => {
        const str = chunk.toString();
        parser.feed(str);
      });

      response.data.on('end', () => {
        callback('', true);
      });

    } catch (error) {
      this.logger.error('Stream explain failed', error);
      callback('', true);
      throw error;
    }
  }

  /**
   * Refactor code
   */
  async refactorCode(request: RefactorRequest): Promise<RefactorResponse> {
    try {
      const response = await this.client.post<RefactorResponse>('/v1/refactor', {
        code: request.code,
        language: request.language,
        file_path: request.filePath,
        type: request.type,
        options: request.options,
        model: this.config.model
      });

      return response.data;
    } catch (error) {
      this.logger.error('Refactor request failed', error);
      throw error;
    }
  }

  /**
   * Generate tests
   */
  async generateTests(request: TestGenerationRequest): Promise<TestGenerationResponse> {
    try {
      const response = await this.client.post<TestGenerationResponse>('/v1/tests/generate', {
        code: request.code,
        language: request.language,
        file_path: request.filePath,
        framework: request.framework,
        coverage_target: request.coverageTarget,
        model: this.config.model
      });

      return response.data;
    } catch (error) {
      this.logger.error('Test generation failed', error);
      throw error;
    }
  }

  /**
   * Generate documentation
   */
  async generateDocumentation(request: DocumentationRequest): Promise<DocumentationResponse> {
    try {
      const response = await this.client.post<DocumentationResponse>('/v1/docs/generate', {
        code: request.code,
        language: request.language,
        file_path: request.filePath,
        format: request.format,
        include_examples: request.includeExamples,
        model: this.config.model
      });

      return response.data;
    } catch (error) {
      this.logger.error('Documentation generation failed', error);
      throw error;
    }
  }

  /**
   * Review code
   */
  async reviewCode(request: CodeReviewRequest): Promise<CodeReviewResponse> {
    try {
      const response = await this.client.post<CodeReviewResponse>('/v1/review', {
        code: request.code,
        language: request.language,
        file_path: request.filePath,
        pr_number: request.prNumber,
        context: request.context,
        model: this.config.model
      });

      return response.data;
    } catch (error) {
      this.logger.error('Code review failed', error);
      throw error;
    }
  }

  /**
   * Orchestrate agents
   */
  async orchestrateAgents(request: AgentOrchestrationRequest): Promise<AgentOrchestrationResponse> {
    try {
      const response = await this.client.post<AgentOrchestrationResponse>('/v1/agents/orchestrate', {
        task: request.task,
        agents: request.agents,
        context: request.context,
        parallel: request.parallel,
        max_duration: request.maxDuration,
        model: this.config.model
      });

      return response.data;
    } catch (error) {
      this.logger.error('Agent orchestration failed', error);
      throw error;
    }
  }

  /**
   * Send chat message
   */
  async sendChatMessage(
    sessionId: string,
    message: string,
    history: ChatMessage[],
    context?: unknown
  ): Promise<string> {
    try {
      const response = await this.client.post('/v1/chat', {
        session_id: sessionId,
        message,
        history,
        context,
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: false
      });

      return response.data.content || response.data.message;
    } catch (error) {
      this.logger.error('Chat message failed', error);
      throw error;
    }
  }

  /**
   * Stream chat message
   */
  async streamChatMessage(
    sessionId: string,
    message: string,
    history: ChatMessage[],
    context: unknown,
    callback: StreamCallback
  ): Promise<void> {
    try {
      const response = await this.client.post('/v1/chat/stream', {
        session_id: sessionId,
        message,
        history,
        context,
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      }, {
        responseType: 'stream'
      });

      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          if (event.data === '[DONE]') {
            callback('', true);
            return;
          }

          try {
            const data = JSON.parse(event.data);
            callback(data.content || data.delta || '', false);
          } catch (e) {
            this.logger.error('Failed to parse stream data', e);
          }
        }
      });

      response.data.on('data', (chunk: Buffer) => {
        const str = chunk.toString();
        parser.feed(str);
      });

      response.data.on('end', () => {
        callback('', true);
      });

    } catch (error) {
      this.logger.error('Stream chat failed', error);
      callback('', true);
      throw error;
    }
  }

  /**
   * Get project context
   */
  async getProjectContext(rootPath: string): Promise<unknown> {
    try {
      const response = await this.client.post('/v1/context/analyze', {
        root_path: rootPath,
        depth: this.config.projectContextDepth
      });

      return response.data;
    } catch (error) {
      this.logger.error('Context analysis failed', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/v1/health');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Cleanup if needed
  }
}
