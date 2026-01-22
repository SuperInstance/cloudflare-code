/**
 * Advanced Usage Examples
 * Demonstrates advanced observability features
 */

import {
  Tracer,
  MetricsCollector,
  AlertingEngine,
  AlertRuleBuilder,
  PerformanceMonitor,
  HealthChecker,
  DashboardBuilder,
  TemplateProvider,
} from '../src';
import type { AlertAction, AlertSeverity } from '../src';

// ============================================================================
// Alerting Example
// ============================================================================

async function alertingExample() {
  console.log('\n=== Alerting Engine Example ===\n');

  const alerting = new AlertingEngine();

  // Create an alert rule using the builder
  const rule = new AlertRuleBuilder()
    .setId('high-error-rate')
    .setName('High Error Rate')
    .setDescription('Alert when error rate exceeds 5%')
    .setCondition({
      type: 'threshold',
      metric: 'error_rate',
      threshold: 5,
      operator: 'gte',
    })
    .setSeverity('critical')
    .setCooldown(300000) // 5 minutes
    .addAction({
      type: 'email',
      config: {
        recipients: ['ops@claudeflare.com'],
      },
    })
    .addAction({
      type: 'slack',
      config: {
        recipients: ['#alerts'],
      },
    })
    .build();

  alerting.addRule(rule);

  // Add more rules
  alerting.addRule({
    id: 'low-memory',
    name: 'Low Memory',
    description: 'Alert when memory usage is high',
    condition: {
      type: 'threshold',
      metric: 'memory_usage_percent',
      threshold: 90,
      operator: 'gte',
    },
    actions: [{
      type: 'pagerduty',
      config: {},
    }],
    enabled: true,
    severity: 'warning',
  });

  // Simulate metric evaluation
  await alerting.evaluateMetric('error_rate', 6.5);
  
  const activeAlerts = alerting.getActiveAlerts();
  console.log('Active alerts:', activeAlerts.length);

  // Acknowledge an alert
  if (activeAlerts.length > 0) {
    alerting.acknowledgeAlert(activeAlerts[0].id);
    console.log('Alert acknowledged');
  }

  // View alert history
  const history = alerting.getAlertHistory(10);
  console.log('Recent alerts:', history.length);

  alerting.shutdown();
}

// ============================================================================
// Performance Monitoring Example
// ============================================================================

function performanceExample() {
  console.log('\n=== Performance Monitoring Example ===\n');

  const perf = new PerformanceMonitor('api-service');

  // Record some requests
  for (let i = 0; i < 1000; i++) {
    const duration = Math.random() * 200 + 50; // 50-250ms
    const success = Math.random() > 0.05; // 95% success rate
    perf.recordRequest(duration, success);
  }

  // Get performance metrics
  const metrics = perf.getMetrics();

  console.log('Latency metrics:', metrics.latency);
  console.log('Throughput:', metrics.throughput);
  console.log('Error rate:', metrics.errorRate);
  console.log('Resources:', metrics.resources);

  // Create SLO
  const slo = perf.createSLO({
    id: 'latency-slo',
    name: 'Request Latency SLO',
    type: 'latency',
    target: 95, // 95th percentile under 200ms
    errorBudgetTarget: 5, // 5% error budget
    timeSlots: [],
  });

  console.log('SLO created:', slo.name);

  // Track dependency calls
  perf.recordDependencyCall('database', 'database', 25, true);
  perf.recordDependencyCall('cache', 'cache', 5, true);
  perf.recordDependencyCall('api', 'external', 150, false);

  console.log('Dependencies:', metrics.dependencies);
}

// ============================================================================
// Health Check Example
// ============================================================================

async function healthCheckExample() {
  console.log('\n=== Health Check Example ===\n');

  const health = new HealthChecker('api-service');

  // Register standard checks
  health.registerCheck({
    type: 'liveness',
    enabled: true,
    config: {},
  });

  health.registerCheck({
    type: 'readiness',
    enabled: true,
    config: {},
  });

  // Register custom check
  health.registerCheck({
    type: 'custom',
    enabled: true,
    config: {
      check: async () => {
        // Check database connectivity
        const dbHealthy = await checkDatabase();
        return {
          healthy: dbHealthy,
          message: dbHealthy ? 'Database is healthy' : 'Database is down',
          data: { latency: 5 },
        };
      },
    },
  });

  // Perform health check
  const result = await health.check();

  console.log('Overall status:', result.status);
  console.log('Individual checks:', result.checks);

  // Start periodic checks
  health.startPeriodicChecks(30000); // Every 30 seconds

  // Later: stop periodic checks
  // health.stopPeriodicChecks();
}

