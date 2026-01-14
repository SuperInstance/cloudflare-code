/**
 * Webhook Manager - handles webhook registration, validation, and lifecycle
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Webhook,
  WebhookEventType,
  WebhookStatistics,
} from '../types/webhook.js';
import type { IWebhookStorage, IKVStorage } from '../types/storage.js';
import type { WebhookSystemConfig } from '../types/config.js';
import {
  InvalidWebhookConfigError,
  WebhookNotFoundError,
  InvalidWebhookURLError,
  SerializationError,
} from '../types/errors.js';
import { WebhookSchema } from '../types/webhook.js';
import { SecurityLayer } from '../security/layer.js';

/**
 * Webhook creation options
 */
export interface CreateWebhookOptions {
  name: string;
  description?: string;
  userId: string;
  projectId?: string;
  url: string;
  httpMethod?: 'POST' | 'PUT' | 'PATCH';
  events: WebhookEventType[];
  headers?: Record<string, string>;
  secret?: string;
  signatureAlgorithm?: string;
  priority?: number;
  timeout?: number;
  retryConfig?: any;
  rateLimit?: any;
  filters?: any[];
  template?: any;
  metadata?: Record<string, unknown>;
  active?: boolean;
}

/**
 * Webhook update options
 */
export interface UpdateWebhookOptions {
  name?: string;
  description?: string;
  url?: string;
  httpMethod?: 'POST' | 'PUT' | 'PATCH';
  events?: WebhookEventType[];
  headers?: Record<string, string>;
  secret?: string;
  signatureAlgorithm?: string;
  priority?: number;
  timeout?: number;
  retryConfig?: any;
  rateLimit?: any;
  filters?: any[];
  template?: any;
  metadata?: Record<string, unknown>;
  active?: boolean;
}

/**
 * Webhook list options
 */
export interface ListWebhooksOptions {
  userId?: string;
  projectId?: string;
  eventType?: WebhookEventType;
  active?: boolean;
  skip?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Webhook Manager class
 */
export class WebhookManager {
  private config: WebhookSystemConfig;
  private storage: IWebhookStorage;
  private kvStorage: IKVStorage;
  private securityLayer: SecurityLayer;
  private cache: Map<string, { webhook: Webhook; expires: number }>;

  constructor(
    config: WebhookSystemConfig,
    storage: IWebhookStorage,
    kvStorage: IKVStorage,
    securityLayer: SecurityLayer
  ) {
    this.config = config;
    this.storage = storage;
    this.kvStorage = kvStorage;
    this.securityLayer = securityLayer;
    this.cache = new Map();
  }

  /**
   * Create a new webhook
   */
  public async create(options: CreateWebhookOptions): Promise<Webhook> {
    // Validate webhook configuration
    const validation = await this.validateConfig(options);
    if (!validation.valid) {
      throw new InvalidWebhookConfigError(
        `Invalid webhook configuration: ${validation.errors.join(', ')}`
      );
    }

    // Validate URL
    this.securityLayer.validateURL(options.url);

    // Generate or validate secret
    const secret = options.secret || await SecurityLayer.generateSecret();
    if (!SecurityLayer.validateSecret(secret)) {
      throw new InvalidWebhookConfigError(
        'Webhook secret must be at least 32 characters with mixed character types'
      );
    }

    // Create webhook object
    const webhook: Omit<Webhook, 'id' | 'createdAt' | 'updatedAt' | 'statistics'> = {
      name: options.name,
      description: options.description,
      userId: options.userId,
      projectId: options.projectId,
      url: options.url,
      httpMethod: options.httpMethod || 'POST',
      events: options.events,
      headers: options.headers,
      secret,
      signatureAlgorithm: (options.signatureAlgorithm as any) ||
        this.config.defaultSignatureAlgorithm,
      active: options.active !== false,
      priority: options.priority || 2,
      timeout: options.timeout || this.config.defaultTimeout,
      retryConfig: options.retryConfig || this.getDefaultRetryConfig(),
      rateLimit: options.rateLimit,
      filters: options.filters,
      template: options.template,
      metadata: options.metadata,
    };

    // Save to storage
    const created = await this.storage.create(webhook);

    // Invalidate cache
    await this.invalidateCache(created.userId);

    return created;
  }

