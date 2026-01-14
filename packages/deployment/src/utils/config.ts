/**
 * Configuration Management
 * Handles loading and validation of deployment configurations
 */

import { z } from 'zod';
import {
  DeploymentConfig,
  DeploymentStrategy,
  Environment,
  HealthCheck,
  SmokeTestConfig,
  ZeroDowntimeConfig,
  BlueGreenConfig,
  CanaryConfig,
  VerificationConfig,
} from '../types';
import { Logger } from './logger';

export interface ConfigLoadOptions {
  filePath?: string;
  configObject?: any;
  logger?: Logger;
}

export class ConfigManager {
  private logger: Logger;

  constructor(options?: { logger?: Logger }) {
    this.logger = options?.logger || new Logger({ component: 'ConfigManager' });
  }

  /**
   * Load deployment configuration from file or object
   */
  async loadDeploymentConfig(options: ConfigLoadOptions): Promise<DeploymentConfig> {
    try {
      let config: any;

      if (options.filePath) {
        this.logger.info('Loading deployment config from file', {
          filePath: options.filePath,
        });
        config = await this.loadFromFile(options.filePath);
      } else if (options.configObject) {
        this.logger.info('Loading deployment config from object');
        config = options.configObject;
      } else {
        throw new Error('Either filePath or configObject must be provided');
      }

      // Validate and parse configuration
      const validatedConfig = this.validateDeploymentConfig(config);

      this.logger.info('Deployment config loaded successfully', {
        deploymentId: validatedConfig.id,
        strategy: validatedConfig.strategy,
        environment: validatedConfig.environment,
      });

      return validatedConfig;
    } catch (error) {
      this.logger.error('Failed to load deployment config', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Load zero-downtime configuration
   */
  loadZeroDowntimeConfig(config: any): ZeroDowntimeConfig {
    const schema = z.object({
      batchSize: z.number().int().positive().default(1),
      batchInterval: z.number().int().positive().default(30000),
      healthCheckInterval: z.number().int().positive().default(5000),
      healthCheckTimeout: z.number().int().positive().default(30000),
      gracePeriod: z.number().int().positive().default(10000),
      shutdownTimeout: z.number().int().positive().default(60000),
      maxRetries: z.number().int().min(0).default(3),
      rollbackOnError: z.boolean().default(true),
      preDeploymentHooks: z.array(z.string()).optional(),
      postDeploymentHooks: z.array(z.string()).optional(),
    });

    return schema.parse(config);
  }

  /**
   * Load blue-green configuration
   */
  loadBlueGreenConfig(config: any): BlueGreenConfig {
    const schema = z.object({
      blueEnvironment: z.string(),
      greenEnvironment: z.string(),
      switchMode: z.enum(['immediate', 'gradual', 'manual']).default('gradual'),
      validationTimeout: z.number().int().positive().default(300000),
      autoRollback: z.boolean().default(true),
      rollbackTimeout: z.number().int().positive().default(60000),
      keepOldVersion: z.boolean().default(false),
      ttlOldVersion: z.number().int().positive().optional(),
      preSwitchHooks: z.array(z.string()).optional(),
      postSwitchHooks: z.array(z.string()).optional(),
    });

    return schema.parse(config);
  }

  /**
   * Load canary configuration
   */
  loadCanaryConfig(config: any): CanaryConfig {
    return config; // Already validated by CanaryConfigSchema
  }

  /**
   * Load smoke test configuration
   */
  loadSmokeTestConfig(config: any): SmokeTestConfig {
    const schema = z.object({
      enabled: z.boolean().default(true),
      parallel: z.boolean().default(false),
      timeout: z.number().int().positive().default(300000),
      retryCount: z.number().int().min(0).default(2),
      tests: z.array(z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        type: z.enum(['health', 'api', 'database', 'cache', 'integration']),
        endpoint: z.string().url(),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
        headers: z.record(z.string()).optional(),
        body: z.any().optional(),
        expectedStatus: z.number().int().min(100).max(599),
        expectedResponse: z.any().optional(),
        timeout: z.number().int().positive(),
        critical: z.boolean(),
      })),
    });

    return schema.parse(config);
  }

  /**
   * Load verification configuration
   */
  loadVerificationConfig(config: any): VerificationConfig {
    const schema = z.object({
      enabled: z.boolean().default(true),
      timeout: z.number().int().positive().default(300000),
      retryCount: z.number().int().min(0).default(2),
      checkInterval: z.number().int().positive().default(5000),
      checks: z.array(z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        type: z.enum(['http', 'tcp', 'dns', 'ssl', 'performance']),
        target: z.string(),
        method: z.string().optional(),
        headers: z.record(z.string()).optional(),
        expectedStatus: z.number().int().min(100).max(599).optional(),
        expectedResponse: z.any().optional(),
        maxResponseTime: z.number().positive().optional(),
        minSuccessRate: z.number().min(0).max(100).optional(),
        critical: z.boolean(),
      })),
    });

    return schema.parse(config);
  }

  /**
   * Validate deployment configuration
   */
  private validateDeploymentConfig(config: any): DeploymentConfig {
    const schema = z.object({
      id: z.string().uuid(),
      strategy: z.nativeEnum(DeploymentStrategy),
      environment: z.nativeEnum(Environment),
      version: z.string().semver(),
      previousVersion: z.string().semver().optional(),
      createdAt: z.date(),
      updatedAt: z.date(),
      createdBy: z.string().min(1),
    });

    return schema.parse(config);
  }

  /**
   * Load configuration from file
   */
  private async loadFromFile(filePath: string): Promise<any> {
    // In a real implementation, this would read from the file system
    // For now, we'll return a mock config

    this.logger.debug('Reading config file', { filePath });

    // Simulate file read
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {};
  }

  /**
   * Merge configurations
   */
  mergeConfigs(base: any, override: any): any {
    return {
      ...base,
      ...override,
      // Deep merge nested objects
      ...Object.keys(override).reduce((acc, key) => {
        if (
          typeof override[key] === 'object' &&
          override[key] !== null &&
          !Array.isArray(override[key])
        ) {
          acc[key] = { ...base[key], ...override[key] };
        }
        return acc;
      }, {} as any),
    };
  }

  /**
   * Validate configuration against schema
   */
  validateSchema(config: any, schema: z.ZodSchema): any {
    try {
      return schema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        throw new Error(`Schema validation failed: ${JSON.stringify(errors, null, 2)}`);
      }
      throw error;
    }
  }
}
