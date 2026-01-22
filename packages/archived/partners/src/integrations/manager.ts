/**
 * Integration Manager
 * High-level API for managing integrations
 */

import { IntegrationConfig, AuthConfig, Webhook, WebhookEvent } from '../types';
import { IntegrationRegistry } from './registry';
import { OAuthProviderService } from '../oauth/provider';
import { WebhookManager } from '../webhooks';
import { IntegrationMonitoringService } from '../monitoring/metrics';

export interface IntegrationInstance {
  config: IntegrationConfig;
  webhook?: Webhook;
  template: IntegrationTemplate;
  isActive: boolean;
  lastUsedAt: Date;
}

export class IntegrationManager {
  private registry: IntegrationRegistry;
  private oauthService: OAuthProviderService;
  private webhookManager: WebhookManager;
  private monitoringService: IntegrationMonitoringService;
  private instances: Map<string, IntegrationInstance> = new Map();

  constructor() {
    this.registry = new IntegrationRegistry();
    this.oauthService = new OAuthProviderService();
    this.webhookManager = new WebhookManager();
    this.monitoringService = new IntegrationMonitoringService();
  }

  /**
   * Create integration instance
   */
  public async createIntegration(config: {
    partnerId: string;
    userId: string;
    workspaceId: string;
    name: string;
    authConfig: AuthConfig;
    webhookConfig?: {
      url: string;
      events: string[];
      headers?: Record<string, string>;
    };
    settings?: Record<string, unknown>;
  }): Promise<IntegrationInstance> {
    const template = this.registry.get(config.partnerId);
    if (!template) {
      throw new Error(`Integration template not found: ${config.partnerId}`);
    }

    const integrationConfig: IntegrationConfig = {
      id: crypto.randomUUID(),
      partnerId: config.partnerId,
      userId: config.userId,
      workspaceId: config.workspaceId,
      name: config.name,
      enabled: true,
      authConfig: config.authConfig,
      settings: config.settings || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    let webhook: Webhook | undefined;

    // Create webhook if configured
    if (config.webhookConfig) {
      webhook = await this.webhookManager.createWebhook({
        partnerId: config.partnerId,
        integrationId: integrationConfig.id,
        url: config.webhookConfig.url,
        events: config.webhookConfig.events,
        headers: config.webhookConfig.headers
      });

      integrationConfig.webhookConfig = {
        url: webhook.url,
        secret: webhook.secret,
        events: webhook.events,
        headers: webhook.headers
      };
    }

    const instance: IntegrationInstance = {
      config: integrationConfig,
      webhook,
      template,
      isActive: true,
      lastUsedAt: new Date()
    };

    this.instances.set(integrationConfig.id, instance);

    return instance;
  }

  /**
   * Get integration instance
   */
  public getIntegration(integrationId: string): IntegrationInstance | undefined {
    return this.instances.get(integrationId);
  }

  /**
   * Get integrations by user
   */
  public getIntegrationsByUser(userId: string): IntegrationInstance[] {
    return Array.from(this.instances.values()).filter(
      i => i.config.userId === userId
    );
  }

  /**
   * Get integrations by workspace
   */
  public getIntegrationsByWorkspace(workspaceId: string): IntegrationInstance[] {
    return Array.from(this.instances.values()).filter(
      i => i.config.workspaceId === workspaceId
    );
  }

  /**
   * Get integrations by partner
   */
  public getIntegrationsByPartner(partnerId: string): IntegrationInstance[] {
    return Array.from(this.instances.values()).filter(
      i => i.config.partnerId === partnerId
    );
  }

  /**
   * Enable integration
   */
  public enableIntegration(integrationId: string): void {
    const instance = this.instances.get(integrationId);
    if (instance) {
      instance.config.enabled = true;
      instance.isActive = true;
      instance.config.updatedAt = new Date();
    }
  }

  /**
   * Disable integration
   */
  public disableIntegration(integrationId: string): void {
    const instance = this.instances.get(integrationId);
    if (instance) {
      instance.config.enabled = false;
      instance.isActive = false;
      instance.config.updatedAt = new Date();
    }
  }

  /**
   * Update integration settings
   */
  public updateIntegrationSettings(
    integrationId: string,
    settings: Record<string, unknown>
  ): void {
    const instance = this.instances.get(integrationId);
    if (instance) {
      instance.config.settings = { ...instance.config.settings, ...settings };
      instance.config.updatedAt = new Date();
    }
  }

  /**
   * Delete integration
   */
  public deleteIntegration(integrationId: string): void {
    this.instances.delete(integrationId);
  }

  /**
   * Refresh auth token
   */
  public async refreshAuthToken(integrationId: string): Promise<void> {
    const instance = this.instances.get(integrationId);
    if (!instance) {
      throw new Error('Integration not found');
    }

    const token = instance.config.authConfig.credentials as { token_id?: string };
    if (token.token_id) {
      const newToken = await this.oauthService.refreshToken(token.token_id);
      instance.config.authConfig.credentials = {
        ...instance.config.authConfig.credentials,
        access_token: newToken.accessToken,
        expires_at: newToken.expiresAt
      };
      instance.config.updatedAt = new Date();
    }
  }

  /**
   * Execute integration action
   */
  public async executeAction(
    integrationId: string,
    actionId: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    const instance = this.instances.get(integrationId);
    if (!instance) {
      throw new Error('Integration not found');
    }

    if (!instance.config.enabled) {
      throw new Error('Integration is disabled');
    }

    const action = instance.template.actions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }

    const startTime = Date.now();

    try {
      // Execute action (would be implemented by specific integration client)
      const result = await this.executeActionRequest(instance, action, input);

      const duration = Date.now() - startTime;

      // Record metrics
      this.monitoringService.recordAPICall(
        instance.config.partnerId,
        integrationId,
        true,
        duration
      );

      instance.lastUsedAt = new Date();
      instance.config.lastUsedAt = new Date();

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failed metrics
      this.monitoringService.recordAPICall(
        instance.config.partnerId,
        integrationId,
        false,
        duration
      );

      throw error;
    }
  }

