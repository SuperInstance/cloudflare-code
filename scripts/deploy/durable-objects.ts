/**
 * Durable Objects Deployment Script for ClaudeFlare
 * Handles Durable Objects deployment with multi-region coordination
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type {
  DeploymentConfig,
  DeploymentContext,
  DeploymentEvent,
  DurableObjectConfig,
  DeploymentRegion,
  Environment,
  ProvisionResult,
  CloudflareAPIResponse,
} from './types.js';

/**
 * Durable Objects deployment class
 */
export class DurableObjectDeployer {
  private config: DeploymentConfig;
  private context: DeploymentContext;

  constructor(config: DeploymentConfig, context: DeploymentContext) {
    this.config = config;
    this.context = context;
  }

  /**
   * Deploy all Durable Objects
   */
  async deployObjects(configs: DurableObjectConfig[]): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: `Deploying ${configs.length} Durable Objects...`,
      timestamp: new Date(),
    });

    for (const config of configs) {
      await this.deployObject(config);
    }

    this.emitEvent({
      type: 'success',
      message: 'All Durable Objects deployed successfully',
      timestamp: new Date(),
    });
  }

  /**
   * Deploy a single Durable Object
   */
  async deployObject(config: DurableObjectConfig): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: `Deploying Durable Object: ${config.name}...`,
      timestamp: new Date(),
      resource: config.name,
    });

    // Validate configuration
    await this.validateConfig(config);

    // Update wrangler.toml with DO configuration
    await this.updateWranglerConfig(config);

    // Deploy the object
    await this.deployToCloudflare(config);

    // Verify deployment
    await this.verifyDeployment(config);

    this.emitEvent({
      type: 'success',
      message: `Durable Object ${config.name} deployed successfully`,
      timestamp: new Date(),
      resource: config.name,
    });
  }

  /**
   * Validate Durable Object configuration
   */
  private async validateConfig(config: DurableObjectConfig): Promise<void> {
    const errors: string[] = [];

    // Check required fields
    if (!config.name) {
      errors.push('Durable Object name is required');
    }

    if (!config.className) {
      errors.push('Durable Object class name is required');
    }

    if (!config.scriptPath) {
      errors.push('Durable Object script path is required');
    }

    // Check if script exists
    const fullPath = resolve(process.cwd(), config.scriptPath);
    if (!existsSync(fullPath)) {
      errors.push(`Script file not found: ${config.scriptPath}`);
    }

    // Validate regions
    if (!config.locations || config.locations.length === 0) {
      errors.push('At least one location must be specified');
    }

    const validRegions: DeploymentRegion[] = [
      'wnam', 'enam', 'weur', 'eeur', 'apac', 'latam', 'oc', 'afr', 'me'
    ];

    for (const location of config.locations) {
      if (!validRegions.includes(location)) {
        errors.push(`Invalid region: ${location}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Durable Object validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Update wrangler.toml with Durable Object configuration
   */
  private async updateWranglerConfig(config: DurableObjectConfig): Promise<void> {
    const wranglerPath = resolve(process.cwd(), 'wrangler.toml');

    if (!existsSync(wranglerPath)) {
      throw new Error('wrangler.toml not found');
    }

    this.emitEvent({
      type: 'info',
      message: 'Updating wrangler.toml with Durable Object configuration...',
      timestamp: new Date(),
      resource: config.name,
    });

    // Read existing config
    let content = readFileSync(wranglerPath, 'utf-8');

    // Add or update Durable Objects binding for the environment
    const envSection = this.config.environment === 'development'
      ? ''
      : `[env.${this.config.environment}]`;

    const doBinding = `
[[${envSection ? envSection + '.' : ''}durable_objects.bindings]]
name = "${config.name}"
class_name = "${config.className}"
`;

    // Check if binding already exists
    const bindingPattern = new RegExp(
      `\\[\\[${envSection ? envSection + '\\.' : ''}durable_objects\\.bindings\\]\\][\\s\\S]*?name\\s*=\\s*"${config.name}"`,
      'g'
    );

    if (bindingPattern.test(content)) {
      // Replace existing binding
      content = content.replace(bindingPattern, doBinding.trim());
    } else {
      // Add new binding
      const envPattern = new RegExp(`\\[env\\.${this.config.environment}\\]`);
      if (envPattern.test(content)) {
        // Add to existing environment section
        content = content.replace(
          envPattern,
          `${envPattern}\n${doBinding}`
        );
      } else {
        // Add new environment section
        content += `\n${doBinding}`;
      }
    }

    // Write updated config
    writeFileSync(wranglerPath, content, 'utf-8');

    this.emitEvent({
      type: 'success',
      message: 'wrangler.toml updated successfully',
      timestamp: new Date(),
      resource: config.name,
    });
  }

  /**
   * Deploy Durable Object to Cloudflare
   */
  private async deployToCloudflare(config: DurableObjectConfig): Promise<void> {
    const envFlag = this.config.environment !== 'development'
      ? `--env ${this.config.environment}`
      : '';

    this.emitEvent({
      type: 'info',
      message: `Deploying ${config.name} to Cloudflare...`,
      timestamp: new Date(),
      resource: config.name,
    });

    try {
      const command = `wrangler deploy ${envFlag}`;
      execSync(command, { stdio: this.config.verbose ? 'inherit' : 'pipe' });

      this.emitEvent({
        type: 'success',
        message: `${config.name} deployed to Cloudflare`,
        timestamp: new Date(),
        resource: config.name,
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: `Failed to deploy ${config.name}`,
        timestamp: new Date(),
        resource: config.name,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Verify Durable Object deployment
   */
  private async verifyDeployment(config: DurableObjectConfig): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: `Verifying ${config.name} deployment...`,
      timestamp: new Date(),
      resource: config.name,
    });

    // Wait for deployment to propagate
    await this.sleep(5000);

    // Check if DO is accessible
    const isAccessible = await this.checkObjectAccess(config);

    if (!isAccessible) {
      throw new Error(`Durable Object ${config.name} is not accessible`);
    }

    // Check DO health in each location
    const healthChecks = await this.checkObjectHealth(config);

    const allHealthy = healthChecks.every(check => check.healthy);

    if (!allHealthy) {
      const unhealthy = healthChecks.filter(check => !check.healthy);
      throw new Error(
        `Durable Object ${config.name} health check failed in locations: ${unhealthy.map(check => check.location).join(', ')}`
      );
    }

    this.emitEvent({
      type: 'success',
      message: `${config.name} verification passed`,
      timestamp: new Date(),
      resource: config.name,
      details: { healthChecks },
    });
  }

  /**
   * Check if Durable Object is accessible
   */
  private async checkObjectAccess(config: DurableObjectConfig): Promise<boolean> {
    try {
      const url = this.getObjectUrl(config);
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      return response.ok;
    } catch (error) {
      this.context.logger.warn(`Durable Object access check failed: ${error}`);
      return false;
    }
  }

  /**
   * Check Durable Object health in all locations
   */
  private async checkObjectHealth(config: DurableObjectConfig): Promise<
    Array<{ location: DeploymentRegion; healthy: boolean; latency: number }>
  > {
    const results = [];

    for (const location of config.locations) {
      const startTime = Date.now();

      try {
        const url = this.getObjectUrl(config);
        const response = await fetch(`${url}/health?location=${location}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        const latency = Date.now() - startTime;
        const healthy = response.ok;

        results.push({ location, healthy, latency });
      } catch (error) {
        results.push({
          location,
          healthy: false,
          latency: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * Get Durable Object URL
   */
  private getObjectUrl(config: DurableObjectConfig): string {
    const subdomain = this.config.environment === 'production'
      ? 'claudeflare'
      : `claudeflare-${this.config.environment}`;

    return `https://${subdomain}.workers.dev`;
  }

  /**
   * Provision Durable Object resources
   */
  async provisionObjects(configs: DurableObjectConfig[]): Promise<ProvisionResult[]> {
    const results: ProvisionResult[] = [];

    this.emitEvent({
      type: 'info',
      message: `Provisioning ${configs.length} Durable Objects...`,
      timestamp: new Date(),
    });

    for (const config of configs) {
      const result = await this.provisionObject(config);
      results.push(result);
    }

    return results;
  }

  /**
   * Provision a single Durable Object
   */
  async provisionObject(config: DurableObjectConfig): Promise<ProvisionResult> {
    const warnings: string[] = [];

    this.emitEvent({
      type: 'info',
      message: `Provisioning Durable Object: ${config.name}...`,
      timestamp: new Date(),
      resource: config.name,
    });

    try {
      // Check if DO already exists
      const exists = await this.objectExists(config);

      if (exists) {
        warnings.push(`Durable Object ${config.name} already exists`);
        return {
          success: true,
          resourceId: config.name,
          warnings,
        };
      }

      // Create the DO by deploying it
      await this.deployObject(config);

      return {
        success: true,
        resourceId: config.name,
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings,
      };
    }
  }

  /**
   * Check if Durable Object exists
   */
  private async objectExists(config: DurableObjectConfig): Promise<boolean> {
    try {
      const url = this.getObjectUrl(config);
      const response = await fetch(`${url}/admin/objects/${config.name}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get Durable Object instances
   */
  async getInstances(config: DurableObjectConfig): Promise<string[]> {
    this.emitEvent({
      type: 'info',
      message: `Fetching instances for ${config.name}...`,
      timestamp: new Date(),
      resource: config.name,
    });

    try {
      const url = this.getObjectUrl(config);
      const response = await fetch(`${url}/admin/objects/${config.name}/instances`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch instances: ${response.statusText}`);
      }

      const data = await response.json();
      return data.instances || [];
    } catch (error) {
      this.context.logger.warn(`Failed to fetch instances: ${error}`);
      return [];
    }
  }

  /**
   * Migrate Durable Object data
   */
  async migrateData(
    config: DurableObjectConfig,
    fromLocation: DeploymentRegion,
    toLocation: DeploymentRegion
  ): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: `Migrating ${config.name} data from ${fromLocation} to ${toLocation}...`,
      timestamp: new Date(),
      resource: config.name,
    });

    try {
      const url = this.getObjectUrl(config);
      const response = await fetch(`${url}/admin/objects/${config.name}/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromLocation,
          to: toLocation,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new Error(`Migration failed: ${response.statusText}`);
      }

      this.emitEvent({
        type: 'success',
        message: `Data migration completed for ${config.name}`,
        timestamp: new Date(),
        resource: config.name,
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: `Data migration failed for ${config.name}`,
        timestamp: new Date(),
        resource: config.name,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Delete Durable Object instance
   */
  async deleteInstance(config: DurableObjectConfig, instanceId: string): Promise<void> {
    this.emitEvent({
      type: 'warning',
      message: `Deleting instance ${instanceId} of ${config.name}...`,
      timestamp: new Date(),
      resource: config.name,
    });

    try {
      const url = this.getObjectUrl(config);
      const response = await fetch(
        `${url}/admin/objects/${config.name}/instances/${instanceId}`,
        {
          method: 'DELETE',
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }

      this.emitEvent({
        type: 'success',
        message: `Instance ${instanceId} deleted`,
        timestamp: new Date(),
        resource: config.name,
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: `Failed to delete instance ${instanceId}`,
        timestamp: new Date(),
        resource: config.name,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Get Durable Object metrics
   */
  async getMetrics(config: DurableObjectConfig): Promise<Record<string, unknown>> {
    try {
      const url = this.getObjectUrl(config);
      const response = await fetch(`${url}/admin/objects/${config.name}/metrics`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.context.logger.warn(`Failed to fetch metrics: ${error}`);
      return {};
    }
  }

  /**
   * Emit deployment event
   */
  private emitEvent(event: DeploymentEvent): void {
    this.context.events.push(event);
    this.context.logger.info(`[${event.type.toUpperCase()}] ${event.message}`);
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a new Durable Object deployer instance
 */
export function createDurableObjectDeployer(
  config: DeploymentConfig,
  context: DeploymentContext
): DurableObjectDeployer {
  return new DurableObjectDeployer(config, context);
}

/**
 * Default Durable Object configurations for ClaudeFlare
 */
export const DEFAULT_DURABLE_OBJECTS: DurableObjectConfig[] = [
  {
    name: 'AGENT_ORCHESTRATOR',
    className: 'AgentOrchestrator',
    scriptPath: 'src/durable-objects/agent-orchestrator.ts',
    bindings: [],
    locations: ['wnam', 'enam', 'weur', 'apac'],
  },
  {
    name: 'VECTOR_INDEX',
    className: 'VectorIndex',
    scriptPath: 'src/durable-objects/vector-index.ts',
    bindings: [],
    locations: ['wnam', 'weur'],
  },
  {
    name: 'SESSION_MANAGER',
    className: 'SessionManager',
    scriptPath: 'src/durable-objects/session-manager.ts',
    bindings: [],
    locations: ['wnam', 'enam', 'weur', 'apac'],
  },
];
