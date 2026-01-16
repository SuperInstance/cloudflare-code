// @ts-nocheck
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yamljs';
import * as Joi from 'joi';
import { PlatformConfig, ServiceConfig } from '../types';
import { Logger } from '../utils/logger';

export class ConfigManager {
  private logger: Logger;
  private config: PlatformConfig | null = null;
  private configPath: string;
  private watchers: fs.FSWatcher[] = [];
  private schema: Joi.ObjectSchema;

  constructor(configPath: string = './config/platform.yaml') {
    this.configPath = configPath;
    this.logger = new Logger('ConfigManager');

    // Joi schema for validation
    this.schema = Joi.object({
      name: Joi.string().required(),
      version: Joi.string().required(),
      environment: Joi.string().valid('development', 'staging', 'production').required(),
      services: Joi.array().items(
        Joi.object({
          id: Joi.string().required(),
          name: Joi.string().required(),
          version: Joi.string().required(),
          host: Joi.string().hostname().required(),
          port: Joi.number().port().required(),
          healthCheck: Joi.object({
            enabled: Joi.boolean().default(true),
            endpoint: Joi.string().default('/health'),
            interval: Joi.number().min(1000).default(30000),
            timeout: Joi.number().min(1000).default(5000),
            retries: Joi.number().min(0).default(3),
            healthyThreshold: Joi.number().min(1).default(2),
            unhealthyThreshold: Joi.number().min(1).default(3)
          }),
          loadBalancing: Joi.object({
            strategy: Joi.string().valid('round-robin', 'least-connections', 'ip-hash', 'weighted').default('round-robin'),
            stickySessions: Joi.boolean().default(false),
            healthCheckInterval: Joi.number().min(1000).default(30000),
            nodes: Joi.array().items(
              Joi.object({
                host: Joi.string().hostname().required(),
                port: Joi.number().port().required(),
                weight: Joi.number().min(1).default(1),
                healthy: Joi.boolean().default(true),
                connections: Joi.number().min(0).default(0),
                lastHealthCheck: Joi.date().iso().default(new Date())
              })
            ).default([])
          }),
          circuitBreaker: Joi.object({
            enabled: Joi.boolean().default(true),
            threshold: Joi.number().min(1).default(5),
            timeout: Joi.number().min(1000).default(60000),
            resetTimeout: Joi.number().min(1000).default(30000),
            halfOpenRequests: Joi.number().min(1).default(1),
            slidingWindowSize: Joi.number().min(1).default(10),
            slidingWindowType: Joi.string().valid('count', 'percentage').default('count')
          }),
          retry: Joi.object({
            enabled: Joi.boolean().default(true),
            maxAttempts: Joi.number().min(1).default(3),
            delayMs: Joi.number().min(0).default(1000),
            backoffMultiplier: Joi.number().min(1).default(2),
            maxDelayMs: Joi.number().min(1000).default(10000),
            retryableStatusCodes: Joi.array().items(Joi.number()).default([408, 429, 500, 502, 503, 504])
          }),
          security: Joi.object({
            enabled: Joi.boolean().default(true),
            auth: Joi.object({
              type: Joi.string().valid('jwt', 'oauth', 'api-key', 'basic').required(),
              provider: Joi.string().optional()
            }).default({ type: 'api-key' }),
            rateLimiting: Joi.object({
              enabled: Joi.boolean().default(true),
              requestsPerMinute: Joi.number().min(1).default(60),
              burst: Joi.number().min(1).default(10)
            }),
            cors: Joi.object({
              enabled: Joi.boolean().default(true),
              origins: Joi.array().items(Joi.string()).default(['*']),
              methods: Joi.array().items(Joi.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
              headers: Joi.array().items(Joi.string()).default(['*']),
              credentials: Joi.boolean().default(false)
            }),
            encryption: Joi.object({
              enabled: Joi.boolean().default(false),
              algorithm: Joi.string().default('AES-256-GCM'),
              key: Joi.string().optional()
            })
          }),
          cache: Joi.object({
            enabled: Joi.boolean().default(true),
            type: Joi.string().valid('memory', 'redis', 'file').default('memory'),
            ttl: Joi.number().min(1).default(3600),
            maxSize: Joi.number().min(1000).default(10000),
            evictionPolicy: Joi.string().valid('lru', 'lfu', 'fifo').default('lru'),
            redis: Joi.object({
              host: Joi.string().hostname().required(),
              port: Joi.number().port().required(),
              password: Joi.string().optional(),
              db: Joi.number().min(0).max(15).default(0),
              cluster: Joi.boolean().default(false),
              nodes: Joi.array().items(
                Joi.object({
                  host: Joi.string().hostname().required(),
                  port: Joi.number().port().required(),
                  password: Joi.string().optional(),
                  db: Joi.number().min(0).max(15).default(0)
                })
              ).optional()
            }).optional()
          }),
          monitoring: Joi.object({
            enabled: Joi.boolean().default(true),
            metrics: Joi.object({
              enabled: Joi.boolean().default(true),
              interval: Joi.number().min(1000).default(10000),
              retention: Joi.number().min(3600).default(86400)
            }),
            tracing: Joi.object({
              enabled: Joi.boolean().default(true),
              sampling: Joi.number().min(0).max(1).default(0.1)
            }),
            logging: Joi.object({
              level: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
              format: Joi.string().valid('json', 'text').default('json'),
              outputs: Joi.array().items(Joi.string()).default(['console'])
            })
          })
        })
      ),
      global: Joi.object({
        port: Joi.number().port().required(),
        host: Joi.string().hostname().required(),
        cluster: Joi.boolean().default(false),
        workers: Joi.number().min(1).default(1),
        shutdownTimeout: Joi.number().min(1000).default(30000)
      }),
      orchestration: Joi.object({
        enabled: Joi.boolean().default(true),
        autoScaling: Joi.object({
          enabled: Joi.boolean().default(true),
          minInstances: Joi.number().min(1).default(1),
          maxInstances: Joi.number().min(1).default(10),
          scaleUpThreshold: Joi.number().min(0).max(1).default(0.8),
          scaleDownThreshold: Joi.number().min(0).max(1).default(0.3)
        }),
        serviceDependencies: Joi.array().items(
          Joi.object({
            service: Joi.string().required(),
            dependsOn: Joi.array().items(Joi.string()).required(),
            version: Joi.string().required(),
            optional: Joi.boolean().default(false)
          })
        ).default([]),
        migration: Joi.object({
          enabled: Joi.boolean().default(true),
          autoMigrate: Joi.boolean().default(true),
          backupBeforeMigration: Joi.boolean().default(true),
          rollbackOnFailure: Joi.boolean().default(true)
        })
      }),
      deployment: Joi.object({
        enabled: Joi.boolean().default(true),
        strategy: Joi.string().valid('rolling', 'blue-green', 'canary').default('rolling'),
        healthCheckEndpoint: Joi.string().default('/health'),
        readinessProbe: Joi.object({
          enabled: Joi.boolean().default(true),
          interval: Joi.number().min(1000).default(5000),
          timeout: Joi.number().min(1000).default(3000),
          threshold: Joi.number().min(1).default(1),
          failureThreshold: Joi.number().min(1).default(3)
        }),
        livenessProbe: Joi.object({
          enabled: Joi.boolean().default(true),
          interval: Joi.number().min(1000).default(10000),
          timeout: Joi.number().min(1000).default(3000),
          threshold: Joi.number().min(1).default(1),
          failureThreshold: Joi.number().min(1).default(3)
        }),
        rollback: Joi.object({
          enabled: Joi.boolean().default(true),
          automatic: Joi.boolean().default(true),
          timeout: Joi.number().min(1000).default(300000),
          healthCheckInterval: Joi.number().min(1000).default(10000)
        })
      }),
      optimization: Joi.object({
        enabled: Joi.boolean().default(true),
        cpu: Joi.object({
          enabled: Joi.boolean().default(true),
          target: Joi.number().min(0).max(1).default(0.7),
          scaleDown: Joi.number().min(0).max(1).default(0.3)
        }),
        memory: Joi.object({
          enabled: Joi.boolean().default(true),
          target: Joi.number().min(0).max(1).default(0.8),
          scaleDown: Joi.number().min(0).max(1).default(0.3)
        }),
        network: Joi.object({
          enabled: Joi.boolean().default(true),
          compression: Joi.boolean().default(true),
          caching: Joi.boolean().default(true)
        }),
        database: Joi.object({
          enabled: Joi.boolean().default(true),
          connectionPooling: Joi.boolean().default(true),
          queryCaching: Joi.boolean().default(true)
        })
      })
    });
  }

  async loadConfig(): Promise<PlatformConfig> {
    try {
      // Ensure config directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Check if config file exists
      if (!fs.existsSync(this.configPath)) {
        this.logger.warn(`Config file not found at ${this.configPath}, creating default config`);
        this.config = await this.createDefaultConfig();
        await this.saveConfig(this.config);
        return this.config;
      }

      // Load config file
      const fileContent = fs.readFileSync(this.configPath, 'utf8');
      const configData = yaml.parse(fileContent);

      // Validate config
      const { error, value } = this.schema.validate(configData, {
        allowUnknown: false,
        abortEarly: false
      });

      if (error) {
        throw new Error(`Config validation failed: ${error.details.map(d => d.message).join(', ')}`);
      }

      this.config = value;
      this.logger.info('Config loaded successfully');
      return this.config;
    } catch (error) {
      this.logger.error('Failed to load config', { error });
      throw error;
    }
  }

  async saveConfig(config: PlatformConfig): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const yamlContent = yaml.stringify(config, 10);
      fs.writeFileSync(this.configPath, yamlContent, 'utf8');
      this.logger.info('Config saved successfully');
    } catch (error) {
      this.logger.error('Failed to save config', { error });
      throw error;
    }
  }

  async updateConfig(updates: Partial<PlatformConfig>): Promise<PlatformConfig> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    // Merge updates with current config
    const updatedConfig = this.mergeConfig(this.config, updates);

    // Validate updated config
    const { error, value } = this.schema.validate(updatedConfig);
    if (error) {
      throw new Error(`Config validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }

    this.config = value;
    await this.saveConfig(this.config);

    this.emit('configUpdated', this.config);
    return this.config;
  }

  private mergeConfig(base: PlatformConfig, updates: Partial<PlatformConfig>): PlatformConfig {
    return {
      ...base,
      ...updates,
      services: updates.services || base.services,
      global: { ...base.global, ...updates.global },
      orchestration: { ...base.orchestration, ...updates.orchestration },
      deployment: { ...base.deployment, ...updates.deployment },
      optimization: { ...base.optimization, ...updates.optimization }
    };
  }

  async watchConfig(): Promise<void> {
    if (this.watchers.length > 0) {
      return;
    }

    try {
      // Watch the config file for changes
      const watcher = fs.watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
          try {
            await this.loadConfig();
            this.logger.info('Config file reloaded');
          } catch (error) {
            this.logger.error('Failed to reload config', { error });
          }
        }
      });

      this.watchers.push(watcher);
      this.logger.info('Config file watcher started');
    } catch (error) {
      this.logger.error('Failed to start config watcher', { error });
      throw error;
    }
  }

  stopWatching(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
    this.logger.info('Config file watcher stopped');
  }

  private async createDefaultConfig(): Promise<PlatformConfig> {
    return {
      name: 'ClaudeFlare Platform',
      version: '1.0.0',
      environment: 'development',
      services: [],
      global: {
        port: 3000,
        host: 'localhost',
        cluster: false,
        workers: 1,
        shutdownTimeout: 30000
      },
      orchestration: {
        enabled: true,
        autoScaling: {
          enabled: true,
          minInstances: 1,
          maxInstances: 10,
          scaleUpThreshold: 0.8,
          scaleDownThreshold: 0.3
        },
        serviceDependencies: [],
        migration: {
          enabled: true,
          autoMigrate: true,
          backupBeforeMigration: true,
          rollbackOnFailure: true
        }
      },
      deployment: {
        enabled: true,
        strategy: 'rolling',
        healthCheckEndpoint: '/health',
        readinessProbe: {
          enabled: true,
          interval: 5000,
          timeout: 3000,
          threshold: 1,
          failureThreshold: 3
        },
        livenessProbe: {
          enabled: true,
          interval: 10000,
          timeout: 3000,
          threshold: 1,
          failureThreshold: 3
        },
        rollback: {
          enabled: true,
          automatic: true,
          timeout: 300000,
          healthCheckInterval: 10000
        }
      },
      optimization: {
        enabled: true,
        cpu: {
          enabled: true,
          target: 0.7,
          scaleDown: 0.3
        },
        memory: {
          enabled: true,
          target: 0.8,
          scaleDown: 0.3
        },
        network: {
          enabled: true,
          compression: true,
          caching: true
        },
        database: {
          enabled: true,
          connectionPooling: true,
          queryCaching: true
        }
      }
    };
  }

  getConfig(): PlatformConfig | null {
    return this.config;
  }

  getServiceConfig(serviceId: string): ServiceConfig | null {
    return this.config?.services.find(s => s.id === serviceId) || null;
  }

  validateConfig(config: any): { valid: boolean; errors?: string[] } {
    const { error } = this.schema.validate(config, {
      allowUnknown: false,
      abortEarly: false
    });

    if (error) {
      return {
        valid: false,
        errors: error.details.map(d => d.message)
      };
    }

    return { valid: true };
  }
}

// Event emitter interface
export interface ConfigManagerEvents {
  configUpdated: (config: PlatformConfig) => void;
}

// Extend ConfigManager with EventEmitter functionality
export interface ConfigManager extends NodeJS.EventEmitter {
  on(event: 'configUpdated', listener: (config: PlatformConfig) => void): this;
  emit(event: 'configUpdated', config: PlatformConfig): boolean;
}