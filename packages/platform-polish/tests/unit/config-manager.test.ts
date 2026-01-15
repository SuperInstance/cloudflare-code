import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../src/config/config-manager';
import { createTestConfig } from './setup';
import { ServiceConfig } from '../src/types';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempDir: string;
  let testConfigPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-'));
    testConfigPath = path.join(tempDir, 'test-platform.yaml');
    configManager = new ConfigManager(testConfigPath);
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('constructor', () => {
    it('should create ConfigManager instance', () => {
      expect(configManager).toBeInstanceOf(ConfigManager);
    });

    it('should use default config path if not provided', () => {
      const defaultManager = new ConfigManager();
      expect(defaultManager).toBeInstanceOf(ConfigManager);
    });
  });

  describe('loadConfig', () => {
    it('should load existing config file', async () => {
      const testConfig = createTestConfig();
      const yamlContent = `name: ${testConfig.name}
version: ${testConfig.version}
environment: ${testConfig.environment}
services: []
global:
  port: ${testConfig.global.port}
  host: ${testConfig.global.host}
  cluster: ${testConfig.global.cluster}
  workers: ${testConfig.global.workers}
  shutdownTimeout: ${testConfig.global.shutdownTimeout}`;

      fs.writeFileSync(testConfigPath, yamlContent);

      const config = await configManager.loadConfig();
      expect(config).toBeDefined();
      expect(config.name).toBe(testConfig.name);
      expect(config.version).toBe(testConfig.version);
    });

    it('should create default config if file does not exist', async () => {
      const config = await configManager.loadConfig();
      expect(config).toBeDefined();
      expect(config.name).toBe('ClaudeFlare Platform');
      expect(config.version).toBe('1.0.0');
      expect(config.environment).toBe('development');
    });

    it('should save default config when creating', async () => {
      await configManager.loadConfig();

      expect(fs.existsSync(testConfigPath)).toBe(true);

      const savedConfig = fs.readFileSync(testConfigPath, 'utf8');
      expect(savedConfig).toContain('name: ClaudeFlare Platform');
    });

    it('should throw error for invalid config', async () => {
      const invalidYaml = `
name: invalid-config
version: not-a-version
environment: invalid-environment
invalid-field: value`;

      fs.writeFileSync(testConfigPath, invalidYaml);

      await expect(configManager.loadConfig()).rejects.toThrow('Config validation failed');
    });
  });

  describe('saveConfig', () => {
    it('should save config to file', async () => {
      const testConfig = createTestConfig();
      await configManager.saveConfig(testConfig);

      expect(fs.existsSync(testConfigPath)).toBe(true);

      const savedContent = fs.readFileSync(testConfigPath, 'utf8');
      expect(savedContent).toContain('name: Test Platform');
      expect(savedContent).toContain('version: 1.0.0-test');
    });

    it('should create directory if it does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'nested', 'directory');
      const nonExistentPath = path.join(nonExistentDir, 'config.yaml');

      const testConfig = createTestConfig();
      const localConfigManager = new ConfigManager(nonExistentPath);
      await localConfigManager.saveConfig(testConfig);

      expect(fs.existsSync(nonExistentDir)).toBe(true);
      expect(fs.existsSync(nonExistentPath)).toBe(true);
    });
  });

  describe('updateConfig', () => {
    beforeEach(async () => {
      await configManager.loadConfig();
    });

    it('should update existing config', async () => {
      const updatedConfig = {
        ...createTestConfig(),
        name: 'Updated Platform Name',
        global: {
          ...createTestConfig().global,
          port: 8080
        }
      };

      const result = await configManager.updateConfig(updatedConfig);

      expect(result.name).toBe('Updated Platform Name');
      expect(result.global.port).toBe(8080);
    });

    it('should merge partial updates', async () => {
      const partialUpdate = {
        name: 'Partial Update',
        global: {
          port: 9000
        }
      };

      await configManager.updateConfig(partialUpdate);

      const config = configManager.getConfig();
      expect(config.name).toBe('Partial Update');
      expect(config.global.port).toBe(9000);
      expect(config.global.host).toBe('localhost'); // Should keep existing value
    });

    it('should validate updates before applying', async () => {
      const invalidUpdate = {
        name: '',
        environment: 'invalid'
      };

      await expect(configManager.updateConfig(invalidUpdate)).rejects.toThrow('Config validation failed');
    });

    it('should throw error if config not loaded', async () => {
      const emptyConfigManager = new ConfigManager(testConfigPath);

      await expect(emptyConfigManager.updateConfig({ name: 'test' })).rejects.toThrow('Config not loaded');
    });
  });

  describe('getServiceConfig', () => {
    beforeEach(async () => {
      const testConfig = createTestConfig();
      testConfig.services = [
        createTestServiceConfig('service1'),
        createTestServiceConfig('service2')
      ];

      configManager['config'] = testConfig;
    });

    it('should return service config by ID', () => {
      const serviceConfig = configManager.getServiceConfig('service1');
      expect(serviceConfig).toBeDefined();
      expect(serviceConfig?.id).toBe('service1');
      expect(serviceConfig?.name).toBe('service-service1');
    });

    it('should return null for non-existent service', () => {
      const serviceConfig = configManager.getServiceConfig('non-existent');
      expect(serviceConfig).toBeNull();
    });

    it('should return null if config not loaded', () => {
      const emptyConfigManager = new ConfigManager(testConfigPath);
      const serviceConfig = emptyConfigManager.getServiceConfig('any');
      expect(serviceConfig).toBeNull();
    });
  });

  describe('watchConfig', () => {
    it('should watch config file for changes', async () => {
      const testConfig = createTestConfig();
      await configManager.loadConfig();
      await configManager.watchConfig();

      expect(fs.existsSync(testConfigPath)).toBe(true);

      // The test would need to trigger a file change event to fully test
      // For now, we just verify no errors occur
    });

    it('should handle config file changes', async () => {
      const testConfig = createTestConfig();
      await configManager.loadConfig();
      await configManager.watchConfig();

      // Simulate config file change
      const updatedConfig = {
        ...testConfig,
        name: 'Updated After Watch'
      };
      await configManager.saveConfig(updatedConfig);

      // In a real test, we'd verify the update was processed
      // For now, we just verify no errors occur
    });
  });

  describe('stopWatching', () => {
    it('should stop watching config file', async () => {
      await configManager.loadConfig();
      await configManager.watchConfig();

      configManager.stopWatching();
      // In a real test, we'd verify watchers were removed
      // For now, we just verify no errors occur
    });
  });

  describe('validateConfig', () => {
    it('should return valid for correct config', () => {
      const testConfig = createTestConfig();
      const result = configManager.validateConfig(testConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid with errors for incorrect config', () => {
      const invalidConfig = {
        name: '',
        version: '',
        environment: 'invalid',
        services: [],
        global: {
          port: 3000,
          host: 'localhost',
          cluster: false,
          workers: 1,
          shutdownTimeout: 30000
        },
        orchestration: {
          enabled: true,
          autoScaling: {
            enabled: true,
            minInstances: 1,
            maxInstances: 10,
            scaleUpThreshold: 0.8,
            scaleDownThreshold: 0.3
          },
          serviceDependencies: [],
          migration: {
            enabled: true,
            autoMigrate: true,
            backupBeforeMigration: true,
            rollbackOnFailure: true
          }
        },
        deployment: {
          enabled: true,
          strategy: 'rolling',
          healthCheckEndpoint: '/health',
          readinessProbe: {
            enabled: true,
            interval: 5000,
            timeout: 3000,
            threshold: 1,
            failureThreshold: 3
          },
          livenessProbe: {
            enabled: true,
            interval: 10000,
            timeout: 3000,
            threshold: 1,
            failureThreshold: 3
          },
          rollback: {
            enabled: true,
            automatic: true,
            timeout: 300000,
            healthCheckInterval: 10000
          }
        },
        optimization: {
          enabled: true,
          cpu: {
            enabled: true,
            target: 0.7,
            scaleDown: 0.3
          },
          memory: {
            enabled: true,
            target: 0.8,
            scaleDown: 0.3
          },
          network: {
            enabled: true,
            compression: true,
            caching: true
          },
          database: {
            enabled: true,
            connectionPooling: true,
            queryCaching: true
          }
        }
      };

      const result = configManager.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should validate service configurations', () => {
      const configWithInvalidService = {
        ...createTestConfig(),
        services: [
          {
            id: '',
            name: '',
            version: '',
            host: '',
            port: 0,
            healthCheck: {
              enabled: true,
              endpoint: '/health',
              interval: 5000,
              timeout: 3000,
              retries: 3,
              healthyThreshold: 2,
              unhealthyThreshold: 3
            },
            loadBalancing: {
              strategy: 'round-robin',
              stickySessions: false,
              healthCheckInterval: 5000,
              nodes: []
            },
            circuitBreaker: {
              enabled: true,
              threshold: 5,
              timeout: 60000,
              resetTimeout: 30000,
              halfOpenRequests: 1,
              slidingWindowSize: 10,
              slidingWindowType: 'count'
            },
            retry: {
              enabled: true,
              maxAttempts: 3,
              delayMs: 1000,
              backoffMultiplier: 2,
              maxDelayMs: 10000,
              retryableStatusCodes: []
            },
            security: {
              enabled: true,
              auth: {
                type: 'api-key'
              },
              rateLimiting: {
                enabled: true,
                requestsPerMinute: 60,
                burst: 10
              },
              cors: {
                enabled: true,
                origins: ['*'],
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                headers: ['*'],
                credentials: false
              },
              encryption: {
                enabled: false,
                algorithm: 'AES-256-GCM'
              }
            },
            cache: {
              enabled: true,
              type: 'memory',
              ttl: 3600,
              maxSize: 10000,
              evictionPolicy: 'lru'
            },
            monitoring: {
              enabled: true,
              metrics: {
                enabled: true,
                interval: 10000,
                retention: 86400
              },
              tracing: {
                enabled: true,
                sampling: 0.1
              },
              logging: {
                level: 'info',
                format: 'json',
                outputs: ['console']
              }
            }
          }
        ]
      };

      const result = configManager.validateConfig(configWithInvalidService);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});