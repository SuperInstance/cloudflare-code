/**
 * Service Mesh Tests
 * Comprehensive test suite for service mesh components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitState,
  RetryExecutor,
  BackoffStrategies,
  TimeoutManager,
  ServiceLoadBalancer,
  MetricsCollector,
  Tracer,
  TrafficManager,
  ServiceMeshControlPlane
} from '../index';

// ========================================================================
// Circuit Breaker Tests
// ========================================================================

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      halfOpenMaxCalls: 2
    });
  });

  afterEach(() => {
    breaker.reset();
  });

  it('should start in closed state', () => {
    expect(breaker.getCircuitState()).toBe(CircuitState.CLOSED);
  });

  it('should open after failure threshold', async () => {
    const failingRequest = async () => {
      throw new Error('Request failed');
    };

    // Execute failing requests
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingRequest);
      } catch (error) {
        // Expected to fail
      }
    }

    expect(breaker.getCircuitState()).toBe(CircuitState.OPEN);
  });

  it('should transition to half-open after timeout', async () => {
    // Force circuit open
    const failingRequest = async () => {
      throw new Error('Request failed');
    };

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingRequest);
      } catch (error) {
        // Expected to fail
      }
    }

    expect(breaker.getCircuitState()).toBe(CircuitState.OPEN);

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Next request should transition to half-open
    try {
      await breaker.execute(async () => 'success');
    } catch (error) {
      // Expected to fail in half-open
    }

    expect(breaker.getCircuitState()).toBe(CircuitState.HALF_OPEN);
  });

  it('should close after success threshold in half-open', async () => {
    // Set to half-open manually
    breaker['state'].state = CircuitState.HALF_OPEN;
    breaker['state'].successCount = 0;

    const successfulRequest = async () => 'success';

    // Execute successful requests
    await breaker.execute(successfulRequest);
    await breaker.execute(successfulRequest);

    expect(breaker.getCircuitState()).toBe(CircuitState.CLOSED);
  });

  it('should record statistics', async () => {
    await breaker.execute(async () => 'success');

    const stats = breaker.getStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.successfulRequests).toBe(1);
  });
});

// ========================================================================
// Retry Executor Tests
// ========================================================================

describe('RetryExecutor', () => {
  let executor: RetryExecutor;

  beforeEach(() => {
    executor = new RetryExecutor({
      policy: {
        maxAttempts: 3,
        initialBackoff: 100,
        maxBackoff: 1000,
        backoffMultiplier: 2
      }
    });
  });

  it('should retry on failure', async () => {
    let attempts = 0;

    const flakyRequest = async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Temporary failure');
      }
      return 'success';
    };

    const result = await executor.execute(flakyRequest);

    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });

  it('should exhaust retries after max attempts', async () => {
    const alwaysFailingRequest = async () => {
      throw new Error('Permanent failure');
    };

    await expect(executor.execute(alwaysFailingRequest)).rejects.toThrow();
  });

  it('should calculate exponential backoff', () => {
    const delay1 = executor.calculateBackoff(1);
    const delay2 = executor.calculateBackoff(2);
    const delay3 = executor.calculateBackoff(3);

    expect(delay2).toBeGreaterThan(delay1);
    expect(delay3).toBeGreaterThan(delay2);
  });

  it('should add jitter to backoff', () => {
    executor.updatePolicy({ jitterEnabled: true, jitterFactor: 0.1 });

    const delays = Array.from({ length: 10 }, (_, i) =>
      executor.calculateBackoff(i + 1)
    );

    // Check that not all delays are the same (jitter is working)
    const uniqueDelays = new Set(delays);
    expect(uniqueDelays.size).toBeGreaterThan(1);
  });
});

// ========================================================================
// Timeout Manager Tests
// ========================================================================

describe('TimeoutManager', () => {
  let manager: TimeoutManager;

  beforeEach(() => {
    manager = new TimeoutManager({
      connectionTimeout: 1000,
      requestTimeout: 2000,
      idleTimeout: 5000
    });
  });

  it('should timeout slow requests', async () => {
    const slowRequest = async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return 'completed';
    };

    await expect(
      manager.executeWithTimeout(slowRequest, 1000)
    ).rejects.toThrow();
  });

  it('should complete fast requests', async () => {
    const fastRequest = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'completed';
    };

    const result = await manager.executeWithTimeout(fastRequest, 1000);
    expect(result).toBe('completed');
  });

  it('should use configured timeout', async () => {
    const request = async () => 'success';

    const result = await manager.executeWithRequestTimeout(request);
    expect(result).toBe('success');
  });
});

// ========================================================================
// Load Balancer Tests
// ========================================================================

describe('ServiceLoadBalancer', () => {
  let balancer: ServiceLoadBalancer;
  let mockEndpoints: any;

  beforeEach(() => {
    balancer = new ServiceLoadBalancer({
      strategy: { type: 'round-robin' }
    });

    mockEndpoints = {
      serviceName: 'test-service',
      instances: [
        {
          id: 'instance-1',
          serviceName: 'test-service',
          host: 'host1.example.com',
          port: 8080,
          protocol: 'http' as const,
          healthStatus: 'healthy' as const,
          lastHeartbeat: Date.now(),
          version: '1.0.0',
          tags: [],
          zone: 'us-east-1a',
          region: 'us-east-1',
          weight: 100,
          metadata: { activeConnections: 10 }
        },
        {
          id: 'instance-2',
          serviceName: 'test-service',
          host: 'host2.example.com',
          port: 8080,
          protocol: 'http' as const,
          healthStatus: 'healthy' as const,
          lastHeartbeat: Date.now(),
          version: '1.0.0',
          tags: [],
          zone: 'us-east-1b',
          region: 'us-east-1',
          weight: 100,
          metadata: { activeConnections: 5 }
        },
        {
          id: 'instance-3',
          serviceName: 'test-service',
          host: 'host3.example.com',
          port: 8080,
          protocol: 'http' as const,
          healthStatus: 'unhealthy' as const,
          lastHeartbeat: Date.now(),
          version: '1.0.0',
          tags: [],
          zone: 'us-east-1c',
          region: 'us-east-1',
          weight: 100,
          metadata: { activeConnections: 0 }
        }
      ],
      timestamp: Date.now()
    };
  });

  it('should select healthy instances only', () => {
    const instance = balancer.selectInstance(mockEndpoints);

    expect(instance).toBeDefined();
    expect(instance!.healthStatus).toBe('healthy');
  });

  it('should use round-robin strategy', () => {
    const instance1 = balancer.selectInstance(mockEndpoints);
    const instance2 = balancer.selectInstance(mockEndpoints);
    const instance3 = balancer.selectInstance(mockEndpoints);

    expect(instance1!.id).not.toBe(instance2!.id);
    expect(instance2!.id).not.toBe(instance3!.id);
  });

  it('should use least-connections strategy', () => {
    balancer = new ServiceLoadBalancer({
      strategy: { type: 'least-connections' }
    });

    const instance = balancer.selectInstance(mockEndpoints);

    // Should select instance-2 with 5 connections
    expect(instance!.id).toBe('instance-2');
  });

  it('should record request statistics', () => {
    const instance = balancer.selectInstance(mockEndpoints)!;

    balancer.recordRequest(instance.id, true, 150);

    const stats = balancer.getStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.successfulRequests).toBe(1);
  });

  it('should respect session affinity', () => {
    balancer = new ServiceLoadBalancer({
      strategy: { type: 'round-robin' },
      stickySessions: true
    });

    const instance1 = balancer.selectInstance(mockEndpoints, {
      sessionId: 'session-123'
    });

    const instance2 = balancer.selectInstance(mockEndpoints, {
      sessionId: 'session-123'
    });

    expect(instance1!.id).toBe(instance2!.id);
  });
});

// ========================================================================
// Metrics Collector Tests
// ========================================================================

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector(120, 1000);
  });

  it('should register services', () => {
    collector.register('test-service', 'instance-1');

    const metrics = collector.getMetrics('test-service', 'instance-1');

    expect(metrics).toBeDefined();
    expect(metrics!.serviceName).toBe('test-service');
  });

  it('should record requests', () => {
    collector.register('test-service', 'instance-1');

    collector.recordRequest('test-service', 'instance-1', true, 100);
    collector.recordRequest('test-service', 'instance-1', false, 200);

    const metrics = collector.getMetrics('test-service', 'instance-1');

    expect(metrics!.requestCount).toBe(2);
    expect(metrics!.successCount).toBe(1);
    expect(metrics!.errorCount).toBe(1);
  });

  it('should calculate latency metrics', () => {
    collector.register('test-service', 'instance-1');

    // Record various latencies
    [100, 150, 200, 250, 300].forEach(latency => {
      collector.recordRequest('test-service', 'instance-1', true, latency);
    });

    const metrics = collector.getMetrics('test-service', 'instance-1');

    expect(metrics!.latency.min).toBe(100);
    expect(metrics!.latency.max).toBe(300);
    expect(metrics!.latency.mean).toBeGreaterThan(0);
  });

  it('should provide summary across all services', () => {
    collector.register('service-1', 'instance-1');
    collector.register('service-2', 'instance-1');

    collector.recordRequest('service-1', 'instance-1', true, 100);
    collector.recordRequest('service-2', 'instance-1', false, 200);

    const summary = collector.getSummary();

    expect(summary.totalServices).toBe(2);
    expect(summary.totalRequests).toBe(2);
    expect(summary.totalSuccesses).toBe(1);
    expect(summary.totalErrors).toBe(1);
  });
});

// ========================================================================
// Tracer Tests
// ========================================================================

describe('Tracer', () => {
  let tracer: Tracer;

  beforeEach(() => {
    tracer = new Tracer('test-service');
  });

  it('should start and finish traces', () => {
    const context = tracer.startTrace('testOperation', {
      'tag1': 'value1'
    });

    expect(context.traceId).toBeDefined();
    expect(context.spanId).toBeDefined();

    const trace = tracer.finishTrace(context);

    expect(trace).toBeDefined();
    expect(trace.traceId).toBe(context.traceId);
    expect(trace.spans.length).toBeGreaterThan(0);
  });

  it('should create child spans', () => {
    const parentSpan = tracer.startSpan({
      operationName: 'parentOperation',
      serviceName: 'test-service'
    });

    const childSpan = tracer.createChildSpan(
      parentSpan.spanId,
      'childOperation'
    );

    expect(childSpan).toBeDefined();
    expect(childSpan!.parentSpanId).toBe(parentSpan.spanId);
  });

  it('should record errors in spans', () => {
    const span = tracer.startSpan({
      operationName: 'testOperation',
      serviceName: 'test-service'
    });

    const error = new Error('Test error');
    tracer.recordError(span.spanId, error);

    expect(span.tags['error']).toBe('true');
    expect(span.tags['error.message']).toBe('Test error');
  });

  it('should extract and inject trace context', () => {
    const context = tracer.startTrace('testOperation');

    const headers = new Headers();
    tracer.injectContext(headers, context);

    const extracted = tracer.extractContext(headers);

    expect(extracted).toBeDefined();
    expect(extracted!.traceId).toBe(context.traceId);
  });
});

// ========================================================================
// Traffic Manager Tests
// ========================================================================

describe('TrafficManager', () => {
  let manager: TrafficManager;

  beforeEach(() => {
    manager = new TrafficManager();
  });

  it('should route requests based on rules', () => {
    manager.addRule({
      id: 'rule-1',
      name: 'API Rule',
      priority: 100,
      enabled: true,
      match: {
        pathPrefix: '/api/'
      },
      route: {
        type: 'service',
        destination: 'api-service'
      }
    });

    const request = new Request('https://example.com/api/users');
    const result = manager.route(request);

    expect(result.matched).toBe(true);
    expect(result.destination).toBe('api-service');
  });

  it('should not route unmatched requests', () => {
    manager.addRule({
      id: 'rule-1',
      name: 'API Rule',
      priority: 100,
      enabled: true,
      match: {
        pathPrefix: '/api/'
      },
      route: {
        type: 'service',
        destination: 'api-service'
      }
    });

    const request = new Request('https://example.com/web/page');
    const result = manager.route(request);

    expect(result.matched).toBe(false);
  });

  it('should route based on traffic splits', () => {
    manager.addSplit({
      serviceName: 'user-service',
      versions: [
        { name: 'v1', weight: 70, instances: ['v1-1'] },
        { name: 'v2', weight: 30, instances: ['v2-1'] }
      ],
      defaultVersion: 'v1'
    });

    const result = manager.routeSplit('user-service', 'session-123');

    expect(result).toBeDefined();
    expect(['v1', 'v2']).toContain(result!.version);
  });
});

// ========================================================================
// Control Plane Tests
// ========================================================================

describe('ServiceMeshControlPlane', () => {
  let controlPlane: ServiceMeshControlPlane;

  beforeEach(() => {
    controlPlane = new ServiceMeshControlPlane('test-mesh');
  });

  afterEach(() => {
    controlPlane.destroy();
  });

  it('should provide mesh configuration', () => {
    const config = controlPlane.getMeshConfig();

    expect(config.meshId).toBe('test-mesh');
    expect(config.services).toBeDefined();
    expect(config.globalPolicies).toBeDefined();
  });

  it('should add services to mesh', () => {
    controlPlane.addService({
      name: 'test-service',
      namespace: 'default',
      version: '1.0.0',
      ports: [
        { name: 'http', port: 8080, protocol: 'http' }
      ],
      discovery: {
        enabled: true,
        type: 'registry',
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          unhealthyThreshold: 3,
          healthyThreshold: 2
        }
      },
      loadBalancing: { type: 'round-robin' },
      timeout: {
        connection: 10000,
        request: 30000,
        idle: 60000
      },
      metadata: {}
    });

    const service = controlPlane.getService('test-service', 'default');

    expect(service).toBeDefined();
    expect(service!.name).toBe('test-service');
  });

  it('should validate mesh health', async () => {
    const health = await controlPlane.validateMeshHealth();

    expect(health).toBeDefined();
    expect(health.healthy).toBe(true);
    expect(health.services).toBeDefined();
  });

  it('should export and import configuration', () => {
    const originalConfig = controlPlane.getMeshConfig();

    const exported = controlPlane.exportConfig();

    const newControlPlane = new ServiceMeshControlPlane('test-mesh-2');
    newControlPlane.importConfig(exported);

    const importedConfig = newControlPlane.getMeshConfig();

    expect(importedConfig.meshId).toBe(originalConfig.meshId);

    newControlPlane.destroy();
  });
});

// ========================================================================
// Integration Tests
// ========================================================================

describe('Service Mesh Integration', () => {
  it('should handle end-to-end request flow', async () => {
    // Create mesh components
    const collector = new MetricsCollector();
    const tracer = new Tracer('test-service');
    const breaker = new CircuitBreaker('backend-service', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 5000
    });

    // Register service
    collector.register('backend-service', 'instance-1');

    // Create trace
    const context = tracer.startTrace('processRequest');

    try {
      // Execute request through circuit breaker
      const result = await breaker.execute(async () => {
        // Simulate request
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      });

      // Record metrics
      collector.recordRequest('backend-service', 'instance-1', true, 100);

      // Finish trace
      tracer.finishTrace(context);

      expect(result).toBe('success');

      // Verify metrics
      const metrics = collector.getMetrics('backend-service', 'instance-1');
      expect(metrics!.requestCount).toBe(1);

      // Verify trace
      const trace = tracer.getTrace(context.traceId);
      expect(trace).toBeDefined();

    } finally {
      tracer.clearTraces();
      collector.clear();
    }
  });

  it('should handle failures gracefully', async () => {
    const breaker = new CircuitBreaker('flaky-service', {
      failureThreshold: 2,
      successThreshold: 1,
      timeout: 1000
    });

    let failureCount = 0;

    const flakyRequest = async () => {
      failureCount++;
      if (failureCount <= 2) {
        throw new Error('Service unavailable');
      }
      return 'recovered';
    };

    // First two attempts should fail
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(flakyRequest);
      } catch (error) {
        // Expected to fail
      }
    }

    // Circuit should be open
    expect(breaker.getCircuitState()).toBe(CircuitState.OPEN);

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Next request should work
    const result = await breaker.execute(flakyRequest);

    expect(result).toBe('recovered');
  });
});
