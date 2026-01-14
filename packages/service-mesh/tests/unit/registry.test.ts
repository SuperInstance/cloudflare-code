/**
 * Service Registry Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceRegistryDO, ServiceRegistryClient, createRegistryClient } from '../../src/registry/registry';
import type { ServiceInstance, ServiceRegistration, ServiceQuery } from '../../src/types';

// Mock Durable Object state
function createMockState() {
  return {
    services: new Map(),
    indexes: {
      byName: new Map(),
      byVersion: new Map(),
      byTag: new Map(),
      byRegion: new Map(),
      byZone: new Map(),
    },
    healthChecks: new Map(),
    stats: {
      totalServices: 0,
      totalInstances: 0,
      healthyInstances: 0,
      unhealthyInstances: 0,
      registrationsPerSecond: 0,
      discoveriesPerSecond: 0,
      averageLatency: 0,
    },
    eventLog: [],
  };
}

describe('ServiceRegistry', () => {
  let registry: ServiceRegistryDO;
  let mockState: any;
  let mockEnv: any;

  beforeEach(() => {
    mockState = createMockState();
    mockEnv = {};
    registry = new ServiceRegistryDO(mockState, mockEnv);
  });

  describe('Service Registration', () => {
    it('should register a service instance', async () => {
      const instance: ServiceInstance = {
        id: 'instance-1',
        serviceName: 'test-service',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        metadata: {},
        healthStatus: 'healthy',
        lastHeartbeat: Date.now(),
        version: '1.0.0',
        tags: ['v1'],
        zone: 'us-east-1a',
        region: 'us-east-1',
        weight: 1,
      };

      const registration: ServiceRegistration = {
        serviceName: 'test-service',
        instance,
        ttl: 30000,
      };

      await registry.register(registration);

      expect(registry.getStats().totalInstances).toBe(1);
    });

    it('should update indexes when registering', async () => {
      const instance: ServiceInstance = {
        id: 'instance-1',
        serviceName: 'test-service',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        metadata: {},
        healthStatus: 'healthy',
        lastHeartbeat: Date.now(),
        version: '1.0.0',
        tags: ['v1', 'production'],
        zone: 'us-east-1a',
        region: 'us-east-1',
        weight: 1,
      };

      const registration: ServiceRegistration = {
        serviceName: 'test-service',
        instance,
        ttl: 30000,
      };

      await registry.register(registration);

      const query: ServiceQuery = {
        serviceName: 'test-service',
        tags: ['production'],
        region: 'us-east-1',
      };

      const result = await registry.discover(query);
      expect(result.instances).toHaveLength(1);
      expect(result.instances[0].id).toBe('instance-1');
    });
  });

  describe('Service Discovery', () => {
    beforeEach(async () => {
      // Register multiple instances
      const instances: ServiceInstance[] = [
        {
          id: 'instance-1',
          serviceName: 'test-service',
          host: 'host1.example.com',
          port: 8080,
          protocol: 'http',
          metadata: {},
          healthStatus: 'healthy',
          lastHeartbeat: Date.now(),
          version: '1.0.0',
          tags: ['v1'],
          zone: 'us-east-1a',
          region: 'us-east-1',
          weight: 1,
        },
        {
          id: 'instance-2',
          serviceName: 'test-service',
          host: 'host2.example.com',
          port: 8080,
          protocol: 'http',
          metadata: {},
          healthStatus: 'healthy',
          lastHeartbeat: Date.now(),
          version: '1.0.0',
          tags: ['v1'],
          zone: 'us-east-1b',
          region: 'us-east-1',
          weight: 1,
        },
        {
          id: 'instance-3',
          serviceName: 'test-service',
          host: 'host3.example.com',
          port: 8080,
          protocol: 'http',
          metadata: {},
          healthStatus: 'unhealthy',
          lastHeartbeat: Date.now(),
          version: '1.0.0',
          tags: ['v1'],
          zone: 'us-west-1a',
          region: 'us-west-1',
          weight: 1,
        },
      ];

      for (const instance of instances) {
        await registry.register({
          serviceName: instance.serviceName,
          instance,
          ttl: 30000,
        });
      }
    });

    it('should discover all instances for a service', async () => {
      const query: ServiceQuery = {
        serviceName: 'test-service',
      };

      const result = await registry.discover(query);
      expect(result.instances).toHaveLength(3);
    });

    it('should filter by health status', async () => {
      const query: ServiceQuery = {
        serviceName: 'test-service',
        healthyOnly: true,
      };

      const result = await registry.discover(query);
      expect(result.instances).toHaveLength(2);
      expect(result.instances.every((i) => i.healthStatus === 'healthy')).toBe(true);
    });

    it('should filter by region', async () => {
      const query: ServiceQuery = {
        serviceName: 'test-service',
        region: 'us-east-1',
      };

      const result = await registry.discover(query);
      expect(result.instances).toHaveLength(2);
      expect(result.instances.every((i) => i.region === 'us-east-1')).toBe(true);
    });

    it('should filter by tags', async () => {
      const query: ServiceQuery = {
        serviceName: 'test-service',
        tags: ['v1'],
      };

      const result = await registry.discover(query);
      expect(result.instances).toHaveLength(3);
    });
  });

  describe('Service Deregistration', () => {
    it('should deregister a service instance', async () => {
      const instance: ServiceInstance = {
        id: 'instance-1',
        serviceName: 'test-service',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        metadata: {},
        healthStatus: 'healthy',
        lastHeartbeat: Date.now(),
        version: '1.0.0',
        tags: ['v1'],
        zone: 'us-east-1a',
        region: 'us-east-1',
        weight: 1,
      };

      await registry.register({
        serviceName: 'test-service',
        instance,
        ttl: 30000,
      });

      expect(registry.getStats().totalInstances).toBe(1);

      const deregistered = await registry.deregister('instance-1');
      expect(deregistered).toBe(true);
      expect(registry.getStats().totalInstances).toBe(0);
    });

    it('should return false when deregistering non-existent instance', async () => {
      const deregistered = await registry.deregister('non-existent');
      expect(deregistered).toBe(false);
    });
  });

  describe('Health Checks', () => {
    it('should perform health check on instance', async () => {
      const instance: ServiceInstance = {
        id: 'instance-1',
        serviceName: 'test-service',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        metadata: {},
        healthStatus: 'healthy',
        lastHeartbeat: Date.now(),
        version: '1.0.0',
        tags: ['v1'],
        zone: 'us-east-1a',
        region: 'us-east-1',
        weight: 1,
      };

      await registry.register({
        serviceName: 'test-service',
        instance,
        ttl: 30000,
      });

      const result = await registry.performHealthCheck('instance-1');
      expect(result.serviceName).toBe('test-service');
      expect(result.instanceId).toBe('instance-1');
      expect(result.healthy).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track statistics', async () => {
      const instance: ServiceInstance = {
        id: 'instance-1',
        serviceName: 'test-service',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        metadata: {},
        healthStatus: 'healthy',
        lastHeartbeat: Date.now(),
        version: '1.0.0',
        tags: ['v1'],
        zone: 'us-east-1a',
        region: 'us-east-1',
        weight: 1,
      };

      await registry.register({
        serviceName: 'test-service',
        instance,
        ttl: 30000,
      });

      const stats = registry.getStats();
      expect(stats.totalInstances).toBe(1);
      expect(stats.healthyInstances).toBe(1);
    });
  });
});

describe('ServiceRegistryClient', () => {
  it('should create a client', () => {
    const mockEnv = {
      SERVICE_REGISTRY: {
        idFromName: vi.fn().mockReturnValue({}),
        get: vi.fn(),
      },
    };

    const client = createRegistryClient(mockEnv);
    expect(client).toBeInstanceOf(ServiceRegistryClient);
  });
});
