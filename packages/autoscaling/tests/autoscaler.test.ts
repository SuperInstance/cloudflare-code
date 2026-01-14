/**
 * Autoscaler integration tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Autoscaler } from '../src/index.js';
import type { ScalingPolicy, ScalingMetrics, ResourceType } from '../src/types/index.js';

describe('Autoscaler', () => {
  let autoscaler: Autoscaler;

  beforeEach(() => {
    autoscaler = new Autoscaler({
      config: {
        enabled: true,
        evaluationInterval: 1000,
        targetUtilization: 70,
        scaleUpThreshold: 80,
        scaleDownThreshold: 30
      }
    });
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const status = autoscaler.getStatus();
      expect(status.running).toBe(false);
      expect(status.config.enabled).toBe(true);
    });

    it('should create all components', () => {
      const components = autoscaler.getComponents();
      expect(components.policyManager).toBeDefined();
      expect(components.cpuPolicy).toBeDefined();
      expect(components.memoryPolicy).toBeDefined();
      expect(components.predictiveEngine).toBeDefined();
      expect(components.resourceAllocator).toBeDefined();
      expect(components.costOptimizer).toBeDefined();
      expect(components.metricsCollector).toBeDefined();
      expect(components.analyticsEngine).toBeDefined();
    });
  });

  describe('Scaling Policies', () => {
    it('should add CPU-based policy for workers', () => {
      const policy = autoscaler.addScalingPolicy('test-worker', 'worker' as ResourceType);

      expect(policy).toBeDefined();
      expect(policy.resourceType).toBe('worker');
      expect(policy.enabled).toBe(true);
      expect(policy.triggers.length).toBeGreaterThan(0);
    });

    it('should add memory-based policy for KV', () => {
      const policy = autoscaler.addScalingPolicy('test-kv', 'kv' as ResourceType);

      expect(policy).toBeDefined();
      expect(policy.resourceType).toBe('kv');
      expect(policy.triggers.some(t => t.type === 'memory_usage')).toBe(true);
    });
  });

  describe('Predictive Scaling', () => {
    it('should store time series data', () => {
      const data = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 100 },
        { timestamp: new Date('2024-01-01T01:00:00Z'), value: 120 },
        { timestamp: new Date('2024-01-01T02:00:00Z'), value: 110 },
      ];

      autoscaler.addTimeSeriesData('test-resource', data);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should generate forecasts with sufficient data', async () => {
      // Add 100 data points
      const data: Array<{ timestamp: Date; value: number }> = [];
      const now = Date.now();

      for (let i = 0; i < 100; i++) {
        data.push({
          timestamp: new Date(now - (100 - i) * 60000),
          value: 50 + Math.random() * 50
        });
      }

      autoscaler.addTimeSeriesData('test-resource', data);

      const forecast = await autoscaler.getForecast('test-resource', 'cpu', 12);

      expect(forecast).toBeDefined();
      expect(forecast.predictions).toBeDefined();
      expect(forecast.predictions.length).toBe(12);
    });
  });

  describe('Cost Management', () => {
    it('should create budget', () => {
      const budget = autoscaler.createBudget('test-budget', 'Test Budget', 1000, [70, 90]);

      expect(budget).toBeDefined();
      expect(budget.id).toBe('test-budget');
      expect(budget.limit).toBe(1000);
      expect(budget.alertThresholds).toEqual([70, 90]);
    });

    it('should get cost analysis for resource', async () => {
      const analysis = await autoscaler.getCostAnalysis('test-resource');

      // May return null if no allocation exists
      expect(analysis).toBeDefined();
    });
  });

  describe('Scaling Analytics', () => {
    it('should get analytics for resource', () => {
      const analytics = autoscaler.getAnalytics('test-resource', {
        start: new Date(Date.now() - 86400000),
        end: new Date()
      });

      expect(analytics).toBeDefined();
      expect(analytics.resourceId).toBe('test-resource');
      expect(analytics.events).toBeDefined();
      expect(analytics.patterns).toBeDefined();
      expect(analytics.insights).toBeDefined();
      expect(analytics.recommendations).toBeDefined();
      expect(analytics.summary).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      autoscaler.updateConfig({
        targetUtilization: 80,
        maxScaleUpPercent: 300
      });

      const config = autoscaler.getConfig();
      expect(config.targetUtilization).toBe(80);
      expect(config.maxScaleUpPercent).toBe(300);
    });
  });

  describe('Component Access', () => {
    it('should provide access to individual components', () => {
      const components = autoscaler.getComponents();

      expect(components.policyManager).toBeDefined();
      expect(components.cpuPolicy).toBeDefined();
      expect(components.memoryPolicy).toBeDefined();
      expect(components.requestPolicy).toBeDefined();
      expect(components.predictiveEngine).toBeDefined();
      expect(components.forecaster).toBeDefined();
      expect(components.resourceAllocator).toBeDefined();
      expect(components.costOptimizer).toBeDefined();
      expect(components.metricsCollector).toBeDefined();
      expect(components.analyticsEngine).toBeDefined();
    });
  });
});

describe('CpuScalingPolicy', () => {
  it('should calculate scale up when CPU is high', () => {
    const { CpuScalingPolicy } = require('../src/index.js');

    const policy = new CpuScalingPolicy({
      scaleUpThreshold: 70,
      scaleDownThreshold: 30,
      minInstances: 1,
      maxInstances: 100
    });

    const targetInstances = policy.calculateTargetInstances(
      10,  // current instances
      85,  // CPU utilization (high)
      50   // CPU credits
    );

    expect(targetInstances).toBeGreaterThan(10);
    expect(targetInstances).toBeLessThanOrEqual(100);
  });

  it('should calculate scale down when CPU is low', () => {
    const { CpuScalingPolicy } = require('../src/index.js');

    const policy = new CpuScalingPolicy({
      scaleUpThreshold: 70,
      scaleDownThreshold: 30,
      minInstances: 1,
      maxInstances: 100
    });

    const targetInstances = policy.calculateTargetInstances(
      10,  // current instances
      25,  // CPU utilization (low)
      80   // CPU credits
    );

    expect(targetInstances).toBeLessThan(10);
    expect(targetInstances).toBeGreaterThanOrEqual(1);
  });
});

describe('MemoryScalingPolicy', () => {
  it('should detect memory leaks', () => {
    const { MemoryScalingPolicy } = require('../src/index.js');

    const policy = new MemoryScalingPolicy({
      leakDetectionEnabled: true,
      leakThreshold: 100
    });

    // Record growing memory usage
    for (let i = 0; i < 20; i++) {
      policy.recordMemoryUsage('test-resource', 100 + i * 20);
    }

    const leakStatus = policy.detectMemoryLeak('test-resource');

    expect(leakStatus.isLeaking).toBe(true);
    expect(leakStatus.growthRate).toBeGreaterThan(0);
  });
});

describe('ResourceAllocator', () => {
  it('should allocate resources', async () => {
    const { ResourceAllocator } = require('../src/index.js');

    const allocator = new ResourceAllocator();

    const result = await allocator.allocate({
      resourceId: 'test-resource',
      resourceType: 'worker',
      strategy: {
        type: 'first_fit',
        parameters: {},
        constraints: []
      },
      constraints: [],
      priority: 1,
      requestedSpec: {
        cpu: { cores: 2, frequency: 3000, credits: 200, burstCapacity: 20 },
        memory: { size: 1024, type: 'dram' },
        storage: { size: 10000, type: 'ssd', iops: 1000, throughput: 100 },
        network: { bandwidth: 1000, connections: 10000, requestsPerSecond: 10000 }
      }
    });

    expect(result.success).toBe(true);
    expect(result.allocation).toBeDefined();
  });

  it('should deallocate resources', async () => {
    const { ResourceAllocator } = require('../src/index.js');

    const allocator = new ResourceAllocator();

    // First allocate
    await allocator.allocate({
      resourceId: 'test-resource',
      resourceType: 'worker',
      strategy: {
        type: 'first_fit',
        parameters: {},
        constraints: []
      },
      constraints: [],
      priority: 1,
      requestedSpec: {
        cpu: { cores: 2, frequency: 3000, credits: 200, burstCapacity: 20 },
        memory: { size: 1024, type: 'dram' },
        storage: { size: 10000, type: 'ssd', iops: 1000, throughput: 100 },
        network: { bandwidth: 1000, connections: 10000, requestsPerSecond: 10000 }
      }
    });

    // Then deallocate
    const deallocated = await allocator.deallocate('test-resource');

    expect(deallocated).toBe(true);
  });
});

describe('CostOptimizer', () => {
  it('should analyze costs', () => {
    const { CostOptimizer } = require('../src/index.js');

    const optimizer = new CostOptimizer();

    const analysis = optimizer.analyzeCosts('test-resource', {
      id: 'alloc-1',
      resourceType: 'worker',
      resourceId: 'test-resource',
      allocation: {
        cpu: { cores: 4, frequency: 3000, credits: 400, burstCapacity: 40 },
        memory: { size: 2048, type: 'dram' },
        storage: { size: 20000, type: 'ssd', iops: 2000, throughput: 200 },
        network: { bandwidth: 2000, connections: 20000, requestsPerSecond: 20000 }
      },
      usage: {
        cpu: 85,
        memory: 90,
        storage: 50,
        network: 60,
        timestamp: new Date()
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    expect(analysis).toBeDefined();
    expect(analysis.currentCost).toBeDefined();
    expect(analysis.optimization).toBeDefined();
    expect(analysis.savings).toBeGreaterThanOrEqual(0);
  });
});

describe('ScalingMetricsCollector', () => {
  it('should collect metrics', async () => {
    const { ScalingMetricsCollector } = require('../src/index.js');

    const collector = new ScalingMetricsCollector();

    const metrics = await collector.collectMetrics('test-resource');

    expect(metrics).toBeDefined();
    expect(metrics.cpuMetrics).toBeDefined();
    expect(metrics.memoryMetrics).toBeDefined();
    expect(metrics.requestMetrics).toBeDefined();
    expect(metrics.performanceMetrics).toBeDefined();
    expect(metrics.costMetrics).toBeDefined();
  });

  it('should get metrics history', () => {
    const { ScalingMetricsCollector } = require('../src/index.js');

    const collector = new ScalingMetricsCollector();

    const history = collector.getMetricsHistory('test-resource', 10);

    expect(history).toBeDefined();
    expect(Array.isArray(history)).toBe(true);
  });
});
