/**
 * Monitoring System - Main Index
 *
 * Central export point for all monitoring and observability functionality.
 * Provides factory functions for creating complete monitoring stacks.
 */

// Types
export type {
  // Core Types
  PrometheusMetric,
  PrometheusMetricType,
  MetricLabels,
  MetricsRegistry,

  // Metric Types
  CounterMetric,
  GaugeMetric,
  HistogramMetric,
  SummaryMetric,

  // Tracing Types
  Trace,
  SpanEvent,
  SpanLink,
  TraceExport,

  // Logging Types
  LogEntry,
  LogLevel,
  LogContext,
  LogError,
  Logger,

  // Alerting Types
  AlertCondition,
  AlertRule,
  NotificationChannel,
  NotificationChannelConfig,
  Alert,
  AlertSummary,

  // Profiling Types
  PerformanceProfile,
  ProfileSample,
  ProfileSummary,
  StackFrame,
  ProfilingOptions,

  // Dashboard Types
  DashboardData,
  MonitoringConfig,
  MonitoringExport,
} from './types';

// Metrics
export {
  MetricsCollector,
  DEFAULT_HISTOGRAM_BUCKETS,
  DEFAULT_SUMMARY_QUANTILES,
} from './metrics';

// Tracing
export {
  Tracer,
  createTracer,
  createTracingMiddleware,
  type TracerConfig,
} from './tracing';

// Logging
export {
  StructuredLogger,
  LogAggregator,
  createLogger,
  createLoggerWithCorrelation,
  createLoggerFromRequest,
  createLogAggregator,
  createLoggingMiddleware,
  generateCorrelationId,
  type LoggerConfig,
} from './logging';

// Alerting
export {
  AlertManager,
  createAlertManager,
  createPredefinedAlertRules,
  createNotificationChannel,
  type AlertManagerConfig,
} from './alerting';

// Profiling
export {
  PerformanceProfiler,
  ProfileContext,
  createProfiler,
  createProfileContext,
  createProfilingMiddleware,
  captureStackTrace,
  type ProfilerConfig,
} from './profiling';

// Dashboard
export {
  DashboardCollector,
  createDashboardCollector,
  type DashboardConfig,
} from './dashboard';

/**
 * Complete Monitoring System
 *
 * Integrates all monitoring components into a single, cohesive system.
 */
export class MonitoringSystem {
  public readonly metrics: MetricsCollector;
  public readonly tracer: Tracer;
  public readonly logger: Logger;
  public readonly alertManager: AlertManager;
  public readonly profiler: PerformanceProfiler;
  public readonly dashboard: DashboardCollector;

  private initialized: boolean = false;

  constructor(config: {
    serviceName: string;
    serviceVersion?: string;
    environment?: string;
    metrics?: {
      defaultLabels?: MetricLabels;
      collectInterval?: number;
    };
    tracing?: {
      enabled?: boolean;
      samplingRate?: number;
      exporter?: TracerConfig['exporter'];
      exporterEndpoint?: string;
    };
    logging?: {
      level?: LogLevel;
      format?: 'json' | 'text';
      exportToCloudflare?: boolean;
    };
    alerting?: {
      enabled?: boolean;
      evaluationInterval?: number;
      defaultNotificationChannels?: NotificationChannel[];
    };
    profiling?: {
      enabled?: boolean;
      samplingInterval?: number;
    };
    dashboard?: {
      refreshInterval?: number;
      enableCaching?: boolean;
    };
  }) {
    const defaultLabels = {
      service_name: config.serviceName,
      service_version: config.serviceVersion || '1.0.0',
      environment: config.environment || 'production',
      ...config.metrics?.defaultLabels,
    };

    // Initialize metrics collector
    this.metrics = new MetricsCollector(
      defaultLabels,
      config.metrics?.collectInterval || 60000
    );

    // Initialize tracer
    this.tracer = createTracer(config.serviceName, {
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion || '1.0.0',
      deploymentEnvironment: config.environment || 'production',
      samplingRate: config.tracing?.samplingRate || 0.1,
      exporter: config.tracing?.exporter || 'memory',
      exporterEndpoint: config.tracing?.exporterEndpoint,
      enabled: config.tracing?.enabled ?? true,
    });

    // Initialize logger
    this.logger = new (StructuredLogger as any)({
      level: config.logging?.level || 'INFO',
      format: config.logging?.format || 'json',
      exportToCloudflare: config.logging?.exportToCloudflare || false,
    });

    // Initialize alert manager
    this.alertManager = new AlertManager(
      {
        evaluationInterval: config.alerting?.evaluationInterval || 60000,
        defaultNotificationChannels: config.alerting?.defaultNotificationChannels || [],
      },
      this.metrics
    );

    // Initialize profiler
    this.profiler = new PerformanceProfiler({
      enabled: config.profiling?.enabled || false,
      defaultOptions: {
        enabled: true,
        samplingInterval: config.profiling?.samplingInterval || 10000,
        maxSamples: 10000,
        includeStackTrace: true,
        trackMemory: true,
        trackCPU: true,
      },
    });

    // Initialize dashboard collector
    this.dashboard = new DashboardCollector(
      {
        refreshInterval: config.dashboard?.refreshInterval || 30000,
        enableCaching: config.dashboard?.enableCaching ?? true,
      },
      {
        metricsCollector: this.metrics,
        tracer: this.tracer,
        logger: this.logger as any,
        alertManager: this.alertManager,
        profiler: this.profiler,
      }
    );
  }

