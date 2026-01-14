/**
 * Service Mesh Integration Tests
 *
 * Tests the complete service mesh workflow including:
 * - Service registration and discovery
 * - Load balancing
 * - Circuit breaking
 * - Traffic management
 * - End-to-end request handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ServiceRegistryDO,
  LoadBalancer,
  CircuitBreaker,
  TrafficManager,
} from '../../src';
import type { ServiceInstance, ServiceRegistration } from '../../src/types';

describe('Service Mesh Integration', () => {
  describe('Service Discovery and Load Balancing', () => {
    it('should register services and route requests with load balancing', async () => {
      // Create service registry
      const mockState = {};
      const registry = new ServiceRegistryDO(mockState, {});

      // Register multiple service instances
      const instances: ServiceInstance[] = [
        {
          id: 'instance-1',
          serviceName: 'user-service',
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
          serviceName: 'user-service',
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
          serviceName: 'user-service',
          host: 'host3.example.com',
          port: 8080,
          protocol: 'http',
          metadata: {},
          healthStatus: 'healthy',
          lastHeartbeat: Date.now(),
          version: '1.0.0',
          tags: ['v1'],
          zone: 'us-west-1a',
          region: 'us-west-1',
          weight: 2, // Higher weight
        },
      ];

      for (const instance of instances) {
        await registry.register({
          serviceName: instance.serviceName,
          instance,
          ttl: 30000,
        });
      }

      // Discover services
      const endpoints = await registry.discover({
        serviceName: 'user-service',
        healthyOnly: true,
      });

      expect(endpoints.instances).toHaveLength(3);

      // Create load balancer
      const loadBalancer = new LoadBalancer({
        strategy: { type: 'weighted' },
        healthAware: true,
      });

      // Simulate request routing
      const selections: Map<string, number> = new Map();
      for (let i = 0; i < 100; i++) {
        const result = loadBalancer.select(endpoints.instances);
        const count = selections.get(result!.endpoint.id) || 0;
        selections.set(result!.endpoint.id, count + 1);
      }

      // Instance-3 with weight 2 should get more traffic
      const count3 = selections.get('instance-3') || 0;
      const count1 = selections.get('instance-1') || 0;
      expect(count3).toBeGreaterThan(count1);
    });
  });

  describe('Circuit Breaking with Service Discovery', () => {
    it('should open circuit when service fails', async () => {
      const mockState = {};
      const registry = new ServiceRegistryDO(mockState, {});

      const instance: ServiceInstance = {
        id: 'instance-1',
        serviceName: 'api-service',
        host: 'api.example.com',
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
        serviceName: 'api-service',
        instance,
        ttl: 30000,
      });

      // Create circuit breaker
      const circuitBreaker = new CircuitBreaker({
        serviceName: 'api-service',
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 5000,
      });

      // Simulate failing requests
      let requestCount = 0;
      const failingRequest = async () => {
        requestCount++;
        throw new Error('Service unavailable');
      };

      // Execute failing requests to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingRequest);
        } catch (e) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe('open');

      // Next request should be rejected immediately
      try {
        await circuitBreaker.execute(failingRequest);
        expect.fail('Should have thrown CircuitBreakerOpenError');
      } catch (e: any) {
        expect(e.name).toBe('CircuitBreakerOpenError');
      }

      // Only 3 actual requests should have been made
      expect(requestCount).toBe(3);
    });
  });

  describe('Canary Deployment Integration', () => {
    it('should route traffic to canary version based on weight', async () => {
      const trafficManager = new TrafficManager({
        enableMetrics: true,
      });

      // Create canary deployment
      const deploymentConfig: any = {
        id: 'canary-1',
        name: 'Feature X Canary',
        strategy: 'canary',
        versions: [
          {
            name: 'stable',
            weight: 90,
            instances: ['stable-1', 'stable-2', 'stable-3'],
          },
          {
            name: 'canary',
            weight: 10,
            instances: ['canary-1'],
          },
        ],
        canary: {
          version: 'canary',
          weight: 10,
          incrementStep: 5,
          incrementInterval: 30000,
          maxWeight: 50,
          metrics: {
            errorRate: 5,
            latencyThreshold: 1000,
          },
          rollbackThreshold: 10,
        },
        status: 'active',
        startTime: Date.now(),
      };

      trafficManager.createDeployment(deploymentConfig);
      trafficManager.startDeployment(deploymentConfig.id);

      // Simulate routing decisions
      const versionCounts: Map<string, number> = new Map();

      for (let i = 0; i < 1000; i++) {
        const context = {
          method: 'GET',
          path: '/api/feature-x',
          headers: {},
        };

        const endpoints: any[] = [
          { id: 'stable-1', version: 'stable' },
          { id: 'stable-2', version: 'stable' },
          { id: 'stable-3', version: 'stable' },
          { id: 'canary-1', version: 'canary' },
        ];

        // This would normally call route() but we'll simplify
        const result = trafficManager['routeCanary'](
          deploymentConfig,
          endpoints,
          context
        );

        const count = versionCounts.get(result.metadata.version) || 0;
        versionCounts.set(result.metadata.version, count + 1);
      }

      // Canary should get approximately 10% of traffic
      const canaryCount = versionCounts.get('canary') || 0;
      const canaryPercentage = (canaryCount / 1000) * 100;

      expect(canaryPercentage).toBeGreaterThan(5);
      expect(canaryPercentage).toBeLessThan(15);
    });
  });

  describe('End-to-End Request Flow', () => {
    it('should handle complete request flow with all features', async () => {
      // Setup service registry
      const mockState = {};
      const registry = new ServiceRegistryDO(mockState, {});

      const instances: ServiceInstance[] = [
        {
          id: 'instance-1',
          serviceName: 'payment-service',
          host: 'payment1.example.com',
          port: 8080,
          protocol: 'http',
          metadata: {},
          healthStatus: 'healthy',
          lastHeartbeat: Date.now(),
          version: '2.0.0',
          tags: ['v2'],
          zone: 'us-east-1a',
          region: 'us-east-1',
          weight: 1,
        },
        {
          id: 'instance-2',
          serviceName: 'payment-service',
          host: 'payment2.example.com',
          port: 8080,
          protocol: 'http',
          metadata: {},
          healthStatus: 'healthy',
          lastHeartbeat: Date.now(),
          version: '2.0.0',
          tags: ['v2'],
          zone: 'us-east-1b',
          region: 'us-east-1',
          weight: 1,
        },
      ];

      for (const instance of instances) {
        await registry.register({
          serviceName: 'payment-service',
          instance,
          ttl: 30000,
        });
      }

      // Discover services
      const endpoints = await registry.discover({
        serviceName: 'payment-service',
        healthyOnly: true,
      });

      // Setup load balancer
      const loadBalancer = new LoadBalancer({
        strategy: { type: 'least-connections' },
        healthAware: true,
      });

      // Setup circuit breaker
      const circuitBreaker = new CircuitBreaker({
        serviceName: 'payment-service',
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 10000,
      });

      // Simulate request flow
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < 20; i++) {
        try {
          // Select endpoint
          const selected = loadBalancer.select(endpoints.instances);
          expect(selected).toBeDefined();

          // Execute with circuit breaker
          const mockRequest = async () => {
            // Simulate 90% success rate
            if (Math.random() < 0.9) {
              return { success: true, data: 'payment processed' };
            }
            throw new Error('Payment gateway timeout');
          };

          const result = await circuitBreaker.execute(mockRequest);
          expect(result.success).toBe(true);
          successCount++;

          // Record latency
          loadBalancer.recordLatency(selected!.endpoint.id, 50 + Math.random() * 100);
          loadBalancer.decrementConnections(selected!.endpoint.id);
        } catch (e) {
          failureCount++;
        }
      }

      // Most requests should succeed
      expect(successCount).toBeGreaterThan(15);

      // Check final state
      expect(circuitBreaker.getState()).toBe('closed');

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(20);
    });
  });

  describe('Service Health Integration', () => {
    it('should remove unhealthy instances from routing', async () => {
      const mockState = {};
      const registry = new ServiceRegistryDO(mockState, {});

      const instances: ServiceInstance[] = [
        {
          id: 'instance-1',
          serviceName: 'auth-service',
          host: 'auth1.example.com',
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
          serviceName: 'auth-service',
          host: 'auth2.example.com',
          port: 8080,
          protocol: 'http',
          metadata: {},
          healthStatus: 'unhealthy',
          lastHeartbeat: Date.now() - 60000, // Old heartbeat
          version: '1.0.0',
          tags: ['v1'],
          zone: 'us-east-1b',
          region: 'us-east-1',
          weight: 1,
        },
      ];

      for (const instance of instances) {
        await registry.register({
          serviceName: 'auth-service',
          instance,
          ttl: 30000,
        });
      }

      const loadBalancer = new LoadBalancer({
        strategy: { type: 'round-robin' },
        healthAware: true,
      });

      // Discover all instances
      const allEndpoints = await registry.discover({
        serviceName: 'auth-service',
        healthyOnly: false,
      });

      expect(allEndpoints.instances).toHaveLength(2);

      // Select with health awareness
      const selected = loadBalancer.select(allEndpoints.instances);

      // Should only select healthy instance
      expect(selected!.endpoint.healthStatus).toBe('healthy');
      expect(selected!.endpoint.id).toBe('instance-1');
    });
  });
});