  /**
   * Get a webhook by ID
   */
  public async getById(id: string): Promise<Webhook> {
    // Check cache first
    const cached = this.getFromCache(id);
    if (cached) {
      return cached;
    }

    const webhook = await this.storage.getById(id);
    if (!webhook) {
      throw new WebhookNotFoundError(id);
    }

    // Cache the webhook
    this.setToCache(id, webhook);

    return webhook;
  }

  /**
   * Get webhooks by user ID
   */
  public async getByUserId(
    userId: string,
    options?: { skip?: number; limit?: number }
  ): Promise<Webhook[]> {
    return this.storage.getByUserId(userId, options);
  }

  /**
   * Get webhooks by project ID
   */
  public async getByProjectId(
    projectId: string,
    options?: { skip?: number; limit?: number }
  ): Promise<Webhook[]> {
    return this.storage.getByProjectId(projectId, options);
  }

  /**
   * Get webhooks by event type
   */
  public async getByEventType(
    eventType: string,
    options?: { skip?: number; limit?: number }
  ): Promise<Webhook[]> {
    return this.storage.getByEventType(eventType, options);
  }

  /**
   * List webhooks with filters
   */
  public async list(options?: ListWebhooksOptions): Promise<{
    items: Webhook[];
    total: number;
    skip: number;
    limit: number;
  }> {
    const result = await this.storage.list({
      skip: options?.skip || 0,
      limit: options?.limit || 50,
      sortBy: options?.sortBy || 'createdAt',
      sortOrder: options?.sortOrder || 'desc',
    });

    let items = result.items;

    // Apply filters
    if (options?.userId) {
      items = items.filter(w => w.userId === options.userId);
    }
    if (options?.projectId) {
      items = items.filter(w => w.projectId === options.projectId);
    }
    if (options?.eventType) {
      items = items.filter(w => w.events.includes(options.eventType));
    }
    if (options?.active !== undefined) {
      items = items.filter(w => w.active === options.active);
    }

    return {
      items,
      total: items.length,
      skip: options?.skip || 0,
      limit: options?.limit || 50,
    };
  }

  /**
   * Update a webhook
   */
  public async update(id: string, options: UpdateWebhookOptions): Promise<Webhook> {
    const existing = await this.getById(id);

    // Validate updates
    if (options.url) {
      this.securityLayer.validateURL(options.url);
    }

    if (options.secret && !SecurityLayer.validateSecret(options.secret)) {
      throw new InvalidWebhookConfigError(
        'Webhook secret must be at least 32 characters with mixed character types'
      );
    }

    if (options.events && options.events.length === 0) {
      throw new InvalidWebhookConfigError(
        'Webhook must have at least one event type'
      );
    }

    // Build update object
    const updates: Partial<Webhook> = {
      ...options,
      updatedAt: new Date(),
    };

    // Apply updates
    const updated = await this.storage.update(id, updates);

    // Invalidate cache
    this.removeFromCache(id);
    await this.invalidateCache(existing.userId);

    return updated;
  }

  /**
   * Delete a webhook
   */
  public async delete(id: string): Promise<boolean> {
    const webhook = await this.getById(id);
    const result = await this.storage.delete(id);

    if (result) {
      // Invalidate cache
      this.removeFromCache(id);
      await this.invalidateCache(webhook.userId);
    }

    return result;
  }

  /**
   * Activate a webhook
   */
  public async activate(id: string): Promise<Webhook> {
    const webhook = await this.getById(id);

    if (webhook.active) {
      return webhook;
    }

    const activated = await this.storage.activate(id);

    // Invalidate cache
    this.removeFromCache(id);
    await this.invalidateCache(webhook.userId);

    return activated;
  }

  /**
   * Deactivate a webhook
   */
  public async deactivate(id: string): Promise<Webhook> {
    const webhook = await this.getById(id);

    if (!webhook.active) {
      return webhook;
    }

    const deactivated = await this.storage.deactivate(id);

    // Invalidate cache
    this.removeFromCache(id);
    await this.invalidateCache(webhook.userId);

    return deactivated;
  }