  /**
   * Initialize the monitoring system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Start metrics collection
    this.metrics.startCollection();

    // Start tracer auto-export
    this.tracer.startAutoExport();

    // Start alert evaluation
    this.alertManager.startEvaluation();

    // Start profiler auto-export
    this.profiler.startAutoExport();

    // Start dashboard auto-refresh
    this.dashboard.startAutoRefresh();

    // Add predefined alert rules
    const predefinedRules = createPredefinedAlertRules();
    for (const rule of predefinedRules) {
      this.alertManager.addRule(rule);
    }

    this.initialized = true;

    this.logger.info('Monitoring system initialized', {
      serviceName: 'claudeflare',
      version: '1.0.0',
    });
  }

  /**
   * Shutdown the monitoring system
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Stop all automatic processes
    this.metrics.stopCollection();
    this.tracer.stopAutoExport();
    this.alertManager.stopEvaluation();
    this.profiler.stopAutoExport();
    this.dashboard.stopAutoRefresh();

    // Export remaining data
    await this.tracer.export();
    await this.tracer.shutdown();

    this.initialized = false;

    this.logger.info('Monitoring system shutdown complete');
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    components: {
      metrics: boolean;
      tracing: boolean;
      logging: boolean;
      alerting: boolean;
      profiling: boolean;
      dashboard: boolean;
    };
  }> {
    return {
      healthy: this.initialized,
      components: {
        metrics: true,
        tracing: true,
        logging: true,
        alerting: true,
        profiling: this.profiler.getStats().activeProfiles >= 0,
        dashboard: true,
      },
    };
  }

  /**
   * Export all monitoring data
   */
  async exportAll(): Promise<{
    metrics: string;
    traces: TraceExport | null;
    logs: LogEntry[];
    alerts: AlertSummary;
    dashboard: DashboardData;
  }> {
    const [metrics, traces, logs, alerts, dashboard] = await Promise.all([
      this.metrics.exportPrometheus(),
      this.tracer.getStats().totalSpans > 0
        ? this.tracer.export().then(() => null)
        : Promise.resolve(null),
      (this.logger as any).getEntries ? (this.logger as any).getEntries() : [],
      this.alertManager.getAlertSummary(),
      this.dashboard.getData(),
    ]);

    return {
      metrics,
      traces,
      logs,
      alerts,
      dashboard,
    };
  }
}

/**
 * Create a monitoring system with default configuration
 */
export function createMonitoringSystem(config: {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
}): MonitoringSystem {
  return new MonitoringSystem(config);
}

/**
 * Middleware factory for automatic request monitoring
 */
export function createMonitoringMiddleware(monitoring: MonitoringSystem) {
  return async (request: Request, env: any, ctx: any): Promise<Response> => {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();

    // Create logger with correlation ID
    const logger = monitoring.logger.withCorrelationId(correlationId);

    // Start trace
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const spanId = monitoring.tracer.startSpanFromHeaders(
      `${request.method} ${new URL(request.url).pathname}`,
      headers,
      {
        kind: 'SERVER',
        attributes: {
          'http.method': request.method,
          'http.url': request.url,
          'correlation_id': correlationId,
        },
      }
    );

    logger.info('Request started', {
      method: request.method,
      url: request.url,
      correlationId,
    });

    try {
      // Process request
      const response = await fetch(request);

      const duration = Date.now() - startTime;

      // Record metrics
      const requestCounter = monitoring.metrics.counter(
        'requests_total',
        'Total number of requests',
        ['method', 'status']
      );
      requestCounter(1, {
        method: request.method,
        status: response.status.toString(),
      });

      const latencyHistogram = monitoring.metrics.histogram(
        'request_duration_seconds',
        'Request duration in seconds',
        ['method']
      );
      latencyHistogram(duration / 1000, { method: request.method });

      // Update trace
      if (spanId) {
        monitoring.tracer.setAttributes(spanId, {
          'http.status_code': response.status,
          'http.status_text': response.statusText,
        });
        monitoring.tracer.endSpan(spanId, {
          status: response.ok ? 'OK' : 'ERROR',
        });
      }

      logger.info('Request completed', {
        method: request.method,
        status: response.status,
        duration,
        correlationId,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record error metrics
      const errorCounter = monitoring.metrics.counter(
        'errors_total',
        'Total number of errors',
        ['type']
      );
      errorCounter(1, { type: 'request_error' });

      // Update trace
      if (spanId) {
        monitoring.tracer.recordException(spanId, error as Error);
        monitoring.tracer.endSpan(spanId, { status: 'ERROR' });
      }

      logger.error('Request failed', error as Error, {
        method: request.method,
        url: request.url,
        duration,
        correlationId,
      });

      throw error;
    }
  };
}

/**
 * Utility to create a complete monitoring stack for Cloudflare Workers
 */
export function createCloudflareMonitoring(config: {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  secrets?: {
    slackWebhook?: string;
    pagerDutyKey?: string;
  };
}) {
  const monitoring = new MonitoringSystem({
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    environment: config.environment,
    alerting: {
      defaultNotificationChannels: [
        ...(config.secrets?.slackWebhook
          ? [
              createNotificationChannel('slack', {
                webhookUrl: config.secrets.slackWebhook,
              }),
            ]
          : []),
        ...(config.secrets?.pagerDutyKey
          ? [
              createNotificationChannel('pagerduty', {
                integrationKey: config.secrets.pagerDutyKey,
              }),
            ]
          : []),
      ],
    },
  });

  return {
    monitoring,
    middleware: createMonitoringMiddleware(monitoring),
  };
}
