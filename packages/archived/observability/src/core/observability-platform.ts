import { EventEmitter } from 'eventemitter3';
import { ObservableConfig } from '../types';
import { TelemetryManager } from './telemetry-manager';
import { ConfigManager } from './config-manager';
import { ExportManager } from './export-manager';
import { ErrorHandler } from './error-handler';

export class ObservabilityPlatform extends EventEmitter {
  private static instance: ObservabilityPlatform;
  private configManager: ConfigManager;
  private telemetryManager: TelemetryManager;
  private exportManager: ExportManager;
  private errorHandler: ErrorHandler;
  private initialized: boolean = false;
  private shutdownHooks: Array<() => Promise<void>> = [];

  private constructor() {
    super();
    this.configManager = new ConfigManager();
    this.telemetryManager = new TelemetryManager();
    this.exportManager = new ExportManager();
    this.errorHandler = new ErrorHandler();

    this.setupEventHandlers();
  }

  public static getInstance(): ObservabilityPlatform {
    if (!ObservabilityPlatform.instance) {
      ObservabilityPlatform.instance = new ObservabilityPlatform();
    }
    return ObservabilityPlatform.instance;
  }

  public async initialize(config: ObservableConfig): Promise<void> {
    if (this.initialized) {
      throw new Error('Observability platform is already initialized');
    }

    try {
      this.emit('beforeInit', { config });

      await this.configManager.initialize(config);
      await this.telemetryManager.initialize();
      await this.exportManager.initialize(this.configManager.getConfig());

      this.errorHandler.setupGlobalHandlers();

      this.initialized = true;
      this.emit('initialized', { timestamp: Date.now() });

      console.log('Observability platform initialized successfully');
    } catch (error) {
      this.errorHandler.handleError(error, 'Initialization failed');
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      this.emit('beforeShutdown');

      // Execute shutdown hooks in reverse order
      for (const hook of this.shutdownHooks.reverse()) {
        await hook();
      }

      await this.exportManager.shutdown();
      await this.telemetryManager.shutdown();

      this.initialized = false;
      this.emit('shutdown', { timestamp: Date.now() });

      console.log('Observability platform shutdown successfully');
    } catch (error) {
      this.errorHandler.handleError(error, 'Shutdown failed');
      throw error;
    }
  }

  public addShutdownHook(hook: () => Promise<void>): void {
    this.shutdownHooks.push(hook);
  }

  public getTelemetryManager(): TelemetryManager {
    if (!this.initialized) {
      throw new Error('Observability platform is not initialized');
    }
    return this.telemetryManager;
  }

  public getExportManager(): ExportManager {
    if (!this.initialized) {
      throw new Error('Observability platform is not initialized');
    }
    return this.exportManager;
  }

  public getConfigManager(): ConfigManager {
    return this.configManager;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  private setupEventHandlers(): void {
    this.on('initialized', () => {
      this.startPeriodicExports();
    });

    this.on('error', (error) => {
      this.errorHandler.handleError(error, 'Platform error');
    });

    // Handle process termination
    process.on('SIGINT', this.handleGracefulShutdown.bind(this));
    process.on('SIGTERM', this.handleGracefulShutdown.bind(this));
    process.on('exit', async () => {
      await this.shutdown();
    });
  }

  private handleGracefulShutdown(): void {
    console.log('Received shutdown signal, shutting down gracefully...');
    this.shutdown().catch(error => {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    });
  }

  private startPeriodicExports(): void {
    const config = this.configManager.getConfig();
    const interval = config.metrics?.exportInterval || 30000;

    const exportInterval = setInterval(async () => {
      try {
        await this.exportManager.exportMetrics();
        await this.exportManager.exportLogs();
        await this.exportManager.exportTraces();
      } catch (error) {
        this.emit('error', error);
      }
    }, interval);

    this.addShutdownHook(async () => {
      clearInterval(exportInterval);
    });
  }
}

export default ObservabilityPlatform.getInstance();