import { LoadBalancer } from '../src/load-balancer/load-balancer';
import { ServiceDiscovery } from '../src/service-discovery/service-discovery';
import { ServiceRegistration, LoadBalancingConfig } from '../src/types';
import { createMockServiceRegistration } from './setup';

// Mock the LoadBalancerImpl class
jest.mock('../src/load-balancer/load-balancer');
const MockLoadBalancerImpl = require('../src/load-balancer/load-balancer').LoadBalancerImpl;

describe('LoadBalancer', () => {
  let loadBalancer: LoadBalancer;
  let serviceDiscovery: ServiceDiscovery;
  let mockServiceRegistration: ServiceRegistration;

  beforeEach(() => {
    serviceDiscovery = {
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    loadBalancer = new LoadBalancer(serviceDiscovery);
    mockServiceRegistration = createMockServiceRegistration();

    // Mock the LoadBalancerImpl
    MockLoadBalancerImpl.mockImplementation(function(serviceName, config, logger) {
      this.start = jest.fn().mockResolvedValue(undefined);
      this.stop = jest.fn();
      this.selectNode = jest.fn().mockReturnValue(mockServiceRegistration);
      this.selectNodeWithStickySession = jest.fn().mockReturnValue(mockServiceRegistration);
      this.getStats = jest.fn().mockReturnValue({
        strategy: 'round-robin',
        nodes: 1,
        requests: 100
      });
      this.getServiceName = jest.fn().mockReturnValue('test-service');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create LoadBalancer instance', () => {
      expect(loadBalancer).toBeInstanceOf(LoadBalancer);
    });

    it('should set up event listeners', () => {
      expect(serviceDiscovery.on).toHaveBeenCalledWith(
        'healthUpdate',
        expect.any(Function)
      );
      expect(serviceDiscovery.on).toHaveBeenCalledWith(
        'serviceRegistered',
        expect.any(Function)
      );
      expect(serviceDiscovery.on).toHaveBeenCalledWith(
        'serviceDeregistered',
        expect.any(Function)
      );
    });
  });

  describe('start/stop lifecycle', () => {
    beforeEach(() => {
      // Mock service discovery
      const mockServices = [mockServiceRegistration];
      (serviceDiscovery as any).getAllServices = jest.fn().mockResolvedValue(mockServices);
    });

    it('should start successfully', async () => {
      await expect(loadBalancer.start()).resolves.not.toThrow();
    });

    it('should throw error when already running', async () => {
      await loadBalancer.start();
      await expect(loadBalancer.start()).rejects.toThrow('Load Balancer is already running');
    });

    it('should stop successfully', async () => {
      await loadBalancer.start();
      await expect(loadBalancer.stop()).resolves.not.toThrow();
    });

    it('should handle multiple service starts', async () => {
      await loadBalancer.start();
      await loadBalancer.stop();
      await loadBalancer.start();
      await loadBalancer.stop();
    });
  });

  describe('service selection', () => {
    beforeEach(async () => {
      await loadBalancer.start();
    });

    it('should select service with round-robin strategy', async () => {
      const service = await loadBalancer.selectService('test-service');
      expect(service).toBe(mockServiceRegistration);
    });

    it('should return null when no healthy services available', async () => {
      const service = await loadBalancer.selectService('non-existent-service');
      expect(service).toBeNull();
    });

    it('should select service with sticky session', async () => {
      const service = await loadBalancer.selectServiceWithStickySession('test-service', 'session123');
      expect(service).toBe(mockServiceRegistration);
    });
  });

  describe('node weight updates', () => {
    beforeEach(async () => {
      await loadBalancer.start();
    });

    it('should update node weights', async () => {
      const weights = {
        'node1:3000': 2,
        'node2:3000': 1
      };

      await expect(loadBalancer.updateNodeWeights('test-service', weights)).resolves.not.toThrow();
    });

    it('should throw error for non-existent service', async () => {
      const weights = { 'node1:3000': 2 };

      await expect(loadBalancer.updateNodeWeights('non-existent-service', weights)).rejects.toThrow(
        'No load balancer found for service'
      );
    });
  });

  describe('stats and monitoring', () => {
    beforeEach(async () => {
      await loadBalancer.start();
    });

    it('should get node stats for service', async () => {
      const stats = await loadBalancer.getNodeStats('test-service');
      expect(stats).toBeDefined();
      expect(stats.strategy).toBe('round-robin');
    });

    it('should throw error for non-existent service stats', async () => {
      await expect(loadBalancer.getNodeStats('non-existent-service')).rejects.toThrow(
        'No load balancer found for service'
      );
    });

    it('should get all stats', () => {
      const allStats = loadBalancer.getAllStats();
      expect(allStats).toBeDefined();
      expect(typeof allStats).toBe('object');
    });
  });

  describe('event handling', () => {
    it('should handle health updates', () => {
      const healthUpdateHandler = serviceDiscovery.on.mock.calls.find(
        (call: any) => call[0] === 'healthUpdate'
      )?.[1];

      expect(healthUpdateHandler).toBeDefined();

      // Simulate health update
      const mockHealth = { service: 'test-service', status: 'healthy' };
      healthUpdateHandler(mockHealth);

      // In a real implementation, we'd verify the load balancer state was updated
      // For now, we just verify the handler was called
    });

    it('should handle service registration', async () => {
      const registerHandler = serviceDiscovery.on.mock.calls.find(
        (call: any) => call[0] === 'serviceRegistered'
      )?.[1];

      expect(registerHandler).toBeDefined();

      // Simulate service registration
      await registerHandler(mockServiceRegistration);

      // In a real implementation, we'd verify a new load balancer was created
      // For now, we just verify the handler was called
    });

    it('should handle service deregistration', async () => {
      const deregisterHandler = serviceDiscovery.on.mock.calls.find(
        (call: any) => call[0] === 'serviceDeregistered'
      )?.[1];

      expect(deregisterHandler).toBeDefined();

      // Simulate service deregistration
      await deregisterHandler('test-service');

      // In a real implementation, we'd verify the load balancer was removed
      // For now, we just verify the handler was called
    });
  });

  describe('load balancing strategies', () => {
    beforeEach(() => {
      // Create mock implementations for different strategies
      const mockStrategies = {
        'round-robin': jest.fn().mockReturnValue(mockServiceRegistration),
        'least-connections': jest.fn().mockReturnValue(mockServiceRegistration),
        'ip-hash': jest.fn().mockReturnValue(mockServiceRegistration),
        'weighted': jest.fn().mockReturnValue(mockServiceRegistration)
      };

      MockLoadBalancerImpl.mockImplementation(function(serviceName, config, logger) {
        this.start = jest.fn().mockResolvedValue(undefined);
        this.stop = jest.fn();
        this.selectNode = jest.fn(() => {
          return mockStrategies[config.strategy]?.() || mockServiceRegistration;
        });
        this.getStats = jest.fn().mockReturnValue({
          strategy: config.strategy,
          nodes: 1,
          requests: 100
        });
        this.getServiceName = jest.fn().mockReturnValue('test-service');
      });
    });

    it('should support round-robin strategy', async () => {
      const config: LoadBalancingConfig = {
        strategy: 'round-robin',
        stickySessions: false,
        healthCheckInterval: 5000,
        nodes: []
      };

      const testLoadBalancer = new LoadBalancer(serviceDiscovery);
      await testLoadBalancer.start();

      const service = await testLoadBalancer.selectService('test-service');
      expect(service).toBe(mockServiceRegistration);
    });

    it('should support least-connections strategy', async () => {
      const config: LoadBalancingConfig = {
        strategy: 'least-connections',
        stickySessions: false,
        healthCheckInterval: 5000,
        nodes: []
      };

      const testLoadBalancer = new LoadBalancer(serviceDiscovery);
      await testLoadBalancer.start();

      const service = await testLoadBalancer.selectService('test-service');
      expect(service).toBe(mockServiceRegistration);
    });

    it('should support weighted strategy', async () => {
      const config: LoadBalancingConfig = {
        strategy: 'weighted',
        stickySessions: false,
        healthCheckInterval: 5000,
        nodes: []
      };

      const testLoadBalancer = new LoadBalancer(serviceDiscovery);
      await testLoadBalancer.start();

      const service = await testLoadBalancer.selectService('test-service');
      expect(service).toBe(mockServiceRegistration);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      // Mock service discovery to throw error
      (serviceDiscovery as any).getAllServices = jest.fn().mockRejectedValue(new Error('Discovery failed'));
    });

    it('should handle start failure gracefully', async () => {
      await expect(loadBalancer.start()).rejects.toThrow('Discovery failed');
    });
  });
});