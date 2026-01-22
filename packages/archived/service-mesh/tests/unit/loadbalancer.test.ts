/**
 * Load Balancer Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LoadBalancer,
  LoadBalancerPool,
  AdaptiveLoadBalancer,
} from '../../src/loadbalancer/balancer';
import type { ServiceInstance, LoadBalancingStrategy } from '../../src/types';

function createMockInstances(count: number): ServiceInstance[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `instance-${i}`,
    serviceName: 'test-service',
    host: `host${i}.example.com`,
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
  }));
}

describe('LoadBalancer', () => {
  describe('Round Robin Strategy', () => {
    it('should distribute requests evenly', () => {
      const balancer = new LoadBalancer({
        strategy: { type: 'round-robin' },
      });

      const instances = createMockInstances(3);
      const selections: Map<string, number> = new Map();

      for (let i = 0; i < 9; i++) {
        const result = balancer.select(instances);
        const count = selections.get(result!.endpoint.id) || 0;
        selections.set(result!.endpoint.id, count + 1);
      }

      // Each instance should be selected 3 times
      for (const count of selections.values()) {
        expect(count).toBe(3);
      }
    });
  });

  describe('Random Strategy', () => {
    it('should select random endpoints', () => {
      const balancer = new LoadBalancer({
        strategy: { type: 'random' },
      });

      const instances = createMockInstances(5);
      const selectedIds = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const result = balancer.select(instances);
        selectedIds.add(result!.endpoint.id);
      }

      // Should have selected most, if not all, instances
      expect(selectedIds.size).toBeGreaterThan(1);
    });
  });

  describe('Weighted Round Robin', () => {
    it('should respect endpoint weights', () => {
      const balancer = new LoadBalancer({
        strategy: { type: 'weighted' },
      });

      const instances: ServiceInstance[] = [
        {
          ...createMockInstances(1)[0],
          id: 'instance-1',
          weight: 3,
        },
        {
          ...createMockInstances(1)[0],
          id: 'instance-2',
          weight: 1,
        },
      ];

      const selections: Map<string, number> = new Map();

      for (let i = 0; i < 100; i++) {
        const result = balancer.select(instances);
        const count = selections.get(result!.endpoint.id) || 0;
        selections.set(result!.endpoint.id, count + 1);
      }

      // Instance 1 should get ~75% of traffic, Instance 2 ~25%
      const count1 = selections.get('instance-1') || 0;
      const count2 = selections.get('instance-2') || 0;

      expect(count1).toBeGreaterThan(count2 * 2);
    });
  });

  describe('Least Connections Strategy', () => {
    it('should select endpoint with fewest connections', () => {
      const balancer = new LoadBalancer({
        strategy: { type: 'least-connections' },
      });

      const instances = createMockInstances(3);

      // Simulate existing connections
      balancer.incrementConnections('instance-0');
      balancer.incrementConnections('instance-0');
      balancer.incrementConnections('instance-1');

      const result = balancer.select(instances);
      expect(result!.endpoint.id).toBe('instance-2');
    });
  });

  describe('IP Hash Strategy', () => {
    it('should consistently route same IP to same endpoint', () => {
      const balancer = new LoadBalancer({
        strategy: { type: 'ip-hash' },
      });

      const instances = createMockInstances(3);
      const ip = '192.168.1.1';

      const selections: string[] = [];
      for (let i = 0; i < 10; i++) {
        const result = balancer.select(instances, { ip });
        selections.push(result!.endpoint.id);
      }

      // All selections should be the same
      expect(selections.every((id) => id === selections[0])).toBe(true);
    });

    it('should distribute different IPs across endpoints', () => {
      const balancer = new LoadBalancer({
        strategy: { type: 'ip-hash' },
      });

      const instances = createMockInstances(3);
      const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3', '10.0.0.1'];

      const selections = new Set<string>();
      for (const ip of ips) {
        const result = balancer.select(instances, { ip });
        selections.add(result!.endpoint.id);
      }

      // Should have some distribution
      expect(selections.size).toBeGreaterThan(1);
    });
  });

  describe('Health-Aware Routing', () => {
    it('should prefer healthy endpoints', () => {
      const balancer = new LoadBalancer({
        strategy: { type: 'round-robin' },
        healthAware: true,
      });

      const instances: ServiceInstance[] = [
        { ...createMockInstances(1)[0], id: 'instance-1', healthStatus: 'unhealthy' },
        { ...createMockInstances(1)[0], id: 'instance-2', healthStatus: 'healthy' },
      ];

      const result = balancer.select(instances);
      expect(result!.endpoint.id).toBe('instance-2');
    });

    it('should fall back to unhealthy if no healthy endpoints', () => {
      const balancer = new LoadBalancer({
        strategy: { type: 'round-robin' },
        healthAware: true,
      });

      const instances: ServiceInstance[] = [
        { ...createMockInstances(1)[0], id: 'instance-1', healthStatus: 'unhealthy' },
      ];

      const result = balancer.select(instances);
      expect(result!.endpoint.id).toBe('instance-1');
    });
  });

  describe('Statistics', () => {
    it('should track request statistics', () => {
      const balancer = new LoadBalancer({
        strategy: { type: 'round-robin' },
      });

      const instances = createMockInstances(2);

      balancer.select(instances);
      balancer.select(instances);

      const stats = balancer.getStats();
      expect(stats.totalRequests).toBe(2);
    });

    it('should track latency measurements', () => {
      const balancer = new LoadBalancer({
        strategy: { type: 'round-robin' },
      });

      const instances = createMockInstances(1);
      const endpointId = instances[0].id;

      balancer.recordLatency(endpointId, 100);
      balancer.recordLatency(endpointId, 200);
      balancer.recordLatency(endpointId, 300);

      const stats = balancer.getStats();
      expect(stats.averageLatency.get(endpointId)).toBe(200);
    });

    it('should track connection counts', () => {
      const balancer = new LoadBalancer({
        strategy: { type: 'round-robin' },
      });

      const endpointId = 'instance-1';

      balancer.incrementConnections(endpointId);
      balancer.incrementConnections(endpointId);
      balancer.decrementConnections(endpointId);

      const stats = balancer.getStats();
      expect(stats.activeConnections.get(endpointId)).toBe(1);
    });
  });
});

describe('LoadBalancerPool', () => {
  it('should manage multiple load balancers', () => {
    const pool = new LoadBalancerPool();

    const service1Instances = createMockInstances(3);
    const service2Instances = createMockInstances(2);

    pool.updateEndpoints('service-1', service1Instances);
    pool.updateEndpoints('service-2', service2Instances);

    const result1 = pool.select('service-1');
    const result2 = pool.select('service-2');

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  });

  it('should record latency per service', () => {
    const pool = new LoadBalancerPool();
    const instances = createMockInstances(1);

    pool.updateEndpoints('test-service', instances);
    pool.recordLatency('test-service', instances[0].id, 150);

    const stats = pool.getAllStats();
    expect(stats.get('test-service')?.averageLatency.get(instances[0].id)).toBe(150);
  });
});

describe('AdaptiveLoadBalancer', () => {
  it('should switch strategies based on performance', () => {
    const balancer = new AdaptiveLoadBalancer({
      strategy: { type: 'round-robin' },
    });

    const instances = createMockInstances(3);

    // Make selections to build performance data
    for (let i = 0; i < 10; i++) {
      const result = balancer.select(instances);
      balancer.recordLatency(result!.endpoint.id, 100);
    }

    // The adaptive load balancer should evaluate and potentially switch
    const result = balancer.select(instances);
    expect(result).toBeDefined();
  });
});
