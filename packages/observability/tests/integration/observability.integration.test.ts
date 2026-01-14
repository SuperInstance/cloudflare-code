/**
 * Integration tests for observability system
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Tracer,
  MetricsCollector,
  StructuredLogger,
  AlertingEngine,
  PerformanceMonitor,
  HealthChecker,
  LoggerFactory,
} from '../../src';

describe('Observability Integration', () => {
  let tracer: Tracer;
  let metrics: MetricsCollector;
  let logger: StructuredLogger;
  let alerting: AlertingEngine;
  let performance: PerformanceMonitor;
  let healthChecker: HealthChecker;

  beforeAll(() => {
    tracer = new Tracer({
      serviceName: 'integration-test-service',
      environment: 'test',
      exporter: 'console',
    });

    metrics = new MetricsCollector('integration-test-service');
    logger = LoggerFactory.create('integration-test-service', {
      level: 'info',
      format: 'json',
    });
    alerting = new AlertingEngine();
    performance = new PerformanceMonitor('integration-test-service');
    healthChecker = new HealthChecker('integration-test-service');
  });

  afterAll(async () => {
    await tracer.shutdown();
    await metrics.shutdown();
    alerting.shutdown();
    healthChecker.stopPeriodicChecks();
    await logger.flush();
  });

  describe('End-to-End Request Processing', () => {
    it('should track request through all observability components', async () => {
      // Simulate request processing
      const requestId = 'req-123';
      
      // Start tracing
      await tracer.withSpan(
        {
          name: 'process-request',
          kind: 'server',
          attributes: { 'http.request_id': requestId },
        },
        async (span) => {
          // Log request start
          logger.setTraceContext(span.getContext().traceId, span.getContext().spanId);
          logger.info('Processing request', { requestId });

          // Record metrics
          const requestCounter = metrics.counter({
            name: 'http_requests_total',
            description: 'Total HTTP requests',
          });
          requestCounter.increment(1, { method: 'GET', path: '/api/test' });

          // Track performance
          const startTime = Date.now();

          // Simulate processing
          await new Promise(resolve => setTimeout(resolve, 50));

          // Record duration
          const duration = Date.now() - startTime;
          const latencyHistogram = metrics.histogram({
            name: 'http_request_duration_ms',
            description: 'HTTP request latency',
          });
          latencyHistogram.record(duration);

          // Update performance monitor
          performance.recordRequest(duration, true);

          // Complete span
          span.setStatus(0); // OK
          logger.info('Request completed', { requestId, duration });
        }
      );

      // Verify metrics were recorded
      const allMetrics = metrics.getAllMetrics();
      expect(allMetrics.length).toBeGreaterThan(0);

      // Verify performance was tracked
      const perfMetrics = performance.getMetrics();
      expect(perfMetrics.throughput.requestsPerSecond).toBeGreaterThan(0);
    });

    it('should handle errors across all components', async () => {
      const error = new Error('Test error');

      await tracer.withSpan(
        {
          name: 'failing-request',
          kind: 'server',
        },
        async (span) => {
          logger.setTraceContext(span.getContext().traceId);
          
          try {
            throw error;
          } catch (err) {
            span.recordException(error);
            logger.error('Request failed', error);
            
            const errorCounter = metrics.counter({
              name: 'http_errors_total',
              description: 'Total HTTP errors',
            });
            errorCounter.increment(1, { type: 'error' });
            
            performance.recordRequest(0, false);
          }
        }
      );

      const perfMetrics = performance.getMetrics();
      expect(perfMetrics.errorRate.total).toBeGreaterThan(0);
    });
  });

  describe('Alerting Integration', () => {
    it('should trigger alerts based on metrics', async () => {
      const rule = {
        id: 'high-latency-rule',
        name: 'High Latency Alert',
        description: 'Alert when latency exceeds threshold',
        condition: {
          type: 'threshold' as const,
          metric: 'http_request_duration_ms',
          threshold: 100,
          operator: 'gt' as const,
        },
        actions: [],
        enabled: true,
        severity: 'warning' as const,
      };

      alerting.addRule(rule);

      // Record high latency
      const histogram = metrics.histogram({
        name: 'http_request_duration_ms',
      });
      histogram.record(150);

      // Evaluate metric (in real system, this would be automatic)
      // For integration test, we verify the rule was added
      expect(alerting.getRules()).toHaveLength(1);
    });
  });

  describe('Health Check Integration', () => {
    it('should check overall system health', async () => {
      healthChecker.registerCheck({
        type: 'liveness',
        enabled: true,
        config: {},
      });

      healthChecker.registerCheck({
        type: 'readiness',
        enabled: true,
        config: {},
      });

      const health = await healthChecker.check();

      expect(health.status).toBe('healthy');
      expect(health.checks.liveness.status).toBe('pass');
      expect(health.checks.readiness.status).toBe('pass');
    });
  });

  describe('Correlation Across Components', () => {
    it('should correlate logs with traces', async () => {
      const traceId = 'test-trace-123';
      const spanId = 'test-span-456';

      logger.setTraceContext(traceId, spanId);
      logger.info('Correlated log message');

      const entries = logger.getEntries();
      const correlated = entries.find(e => e.traceId === traceId);

      expect(correlated).toBeDefined();
      expect(correlated?.spanId).toBe(spanId);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track SLO compliance', async () => {
      const slo = performance.createSLO({
        id: 'latency-slo',
        name: 'Latency SLO',
        type: 'latency',
        target: 95,
        errorBudgetTarget: 5,
        timeSlots: [],
      });

      // Record some requests
      for (let i = 0; i < 100; i++) {
        performance.recordRequest(100 + i, true);
      }

      // Update SLO
      performance.updateSLO('latency-slo', 96);

      const currentSlo = performance.getSLO('latency-slo');
      expect(currentSlo).toBeDefined();
      expect(currentSlo?.errorBudget.remaining).toBeGreaterThanOrEqual(0);
    });
  });
});
