/**
 * Code Generation and Analysis API
 */

import type {
  CodeGenerationParams,
  CodeGenerationResponse,
  CodeAnalysisParams,
  CodeAnalysisResponse,
} from '../types/index.js';
import type { ClaudeFlareClient } from '../client.js';
import { errorFromResponse } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Code Generation Resource
 */
export class CodeGeneration {
  constructor(private client: ClaudeFlareClient) {}

  /**
   * Generate code from a prompt
   */
  async generate(params: CodeGenerationParams): Promise<CodeGenerationResponse> {
    const url = `/${this.client.config.apiVersion}/code/generate`;
    const requestOptions = this.buildRequestOptions(params);

    logger.debug('Generating code', { params, url });

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
      logger.error('Code generation failed', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Generate code with streaming
   */
  async generateStream(
    params: CodeGenerationParams,
    onChunk: (chunk: string) => void
  ): Promise<CodeGenerationResponse> {
    const streamParams = { ...params, stream: true };
    const url = `/${this.client.config.apiVersion}/code/generate`;
    const requestOptions = this.buildRequestOptions(streamParams);

    logger.debug('Generating code with streaming', { params: streamParams, url });

    const startTime = Date.now();

    try {
      const response = await this.client.request('POST', url, requestOptions);

      if (!response.ok) {
        const data = await response.json();
        throw errorFromResponse(response.status, data, this.client.getRequestId(response));
      }

      const duration = Date.now() - startTime;
      logger.logResponse(response.status, duration);

      // Accumulate stream
      let code = '';
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                break;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  code += parsed.content;
                  onChunk(parsed.content);
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      return {
        id: `code_${Date.now()}`,
        code,
        language: params.language,
        framework: params.framework,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Code generation streaming failed', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Build request options
   */
  private buildRequestOptions(params: CodeGenerationParams): RequestInit {
    return {
      body: JSON.stringify({
        prompt: params.prompt,
        language: params.language,
        framework: params.framework,
        model: params.model,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: params.stream,
        context: params.context,
        style: params.style,
      }),
    };
  }
}

/**
 * Code Analysis Resource
 */
export class CodeAnalysis {
  constructor(private client: ClaudeFlareClient) {}

  /**
   * Analyze code
   */
  async analyze(params: CodeAnalysisParams): Promise<CodeAnalysisResponse> {
    const url = `/${this.client.config.apiVersion}/code/analyze`;
    const requestOptions = this.buildRequestOptions(params);

    logger.debug('Analyzing code', { params, url });

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
      logger.error('Code analysis failed', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Perform security analysis
   */
  async security(code: string, language: string): Promise<CodeAnalysisResponse> {
    return this.analyze({
      code,
      language,
      analysisType: 'security',
    });
  }

  /**
   * Perform performance analysis
   */
  async performance(code: string, language: string): Promise<CodeAnalysisResponse> {
    return this.analyze({
      code,
      language,
      analysisType: 'performance',
    });
  }

  /**
   * Perform quality analysis
   */
  async quality(code: string, language: string): Promise<CodeAnalysisResponse> {
    return this.analyze({
      code,
      language,
      analysisType: 'quality',
    });
  }

  /**
   * Perform complexity analysis
   */
  async complexity(code: string, language: string): Promise<CodeAnalysisResponse> {
    return this.analyze({
      code,
      language,
      analysisType: 'complexity',
    });
  }

  /**
   * Generate documentation
   */
  async document(code: string, language: string): Promise<CodeAnalysisResponse> {
    return this.analyze({
      code,
      language,
      analysisType: 'documentation',
    });
  }

  /**
   * Build request options
   */
  private buildRequestOptions(params: CodeAnalysisParams): RequestInit {
    return {
      body: JSON.stringify({
        code: params.code,
        language: params.language,
        analysis_type: params.analysisType,
        model: params.model,
      }),
    };
  }
}

/**
 * Code API namespace
 */
export class Code {
  constructor(
    public generate: CodeGeneration,
    public analyze: CodeAnalysis
  ) {}
}