  /**
   * Execute action request
   */
  private async executeActionRequest(
    instance: IntegrationInstance,
    action: import('../types').TemplateAction,
    input: Record<string, unknown>
  ): Promise<unknown> {
    // This would be implemented by specific integration clients
    // For now, return a mock response
    return {
      success: true,
      action: action.id,
      input
    };
  }

  /**
   * Trigger webhook event
   */
  public async triggerWebhook(
    integrationId: string,
    eventType: string,
    data: unknown
  ): Promise<void> {
    const instance = this.instances.get(integrationId);
    if (!instance || !instance.webhook) {
      return;
    }

    if (!instance.config.enabled) {
      return;
    }

    await this.webhookManager.deliverEvent(instance.webhook, eventType, data);

    instance.lastUsedAt = new Date();
  }

  /**
   * Get integration metrics
   */
  public getMetrics(integrationId: string) {
    const instance = this.instances.get(integrationId);
    if (!instance) {
      throw new Error('Integration not found');
    }

    return this.monitoringService.getAggregatedMetrics(
      instance.config.partnerId,
      integrationId
    );
  }

  /**
   * Get integration health
   */
  public async getHealth(integrationId: string) {
    const instance = this.instances.get(integrationId);
    if (!instance) {
      throw new Error('Integration not found');
    }

    return this.monitoringService.getHealth(integrationId);
  }

  /**
   * Get integration alerts
   */
  public getAlerts(integrationId: string) {
    return this.monitoringService.getAlerts(integrationId);
  }

  /**
   * List available templates
   */
  public listTemplates(): IntegrationTemplate[] {
    return this.registry.getAll();
  }

  /**
   * Get template
   */
  public getTemplate(partnerId: string): IntegrationTemplate | undefined {
    return this.registry.get(partnerId);
  }

  /**
   * Search templates
   */
  public searchTemplates(query: string): IntegrationTemplate[] {
    return this.registry.search(query);
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(category: string): IntegrationTemplate[] {
    return this.registry.getByCategory(category);
  }

  /**
   * Test integration connection
   */
  public async testConnection(integrationId: string): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    const instance = this.instances.get(integrationId);
    if (!instance) {
      throw new Error('Integration not found');
    }

    const startTime = Date.now();

    try {
      // Perform test request based on template
      // For now, just check if auth config exists
      if (!instance.config.authConfig || Object.keys(instance.config.authConfig).length === 0) {
        return {
          success: false,
          message: 'No authentication configured'
        };
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        message: 'Connection successful',
        latency
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  /**
   * Get integration statistics
   */
  public getStatistics(): {
    totalIntegrations: number;
    activeIntegrations: number;
    integrationsByPartner: Record<string, number>;
    integrationsByCategory: Record<string, number>;
  } {
    const instances = Array.from(this.instances.values());

    const integrationsByPartner: Record<string, number> = {};
    const integrationsByCategory: Record<string, number> = {};

    for (const instance of instances) {
      integrationsByPartner[instance.config.partnerId] =
        (integrationsByPartner[instance.config.partnerId] || 0) + 1;

      integrationsByCategory[instance.template.category] =
        (integrationsByCategory[instance.template.category] || 0) + 1;
    }

    return {
      totalIntegrations: instances.length,
      activeIntegrations: instances.filter(i => i.isActive).length,
      integrationsByPartner,
      integrationsByCategory
    };
  }

  /**
   * Sync integration data
   */
  public async syncIntegration(integrationId: string): Promise<void> {
    const instance = this.instances.get(integrationId);
    if (!instance) {
      throw new Error('Integration not found');
    }

    if (!instance.config.syncSettings?.enabled) {
      return;
    }

    const now = new Date();

    // Check if sync is needed
    if (instance.config.syncSettings.lastSyncAt) {
      const interval = instance.config.syncSettings.interval || 3600000; // 1 hour default
      const timeSinceLastSync = now.getTime() - instance.config.syncSettings.lastSyncAt.getTime();

      if (timeSinceLastSync < interval) {
        return; // Not time to sync yet
      }
    }

    // Perform sync (would be implemented by specific integration)
    instance.config.syncSettings.lastSyncAt = now;

    // Calculate next sync
    if (instance.config.syncSettings.interval) {
      instance.config.syncSettings.nextSyncAt = new Date(
        now.getTime() + instance.config.syncSettings.interval
      );
    }

    instance.config.updatedAt = now;
  }
}

import { IntegrationTemplate } from '../types';
