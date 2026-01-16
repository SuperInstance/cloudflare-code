export { ObservableConfig } from '../types';
import { ObservableConfig, ExportResult, TelemetryData } from '../types';

/**
 * Base Observable class for all observability components
 */
export abstract class Observable {
  protected config: ObservableConfig;
  protected initialized = false;

  constructor(config: ObservableConfig = {}) {
    this.config = config;
  }

  /**
   * Initialize the observability component
   */
  abstract initialize(): Promise<void>;

  /**
   * Teardown and cleanup
   */
  abstract destroy(): Promise<void>;

  /**
   * Export collected telemetry data
   */
  abstract export(): Promise<ExportResult>;

  /**
   * Check if the component is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ObservableConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the current configuration
   */
  getConfig(): ObservableConfig {
    return { ...this.config };
  }

  /**
   * Validate configuration
   */
  protected validateConfig(): boolean {
    return true;
  }

  /**
   * Generate a unique correlation ID
   */
  protected generateCorrelationId(): string {
    return `cf-observability-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ensure component is initialized before operations
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Observable component must be initialized before use');
    }
  }

  /**
   * Handle export errors gracefully
   */
  protected handleExportError(error: Error, fallback?: ExportResult): ExportResult {
    console.error(`Export failed: ${error.message}`, error);

    return fallback || {
      success: false,
      exported: 0,
      failed: 1,
      duration: 0,
      errors: [error]
    };
  }

  /**
   * Format timestamp for consistent time representation
   */
  protected formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  /**
   * Create telemetry data envelope
   */
  protected createTelemetryEnvelope(data: Partial<TelemetryData>): TelemetryData {
    return {
      metrics: data.metrics || [],
      logs: data.logs || [],
      metadata: {
        ...data.metadata,
        serviceName: this.config?.tracing?.serviceName || 'unknown',
        environment: this.config?.tracing?.environment || 'unknown',
        timestamp: Date.now(),
        version: process.env.npm_package_version || '1.0.0'
      }
    };
  }
}