async function checkDatabase(): Promise<boolean> {
  // Simulate database check
  return Math.random() > 0.1;
}

// ============================================================================
// Dashboard Example
// ============================================================================

function dashboardExample() {
  console.log('\n=== Dashboard Builder Example ===\n');

  const builder = new DashboardBuilder();
  const templates = new TemplateProvider();

  // Use a pre-built template
  const perfTemplate = templates.getTemplate('performance-overview');
  console.log('Template:', perfTemplate?.name);

  // Create custom dashboard
  const dashboard = builder.createDashboard({
    name: 'My Service Dashboard',
    description: 'Custom monitoring dashboard',
    timeRange: {
      start: 'now-6h',
      end: 'now',
      preset: 'last-6h',
    },
    refreshInterval: 15000,
    permissions: {
      read: ['team'],
      write: ['admins'],
    },
  });

  // Add widgets
  builder.addWidget(dashboard.id, {
    type: 'stat',
    title: 'Request Rate',
    position: { x: 0, y: 0 },
    size: { width: 3, height: 2 },
    config: { showLegend: false },
    queries: [{
      id: 'q1',
      query: 'rate(http_requests_total[5m])',
      dataSource: 'prometheus',
      legendFormat: 'req/s',
    }],
  });

  builder.addWidget(dashboard.id, {
    type: 'timeseries',
    title: 'Latency',
    position: { x: 3, y: 0 },
    size: { width: 6, height: 2 },
    config: { showLegend: true },
    queries: [{
      id: 'q1',
      query: 'histogram_quantile(0.99, http_request_duration_seconds_bucket)',
      dataSource: 'prometheus',
    }],
  });

  builder.addWidget(dashboard.id, {
    type: 'gauge',
    title: 'Error Rate',
    position: { x: 9, y: 0 },
    size: { width: 3, height: 2 },
    config: {
      thresholds: [
        { value: 0, color: 'green' },
        { value: 1, color: 'yellow' },
        { value: 5, color: 'red' },
      ],
    },
    queries: [{
      id: 'q1',
      query: 'rate(http_requests_total{status=~"5.."}[5m]) * 100',
      dataSource: 'prometheus',
    }],
  });

  console.log('Dashboard created:', dashboard.name);
  console.log('Widgets:', dashboard.widgets.length);
}

// ============================================================================
// Advanced Tracing Example
// ============================================================================

async function advancedTracingExample() {
  console.log('\n=== Advanced Tracing Example ===\n');

  const tracer = new Tracer({
    serviceName: 'microservice',
    exporter: 'console',
  });

  // Complex workflow with multiple spans
  await tracer.withSpan(
    { name: 'process-order', kind: 'server' },
    async (parentSpan) => {
      parentSpan.setAttribute('order.id', 'order-123');
      
      // Parallel operations
      await Promise.all([
        tracer.withSpan(
          { name: 'validate-order', kind: 'internal' },
          async (span) => {
            span.addEvent('validation-start');
            await new Promise(resolve => setTimeout(resolve, 50));
            span.addEvent('validation-complete');
          }
        ),
        tracer.withSpan(
          { name: 'check-inventory', kind: 'client' },
          async (span) => {
            span.setAttribute('service.name', 'inventory-service');
            await new Promise(resolve => setTimeout(resolve, 75));
          }
        ),
      ]);

      // Sequential operation
      await tracer.withSpan(
        { name: 'process-payment', kind: 'client' },
        async (span) => {
          span.setAttribute('service.name', 'payment-service');
          span.setAttribute('payment.amount', 99.99);
          
          try {
            await new Promise(resolve => setTimeout(resolve, 100));
            span.setStatus(0); // OK
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus(2); // Error
            throw error;
          }
        }
      );
    }
  );

  await tracer.shutdown();
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    await alertingExample();
    performanceExample();
    await healthCheckExample();
    dashboardExample();
    await advancedTracingExample();
  } catch (error) {
    console.error('Example failed:', error);
  }
}

if (require.main === module) {
  main();
}

export {
  alertingExample,
  performanceExample,
  healthCheckExample,
  dashboardExample,
  advancedTracingExample,
};
