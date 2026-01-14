/**
 * Models API
 */

import type {
  Model,
  ModelsListResponse,
  AIProvider,
} from '../types/index.js';
import type { ClaudeFlareClient } from '../client.js';
import { errorFromResponse } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Models Resource
 */
export class Models {
  constructor(private client: ClaudeFlareClient) {}

  /**
   * List all available models
   */
  async list(): Promise<ModelsListResponse> {
    const url = `/${this.client.config.apiVersion}/models`;

    logger.debug('Listing models', { url });

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
      logger.error('Failed to list models', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Get a specific model by ID
   */
  async get(id: string): Promise<Model> {
    const url = `/${this.client.config.apiVersion}/models/${encodeURIComponent(id)}`;

    logger.debug('Getting model', { url, id });

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
      logger.error('Failed to get model', { error, id, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * List models by provider
   */
  async listByProvider(provider: AIProvider): Promise<Model[]> {
    const allModels = await this.list();
    return allModels.models.filter((model) => model.provider === provider);
  }

  /**
   * Find model by name or ID
   */
  async find(query: string): Promise<Model | undefined> {
    const allModels = await this.list();

    // Try exact match first
    let model = allModels.models.find(
      (m) => m.id === query || m.name.toLowerCase() === query.toLowerCase()
    );

    // Try partial match
    if (!model) {
      model = allModels.models.find((m) =>
        m.name.toLowerCase().includes(query.toLowerCase())
      );
    }

    return model;
  }

  /**
   * Get models with specific capabilities
   */
  async listWithCapabilities(
    capabilities: Partial<{
      streaming: boolean;
      functionCalling: boolean;
      vision: boolean;
      codeGeneration: boolean;
      analysis: boolean;
    }>
  ): Promise<Model[]> {
    const allModels = await this.list();

    return allModels.models.filter((model) => {
      if (capabilities.streaming !== undefined && model.capabilities.streaming !== capabilities.streaming) {
        return false;
      }
      if (capabilities.functionCalling !== undefined && model.capabilities.functionCalling !== capabilities.functionCalling) {
        return false;
      }
      if (capabilities.vision !== undefined && model.capabilities.vision !== capabilities.vision) {
        return false;
      }
      if (capabilities.codeGeneration !== undefined && model.capabilities.codeGeneration !== capabilities.codeGeneration) {
        return false;
      }
      if (capabilities.analysis !== undefined && model.capabilities.analysis !== capabilities.analysis) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get cheapest model by provider
   */
  async getCheapest(
    provider?: AIProvider,
    maxContextLength?: number
  ): Promise<Model | undefined> {
    let models = await this.list();

    if (provider) {
      models = { ...models, models: models.models.filter((m) => m.provider === provider) };
    }

    if (maxContextLength) {
      models = {
        ...models,
        models: models.models.filter((m) => m.contextLength <= maxContextLength),
      };
    }

    return models.models
      .filter((m) => m.pricing)
      .sort((a, b) => {
        const aCost = (a.pricing?.inputCostPer1K || 0) + (a.pricing?.outputCostPer1K || 0);
        const bCost = (b.pricing?.inputCostPer1K || 0) + (b.pricing?.outputCostPer1K || 0);
        return aCost - bCost;
      })[0];
  }

  /**
   * Get model with largest context window
   */
  async getLargestContext(provider?: AIProvider): Promise<Model | undefined> {
    let models = await this.list();

    if (provider) {
      models = { ...models, models: models.models.filter((m) => m.provider === provider) };
    }

    return models.models.sort((a, b) => b.contextLength - a.contextLength)[0];
  }
}
