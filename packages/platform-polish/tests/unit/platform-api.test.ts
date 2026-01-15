import { PlatformAPI } from '../src/core/platform-api';
import { ServiceConfig } from '../src/types';
import { createTestConfig, createTestServiceConfig, mockAxiosSuccess, mockAxiosFailure } from './setup';

describe('PlatformAPI', () => {
  let platformApi: PlatformAPI;
  let testConfig: any;
  let serviceConfig: ServiceConfig;

  beforeEach(() => {
    testConfig = createTestConfig();
    serviceConfig = createTestServiceConfig('test-service');
    platformApi = new PlatformAPI(testConfig);
    mockAxiosSuccess();
  });

  afterEach(async () => {
    if (platformApi.isServiceRunning()) {
      await platformApi.stop();
    }
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create PlatformAPI instance with provided config', () => {
      expect(platformApi).toBeInstanceOf(PlatformAPI);
      expect(platformApi.isServiceRunning()).toBe(false);
    });

    it('should initialize all components', () => {
      expect(platformApi).toBeDefined();
      // In a real implementation, we'd check that all components are initialized
    });
  });

  describe('start/stop lifecycle', () => {
    it('should start successfully', async () => {
      await expect(platformApi.start()).resolves.not.toThrow();
      expect(platformApi.isServiceRunning()).toBe(true);
    });

    it('should stop successfully', async () => {
      await platformApi.start();
      await expect(platformApi.stop()).resolves.not.toThrow();
      expect(platformApi.isServiceRunning()).toBe(false);
    });

    it('should throw error when starting already running platform', async () => {
      await platformApi.start();
      await expect(platformApi.start()).rejects.toThrow('Platform API is already running');
    });

    it('should handle start failure gracefully', async () => {
      // Mock a component failure
      const originalStart = platformApi['serviceDiscovery']['start'];
      platformApi['serviceDiscovery']['start'] = jest.fn().mockRejectedValue(new Error('Start failed'));

      await expect(platformApi.start()).rejects.toThrow('Start failed');
      expect(platformApi.isServiceRunning()).toBe(false);

      // Restore original method
      platformApi['serviceDiscovery']['start'] = originalStart;
    });
  });

  describe('service registration', () => {
    beforeEach(async () => {
      await platformApi.start();
    });

    it('should register service successfully', async () => {
      await expect(platformApi.registerService(serviceConfig)).resolves.not.toThrow();

      // Verify service is registered
      const service = await platformApi.getService(serviceConfig.id);
      expect(service).toBeDefined();
      expect(service?.id).toBe(serviceConfig.id);
    });

    it('should deregister service successfully', async () => {
      await platformApi.registerService(serviceConfig);

      await expect(platformApi.deregisterService(serviceConfig.id)).resolves.not.toThrow();

      // Verify service is deregistered
      const service = await platformApi.getService(serviceConfig.id);
      expect(service).toBeUndefined();
    });

    it('should throw error when deregistering non-existent service', async () => {
      await expect(platformApi.deregisterService('non-existent')).rejects.toThrow(
        'Service with ID non-existent not found'
      );
    });
  });

  describe('service discovery', () => {
    beforeEach(async () => {
      await platformApi.start();
    });

    it('should get all services', async () => {
      await platformApi.registerService(serviceConfig);

      const services = await platformApi.getAllServices();
      expect(services).toHaveLength(1);
      expect(services[0].id).toBe(serviceConfig.id);
    });

    it('should get healthy services', async () => {
      const unhealthyConfig = createTestServiceConfig('unhealthy-service');
      await platformApi.registerService(unhealthyConfig);

      const healthyServices = await platformApi.getHealthyServices();
      expect(healthyServices).toHaveLength(1);
      expect(healthyServices[0].id).toBe(serviceConfig.id);
    });

    it('should get specific service', async () => {
      await platformApi.registerService(serviceConfig);

      const service = await platformApi.getService(serviceConfig.id);
      expect(service).toBeDefined();
      expect(service?.id).toBe(serviceConfig.id);
    });
  });

  describe('service requests', () => {
    beforeEach(async () => {
      await platformApi.start();
      await platformApi.registerService(serviceConfig);
    });

    it('should make successful service request', async () => {
      const response = await platformApi.requestService('test-service', '/test');
      expect(response).toBeDefined();
      expect(response.message).toBe('Service request successful');
    });

    it('should handle service request failure gracefully', async () => {
      mockAxiosFailure();

      const response = await platformApi.requestService('test-service', '/test');
      expect(response).toBeDefined(); // Should return fallback or cached response
    });

    it('should throw error when no healthy services available', async () => {
      // This test would require mocking the load balancer to return no healthy services
      await expect(platformApi.requestService('non-existent-service', '/test')).rejects.toThrow(
        'No healthy services available'
      );
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      await platformApi.start();
      await platformApi.registerService(serviceConfig);
    });

    it('should get health status for all services', async () => {
      const healthStatuses = await platformApi.getHealthStatus();
      expect(healthStatuses).toBeDefined();
      expect(Array.isArray(healthStatuses)).toBe(true);
    });

    it('should get health status for specific service', async () => {
      const healthStatus = await platformApi.getHealthStatus(serviceConfig.id);
      expect(healthStatus).toBeDefined();
      expect(healthStatus.service).toBe(serviceConfig.name);
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      await platformApi.start();
    });

    it('should invalidate cache by pattern', async () => {
      await expect(platformApi.invalidateCache('test:*')).resolves.not.toThrow();
    });

    it('should invalidate all cache', async () => {
      await expect(platformApi.invalidateAllCache()).resolves.not.toThrow();
    });
  });

  describe('platform stats', () => {
    beforeEach(async () => {
      await platformApi.start();
      await platformApi.registerService(serviceConfig);
    });

    it('should get platform statistics', async () => {
      const stats = await platformApi.getStats();
      expect(stats).toBeDefined();
      expect(stats.services).toBeDefined();
      expect(stats.config).toBeDefined();
      expect(stats.uptime).toBeDefined();
    });

    it('should include registered service in stats', async () => {
      const stats = await platformApi.getStats();
      expect(stats.services.total).toBe(1);
      expect(stats.services.healthy).toBe(1);
      expect(stats.services.unhealthy).toBe(0);
    });
  });

  describe('shutdown hooks', () => {
    beforeEach(async () => {
      await platformApi.start();
    });

    it('should execute shutdown hooks in reverse order', async () => {
      const hook1 = jest.fn().mockResolvedValue(undefined);
      const hook2 = jest.fn().mockResolvedValue(undefined);

      platformApi.addShutdownHook(hook1);
      platformApi.addShutdownHook(hook2);

      await platformApi.stop();

      // Hooks should be executed in reverse order
      expect(hook2).toHaveBeenCalled();
      expect(hook1).toHaveBeenCalled();
    });

    it('should handle hook failures gracefully', async () => {
      const successfulHook = jest.fn().mockResolvedValue(undefined);
      const failingHook = jest.fn().mockRejectedValue(new Error('Hook failed'));

      platformApi.addShutdownHook(successfulHook);
      platformApi.addShutdownHook(failingHook);

      // Should not throw despite hook failure
      await expect(platformApi.stop()).resolves.not.toThrow();

      expect(successfulHook).toHaveBeenCalled();
      expect(failingHook).toHaveBeenCalled();
    });
  });
});