/**
 * Model Registry Durable Object
 * Manages model versions, metadata, and lifecycle
 */

import type {
  FineTunedModel,
  ModelStatus,
  ModelMetrics,
  DeploymentInfo,
  ModelProvider,
  PaginatedResponse,
  FilterParams,
  Env,
} from '../types';

// ============================================================================
// Model Registry Durable Object
// ============================================================================

export interface ModelRegistryState {
  models: Map<string, FineTunedModel>;
  deployments: Map<string, DeploymentInfo>;
  index: {
    byStatus: Map<ModelStatus, Set<string>>;
    byProvider: Map<ModelProvider, Set<string>>;
    byDataset: Map<string, Set<string>>;
    byTag: Map<string, Set<string>>;
  };
}

export class ModelRegistryDO {
  private state: DurableObjectState;
  private env: Env;
  private registry: ModelRegistryState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.registry = {
      models: new Map(),
      deployments: new Map(),
      index: {
        byStatus: new Map(),
        byProvider: new Map(),
        byDataset: new Map(),
        byTag: new Map(),
      },
    };
  }

  /**
   * Initialize the registry from storage
   */
  async initialize(): Promise<void> {
    const stored = await this.state.storage.get<ModelRegistryState>('registry');
    if (stored) {
      this.registry = stored;
      // Convert Maps back from plain objects
      this.registry.models = new Map(Object.entries(stored.models as any));
      this.registry.deployments = new Map(Object.entries(stored.deployments as any));
      this.restoreIndexes();
    }
  }

  /**
   * Register a new model
   */
  async registerModel(model: FineTunedModel): Promise<FineTunedModel> {
    // Validate model data
    this.validateModel(model);

    // Check if model ID already exists
    if (this.registry.models.has(model.id)) {
      throw new Error(`Model ${model.id} already exists`);
    }

    // Set timestamps
    const now = Date.now();
    model.createdAt = now;
    model.updatedAt = now;

    // Add to registry
    this.registry.models.set(model.id, model);

    // Update indexes
    this.updateIndexes(model);

    // Persist to storage
    await this.persist();

    // Log to database
    await this.logModelToDatabase(model, 'registered');

    return model;
  }

  /**
   * Update an existing model
   */
  async updateModel(
    modelId: string,
    updates: Partial<Omit<FineTunedModel, 'id' | 'createdAt'>>
  ): Promise<FineTunedModel> {
    const model = this.registry.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Remove from old indexes
    this.removeFromIndexes(model);

    // Apply updates
    const updated = {
      ...model,
      ...updates,
      id: model.id, // Ensure ID doesn't change
      createdAt: model.createdAt, // Ensure createdAt doesn't change
      updatedAt: Date.now(),
    };

    // Re-validate
    this.validateModel(updated);

    // Update registry
    this.registry.models.set(modelId, updated);

    // Update indexes
    this.updateIndexes(updated);

    // Persist
    await this.persist();

    // Log to database
    await this.logModelToDatabase(updated, 'updated');

    return updated;
  }

  /**
   * Get a model by ID
   */
  async getModel(modelId: string): Promise<FineTunedModel | undefined> {
    return this.registry.models.get(modelId);
  }

  /**
   * Delete a model
   */
  async deleteModel(modelId: string): Promise<void> {
    const model = this.registry.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Check if model is deployed
    if (model.deployment?.status === 'active') {
      throw new Error(`Cannot delete deployed model ${modelId}. Undeploy first.`);
    }

    // Remove from indexes
    this.removeFromIndexes(model);

    // Remove from registry
    this.registry.models.delete(modelId);

    // Remove deployment info
    this.registry.deployments.delete(modelId);

    // Persist
    await this.persist();

    // Log to database
    await this.logModelToDatabase(model, 'deleted');
  }

  /**
   * List models with filtering and pagination
   */
  async listModels(
    filter?: FilterParams,
    pagination?: { page: number; pageSize: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }
  ): Promise<PaginatedResponse<FineTunedModel>> {
    let models = Array.from(this.registry.models.values());

    // Apply filters
    if (filter?.status) {
      const statusModels = this.registry.index.byStatus.get(filter.status as ModelStatus);
      if (statusModels) {
        models = models.filter(m => statusModels.has(m.id));
      } else {
        models = [];
      }
    }

    if (filter?.provider) {
      const providerModels = this.registry.index.byProvider.get(filter.provider);
      if (providerModels) {
        models = models.filter(m => providerModels.has(m.id));
      } else {
        models = [];
      }
    }

    if (filter?.tags && filter.tags.length > 0) {
      models = models.filter(m =>
        filter.tags!.some(tag => m.tags.includes(tag))
      );
    }

    if (filter?.dateFrom) {
      models = models.filter(m => m.createdAt >= filter.dateFrom!);
    }

    if (filter?.dateTo) {
      models = models.filter(m => m.createdAt <= filter.dateTo!);
    }

    // Sort
    const sortBy = pagination?.sortBy || 'createdAt';
    const sortOrder = pagination?.sortOrder || 'desc';
    models.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Paginate
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const paginatedModels = models.slice(offset, offset + pageSize);

    return {
      data: paginatedModels,
      pagination: {
        page,
        pageSize,
        totalItems: models.length,
        totalPages: Math.ceil(models.length / pageSize),
        hasNext: offset + pageSize < models.length,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Update model status
   */
  async updateModelStatus(modelId: string, status: ModelStatus): Promise<FineTunedModel> {
    return this.updateModel(modelId, { status });
  }

  /**
   * Update model metrics
   */
  async updateModelMetrics(modelId: string, metrics: ModelMetrics): Promise<FineTunedModel> {
    return this.updateModel(modelId, { metrics });
  }

  /**
   * Deploy a model
   */
  async deployModel(
    modelId: string,
    config?: { endpoint?: string; region?: string }
  ): Promise<DeploymentInfo> {
    const model = this.registry.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (model.status !== 'available') {
      throw new Error(`Cannot deploy model with status: ${model.status}`);
    }

    const deployment: DeploymentInfo = {
      status: 'pending',
      endpoint: config?.endpoint || `https://api.claudeflare.com/models/${modelId}`,
      deployedAt: Date.now(),
      requestCount: 0,
    };

    // Store deployment info
    this.registry.deployments.set(modelId, deployment);

    // Update model
    await this.updateModel(modelId, {
      status: 'deploying',
      deployment,
    });

    // Simulate deployment (in production, this would trigger actual deployment)
    setTimeout(async () => {
      deployment.status = 'active';
      await this.updateModel(modelId, {
        status: 'deployed',
        deployment,
      });
    }, 5000);

    return deployment;
  }

  /**
   * Undeploy a model
   */
  async undeployModel(modelId: string): Promise<void> {
    const model = this.registry.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (!model.deployment || model.deployment.status !== 'active') {
      throw new Error(`Model ${modelId} is not deployed`);
    }

    // Update deployment status
    model.deployment.status = 'inactive';

    // Update model
    await this.updateModel(modelId, {
      status: 'available',
      deployment: model.deployment,
    });
  }

  /**
   * Get deployment info
   */
  async getDeploymentInfo(modelId: string): Promise<DeploymentInfo | undefined> {
    return this.registry.deployments.get(modelId);
  }

  /**
   * Compare models
   */
  async compareModels(modelIds: string[]): Promise<{
    models: FineTunedModel[];
    comparison: {
      bestByLoss?: string;
      bestByAccuracy?: string;
      newest?: string;
      smallest?: string;
    };
  }> {
    const models = modelIds
      .map(id => this.registry.models.get(id))
      .filter((m): m is FineTunedModel => m !== undefined);

    if (models.length === 0) {
      throw new Error('No valid models found');
    }

    const comparison: any = {};

    // Compare by loss
    const modelsWithLoss = models.filter(m => m.metrics?.loss !== undefined);
    if (modelsWithLoss.length > 0) {
      const best = modelsWithLoss.reduce((best, current) =>
        (current.metrics!.loss! < best.metrics!.loss!) ? current : best
      );
      comparison.bestByLoss = best.id;
    }

    // Compare by accuracy
    const modelsWithAccuracy = models.filter(m => m.metrics?.accuracy !== undefined);
    if (modelsWithAccuracy.length > 0) {
      const best = modelsWithAccuracy.reduce((best, current) =>
        (current.metrics!.accuracy! > best.metrics!.accuracy!) ? current : best
      );
      comparison.bestByAccuracy = best.id;
    }

    // Compare by age
    const newest = models.reduce((newest, current) =>
      (current.createdAt > newest.createdAt) ? current : newest
    );
    comparison.newest = newest.id;

    return { models, comparison };
  }

  /**
   * Search models by name or description
   */
  async searchModels(query: string): Promise<FineTunedModel[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.registry.models.values()).filter(
      m =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.description?.toLowerCase().includes(lowerQuery) ||
        m.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get models by dataset
   */
  async getModelsByDataset(datasetId: string): Promise<FineTunedModel[]> {
    const datasetModels = this.registry.index.byDataset.get(datasetId);
    if (!datasetModels) return [];

    return Array.from(datasetModels)
      .map(id => this.registry.models.get(id))
      .filter((m): m is FineTunedModel => m !== undefined);
  }

  /**
   * Get model versions for a base model
   */
  async getModelVersions(baseModel: string): Promise<FineTunedModel[]> {
    return Array.from(this.registry.models.values()).filter(
      m => m.baseModel === baseModel
    ).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get model statistics
   */
  async getStatistics(): Promise<{
    totalModels: number;
    byStatus: Record<ModelStatus, number>;
    byProvider: Record<ModelProvider, number>;
    deployedModels: number;
    totalDeployments: number;
  }> {
    const models = Array.from(this.registry.models.values());

    const byStatus = {} as Record<ModelStatus, number>;
    for (const status of ['available', 'training', 'deploying', 'deployed', 'failed', 'archived']) {
      byStatus[status as ModelStatus] = models.filter(m => m.status === status).length;
    }

    const byProvider = {} as Record<ModelProvider, number>;
    for (const provider of ['openai', 'anthropic', 'cohere', 'custom']) {
      byProvider[provider as ModelProvider] = models.filter(m => m.config.provider === provider).length;
    }

    const deployedModels = models.filter(m => m.deployment?.status === 'active').length;

    return {
      totalModels: models.length,
      byStatus,
      byProvider,
      deployedModels,
      totalDeployments: this.registry.deployments.size,
    };
  }

  /**
   * Archive old models
   */
  async archiveModels(olderThan: number): Promise<number> {
    const cutoff = Date.now() - olderThan;
    let archived = 0;

    for (const [id, model] of this.registry.models) {
      if (model.status === 'available' && model.createdAt < cutoff) {
        // Don't archive deployed models
        if (model.deployment?.status !== 'active') {
          await this.updateModelStatus(id, 'archived');
          archived++;
        }
      }
    }

    return archived;
  }

  /**
   * Clean up failed models
   */
  async cleanupFailedModels(olderThan: number): Promise<number> {
    const cutoff = Date.now() - olderThan;
    let cleaned = 0;

    const toDelete: string[] = [];

    for (const [id, model] of this.registry.models) {
      if (model.status === 'failed' && model.createdAt < cutoff) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      try {
        await this.deleteModel(id);
        cleaned++;
      } catch (error) {
        // Log error but continue
        console.error(`Failed to delete model ${id}:`, error);
      }
    }

    return cleaned;
  }

  /**
   * Export model registry
   */
  async exportRegistry(): Promise<string> {
    const data = {
      models: Array.from(this.registry.models.entries()),
      deployments: Array.from(this.registry.deployments.entries()),
      exportedAt: Date.now(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import model registry
   */
  async importRegistry(data: string): Promise<void> {
    const imported = JSON.parse(data);

    for (const [id, model] of imported.models) {
      this.registry.models.set(id, model as FineTunedModel);
    }

    for (const [id, deployment] of imported.deployments) {
      this.registry.deployments.set(id, deployment as DeploymentInfo);
    }

    // Rebuild indexes
    this.rebuildIndexes();

    // Persist
    await this.persist();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateModel(model: FineTunedModel): void {
    if (!model.id || typeof model.id !== 'string') {
      throw new Error('Invalid model ID');
    }

    if (!model.name || typeof model.name !== 'string') {
      throw new Error('Invalid model name');
    }

    if (!model.baseModel || typeof model.baseModel !== 'string') {
      throw new Error('Invalid base model');
    }

    if (!this.isValidStatus(model.status)) {
      throw new Error(`Invalid model status: ${model.status}`);
    }

    if (!this.isValidProvider(model.config.provider)) {
      throw new Error(`Invalid model provider: ${model.config.provider}`);
    }
  }

  private isValidStatus(status: string): status is ModelStatus {
    return ['available', 'training', 'deploying', 'deployed', 'failed', 'archived']
      .includes(status);
  }

  private isValidProvider(provider: string): provider is ModelProvider {
    return ['openai', 'anthropic', 'cohere', 'custom'].includes(provider);
  }

  private updateIndexes(model: FineTunedModel): void {
    // Status index
    if (!this.registry.index.byStatus.has(model.status)) {
      this.registry.index.byStatus.set(model.status, new Set());
    }
    this.registry.index.byStatus.get(model.status)!.add(model.id);

    // Provider index
    if (!this.registry.index.byProvider.has(model.config.provider)) {
      this.registry.index.byProvider.set(model.config.provider, new Set());
    }
    this.registry.index.byProvider.get(model.config.provider)!.add(model.id);

    // Dataset index
    if (!this.registry.index.byDataset.has(model.datasetId)) {
      this.registry.index.byDataset.set(model.datasetId, new Set());
    }
    this.registry.index.byDataset.get(model.datasetId)!.add(model.id);

    // Tag indexes
    for (const tag of model.tags) {
      if (!this.registry.index.byTag.has(tag)) {
        this.registry.index.byTag.set(tag, new Set());
      }
      this.registry.index.byTag.get(tag)!.add(model.id);
    }
  }

  private removeFromIndexes(model: FineTunedModel): void {
    // Status index
    this.registry.index.byStatus.get(model.status)?.delete(model.id);

    // Provider index
    this.registry.index.byProvider.get(model.config.provider)?.delete(model.id);

    // Dataset index
    this.registry.index.byDataset.get(model.datasetId)?.delete(model.id);

    // Tag indexes
    for (const tag of model.tags) {
      this.registry.index.byTag.get(tag)?.delete(model.id);
    }
  }

  private rebuildIndexes(): void {
    // Clear existing indexes
    this.registry.index = {
      byStatus: new Map(),
      byProvider: new Map(),
      byDataset: new Map(),
      byTag: new Map(),
    };

    // Rebuild from models
    for (const model of this.registry.models.values()) {
      this.updateIndexes(model);
    }
  }

  private restoreIndexes(): void {
    // Convert plain objects back to Maps
    const byStatus = this.registry.index.byStatus as any;
    const byProvider = this.registry.index.byProvider as any;
    const byDataset = this.registry.index.byDataset as any;
    const byTag = this.registry.index.byTag as any;

    this.registry.index.byStatus = new Map(
      Object.entries(byStatus).map(([k, v]) => [k, new Set(v as Set<string>)])
    );
    this.registry.index.byProvider = new Map(
      Object.entries(byProvider).map(([k, v]) => [k, new Set(v as Set<string>)])
    );
    this.registry.index.byDataset = new Map(
      Object.entries(byDataset).map(([k, v]) => [k, new Set(v as Set<string>)])
    );
    this.registry.index.byTag = new Map(
      Object.entries(byTag).map(([k, v]) => [k, new Set(v as Set<string>)])
    );
  }

  private async persist(): Promise<void> {
    await this.state.storage.put('registry', {
      models: Object.fromEntries(this.registry.models),
      deployments: Object.fromEntries(this.registry.deployments),
      index: this.serializeIndexes(),
    } as any);
  }

  private serializeIndexes(): any {
    return {
      byStatus: Object.fromEntries(
        Array.from(this.registry.index.byStatus.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      byProvider: Object.fromEntries(
        Array.from(this.registry.index.byProvider.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      byDataset: Object.fromEntries(
        Array.from(this.registry.index.byDataset.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      byTag: Object.fromEntries(
        Array.from(this.registry.index.byTag.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
    };
  }

  private async logModelToDatabase(model: FineTunedModel, action: string): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO model_registry_logs (
        model_id, action, status, provider, dataset_id, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      model.id,
      action,
      model.status,
      model.config.provider,
      model.datasetId,
      Date.now()
    ).run();
  }
}

// ============================================================================
// Durable Object Export
// ============================================================================

export interface ModelRegistryDurableObject {
  fetch(request: Request): Promise<Response>;
}
