// Core observability platform
export { ObservabilityPlatform } from './core/observability-platform';
export { ConfigManager } from './core/config-manager';
export { TelemetryManager } from './core/telemetry-manager';
export { ExportManager } from './core/export-manager';
export { ErrorHandler } from './core/error-handler';
export { Utils } from './core/utils';

// Metrics
export { MetricCollector } from './metrics/metric-collector';
export { Counter, Gauge, Histogram, Summary, UpDownCounter } from './metrics/custom-metrics';

// Tracing
export { DistributedTracer, Span, ConsoleTraceExporter } from './tracing/tracer';
export { TraceContext } from './tracing/context-manager';

// Logging
export { StructuredLogger } from './logging/logger';

// Performance Monitoring
export { PerformanceMonitor } from './apm/performance-monitor';
export { DependencyMonitor } from './apm/dependency-monitor';

// Alerting
export { AlertManager } from './alerting/alert-manager';

// Dashboarding
export { DashboardManager } from './dashboarding/dashboard-manager';

// RUM
export { RUMService } from './integrations/rum-service';

// Business Metrics
export { BusinessMetricsService } from './integrations/business-metrics';

// Error Tracking
export { ErrorTracker } from './tracking/error-tracker';

// Types
export * from './types';

// Main Platform Class
export class ClaudeFlareObservability {
  private platform: ObservabilityPlatform;
  private initialized = false;

  constructor(config?: any) {
    this.platform = ObservabilityPlatform.getInstance();
  }

  /**
   * Initialize the observability platform
   */
  async initialize(config?: any): Promise<void> {
    if (this.initialized) return;

    try {
      await this.platform.initialize(config);

      this.initialized = true;
      console.log('ClaudeFlare Observability Platform initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ClaudeFlare Observability Platform:', error);
      throw error;
    }
  }

  /**
   * Shutdown the observability platform
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    try {
      await this.platform.shutdown();
      this.initialized = false;
      console.log('ClaudeFlare Observability Platform shutdown successfully');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  /**
   * Get the metrics collector
   */
  getMetricsCollector() {
    return this.platform.getTelemetryManager();
  }

  /**
   * Get the tracer
   */
  getTracer(options?: any) {
    return DistributedTracer.getInstance(options);
  }

  /**
   * Get the logger
   */
  getLogger(serviceName: string, options?: any) {
    return new StructuredLogger(serviceName, options);
  }

  /**
   * Get the APM service
   */
  getAPMService() {
    return new PerformanceMonitor();
  }

  /**
   * Get the alerting service
   */
  getAlertingService() {
    return new AlertManager();
  }

  /**
   * Get the dashboard service
   */
  getDashboardService() {
    return new DashboardManager();
  }

  /**
   * Get the RUM service
   */
  getRUMService() {
    return new RUMService();
  }

  /**
   * Get the business metrics service
   */
  getBusinessMetricsService() {
    return new BusinessMetricsService();
  }

  /**
   * Get the error tracker
   */
  getErrorTracker() {
    return new ErrorTracker();
  }

  /**
   * Export all observability data
   */
  async export(): Promise<any> {
    return {
      metrics: await this.getMetricsCollector().exportMetrics(),
      logs: await this.getMetricsCollector().exportLogs(),
      traces: await this.getTracer().getTraces()
    };
  }

  /**
   * Get platform status
   */
  getStatus(): any {
    return {
      initialized: this.initialized,
      platform: {
        isInitialized: this.platform.isInitialized()
      },
      components: {
        metrics: this.platform.getTelemetryManager().getMetricsCacheSize(),
        logs: this.platform.getTelemetryManager().getLogsCacheSize(),
        traces: this.platform.getTelemetryManager().getTracesCacheSize()
      }
    };
  }
}

// Global instance
let globalInstance: ClaudeFlareObservability | null = null;

/**
 * Get or create the global observability instance
 */
export function getObservabilityInstance(): ClaudeFlareObservability {
  if (!globalInstance) {
    globalInstance = new ClaudeFlareObservability();
  }
  return globalInstance;
}

/**
 * Quick initialization helper
 */
export async function initializeObservability(config?: any): Promise<ClaudeFlareObservability> {
  const instance = getObservabilityInstance();
  await instance.initialize(config);
  return instance;
}

// Version
export const VERSION = '1.0.0';

// Default exports
export { default } from './core/observability-platform';

// Quick start utilities
export { initialize, getPlatform } from './core/observability-platform';