  /**
   * Validate webhook configuration
   */
  public async validateConfig(options: CreateWebhookOptions): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate name
    if (!options.name || options.name.trim().length === 0) {
      errors.push('Webhook name is required');
    } else if (options.name.length > 255) {
      errors.push('Webhook name must be less than 255 characters');
    }

    // Validate URL
    try {
      this.securityLayer.validateURL(options.url);
    } catch (error) {
      if (error instanceof InvalidWebhookURLError) {
        errors.push(error.message);
      }
    }

    // Validate events
    if (!options.events || options.events.length === 0) {
      errors.push('At least one event type must be specified');
    }

    // Validate timeout
    if (options.timeout !== undefined) {
      if (options.timeout < 100 || options.timeout > this.config.maxTimeout) {
        errors.push(
          `Timeout must be between 100ms and ${this.config.maxTimeout}ms`
        );
      }
    }

    // Validate secret if provided
    if (options.secret && !SecurityLayer.validateSecret(options.secret)) {
      errors.push(
        'Secret must be at least 32 characters with mixed character types'
      );
    }

    // Warnings
    if (options.retryConfig?.maxRetries > 5) {
      warnings.push('High retry count may cause delivery delays');
    }

    if (options.rateLimit?.enabled && options.rateLimit.maxRequests > 1000) {
      warnings.push('High rate limit may overwhelm receiving endpoint');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Regenerate webhook secret
   */
  public async regenerateSecret(id: string): Promise<{ secret: string }> {
    const webhook = await this.getById(id);

    const newSecret = await SecurityLayer.generateSecret();

    await this.storage.update(id, {
      secret: newSecret,
      updatedAt: new Date(),
    });

    // Invalidate cache
    this.removeFromCache(id);

    return { secret: newSecret };
  }

  /**
   * Get webhook statistics
   */
  public async getStatistics(id: string): Promise<WebhookStatistics> {
    const webhook = await this.getById(id);
    return webhook.statistics;
  }

  /**
   * Update webhook statistics
   */
  public async updateStatistics(
    id: string,
    stats: Partial<WebhookStatistics>
  ): Promise<void> {
    await this.storage.updateStatistics(id, stats);

    // Invalidate cache
    this.removeFromCache(id);
  }

  /**
   * Get active webhooks for an event type
   */
  public async getActiveForEvent(eventType: string): Promise<Webhook[]> {
    const allActive = await this.storage.getActive();
    return allActive.filter(w => w.events.includes(eventType as WebhookEventType));
  }

  /**
   * Test webhook endpoint
   */
  public async testEndpoint(id: string): Promise<{
    success: boolean;
    statusCode?: number;
    responseTime: number;
    error?: string;
  }> {
    const webhook = await this.getById(id);

    const startTime = Date.now();

    try {
      const response = await fetch(webhook.url, {
        method: webhook.httpMethod,
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Test': 'true',
          ...(webhook.headers || {}),
        },
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(Math.min(webhook.timeout, 10000)),
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get default retry configuration
   */
  private getDefaultRetryConfig() {
    return {
      enabled: true,
      strategy: 'exponential_backoff',
      maxRetries: this.config.retry.maxAttempts,
      initialDelay: this.config.retry.initialDelayMs,
      maxDelay: this.config.retry.maxDelayMs,
      backoffMultiplier: this.config.retry.backoffMultiplier,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    };
  }

  /**
   * Cache helpers
   */
  private getFromCache(id: string): Webhook | null {
    const cached = this.cache.get(id);
    if (cached && cached.expires > Date.now()) {
      return cached.webhook;
    }
    this.cache.delete(id);
    return null;
  }

  private setToCache(id: string, webhook: Webhook, ttl: number = 60000): void {
    this.cache.set(id, {
      webhook,
      expires: Date.now() + ttl,
    });
  }

  private removeFromCache(id: string): void {
    this.cache.delete(id);
  }

  private async invalidateCache(userId: string): Promise<void> {
    // Clear all user's webhooks from cache
    for (const [id, cached] of this.cache.entries()) {
      if (cached.webhook.userId === userId) {
        this.cache.delete(id);
      }
    }
  }

  /**
   * Clear entire cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.cache.size;
  }
}
