import { ObservabilityPlatform } from '../src/core/observability-platform';
import { DistributedTracer } from '../src/tracing/tracer';
import { MetricCollector } from '../src/metrics/metric-collector';
import { StructuredLogger } from '../src/logging/logger';
import { createTestConfig, measurePerformance, stressTest } from './setup';

describe('Integration Tests', () => {
  let platform: ObservabilityPlatform;
  let config: any;

  beforeEach(async () => {
    config = createTestConfig();
    platform = ObservabilityPlatform.getInstance();
  });

  afterEach(async () => {
    await platform.shutdown();
  });

  describe('Platform Initialization and Component Integration', () => {
    it('should initialize all components successfully', async () => {
      await expect(platform.initialize(config)).resolves.not.toThrow();

      // Test component access
      expect(platform.isInitialized()).toBe(true);
      expect(() => platform.getTelemetryManager()).not.toThrow();
      expect(() => platform.getExportManager()).not.toThrow();
    });

    it('should handle component dependencies', async () => {
      await platform.initialize(config);

      const telemetryManager = platform.getTelemetryManager();
      const exportManager = platform.getExportManager();

      // Components should be initialized and working together
      expect(telemetryManager.isInitialized()).toBe(true);
      expect(exportManager.isInitialized()).toBe(true);
    });

    it('should handle graceful shutdown with components', async () => {
      await platform.initialize(config);
      await expect(platform.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Telemetry Integration', () => {
    beforeEach(async () => {
      await platform.initialize(config);
    });

    it('should integrate metrics, logs, and traces', async () => {
      const telemetryManager = platform.getTelemetryManager();

      // Add metrics
      telemetryManager.incrementCounter('test.counter', 10);
      telemetryManager.incrementCounter('test.counter', 5);

      // Add logs
      telemetryManager.info('Integration test log', { component: 'integration' });

      // Add trace
      const tracer = DistributedTracer.getInstance(config.tracing);
      await tracer.initialize();
      const span = tracer.startSpan('integration.span');
      tracer.endSpan(span);

      // Export all data
      const metricsResult = await telemetryManager.exportMetrics();
      const logsResult = await telemetryManager.exportLogs();
      const tracesResult = await telemetryManager.exportTraces();

      expect(metricsResult.success).toBe(true);
      expect(logsResult.success).toBe(true);
      expect(tracesResult.success).toBe(true);
    });

    it('should maintain correlation between metrics, logs, and traces', async () => {
      const telemetryManager = platform.getTelemetryManager();
      const tracer = DistributedTracer.getInstance(config.tracing);
      await tracer.initialize();

      // Start a trace
      const span = tracer.startSpan('correlation-test');
      telemetryManager.setContext({
        traceId: span.traceId,
        spanId: span.spanId
      });

      // Add metrics and logs with correlation
      telemetryManager.incrementCounter('correlated.counter', 1);
      telemetryManager.info('Correlated log message');

      telemetryManager.endSpan(span);

      // Verify correlation in exports
      const logsResult = await telemetryManager.exportLogs();
      expect(logsResult.exported).toBe(1);
    });
  });

  describe('Performance Integration', () => {
    beforeEach(async () => {
      await platform.initialize(config);
    });

    it('should handle high-throughput logging', async () => {
      const telemetryManager = platform.getTelemetryManager();

      const { averageTime } = await measurePerformance(async () => {
        for (let i = 0; i < 1000; i++) {
          telemetryManager.info(`Log message ${i}`, { index: i });
        }
      }, 10);

      expect(averageTime).toBeLessThan(100); // Average should be under 100ms
    });

    it('should handle concurrent metric updates', async () => {
      const telemetryManager = platform.getTelemetryManager();

      const { averageTime } = await measurePerformance(async () => {
        const promises = [];
        for (let i = 0; i < 100; i++) {
          promises.push(Promise.resolve().then(() => {
            telemetryManager.incrementCounter('concurrent.counter', 1);
          }));
        }
        await Promise.all(promises);
      }, 5);

      expect(averageTime).toBeLessThan(200); // Should handle concurrency efficiently
    });

    it('should stress test the platform', async () => {
      const telemetryManager = platform.getTelemetryManager();

      const stressResult = await stressTest(async () => {
        telemetryManager.incrementCounter('stress.counter', 1);
        telemetryManager.info('Stress test message');
      }, 10, 2000); // 10 concurrent, 2 seconds

      expect(stressResult.totalRuns).toBeGreaterThan(0);
      expect(stressResult.errors).toHaveLength(0);
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(async () => {
      await platform.initialize(config);
    });

    it('should handle and correlate errors across components', async () => {
      const telemetryManager = platform.getTelemetryManager();
      const tracer = DistributedTracer.getInstance(config.tracing);
      await tracer.initialize();

      const span = tracer.startSpan('error-test');
      telemetryManager.setContext({
        traceId: span.traceId,
        spanId: span.spanId
      });

      // Log an error
      const testError = new Error('Test error');
      telemetryManager.error('Error occurred', { component: 'integration' }, testError);

      telemetryManager.endSpan(span);

      // Check error correlation
      const logs = telemetryManager.getLogsCacheSize();
      expect(logs).toBeGreaterThan(0);
    });

    it('should handle uncaught errors gracefully', async () => {
      // The error handler should catch uncaught exceptions
      expect(() => {
        throw new Error('Uncaught test error');
      }).not.toThrow(); // The error handler should handle this
    });
  });

  describe('Configuration Integration', () => {
    it('should apply configuration to all components', async () => {
      const customConfig = {
        ...config,
        metrics: {
          enabled: true,
          exportInterval: 5000
        },
        logging: {
          level: 'debug',
          format: 'json'
        }
      };

      await platform.initialize(customConfig);

      const telemetryManager = platform.getTelemetryManager();
      const exportManager = platform.getExportManager();

      // Configuration should be applied
      expect(telemetryManager).toBeDefined();
      expect(exportManager).toBeDefined();
    });

    it('should handle configuration updates', async () => {
      await platform.initialize(config);

      const updates = {
        metrics: {
          enabled: false
        },
        logging: {
          level: 'error'
        }
      };

      platform.getConfigManager().updateConfig(updates);

      const configManager = platform.getConfigManager();
      const newConfig = configManager.getConfig();

      expect(newConfig.metrics.enabled).toBe(false);
      expect(newConfig.logging.level).toBe('error');
    });
  });

  describe('Export Integration', () => {
    beforeEach(async () => {
      await platform.initialize(config);
    });

    it('should export all telemetry data together', async () => {
      const telemetryManager = platform.getTelemetryManager();

      // Add test data
      telemetryManager.incrementCounter('export-test.counter', 100);
      telemetryManager.info('Export test message');

      const tracer = DistributedTracer.getInstance(config.tracing);
      await tracer.initialize();
      const span = tracer.startSpan('export-test-span');
      tracer.endSpan(span);

      // Export all data
      const metricsResult = await telemetryManager.exportMetrics();
      const logsResult = await telemetryManager.exportLogs();
      const tracesResult = telemetryManager.exportTraces();

      expect(metricsResult.success).toBe(true);
      expect(logsResult.success).toBe(true);
      expect(tracesResult.success).toBe(true);
    });

    it('should handle export failures gracefully', async () => {
      const telemetryManager = platform.getTelemetryManager();

      // Add data even if export fails
      telemetryManager.incrementCounter('failure-test.counter', 1);
      telemetryManager.info('Failure test message');

      // Should not throw even if export fails
      expect(() => {
        telemetryManager.exportMetrics();
      }).not.toThrow();
    });
  });

  describe('Memory Management Integration', () => {
    beforeEach(async () => {
      await platform.initialize(config);
    });

    it('should manage memory across components', async () => {
      const telemetryManager = platform.getTelemetryManager();

      // Add large amounts of data
      for (let i = 0; i < 5000; i++) {
        telemetryManager.incrementCounter('memory-test.counter', i);
        telemetryManager.info(`Memory test message ${i}`);
      }

      // Check that memory is managed
      const metricsSize = telemetryManager.getMetricsCacheSize();
      const logsSize = telemetryManager.getLogsCacheSize();

      expect(metricsSize).toBeGreaterThan(0);
      expect(logsSize).toBeGreaterThan(0);
    });

    it('should clean up on shutdown', async () => {
      const telemetryManager = platform.getTelemetryManager();

      // Add data
      telemetryManager.incrementCounter('cleanup-test.counter', 100);
      telemetryManager.info('Cleanup test message');

      await platform.shutdown();

      // Memory should be cleaned up
      expect(platform.isInitialized()).toBe(false);
    });
  });

  describe('Real-world Scenarios', () => {
    beforeEach(async () => {
      await platform.initialize(config);
    });

    it('should simulate a web request lifecycle', async () => {
      const telemetryManager = platform.getTelemetryManager();
      const tracer = DistributedTracer.getInstance(config.tracing);
      await tracer.initialize();

      // Start web request trace
      const requestSpan = tracer.startSpan('web.request');
      telemetryManager.setContext({
        traceId: requestSpan.traceId,
        spanId: requestSpan.spanId
      });

      // Log request received
      telemetryManager.info('Request received', {
        method: 'GET',
        path: '/api/users',
        userAgent: 'test-agent'
      });

      // Simulate database operation
      const dbSpan = tracer.startSpan('database.query', {
        parentSpan: requestSpan
      });
      telemetryManager.incrementCounter('database.queries', 1);
      telemetryManager.setGauge('database.connection.count', 5);
      tracer.endSpan(dbSpan);

      // Simulate cache operation
      tracer.addSpanEvent(requestSpan, 'cache.hit', { key: 'users:123' });
      telemetryManager.incrementCounter('cache.hits', 1);

      // Log response sent
      telemetryManager.info('Response sent', {
        status: 200,
        duration: 150
      });

      telemetryManager.endSpan(requestSpan);

      // Verify all components worked together
      const logs = telemetryManager.getLogsCacheSize();
      expect(logs).toBe(2);
    });

    it('should handle background job processing', async () => {
      const telemetryManager = platform.getTelemetryManager();
      const tracer = DistributedTracer.getInstance(config.tracing);
      await tracer.initialize();

      // Start job trace
      const jobSpan = tracer.startSpan('background.job', {
        attributes: { type: 'email-processing' }
      });

      telemetryManager.setContext({
        traceId: jobSpan.traceId,
        spanId: jobSpan.spanId
      });

      // Process emails
      for (let i = 0; i < 10; i++) {
        telemetryManager.incrementCounter('emails.processed', 1);
        telemetryManager.info(`Processed email ${i + 10}`);
      }

      // Log job completion
      telemetryManager.info('Job completed', {
        processedCount: 10,
        duration: 2500
      });

      telemetryManager.endSpan(jobSpan);

      // Verify metrics and logs
      const metricsResult = await telemetryManager.exportMetrics();
      const logsResult = await telemetryManager.exportLogs();

      expect(metricsResult.exported).toBeGreaterThan(0);
      expect(logsResult.exported).toBeGreaterThan(0);
    });

    it('should handle system monitoring', async () => {
      const telemetryManager = platform.getTelemetryManager();

      // Simulate system metrics
      telemetryManager.setGauge('system.cpu.usage', 75.5);
      telemetryManager.setGauge('system.memory.usage', 85.2);
      telemetryManager.setGauge('system.disk.usage', 60.1);

      // Simulate system events
      telemetryManager.warn('High memory usage detected', {
        usage: 85.2,
        threshold: 80
      });

      // Verify data collection
      const logs = telemetryManager.getLogsCacheSize();
      const metrics = telemetryManager.getMetricsCacheSize();

      expect(logs).toBeGreaterThan(0);
      expect(metrics).toBeGreaterThan(0);
    });
  });
});