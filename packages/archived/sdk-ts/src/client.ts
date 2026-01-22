// @ts-nocheck
/**
 * Main ClaudeFlare Client
 */

import type { ClaudeFlareConfig, RequestOptions } from './types/index.js';
import { Chat } from './resources/chat.js';
import { Code } from './resources/code.js';
import { Agents } from './resources/agents.js';
import { Models } from './resources/models.js';
import { Codebase } from './resources/codebase.js';
import { retryWithBackoff, defaultRetryConfig } from './utils/retry.js';
import { Logger, getLogger, setLogger, LogLevel } from './utils/logger.js';
import { ValidationError, AuthenticationError } from './utils/errors.js';

export class ClaudeFlareClient {
  readonly config: Required<ClaudeFlareConfig>;
  readonly logger: Logger;

  // API resources
  readonly chat: Chat;
  readonly code: Code;
  readonly agents: Agents;
  readonly models: Models;
  readonly codebase: Codebase;

  constructor(config: ClaudeFlareConfig) {
    // Validate configuration
    this.validateConfig(config);

    // Set up configuration with defaults
    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.claudeflare.com',
      apiVersion: config.apiVersion || 'v1',
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries ?? 3,
      debug: config.debug || false,
      defaultHeaders: config.defaultHeaders || {},
      fetch: config.fetch || (typeof window !== 'undefined' ? window.fetch : fetch),
      httpAgent: config.httpAgent,
    };

    // Set up logger
    this.logger = getLogger();
    if (this.config.debug) {
      this.logger.setConfig({ enabled: true, level: LogLevel.DEBUG });
    }

    // Initialize API resources
    this.chat = new Chat(
      new (class {
        completions = new (async () => {
          const { ChatCompletions } = await import('./resources/chat.js');
          return new ChatCompletions(this.client);
        })();
      })()
    );

    const { ChatCompletions } = require('./resources/chat.js');
    const { CodeGeneration, CodeAnalysis } = require('./resources/code.js');
    const { AgentOrchestration, AgentRegistry } = require('./resources/agents.js');
    const { Models: ModelsResource } = require('./resources/models.js');
    const { CodebaseUpload, CodebaseSearch, CodebaseManagement } = require('./resources/codebase.js');

    this.chat = new Chat(new ChatCompletions(this));
    this.code = new Code(new CodeGeneration(this), new CodeAnalysis(this));
    this.agents = new Agents(new AgentOrchestration(this), new AgentRegistry(this));
    this.models = new ModelsResource(this);
    this.codebase = new Codebase(
      new CodebaseUpload(this),
      new CodebaseSearch(this),
      new CodebaseManagement(this)
    );
  }

  /**
   * Validate client configuration
   */
  private validateConfig(config: ClaudeFlareConfig): void {
    if (!config.apiKey) {
      throw new ValidationError('API key is required');
    }

    if (typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) {
      throw new ValidationError('API key must be a non-empty string');
    }

    if (config.baseURL && typeof config.baseURL !== 'string') {
      throw new ValidationError('Base URL must be a string');
    }

    if (config.maxRetries !== undefined && (typeof config.maxRetries !== 'number' || config.maxRetries < 0)) {
      throw new ValidationError('Max retries must be a non-negative number');
    }

    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      throw new ValidationError('Timeout must be a positive number');
    }
  }

  /**
   * Make an HTTP request
   */
  async request(
    method: string,
    path: string,
    options: RequestInit & { timeout?: number; retries?: number } = {}
  ): Promise<Response> {
    const url = this.buildUrl(path);
    const timeout = options.timeout ?? this.config.timeout;
    const maxRetries = options.retries ?? this.config.maxRetries;

    const requestOptions: RequestInit = {
      ...options,
      method,
      headers: {
        ...this.buildHeaders(),
        ...options.headers,
      },
    };

    // Log request
    this.logger.logRequest(method, url, requestOptions.headers as Record<string, string>);

    // Make request with retry
    const response = await retryWithBackoff(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await this.config.fetch(url, {
            ...requestOptions,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Check for authentication errors
          if (response.status === 401) {
            throw new AuthenticationError('Invalid API key', this.getRequestId(response));
          }

          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      {
        ...defaultRetryConfig,
        maxRetries,
        onRetry: (attempt, error) => {
          this.logger.warn(`Retrying request (attempt ${attempt})`, { error: error.message });
        },
      }
    );

    return response;
  }

  /**
   * Build full URL
   */
  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.config.baseURL}${cleanPath}`;
  }

  /**
   * Build request headers
   */
  private buildHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': `@claudeflare/sdk-ts/${this.getVersion()}`,
      'X-Request-ID': this.generateRequestId(),
      ...this.config.defaultHeaders,
    };
  }

  /**
   * Get request ID from response
   */
  getRequestId(response: Response): string | undefined {
    return response.headers.get('X-Request-ID') || undefined;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get SDK version
   */
  private getVersion(): string {
    // This would be replaced by build process
    return '0.1.0';
  }
}

/**
 * Main ClaudeFlare class (public API)
 */
export class ClaudeFlare extends ClaudeFlareClient {
  /**
   * Create a new ClaudeFlare client instance
   */
  constructor(config: ClaudeFlareConfig) {
    super(config);
  }

  /**
   * Configure global logger
   */
  static setLogger(logger: Logger): void {
    setLogger(logger);
  }

  /**
   * Create client from environment variable
   */
  static fromEnv(): ClaudeFlare {
    const apiKey = typeof process !== 'undefined'
      ? process.env.CLAUDEFLARE_API_KEY
      : undefined;

    if (!apiKey) {
      throw new ValidationError('CLAUDEFLARE_API_KEY environment variable is not set');
    }

    return new ClaudeFlare({ apiKey });
  }
}

// Export all types and resources
export * from './types/index.js';
export * from './resources/chat.js';
export * from './resources/code.js';
export * from './resources/agents.js';
export * from './resources/models.js';
export * from './resources/codebase.js';
export * from './utils/errors.js';
export { Logger, LogLevel } from './utils/logger.js';
