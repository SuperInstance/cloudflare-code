// @ts-nocheck
/**
 * Agents Orchestration API
 */

import type {
  Agent,
  AgentOrchestrationParams,
  AgentOrchestrationResponse,
  AgentType,
} from '../types/index.js';
import type { ClaudeFlareClient } from '../client.js';
import { errorFromResponse } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Agent Orchestration Resource
 */
export class AgentOrchestration {
  constructor(private client: ClaudeFlareClient) {}

  /**
   * Orchestrate agents for a task
   */
  async create(params: AgentOrchestrationParams): Promise<AgentOrchestrationResponse> {
    const url = `/${this.client.config.apiVersion}/agents/orchestrate`;
    const requestOptions = this.buildRequestOptions(params);

    logger.debug('Orchestrating agents', { params, url });

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
      logger.error('Agent orchestration failed', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Orchestrate with streaming updates
   */
  async createStream(
    params: AgentOrchestrationParams,
    onUpdate: (update: AgentOrchestrationResponse) => void
  ): Promise<AgentOrchestrationResponse> {
    const url = `/${this.client.config.apiVersion}/agents/orchestrate`;
    const streamParams = { ...params };
    const requestOptions = this.buildRequestOptions(streamParams);

    logger.debug('Orchestrating agents with streaming', { params: streamParams, url });

    const startTime = Date.now();

    try {
      const response = await this.client.request('POST', url, {
        ...requestOptions,
        headers: {
          ...requestOptions.headers,
          Accept: 'text/event-stream',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw errorFromResponse(response.status, data, this.client.getRequestId(response));
      }

      const duration = Date.now() - startTime;
      logger.logResponse(response.status, duration);

      // Process stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalResponse: AgentOrchestrationResponse | null = null;

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
                const update = JSON.parse(data) as AgentOrchestrationResponse;
                onUpdate(update);

                if (update.status === 'completed' || update.status === 'failed') {
                  finalResponse = update;
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      if (!finalResponse) {
        throw new Error('Orchestration did not complete');
      }

      return finalResponse;
    } catch (error) {
      logger.error('Agent orchestration streaming failed', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Build request options
   */
  private buildRequestOptions(params: AgentOrchestrationParams): RequestInit {
    return {
      body: JSON.stringify({
        task: params.task,
        agents: params.agents,
        auto_select: params.autoSelect,
        context: params.context,
        max_parallelism: params.maxParallelism,
        timeout: params.timeout,
      }),
    };
  }
}

/**
 * Agent Registry Resource
 */
export class AgentRegistry {
  constructor(private client: ClaudeFlareClient) {}

  /**
   * Get agent registry status
   */
  async getStatus(): Promise<{
    status: string;
    agents: Agent[];
    timestamp: number;
  }> {
    const url = `/${this.client.config.apiVersion}/agents/status`;

    logger.debug('Getting agent registry status', { url });

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
      logger.error('Failed to get agent registry status', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Get available agents
   */
  async list(type?: AgentType): Promise<{
    agents: Agent[];
    count: number;
    timestamp: number;
  }> {
    const url = type
      ? `/${this.client.config.apiVersion}/agents/available/${type}`
      : `/${this.client.config.apiVersion}/agents/available`;

    logger.debug('Listing available agents', { url, type });

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
      logger.error('Failed to list available agents', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Get agents by type
   */
  async getByType(type: AgentType): Promise<Agent[]> {
    const result = await this.list(type);
    return result.agents;
  }

  /**
   * Get all available agents
   */
  async getAll(): Promise<Agent[]> {
    const result = await this.list();
    return result.agents;
  }
}

/**
 * Agents API namespace
 */
export class Agents {
  constructor(
    public orchestrate: AgentOrchestration,
    public registry: AgentRegistry
  ) {}
}
