/**
 * ClaudeFlare Observability Package
 * Comprehensive observability and monitoring system
 *
 * @packageDocumentation
 */

// Tracing
export {
  Tracer,
  Span,
  FixedRateSamplingStrategy,
  TraceIDBasedSamplingStrategy,
  RuleBasedSamplingStrategy,
  AutoInstrumentation,
  TraceContext,
  type TraceOptions,
  type SpanOptions,
  type SpanContext,
  type SpanKind,
  type SamplingStrategy,
  type SamplingContext,
} from './tracing/tracer';

// Metrics
export {
  MetricsCollector,
  MetricCounter,
  MetricGauge,
  MetricHistogram,
  MetricRegistry,
  type MetricOptions,
  type CounterOptions,
  type GaugeOptions,
  type HistogramOptions,
  type MetricData,
  type AggregationWindow,
  type PercentileValues,
  type MetricExportOptions,
} from './metrics/collector';

// Logging
export {
  StructuredLogger,
  LogCorrelation,
  LogRedaction,
  LogSampler,
  LoggerFactory,
  AsyncLogContext,
  type LoggerOptions,
  type LogLevel,
  type LogEntry,
  type LogContext,
  type LogFormat,
  type LogOutput,
} from './logging/logger';

// Alerting
export {
  AlertingEngine,
  EmailNotificationChannel,
  SlackNotificationChannel,
  PagerDutyNotificationChannel,
  WebhookNotificationChannel,
  ConditionEvaluator,
  AlertRuleBuilder,
  type AlertRule,
  type AlertCondition,
  type AlertAction,
  type Alert,
  type AlertEscalationPolicy,
  type OnCallRotation,
} from './alerting/engine';

// Dashboard
export {
  DashboardBuilder,
  TemplateProvider,
  DashboardRenderer,
  type Dashboard,
  type Widget,
  type WidgetType,
  type DashboardLayout,
  type TimeRange,
} from './dashboard/builder';

// Performance
export {
  PerformanceMonitor,
  type PerformanceMetrics,
  type LatencyMetrics,
  type ThroughputMetrics,
  type ErrorRateMetrics,
  type ResourceMetrics,
  type DependencyMetrics,
  type SLI,
  type SLO,
} from './performance/monitor';

// Health Checks
export {
  HealthChecker,
  HealthIndicatorRegistry,
  type HealthCheckResult,
  type HealthStatus,
  type HealthCheck,
  type HealthCheckConfig,
  type HealthIndicator,
} from './health/checker';

// Types
export * from './types';

// Version
export const VERSION = '1.0.0';
