/**
 * Integration tests for the observability system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Observability, createObservability } from '../src';
import { ObservabilityConfig, LogLevel } from '../src/types';

describe('Observability Integration', () => {
  let observability: Observability;

  beforeEach(() => {
    const config: ObservabilityConfig = {
      enabled: true,
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test',
      tracing: {
        enabled: true,
        sampleRate: 1.0,
        exporter: 'console',
        propagateHeaders: ['traceparent'],
        batchSize: 10,
        batchTimeout: 1000,
      },
      logging: {
        enabled: true,
        level: LogLevel.DEBUG,
        format: 'json',
        exporter: 'console',
        correlationEnabled: true,
      },
      profiling: {
        enabled: true,
        interval: 1000,
        duration: 5000,
        maxSamples: 1000,
        exporter: 'otlp',
      },
      memory: {
        enabled: true,
        samplingInterval: 1000,
        heapSnapshotInterval: 10000,
        leakDetectionThreshold: 20,
      },
      inspection: {
        enabled: true,
        recordHeaders: true,
        recordBody: true,
        maxBodySize: 1024,
        maskSensitiveHeaders: ['authorization', 'cookie'],
      },
      recording: {
        enabled: true,
        maxSessionDuration: 60000,
        maxFramesPerSession: 1000,
        autoRecordOnError: true,
      },
    };

    observability = createObservability(config);
  });

  describe('initialization', () => {
    it('should initialize all components', async () => {
      await observability.initialize();

      const health = observability.getHealthStatus();
      expect(health.initialized).toBe(true);
    });

    it('should provide access to all components', async () => {
      await observability.initialize();

      expect(observability.getTracer()).toBeDefined();
      expect(observability.getLogger()).toBeDefined();
      expect(observability.getLogStream()).toBeDefined();
      expect(observability.getCPUProfiler()).toBeDefined();
      expect(observability.getMemoryProfiler()).toBeDefined();
      expect(observability.getLeakDetector()).toBeDefined();
      expect(observability.getHTTPInspector()).toBeDefined();
      expect(observability.getDebugRecorder()).toBeDefined();
    });
  });

  describe('tracing integration', () => {
    it('should create spans with trace context', async () => {
      await observability.initialize();

      const tracer = observability.getTracer();
      const { span, context } = tracer.startSpan('test-operation');

      expect(span).toBeDefined();
      expect(context.traceId).toBeDefined();
      expect(context.spanId).toBeDefined();
    });
  });

  describe('logging integration', () => {
    it('should correlate logs with traces', async () => {
      await observability.initialize();

      const logger = observability.getLogger();
      const tracer = observability.getTracer();

      const { context } = tracer.startSpan('test-span');
      logger.setTraceContext(context.traceId, context.spanId);
      logger.info('correlated log');

      const entries = logger.getEntries();
      const lastEntry = entries[entries.length - 1];

      expect(lastEntry.traceId).toBe(context.traceId);
      expect(lastEntry.spanId).toBe(context.spanId);
    });
  });

  describe('profiling integration', () => {
    it('should start and stop CPU profiling', async () => {
      await observability.initialize();

      const profiler = observability.getCPUProfiler();
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const profile = profiler.stop();
      expect(profile).toBeDefined();
      expect(profile.samples.length).toBeGreaterThan(0);
    });
  });

  describe('memory profiling integration', () => {
    it('should track memory usage', async () => {
      await observability.initialize();

      const profiler = observability.getMemoryProfiler();
      profiler.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const timeline = profiler.stop();
      expect(timeline.length).toBeGreaterThan(0);
    });
  });

  describe('leak detection integration', () => {
    it('should monitor for memory leaks', async () => {
      await observability.initialize();

      const detector = observability.getLeakDetector();
      const report = detector.getDetectionReport();

      expect(report).toHaveProperty('isMonitoring');
      expect(report).toHaveProperty('leakDetected');
    });
  });

  describe('HTTP inspection integration', () => {
    it('should intercept and record HTTP requests', async () => {
      await observability.initialize();

      const inspector = observability.getHTTPInspector();

      // Note: Actual fetch interception testing would require
      // a more complex setup with network mocking
      const stats = inspector.getStatistics();
      expect(stats).toHaveProperty('totalRequests');
    });
  });

  describe('debug recording integration', () => {
    it('should create debug sessions', async () => {
      await observability.initialize();

      const recorder = observability.getDebugRecorder();
      const sessionId = recorder.startSession('test-session');

      expect(sessionId).toBeDefined();

      const session = recorder.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.name).toBe('test-session');
    });
  });

  describe('export functionality', () => {
    it('should export all observability data', async () => {
      await observability.initialize();

      const data = observability.exportData();

      expect(data).toHaveProperty('traces');
      expect(data).toHaveProperty('logs');
      expect(data).toHaveProperty('profiles');
      expect(data).toHaveProperty('memory');
      expect(data).toHaveProperty('inspection');
      expect(data).toHaveProperty('recordings');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await observability.initialize();
      await observability.shutdown();

      const health = observability.getHealthStatus();
      expect(health.initialized).toBe(false);
    });
  });
});

describe('createObservability', () => {
  it('should create observability with default config', () => {
    const obs = createObservability();

    expect(obs).toBeDefined();
    expect(obs.getTracer()).toBeDefined();
    expect(obs.getLogger()).toBeDefined();
  });

  it('should merge partial config with defaults', () => {
    const obs = createObservability({
      serviceName: 'custom-service',
    });

    const logger = obs.getLogger();
    expect(logger).toBeDefined();
  });
});
