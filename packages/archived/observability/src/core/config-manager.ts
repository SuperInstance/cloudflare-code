// @ts-nocheck - Complex config management type issues
import { ObservableConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class ConfigManager {
  private config: ObservableConfig;
  private configPath: string;
  private watchers: Array<() => void> = [];

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.loadDefaultConfig();
  }

  public async initialize(config?: ObservableConfig): Promise<void> {
    if (config) {
      this.config = this.mergeConfig(this.config, config);
    }

    if (fs.existsSync(this.configPath)) {
      await this.loadFromFile();
    }

    this.setupWatchers();
  }

  public getConfig(): ObservableConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<ObservableConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.notifyWatchers();
  }

  public resetConfig(): void {
    this.config = this.loadDefaultConfig();
    this.notifyWatchers();
  }

  public async saveToFile(): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await fs.promises.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );

      this.notifyWatchers();
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  private loadDefaultConfig(): ObservableConfig {
    return {
      tracing: {
        serviceName: 'claudeflare-service',
        environment: 'development',
        samplingRate: 0.1,
        exporter: 'otlp'
      },
      metrics: {
        enabled: true,
        exportInterval: 30000
      },
      logging: {
        level: 'info',
        format: 'json',
        correlation: {
          enableTraceCorrelation: true
        },
        sampling: {
          enabled: true,
          rate: 0.1
        }
      },
      alerting: {
        enabled: true,
        rules: []
      },
      healthChecks: {
        enabled: true,
        endpoint: '/health'
      }
    };
  }

  private async loadFromFile(): Promise<void> {
    try {
      const configData = await fs.promises.readFile(this.configPath, 'utf8');
      const fileConfig = JSON.parse(configData);
      this.config = this.mergeConfig(this.config, fileConfig);
    } catch (error) {
      throw new Error(`Failed to load config from file: ${error}`);
    }
  }

  private mergeConfig(base: ObservableConfig, updates: Partial<ObservableConfig>): ObservableConfig {
    return {
      tracing: { ...base.tracing, ...updates.tracing },
      metrics: { ...base.metrics, ...updates.metrics },
      logging: { ...base.logging, ...updates.logging },
      alerting: { ...base.alerting, ...updates.alerting },
      healthChecks: { ...base.healthChecks, ...updates.healthChecks }
    };
  }

  private getDefaultConfigPath(): string {
    return process.env.OBSERVABILITY_CONFIG_PATH ||
           path.join(process.cwd(), 'observability.json');
  }

  private setupWatchers(): void {
    if (fs.existsSync(this.configPath)) {
      try {
        const watcher = fs.watch(this.configPath, (eventType) => {
          if (eventType === 'change') {
            this.loadFromFile().catch((error) => {
              console.error('Failed to reload config:', error);
            });
          }
        });

        this.addShutdownHook(async () => {
          watcher.close();
        });
      } catch (error) {
        console.warn('Failed to setup config watcher:', error);
      }
    }
  }

  public addWatcher(callback: () => void): void {
    this.watchers.push(callback);
  }

  private notifyWatchers(): void {
    this.watchers.forEach(callback => callback());
  }

  public validateConfig(config: ObservableConfig): boolean {
    try {
      if (config.tracing?.samplingRate !== undefined) {
        if (config.tracing.samplingRate < 0 || config.tracing.samplingRate > 1) {
          throw new Error('Sampling rate must be between 0 and 1');
        }
      }

      if (config.metrics?.exportInterval !== undefined) {
        if (config.metrics.exportInterval < 1000) {
          throw new Error('Export interval must be at least 1000ms');
        }
      }

      if (config.logging?.sampling?.rate !== undefined) {
        if (config.logging.sampling.rate < 0 || config.logging.sampling.rate > 1) {
          throw new Error('Log sampling rate must be between 0 and 1');
        }
      }

      return true;
    } catch (error) {
      console.error('Config validation failed:', error);
      return false;
    }
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public async exportToEnv(): Promise<void> {
    if (this.config.tracing) {
      if (this.config.tracing.serviceName) {
        process.env.OTEL_SERVICE_NAME = this.config.tracing.serviceName;
      }
      if (this.config.tracing.environment) {
        process.env.OTEL_ENVIRONMENT = this.config.tracing.environment;
      }
    }

    if (this.config.metrics?.exportInterval) {
      process.env.OBSERVABILITY_EXPORT_INTERVAL = this.config.metrics.exportInterval.toString();
    }

    if (this.config.logging?.level) {
      process.env.LOG_LEVEL = this.config.logging.level;
    }
  }
}